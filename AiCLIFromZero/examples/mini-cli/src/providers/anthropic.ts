/**
 * Anthropic Provider 实现
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider, Message, ChatOptions, ChatResult, StreamChunk, ProviderConfig } from './base.js';

export class AnthropicProvider extends BaseProvider {
  private client: Anthropic;

  constructor(config: ProviderConfig) {
    super(config);
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout || 120000,
    });
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResult> {
    const { system, chatMessages } = this.separateSystemMessage(messages);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options?.maxTokens || 4096,
      system: system || undefined,
      messages: chatMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      temperature: options?.temperature,
    });

    const textContent = response.content.find(c => c.type === 'text');
    return {
      content: textContent?.text || '',
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async *stream(messages: Message[], options?: ChatOptions): AsyncGenerator<StreamChunk> {
    const { system, chatMessages } = this.separateSystemMessage(messages);

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: options?.maxTokens || 4096,
      system: system || undefined,
      messages: chatMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      temperature: options?.temperature,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { delta: event.delta.text, done: false };
      }
    }

    yield { delta: '', done: true };
  }

  private separateSystemMessage(messages: Message[]): { system: string; chatMessages: Message[] } {
    const systemMessages = messages.filter(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');
    return {
      system: systemMessages.map(m => m.content).join('\n\n'),
      chatMessages,
    };
  }
}
