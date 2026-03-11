# 第02章：AI 模型集成

> 实现多模型 Provider 模式，掌握 AI API 调用

## 学习目标

完成本章后，你将能够：

1. 设计 Provider 抽象接口
2. 集成 OpenAI API
3. 集成 Anthropic API
4. 实现模型配置和切换

## 章节内容

- [2.1 Provider 抽象设计](./01-provider-design.md)
- [2.2 OpenAI SDK 集成](./02-openai-sdk.md)
- [2.3 Anthropic SDK 集成](./03-anthropic-sdk.md)
- [2.4 模型配置和切换](./04-model-switching.md)

## 实践项目：多模型聊天客户端

```
multi-model-client/
├── src/
│   ├── index.ts              # 入口
│   ├── providers/
│   │   ├── index.ts          # Provider 接口
│   │   ├── base.ts           # 基础 Provider
│   │   ├── openai.ts         # OpenAI 实现
│   │   ├── anthropic.ts      # Anthropic 实现
│   │   └── registry.ts       # Provider 注册
│   ├── types/
│   │   └── message.ts        # 消息类型
│   └── utils/
│       └── config.ts         # 配置管理
├── package.json
└── tsconfig.json
```

## 核心架构

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          AI Provider 架构                                  │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   ┌───────────────────────────────────────────────────────────────────┐  │
│   │                      Provider Interface                           │  │
│   │  • chat(messages) → Promise<string>                               │  │
│   │  • stream(messages) → AsyncGenerator<string>                      │  │
│   │  • chatWithTools(messages, tools) → Promise<ChatResult>           │  │
│   └───────────────────────────────┬───────────────────────────────────┘  │
│                                   │                                       │
│         ┌─────────────────────────┼─────────────────────────┐            │
│         │                         │                         │            │
│         ▼                         ▼                         ▼            │
│   ┌───────────┐           ┌───────────┐           ┌───────────────┐    │
│   │  OpenAI   │           │ Anthropic │           │    Custom     │    │
│   │  Provider │           │  Provider │           │   Provider    │    │
│   └───────────┘           └───────────┘           └───────────────┘    │
│         │                         │                         │            │
│         ▼                         ▼                         ▼            │
│   ┌───────────┐           ┌───────────┐           ┌───────────────┐    │
│   │ OpenAI    │           │ Anthropic │           │   Ollama      │    │
│   │   API     │           │    API    │           │    API        │    │
│   └───────────┘           └───────────┘           └───────────────┘    │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## 快速开始

### 安装依赖

```bash
pnpm add openai @anthropic-ai/sdk
```

### 基础使用

```typescript
// src/examples/basic-chat.ts
import { OpenAIProvider } from './providers/openai.js';
import { AnthropicProvider } from './providers/anthropic.js';

// 使用 OpenAI
const openai = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4',
});

const response1 = await openai.chat([
  { role: 'user', content: 'Hello!' }
]);
console.log('OpenAI:', response1);

// 使用 Anthropic
const anthropic = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-3-sonnet-20240229',
});

const response2 = await anthropic.chat([
  { role: 'user', content: 'Hello!' }
]);
console.log('Anthropic:', response2);
```

## 核心概念

### 消息格式

```typescript
// src/types/message.ts

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
}

export interface ChatResult {
  message: Message;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

### Provider 接口

```typescript
// src/providers/index.ts
import { Message, ChatOptions, ChatResult } from '../types/message.js';

export interface AIProvider {
  readonly name: string;
  readonly model: string;

  // 同步聊天
  chat(messages: Message[], options?: ChatOptions): Promise<string>;

  // 流式聊天
  stream(
    messages: Message[],
    options?: ChatOptions
  ): AsyncGenerator<string>;

  // 带工具的聊天
  chatWithTools(
    messages: Message[],
    tools: Tool[],
    options?: ChatOptions
  ): Promise<ChatResult>;
}
```

## 学习检验

完成本章后，你应该能够：

- [ ] 理解 Provider 抽象模式的好处
- [ ] 实现 OpenAI API 调用
- [ ] 实现 Anthropic API 调用
- [ ] 实现模型动态切换

## 下一步

开始学习 [2.1 Provider 抽象设计](./01-provider-design.md) →
