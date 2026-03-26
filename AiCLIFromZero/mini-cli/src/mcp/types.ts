// src/mcp/types.ts
// MCP 协议相关类型定义

// ==================== JSON-RPC 类型 ====================

/**
 * JSON-RPC 请求
 */
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

/**
 * JSON-RPC 响应
 */
export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: JSONRPCError;
}

/**
 * JSON-RPC 错误
 */
export interface JSONRPCError {
  code: number;
  message: string;
  data?: any;
}

/**
 * JSON-RPC 通知（无需响应）
 */
export interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

/**
 * 标准错误码
 */
export const JSONRPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// ==================== MCP 类型 ====================

/**
 * MCP 工具定义
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * MCP 工具调用请求
 */
export interface MCPToolCallRequest {
  name: string;
  arguments: Record<string, any>;
}

/**
 * MCP 工具调用结果
 */
export interface MCPToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * MCP 资源定义
 */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP 资源内容
 */
export interface MCPResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

/**
 * MCP 提示词定义
 */
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * MCP 提示词消息
 */
export interface MCPPromptMessage {
  role: 'user' | 'assistant';
  content: {
    type: 'text' | 'image' | 'resource';
    text?: string;
  };
}

/**
 * MCP 服务器信息
 */
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

/**
 * MCP 客户端信息
 */
export interface MCPClientInfo {
  name: string;
  version: string;
}

/**
 * MCP 初始化结果
 */
export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: MCPServerInfo['capabilities'];
  serverInfo: {
    name: string;
    version: string;
  };
}
