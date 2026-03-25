# 7.1 MCP (Model Context Protocol) 协议

## 学习目标

理解 MCP 协议规范，掌握 JSON-RPC 通信，学习工具/资源/提示词的实现和 SDK 使用。

## 1. MCP 协议概述

### 1.1 什么是 MCP？

MCP (Model Context Protocol) 是 Anthropic 提出的开放协议，用于 AI 模型与外部工具/资源之间的标准化通信。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MCP 架构                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐     JSON-RPC      ┌──────────────┐                     │
│   │              │ ────────────────▶ │              │                     │
│   │   AI Client  │                   │  MCP Server  │                     │
│   │  (Claude)    │ ◀──────────────── │  (Tools)     │                     │
│   │              │                   │              │                     │
│   └──────────────┘                   └──────────────┘                     │
│         │                                   │                              │
│         │                                   │                              │
│         ▼                                   ▼                              │
│   ┌──────────────┐                   ┌──────────────┐                     │
│   │   Tools      │                   │  Resources   │                     │
│   │   Prompts    │                   │  文件/数据    │                     │
│   └──────────────┘                   └──────────────┘                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 MCP 核心概念

| 概念 | 说明 |
|------|------|
| **Tools** | AI 可调用的函数 |
| **Resources** | AI 可访问的数据（文件、数据库等） |
| **Prompts** | 预定义的提示词模板 |
| **Server** | 提供 MCP 服务的进程 |
| **Client** | 连接 MCP Server 的客户端 |

## 2. JSON-RPC 基础

### 2.1 JSON-RPC 消息格式

```typescript
// src/mcp/types.ts

// JSON-RPC 请求
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

// JSON-RPC 响应
export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: JSONRPCError;
}

// JSON-RPC 错误
export interface JSONRPCError {
  code: number;
  message: string;
  data?: any;
}

// JSON-RPC 通知（无需响应）
export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

// 标准错误码
export const JSONRPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
};
```

### 2.2 JSON-RPC 实现

```typescript
// src/mcp/jsonrpc.ts
import { JSONRPCRequest, JSONRPCResponse, JSONRPCNotification } from './types.js';

// JSON-RPC 处理器类型
type MethodHandler = (params: any) => Promise<any> | any;

// JSON-RPC 服务器
export class JSONRPCServer {
  private methods = new Map<string, MethodHandler>();

  /**
   * 注册方法
   */
  registerMethod(name: string, handler: MethodHandler): void {
    this.methods.set(name, handler);
  }

  /**
   * 处理请求
   */
  async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse> {
    const { id, method, params } = request;

    // 检查方法是否存在
    const handler = this.methods.get(method);
    if (!handler) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
      };
    }

    try {
      // 执行方法
      const result = await handler(params);
      return { jsonrpc: '2.0', id, result };
    } catch (error: any) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error.message || 'Internal error',
          data: error.data,
        },
      };
    }
  }

  /**
   * 创建请求
   */
  createRequest(id: string | number, method: string, params?: any): JSONRPCRequest {
    return {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };
  }

  /**
   * 创建通知
   */
  createNotification(method: string, params?: any): JSONRPCNotification {
    return {
      jsonrpc: '2.0',
      method,
      params,
    };
  }
}
```

## 3. MCP Server 实现

### 3.1 MCP 类型定义

```typescript
// src/mcp/mcp-types.ts

// 工具定义
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// 工具调用请求
export interface MCPToolCallRequest {
  name: string;
  arguments: Record<string, any>;
}

// 工具调用结果
export interface MCPToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// 资源定义
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

// 资源内容
export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

// 提示词定义
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

// 提示词内容
export interface MCPPromptMessage {
  role: 'user' | 'assistant';
  content: {
    type: 'text' | 'image' | 'resource';
    text?: string;
  };
}

// 服务器信息
export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
  capabilities: {
    tools?: { listChanged?: boolean };
    resources?: { subscribe?: boolean; listChanged?: boolean };
    prompts?: { listChanged?: boolean };
  };
}
```

### 3.2 MCP Server 类

