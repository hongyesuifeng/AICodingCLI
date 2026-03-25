// src/storage/memory-storage.ts
import type { Session, SessionInfo, SessionStorage, SessionMetadata } from '../types/session.js';
import type { Message } from '../types/message.js';

// 生成唯一 ID
function generateId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// 内存存储实现
export class MemoryStorage implements SessionStorage {
  private sessions = new Map<string, Session>();

  async createSession(id?: string, model: string = 'gpt-4'): Promise<Session> {
    const sessionId = id || generateId();
    const now = Date.now();

    const metadata: SessionMetadata = {
      totalTokens: 0,
      totalCost: 0,
      messageCount: 0,
      model,
    };

    const session: Session = {
      id: sessionId,
      model,
      messages: [],
      metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  async getSession(id: string): Promise<Session | null> {
    return this.sessions.get(id) || null;
  }

  async saveSession(session: Session): Promise<void> {
    session.updatedAt = Date.now();
    this.sessions.set(session.id, { ...session });
  }

  async deleteSession(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }

  async listSessions(): Promise<SessionInfo[]> {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      title: session.title,
      messageCount: session.messages.length,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }));
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.messages.push(message);
    session.metadata.messageCount = session.messages.length;
    session.updatedAt = Date.now();
  }

  async clearMessages(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.messages = [];
    session.metadata.messageCount = 0;
    session.metadata.totalTokens = 0;
    session.metadata.totalCost = 0;
    session.updatedAt = Date.now();
  }

  // 获取存储统计
  getStats(): { sessionCount: number; totalMessages: number } {
    let totalMessages = 0;
    for (const session of this.sessions.values()) {
      totalMessages += session.messages.length;
    }

    return {
      sessionCount: this.sessions.size,
      totalMessages,
    };
  }
}
