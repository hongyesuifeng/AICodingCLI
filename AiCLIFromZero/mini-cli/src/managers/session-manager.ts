// src/managers/session-manager.ts
import type { Session, SessionStorage, SessionConfig, SessionMetadata } from '../types/session.js';
import type { Message, TokenUsage } from '../types/message.js';
import { MemoryStorage } from '../storage/memory-storage.js';
import { TokenCounter, estimateConversationTokens, estimateMessageTokens } from '../utils/token-counter.js';
import { CostCalculator, getModelPricing } from '../utils/cost-calculator.js';
import { truncateMessages, smartTruncate } from '../context/truncation.js';

// 会话管理器配置
export interface SessionManagerConfig {
  storage?: SessionStorage;
  defaultModel?: string;
  maxContextTokens?: number;
  systemPrompt?: string;
}

// 会话管理器
export class SessionManager {
  private session: Session | null = null;
  private storage: SessionStorage;
  private tokenCounter: TokenCounter;
  private costCalculator: CostCalculator;
  private config: SessionManagerConfig;

  constructor(config: SessionManagerConfig = {}) {
    this.config = {
      defaultModel: 'gpt-4',
      maxContextTokens: 4000,
      ...config,
    };
    this.storage = config.storage || new MemoryStorage();
    this.tokenCounter = new TokenCounter();
    this.costCalculator = new CostCalculator();
  }

  // 创建新会话
  async createSession(id?: string): Promise<Session> {
    this.session = await this.storage.createSession(id, this.config.defaultModel);

    // 添加系统提示词
    if (this.config.systemPrompt) {
      await this.addMessage({
        role: 'system',
        content: this.config.systemPrompt,
      });
    }

    return this.session;
  }

  // 加载现有会话
  async loadSession(id: string): Promise<Session | null> {
    this.session = await this.storage.getSession(id);
    return this.session;
  }

  // 获取当前会话
  getCurrentSession(): Session | null {
    return this.session;
  }

  // 获取当前会话 ID
  getSessionId(): string | null {
    return this.session?.id || null;
  }

  // 添加消息
  async addMessage(message: Message): Promise<void> {
    if (!this.session) {
      throw new Error('No active session. Call createSession() first.');
    }

    // 添加消息到存储
    await this.storage.addMessage(this.session.id, message);

    // 更新本地缓存
    this.session.messages.push(message);

    // 更新元数据
    const tokens = estimateMessageTokens(message);
    this.session.metadata.messageCount = this.session.messages.length;
    this.session.metadata.totalTokens += tokens;

    // 检查上下文窗口
    await this.checkContextWindow();
  }

  // 批量添加消息
  async addMessages(messages: Message[]): Promise<void> {
    for (const message of messages) {
      await this.addMessage(message);
    }
  }

  // 获取用于 API 的消息（可能被截断）
  getMessagesForAPI(): Message[] {
    if (!this.session) {
      return [];
    }

    const maxTokens = this.config.maxContextTokens || 4000;
    const currentTokens = this.session.metadata.totalTokens;

    if (currentTokens <= maxTokens) {
      return this.session.messages;
    }

    // 使用智能截断
    return smartTruncate(this.session.messages, maxTokens);
  }

  // 获取所有消息
  getMessages(): Message[] {
    return this.session?.messages || [];
  }

  // 更新 token 使用统计
  updateTokenUsage(usage: TokenUsage): void {
    if (!this.session) return;

    // 计算成本
    const result = this.costCalculator.calculate(this.session.model, {
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
    });

    // 更新会话元数据
    this.session.metadata.totalCost += result.totalCost;
    this.session.metadata.totalTokens = usage.totalTokens;
  }

  // 获取 token 统计
  getTokenStats(): { current: number; max: number; used: number } {
    const max = this.config.maxContextTokens || 4000;
    const current = this.session?.metadata.totalTokens || 0;
    return {
      current,
      max,
      used: current,
    };
  }

  // 获取成本统计
  getCostStats(): { sessionCost: number; totalCost: number } {
    return {
      sessionCost: this.session?.metadata.totalCost || 0,
      totalCost: this.costCalculator.getTotalCost(),
    };
  }

  // 保存会话
  async saveSession(): Promise<void> {
    if (!this.session) return;
    await this.storage.saveSession(this.session);
  }

  // 清空当前会话消息
  async clearMessages(): Promise<void> {
    if (!this.session) return;
    await this.storage.clearMessages(this.session.id);
    this.session.messages = [];
    this.session.metadata.messageCount = 0;
    this.session.metadata.totalTokens = 0;
    this.session.metadata.totalCost = 0;
  }

  // 删除会话
  async deleteSession(): Promise<boolean> {
    if (!this.session) return false;
    const result = await this.storage.deleteSession(this.session.id);
    if (result) {
      this.session = null;
    }
    return result;
  }

  // 列出所有会话
  async listSessions() {
    return this.storage.listSessions();
  }

  // 检查上下文窗口
  private async checkContextWindow(): Promise<void> {
    if (!this.session) return;

    const maxTokens = this.config.maxContextTokens || 4000;
    const currentTokens = this.session.metadata.totalTokens;

    // 如果超过 80% 容量，触发警告
    if (currentTokens > maxTokens * 0.8) {
      console.warn(`Context window at ${Math.round((currentTokens / maxTokens) * 100)}% capacity`);
    }
  }

  // 设置模型
  setModel(model: string): void {
    if (this.session) {
      this.session.model = model;
      this.session.metadata.model = model;
    }
  }

  // 获取模型
  getModel(): string {
    return this.session?.model || this.config.defaultModel || 'gpt-4';
  }

  // 设置系统提示词
  async setSystemPrompt(prompt: string): Promise<void> {
    if (!this.session) return;

    // 移除旧的系统消息
    this.session.messages = this.session.messages.filter(m => m.role !== 'system');

    // 添加新的系统消息
    await this.addMessage({
      role: 'system',
      content: prompt,
    });
  }

  // 格式化会话信息
  formatSessionInfo(): string {
    if (!this.session) {
      return 'No active session';
    }

    const stats = this.getTokenStats();
    const cost = this.getCostStats();

    return [
      `Session: ${this.session.id}`,
      `Model: ${this.session.model}`,
      `Messages: ${this.session.metadata.messageCount}`,
      `Tokens: ${stats.current}/${stats.max}`,
      `Cost: ${this.costCalculator.formatCost(cost.sessionCost)}`,
    ].join('\n');
  }
}