```typescript
// src/mcp/mcp-server.ts
import { JSONRPCServer } from './jsonrpc.js';
import {
  MCPTool,
  MCPToolCallRequest,
  MCPToolCallResult,
  MCPResource,
  MCPResourceContent,
  MCPPrompt,
  MCPPromptMessage,
  MCPServerInfo,
} from './mcp-types.js';

// 工具处理器类型
type ToolHandler = (args: Record<string, any>) => Promise<MCPToolCallResult>;

// MCP 服务器
export class MCPServer {
  private jsonrpc: JSONRPCServer;
  private serverInfo: MCPServerInfo;
  private tools = new Map<string, { definition: MCPTool; handler: ToolHandler }>();
  private resources = new Map<string, MCPResource>();
  private prompts = new Map<string, MCPPrompt>();

  constructor(name: string, version: string) {
    this.jsonrpc = new JSONRPCServer();
    this.serverInfo = {
      name,
      version,
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: false, listChanged: true },
        prompts: { listChanged: true },
      },
    };

    this.setupBaseMethods();
  }

  /**
   * 设置基础 MCP 方法
   */
  private setupBaseMethods(): void {
    // 初始化握手
    this.jsonrpc.registerMethod('initialize', (params) => {
      return {
        protocolVersion: this.serverInfo.protocolVersion,
        capabilities: this.serverInfo.capabilities,
        serverInfo: {
          name: this.serverInfo.name,
          version: this.serverInfo.version,
        },
      };
    });

    // 获取服务器能力
    this.jsonrpc.registerMethod('capabilities', () => {
      return this.serverInfo.capabilities;
    });

    // 列出工具
    this.jsonrpc.registerMethod('tools/list', () => {
      return {
        tools: Array.from(this.tools.values()).map(t => t.definition),
      };
    });

    // 调用工具
    this.jsonrpc.registerMethod('tools/call', async (params: MCPToolCallRequest) => {
      const tool = this.tools.get(params.name);
      if (!tool) {
        return {
          content: [{ type: 'text', text: `Unknown tool: ${params.name}` }],
          isError: true,
        };
      }
      return tool.handler(params.arguments);
    });

    // 列出资源
    this.jsonrpc.registerMethod('resources/list', () => {
      return {
        resources: Array.from(this.resources.values()),
      };
    });

    // 读取资源
    this.jsonrpc.registerMethod('resources/read', async (params: { uri: string }) => {
      const resource = this.resources.get(params.uri);
      if (!resource) {
        throw new Error(`Resource not found: ${params.uri}`);
      }
      // 子类实现具体读取逻辑
      return { contents: [] };
    });

    // 列出提示词
    this.jsonrpc.registerMethod('prompts/list', () => {
      return {
        prompts: Array.from(this.prompts.values()),
      };
    });

    // 获取提示词
    this.jsonrpc.registerMethod('prompts/get', (params: { name: string; arguments?: Record<string, string> }) => {
      const prompt = this.prompts.get(params.name);
      if (!prompt) {
        throw new Error(`Prompt not found: ${params.name}`);
      }
      // 子类实现具体逻辑
      return { messages: [] };
    });
  }

  /**
   * 注册工具
   */
  registerTool(
    definition: MCPTool,
    handler: ToolHandler
  ): void {
    this.tools.set(definition.name, { definition, handler });
  }

  /**
   * 注册资源
   */
  registerResource(resource: MCPResource): void {
    this.resources.set(resource.uri, resource);
  }

  /**
   * 注册提示词
   */
  registerPrompt(prompt: MCPPrompt): void {
    this.prompts.set(prompt.name, prompt);
  }

  /**
   * 处理 JSON-RPC 请求
   */
  async handleRequest(request: any): Promise<any> {
    return this.jsonrpc.handleRequest(request);
  }
}
```

### 3.3 文件系统 MCP Server 示例

```typescript
// src/mcp/servers/file-system-server.ts
import { MCPServer } from '../mcp-server.js';
import { promises as fs } from 'fs';
import * as path from 'path';

// 文件系统 MCP Server
export class FileSystemMCPServer extends MCPServer {
  private allowedPaths: string[];

  constructor(allowedPaths: string[] = ['.']) {
    super('filesystem-server', '1.0.0');
    this.allowedPaths = allowedPaths;
    this.setupTools();
    this.setupResources();
  }

  /**
   * 设置工具
   */
  private setupTools(): void {
    // 读取文件
    this.registerTool(
      {
        name: 'read_file',
        description: 'Read the contents of a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The path to the file to read',
            },
          },
          required: ['path'],
        },
      },
      async (args) => {
        const content = await fs.readFile(args.path, 'utf-8');
        return {
          content: [{ type: 'text', text: content }],
        };
      }
    );

    // 写入文件
    this.registerTool(
      {
        name: 'write_file',
        description: 'Write content to a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
            content: { type: 'string', description: 'Content to write' },
          },
          required: ['path', 'content'],
        },
      },
      async (args) => {
        await fs.writeFile(args.path, args.content, 'utf-8');
        return {
          content: [{ type: 'text', text: `File written: ${args.path}` }],
        };
      }
    );

    // 列出目录
    this.registerTool(
      {
        name: 'list_directory',
        description: 'List directory contents',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Directory path',
              default: '.',
            },
          },
          required: [],
        },
      },
      async (args) => {
        const dirPath = args.path || '.';
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const listing = entries
          .map(e => `${e.name}${e.isDirectory() ? '/' : ''}`)
          .join('\n');
        return {
          content: [{ type: 'text', text: listing }],
        };
      }
    );
  }

  /**
   * 设置资源
   */
  private setupResources(): void {
    // 注册当前目录作为资源
    this.registerResource({
      uri: 'file://./',
      name: 'Current Directory',
      description: 'The current working directory',
      mimeType: 'text/directory',
    });
  }
}
```

