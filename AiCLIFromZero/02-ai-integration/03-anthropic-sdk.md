# 2.3 Anthropic SDK 集成

## 学习目标

实现 Anthropic Claude API 的完整集成。

## 1. 安装依赖

```bash
pnpm add @anthropic-ai/sdk
```

**命令详解：**

| 命令部分 | 作用 | 详细解释 |
|---------|------|----------|
| `pnpm` | 包管理器 | 高效的 Node.js 包管理器 |
| `add` | 添加依赖 | 将包添加到 `dependencies` |
| `@anthropic-ai/sdk` | Anthropic 官方 SDK | Anthropic 官方维护的 TypeScript SDK，支持所有 Claude 模型 |

**@anthropic-ai/sdk 包提供了什么？**
- `Anthropic` 类 - 主客户端，用于创建 API 连接
- 完整的 TypeScript 类型定义
- 流式响应支持
- 工具调用（Tool Use）支持
- 多模态（Vision）支持

**OpenAI SDK vs Anthropic SDK 对比：**

| 特性 | OpenAI SDK | Anthropic SDK |
|------|-----------|---------------|
| 系统消息位置 | messages 数组中 | 单独的 `system` 参数 |
| 最大 token 参数 | `max_tokens` | `max_tokens`（必填） |
| 流式事件 | `delta.content` | `content_block_delta` |
| 工具调用 | `tool_calls` | `tool_use` content block |
| 视觉输入 | `image_url` | `image` source |

## 2. Anthropic Provider 实现

```typescript
// src/providers/anthropic.ts
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

// Anthropic 特定配置
export interface AnthropicConfig extends ProviderConfig {
  betaFeatures?: string[];
}

// Claude 模型配置
const CLAUDE_MODELS: Record<string, { maxTokens: number }> = {
  'claude-opus-4-6': { maxTokens: 200000 },
  'claude-sonnet-4-6': { maxTokens: 200000 },
  'claude-haiku-4-5-20251001': { maxTokens: 200000 },
  'claude-3-opus-20240229': { maxTokens: 200000 },
  'claude-3-sonnet-20240229': { maxTokens: 200000 },
  'claude-3-haiku-20240307': { maxTokens: 200000 },
};

export class AnthropicProvider extends BaseProvider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor(config: AnthropicConfig) {
    super(config);
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout || 120000, // Claude 可能较慢
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

  // 流式聊天
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
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield {
            delta: event.delta.text,
            done: false,
          };
        }

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
    const modelConfig = CLAUDE_MODELS[this.model] || { maxTokens: 200000 };

    return {
      streaming: true,
      tools: true,
      vision: true, // Claude 3 支持视觉
      maxContextTokens: modelConfig.maxTokens,
      supportedModels: Object.keys(CLAUDE_MODELS),
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
        const content: Anthropic.Messages.ContentBlock[] = [];

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
```

## 3. 使用示例

```typescript
// src/examples/anthropic-basic.ts
import { AnthropicProvider } from '../providers/anthropic.js';
import dotenv from 'dotenv';

dotenv.config();

const provider = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4-6',
});

async function main() {
  const messages = [
    { role: 'user' as const, content: 'Hello Claude!' },
  ];

  // 同步调用
  const result = await provider.chat(messages);
  console.log('Response:', result.content);

  // 流式调用
  console.log('\nStreaming:');
  for await (const chunk of provider.stream(messages)) {
    process.stdout.write(chunk.delta);
  }
  console.log();
}

main();
```

## 4. 注册 Provider

```typescript
// src/providers/index.ts
import { registerProvider } from './registry.js';
import { AnthropicProvider, AnthropicConfig } from './anthropic.js';

registerProvider('anthropic', (config: AnthropicConfig) => {
  return new AnthropicProvider(config);
});

export { AnthropicProvider };
```

## 练习

1. **实现 Prompt Caching**: 使用 Anthropic 的 prompt caching 功能
2. **实现多模态**: 支持图片输入
3. **实现工具结果处理**: 处理工具调用结果

## 下一步

完成本节后，继续学习 [2.4 模型配置和切换](./04-model-switching.md) →
