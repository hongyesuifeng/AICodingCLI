import test from 'node:test';
import assert from 'node:assert/strict';
import { BaseProvider, type ProviderConfig } from '../src/providers/base-provider.ts';
import { ProviderRegistry } from '../src/providers/registry.ts';
import type {
  ChatOptions,
  ChatResult,
  Message,
  ProviderCapabilities,
  StreamChunk,
  Tool,
} from '../src/types/message.ts';

class StubProvider extends BaseProvider {
  readonly name: string;

  constructor(name: string, config: ProviderConfig) {
    super(config);
    this.name = name;
  }

  async chat(_messages: Message[], _options?: ChatOptions): Promise<ChatResult> {
    return { content: `${this.name}:${this.model}`, finishReason: 'stop' };
  }

  async *stream(
    _messages: Message[],
    _options?: ChatOptions
  ): AsyncGenerator<StreamChunk> {
    yield { delta: `${this.name}:${this.model}`, done: false, type: 'text' };
    yield { delta: '', done: true };
  }

  async chatWithTools(
    _messages: Message[],
    _tools: Tool[],
    _options?: ChatOptions
  ): Promise<ChatResult> {
    return { content: `${this.name}:${this.model}`, finishReason: 'stop' };
  }

  capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      tools: true,
      vision: false,
      maxContextTokens: 1024,
      supportedModels: [this.model],
    };
  }
}

test('ProviderRegistry creates providers from registered factories', () => {
  const registry = new ProviderRegistry();

  registry.register('stub', (config) => new StubProvider('stub', config));

  const provider = registry.create('stub', {
    apiKey: 'test-key',
    model: 'stub-model',
  });

  assert.equal(provider.name, 'stub');
  assert.equal(provider.model, 'stub-model');
});

test('ProviderRegistry lists registered providers in stable order', () => {
  const registry = new ProviderRegistry();

  registry.register('minimax', (config) => new StubProvider('minimax', config));
  registry.register('openai', (config) => new StubProvider('openai', config));

  assert.deepEqual(registry.list(), ['minimax', 'openai']);
});

test('ProviderRegistry throws for unknown providers', () => {
  const registry = new ProviderRegistry();

  assert.throws(
    () => registry.create('missing', { apiKey: 'test-key', model: 'test-model' }),
    /Provider not registered: missing/
  );
});
