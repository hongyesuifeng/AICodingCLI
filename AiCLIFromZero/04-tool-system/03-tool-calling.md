# 4.3 Tool Calling 协议

## 学习目标

理解 Tool Calling 协议的工作原理，掌握 OpenAI 和 Anthropic 的格式差异，实现多轮工具调用。

## 1. Tool Calling 协议概述

### 1.1 什么是 Tool Calling？

Tool Calling（函数调用）是 LLM 的一种能力，允许模型：
1. **识别** 何时需要调用工具
2. **生成** 工具调用请求（工具名 + 参数）
3. **理解** 工具返回的结果

### 1.2 工作流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Tool Calling 工作流程                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. 用户请求                                                                 │
│     ┌─────────────┐                                                        │
│     │ "读取       │                                                        │
│     │  package.json"│                                                       │
│     └──────┬──────┘                                                        │
│            │                                                                │
│            ▼                                                                │
│  2. 发送给 AI（带工具定义）                                                   │
│     ┌─────────────────────────────────────────────────────┐                │
│     │ Messages: [                                         │                │
│     │   { role: "user", content: "读取 package.json" }    │                │
│     │ ]                                                   │                │
│     │ Tools: [                                            │                │
│     │   { name: "read_file", parameters: {...} }          │                │
│     │ ]                                                   │                │
│     └──────────────────────┬──────────────────────────────┘                │
│                              │                                              │
│                              ▼                                              │
│  3. AI 返回工具调用请求                                                       │
│     ┌─────────────────────────────────────────────────────┐                │
│     │ {                                                   │                │
│     │   role: "assistant",                                │                │
│     │   tool_calls: [{                                    │                │
│     │     id: "call_123",                                 │                │
│     │     name: "read_file",                              │                │
│     │     arguments: { path: "package.json" }             │                │
│     │   }]                                                │                │
│     │ }                                                   │                │
│     └──────────────────────┬──────────────────────────────┘                │
│                              │                                              │
│                              ▼                                              │
│  4. 执行工具，返回结果                                                        │
│     ┌─────────────────────────────────────────────────────┐                │
│     │ {                                                   │                │
│     │   role: "tool",                                     │                │
│     │   tool_call_id: "call_123",                         │                │
│     │   content: '{"name": "my-app", ...}'                │                │
│     │ }                                                   │                │
│     └──────────────────────┬──────────────────────────────┘                │
│                              │                                              │
│                              ▼                                              │
│  5. AI 基于结果生成最终回复                                                    │
│     ┌─────────────────────────────────────────────────────┐                │
│     │ "项目的名称是 my-app，版本是 1.0.0..."                │                │
│     └─────────────────────────────────────────────────────┘                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. 格式差异对比

### 2.1 工具定义格式

```typescript
// src/providers/formats.ts

// ============ OpenAI 格式 ============
interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

// OpenAI 工具定义示例
const openaiTool: OpenAITool = {
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Read the contents of a file',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The file path',
        },
      },
      required: ['path'],
    },
  },
};

// ============ Anthropic 格式 ============
interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// Anthropic 工具定义示例
const anthropicTool: AnthropicTool = {
  name: 'read_file',
  description: 'Read the contents of a file',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The file path',
      },
    },
    required: ['path'],
  },
};
```

**格式对比：**

| 项目 | OpenAI | Anthropic |
|------|--------|-----------|
| 包装 | `{ type: 'function', function: {...} }` | 直接定义 |
| 参数字段 | `parameters` | `input_schema` |
| 结构层级 | 两层（function 嵌套） | 一层 |

### 2.2 工具调用请求格式

```typescript
// ============ OpenAI 格式 ============
interface OpenAIToolCall {
  id: string;              // 调用 ID
  type: 'function';
  function: {
    name: string;          // 工具名称
    arguments: string;     // JSON 字符串！
  };
}

// OpenAI 响应示例
const openaiResponse = {
  role: 'assistant',
  content: null,
  tool_calls: [
    {
      id: 'call_abc123',
      type: 'function',
      function: {
        name: 'read_file',
        arguments: '{"path": "package.json"}',  // 注意：是字符串！
      },
    },
  ],
};

// ============ Anthropic 格式 ============
interface AnthropicToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;  // 已经是对象！
}

// Anthropic 响应示例
const anthropicResponse = {
  role: 'assistant',
  content: [
    {
      type: 'tool_use',
      id: 'toolu_abc123',
      name: 'read_file',
      input: { path: 'package.json' },  // 已经是对象
    },
  ],
};
```

