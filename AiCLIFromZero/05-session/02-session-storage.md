# 5.2 会话存储

## 学习目标

掌握内存存储、文件存储、SQLite 存储的实现，以及存储抽象接口的设计。

## 1. 存储抽象接口

### 1.1 接口设计

```typescript
// src/storage/interface.ts
import { Message, ToolResultMessage } from '../types/message.js';

// 会话信息
export interface Session {
  id: string;                  // 会话 ID
  title?: string;              // 会话标题
  messages: (Message | ToolResultMessage)[];  // 消息列表
  createdAt: number;           // 创建时间
  updatedAt: number;           // 更新时间
  metadata?: Record<string, any>;  // 元数据
}

// 存储接口
export interface SessionStorage {
  /**
   * 创建新会话
   */
  createSession(id?: string): Promise<Session>;

  /**
   * 获取会话
   */
  getSession(id: string): Promise<Session | null>;

  /**
   * 保存会话
   */
  saveSession(session: Session): Promise<void>;

  /**
   * 删除会话
   */
  deleteSession(id: string): Promise<boolean>;

  /**
   * 列出所有会话
   */
  listSessions(): Promise<SessionInfo[]>;

  /**
   * 添加消息到会话
   */
  addMessage(sessionId: string, message: Message | ToolResultMessage): Promise<void>;

  /**
   * 清空会话消息
   */
  clearMessages(sessionId: string): Promise<void>;
}

// 会话简要信息
export interface SessionInfo {
  id: string;
  title?: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}
```

**接口方法说明：**

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `createSession` | id? | Session | 创建新会话 |
| `getSession` | string | Session \| null | 获取会话 |
| `saveSession` | Session | void | 保存会话 |
| `deleteSession` | string | boolean | 删除会话 |
| `listSessions` | - | SessionInfo[] | 列出所有会话 |
| `addMessage` | sessionId, message | void | 添加消息 |
| `clearMessages` | sessionId | void | 清空消息 |

## 2. 内存存储

### 2.1 实现内存存储

```typescript
// src/storage/memory-storage.ts
import { SessionStorage, Session, SessionInfo, Session as SessionType } from './interface.js';
import { Message, ToolResultMessage } from '../types/message.js';

// 生成唯一 ID
function generateId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// 内存存储实现
export class MemoryStorage implements SessionStorage {
  // 会话存储
  private sessions = new Map<string, Session>();

  /**
   * 创建新会话
   */
  async createSession(id?: string): Promise<Session> {
    const sessionId = id || generateId();
    const now = Date.now();

    const session: Session = {
      id: sessionId,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * 获取会话
   */
  async getSession(id: string): Promise<Session | null> {
    return this.sessions.get(id) || null;
  }

  /**
   * 保存会话
   */
  async saveSession(session: Session): Promise<void> {
    session.updatedAt = Date.now();
    this.sessions.set(session.id, { ...session });
  }

  /**
   * 删除会话
   */
  async deleteSession(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }

  /**
   * 列出所有会话
   */
  async listSessions(): Promise<SessionInfo[]> {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      title: session.title,
      messageCount: session.messages.length,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }));
  }

  /**
   * 添加消息到会话
   */
  async addMessage(sessionId: string, message: Message | ToolResultMessage): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.messages.push(message);
    session.updatedAt = Date.now();
  }

  /**
   * 清空会话消息
   */
  async clearMessages(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.messages = [];
    session.updatedAt = Date.now();
  }

  /**
   * 获取存储统计
   */
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
```

### 2.2 使用示例

```typescript
// src/examples/memory-storage-usage.ts
import { MemoryStorage } from '../storage/memory-storage.js';
import { MessageBuilder } from '../utils/message-builder.js';

async function example() {
  const storage = new MemoryStorage();

  // 创建会话
  const session = await storage.createSession();
  console.log('Created session:', session.id);

  // 添加消息
  await storage.addMessage(session.id, {
    role: 'system',
    content: '你是一个有帮助的助手。',
  });

  await storage.addMessage(session.id, {
    role: 'user',
    content: '你好！',
  });

  await storage.addMessage(session.id, {
    role: 'assistant',
    content: '你好！有什么可以帮助你的？',
  });

  // 获取会话
  const retrieved = await storage.getSession(session.id);
  console.log('Messages:', retrieved?.messages.length);

  // 列出会话
  const sessions = await storage.listSessions();
  console.log('Sessions:', sessions);

  // 统计信息
  console.log('Stats:', storage.getStats());
}
```

