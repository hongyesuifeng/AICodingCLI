# 2.2 OpenAI SDK 集成

## 学习目标

实现 OpenAI API 的完整集成，包括同步和流式调用。

## 1. 安装依赖

```bash
pnpm add openai
```

## 2. OpenAI Provider 实现

```typescript
// src/providers/openai.ts
import OpenAI from 'openai';
import { BaseProvider, ProviderConfig } from './base-provider.js';
import {
  Message,
  Tool,
  ChatOptions,
  ChatResult,
  StreamChunk,
  ProviderCapabilities,
  TokenUsage,
} from '../types/message.js';
import { parseAPIError } from '../utils/errors.js';
import { withRetry } from '../utils/retry.js';

// OpenAI 特定配置
export interface OpenAIConfig extends ProviderConfig {
  organization?: string;
}

// 模型映射
const MODEL_CONFIGS: Record<string, { maxTokens: number }> = {
  'gpt-4': { maxTokens: 8192 },
  'gpt-4-turbo': { maxTokens: 128000 },
  'gpt-4o': { maxTokens: 128000 },
  'gpt-4o-mini': { maxTokens: 128000 },
  'gpt-3.5-turbo': { maxTokens: 16384 },
  'o1': { maxTokens: 200000 },
  'o1-mini': { maxTokens: 128000 },
  'o3-mini': { maxTokens: 200000 },
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

  // 同步聊天
  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResult> {
    this.validateMessages(messages);

    try {
      return await withRetry(
        async () => {
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
            content: choice.message.content || '',
            usage: response.usage
              ? {
                  promptTokens: response.usage.prompt_tokens,
                  completionTokens: response.usage.completion_tokens,
                  totalTokens: response.usage.total_tokens,
                }
              : undefined,
            finishReason: this.mapFinishReason(choice.finish_reason),
          };
        },
        { maxRetries: 2, retryableErrors: ['RATE_LIMIT', 'SERVER_ERROR'] }
      );
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
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: this.convertMessages(messages),
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const finishReason = chunk.choices[0]?.finish_reason;

        if (delta?.content) {
          yield {
            delta: delta.content,
            done: false,
          };
        }

        if (finishReason) {
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
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: this.convertMessages(messages),
        tools: tools.map(this.convertTool),
        tool_choice: 'auto',
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
      });

      const choice = response.choices[0];
      const toolCalls = choice.message.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      }));

      return {
        content: choice.message.content || '',
        toolCalls,
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
        finishReason: this.mapFinishReason(choice.finish_reason),
      };
    } catch (error) {
      throw parseAPIError(this.name, error);
    }
  }

  // Provider 能力
  capabilities(): ProviderCapabilities {
    const modelConfig = MODEL_CONFIGS[this.model] || { maxTokens: 128000 };

    return {
      streaming: true,
      tools: true,
      vision: this.model.includes('vision') || this.model.includes('4o'),
      maxContextTokens: modelConfig.maxTokens,
      supportedModels: Object.keys(MODEL_CONFIGS),
    };
  }

  // 私有方法

  private convertMessages(messages: Message[]): OpenAI.ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      if (msg.role === 'system') {
        return { role: 'system', content: msg.content };
      }
      if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          return { role: 'user', content: msg.content };
        }
        // 多模态内容
        return {
          role: 'user',
          content: msg.content.map((part) => {
            if (part.type === 'text') {
              return { type: 'text', text: part.text };
            }
            return {
              type: 'image_url',
              image_url: { url: part.imageUrl!.url },
            };
          }),
        };
      }
      // assistant
      return { role: 'assistant', content: msg.content };
    });
  }

  private convertTool(tool: Tool): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    };
  }

  private mapFinishReason(
    reason: string | null | undefined
  ): ChatResult['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
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
```

## 3. 使用示例

### 基本聊天

```typescript
// src/examples/openai-basic.ts
import { OpenAIProvider } from '../providers/openai.js';
import dotenv from 'dotenv';

dotenv.config();

const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o',
});

async function main() {
  const messages = [
    { role: 'system' as const, content: '你是一个有帮助的助手。' },
    { role: 'user' as const, content: '解释一下 TypeScript 中的泛型。' },
  ];

  const result = await provider.chat(messages, {
    temperature: 0.7,
    maxTokens: 1000,
  });

  console.log('Response:', result.content);
  console.log('Tokens:', result.usage);
}

main();
```

### 流式输出

```typescript
// src/examples/openai-stream.ts
import { OpenAIProvider } from '../providers/openai.js';
import dotenv from 'dotenv';

dotenv.config();

const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o',
});

async function main() {
  const messages = [
    { role: 'user' as const, content: '写一首关于编程的诗。' },
  ];

  process.stdout.write('AI: ');

  for await (const chunk of provider.stream(messages)) {
    process.stdout.write(chunk.delta);
  }

  console.log(); // 换行
}

main();
```

### 工具调用

```typescript
// src/examples/openai-tools.ts
import { OpenAIProvider } from '../providers/openai.js';
import dotenv from 'dotenv';

dotenv.config();

const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o',
});

// 定义工具
const tools = [
  {
    name: 'get_weather',
    description: '获取指定城市的天气',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: '城市名称',
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: '温度单位',
        },
      },
      required: ['city'],
    },
  },
];

async function main() {
  const messages = [
    { role: 'user' as const, content: '北京今天天气怎么样？' },
  ];

  const result = await provider.chatWithTools(messages, tools);

  if (result.toolCalls && result.toolCalls.length > 0) {
    console.log('Tool calls:');
    for (const call of result.toolCalls) {
      console.log(`  ${call.name}(${JSON.stringify(call.arguments)})`);
    }
  } else {
    console.log('Response:', result.content);
  }
}

main();
```

## 4. 注册到 Provider Registry

```typescript
// src/providers/index.ts
import { registerProvider } from './registry.js';
import { OpenAIProvider, OpenAIConfig } from './openai.js';

// 注册 OpenAI
registerProvider('openai', (config: OpenAIConfig) => {
  return new OpenAIProvider(config);
});

export { OpenAIProvider };
export type { OpenAIConfig };
```

## 练习

1. **实现速率限制**: 根据响应头自动限速
2. **实现响应缓存**: 缓存相同请求的响应
3. **实现 Token 计数**: 在发送前预估 token 数量

## 下一步

完成本节后，继续学习 [2.3 Anthropic SDK 集成](./03-anthropic-sdk.md) →
