// src/utils/token-counter.ts
import type { Message } from '../types/message.js';

// 估算文本的 token 数（简化版，不需要 tiktoken 依赖）
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // 统计中文字符
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;

  // 统计其他字符
  const otherChars = text.length - chineseChars;

  // 估算
  // 中文：约 1.5-2 字符 = 1 token
  // 英文：约 4 字符 = 1 token
  const chineseTokens = Math.ceil(chineseChars / 2);
  const englishTokens = Math.ceil(otherChars / 4);

  return chineseTokens + englishTokens;
}

// 估算消息的 token 数
export function estimateMessageTokens(message: Message): number {
  let tokens = 4; // 消息基础开销

  // 角色开销
  tokens += 1;

  // 内容
  if (typeof message.content === 'string') {
    tokens += estimateTokens(message.content);
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === 'text' && part.text) {
        tokens += estimateTokens(part.text);
      } else if (part.type === 'image') {
        // 图片 token 估算（简化）
        tokens += 85; // 低分辨率图片
      }
    }
  }

  // 工具调用
  if ('toolCalls' in message && message.toolCalls) {
    for (const call of message.toolCalls) {
      tokens += estimateTokens(call.name || '');
      tokens += estimateTokens(JSON.stringify(call.arguments || {}));
    }
  }

  // 工具结果
  if ('toolCallId' in message && message.toolCallId) {
    tokens += estimateTokens(message.toolCallId);
    tokens += 4; // 工具结果开销
  }

  // 空内容开销
  if (!message.content || message.content === '') {
    tokens += 1;
  }

  return tokens;
}

// 估算消息数组的 token 数
export function estimateConversationTokens(messages: Message[]): number {
  let total = 3; // 对话基础开销

  for (const message of messages) {
    total += estimateMessageTokens(message);
  }

  return total;
}

// Token 计数器类
export class TokenCounter {
  count(text: string): number {
    return estimateTokens(text);
  }

  countMessage(message: Message): number {
    return estimateMessageTokens(message);
  }

  countConversation(messages: Message[]): number {
    return estimateConversationTokens(messages);
  }

  countBatch(texts: string[]): number[] {
    return texts.map(text => this.count(text));
  }

  // 截断文本到指定 token 数
  truncate(text: string, maxTokens: number): string {
    const tokens = this.count(text);
    if (tokens <= maxTokens) {
      return text;
    }

    // 简化处理：按字符比例截断
    const ratio = maxTokens / tokens;
    const targetLength = Math.floor(text.length * ratio);
    return text.slice(0, targetLength);
  }
}
