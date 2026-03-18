# 3.3 流式响应解析

## 学习目标

掌握流式响应的解析技术，包括 Buffer 管理、边界处理和完整块检测。

## 核心概念

### 流式解析的挑战

| 挑战 | 说明 | 示例 |
|------|------|------|
| 数据分块 | 一条消息可能分成多个 chunk | `{"content": "Hel` + `lo"}` |
| 边界问题 | chunk 可能在任意位置截断 | UTF-8 多字节字符被分割 |
| 不完整 JSON | JSON 可能在 chunk 边界不完整 | `{"text": "abc` 缺少 `}` |
| 事件检测 | 检测完整事件的边界 | SSE 的 `\n\n` 分隔符 |

## 1. Buffer 管理

### 基础 Buffer 管理器

```typescript
// src/streaming/buffer-manager.ts

export class BufferManager {
  private buffer: string = '';
  private maxSize: number;

  constructor(maxSize: number = 1024 * 1024) { // 默认 1MB
    this.maxSize = maxSize;
  }

  /**
   * 追加数据到缓冲区
   */
  append(data: string): void {
    if (this.buffer.length + data.length > this.maxSize) {
      throw new Error('Buffer overflow: exceeds maximum size');
    }
    this.buffer += data;
  }

  /**
   * 获取当前缓冲区内容
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * 获取缓冲区长度
   */
  getLength(): number {
    return this.buffer.length;
  }

  /**
   * 从缓冲区移除已处理的数据
   */
  shift(count: number): string {
    const removed = this.buffer.slice(0, count);
    this.buffer = this.buffer.slice(count);
    return removed;
  }

  /**
   * 清空缓冲区
   */
  clear(): void {
    this.buffer = '';
  }

  /**
   * 检查缓冲区是否为空
   */
  isEmpty(): boolean {
    return this.buffer.length === 0;
  }
}
```

**代码详解：**

```typescript
if (this.buffer.length + data.length > this.maxSize) {
  throw new Error('Buffer overflow');
}
```
- 防止恶意服务器发送无限数据
- 避免内存耗尽攻击

```typescript
shift(count: number): string {
  const removed = this.buffer.slice(0, count);
  this.buffer = this.buffer.slice(count);
  return removed;
}
```

| 操作 | 说明 |
|------|------|
| `slice(0, count)` | 提取前 count 个字符 |
| `slice(count)` | 返回从 count 开始到末尾的子串 |
| 重新赋值 | 更新 buffer，释放已处理数据 |

### 查找完整消息

```typescript
// src/streaming/buffer-manager.ts (续)

export class BufferManager {
  // ... 前面的代码

  /**
   * 尝试提取一条完整消息
   * @param delimiter 消息分隔符
   * @returns 完整消息，如果没有则返回 null
   */
  extractMessage(delimiter: string = '\n'): string | null {
    const index = this.buffer.indexOf(delimiter);

    if (index === -1) {
      return null; // 没有找到完整消息
    }

    const message = this.buffer.slice(0, index);
    this.buffer = this.buffer.slice(index + delimiter.length);

    return message;
  }

  /**
   * 尝试提取多条消息
   * @param delimiter 消息分隔符
   * @returns 消息数组
   */
  extractMessages(delimiter: string = '\n'): string[] {
    const messages: string[] = [];

    while (true) {
      const message = this.extractMessage(delimiter);
      if (message === null) break;
      messages.push(message);
    }

    return messages;
  }

  /**
   * 检查缓冲区是否以指定前缀开头
   */
  startsWith(prefix: string): boolean {
    return this.buffer.startsWith(prefix);
  }

  /**
   * 查找模式在缓冲区中的位置
   */
  indexOf(pattern: string): number {
    return this.buffer.indexOf(pattern);
  }
}
```

## 2. JSON 流式解析

### 问题：JSON 被截断

```
chunk1: {"content": "Hello
chunk2: World", "done": false}
```

### 解决方案：JSON 缓冲解析器