**调用格式对比：**

| 项目 | OpenAI | Anthropic |
|------|--------|-----------|
| 字段名 | `tool_calls` | `content` 数组中的 `tool_use` |
| 参数格式 | JSON 字符串 | 对象 |
| ID 前缀 | `call_` | `toolu_` |
| 并行调用 | 原生支持 | 原生支持 |

### 2.3 工具结果格式

```typescript
// ============ OpenAI 格式 ============
interface OpenAIToolMessage {
  role: 'tool';
  tool_call_id: string;  // 对应调用的 ID
  content: string;       // 结果内容
}

// OpenAI 工具结果示例
const openaiToolResult: OpenAIToolMessage = {
  role: 'tool',
  tool_call_id: 'call_abc123',
  content: '{"name": "my-app", "version": "1.0.0"}',
};

// ============ Anthropic 格式 ============
interface AnthropicToolResult {
  type: 'tool_result';
  tool_use_id: string;   // 对应调用的 ID
  content: string;       // 结果内容
  is_error?: boolean;    // 是否错误
}

// Anthropic 工具结果消息
const anthropicToolResultMessage = {
  role: 'user',  // 注意：是 user 角色！
  content: [
    {
      type: 'tool_result',
      tool_use_id: 'toolu_abc123',
      content: '{"name": "my-app", "version": "1.0.0"}',
    },
  ],
};
```

**结果格式对比：**

| 项目 | OpenAI | Anthropic |
|------|--------|-----------|
| 角色 | `tool` | `user` |
| ID 字段 | `tool_call_id` | `tool_use_id` |
| 错误标记 | 无内置 | `is_error` 字段 |

## 3. 格式转换器

### 3.1 统一的工具格式

```typescript
// src/types/tool-calling.ts

// 统一的工具调用请求
export interface UnifiedToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

// 统一的工具结果
export interface UnifiedToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

// 统一的消息格式
export type UnifiedMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: UnifiedToolCall[] }
  | { role: 'tool'; results: UnifiedToolResult[] };
```

### 3.2 OpenAI 格式转换

```typescript
// src/providers/openai-converter.ts
import { Tool, UnifiedToolCall, UnifiedToolResult, UnifiedMessage } from '../types/tool-calling.js';

export class OpenAIConverter {
  /**
   * 将统一工具定义转换为 OpenAI 格式
   */
  static toOpenAITools(tools: Tool[]): any[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * 将统一消息转换为 OpenAI 格式
   */
  static toOpenAIMessages(messages: UnifiedMessage[]): any[] {
    return messages.map(msg => {
      switch (msg.role) {
        case 'system':
          return { role: 'system', content: msg.content };

        case 'user':
          return { role: 'user', content: msg.content };

        case 'assistant':
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            return {
              role: 'assistant',
              content: null,
              tool_calls: msg.toolCalls.map(tc => ({
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.arguments),
                },
              })),
            };
          }
          return { role: 'assistant', content: msg.content };

        case 'tool':
          return msg.results.map(result => ({
            role: 'tool',
            tool_call_id: result.toolCallId,
            content: result.content,
          }));
      }
    }).flat();
  }

  /**
   * 从 OpenAI 响应解析工具调用
   */
  static parseToolCalls(response: any): UnifiedToolCall[] {
    if (!response.tool_calls) return [];

    return response.tool_calls.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));
  }
}
```

### 3.3 Anthropic 格式转换

