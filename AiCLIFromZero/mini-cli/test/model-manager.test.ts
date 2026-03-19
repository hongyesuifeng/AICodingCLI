import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelManager } from '../src/managers/model-manager.ts';
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
    return { content: this.model, finishReason: 'stop' };
  }

  async *stream(
    _messages: Message[],
    _options?: ChatOptions
  ): AsyncGenerator<StreamChunk> {
    yield { delta: this.model, done: false, type: 'text' };
    yield { delta: '', done: true };
  }

  async chatWithTools(
    _messages: Message[],
    _tools: Tool[],
    _options?: ChatOptions
  ): Promise<ChatResult> {
    return { content: this.model, finishReason: 'stop' };
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

function createManager(): ModelManager {
  const registry = new ProviderRegistry();

  registry.register('minimax', (config) => new StubProvider('minimax', config));
  registry.register('openai', (config) => new StubProvider('openai', config));

  return new ModelManager('m25', {
    registry,
    getApiKey: (provider) => `${provider}-key`,
  });
}

test('ModelManager resolves aliases for the default model', () => {
  const manager = createManager();

  assert.equal(manager.getCurrentModel(), 'MiniMax-M2.5');
});

test('ModelManager caches providers per resolved model', () => {
  const manager = createManager();

  const providerA = manager.getProvider('m25');
  const providerB = manager.getProvider('MiniMax-M2.5');

  assert.equal(providerA, providerB);
});

test('ModelManager switches models and returns the matching provider', () => {
  const manager = createManager();

  assert.equal(manager.switchModel('4o'), 'gpt-4o');

  const provider = manager.getCurrentProvider();
  assert.equal(provider.name, 'openai');
  assert.equal(provider.model, 'gpt-4o');
});

test('ModelManager throws when switching to an unknown model', () => {
  const manager = createManager();

  assert.throws(
    () => manager.switchModel('does-not-exist'),
    /Unknown model: does-not-exist/
  );
});
