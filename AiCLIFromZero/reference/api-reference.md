# API 参考

核心 API 快速参考。

## Provider API

### AIProvider 接口

```typescript
interface AIProvider {
  // 元信息
  readonly name: string;
  readonly model: string;

  // 核心方法
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResult>;
  stream(messages: Message[], options?: ChatOptions): AsyncGenerator<StreamChunk>;
  chatWithTools(
    messages: Message[],
    tools: Tool[],
    options?: ChatOptions
  ): Promise<ChatResult>;

  // 能力查询
  capabilities(): ProviderCapabilities;
}
```

### ChatOptions

```typescript
interface ChatOptions {
  temperature?: number;      // 0.0 - 2.0
  maxTokens?: number;        // 最大输出 token
  topP?: number;             // 0.0 - 1.0
  stopSequences?: string[];  // 停止序列
  timeout?: number;          // 超时（毫秒）
}
```

### ChatResult

```typescript
interface ChatResult {
  content: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
  finishReason: 'stop' | 'tool_call' | 'length' | 'content_filter';
}
```

## Tool API

### Tool 接口

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (params: Record<string, any>) => Promise<string>;
}
```

### ToolRegistry

```typescript
class ToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  getAll(): Tool[];
  getDefinitions(): ToolDefinition[];
  async execute(name: string, params: any): Promise<string>;
}
```

## Session API

### SessionManager

```typescript
class SessionManager {
  // 创建会话
  create(config?: SessionConfig): Session;

  // 消息操作
  addMessage(message: Message): Promise<void>;
  getMessages(): Message[];
  clearMessages(): void;

  // 持久化
  save(): Promise<void>;
  load(id: string): Promise<Session>;

  // 上下文管理
  getTokenCount(): number;
  getMessagesForAPI(): APIMessage[];
}
```

### Message 类型

```typescript
type MessageRole = 'system' | 'user' | 'assistant';

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  tokens?: number;
  toolCalls?: ToolCall[];
}
```

## Stream API

### StreamChunk

```typescript
interface StreamChunk {
  delta: string;     // 增量文本
  done: boolean;     // 是否完成
  toolCall?: {       // 工具调用（可选）
    id: string;
    name: string;
    arguments: string;
  };
}
```

### 使用示例

```typescript
// 流式处理
for await (const chunk of provider.stream(messages)) {
  if (!chunk.done) {
    process.stdout.write(chunk.delta);
  }
}

// 带回调的流式处理
await processStream(provider.stream(messages), {
  onChunk: (chunk) => console.log(chunk.delta),
  onComplete: (fullText) => console.log('Done!'),
  onError: (error) => console.error(error),
});
```

## Config API

### ConfigManager

```typescript
class ConfigManager {
  load(): Promise<void>;
  get(): AppConfig;
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void;
  save(global?: boolean): Promise<void>;
  reset(): void;
}
```

### 配置结构

```typescript
interface AppConfig {
  version: string;
  ai: {
    model: string;
    apiKey: string;
    baseUrl?: string;
    temperature: number;
    maxTokens: number;
  };
  ui: {
    theme: 'dark' | 'light';
    colorOutput: boolean;
    showTokens: boolean;
  };
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
```

## 错误类型

```typescript
// 基础错误
class ProviderError extends Error {
  provider: string;
  code: string;
}

// 特定错误
class RateLimitError extends ProviderError {
  retryAfter?: number;
}

class InvalidAPIKeyError extends ProviderError {}
class ModelNotFoundError extends ProviderError {}
class ContextLengthError extends ProviderError {}
```

## 事件类型

```typescript
// 钩子事件
type HookEvent =
  | 'user-prompt-submit'   // 用户提交
  | 'pre-tool-use'         // 工具调用前
  | 'post-tool-use'        // 工具调用后
  | 'notification'         // 通知
  | 'stop';                // 停止

// 流式事件
type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; toolCall: ToolCallDelta }
  | { type: 'done'; fullText: string }
  | { type: 'error'; error: Error };
```
