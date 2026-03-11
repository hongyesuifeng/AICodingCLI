/**
 * AI Provider 基类
 */

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResult {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  delta: string;
  done: boolean;
}

export interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeout?: number;
}

export abstract class BaseProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  get model(): string {
    return this.config.model;
  }

  abstract chat(messages: Message[], options?: ChatOptions): Promise<ChatResult>;
  abstract stream(messages: Message[], options?: ChatOptions): AsyncGenerator<StreamChunk>;
}