```typescript
// src/streaming/json-stream-parser.ts

export interface JSONStreamResult {
  json: any;
  remaining: string;
}

export class JSONStreamParser {
  private buffer = '';

  /**
   * 追加数据
   */
  append(data: string): void {
    this.buffer += data;
  }

  /**
   * 尝试解析一个完整的 JSON 对象
   * @returns 解析结果，包含 JSON 对象和剩余数据
   */
  tryParse(): JSONStreamResult | null {
    const trimmed = this.buffer.trimStart();

    if (trimmed.length === 0) {
      return null;
    }

    // 确定起始字符
    const firstChar = trimmed[0];

    if (firstChar === '{') {
      return this.tryParseObject(trimmed);
    } else if (firstChar === '[') {
      return this.tryParseArray(trimmed);
    } else if (firstChar === '"') {
      return this.tryParseString(trimmed);
    } else if (firstChar === 't' || firstChar === 'f') {
      return this.tryParseBoolean(trimmed);
    } else if (firstChar === 'n') {
      return this.tryParseNull(trimmed);
    } else if (firstChar === '-' || /\d/.test(firstChar)) {
      return this.tryParseNumber(trimmed);
    }

    return null;
  }

  /**
   * 尝试解析 JSON 对象
   */
  private tryParseObject(str: string): JSONStreamResult | null {
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === '\\') {
        escape = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') depth++;
        if (char === '}') {
          depth--;
          if (depth === 0) {
            // 找到完整的对象
            try {
              const json = JSON.parse(str.slice(0, i + 1));
              return {
                json,
                remaining: str.slice(i + 1),
              };
            } catch {
              return null;
            }
          }
        }
      }
    }

    return null; // 对象不完整
  }

  /**
   * 尝试解析 JSON 数组
   */
  private tryParseArray(str: string): JSONStreamResult | null {
    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (char === '\\') {
        escape = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '[') depth++;
        if (char === ']') {
          depth--;
          if (depth === 0) {
            try {
              const json = JSON.parse(str.slice(0, i + 1));
              return {
                json,
                remaining: str.slice(i + 1),
              };
            } catch {
              return null;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * 尝试解析字符串
   */
  private tryParseString(str: string): JSONStreamResult | null {
    try {
      // 尝试找到字符串结束位置
      let i = 1;
      let escape = false;

      while (i < str.length) {
        const char = str[i];

        if (escape) {
          escape = false;
          i++;
          continue;
        }

        if (char === '\\') {
          escape = true;
          i++;
          continue;
        }

        if (char === '"') {
          const json = JSON.parse(str.slice(0, i + 1));
          return {
            json,
            remaining: str.slice(i + 1),
          };
        }

        i++;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * 尝试解析布尔值
   */
  private tryParseBoolean(str: string): JSONStreamResult | null {
    if (str.startsWith('true')) {
      return { json: true, remaining: str.slice(4) };
    }
    if (str.startsWith('false')) {
      return { json: false, remaining: str.slice(5) };
    }
    return null;
  }

  /**
   * 尝试解析 null
   */
  private tryParseNull(str: string): JSONStreamResult | null {
    if (str.startsWith('null')) {
      return { json: null, remaining: str.slice(4) };
    }
    return null;
  }

  /**
   * 尝试解析数字
   */
  private tryParseNumber(str: string): JSONStreamResult | null {
    const match = str.match(/^-?\d+\.?\d*([eE][+-]?\d+)?/);
    if (match) {
      try {
        const json = JSON.parse(match[0]);
        return {
          json,
          remaining: str.slice(match[0].length),
        };
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * 提交解析结果，更新内部缓冲区
   */
  commit(result: JSONStreamResult): void {
    this.buffer = result.remaining;
  }

  /**
   * 获取当前缓冲区内容
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

**代码详解 - 括号匹配算法：**

```typescript
let depth = 0;
// ...
if (char === '{') depth++;
if (char === '}') {
  depth--;
  if (depth === 0) {
    // 找到完整对象
  }
}
```

**执行流程：**

```
输入: {"a": {"b": 1}}

