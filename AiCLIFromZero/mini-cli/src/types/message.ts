// src/types/message.ts
// 消息角色
export type MessageRole = 'system' | 'user' | 'assistant';

// 多模态内容
export interface ContentPart {
  type: 'text' | 'image';
  text?: string;
  imageUrl?: { url: string };
}

// 基础消息
export interface BaseMessage {
  role: MessageRole;
  content: string | ContentPart[];
}

// 用户消息（可包含图片）
export interface UserMessage {
  role: 'user';
  content: string | ContentPart[];
}

// 助手消息（可包含工具调用）
export interface AssistantMessage {
  role: 'assistant';
  content: string;
  toolCalls?: ToolCall[];
}

// 系统消息
export interface SystemMessage {
  role: 'system';
  content: string;
}

// 联合类型
export type Message = UserMessage | AssistantMessage | SystemMessage;

// 工具调用
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

// 工具定义
export interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
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

// 聊天选项
export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  timeout?: number;
}

// 聊天结果
export interface ChatResult {
  content: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
  finishReason: 'stop' | 'tool_call' | 'length' | 'content_filter';
}

// Token 使用统计
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// 流式响应块
export interface StreamChunk {
  delta: string;
  toolCall?: Partial<ToolCall>;
  done: boolean;
  type?: 'thinking' | 'text'; // MiniMax 特有：支持 thinking 模式
}

// Provider 能力
export interface ProviderCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  maxContextTokens: number;
  supportedModels: string[];
}
