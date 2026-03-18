# 2.5 MiniMax SDK 集成

## 学习目标

实现 MiniMax 模型的完整集成，掌握 Anthropic 兼容 API 的使用方法，支持 thinking 模式。

## 1. MiniMax 概述

### 1.1 什么是 MiniMax？

MiniMax 是一家中国 AI 公司，提供高性能的大语言模型服务。其特点：

- **Anthropic API 兼容**：可直接使用 `@anthropic-ai/sdk` 调用
- **Thinking 模式**：支持输出推理过程（类似 Claude 的 extended thinking）
- **价格实惠**：Coding Plan 套餐适合开发者日常使用

### 1.2 API 关键信息

| 配置项 | 值 | 说明 |
|--------|-----|------|
| Base URL | `https://api.minimaxi.com/anthropic` | Anthropic 兼容端点 |
| 认证方式 | API Key | 在请求头 `x-api-key` 中传递 |
| 请求格式 | Anthropic Messages API | 与 Claude API 格式完全一致 |

### 1.3 支持的模型

| 模型 | 上下文 | Thinking | 价格（输入/输出 每百万 token） |
|------|--------|----------|-------------------------------|
| MiniMax-M2.5 | 128K | ✅ | $0.6 / $2.4 |
| MiniMax-M2.5-highspeed | 128K | ✅ | $0.2 / $0.6 |
| MiniMax-M2.1 | 128K | ✅ | $0.4 / $1.6 |
| MiniMax-M2.1-highspeed | 128K | ✅ | $0.1 / $0.4 |
| MiniMax-M2 | 32K | ❌ | $0.1 / $0.1 |

### 1.4 获取 API Key

