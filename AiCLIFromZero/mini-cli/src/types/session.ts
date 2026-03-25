// src/types/session.ts
import type { Message } from './message.js';

// 会话元数据
export interface SessionMetadata {
  totalTokens: number;
  totalCost: number;
  messageCount: number;
  model?: string;
}

// 会话配置
export interface SessionConfig {
  maxMessages?: number;
  maxTokens?: number;
  systemPrompt?: string;
  persistMessages?: boolean;
  storageDir?: string;
}

// 会话信息（列表摘要）
export interface SessionInfo {
  id: string;
  title?: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

// 完整会话
export interface Session {
  id: string;
  title?: string;
  model: string;
  messages: Message[];
  metadata: SessionMetadata;
  createdAt: number;
  updatedAt: number;
  config?: SessionConfig;
}

// 存储接口
export interface SessionStorage {
  createSession(id?: string, model?: string): Promise<Session>;
  getSession(id: string): Promise<Session | null>;
  saveSession(session: Session): Promise<void>;
  deleteSession(id: string): Promise<boolean>;
  listSessions(): Promise<SessionInfo[]>;
  addMessage(sessionId: string, message: Message): Promise<void>;
  clearMessages(sessionId: string): Promise<void>;
}

// 价格信息
export interface Pricing {
  input: number;   // 输入价格 ($/1M tokens)
  output: number;  // 输出价格 ($/1M tokens)
}

// Token 使用统计
export interface TokenUsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// 成本计算结果
export interface CostResult {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  usage: TokenUsageStats;
}

// 截断配置
export interface TruncationConfig {
  maxTokens: number;
  preserveSystemMessage: boolean;
  preserveFirstN: number;
  preserveLastN: number;
}

// 滑动窗口配置
export interface SlidingWindowConfig {
  maxTokens: number;
  overlap: number;
  preserveSystem: boolean;
}
