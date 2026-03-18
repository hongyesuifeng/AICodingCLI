// src/providers/minimax.ts
import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider, ProviderConfig } from './base-provider.js';
import {
  Message,
  Tool,
  ChatOptions,
  ChatResult,
  StreamChunk,
  ProviderCapabilities,
} from '../types/message.js';
import { parseAPIError } from '../utils/errors.js';
import { withRetry } from '../utils/retry.js';

// MiniMax 特定配置
export interface MiniMaxConfig extends ProviderConfig {
  enableThinking?: boolean; // 是否启用 thinking 模式
}

// MiniMax API 配置
const MINIMAX_BASE_URL = 'https://api.minimaxi.com/anthropic';

// MiniMax 模型配置
const MINIMAX_MODELS: Record<string, { maxTokens: number; supportsThinking: boolean }> = {
  'MiniMax-M2.5': { maxTokens: 128000, supportsThinking: true },
  'MiniMax-M2.5-highspeed': { maxTokens: 128000, supportsThinking: true },
  'MiniMax-M2.1': { maxTokens: 128000, supportsThinking: true },
  'MiniMax-M2.1-highspeed': { maxTokens: 128000, supportsThinking: true },
  'MiniMax-M2': { maxTokens: 32000, supportsThinking: false },
};

export class MiniMaxProvider extends BaseProvider {
  readonly name = 'minimax';
  private client: Anthropic;
  private enableThinking: boolean;

  constructor(config: MiniMaxConfig) {
    super(config);
    this.enableThinking = config.enableThinking ?? false;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || MINIMAX_BASE_URL,
      timeout: config.timeout || 120000, // MiniMax 可能较慢
    });
  }

  // 同步聊天
  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResult> {
    this.validateMessages(messages);

    try {
      return await withRetry(async () => {
        const { system, chatMessages } = this.separateSystemMessage(messages);

        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: options?.maxTokens || 4096,
          system: system || undefined,
          messages: this.convertMessages(chatMessages),
          temperature: options?.temperature,
          top_p: options?.topP,
          stop_sequences: options?.stopSequences,
        });

        // 查找文本内容
        const textContent = response.content.find((c) => c.type === 'text');

        return {
          content: textContent?.text || '',
          usage: {
            promptTokens: response.usage.input_tokens,
            completionTokens: response.usage.output_tokens,
            totalTokens: response.usage.input_tokens + response.usage.output_tokens,
          },
          finishReason: this.mapFinishReason(response.stop_reason),
        };
      });
    } catch (error) {
      throw parseAPIError(this.name, error);
    }
  }

  // 流式聊天 - 支持 thinking 模式
  async *stream(
    messages: Message[],
    options?: ChatOptions
  ): AsyncGenerator<StreamChunk> {
    this.validateMessages(messages);

    try {
      const { system, chatMessages } = this.separateSystemMessage(messages);

      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: options?.maxTokens || 4096,
        system: system || undefined,
        messages: this.convertMessages(chatMessages),
        temperature: options?.temperature,
      });

      for await (const event of stream) {
        // 处理 thinking 块 (MiniMax 特有)
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'thinking_delta'
        ) {
          yield {
            delta: (event.delta as any).thinking || '',
            done: false,
            type: 'thinking',
          };
        }

        // 处理普通文本块
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield {
            delta: event.delta.text,
            done: false,
            type: 'text',
          };
        }

        // 消息结束
        if (event.type === 'message_stop') {
          yield {
            delta: '',
            done: true,
          };
        }
      }
    } catch (error) {
      throw parseAPIError(this.name, error);
    }
  }

  // 带工具的聊天
  async chatWithTools(
    messages: Message[],
    tools: Tool[],
    options?: ChatOptions
  ): Promise<ChatResult> {
    this.validateMessages(messages);

    try {
      const { system, chatMessages } = this.separateSystemMessage(messages);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: options?.maxTokens || 4096,
        system: system || undefined,
        messages: this.convertMessages(chatMessages),
        tools: tools.map(this.convertTool),
        temperature: options?.temperature,
      });

      const textContent = response.content.find((c) => c.type === 'text');
      const toolUseContent = response.content.filter((c) => c.type === 'tool_use');

      const toolCalls = toolUseContent.map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.input as Record<string, any>,
      }));

      return {
        content: textContent?.text || '',
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        finishReason: this.mapFinishReason(response.stop_reason),
      };
    } catch (error) {
      throw parseAPIError(this.name, error);
    }
  }

  // Provider 能力
  capabilities(): ProviderCapabilities {
    const modelConfig = MINIMAX_MODELS[this.model] || {
      maxTokens: 128000,
      supportsThinking: false,
    };

    return {
      streaming: true,
      tools: true,
      vision: false,
      maxContextTokens: modelConfig.maxTokens,
      supportedModels: Object.keys(MINIMAX_MODELS),
    };
  }

  // 私有方法

  private separateSystemMessage(messages: Message[]): {
    system: string;
    chatMessages: Message[];
  } {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');

    return {
      system: systemMessages.map((m) => m.content).join('\n\n'),
      chatMessages,
    };
  }

  private convertMessages(
    messages: Message[]
  ): Anthropic.Messages.MessageParam[] {
    const result: Anthropic.Messages.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'user') {
        result.push({
          role: 'user',
          content: typeof msg.content === 'string'
            ? msg.content
            : msg.content.map((part) => {
                if (part.type === 'text') {
                  return { type: 'text', text: part.text! };
                }
                return {
                  type: 'image',
                  source: {
                    type: 'url',
                    url: part.imageUrl!.url,
                  },
                };
              }),
        });
      } else if (msg.role === 'assistant') {
        const content: Anthropic.Messages.ContentBlockParam[] = [];

        if (typeof msg.content === 'string' && msg.content) {
          content.push({ type: 'text', text: msg.content });
        }

        if (msg.toolCalls) {
          for (const tc of msg.toolCalls) {
            content.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            });
          }
        }

        result.push({ role: 'assistant', content });
      }
    }

    return result;
  }

  private convertTool(tool: Tool): Anthropic.Messages.Tool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as Anthropic.Messages.Tool['input_schema'],
    };
  }

  private mapFinishReason(
    reason: string | null | undefined
  ): ChatResult['finishReason'] {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'tool_use':
        return 'tool_call';
      case 'max_tokens':
        return 'length';
      case 'stop_sequence':
        return 'stop';
      default:
        return 'stop';
    }
  }
}