## 3. 文件存储

### 3.1 JSON 文件存储

```typescript
// src/storage/file-storage.ts
import { promises as fs } from 'fs';
import * as path from 'path';
import { SessionStorage, Session, SessionInfo } from './interface.js';
import { Message, ToolResultMessage } from '../types/message.js';

// 文件存储配置
export interface FileStorageConfig {
  storageDir: string;          // 存储目录
  fileExtension?: string;      // 文件扩展名
  prettyJson?: boolean;        // 是否美化 JSON
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

  /**
   * 初始化存储（创建目录）
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.config.storageDir, { recursive: true });
  }

  /**
   * 获取会话文件路径
   */
  private getSessionPath(sessionId: string): string {
    return path.join(
      this.config.storageDir,
      `${sessionId}${this.config.fileExtension}`
    );
  }

  /**
   * 创建新会话
   */
  async createSession(id?: string): Promise<Session> {
    await this.ensureDir();

    const sessionId = id || this.generateId();
    const now = Date.now();

    const session: Session = {
      id: sessionId,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.writeSession(session);
    return session;
  }

  /**
   * 获取会话
   */
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

  /**
   * 保存会话
   */
  async saveSession(session: Session): Promise<void> {
    await this.ensureDir();
    session.updatedAt = Date.now();
    await this.writeSession(session);
  }

  /**
   * 删除会话
   */
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

  /**
   * 列出所有会话
   */
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
      } catch (error) {
        // 跳过无法解析的文件
        console.warn(`Failed to read session file: ${file}`);
      }
    }

    // 按更新时间倒序
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * 添加消息到会话
   */
  async addMessage(sessionId: string, message: Message | ToolResultMessage): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.messages.push(message);
    await this.saveSession(session);
  }

  /**
   * 清空会话消息
   */
  async clearMessages(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.messages = [];
    await this.saveSession(session);
  }

  /**
   * 写入会话文件
   */
  private async writeSession(session: Session): Promise<void> {
    const filePath = this.getSessionPath(session.id);
    const content = JSON.stringify(
      session,
      null,
      this.config.prettyJson ? 2 : 0
    );
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * 确保目录存在
   */
  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.config.storageDir, { recursive: true });
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
```

### 3.2 使用示例

```typescript
// src/examples/file-storage-usage.ts
import { FileStorage } from '../storage/file-storage.js';

async function example() {
  const storage = new FileStorage({
    storageDir: './data/sessions',
    prettyJson: true,
  });

  // 初始化
  await storage.initialize();

  // 创建会话
  const session = await storage.createSession('my-session-001');
  console.log('Created session:', session.id);

  // 添加消息
  await storage.addMessage(session.id, {
    role: 'user',
    content: 'Hello!',
  });

  // 列出会话
  const sessions = await storage.listSessions();
  console.log('Sessions:', sessions);

  // 删除会话
  await storage.deleteSession('my-session-001');
}
```

## 4. SQLite 存储

### 4.1 数据库设计