```typescript
// src/providers/anthropic-converter.ts
import { Tool, UnifiedToolCall, UnifiedToolResult, UnifiedMessage } from '../types/tool-calling.js';

export class AnthropicConverter {
  /**
   * 将统一工具定义转换为 Anthropic 格式
   */
  static toAnthropicTools(tools: Tool[]): any[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  /**
   * 将统一消息转换为 Anthropic 格式
   */
  static toAnthropicMessages(messages: UnifiedMessage[]): any[] {
    const result: any[] = [];
    let systemPrompt: string | undefined;

    for (const msg of messages) {
      switch (msg.role) {
        case 'system':
          // Anthropic 使用单独的 system 参数
          systemPrompt = msg.content;
          break;

        case 'user':
          result.push({ role: 'user', content: msg.content });
          break;

        case 'assistant':
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            result.push({
              role: 'assistant',
              content: [
                { type: 'text', text: msg.content || '' },
                ...msg.toolCalls.map(tc => ({
                  type: 'tool_use',
                  id: tc.id,
                  name: tc.name,
                  input: tc.arguments,
                })),
              ],
            });
          } else {
            result.push({ role: 'assistant', content: msg.content });
          }
          break;

        case 'tool':
          // Anthropic 的工具结果是 user 消息
          result.push({
            role: 'user',
            content: msg.results.map(r => ({
              type: 'tool_result',
              tool_use_id: r.toolCallId,
              content: r.content,
              is_error: r.isError,
            })),
          });
          break;
      }
    }

    return { messages: result, system: systemPrompt };
  }

  /**
   * 从 Anthropic 响应解析工具调用
   */
  static parseToolCalls(response: any): UnifiedToolCall[] {
    if (!response.content) return [];

    return response.content
      .filter((block: any) => block.type === 'tool_use')
      .map((block: any) => ({
        id: block.id,
        name: block.name,
        arguments: block.input,
      }));
  }
}
```

## 4. 消息流转

### 4.1 消息构建器

```typescript
// src/utils/message-builder.ts
import { UnifiedMessage, UnifiedToolCall, UnifiedToolResult } from '../types/tool-calling.js';

export class MessageBuilder {
  private messages: UnifiedMessage[] = [];

  /**
   * 添加系统消息
   */
  system(content: string): this {
    this.messages.push({ role: 'system', content });
    return this;
  }

  /**
   * 添加用户消息
   */
  user(content: string): this {
    this.messages.push({ role: 'user', content });
    return this;
  }

  /**
   * 添加助手消息（可能包含工具调用）
   */
  assistant(content: string, toolCalls?: UnifiedToolCall[]): this {
    this.messages.push({ role: 'assistant', content, toolCalls });
    return this;
  }

  /**
   * 添加工具结果
   */
  toolResult(results: UnifiedToolResult[]): this {
    this.messages.push({ role: 'tool', results });
    return this;
  }

  /**
   * 获取所有消息
   */
  build(): UnifiedMessage[] {
    return [...this.messages];
  }

  /**
   * 清空消息
   */
  clear(): this {
    this.messages = [];
    return this;
  }

  /**
   * 获取最后一条消息
   */
  last(): UnifiedMessage | undefined {
    return this.messages[this.messages.length - 1];
  }
}
```

### 4.2 工具调用处理器

```typescript
// src/agents/tool-call-handler.ts
import { Tool, UnifiedToolCall, UnifiedToolResult } from '../types/tool-calling.js';
import { ToolRegistry } from '../tools/registry.js';
import { validateToolCall } from '../utils/validate-tool-call.js';

export class ToolCallHandler {
  constructor(private registry: ToolRegistry) {}

  /**
   * 处理工具调用
   */
  async handle(toolCalls: UnifiedToolCall[]): Promise<UnifiedToolResult[]> {
    const results: UnifiedToolResult[] = [];

    // 并行处理所有工具调用
    const promises = toolCalls.map(async call => {
      return this.executeCall(call);
    });

    const settled = await Promise.allSettled(promises);

    for (let i = 0; i < settled.length; i++) {
      const result = settled[i];
      const call = toolCalls[i];

      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          toolCallId: call.id,
          content: `Error: ${result.reason?.message || 'Unknown error'}`,
          isError: true,
        });
      }
    }

    return results;
  }

  /**
   * 执行单个工具调用
   */
  private async executeCall(call: UnifiedToolCall): Promise<UnifiedToolResult> {
    // 获取工具
    const tool = this.registry.get(call.name);
    if (!tool) {
      return {
        toolCallId: call.id,
        content: `Error: Unknown tool '${call.name}'`,
        isError: true,
      };
    }

    // 验证参数
    const validation = validateToolCall(tool, {
      id: call.id,
      name: call.name,
      arguments: call.arguments,
    });

    if (!validation.valid) {
      return {
        toolCallId: call.id,
        content: `Error: Invalid arguments - ${validation.errors.join(', ')}`,
        isError: true,
      };
    }

    // 执行工具
    try {
      const result = await tool.execute(call.arguments);
      return {
        toolCallId: call.id,
        content: result,
        isError: false,
      };
    } catch (error: any) {
      return {
        toolCallId: call.id,
        content: `Error: ${error.message}`,
        isError: true,
      };
    }
  }
}
```

## 5. 多轮调用

### 5.1 Agent 循环

