// src/mcp/mcp-client.ts
// MCP 客户端实现

import { ChildProcess, spawn } from 'child_process';
import { JSONRPCRequest, JSONRPCResponse, MCPTool, MCPResource, MCPPrompt } from './types.js';

/**
 * MCP 客户端配置
 */
export interface MCPClientConfig {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

/**
 * MCP 客户端
 */
export class MCPClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (value: any) => void;
      reject: (error: any) => void;
      timeout: NodeJS.Timeout;
    }
  >();
  private buffer = '';
  private config: MCPClientConfig;
  private connected = false;

  constructor(config: MCPClientConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  /**
   * 连接到 MCP Server（通过子进程）
   */
  async connect(): Promise<void> {
    if (this.connected) {
      throw new Error('Already connected');
    }

    return new Promise((resolve, reject) => {
      this.process = spawn(this.config.command, this.config.args || [], {
        cwd: this.config.cwd,
        env: { ...process.env, ...this.config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        this.handleData(data.toString());
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        console.error('MCP Server stderr:', data.toString());
      });

      this.process.on('error', (error) => {
        reject(error);
      });

      this.process.on('close', (code) => {
        this.connected = false;
        this.process = null;
        // 拒绝所有等待中的请求
        for (const [id, pending] of this.pendingRequests) {
          clearTimeout(pending.timeout);
          pending.reject(new Error(`MCP Server closed with code ${code}`));
        }
        this.pendingRequests.clear();
      });

      // 初始化握手
      this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        clientInfo: {
          name: 'mini-cli',
          version: '1.0.0',
        },
        capabilities: {},
      })
        .then(() => {
          this.connected = true;
          // 发送初始化完成通知
          this.sendNotification('notifications/initialized', {});
          resolve();
        })
        .catch(reject);
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
          clearTimeout(pending.timeout);
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
      if (!this.process || !this.process.stdin) {
        reject(new Error('Not connected'));
        return;
      }

      const id = ++this.requestId;

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.config.timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      const message = JSON.stringify(request) + '\n';
      this.process.stdin.write(message);
    });
  }

  /**
   * 发送通知
   */
  private sendNotification(method: string, params?: any): void {
    if (!this.process || !this.process.stdin) {
      return;
    }

    const notification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    const message = JSON.stringify(notification) + '\n';
    this.process.stdin.write(message);
  }

  /**
   * 列出工具
   */
  async listTools(): Promise<MCPTool[]> {
    const result = await this.sendRequest('tools/list');
    return result.tools || [];
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
    return result.resources || [];
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
    return result.prompts || [];
  }

  /**
   * 获取提示词
   */
  async getPrompt(name: string, args?: Record<string, string>): Promise<any> {
    return this.sendRequest('prompts/get', { name, arguments: args });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connected = false;

    // 拒绝所有等待中的请求
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Disconnected'));
    }
    this.pendingRequests.clear();
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.connected;
  }
}