```typescript
// src/storage/sqlite-storage.ts
import Database from 'better-sqlite3';
import { SessionStorage, Session, SessionInfo } from './interface.js';
import { Message, ToolResultMessage } from '../types/message.js';

// SQLite 存储实现
export class SQLiteStorage implements SessionStorage {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initialize();
  }

  /**
   * 初始化数据库表
   */
  private initialize(): void {
    // 会话表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        metadata TEXT
      )
    `);

    // 消息表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_call_id TEXT,
        tool_calls TEXT,
        finish_reason TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    // 索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_session
      ON messages(session_id)
    `);
  }

  /**
   * 创建新会话
   */
  async createSession(id?: string): Promise<Session> {
    const sessionId = id || this.generateId();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, created_at, updated_at)
      VALUES (?, ?, ?)
    `);

    stmt.run(sessionId, now, now);

    return {
      id: sessionId,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * 获取会话
   */
  async getSession(id: string): Promise<Session | null> {
    // 获取会话信息
    const sessionStmt = this.db.prepare(`
      SELECT * FROM sessions WHERE id = ?
    `);
    const sessionRow = sessionStmt.get(id) as any;

    if (!sessionRow) {
      return null;
    }

    // 获取消息
    const messagesStmt = this.db.prepare(`
      SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC
    `);
    const messageRows = messagesStmt.all(id) as any[];

    const messages = messageRows.map(row => this.parseMessage(row));

    return {
      id: sessionRow.id,
      title: sessionRow.title,
      messages,
      createdAt: sessionRow.created_at,
      updatedAt: sessionRow.updated_at,
      metadata: sessionRow.metadata ? JSON.parse(sessionRow.metadata) : undefined,
    };
  }

  /**
   * 保存会话
   */
  async saveSession(session: Session): Promise<void> {
    const now = Date.now();

    const stmt = this.db.prepare(`
      UPDATE sessions
      SET title = ?, updated_at = ?, metadata = ?
      WHERE id = ?
    `);

    stmt.run(
      session.title,
      now,
      session.metadata ? JSON.stringify(session.metadata) : null,
      session.id
    );
  }

  /**
   * 删除会话
   */
  async deleteSession(id: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * 列出所有会话
   */
  async listSessions(): Promise<SessionInfo[]> {
    const stmt = this.db.prepare(`
      SELECT
        s.id,
        s.title,
        s.created_at,
        s.updated_at,
        COUNT(m.id) as message_count
      FROM sessions s
      LEFT JOIN messages m ON s.id = m.session_id
      GROUP BY s.id
      ORDER BY s.updated_at DESC
    `);

    const rows = stmt.all() as any[];

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      messageCount: row.message_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * 添加消息到会话
   */
  async addMessage(sessionId: string, message: Message | ToolResultMessage): Promise<void> {
    const now = Date.now();

    // 插入消息
    const stmt = this.db.prepare(`
      INSERT INTO messages
      (session_id, role, content, tool_call_id, tool_calls, finish_reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      sessionId,
      message.role,
      typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
      (message as ToolResultMessage).toolCallId || null,
      (message as any).toolCalls ? JSON.stringify((message as any).toolCalls) : null,
      (message as any).finishReason || null,
      now
    );

    // 更新会话时间
    this.db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(now, sessionId);
  }

  /**
   * 清空会话消息
   */
  async clearMessages(sessionId: string): Promise<void> {
    this.db.prepare('DELETE FROM messages WHERE session_id = ?').run(sessionId);
    this.db.prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(Date.now(), sessionId);
  }

  /**
   * 解析消息
   */
  private parseMessage(row: any): Message | ToolResultMessage {
    const content = this.parseContent(row.content);
    const role = row.role;

    if (role === 'tool') {
      return {
        role: 'tool',
        toolCallId: row.tool_call_id,
        content,
      };
    }

    const message: any = {
      role,
      content,
    };

    if (row.tool_calls) {
      message.toolCalls = JSON.parse(row.tool_calls);
    }

    if (row.finish_reason) {
      message.finishReason = row.finish_reason;
    }

    return message;
  }

  /**
   * 解析内容
   */
  private parseContent(content: string): string | any[] {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}
    return content;
  }

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * 关闭连接
   */
  close(): void {
    this.db.close();
  }
}
```

### 4.2 使用示例

```typescript
// src/examples/sqlite-storage-usage.ts
import { SQLiteStorage } from '../storage/sqlite-storage.js';

async function example() {
  const storage = new SQLiteStorage('./data/sessions.db');

  // 创建会话
  const session = await storage.createSession();
  console.log('Created session:', session.id);

  // 添加消息
  await storage.addMessage(session.id, {
    role: 'system',
    content: '你是一个助手',
  });

  await storage.addMessage(session.id, {
    role: 'user',
    content: 'Hello!',
  });

  // 获取会话
  const retrieved = await storage.getSession(session.id);
  console.log('Messages:', retrieved?.messages.length);

  // 列出会话
  const sessions = await storage.listSessions();
  console.log('Sessions:', sessions);

  // 关闭连接
  storage.close();
}
```

## 5. 存储工厂

### 5.1 统一创建接口

```typescript
// src/storage/factory.ts
import { SessionStorage } from './interface.js';
import { MemoryStorage } from './memory-storage.js';
import { FileStorage } from './file-storage.js';
import { SQLiteStorage } from './sqlite-storage.js';

// 存储类型
export type StorageType = 'memory' | 'file' | 'sqlite';

// 存储配置
export interface StorageConfig {
  type: StorageType;

  // 文件存储配置
  storageDir?: string;

  // SQLite 配置
  dbPath?: string;
}

// 存储工厂
export class StorageFactory {
  /**
   * 创建存储实例
   */
  static create(config: StorageConfig): SessionStorage {
    switch (config.type) {
      case 'memory':
        return new MemoryStorage();

      case 'file':
        if (!config.storageDir) {
          throw new Error('storageDir is required for file storage');
        }
        return new FileStorage({
          storageDir: config.storageDir,
        });

      case 'sqlite':
        if (!config.dbPath) {
          throw new Error('dbPath is required for sqlite storage');
        }
        return new SQLiteStorage(config.dbPath);

      default:
        throw new Error(`Unknown storage type: ${config.type}`);
    }
  }

  /**
   * 创建默认存储（内存）
   */
  static createDefault(): SessionStorage {
    return new MemoryStorage();
  }
}
```

## 参数说明

### Session 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✓ | 会话唯一 ID |
| `title` | string | - | 会话标题 |
| `messages` | Message[] | ✓ | 消息列表 |
| `createdAt` | number | ✓ | 创建时间戳 |
| `updatedAt` | number | ✓ | 更新时间戳 |
| `metadata` | object | - | 自定义元数据 |

### SessionInfo 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 会话 ID |
| `title` | string | 会话标题 |
| `messageCount` | number | 消息数量 |
| `createdAt` | number | 创建时间 |
| `updatedAt` | number | 更新时间 |

### FileStorageConfig 字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `storageDir` | string | - | 存储目录 |
| `fileExtension` | string | '.json' | 文件扩展名 |
| `prettyJson` | boolean | true | 美化 JSON |

## 练习题

### 练习 1: 实现自动保存

```typescript
// exercises/01-auto-save.ts
// TODO: 实现自动保存的存储包装器
// 要求：
// 1. 定期自动保存内存中的会话到文件
// 2. 支持配置保存间隔
// 3. 支持脏数据检测

export class AutoSaveStorage implements SessionStorage {
  // TODO: 实现
  constructor(
    private memoryStorage: MemoryStorage,
    private fileStorage: FileStorage,
    private saveIntervalMs: number = 30000
  ) {}

  // ... 实现接口方法，添加自动保存逻辑
}
```

### 练习 2: 实现会话导入导出

```typescript
// exercises/02-import-export.ts
// TODO: 实现会话的导入导出功能
// 要求：
// 1. 导出为 JSON 文件
// 2. 从 JSON 文件导入
// 3. 支持批量导入导出

export async function exportSession(
  storage: SessionStorage,
  sessionId: string,
  outputPath: string
): Promise<void> {
  // TODO: 实现
}

export async function importSession(
  storage: SessionStorage,
  inputPath: string
): Promise<Session> {
  // TODO: 实现
  throw new Error('Not implemented');
}
```

### 练习 3: 实现会话搜索

```typescript
// exercises/03-session-search.ts
// TODO: 实现会话内容搜索
// 要求：
// 1. 搜索消息内容
// 2. 支持正则表达式
// 3. 返回匹配的会话和消息位置

export interface SearchResult {
  sessionId: string;
  messageId?: number;
  context: string;
}

export async function searchInSessions(
  storage: SessionStorage,
  query: string | RegExp
): Promise<SearchResult[]> {
  // TODO: 实现
  return [];
}
```

### 练习 4: 实现会话压缩存储

```typescript
// exercises/04-compression.ts
// TODO: 实现会话的压缩存储
// 要求：
// 1. 使用 gzip 压缩 JSON 数据
// 2. 自动解压读取
// 3. 统计压缩率

export class CompressedFileStorage implements SessionStorage {
  // TODO: 实现
}
```

## 下一步

完成本节后，继续学习 [5.3 上下文窗口管理](./03-context-window.md) →