```typescript
// src/agents/agent-loop.ts
import { AIProvider } from '../providers/base.js';
import { Tool } from '../types/tool.js';
import { UnifiedMessage, UnifiedToolCall, UnifiedToolResult } from '../types/tool-calling.js';
import { MessageBuilder } from '../utils/message-builder.js';
import { ToolCallHandler } from './tool-call-handler.js';

// Agent 配置
export interface AgentConfig {
  maxIterations: number;     // 最大迭代次数
  onToolCall?: (call: UnifiedToolCall) => void;
  onToolResult?: (result: UnifiedToolResult) => void;
  onResponse?: (content: string) => void;
}

const DEFAULT_CONFIG: AgentConfig = {
  maxIterations: 10,
};

// Agent 循环
export class AgentLoop {
  private messages = new MessageBuilder();
  private handler: ToolCallHandler;

  constructor(
    private provider: AIProvider,
    private tools: Tool[],
    private config: AgentConfig = DEFAULT_CONFIG
  ) {
    // 创建临时注册表
    const registry = new ToolRegistry();
    registry.registerAll(tools);
    this.handler = new ToolCallHandler(registry);
  }

  /**
   * 运行 Agent
   */
  async run(userMessage: string, systemPrompt?: string): Promise<string> {
    // 构建初始消息
    if (systemPrompt) {
      this.messages.system(systemPrompt);
    }
    this.messages.user(userMessage);

    // 迭代循环
    for (let i = 0; i < this.config.maxIterations; i++) {
      // 调用 AI
      const response = await this.provider.chatWithTools(
        this.messages.build(),
        this.tools
      );

      // 检查是否有工具调用
      if (response.toolCalls && response.toolCalls.length > 0) {
        // 添加助手消息
        this.messages.assistant(response.content, response.toolCalls);

        // 通知工具调用
        response.toolCalls.forEach(call => {
          this.config.onToolCall?.(call);
        });

        // 执行工具
        const results = await this.handler.handle(response.toolCalls);

        // 通知工具结果
        results.forEach(result => {
          this.config.onToolResult?.(result);
        });

        // 添加工具结果
        this.messages.toolResult(results);

        // 继续循环
        continue;
      }

      // 没有工具调用，返回最终响应
      this.config.onResponse?.(response.content);
      return response.content;
    }

    // 达到最大迭代次数
    throw new Error('Max iterations reached');
  }

  /**
   * 流式运行
   */
  async *runStream(userMessage: string, systemPrompt?: string): AsyncGenerator<string> {
    if (systemPrompt) {
      this.messages.system(systemPrompt);
    }
    this.messages.user(userMessage);

    for (let i = 0; i < this.config.maxIterations; i++) {
      // 流式调用 AI
      let content = '';
      let toolCalls: UnifiedToolCall[] = [];

      for await (const chunk of this.provider.stream(this.messages.build())) {
        if (chunk.delta) {
          content += chunk.delta;
          yield chunk.delta;
        }

        if (chunk.toolCall) {
          // 收集工具调用
          toolCalls = this.mergeToolCalls(toolCalls, chunk.toolCall);
        }
      }

      if (toolCalls.length > 0) {
        this.messages.assistant(content, toolCalls);

        // 执行工具并 yield 结果
        const results = await this.handler.handle(toolCalls);
        this.messages.toolResult(results);

        // Yield 工具执行信息
        for (const result of results) {
          yield `\n[Tool: ${toolCalls.find(t => t.id === result.toolCallId)?.name}]\n`;
          yield result.content.slice(0, 200) + (result.content.length > 200 ? '...' : '');
          yield '\n';
        }

        continue;
      }

      return;
    }

    throw new Error('Max iterations reached');
  }

  /**
   * 合并流式工具调用
   */
  private mergeToolCalls(
    existing: UnifiedToolCall[],
    partial: Partial<UnifiedToolCall>
  ): UnifiedToolCall[] {
    // 简化实现：假设每个工具调用只出现一次
    if (partial.id && partial.name && partial.arguments) {
      return [...existing, partial as UnifiedToolCall];
    }
    return existing;
  }
}
```

### 5.2 使用示例

