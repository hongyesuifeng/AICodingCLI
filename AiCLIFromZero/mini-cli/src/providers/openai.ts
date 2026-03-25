// src/providers/openai.ts
// OpenAI Provider - 暂时禁用，需要安装 openai 包后启用
// 当前仅用于 MiniMax 测试

import { BaseProvider, type ProviderConfig } from './base-provider.js';
import {
  type Message,
  type Tool,
  type ChatOptions,
  type ChatResult,
  type StreamChunk,
  type ProviderCapabilities,
} from '../types/message.js';
import { parseAPIError } from '../utils/errors.js';

export interface OpenAIConfig extends ProviderConfig {
  organization?: string;
}

const OPENAI_MODELS: Record<string, { maxTokens: number; vision: boolean }> = {
  'gpt-4o': { maxTokens: 128000, vision: true },
  'gpt-4o-mini': { maxTokens: 128000, vision: true },
  'gpt-4.1': { maxTokens: 1047576, vision: true },
  'gpt-4.1-mini': { maxTokens: 1047576, vision: true },
};

/**
 * OpenAI Provider
 * 注意：此 provider 需要安装 openai 包才能使用
 * 运行: npm install openai
 */
export class OpenAIProvider extends BaseProvider {
  readonly name = 'openai';

  constructor(config: OpenAIConfig) {
    super(config);
    throw new Error(
      'OpenAI Provider 暂未启用。请运行: npm install openai'
    );
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResult> {
    throw new Error('OpenAI Provider 未初始化');
  }

  async *stream(
    messages: Message[],
    options?: ChatOptions
  ): AsyncGenerator<StreamChunk> {
    throw new Error('OpenAI Provider 未初始化');
  }

  async chatWithTools(
    messages: Message[],
    tools: Tool[],
    options?: ChatOptions
  ): Promise<ChatResult> {
    throw new Error('OpenAI Provider 未初始化');
  }

  capabilities(): ProviderCapabilities {
    const modelConfig = OPENAI_MODELS[this.model] || {
      maxTokens: 128000,
      vision: false,
    };

    return {
      streaming: true,
      tools: true,
      vision: modelConfig.vision,
      maxContextTokens: modelConfig.maxTokens,
      supportedModels: Object.keys(OPENAI_MODELS),
    };
  }
}
