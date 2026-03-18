# 3.2 流式 API 调用

## 学习目标

掌握 OpenAI 和 Anthropic 的流式 API 调用方法，实现实时响应处理。

## 核心概念

### 为什么需要流式输出？

| 场景 | 非流式 | 流式 |
|------|--------|------|
| 等待时间 | 等待完整响应（可能30秒+） | 立即开始显示 |
| 用户体验 | 长时间无响应 | 实时看到输出 |
| 资源占用 | 需要存储完整响应 | 逐块处理 |
| 取消操作 | 无法中断 | 可以随时中断 |

## 1. OpenAI 流式 API

### 基础用法

```typescript
// src/providers/openai-stream.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function streamChat(prompt: string): Promise<void> {
  // 创建流式请求
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    stream: true,  // 启用流式输出
  });

  // 遍历流式响应
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    process.stdout.write(delta);
  }

  console.log(); // 结束换行
}

// 使用
streamChat('讲一个短故事');
```

**代码详解：**

```typescript
const stream = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: prompt }],
  stream: true,  // 关键参数
});
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `stream` | boolean | 设为 `true` 启用流式 |
| 返回值 | Stream<ChatCompletionChunk> | 异步可迭代对象 |

```typescript
for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta?.content || '';
}
```

| 属性 | 类型 | 说明 |
|------|------|------|
| `chunk.choices` | array | 选择数组（通常只有一个） |
| `delta.content` | string | 增量文本内容 |
| `delta.role` | string | 角色（仅第一个 chunk 有） |

### OpenAI 流式响应结构

```typescript
// 每个 chunk 的结构
interface ChatCompletionChunk {
  id: string;           // 响应 ID，如 "chatcmpl-xxx"
  object: 'chat.completion.chunk';
  created: number;      // 时间戳
  model: string;        // 模型名
  choices: [{
    index: number;      // 选择索引
    delta: {
      role?: string;    // 仅第一个 chunk
      content?: string; // 增量内容
    };
    finish_reason: string | null;  // 完成原因
  }];
}
```

**流式输出示例：**

```
chunk 1: { delta: { role: "assistant" }, finish_reason: null }
chunk 2: { delta: { content: "从" }, finish_reason: null }
chunk 3: { delta: { content: "前" }, finish_reason: null }
chunk 4: { delta: { content: "有" }, finish_reason: null }
...
chunk N: { delta: {}, finish_reason: "stop" }
```

### 完整的 OpenAI 流式封装

```typescript
// src/providers/openai-stream-wrapper.ts
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat';

export interface StreamOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  onChunk?: (delta: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export class OpenAIStreamWrapper {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  /**
   * 流式聊天
   */
  async *stream(
    messages: ChatCompletionMessageParam[],
    options: StreamOptions = {}
  ): AsyncGenerator<string> {
    const {
      model = 'gpt-4o',
      temperature = 0.7,
      maxTokens = 4096,
      onChunk,
      onComplete,
      onError,
    } = options;

    let fullText = '';

    try {
      const stream = await this.client.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;

        if (delta) {
          fullText += delta;
          onChunk?.(delta);
          yield delta;
        }

        // 检查是否完成
        if (chunk.choices[0]?.finish_reason === 'stop') {
          onComplete?.(fullText);
        }
      }
    } catch (error) {
      onError?.(error as Error);
      throw error;
    }
  }

  /**
   * 流式聊天并返回完整文本
   */
  async streamComplete(
    messages: ChatCompletionMessageParam[],
    options: StreamOptions = {}
  ): Promise<string> {
    let fullText = '';

    for await (const delta of this.stream(messages, options)) {
      fullText += delta;
    }

    return fullText;
  }
}
```

## 2. Anthropic 流式 API

### 基础用法

```typescript
// src/providers/anthropic-stream.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function streamChat(prompt: string): Promise<void> {
  // 创建流式请求
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  // 方式1: 监听事件
  stream.on('text', (text) => {
    process.stdout.write(text);
  });

  // 等待流完成
  const finalMessage = await stream.finalMessage();
  console.log('\n\nTotal tokens:', finalMessage.usage);
}
```

**代码详解：**

```typescript
const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,  // Anthropic 必须指定
  messages: [{ role: 'user', content: prompt }],
});
```

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `model` | string | 是 | 模型名称 |
| `max_tokens` | number | 是 | 最大输出 token 数 |
| `messages` | array | 是 | 消息数组 |

### Anthropic 流式事件类型

```typescript
// Anthropic SDK 事件类型
type StreamEvent =
  | { type: 'message_start'; message: Message }
  | { type: 'content_block_start'; index: number; content_block: ContentBlock }
  | { type: 'content_block_delta'; index: number; delta: Delta }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: MessageDelta; usage: Usage }
  | { type: 'message_stop' };
