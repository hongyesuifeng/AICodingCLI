# 2.1 Provider 抽象设计

## 学习目标

设计和实现可扩展的 AI Provider 抽象接口。

## 1. 核心类型定义

```typescript
// src/types/message.ts

// 消息角色
export type MessageRole = 'system' | 'user' | 'assistant';

// 基础消息
export interface BaseMessage {
  role: MessageRole;
  content: string;
}

// 用户消息（可包含图片）
export interface UserMessage extends BaseMessage {
  role: 'user';
  content: string | ContentPart[];
}

// 助手消息（可包含工具调用）
export interface AssistantMessage extends BaseMessage {
  role: 'assistant';
  toolCalls?: ToolCall[];
}

// 系统消息
export interface SystemMessage extends BaseMessage {
  role: 'system';
}

// 联合类型
export type Message = UserMessage | AssistantMessage | SystemMessage;

// 多模态内容
export interface ContentPart {
  type: 'text' | 'image';
  text?: string;
  imageUrl?: { url: string };
}

// 工具调用
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

// 工具定义
export interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
}

// JSON Schema
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  description?: string;
  enum?: string[];
  items?: JSONSchema;
}

// 聊天选项
export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  timeout?: number;
}

// 聊天结果
export interface ChatResult {
  content: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
  finishReason: 'stop' | 'tool_call' | 'length' | 'content_filter';
}

// Token 使用统计
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
```

## 2. Provider 接口设计

```typescript
// src/providers/base.ts
import {
  Message,
  Tool,
  ChatOptions,
  ChatResult,
} from '../types/message.js';

// Provider 配置
export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
  timeout?: number;
}

// AI Provider 接口
export interface AIProvider {
  // 元信息
  readonly name: string;
  readonly model: string;

  // 核心方法
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResult>;
  stream(
    messages: Message[],
    options?: ChatOptions
  ): AsyncGenerator<StreamChunk>;

  // 工具支持
  chatWithTools(
    messages: Message[],
    tools: Tool[],
    options?: ChatOptions
  ): Promise<ChatResult>;

  // 能力查询
  capabilities(): ProviderCapabilities;
}

// 流式响应块
export interface StreamChunk {
  delta: string;
  toolCall?: Partial<ToolCall>;
  done: boolean;
}

// Provider 能力
export interface ProviderCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  maxContextTokens: number;
  supportedModels: string[];
}
```

## 3. 基础 Provider 实现

```typescript
// src/providers/base-provider.ts
import { AIProvider, ProviderConfig } from './base.js';
import {
  Message,
  Tool,
  ChatOptions,
  ChatResult,
  StreamChunk,
  ProviderCapabilities,
} from '../types/message.js';

export abstract class BaseProvider implements AIProvider {
  abstract readonly name: string;

  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  get model(): string {
    return this.config.model;
  }

  // 子类必须实现
  abstract chat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<ChatResult>;

  abstract stream(
    messages: Message[],
    options?: ChatOptions
  ): AsyncGenerator<StreamChunk>;

  abstract chatWithTools(
    messages: Message[],
    tools: Tool[],
    options?: ChatOptions
  ): Promise<ChatResult>;

  abstract capabilities(): ProviderCapabilities;

  // 通用工具方法
  protected validateMessages(messages: Message[]): void {
    if (!messages || messages.length === 0) {
      throw new Error('Messages cannot be empty');
    }

    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        throw new Error('Each message must have role and content');
      }
    }
  }

  protected mergeOptions(
    defaultOptions: ChatOptions,
    userOptions?: ChatOptions
  ): ChatOptions {
    return { ...defaultOptions, ...userOptions };
  }

  protected handleError(error: any): never {
    // 统一错误处理
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 401) {
        throw new Error('Invalid API key');
      } else if (status === 429) {
        throw new Error('Rate limit exceeded');
      } else if (status === 500) {
        throw new Error('API server error');
      }

      throw new Error(`API error: ${data?.error?.message || 'Unknown error'}`);
    }

    throw error;
  }
}
```

## 4. Provider 注册表

