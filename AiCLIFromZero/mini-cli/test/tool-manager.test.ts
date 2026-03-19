import test from 'node:test';
import assert from 'node:assert/strict';
import { ToolManager } from '../src/tools/tool-manager.ts';
import { ToolExecutor } from '../src/tools/executor.ts';
import { ToolRegistry } from '../src/tools/registry.ts';
import { BaseProvider, type ProviderConfig } from '../src/providers/base-provider.ts';
import type {
  ChatOptions,
  ChatResult,
  Message,
  ProviderCapabilities,
  StreamChunk,
  Tool,
} from '../src/types/message.ts';

class StubToolProvider extends BaseProvider {
  readonly name = 'stub';
  private calls = 0;

  constructor(config: ProviderConfig) {
    super(config);
  }

  async chat(_messages: Message[], _options?: ChatOptions): Promise<ChatResult> {
    return { content: 'unused', finishReason: 'stop' };
  }

  async *stream(
    _messages: Message[],
    _options?: ChatOptions
  ): AsyncGenerator<StreamChunk> {
    yield { delta: 'unused', done: false, type: 'text' };
    yield { delta: '', done: true };
  }

  async chatWithTools(
    messages: Message[],
    _tools: Tool[],
    _options?: ChatOptions
  ): Promise<ChatResult> {
    this.calls += 1;

    if (this.calls === 1) {
      assert.equal(messages.at(-1)?.role, 'user');
      return {
        content: '',
        finishReason: 'tool_call',
        toolCalls: [
          {
            id: 'tool-1',
            name: 'echo_text',
            arguments: { text: 'hello' },
          },
        ],
      };
    }

    const toolMessage = messages.at(-1);
    assert.equal(toolMessage?.role, 'tool');
    assert.equal(toolMessage?.content, 'echo: hello');

    return {
      content: 'final answer',
      finishReason: 'stop',
    };
  }

  capabilities(): ProviderCapabilities {
    return {
      streaming: true,
      tools: true,
      vision: false,
      maxContextTokens: 1024,
      supportedModels: ['stub-model'],
    };
  }
}

test('ToolManager runs a multi-turn tool conversation', async () => {
  const registry = new ToolRegistry();
  registry.register({
    name: 'echo_text',
    description: 'Echo text back',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string' },
      },
      required: ['text'],
    },
    async execute(params) {
      return `echo: ${params.text as string}`;
    },
  });

  const executor = new ToolExecutor(registry, { timeoutMs: 500 });
  const manager = new ToolManager(registry, executor);
  const provider = new StubToolProvider({
    apiKey: 'test-key',
    model: 'stub-model',
  });

  const result = await manager.runConversation(provider, [
    { role: 'user', content: 'say hello' },
  ]);

  assert.equal(result.content, 'final answer');
  assert.deepEqual(result.toolResults, [
    {
      toolCallId: 'tool-1',
      result: 'echo: hello',
    },
  ]);
  assert.equal(result.messages.at(-1)?.role, 'assistant');
});
