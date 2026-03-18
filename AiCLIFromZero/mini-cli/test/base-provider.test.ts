import test from 'node:test';
import assert from 'node:assert/strict';
import { BaseProvider, type ProviderConfig } from '../src/providers/base-provider.ts';
import type {
  ChatOptions,
  ChatResult,
  Message,
  ProviderCapabilities,
  StreamChunk,
  Tool,
} from '../src/types/message.ts';

class TestProvider extends BaseProvider {
  readonly name = 'test';

  async chat(_messages: Message[], _options?: ChatOptions): Promise<ChatResult> {
    return {
      content: 'ok',
      finishReason: 'stop',
    };
  }

  async *stream(
    _messages: Message[],
    _options?: ChatOptions
  ): AsyncGenerator<StreamChunk> {
    yield {
      delta: 'ok',
      done: false,
      type: 'text',
    };
    yield {
      delta: '',
      done: true,
    };
  }

  async chatWithTools(
    _messages: Message[],
    _tools: Tool[],
    _options?: ChatOptions
  ): Promise<ChatResult> {
    return {
      content: 'ok',
      finishReason: 'tool_call',
      toolCalls: [
        {
          id: 'tool-1',
          name: 'echo',
          arguments: {},
        },
      ],
    };
  }

  capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      tools: true,
      vision: false,
      maxContextTokens: 1024,
      supportedModels: ['test-model'],
    };
  }

  public assertMessages(messages: Message[]): void {
    this.validateMessages(messages);
  }
}

function createProvider(): TestProvider {
  const config: ProviderConfig = {
    apiKey: 'test-key',
    model: 'test-model',
  };

  return new TestProvider(config);
}

test('BaseProvider exposes the configured model', () => {
  const provider = createProvider();

  assert.equal(provider.model, 'test-model');
});

test('validateMessages rejects empty input', () => {
  const provider = createProvider();

  assert.throws(() => provider.assertMessages([]), /Messages cannot be empty/);
});

test('validateMessages rejects messages without content unless they are system messages', () => {
  const provider = createProvider();

  assert.throws(
    () => provider.assertMessages([{ role: 'user', content: '' }]),
    /Each message must have content/
  );

  assert.doesNotThrow(() =>
    provider.assertMessages([{ role: 'system', content: '' }])
  );
});
