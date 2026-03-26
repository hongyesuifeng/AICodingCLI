// src/mcp/mcp-server.ts
// MCP 服务器实现

import { JSONRPCServer } from './jsonrpc.js';
import {
  MCPTool,
  MCPToolCallRequest,
  MCPToolCallResult,
  MCPResource,
  MCPResourceContent,
  MCPPrompt,
  MCPServerInfo,
} from './types.js';

/**
 * 工具处理器类型
 */
export type ToolHandler = (args: Record<string, any>) => Promise<MCPToolCallResult>;

/**
 * 资源处理器类型
 */
export type ResourceHandler = (uri: string) => Promise<MCPResourceContent>;

/**
 * 提示词处理器类型
 */
export type PromptHandler = (
  name: string,
  args?: Record<string, string>
) => Promise<{ messages: Array<{ role: string; content: { type: string; text: string } }> }>;

/**
 * MCP 服务器配置
 */
export interface MCPServerConfig {
  name: string;
  version: string;
  protocolVersion?: string;
}

/**
 * MCP 服务器
 */
export class MCPServer {
  private jsonrpc: JSONRPCServer;
  private serverInfo: MCPServerInfo;
  private tools = new Map<string, { definition: MCPTool; handler: ToolHandler }>();
  private resources = new Map<string, { definition: MCPResource; handler?: ResourceHandler }>();
  private prompts = new Map<string, { definition: MCPPrompt; handler?: PromptHandler }>();
  private resourceHandler?: ResourceHandler;

  constructor(config: MCPServerConfig) {
    this.jsonrpc = new JSONRPCServer();
    this.serverInfo = {
      name: config.name,
      version: config.version,
      protocolVersion: config.protocolVersion || '2024-11-05',
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

    // 通知初始化完成
    this.jsonrpc.registerMethod('notifications/initialized', () => {
      return null;
    });

    // 列出工具
    this.jsonrpc.registerMethod('tools/list', () => {
      return {
        tools: Array.from(this.tools.values()).map((t) => t.definition),
      };
    });

    // 调用工具
    this.jsonrpc.registerMethod('tools/call', async (params: MCPToolCallRequest) => {
      const tool = this.tools.get(params.name);
      if (!tool) {
        return {
          content: [{ type: 'text', text: `Unknown tool: ${params.name}` }],
          isError: true,
        } as MCPToolCallResult;
      }

      try {
        return await tool.handler(params.arguments || {});
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        } as MCPToolCallResult;
      }
    });

    // 列出资源
    this.jsonrpc.registerMethod('resources/list', () => {
      return {
        resources: Array.from(this.resources.values()).map((r) => r.definition),
      };
    });

    // 读取资源
    this.jsonrpc.registerMethod('resources/read', async (params: { uri: string }) => {
      const resource = this.resources.get(params.uri);
      if (!resource) {
        throw new Error(`Resource not found: ${params.uri}`);
      }

      if (resource.handler) {
        const content = await resource.handler(params.uri);
        return { contents: [content] };
      }

      if (this.resourceHandler) {
        const content = await this.resourceHandler(params.uri);
        return { contents: [content] };
      }

      return { contents: [] };
    });

    // 列出提示词
    this.jsonrpc.registerMethod('prompts/list', () => {
      return {
        prompts: Array.from(this.prompts.values()).map((p) => p.definition),
      };
    });

    // 获取提示词
    this.jsonrpc.registerMethod(
      'prompts/get',
      async (params: { name: string; arguments?: Record<string, string> }) => {
        const prompt = this.prompts.get(params.name);
        if (!prompt) {
          throw new Error(`Prompt not found: ${params.name}`);
        }

        if (prompt.handler) {
          return prompt.handler(params.name, params.arguments);
        }

        return { messages: [] };
      }
    );
  }

  /**
   * 注册工具
   */
  registerTool(definition: MCPTool, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
  }

  /**
   * 移除工具
   */
  removeTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * 注册资源
   */
  registerResource(definition: MCPResource, handler?: ResourceHandler): void {
    this.resources.set(definition.uri, { definition, handler });
  }

  /**
   * 移除资源
   */
  removeResource(uri: string): boolean {
    return this.resources.delete(uri);
  }

  /**
   * 设置默认资源处理器
   */
  setResourceHandler(handler: ResourceHandler): void {
    this.resourceHandler = handler;
  }

  /**
   * 注册提示词
   */
  registerPrompt(definition: MCPPrompt, handler?: PromptHandler): void {
    this.prompts.set(definition.name, { definition, handler });
  }

  /**
   * 移除提示词
   */
  removePrompt(name: string): boolean {
    return this.prompts.delete(name);
  }

  /**
   * 处理 JSON-RPC 请求
   */
  async handleRequest(request: any): Promise<any> {
    return this.jsonrpc.handleRequest(request);
  }

  /**
   * 获取服务器信息
   */
  getServerInfo(): MCPServerInfo {
    return { ...this.serverInfo };
  }

  /**
   * 获取已注册的工具列表
   */
  getTools(): MCPTool[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  /**
   * 获取已注册的资源列表
   */
  getResources(): MCPResource[] {
    return Array.from(this.resources.values()).map((r) => r.definition);
  }

  /**
   * 获取已注册的提示词列表
   */
  getPrompts(): MCPPrompt[] {
    return Array.from(this.prompts.values()).map((p) => p.definition);
  }
}
