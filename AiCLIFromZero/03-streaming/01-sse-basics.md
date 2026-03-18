# 3.1 SSE (Server-Sent Events) 原理

## 学习目标

理解 Server-Sent Events 协议原理，掌握事件流格式和数据解析方法。

## 核心概念

### 什么是 SSE？

SSE (Server-Sent Events) 是一种服务器向客户端推送数据的技术：

- **单向通信**：服务器 → 客户端
- **基于 HTTP**：不需要特殊协议
- **自动重连**：浏览器原生支持断线重连
- **文本格式**：适合传输文本数据

### SSE vs WebSocket 对比

| 特性 | SSE | WebSocket |
|------|-----|-----------|
| 通信方向 | 单向（服务器→客户端） | 双向 |
| 协议 | HTTP | WS/WSS |
| 数据格式 | 文本 | 文本/二进制 |
| 重连机制 | 浏览器自动重连 | 需要手动实现 |
| 适用场景 | 实时通知、流式输出 | 聊天、游戏 |

## 1. SSE 事件流格式

### 标准格式

```
data: 这是第一行数据\n
\n
data: 这是第二行数据\n
\n
```

### 完整事件格式

```
id: 123\n
event: message\n
data: {"content": "Hello"}\n
retry: 3000\n
\n
```

**字段说明：**

| 字段 | 必需 | 说明 | 示例 |
|------|------|------|------|
| `data` | 是 | 消息数据，可多行 | `data: Hello\n` |
| `id` | 否 | 事件 ID，用于重连 | `id: msg-001\n` |
| `event` | 否 | 事件类型，默认 message | `event: update\n` |
| `retry` | 否 | 重连间隔（毫秒） | `retry: 3000\n` |

### 多行数据

```
data: 第一行\n
data: 第二行\n
data: 第三行\n
\n
```

解析后：`"第一行\n第二行\n第三行"`

## 2. 实现简易 SSE 解析器

### 基础解析器

```typescript
// src/streaming/sse-parser.ts

export interface SSEMessage {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

export class SSEParser {
  private buffer = '';

  /**
   * 解析 SSE 数据流
   * @param chunk 接收到的数据块
   * @returns 解析出的消息数组
   */
  parse(chunk: string): SSEMessage[] {
    // 将新数据追加到缓冲区
    this.buffer += chunk;

    const messages: SSEMessage[] = [];
    const lines = this.buffer.split('\n');

    // 保留最后一个可能不完整的行
    this.buffer = lines.pop() || '';

    let currentMessage: Partial<SSEMessage> = {};
    let currentData: string[] = [];

    for (const line of lines) {
      // 空行表示消息结束
      if (line === '') {
        if (currentData.length > 0) {
          currentMessage.data = currentData.join('\n');
          messages.push(currentMessage as SSEMessage);
        }
        currentMessage = {};
        currentData = [];
        continue;
      }

      // 注释行，忽略
      if (line.startsWith(':')) {
        continue;
      }

      // 解析字段
      const colonIndex = line.indexOf(':');
      let field: string;
      let value: string;

      if (colonIndex === -1) {
        // 没有冒号，整个行是字段名，值为空
        field = line;
        value = '';
      } else {
        field = line.slice(0, colonIndex);
        value = line.slice(colonIndex + 1);
        // 如果值以空格开头，移除它
        if (value.startsWith(' ')) {
          value = value.slice(1);
        }
      }

      // 处理字段
      switch (field) {
        case 'id':
          currentMessage.id = value;
          break;
        case 'event':
          currentMessage.event = value;
          break;
        case 'data':
          currentData.push(value);
          break;
        case 'retry':
          const retry = parseInt(value, 10);
          if (!isNaN(retry)) {
            currentMessage.retry = retry;
          }
          break;
      }
    }

    return messages;
  }

  /**
   * 重置解析器状态
   */
  reset(): void {
    this.buffer = '';
  }
}
```

**代码详解：**

```typescript
const lines = this.buffer.split('\n');
this.buffer = lines.pop() || '';
```

| 步骤 | 作用 | 原因 |
|------|------|------|
| `split('\n')` | 按换行符分割 | SSE 以行为单位 |
| `lines.pop()` | 取出最后一个元素 | 可能是不完整的行 |
| 保留到 buffer | 等待下次数据 | 确保数据完整 |

