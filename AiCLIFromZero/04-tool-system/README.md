# 第04章：工具系统

> 实现可扩展的工具调用机制 (Tool Calling)

## 学习目标

完成本章后，你将能够：

1. 设计工具定义和 Schema
2. 实现工具注册和管理
3. 理解 Tool Calling 协议
4. 实现安全的工具执行

## 章节内容

- [4.1 工具定义和 Schema](./01-tool-schema.md)
- [4.2 工具注册和管理](./02-tool-registry.md)
- [4.3 Tool Calling 协议](./03-tool-calling.md)
- [4.4 工具执行和安全](./04-tool-execution.md)

## 核心架构

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          工具系统架构                                       │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   ┌───────────────────────────────────────────────────────────────────┐  │
│   │                         Tool Registry                             │  │
│   │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────────┐  │  │
│   │  │ read_file │  │write_file │  │  execute  │  │    search     │  │  │
│   │  └───────────┘  └───────────┘  └───────────┘  └───────────────┘  │  │
│   └───────────────────────────────┬───────────────────────────────────┘  │
│                                   │                                       │
│                                   ▼                                       │
│   ┌───────────────────────────────────────────────────────────────────┐  │
│   │                         Tool Definition                           │  │
│   │                                                                   │  │
│   │  {                                                                │  │
│   │    name: "read_file",                                            │  │
│   │    description: "Read file contents",                            │  │
│   │    parameters: {                                                  │  │
│   │      type: "object",                                             │  │
│   │      properties: { path: { type: "string" } },                   │  │
│   │      required: ["path"]                                          │  │
│   │    },                                                            │  │
│   │    execute: async ({ path }) => { ... }                          │  │
│   │  }                                                               │  │
│   └───────────────────────────────────────────────────────────────────┘  │
│                                   │                                       │
│                                   ▼                                       │
│   ┌───────────────────────────────────────────────────────────────────┐  │
│   │                      Tool Execution Flow                          │  │
│   │                                                                   │  │
│   │  AI Response ──▶ Parse Tool Call ──▶ Validate Args ──▶ Execute   │  │
│   │                                                                   │  │
│   └───────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## 核心类型

```typescript
// src/types/tool.ts

// 工具定义
export interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (params: Record<string, any>) => Promise<string>;
}

// 工具调用请求
export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

// 工具调用结果
export interface ToolCallResult {
  toolCallId: string;
  result: string;
  error?: string;
}

// JSON Schema
export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  description?: string;
  enum?: string[];
  items?: JSONSchema;
}
```

## 内置工具示例

```typescript
// src/tools/built-in.ts

// 文件读取工具
export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read the contents of a file. Use this to examine file contents.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the file to read',
      },
    },
    required: ['path'],
  },
  execute: async ({ path }) => {
    const content = await fs.readFile(path, 'utf-8');
    return content;
  },
};

// 文件写入工具
export const writeFileTool: Tool = {
  name: 'write_file',
  description: 'Write content to a file. Creates the file if it does not exist.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'The path to the file to write',
      },
      content: {
        type: 'string',
        description: 'The content to write to the file',
      },
    },
    required: ['path', 'content'],
  },
  execute: async ({ path, content }) => {
    await fs.writeFile(path, content, 'utf-8');
    return `File written successfully: ${path}`;
  },
};

// 命令执行工具
export const executeCommandTool: Tool = {
  name: 'execute_command',
  description: 'Execute a shell command and return the output.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The command to execute',
      },
      cwd: {
        type: 'string',
        description: 'Working directory (optional)',
      },
    },
    required: ['command'],
  },
  execute: async ({ command, cwd }) => {
    const { stdout, stderr } = await execPromise(command, { cwd });
    return stdout || stderr || 'Command executed successfully';
  },
};
```

## 学习检验

完成本章后，你应该能够：

- [ ] 定义符合 JSON Schema 的工具
- [ ] 实现工具注册和发现机制
- [ ] 处理 AI 的工具调用请求
- [ ] 实现安全的工具执行环境

## 下一步

开始学习 [4.1 工具定义和 Schema](./01-tool-schema.md) →
