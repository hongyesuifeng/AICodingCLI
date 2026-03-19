// src/providers/openai.ts
import OpenAI from 'openai';
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
import { withRetry } from '../utils/retry.js';

export interface OpenAIConfig extends ProviderConfig {
  organization?: string;
}

const OPENAI_MODELS: Record<string, { maxTokens: number; vision: boolean }> = {
  'gpt-4o': { maxTokens: 128000, vision: true },
  'gpt-4o-mini': { maxTokens: 128000, vision: true },
  'gpt-4.1': { maxTokens: 1047576, vision: true },
  'gpt-4.1-mini': { maxTokens: 1047576, vision: true },
};

export class OpenAIProvider extends BaseProvider {
  readonly name = 'openai';
  private client: OpenAI;

  constructor(config: OpenAIConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      organization: config.organization,
      timeout: config.timeout || 60000,
    });
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResult> {
    this.validateMessages(messages);

    try {
      return await withRetry(async () => {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: this.convertMessages(messages),
          temperature: options?.temperature,
          max_tokens: options?.maxTokens,
          top_p: options?.topP,
          stop: options?.stopSequences,
        });

        const choice = response.choices[0];

        return {
          content: choice?.message?.content || '',
          usage: response.usage ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          } : undefined,
          finishReason: this.mapFinishReason(choice?.finish_reason),
        };
      }, { maxRetries: 2 });
    } catch (error) {
      throw parseAPIError(this.name, error);
    }
  }

  async *stream(
    messages: Message[],
    options?: ChatOptions
  ): AsyncGenerator<StreamChunk> {
    this.validateMessages(messages);

    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: this.convertMessages(messages),
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        stop: options?.stopSequences,
        stream: true,
      });

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        const delta = choice?.delta?.content;

        if (delta) {
          yield {
            delta,
            done: false,
            type: 'text',
          };
        }

        if (choice?.finish_reason) {
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

  async chatWithTools(
    messages: Message[],
    tools: Tool[],
    options?: ChatOptions
  ): Promise<ChatResult> {
    this.validateMessages(messages);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: this.convertMessages(messages),
        tools: tools.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters as unknown as Record<string, unknown>,
          },
        })),
        tool_choice: 'auto',
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        stop: options?.stopSequences,
      });

      const choice = response.choices[0];
      const toolCalls = choice?.message?.tool_calls
        ?.filter((toolCall: { type: string }) => toolCall.type === 'function')
        .map((toolCall: {
          id: string;
          function: { name: string; arguments: string };
        }) => ({
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments),
        }));

      return {
        content: choice?.message?.content || '',
        toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
        finishReason: this.mapFinishReason(choice?.finish_reason),
      };
    } catch (error) {
      throw parseAPIError(this.name, error);
    }
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

  private convertMessages(
    messages: Message[]
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages.map((message) => {
      if (message.role === 'system') {
        return {
          role: 'system',
          content: message.content,
        };
      }

      if (message.role === 'assistant') {
        const content = typeof message.content === 'string' ? message.content : '';

        return {
          role: 'assistant',
          content,
          tool_calls: message.toolCalls?.map((toolCall) => ({
            id: toolCall.id,
            type: 'function',
            function: {
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.arguments),
            },
          })),
        };
      }

      if (message.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: message.toolCallId,
          content: message.content,
        };
      }

      if (typeof message.content === 'string') {
        return {
          role: 'user',
          content: message.content,
        };
      }

      return {
        role: 'user',
        content: message.content.map((part) => {
          if (part.type === 'text') {
            return {
              type: 'text',
              text: part.text || '',
            };
          }

          return {
            type: 'image_url',
            image_url: {
              url: part.imageUrl?.url || '',
            },
          };
        }),
      };
    });
  }

  private mapFinishReason(
    reason: string | null | undefined
  ): ChatResult['finishReason'] {
    switch (reason) {
      case 'tool_calls':
        return 'tool_call';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'stop';
    }
  }
}