```typescript
// src/providers/registry.ts
import { AIProvider, ProviderConfig } from './base.js';

type ProviderFactory = (config: ProviderConfig) => AIProvider;

class ProviderRegistry {
  private factories = new Map<string, ProviderFactory>();
  private instances = new Map<string, AIProvider>();

  // 注册 Provider 工厂
  register(name: string, factory: ProviderFactory): void {
    this.factories.set(name, factory);
  }

  // 获取或创建 Provider 实例
  get(name: string, config: ProviderConfig): AIProvider {
    const key = `${name}:${config.model}`;

    if (!this.instances.has(key)) {
      const factory = this.factories.get(name);
      if (!factory) {
        throw new Error(`Unknown provider: ${name}`);
      }
      this.instances.set(key, factory(config));
    }

    return this.instances.get(key)!;
  }

  // 列出所有已注册的 Provider
  list(): string[] {
    return Array.from(this.factories.keys());
  }
}

// 全局注册表
export const providerRegistry = new ProviderRegistry();

// 便捷方法
export function registerProvider(name: string, factory: ProviderFactory): void {
  providerRegistry.register(name, factory);
}

export function getProvider(name: string, config: ProviderConfig): AIProvider {
  return providerRegistry.get(name, config);
}
```

## 5. 错误处理

```typescript
// src/utils/errors.ts

// 自定义错误类型
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class RateLimitError extends ProviderError {
  constructor(provider: string, public readonly retryAfter?: number) {
    super('Rate limit exceeded', provider, 'RATE_LIMIT');
    this.name = 'RateLimitError';
  }
}

export class InvalidAPIKeyError extends ProviderError {
  constructor(provider: string) {
    super('Invalid API key', provider, 'INVALID_API_KEY');
    this.name = 'InvalidAPIKeyError';
  }
}

export class ModelNotFoundError extends ProviderError {
  constructor(provider: string, model: string) {
    super(`Model not found: ${model}`, provider, 'MODEL_NOT_FOUND');
    this.name = 'ModelNotFoundError';
  }
}

export class ContextLengthError extends ProviderError {
  constructor(
    provider: string,
    public readonly maxTokens: number,
    public readonly requestedTokens: number
  ) {
    super(
      `Context length exceeded: ${requestedTokens} > ${maxTokens}`,
      provider,
      'CONTEXT_LENGTH'
    );
    this.name = 'ContextLengthError';
  }
}

// 错误处理工具
export function parseAPIError(
  provider: string,
  error: any
): ProviderError {
  if (error.response?.status === 401) {
    return new InvalidAPIKeyError(provider);
  }

  if (error.response?.status === 429) {
    const retryAfter = error.response.headers?.['retry-after'];
    return new RateLimitError(
      provider,
      retryAfter ? parseInt(retryAfter) : undefined
    );
  }

  if (error.response?.status === 404) {
    return new ModelNotFoundError(provider, error.config?.data?.model || 'unknown');
  }

  if (error.response?.status === 400) {
    const message = error.response?.data?.error?.message || 'Bad request';
    if (message.includes('context length')) {
      return new ContextLengthError(provider, 0, 0);
    }
  }

  return new ProviderError(
    error.message || 'Unknown error',
    provider,
    'UNKNOWN',
    error
  );
}
```

## 6. 重试机制

```typescript
// src/utils/retry.ts

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors: string[];
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  retryableErrors: ['RATE_LIMIT', 'TIMEOUT', 'SERVER_ERROR'],
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // 检查是否可重试
      const errorCode = error.code || 'UNKNOWN';
      if (!opts.retryableErrors.includes(errorCode)) {
        throw error;
      }

      // 最后一次尝试不等待
      if (attempt === opts.maxRetries) {
        break;
      }

      // 等待后重试
      await sleep(delay);
      delay = Math.min(delay * opts.backoffFactor, opts.maxDelay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

## 练习

1. **实现 Provider 缓存**: 缓存相同请求的响应
2. **实现请求日志**: 记录所有 API 请求和响应
3. **实现超时处理**: 为所有请求添加超时控制

## 下一步

完成本节后，继续学习 [2.2 OpenAI SDK 集成](./02-openai-sdk.md) →
