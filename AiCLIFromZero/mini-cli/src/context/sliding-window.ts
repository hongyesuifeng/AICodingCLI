// src/context/sliding-window.ts
import type { Message } from '../types/message.js';
import type { SlidingWindowConfig } from '../types/session.js';
import { estimateConversationTokens, estimateMessageTokens } from '../utils/token-counter.js';

// 固定大小滑动窗口
export class FixedSlidingWindow {
  private messages: Message[] = [];

  constructor(private config: SlidingWindowConfig) {}

  // 添加消息
  add(message: Message): void {
    this.messages.push(message);
    this.trim();
  }

  // 批量添加消息
  addAll(messages: Message[]): void {
    this.messages.push(...messages);
    this.trim();
  }

  // 修剪消息以符合窗口大小
  private trim(): void {
    // 分离系统消息
    const systemMessages = this.config.preserveSystem
      ? this.messages.filter(m => m.role === 'system')
      : [];
    const otherMessages = this.messages.filter(m =>
      this.config.preserveSystem ? m.role !== 'system' : true
    );

    // 计算系统消息的 token
    const systemTokens = estimateConversationTokens(systemMessages);

    // 计算其他消息可用的 token
    const availableTokens = this.config.maxTokens - systemTokens;

    // 从后往前选择消息
    const selected: Message[] = [];
    let tokens = 0;

    for (let i = otherMessages.length - 1; i >= 0; i--) {
      const msgTokens = estimateMessageTokens(otherMessages[i]);
      if (tokens + msgTokens <= availableTokens) {
        selected.unshift(otherMessages[i]);
        tokens += msgTokens;
      } else {
        break;
      }
    }

    this.messages = [...systemMessages, ...selected];
  }

  // 获取当前窗口内的消息
  getMessages(): Message[] {
    return [...this.messages];
  }

  // 清空窗口
  clear(): void {
    this.messages = [];
  }

  // 获取当前 token 数
  getCurrentTokens(): number {
    return estimateConversationTokens(this.messages);
  }
}