```typescript
if (line === '') {
  // 空行表示消息结束
}
```
- SSE 规定：**空行分隔消息**
- 遇到空行时，说明一条完整消息已接收

```typescript
if (line.startsWith(':')) {
  continue;
}
```
- `:` 开头的是**注释行**，用于保持连接活跃
- 应该忽略，不作为数据处理

### 使用示例

```typescript
// src/examples/sse-parser-demo.ts
import { SSEParser } from '../streaming/sse-parser.js';

const parser = new SSEParser();

// 模拟接收到的数据块
const chunks = [
  'id: 1\n',
  'event: message\n',
  'data: Hello\n',
  '\n',  // 消息结束
  'id: 2\n',
  'data: World\n',
  '\n',
];

for (const chunk of chunks) {
  const messages = parser.parse(chunk);
  for (const msg of messages) {
    console.log('Received:', msg);
  }
}

// 输出：
// Received: { id: '1', event: 'message', data: 'Hello' }
// Received: { id: '2', data: 'World' }
```

## 3. 处理数据分块

### 问题：数据可能在不完整的位置被截断

```typescript
// 坏情况：一条消息被分成多个 chunk
chunk1: 'id: 1\nevent: message\nda'
chunk2: 'ta: Hello\n\n'
```

### 解决方案：Buffer 缓冲

```typescript
// src/streaming/chunk-buffer.ts

export class ChunkBuffer {
  private buffer = '';

  /**
   * 添加数据到缓冲区
   */
  append(data: string): void {
    this.buffer += data;
  }

  /**
   * 尝试提取完整的 SSE 消息
   * @returns 完整消息，如果没有完整消息则返回 null
   */
  extractMessage(): string | null {
    // 查找消息结束标记（两个连续的换行符）
    const endIndex = this.buffer.indexOf('\n\n');

    if (endIndex === -1) {
      return null; // 没有完整消息
    }

    const message = this.buffer.slice(0, endIndex);
    this.buffer = this.buffer.slice(endIndex + 2); // 跳过 \n\n

    return message;
  }

  /**
   * 获取当前缓冲区内容（用于调试）
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * 清空缓冲区
   */
  clear(): void {
    this.buffer = '';
  }
}
```

**为什么用 `\n\n` 检测消息结束？**

```
field: value\n   ←─ 行结束符
field: value\n   ←─ 行结束符
\n               ←─ 消息结束符（空行）
```

- 每个字段以 `\n` 结束
- 消息以**空行**结束，即 `\n\n`

## 4. 异步迭代器实现

### 创建可读的 SSE 流

```typescript
// src/streaming/sse-stream.ts
import { EventEmitter } from 'events';

export interface SSEStreamOptions {
  url: string;
  headers?: Record<string, string>;
  onRetry?: (attempt: number) => void;
  maxRetries?: number;
}

export class SSEStream extends EventEmitter {
  private parser = new SSEParser();
  private aborted = false;

  async *stream(
    response: Response
  ): AsyncGenerator<SSEMessage> {
    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (!this.aborted) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // 解码二进制数据
        const chunk = decoder.decode(value, { stream: true });

        // 解析 SSE 消息
        const messages = this.parser.parse(chunk);

        for (const message of messages) {
          yield message;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  abort(): void {
    this.aborted = true;
  }
}
```

**代码详解：**

```typescript
const decoder = new TextDecoder();
const chunk = decoder.decode(value, { stream: true });
```

| 参数 | 说明 |
|------|------|
| `value` | Uint8Array，从流中读取的二进制数据 |
| `{ stream: true }` | 表示这是流的一部分，可能有不完整的多字节字符 |

```typescript
const { done, value } = await reader.read();
```
- `done`: 是否读取完成
- `value`: 读取到的数据块 (Uint8Array)

### 使用 Fetch API 消费 SSE

```typescript
// src/examples/sse-fetch.ts

async function consumeSSE(url: string): Promise<void> {
  const response = await fetch(url, {
    headers: {
      'Accept': 'text/event-stream',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const sseStream = new SSEStream();

  for await (const message of sseStream.stream(response)) {
    console.log(`[${message.event || 'message'}] ${message.data}`);

    // 处理特定事件类型
    if (message.event === 'done') {
      console.log('Stream completed');
      break;
    }
  }
}

// 使用示例
consumeSSE('https://api.example.com/stream');
```

**请求头说明：**

