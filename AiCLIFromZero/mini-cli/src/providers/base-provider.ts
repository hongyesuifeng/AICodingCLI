// src/providers/base-provider.ts
import {
  Message,
  Tool,
  ChatOptions,
  ChatResult,
  StreamChunk,
  ProviderCapabilities,
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
      if (!msg.role) {
        throw new Error('Each message must have a role');
      }
      // 系统消息可以没有 content
      if (msg.role !== 'system' && !msg.content) {
        throw new Error('Each message must have content');
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
