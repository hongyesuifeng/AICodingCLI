# 第03章：流式输出处理

> 实现实时流式响应和进度显示

## 学习目标

完成本章后，你将能够：

1. 理解 SSE (Server-Sent Events) 原理
2. 实现流式 API 调用
3. 解析和处理流式响应
4. 实现终端实时渲染

## 章节内容

- [3.1 SSE 原理](./01-sse-basics.md)
- [3.2 流式 API 调用](./02-stream-api.md)
- [3.3 流式响应解析](./03-stream-parsing.md)
- [3.4 终端实时渲染](./04-terminal-render.md)

## 核心架构

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          流式输出处理流程                                   │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐   │
│   │   AI API    │────▶│  SSE Stream │────▶│    Stream Parser        │   │
│   │             │     │             │     │                         │   │
│   └─────────────┘     └─────────────┘     │  • 解析数据块           │   │
│                                           │  • 处理边界             │   │
│                                           │  • 检测完成             │   │
│                                           └───────────┬─────────────┘   │
│                                                       │                   │
│                                           ┌───────────▼─────────────┐   │
│                                           │    Buffer Manager       │   │
│                                           │                         │   │
│                                           │  • 累积文本             │   │
│                                           │  • 检测完整块           │   │
│                                           │  • 处理不完整块         │   │
│                                           └───────────┬─────────────┘   │
│                                                       │                   │
│                                           ┌───────────▼─────────────┐   │
│                                           │   Terminal Renderer     │   │
│                                           │                         │   │
│                                           │  • 实时显示             │   │
│                                           │  • 格式化输出           │   │
│                                           │  • 进度指示             │   │
│                                           └─────────────────────────┘   │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## 快速示例

```typescript
// src/examples/stream-basic.ts
import { OpenAIProvider } from '../providers/openai.js';

const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o',
});

async function streamChat() {
  const messages = [
    { role: 'user' as const, content: '讲一个短故事' }
  ];

  process.stdout.write('AI: ');

  for await (const chunk of provider.stream(messages)) {
    process.stdout.write(chunk.delta);
  }

  console.log(); // 换行
}

streamChat();
```

**代码详解：**

```typescript
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,  // API 密钥
  model: 'gpt-4o',                      // 使用的模型
});
```
- 配置 Provider 实例，API Key 从环境变量读取
- `!` 是 TypeScript 非空断言

```typescript
const messages = [
  { role: 'user' as const, content: '讲一个短故事' }
];
```
- `as const` 确保 role 是字面量类型 `'user'` 而非 `string`

```typescript
process.stdout.write('AI: ');
```
- `process.stdout.write()` 直接向标准输出写入，**不自动换行**
- 与 `console.log()` 的区别：`console.log` 会在末尾加 `\n`

```typescript
for await (const chunk of provider.stream(messages)) {
  process.stdout.write(chunk.delta);
}
```

**for await...of 详解：**

| 部分 | 作用 | 详细解释 |
|------|------|----------|
| `for await` | 异步迭代关键字 | 用于遍历异步可迭代对象（AsyncIterable） |
| `const chunk` | 当前迭代值 | 每次循环接收一个流式数据块 |
| `of provider.stream()` | 异步迭代源 | `stream()` 方法返回一个 AsyncGenerator |

**为什么用 `process.stdout.write` 而不是 `console.log`？**
- `console.log()` 会自动添加换行符
- 流式输出需要文本连续显示，不能每次都换行
- `process.stdout.write()` 精确控制输出内容

**流式输出效果：**
```
AI: 从 前 有 一 个 小 村 庄 ...
    ↑ 文本逐字/逐词出现，而不是等全部生成完才显示
```

## 核心类型

```typescript
// src/types/stream.ts

// 流式响应块
export interface StreamChunk {
  delta: string;        // 增量文本
  done: boolean;        // 是否完成
  toolCall?: {          // 工具调用（可选）
    id: string;
    name: string;
    arguments: string;
  };
}

// 流式处理器配置
export interface StreamHandlerConfig {
  onChunk?: (chunk: StreamChunk) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

// 流式事件
export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; toolCall: ToolCallDelta }
  | { type: 'done'; fullText: string }
  | { type: 'error'; error: Error };

interface ToolCallDelta {
  id: string;
  name?: string;
  arguments?: string;
}
```

## 学习检验

完成本章后，你应该能够：

- [ ] 理解流式传输的工作原理
- [ ] 实现 SSE 数据解析
- [ ] 处理不完整的数据块
- [ ] 实现平滑的终端输出

## 下一步

开始学习 [3.1 SSE 原理](./01-sse-basics.md) →
