// src/storage/file-storage.ts
import { promises as fs } from 'fs';
import * as path from 'path';
import type { Session, SessionInfo, SessionStorage, SessionMetadata } from '../types/session.js';
import type { Message } from '../types/message.js';

// 文件存储配置
export interface FileStorageConfig {
  storageDir: string;
  fileExtension?: string;
  prettyJson?: boolean;
}

// 文件存储实现
export class FileStorage implements SessionStorage {
  private config: Required<FileStorageConfig>;

  constructor(config: FileStorageConfig) {
    this.config = {
      storageDir: config.storageDir,
      fileExtension: config.fileExtension || '.json',
      prettyJson: config.prettyJson ?? true,
    };
  }

  // 初始化存储（创建目录）
  async initialize(): Promise<void> {
    await fs.mkdir(this.config.storageDir, { recursive: true });
  }

  // 获取会话文件路径
  private getSessionPath(sessionId: string): string {
    return path.join(
      this.config.storageDir,
      `${sessionId}${this.config.fileExtension}`
    );
  }

  // 生成唯一 ID
  private generateId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  async createSession(id?: string, model: string = 'gpt-4'): Promise<Session> {
    await this.ensureDir();

    const sessionId = id || this.generateId();
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

    await this.writeSession(session);
    return session;
  }

  async getSession(id: string): Promise<Session | null> {
    try {
      const filePath = this.getSessionPath(id);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async saveSession(session: Session): Promise<void> {
    await this.ensureDir();
    session.updatedAt = Date.now();
    await this.writeSession(session);
  }

  async deleteSession(id: string): Promise<boolean> {
    try {
      const filePath = this.getSessionPath(id);
      await fs.unlink(filePath);
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async listSessions(): Promise<SessionInfo[]> {
    await this.ensureDir();

    const files = await fs.readdir(this.config.storageDir);
    const sessionFiles = files.filter(f =>
      f.endsWith(this.config.fileExtension)
    );

    const sessions: SessionInfo[] = [];

    for (const file of sessionFiles) {
      const filePath = path.join(this.config.storageDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const session: Session = JSON.parse(content);

        sessions.push({
          id: session.id,
          title: session.title,
          messageCount: session.messages.length,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        });
      } catch {
        // 跳过无法解析的文件
      }
    }

    // 按更新时间倒序
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.messages.push(message);
    session.metadata.messageCount = session.messages.length;
    await this.saveSession(session);
  }

  async clearMessages(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.messages = [];
    session.metadata.messageCount = 0;
    session.metadata.totalTokens = 0;
    session.metadata.totalCost = 0;
    await this.saveSession(session);
  }

  // 写入会话文件
  private async writeSession(session: Session): Promise<void> {
    const filePath = this.getSessionPath(session.id);
    const content = JSON.stringify(
      session,
      null,
      this.config.prettyJson ? 2 : 0
    );
    await fs.writeFile(filePath, content, 'utf-8');
  }

  // 确保目录存在
  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.config.storageDir, { recursive: true });
  }
}
