# 2.2 OpenAI SDK 集成

## 学习目标

实现 OpenAI API 的完整集成，包括同步和流式调用。

## 1. 安装依赖

```bash
pnpm add openai
```

**命令详解：**

| 命令部分 | 作用 | 详细解释 |
|---------|------|----------|
| `pnpm` | 包管理器 | 高效的 Node.js 包管理器 |
| `add` | 添加依赖 | 将包添加到项目的 `dependencies` 中 |
| `openai` | 包名 | OpenAI 官方维护的 Node.js SDK |

**安装后 package.json 会更新：**
```json
{
  "dependencies": {
    "openai": "^4.x.x"
  }
}
```

**openai 包提供了什么？**
- `OpenAI` 类 - 主客户端，用于创建 API 连接
- 类型定义 - 完整的 TypeScript 支持
- 错误类 - 各种错误类型便于处理
- 工具函数 - 辅助处理流式响应等

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

**代码详解：**

```typescript
import dotenv from 'dotenv';
dotenv.config();
```
- `dotenv` - 从 `.env` 文件加载环境变量到 `process.env`
- `.config()` - 读取项目根目录的 `.env` 文件
- 这样可以用 `process.env.OPENAI_API_KEY` 获取密钥

```typescript
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,  // API 密钥
  model: 'gpt-4o',                      // 模型名称
});
```
- `apiKey` - 认证身份，从环境变量读取
- `model` - 指定使用哪个模型（gpt-4o, gpt-4, gpt-3.5-turbo 等）
- `!` 非空断言表示"我确定这个值存在"

```typescript
const messages = [
  { role: 'system' as const, content: '你是一个有帮助的助手。' },
  { role: 'user' as const, content: '解释一下 TypeScript 中的泛型。' },
];
```

**消息角色详解：**

| 角色 | 作用 | 示例 |
|------|------|------|
| `system` | 设置 AI 行为/人设 | "你是一个专业的程序员" |
| `user` | 用户输入 | "帮我写一个函数" |
| `assistant` | AI 回复（用于多轮对话） | "好的，这是一个..." |

**as const 的作用：**
- 确保 TypeScript 将 `role` 推断为字面量类型 `'system'` 而不是 `string`
- 防止类型错误

```typescript
const result = await provider.chat(messages, {
  temperature: 0.7,    // 创造性程度
  maxTokens: 1000,     // 最大生成长度
});
```

**参数详解：**

| 参数 | 范围 | 作用 | 建议值 |
|------|------|------|--------|
| `temperature` | 0-1 | 控制输出随机性。0=确定性，1=最随机 | 代码: 0.2, 创意: 0.7-0.9 |
| `maxTokens` | 1-模型上限 | 限制输出长度 | 根据需求设置 |
| `topP` | 0-1 | 核采样，另一种随机性控制 | 通常和 temperature 二选一 |

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

**流式处理详解：**

```typescript
for await (const chunk of provider.stream(messages)) {
  process.stdout.write(chunk.delta);
}
```

| 代码部分 | 作用 | 详细解释 |
|---------|------|----------|
| `for await...of` | 异步迭代 | 逐个处理异步生成器产生的每个 chunk |
| `provider.stream()` | 返回 AsyncGenerator | 流式 API 返回一个异步可迭代对象 |
| `chunk.delta` | 增量文本 | 每次收到的一小段文本，不是完整响应 |
| `process.stdout.write()` | 不换行输出 | 不同于 `console.log`，不会自动添加换行符 |

**为什么使用流式输出？**
1. **用户体验**：实时看到 AI 回复，不用等待完整响应
2. **感知速度**：用户感觉响应更快
3. **节省时间**：可以在生成过程中就开始处理内容

**流式响应过程图：**
```
用户发送 → API 开始返回 → 收到 chunk1 → 显示
                              ↓
                         收到 chunk2 → 显示
                              ↓
                         收到 chunk3 → 显示
                              ↓
                           ...完成
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

**工具定义详解：**

```typescript
const tools = [
  {
    name: 'get_weather',           // 工具名称（函数名）
    description: '获取指定城市的天气',  // 工具描述（AI 根据这个决定是否调用）
    parameters: {                  // JSON Schema 格式的参数定义
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: '城市名称',  // 参数描述（AI 根据这个填充值）
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],  // 限定可选值
          description: '温度单位',
        },
      },
      required: ['city'],          // 必需参数
    },
  },
];
```

**JSON Schema 关键字段：**

| 字段 | 作用 | 示例 |
|------|------|------|
| `type` | 数据类型 | `'string'`, `'number'`, `'boolean'`, `'object'`, `'array'` |
| `properties` | 对象属性 | `{ city: {...}, unit: {...} }` |
| `required` | 必需属性列表 | `['city']` |
| `enum` | 枚举值 | `['celsius', 'fahrenheit']` |
| `description` | 描述 | 帮助 AI 理解参数含义 |

**工具调用流程：**
```
用户: "北京今天天气怎么样？"
        ↓
AI 分析: 需要调用 get_weather 工具
        ↓
AI 生成: { name: 'get_weather', arguments: { city: '北京' } }
        ↓
程序执行工具，获取结果
        ↓
将结果返回给 AI
        ↓
AI 生成最终回复
```

**result.toolCalls 结构：**
```typescript
{
  toolCalls: [
    {
      id: 'call_abc123',           // 调用 ID，用于返回结果时关联
      name: 'get_weather',         // 工具名称
      arguments: { city: '北京' }  // 解析后的参数对象
    }
  ]
}
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