```

**事件流程图：**

```
message_start
    │
    ▼
content_block_start (type: text)
    │
    ▼
content_block_delta (text delta)  ←── 重复多次
    │
    ▼
content_block_stop
    │
    ▼
message_delta (usage)
    │
    ▼
message_stop
```

### 使用 async iterator

```typescript
// src/providers/anthropic-iterator.ts

async function* streamWithIterator(
  prompt: string
): AsyncGenerator<string> {
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  for await (const event of stream) {
    // 只处理文本增量事件
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}

// 使用
async function main() {
  for await (const text of streamWithIterator('你好')) {
    process.stdout.write(text);
  }
}
```

### 完整的 Anthropic 流式封装

```typescript
// src/providers/anthropic-stream-wrapper.ts
import Anthropic from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';

export interface AnthropicStreamOptions {
  model?: string;
  maxTokens?: number;
  system?: string;
  temperature?: number;
  onChunk?: (delta: string) => void;
  onComplete?: (fullText: string, usage: Usage) => void;
  onError?: (error: Error) => void;
}

interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export class AnthropicStreamWrapper {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * 流式聊天
   */
  async *stream(
    messages: MessageParam[],
    options: AnthropicStreamOptions = {}
  ): AsyncGenerator<string> {
    const {
      model = 'claude-sonnet-4-6',
      maxTokens = 4096,
      system,
      temperature = 0.7,
      onChunk,
      onComplete,
      onError,
    } = options;

    let fullText = '';
    let usage: Usage = { inputTokens: 0, outputTokens: 0 };

    try {
      const stream = this.client.messages.stream({
        model,
        max_tokens: maxTokens,
        system,
        messages,
        temperature,
      });

      // 监听文本事件
      stream.on('text', (text) => {
        fullText += text;
        onChunk?.(text);
      });

      // 监听使用量更新
      stream.on('messageDelta', (delta) => {
        if (delta.usage) {
          usage.outputTokens = delta.usage.output_tokens || 0;
        }
      });

      // 遍历事件
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield event.delta.text;
        }
      }

      // 获取最终消息以获取输入 token
      const finalMessage = await stream.finalMessage();
      usage.inputTokens = finalMessage.usage.input_tokens;
      usage.outputTokens = finalMessage.usage.output_tokens;

      onComplete?.(fullText, usage);
    } catch (error) {
      onError?.(error as Error);
      throw error;
    }
  }

  /**
   * 流式聊天并返回完整结果
   */
  async streamComplete(
    messages: MessageParam[],
    options: AnthropicStreamOptions = {}
  ): Promise<{ content: string; usage: Usage }> {
    let fullText = '';
    let usage: Usage = { inputTokens: 0, outputTokens: 0 };

    for await (const delta of this.stream(messages, {
      ...options,
      onComplete: (text, u) => {
        fullText = text;
        usage = u;
      },
    })) {
      fullText += delta;
    }

    return { content: fullText, usage };
  }
}
```

## 3. 统一流式接口

### 抽象流式 Provider

```typescript
// src/providers/stream-base.ts

export interface StreamResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

export interface StreamCallbacks {
  onChunk?: (delta: string) => void;
  onComplete?: (result: StreamResult) => void;
  onError?: (error: Error) => void;
}

export abstract class StreamProvider {
  abstract stream(
    messages: Message[],
    callbacks?: StreamCallbacks
  ): AsyncGenerator<string>;

  async streamComplete(
    messages: Message[],
    callbacks?: StreamCallbacks
  ): Promise<StreamResult> {
    let content = '';
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const delta of this.stream(messages, callbacks)) {
      content += delta;
    }

    return { content, inputTokens, outputTokens };
  }
}

// 消息类型
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

### 统一封装

