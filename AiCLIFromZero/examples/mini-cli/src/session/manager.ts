/**
 * 会话管理器
 */

import { Message } from '../providers/base.js';

export class SessionManager {
  private messages: Message[] = [];

  addMessage(message: Message): void {
    this.messages.push(message);
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  getMessagesForAPI(): Message[] {
    return this.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  clear(): void {
    this.messages = [];
  }

  getTokenCount(): number {
    // 简单估算：平均每4个字符约1个token
    return this.messages.reduce((total, m) => {
      return total + Math.ceil(m.content.length / 4);
    }, 0);
  }
}
