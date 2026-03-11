# 第05章：会话管理

> 实现会话持久化和上下文管理

## 学习目标

完成本章后，你将能够：

1. 设计消息数据结构
2. 实现会话存储（内存/文件/数据库）
3. 管理上下文窗口
4. 实现 Token 计数和优化

## 章节内容

- [5.1 消息数据结构](./01-message-structure.md)
- [5.2 会话存储](./02-session-storage.md)
- [5.3 上下文窗口管理](./03-context-window.md)
- [5.4 Token 计数和优化](./04-token-counting.md)

## 核心架构

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          会话管理架构                                       │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   ┌───────────────────────────────────────────────────────────────────┐  │
│   │                        Session Manager                            │  │
│   │                                                                   │  │
│   │  • 创建/恢复会话                                                  │  │
│   │  • 管理消息历史                                                  │  │
│   │  • 处理上下文窗口                                                │  │
│   │  • 持久化存储                                                    │  │
│   └───────────────────────────────┬───────────────────────────────────┘  │
│                                   │                                       │
│         ┌─────────────────────────┼─────────────────────────┐            │
│         │                         │                         │            │
│         ▼                         ▼                         ▼            │
│   ┌───────────┐           ┌───────────┐           ┌───────────────┐    │
│   │  Memory   │           │   File    │           │   Database    │    │
│   │  Storage  │           │  Storage  │           │    Storage    │    │
│   └───────────┘           └───────────┘           └───────────────┘    │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## 核心类型

```typescript
// src/types/session.ts

// 会话
export interface Session {
  id: string;
  title?: string;
  model: string;
  messages: Message[];
  metadata: SessionMetadata;
  createdAt: Date;
  updatedAt: Date;
}

// 会话元数据
export interface SessionMetadata {
  totalTokens: number;
  totalCost: number;
  messageCount: number;
}

// 消息
export interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokens?: number;
  toolCalls?: ToolCall[];
}

// 会话配置
export interface SessionConfig {
  maxMessages?: number;
  maxTokens?: number;
  systemPrompt?: string;
  persistMessages?: boolean;
}
```

## 会话管理器

```typescript
// src/managers/session-manager.ts

export class SessionManager {
  private session: Session;
  private storage: SessionStorage;
  private tokenizer: Tokenizer;

  constructor(config: SessionConfig) {
    this.session = this.createSession(config);
    this.storage = new FileStorage();
    this.tokenizer = new TiktokenTokenizer();
  }

  // 添加消息
  async addMessage(message: Message): Promise<void> {
    // 计算 token
    message.tokens = this.tokenizer.count(message.content);

    // 添加到会话
    this.session.messages.push(message);
    this.session.metadata.messageCount++;
    this.session.metadata.totalTokens += message.tokens;

    // 检查上下文窗口
    await this.checkContextWindow();

    // 持久化
    await this.storage.save(this.session);
  }

  // 获取用于 API 的消息
  getMessagesForAPI(): APIMessage[] {
    return this.session.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  // 检查上下文窗口
  private async checkContextWindow(): Promise<void> {
    const maxTokens = this.getModelMaxTokens();
    const currentTokens = this.session.metadata.totalTokens;

    if (currentTokens > maxTokens * 0.8) {
      // 触发上下文压缩或截断
      await this.compactContext();
    }
  }

  // 压缩上下文
  private async compactContext(): Promise<void> {
    // 保留系统消息和最近的几条消息
    // 中间的消息可以摘要或删除
  }
}
```

## 学习检验

完成本章后，你应该能够：

- [ ] 设计可扩展的消息结构
- [ ] 实现多种存储后端
- [ ] 管理上下文窗口
- [ ] 实现 Token 计数

## 下一步

开始学习 [5.1 消息数据结构](./01-message-structure.md) →