位置:  0  1  2  3  4  5  6  7  8  9 10 11
字符:  {  "  a  "  :     {  "  b  "  :  1  }
depth: 1              2                 1  0

当 depth 回到 0 时，说明找到完整的 JSON 对象
```

### 使用示例

```typescript
// src/examples/json-stream-demo.ts
import { JSONStreamParser } from '../streaming/json-stream-parser.js';

const parser = new JSONStreamParser();

// 模拟分块接收
const chunks = [
  '{"content": "Hel',
  'lo", "done": fal',
  'se}{"content": "Wor',
  'ld", "done": true}',
];

for (const chunk of chunks) {
  parser.append(chunk);
  console.log('Buffer:', parser.getBuffer());

  let result;
  while ((result = parser.tryParse()) !== null) {
    console.log('Parsed:', result.json);
    parser.commit(result);
  }
}

// 输出：
// Buffer: {"content": "Hel
// Buffer: {"content": "Hello", "done": false}{"content": "Wor
// Parsed: { content: 'Hello', done: false }
// Buffer: {"content": "World", "done": true}
// Parsed: { content: 'World', done: true }
```

## 3. OpenAI 流式响应解析

### OpenAI 数据格式

```
data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":"Hello"}}]}
data: {"id":"chatcmpl-xxx","choices":[{"delta":{"content":" World"}}]}
data: [DONE]
```

### 解析器实现

```typescript
// src/streaming/openai-stream-parser.ts

export interface OpenAIStreamChunk {
  id: string;
  content: string;
  done: boolean;
}

export class OpenAIStreamParser {
  private buffer = new BufferManager();

  /**
   * 处理接收到的数据
   */
  parse(data: string): OpenAIStreamChunk[] {
    this.buffer.append(data);
    const chunks: OpenAIStreamChunk[] = [];

    while (true) {
      const line = this.buffer.extractMessage('\n');
      if (line === null) break;

      const trimmed = line.trim();
      if (!trimmed) continue; // 空行

      const chunk = this.parseLine(trimmed);
      if (chunk) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  /**
   * 解析单行数据
   */
  private parseLine(line: string): OpenAIStreamChunk | null {
    // 检查是否是 data: 前缀
    if (!line.startsWith('data: ')) {
      return null;
    }

    const data = line.slice(6); // 去掉 'data: '

    // 检查是否是结束标记
    if (data === '[DONE]') {
      return { id: '', content: '', done: true };
    }

    try {
      const json = JSON.parse(data);
      const content = json.choices?.[0]?.delta?.content || '';

      return {
        id: json.id,
        content,
        done: false,
      };
    } catch (error) {
      console.error('Failed to parse JSON:', data);
      return null;
    }
  }

  /**
   * 重置解析器
   */
  reset(): void {
    this.buffer.clear();
  }
}
```

## 4. Anthropic 流式响应解析

### Anthropic 数据格式

```
event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" World"}}

event: message_stop
data: {}
```

### 解析器实现

```typescript
// src/streaming/anthropic-stream-parser.ts

export interface AnthropicStreamEvent {
  type: string;
  index?: number;
  delta?: {
    type: string;
    text: string;
  };
}

export class AnthropicStreamParser {
  private buffer = new BufferManager();
  private currentEvent: { event?: string; data?: string } = {};

  /**
   * 处理接收到的数据
   */
  parse(data: string): AnthropicStreamEvent[] {
    this.buffer.append(data);
    const events: AnthropicStreamEvent[] = [];

    while (true) {
      const line = this.buffer.extractMessage('\n');
      if (line === null) break;

      const trimmed = line.trim();

      if (!trimmed) {
        // 空行，表示事件结束
        if (this.currentEvent.data) {
          const event = this.buildEvent();
          if (event) events.push(event);
        }
        this.currentEvent = {};
        continue;
      }

      // 解析字段
      if (trimmed.startsWith('event:')) {
        this.currentEvent.event = trimmed.slice(6).trim();
      } else if (trimmed.startsWith('data:')) {
        this.currentEvent.data = trimmed.slice(5).trim();
      }
    }

    return events;
  }

  /**
   * 构建事件对象
   */
  private buildEvent(): AnthropicStreamEvent | null {
    if (!this.currentEvent.data) {
      return null;
    }

    try {
      const json = JSON.parse(this.currentEvent.data);

      return {
        type: json.type || this.currentEvent.event || 'message',
        index: json.index,
        delta: json.delta,
      };
    } catch (error) {
      console.error('Failed to parse JSON:', this.currentEvent.data);
      return null;
    }
  }

  /**
   * 提取文本内容
   */
  extractText(events: AnthropicStreamEvent[]): string {
    return events
      .filter(e => e.type === 'content_block_delta')
      .filter(e => e.delta?.type === 'text_delta')
      .map(e => e.delta?.text || '')
      .join('');
  }

  /**
   * 重置解析器
   */
  reset(): void {
    this.buffer.clear();
    this.currentEvent = {};
  }
}
```

## 5. 通用流式解析器

```typescript
// src/streaming/unified-parser.ts

export type ProviderType = 'openai' | 'anthropic' | 'generic';

export interface StreamChunk {
  content: string;
  done: boolean;
  metadata?: Record<string, any>;
}

export class UnifiedStreamParser {
  private openaiParser?: OpenAIStreamParser;
  private anthropicParser?: AnthropicStreamParser;
  private buffer?: BufferManager;

  constructor(private provider: ProviderType) {
    switch (provider) {
      case 'openai':
        this.openaiParser = new OpenAIStreamParser();
        break;
      case 'anthropic':
        this.anthropicParser = new AnthropicStreamParser();
        break;
      default:
        this.buffer = new BufferManager();
    }
  }

  /**
   * 解析数据
   */
  parse(data: string): StreamChunk[] {
    switch (this.provider) {
      case 'openai':
        return this.parseOpenAI(data);
      case 'anthropic':
        return this.parseAnthropic(data);
      default:
        return this.parseGeneric(data);
    }
  }

  private parseOpenAI(data: string): StreamChunk[] {
    const chunks = this.openaiParser!.parse(data);
    return chunks.map(c => ({
      content: c.content,
      done: c.done,
      metadata: { id: c.id },
    }));
  }

  private parseAnthropic(data: string): StreamChunk[] {
    const events = this.anthropicParser!.parse(data);
    return events
      .filter(e => e.type === 'content_block_delta')
      .filter(e => e.delta?.type === 'text_delta')
      .map(e => ({
        content: e.delta?.text || '',
        done: false,
      }));
  }

  private parseGeneric(data: string): StreamChunk[] {
    // 简单的文本流
    this.buffer!.append(data);
    const content = this.buffer!.extractMessages('\n').join('\n');

    if (!content) return [];

    return [{
      content: content + '\n',
      done: false,
    }];
  }

  /**
   * 重置解析器
   */
  reset(): void {
    this.openaiParser?.reset();
    this.anthropicParser?.reset();
    this.buffer?.clear();
  }
}
```

## 参数说明

### BufferManager 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxSize` | number | 1048576 (1MB) | 最大缓冲区大小 |

### JSONStreamParser 方法

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `append` | data: string | void | 追加数据 |
| `tryParse` | - | JSONStreamResult \| null | 尝试解析 |
| `commit` | result | void | 提交解析结果 |
| `clear` | - | void | 清空缓冲区 |

## 使用示例

### 完整的流式处理流程

```typescript
// src/examples/complete-stream-flow.ts
import { UnifiedStreamParser } from '../streaming/unified-parser.js';

async function processStream(
  response: Response,
  provider: ProviderType
): Promise<string> {
  const parser = new UnifiedStreamParser(provider);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const parsed = parser.parse(chunk);

      for (const p of parsed) {
        fullText += p.content;
        process.stdout.write(p.content);

        if (p.done) {
          console.log('\n[Stream completed]');
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullText;
}
```

## 练习题

### 练习 1: 实现 JSON 行解析器

```typescript
// exercises/01-json-lines.ts

export class JSONLinesParser {
  /**
   * 实现：JSON Lines 格式解析器
   * 每行是一个独立的 JSON 对象
   * 要求：处理跨 chunk 的行
   */
  parse(data: string): object[] {
    // TODO: 实现代码
  }
}
```

### 练习 2: 实现增量 JSON 构造器

```typescript
// exercises/02-incremental-json.ts

export class IncrementalJSONBuilder {
  /**
   * 实现：增量构建 JSON 对象
   * 要求：
   * 1. 接收部分 JSON 字符串
   * 2. 返回当前已完成的字段
   */
  append(data: string): { completed: object; pending: string } {
    // TODO: 实现代码
  }
}
```

### 练习 3: 实现多格式自动检测

```typescript
// exercises/03-auto-detect.ts

export class AutoDetectParser {
  /**
   * 实现：自动检测并使用正确的解析器
   * 支持：SSE、JSON Lines、纯文本
   */
  detectAndParse(data: string): StreamChunk[] {
    // TODO: 实现代码
  }
}
```

## 下一步

完成本节后，继续学习 [3.4 终端实时渲染](./04-terminal-render.md) →