1. 访问 [MiniMax 开放平台](https://www.minimaxi.com/)
2. 订阅 **Coding Plan** 套餐
3. 在控制台创建 API Key

## 2. 安装依赖

由于 MiniMax 提供Anthropic 兼容接口，我们可以直接复用 Anthropic SDK：

```bash
pnpm add @anthropic-ai/sdk chalk
```

**依赖说明：**

| 包名 | 用途 | 详细解释 |
|------|------|----------|
| `@anthropic-ai/sdk` | Anthropic 官方 SDK | 用于调用 Anthropic 格式的 API，MiniMax 完全兼容 |
| `chalk` | 终端着色 | 用于区分 thinking 输出和普通文本输出 |

**为什么可以用 Anthropic SDK 调用 MiniMax？**

MiniMax 实现了 Anthropic Messages API 的兼容层：
- 相同的请求格式
- 相同的响应格式
- 只需更改 `baseURL` 即可切换

```
┌─────────────────┐┌─────────────────┐
    │  Your Code     ││  Your Code     │
    └────────┬────────┘└────────┬────────┘
             │                  │
             ▼                  ▼
    ┌─────────────────┐┌─────────────────┐
    │ Anthropic SDK   ││ Anthropic SDK   │
    └────────┬────────┘└────────┬────────┘
             │                  │
    baseURL: │                  │ baseURL:
    api.anthropic.com          │ api.minimaxi.com/anthropic
             │                  │
             ▼                  ▼
    ┌─────────────────┐┌─────────────────┐
    │  Claude API     ││  MiniMax API    │
    └─────────────────┘└─────────────────┘
```

## 3. MiniMax Provider 实现

### 3.1 基础结构

```typescript
// src/providers/minimax.ts
import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider, ProviderConfig } from './base-provider.js';
import {
  Message,
  ChatOptions,
  ChatResult,
  StreamChunk,
  ProviderCapabilities,
} from '../types/message.js';

// MiniMax API 配置
const MINIMAX_BASE_URL = 'https://api.minimaxi.com/anthropic';

// MiniMax 模型配置
const MINIMAX_MODELS: Record<string, { maxTokens: number }> = {
  'MiniMax-M2.5': { maxTokens: 128000 },
  'MiniMax-M2.5-highspeed': { maxTokens: 128000 },
  'MiniMax-M2.1': { maxTokens: 128000 },
  'MiniMax-M2.1-highspeed': { maxTokens: 128000 },
  'MiniMax-M2': { maxTokens: 32000 },
};

export class MiniMaxProvider extends BaseProvider {
  readonly name = 'minimax';
  private client: Anthropic;

  constructor(config: ProviderConfig) {
    super(config);
    // 关键：设置 baseURL 为 MiniMax 端点
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: MINIMAX_BASE_URL,  // 这里是关键！
      timeout: config.timeout || 120000,
    });
  }

  // ... 其他方法
}
```

**代码详解：**

```typescript
this.client = new Anthropic({
  apiKey: config.apiKey,
  baseURL: MINIMAX_BASE_URL,  // 覆盖默认的 api.anthropic.com
});
```

- 默认情况下，`@anthropic-ai/sdk` 会连接到 `https://api.anthropic.com`
- 通过设置 `baseURL`，我们将请求发送到 MiniMax 服务器
- 这是实现 Provider 可切换的关键设计模式

### 3.2 同步聊天实现

```typescript
// src/providers/minimax.ts (续)

async chat(messages: Message[], options?: ChatOptions): Promise<ChatResult> {
  this.validateMessages(messages);

  try {
    const { system, chatMessages } = this.separateSystemMessage(messages);

    const response = await this.client.messages.create({
      model: this.model,                // 如 'MiniMax-M2.5'
      max_tokens: options?.maxTokens || 4096,
      system: system || undefined,      // 系统提示词
      messages: this.convertMessages(chatMessages),
      temperature: options?.temperature,
    });

    // 提取文本内容
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
  } catch (error) {
    throw this.handleError(error);
  }
}
```

**与 Anthropic Provider 的对比：**

| 特性 | Anthropic Provider | MiniMax Provider |
|------|-------------------|------------------|
| SDK | `@anthropic-ai/sdk` | `@anthropic-ai/sdk` |
| baseURL | 默认 | `api.minimaxi.com/anthropic` |
| 请求格式 | 相同 | 相同 |
| 响应格式 | 相同 | 相同（外加 thinking） |

### 3.3 流式聊天与 Thinking 模式

这是 MiniMax 的特色功能。在流式响应中，MiniMax 会输出两种类型的内容块：

```typescript
// src/providers/minimax.ts (续)

async *stream(
  messages: Message[],
  options?: ChatOptions
): AsyncGenerator<StreamChunk> {
  this.validateMessages(messages);

  const { system, chatMessages } = this.separateSystemMessage(messages);

  const stream = this.client.messages.stream({
    model: this.model,
    max_tokens: options?.maxTokens || 4096,
    system: system || undefined,
    messages: this.convertMessages(chatMessages),
  });

  for await (const event of stream) {
    // 处理 thinking 块 - MiniMax 特有！
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'thinking_delta'
    ) {
      yield {
        delta: (event.delta as any).thinking || '',
        done: false,
        type: 'thinking',  // 标记为思考内容
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
        type: 'text',  // 标记为普通文本
      };
    }

    // 消息结束
    if (event.type === 'message_stop') {
      yield { delta: '', done: true };
    }
  }
}
```

**流式事件类型：**

| 事件类型 | delta类型 | 说明 |
|----------|-----------|------|
| `content_block_delta` | `thinking_delta` | 模型的推理过程 |
| `content_block_delta` | `text_delta` | 最终回复文本 |
| `message_stop` | - | 消息结束 |

**StreamChunk 接口扩展：**

```typescript
// src/types/message.ts

export interface StreamChunk {
  delta: string;
  done: boolean;
  type?: 'thinking' | 'text';  // MiniMax 特有字段
}
```

## 4. CLI 中处理 Thinking 输出

### 4.1 输出格式设计

```
AI:
[思考中...]
让我想想这个问题...
首先需要分析...然后...

[回复]
这是我的最终回答。
```

- **思考过程**：用灰色显示，让用户了解 AI 的推理过程
- **最终回复**：用正常颜色显示

### 4.2 实现代码

```typescript
// src/index.ts

import chalk from 'chalk';

async function handleChat(provider: AIProvider, messages: Message[]) {
  process.stdout.write(chalk.cyan('AI: '));

  let isThinking = false;
  let fullResponse = '';

  for await (const chunk of provider.stream(messages)) {
    if (chunk.type === 'thinking') {
      // 第一次进入 thinking 模式
      if (!isThinking) {
        process.stdout.write(chalk.gray('\n[思考中...]\n'));
        isThinking = true;
      }
      // 灰色输出思考内容
      process.stdout.write(chalk.gray(chunk.delta));
    } else if (chunk.type === 'text' || !chunk.type) {
      // 从 thinking 切换到 text
      if (isThinking) {
        process.stdout.write(chalk.reset('\n[回复]\n'));
        isThinking = false;
      }
      // 正常输出文本
      process.stdout.write(chunk.delta);
    }
    fullResponse += chunk.delta;
  }
  console.log();  // 最终换行
}
```

**代码详解：**

```typescript
if (chunk.type === 'thinking') {
  if (!isThinking) {
    process.stdout.write(chalk.gray('\n[思考中...]\n'));
    isThinking = true;
  }
  process.stdout.write(chalk.gray(chunk.delta));
}
```

| 代码部分 | 作用 | 详细解释 |
|---------|------|----------|
| `isThinking` 标志 | 追踪当前状态 | 避免重复输出 `[思考中...]` 标题 |
| `chalk.gray()` | 灰色输出 | 区分思考内容和最终回复 |
| `process.stdout.write()` | 不换行输出 | 保持内容连续 |

## 5. 模型别名配置

为了方便使用，我们定义简短的模型别名：

```typescript
// src/config/models.ts

export const MODEL_ALIASES: Record<string, string> = {
  // MiniMax 别名
  'm25': 'MiniMax-M2.5',
  'm25-fast': 'MiniMax-M2.5-highspeed',
  'm21': 'MiniMax-M2.1',
  'm21-fast': 'MiniMax-M2.1-highspeed',
  'm2': 'MiniMax-M2',
  'minimax': 'MiniMax-M2.5',
};

export function resolveModel(name: string): string {
  return MODEL_ALIASES[name] || name;
}
```

**使用示例：**

```bash
# 这两个命令等价
pnpm start chat -m MiniMax-M2.5
pnpm start chat -m m25

# 这两个命令等价
pnpm start chat -m MiniMax-M2.5-highspeed
pnpm start chat -m m25-fast
```

## 6. Provider 工厂函数

```typescript
// src/index.ts

import { MiniMaxProvider } from './providers/minimax.js';
import { resolveModel, getModelCapabilities } from './config/models.js';

function createProvider(model: string, apiKey?: string): AIProvider {
  const resolvedModel = resolveModel(model);

  // 检查是否是 MiniMax 模型
  if (resolvedModel.includes('MiniMax')) {
    const key = apiKey || process.env.MINIMAX_API_KEY;

    if (!key) {
      throw new Error('请设置 MINIMAX_API_KEY 环境变量');
    }

    return new MiniMaxProvider({
      apiKey: key,
      model: resolvedModel,
    });
  }

  throw new Error(`未知模型: ${model}`);
}
```

## 7. 完整使用示例

### 7.1 设置环境变量

```bash
# 创建 .env 文件
echo "MINIMAX_API_KEY=your_api_key_here" > .env

# 或者直接导出
export MINIMAX_API_KEY=your_api_key_here
```

### 7.2 交互式聊天

```bash
# 使用默认模型
pnpm start chat

# 指定模型
pnpm start chat -m m25

# 使用高速模型
pnpm start chat -m m25-fast
```

### 7.3 单次问答

```bash
pnpm start ask "解释一下 TypeScript 中的泛型" -m m21
```

### 7.4 查看可用模型

```bash
pnpm start models
```

输出：

```
Available models:

minimax:
  MiniMax-M2.5
    Context: 128,000 tokens
    Thinking: Yes
    Price: $0.6/$2.4 per 1M tokens

Model aliases:
  m25 → MiniMax-M2.5
  m25-fast → MiniMax-M2.5-highspeed
  minimax → MiniMax-M2.5
```

## 8. 项目结构

完成本节后，项目结构如下：

```
mini-cli/
├── src/
│   ├── index.ts              # CLI 入口
│   ├── types/
│   │   └── message.ts        # 类型定义（含 StreamChunk.type）
│   ├── providers/
│   │   ├── base-provider.ts  # Provider 基类
│   │   ├── minimax.ts        # MiniMax Provider
│   │   └── index.ts          # 导出
│   ├── config/
│   │   ├── models.ts         # 模型配置和别名
│   │   └── loader.ts         # 配置加载
│   └── utils/
│       ├── errors.ts         # 错误处理
│       └── retry.ts          # 重试机制
└── package.json
```

## 9. 关键学习点总结

### 9.1 API 兼容性

MiniMax 展示了如何通过兼容现有 API 格式来降低接入成本：

```
只需更改 baseURL → 即可切换 Provider
```

### 9.2 Thinking 模式

MiniMax 的 thinking 模式展示了 AI 推理过程的可视化：

```typescript
// 流式响应中区分两种内容
if (event.delta.type === 'thinking_delta') {
  // 推理过程
}
if (event.delta.type === 'text_delta') {
  // 最终回复
}
```

### 9.3 模型别名

通过别名系统提供更好的用户体验：

```typescript
'm25' → 'MiniMax-M2.5'
'm25-fast' → 'MiniMax-M2.5-highspeed'
```

## 练习

1. **实现成本统计**：追踪每次 API 调用的 token 使用和费用
2. **实现模型对比**：同时调用多个 MiniMax 模型，比较响应质量
3. **实现上下文压缩**：当对话历史过长时，自动压缩旧消息

## 下一步

完成第02章后，继续学习 [第03章：流式输出处理](../03-streaming/README.md) →
