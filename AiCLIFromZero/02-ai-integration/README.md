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

**命令详解：**

| 命令部分 | 作用 | 详细解释 |
|---------|------|----------|
| `pnpm add` | 添加依赖 | 将包添加到 `dependencies`（生产依赖） |
| `openai` | OpenAI 官方 SDK | OpenAI 提供的 Node.js 客户端库，封装了所有 API 调用 |
| `@anthropic-ai/sdk` | Anthropic 官方 SDK | Anthropic 提供的 TypeScript SDK，支持所有 Claude 模型 API |

**为什么使用官方 SDK？**
1. **类型安全**：自带 TypeScript 类型定义，开发体验好
2. **自动处理**：请求签名、重试、错误处理等底层细节
3. **及时更新**：新功能第一时间支持
4. **社区支持**：问题可以找到解决方案

**这些 SDK 会被添加到 package.json 的 dependencies 中：**
```json
{
  "dependencies": {
    "openai": "^4.x.x",
    "@anthropic-ai/sdk": "^0.x.x"
  }
}
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

**代码详解：**

```typescript
import { OpenAIProvider } from './providers/openai.js';
```
- 导入我们自己实现的 Provider 类（后续章节会实现）
- `.js` 后缀是 ES Module 要求的，即使源文件是 `.ts`

```typescript
const openai = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,  // 从环境变量读取
  model: 'gpt-4',                        // 指定使用的模型
});
```
- `process.env.OPENAI_API_KEY` - 从环境变量获取 API 密钥
- `!` - TypeScript 非空断言，表示"我确定这个值不是 undefined"
- 为什么用环境变量？敏感信息不应该硬编码在代码中

```typescript
const response1 = await openai.chat([
  { role: 'user', content: 'Hello!' }
]);
```
- `await` - 等待异步操作完成（API 调用是异步的）
- `messages` 数组 - 对话上下文，每条消息有 `role` 和 `content`
- `role` 类型：`'system'`（系统指令）、`'user'`（用户）、`'assistant'`（AI）

**环境变量配置：**

创建 `.env` 文件：
```
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
```

**为什么使用 .env 文件？**
1. **安全性**：敏感信息不提交到 Git（`.env` 在 `.gitignore` 中）
2. **灵活性**：不同环境（开发/测试/生产）使用不同的密钥
3. **便捷性**：无需在代码中硬编码，修改配置无需改代码

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
