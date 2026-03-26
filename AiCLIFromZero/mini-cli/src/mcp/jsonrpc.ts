// src/mcp/jsonrpc.ts
// JSON-RPC 服务器实现

import {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
  JSONRPCError,
  JSONRPC_ERROR_CODES,
} from './types.js';

/**
 * 方法处理器类型
 */
type MethodHandler = (params: any) => Promise<any> | any;

/**
 * JSON-RPC 服务器
 */
export class JSONRPCServer {
  private methods = new Map<string, MethodHandler>();

  /**
   * 注册方法
   */
  registerMethod(name: string, handler: MethodHandler): void {
    this.methods.set(name, handler);
  }

  /**
   * 移除方法
   */
  removeMethod(name: string): boolean {
    return this.methods.delete(name);
  }

  /**
   * 检查方法是否存在
   */
  hasMethod(name: string): boolean {
    return this.methods.has(name);
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
          code: JSONRPC_ERROR_CODES.METHOD_NOT_FOUND,
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
          code: error.code || JSONRPC_ERROR_CODES.INTERNAL_ERROR,
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
   * 创建响应
   */
  createResponse(id: string | number, result?: any, error?: JSONRPCError): JSONRPCResponse {
    const response: JSONRPCResponse = { jsonrpc: '2.0', id };
    if (error) {
      response.error = error;
    } else {
      response.result = result;
    }
    return response;
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

  /**
   * 创建错误响应
   */
  createError(
    id: string | number,
    code: number,
    message: string,
    data?: any
  ): JSONRPCResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: { code, message, data },
    };
  }

  /**
   * 解析并验证请求
   */
  parseRequest(data: string): JSONRPCRequest | null {
    try {
      const request = JSON.parse(data);

      // 验证基本字段
      if (request.jsonrpc !== '2.0') {
        return null;
      }

      if (typeof request.method !== 'string') {
        return null;
      }

      return request as JSONRPCRequest;
    } catch {
      return null;
    }
  }

  /**
   * 序列化响应
   */
  serializeResponse(response: JSONRPCResponse): string {
    return JSON.stringify(response);
  }
}