```typescript
// src/examples/agent-example.ts
import { AgentLoop } from '../agents/agent-loop.js';
import { OpenAIProvider } from '../providers/openai.js';
import { readFileTool, writeFileTool } from '../tools/file-tools.js';

async function main() {
  const provider = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4-turbo',
  });

  const tools = [readFileTool, writeFileTool];

  const agent = new AgentLoop(provider, tools, {
    maxIterations: 5,

    onToolCall: call => {
      console.log(`[Tool Call] ${call.name}(${JSON.stringify(call.arguments)})`);
    },

    onToolResult: result => {
      console.log(`[Tool Result] ${result.isError ? 'Error' : 'Success'}`);
    },

    onResponse: content => {
      console.log(`[Response] ${content.slice(0, 100)}...`);
    },
  });

  // 运行 Agent
  const result = await agent.run(
    '读取 package.json 文件，告诉我项目名称和版本',
    '你是一个有帮助的助手，可以使用工具来完成任务。'
  );

  console.log('\n最终结果:', result);
}

main().catch(console.error);
```

### 5.3 多轮对话示例

```typescript
// src/examples/multi-turn.ts
import { AgentLoop } from '../agents/agent-loop.js';
import { MessageBuilder } from '../utils/message-builder.js';

async function multiTurnExample() {
  const agent = new AgentLoop(provider, tools);

  // 第一轮
  const result1 = await agent.run('读取 package.json');
  console.log('第一轮:', result1);

  // 第二轮（保留上下文）
  const result2 = await agent.run('现在读取 tsconfig.json');
  console.log('第二轮:', result2);

  // 第三轮
  const result3 = await agent.run('比较这两个文件的依赖项');
  console.log('第三轮:', result3);
}
```

## 参数说明

### UnifiedToolCall 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 调用唯一标识 |
| `name` | string | 工具名称 |
| `arguments` | object | 调用参数 |

### UnifiedToolResult 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `toolCallId` | string | 对应的调用 ID |
| `content` | string | 执行结果 |
| `isError` | boolean | 是否错误 |

### AgentConfig 字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxIterations` | number | 10 | 最大迭代次数 |
| `onToolCall` | function | - | 工具调用回调 |
| `onToolResult` | function | - | 工具结果回调 |
| `onResponse` | function | - | 响应回调 |

## 练习题

### 练习 1: 实现流式工具调用解析

```typescript
// exercises/01-stream-parsing.ts
// TODO: 实现从流式响应中解析工具调用
// OpenAI 的流式响应中，工具调用是分块传输的
// 需要正确合并参数 JSON

export class StreamingToolCallParser {
  // TODO: 实现
  addChunk(chunk: any): void {}
  getCompleteToolCalls(): UnifiedToolCall[] { return []; }
  isComplete(): boolean { return false; }
}
```

### 练习 2: 实现工具调用重试

```typescript
// exercises/02-retry.ts
// TODO: 实现工具调用失败时的重试机制
// 要求：
// 1. 工具执行失败时自动重试
// 2. 支持配置重试次数和延迟
// 3. 区分可重试和不可重试的错误

export class RetryableToolHandler {
  // TODO: 实现
  constructor(
    private handler: ToolCallHandler,
    private maxRetries: number = 3
  ) {}

  async handle(calls: UnifiedToolCall[]): Promise<UnifiedToolResult[]> {
    // TODO: 实现带重试的处理逻辑
    return [];
  }
}
```

### 练习 3: 实现工具调用缓存

```typescript
// exercises/03-cache.ts
// TODO: 实现工具调用的结果缓存
// 相同工具 + 相同参数 = 返回缓存结果

export interface CacheEntry {
  result: UnifiedToolResult;
  timestamp: number;
  ttl: number;
}

export class CachedToolCallHandler {
  // TODO: 实现
  constructor(
    private handler: ToolCallHandler,
    private defaultTTL: number = 60000 // 1分钟
  ) {}

  async handle(calls: UnifiedToolCall[]): Promise<UnifiedToolResult[]> {
    // TODO: 实现带缓存的处理逻辑
    return [];
  }

  clearCache(): void {}
}
```

### 练习 4: 实现工具调用限流

```typescript
// exercises/04-rate-limit.ts
// TODO: 实现工具调用的限流机制
// 防止 AI 过于频繁地调用工具

export class RateLimitedToolHandler {
  // TODO: 实现
  constructor(
    private handler: ToolCallHandler,
    private maxCallsPerSecond: number = 10
  ) {}

  async handle(calls: UnifiedToolCall[]): Promise<UnifiedToolResult[]> {
    // TODO: 实现限流逻辑
    return [];
  }
}
```

## 下一步

完成本节后，继续学习 [4.4 工具执行和安全](./04-tool-execution.md) →