```typescript
// src/providers/unified-stream.ts
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export type ProviderType = 'openai' | 'anthropic';

export class UnifiedStreamProvider extends StreamProvider {
  private openai?: OpenAI;
  private anthropic?: Anthropic;

  constructor(
    private provider: ProviderType,
    apiKey: string
  ) {
    super();

    if (provider === 'openai') {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  async *stream(
    messages: Message[],
    callbacks?: StreamCallbacks,
    options?: { model?: string; maxTokens?: number }
  ): AsyncGenerator<string> {
    if (this.provider === 'openai') {
      yield* this.streamOpenAI(messages, callbacks, options);
    } else {
      yield* this.streamAnthropic(messages, callbacks, options);
    }
  }

  private async *streamOpenAI(
    messages: Message[],
    callbacks?: StreamCallbacks,
    options?: { model?: string; maxTokens?: number }
  ): AsyncGenerator<string> {
    const stream = await this.openai!.chat.completions.create({
      model: options?.model || 'gpt-4o',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: options?.maxTokens,
      stream: true,
    });

    let fullText = '';

    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          callbacks?.onChunk?.(delta);
          yield delta;
        }
      }
    } catch (error) {
      callbacks?.onError?.(error as Error);
      throw error;
    }
  }

  private async *streamAnthropic(
    messages: Message[],
    callbacks?: StreamCallbacks,
    options?: { model?: string; maxTokens?: number }
  ): AsyncGenerator<string> {
    const { system, chatMessages } = this.extractSystemMessage(messages);

    const stream = this.anthropic!.messages.stream({
      model: options?.model || 'claude-sonnet-4-6',
      max_tokens: options?.maxTokens || 4096,
      system,
      messages: chatMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    try {
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const text = event.delta.text;
          callbacks?.onChunk?.(text);
          yield text;
        }
      }
    } catch (error) {
      callbacks?.onError?.(error as Error);
      throw error;
    }
  }

  private extractSystemMessage(messages: Message[]): {
    system?: string;
    chatMessages: Message[];
  } {
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    return {
      system: systemMessage?.content,
      chatMessages,
    };
  }
}
```

## 参数说明

### OpenAI 流式参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `model` | string | 'gpt-4o' | 模型名称 |
| `messages` | array | - | 消息数组 |
| `stream` | boolean | true | 启用流式 |
| `temperature` | number | 0.7 | 随机性 (0-2) |
| `max_tokens` | number | - | 最大输出 token |

### Anthropic 流式参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `model` | string | 'claude-sonnet-4-6' | 模型名称 |
| `messages` | array | - | 消息数组（不含 system） |
| `system` | string | - | 系统提示词 |
| `max_tokens` | number | 4096 | 最大输出 token（必需） |
| `temperature` | number | 0.7 | 随机性 (0-1) |

## 使用示例

### 实时聊天 CLI

```typescript
// src/examples/stream-chat-cli.ts
import readline from 'readline';
import { UnifiedStreamProvider } from '../providers/unified-stream.js';

const provider = new UnifiedStreamProvider(
  'anthropic',
  process.env.ANTHROPIC_API_KEY!
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const messages: Message[] = [];

console.log('Chat CLI (type "exit" to quit)\n');

async function chat() {
  rl.question('You: ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      rl.close();
      return;
    }

    messages.push({ role: 'user', content: input });

    process.stdout.write('AI: ');

    let response = '';
    for await (const delta of provider.stream(messages)) {
      process.stdout.write(delta);
      response += delta;
    }

    console.log('\n');

    messages.push({ role: 'assistant', content: response });

    chat(); // 继续对话
  });
}

chat();
```

## 练习题

### 练习 1: 实现流式取消

```typescript
// exercises/01-stream-cancel.ts

export class CancellableStream {
  /**
   * 实现：可取消的流式请求
   * 要求：
   * 1. 提供 cancel() 方法中断流
   * 2. 中断后触发 onCancel 回调
   */
  private aborted = false;

  async *stream(messages: Message[]): AsyncGenerator<string> {
    // TODO: 实现代码
  }

  cancel(): void {
    // TODO: 实现代码
  }
}
```

### 练习 2: 实现流式超时

```typescript
// exercises/02-stream-timeout.ts

export class TimeoutStream {
  /**
   * 实现：带超时的流式请求
   * 要求：
   * 1. 如果在指定时间内没有收到任何数据，抛出超时错误
   * 2. 每次收到数据时重置超时计时器
   */
  async *stream(
    messages: Message[],
    timeoutMs: number
  ): AsyncGenerator<string> {
    // TODO: 实现代码
  }
}
```

### 练习 3: 实现流式重试

```typescript
// exercises/03-stream-retry.ts

export class RetryableStream {
  /**
   * 实现：带重试的流式请求
   * 要求：
   * 1. 如果流中断，自动重连
   * 2. 记录已接收的内容，重连时不重复
   */
  async *stream(
    messages: Message[],
    maxRetries: number
  ): AsyncGenerator<string> {
    // TODO: 实现代码
  }
}
```

## 下一步

完成本节后，继续学习 [3.3 流式响应解析](./03-stream-parsing.md) →
