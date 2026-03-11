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