| Header | 值 | 作用 |
|--------|-----|------|
| `Accept` | `text/event-stream` | 告诉服务器返回 SSE 格式 |
| `Cache-Control` | `no-cache` | 禁用缓存，确保实时数据 |

## 5. 错误处理

### 常见错误类型

```typescript
// src/streaming/sse-errors.ts

export class SSEError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'SSEError';
  }
}

// 连接错误
export class ConnectionError extends SSEError {
  constructor(cause: Error) {
    super('Connection failed', 'CONNECTION_ERROR', true);
  }
}

// 解析错误
export class ParseError extends SSEError {
  constructor(line: string) {
    super(`Failed to parse line: ${line}`, 'PARSE_ERROR', false);
  }
}

// 超时错误
export class TimeoutError extends SSEError {
  constructor(timeout: number) {
    super(`Stream timed out after ${timeout}ms`, 'TIMEOUT_ERROR', true);
  }
}
```

### 带重连的实现

```typescript
// src/streaming/sse-client.ts

export class SSEClient {
  private retryCount = 0;
  private lastEventId?: string;

  async connect(
    url: string,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      onMessage?: (msg: SSEMessage) => void;
      onError?: (err: Error) => void;
    } = {}
  ): Promise<void> {
    const { maxRetries = 3, retryDelay = 1000, onMessage, onError } = options;

    while (this.retryCount < maxRetries) {
      try {
        const headers: Record<string, string> = {
          'Accept': 'text/event-stream',
        };

        // 发送最后接收的事件 ID（断点续传）
        if (this.lastEventId) {
          headers['Last-Event-ID'] = this.lastEventId;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new ConnectionError(new Error(`HTTP ${response.status}`));
        }

        const sseStream = new SSEStream();

        for await (const message of sseStream.stream(response)) {
          // 记录事件 ID
          if (message.id) {
            this.lastEventId = message.id;
          }

          // 重置重试计数
          this.retryCount = 0;

          onMessage?.(message);
        }

        // 正常结束
        return;

      } catch (error) {
        this.retryCount++;
        onError?.(error as Error);

        if (this.retryCount >= maxRetries) {
          throw error;
        }

        // 指数退避
        const delay = retryDelay * Math.pow(2, this.retryCount - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
}
```

**重连策略：**

```
第1次失败 → 等待 1000ms → 重试
第2次失败 → 等待 2000ms → 重试
第3次失败 → 等待 4000ms → 重试
超过最大次数 → 抛出错误
```

## 参数说明

### SSEParser 配置

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `buffer` | string | '' | 内部缓冲区 |
| `maxBufferSize` | number | 1MB | 最大缓冲区大小 |

### SSEStreamOptions

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `url` | string | 是 | SSE 端点 URL |
| `headers` | object | 否 | 自定义请求头 |
| `maxRetries` | number | 否 | 最大重试次数 |
| `retryDelay` | number | 否 | 重试延迟（毫秒） |

## 练习题

### 练习 1: 实现带超时的 SSE 客户端

```typescript
// exercises/01-sse-timeout.ts

export class SSEClientWithTimeout {
  /**
   * 实现：带超时的 SSE 连接
   * 要求：
   * 1. 如果在 timeout 时间内没有收到任何消息，断开连接
   * 2. 每次收到消息时重置超时计时器
   */
  async connect(
    url: string,
    timeout: number
  ): Promise<void> {
    // TODO: 实现代码
  }
}
```

### 练习 2: 实现 SSE 多路复用

```typescript
// exercises/02-sse-multiplex.ts

export class SSEMultiplexer {
  /**
   * 实现：根据 event 类型分发消息
   * 要求：
   * 1. 支持订阅特定事件类型
   * 2. 不同事件类型的消息发送到不同的处理器
   */
  subscribe(eventType: string, handler: (data: any) => void): void {
    // TODO: 实现代码
  }
}
```

### 练习 3: 实现 SSE 消息验证

```typescript
// exercises/03-sse-validation.ts

export class SSEValidator {
  /**
   * 实现：验证 SSE 消息格式
   * 要求：
   * 1. 验证 data 字段是否是有效的 JSON
   * 2. 验证 event 字段是否在允许的列表中
   */
  validate(message: SSEMessage): boolean {
    // TODO: 实现代码
  }
}
```

## 下一步

完成本节后，继续学习 [3.2 流式 API 调用](./02-stream-api.md) →