## 4. MCP Client 实现

### 4.1 MCP Client 类

```typescript
// src/mcp/mcp-client.ts
import { ChildProcess, spawn } from 'child_process';
import { JSONRPCRequest, JSONRPCResponse } from './types.js';
import { MCPTool, MCPResource, MCPPrompt } from './mcp-types.js';

// MCP Client
export class MCPClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<string | number, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }>();
  private buffer = '';

  /**
   * 连接到 MCP Server（通过子进程）
   */
  async connect(command: string, args: string[] = []): Promise<void> {
    this.process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      this.handleData(data.toString());
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      console.error('MCP Server stderr:', data.toString());
    });

    this.process.on('close', (code) => {
      console.log('MCP Server closed:', code);
      this.process = null;
    });

    // 初始化握手
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      clientInfo: {
        name: 'ai-cli',
        version: '1.0.0',
      },
    });
  }

  /**
   * 处理接收的数据
   */
  private handleData(data: string): void {
    this.buffer += data;

    // 按行分割处理 JSON 消息
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const response: JSONRPCResponse = JSON.parse(line);
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch (error) {
        console.error('Failed to parse response:', error);
      }
    }
  }

  /**
   * 发送请求
   */
  private async sendRequest(method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });

      const message = JSON.stringify(request) + '\n';
      this.process?.stdin?.write(message);
    });
  }

  /**
   * 列出工具
   */
  async listTools(): Promise<MCPTool[]> {
    const result = await this.sendRequest('tools/list');
    return result.tools;
  }

  /**
   * 调用工具
   */
  async callTool(name: string, args: Record<string, any>): Promise<any> {
    return this.sendRequest('tools/call', { name, arguments: args });
  }

  /**
   * 列出资源
   */
  async listResources(): Promise<MCPResource[]> {
    const result = await this.sendRequest('resources/list');
    return result.resources;
  }

  /**
   * 读取资源
   */
  async readResource(uri: string): Promise<any> {
    return this.sendRequest('resources/read', { uri });
  }

  /**
   * 列出提示词
   */
  async listPrompts(): Promise<MCPPrompt[]> {
    const result = await this.sendRequest('prompts/list');
    return result.prompts;
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.process?.kill();
    this.process = null;
  }
}
```

## 5. SDK 使用

### 5.1 使用 @modelcontextprotocol/sdk

```bash
npm install @modelcontextprotocol/sdk
```

```typescript
// src/mcp/sdk-example.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// 创建 MCP Server
const server = new Server(
  {
    name: 'example-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 注册工具列表处理器
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'echo',
        description: 'Echo the input text',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to echo' },
          },
          required: ['text'],
        },
      },
    ],
  };
});

// 注册工具调用处理器
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'echo') {
    return {
      content: [
        {
          type: 'text',
          text: request.params.arguments.text,
        },
      ],
    };
  }
  throw new Error(`Unknown tool: ${request.params.name}`);
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Server running on stdio');
}

main();
```

## 参数说明

### MCPTool 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 工具名称 |
| `description` | string | 工具描述 |
| `inputSchema` | object | 输入参数 Schema |

### MCPToolCallResult 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `content` | array | 内容数组 |
| `isError` | boolean | 是否错误 |

### MCPServerInfo 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 服务器名称 |
| `version` | string | 版本号 |
| `protocolVersion` | string | 协议版本 |
| `capabilities` | object | 服务器能力 |

## 练习题

### 练习 1: 实现数据库 MCP Server

```typescript
// exercises/01-database-server.ts
// TODO: 实现数据库查询 MCP Server
// 要求：
// 1. 支持 SQLite 数据库
// 2. 提供 query 工具
// 3. 注册数据库资源

export class DatabaseMCPServer extends MCPServer {
  // TODO: 实现
}
```

### 练习 2: 实现 HTTP MCP Server

```typescript
// exercises/02-http-server.ts
// TODO: 实现 HTTP 请求 MCP Server
// 要求：
// 1. 提供 http_get/http_post 工具
// 2. 处理 JSON 响应
// 3. 支持自定义 headers

export class HttpMCPServer extends MCPServer {
  // TODO: 实现
}
```

### 练习 3: 实现多 Server 管理

```typescript
// exercises/03-multi-server.ts
// TODO: 实现多个 MCP Server 的管理
// 要求：
// 1. 同时连接多个 Server
// 2. 聚合所有工具
// 3. 按名称路由调用

export class MCPManager {
  // TODO: 实现
}
```

### 练习 4: 实现 MCP 代理

```typescript
// exercises/04-proxy.ts
// TODO: 实现 MCP 代理服务器
// 要求：
// 1. 转发请求到后端 Server
// 2. 添加日志记录
// 3. 支持请求过滤

export class MCPProxy {
  // TODO: 实现
}
```

## 下一步

完成本节后，继续学习 [7.2 技能系统 (Skills)](./02-skill-system.md) →
