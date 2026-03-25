// src/context/truncation.ts
import type { Message } from '../types/message.js';
import type { TruncationConfig } from '../types/session.js';
import { estimateConversationTokens, estimateMessageTokens } from '../utils/token-counter.js';

const DEFAULT_CONFIG: TruncationConfig = {
  maxTokens: 4000,
  preserveSystemMessage: true,
  preserveFirstN: 0,
  preserveLastN: 4,
};

// 截断消息数组
export function truncateMessages(
  messages: Message[],
  config: Partial<TruncationConfig> = {}
): Message[] {
  const opts = { ...DEFAULT_CONFIG, ...config };

  // 检查是否需要截断
  const currentTokens = estimateConversationTokens(messages);
  if (currentTokens <= opts.maxTokens) {
    return messages;
  }

  // 分离系统消息
  const systemMessages: Message[] = [];
  const otherMessages: Message[] = [];

  for (const msg of messages) {
    if (msg.role === 'system' && opts.preserveSystemMessage) {
      systemMessages.push(msg);
    } else {
      otherMessages.push(msg);
    }
  }

  // 保留的消息
  const preservedFirst = otherMessages.slice(0, opts.preserveFirstN);
  const preservedLast = otherMessages.slice(-opts.preserveLastN);
  const middle = otherMessages.slice(opts.preserveFirstN, -opts.preserveLastN || undefined);

  // 计算保留部分的 token
  const preservedTokens = estimateConversationTokens([
    ...systemMessages,
    ...preservedFirst,
    ...preservedLast,
  ]);

  // 计算中间部分可用的 token
  const availableForMiddle = opts.maxTokens - preservedTokens;

  // 从中间部分选择消息（从后往前）
  const selectedMiddle: Message[] = [];
  let middleTokens = 0;

  for (let i = middle.length - 1; i >= 0; i--) {
    const msgTokens = estimateMessageTokens(middle[i]);
    if (middleTokens + msgTokens <= availableForMiddle) {
      selectedMiddle.unshift(middle[i]);
      middleTokens += msgTokens;
    } else {
      break;
    }
  }

  // 组合结果
  return [
    ...systemMessages,
    ...preservedFirst,
    ...selectedMiddle,
    ...preservedLast,
  ];
}

// 消息重要性评分
function getMessageImportance(message: Message): number {
  // 系统消息最重要
  if (message.role === 'system') return 100;

  // 带工具调用的消息较重要
  if ('toolCalls' in message && message.toolCalls) return 80;

  // 较长的消息可能包含更多信息
  const content = typeof message.content === 'string'
    ? message.content
    : '';
  const lengthScore = Math.min(50, content.length / 100);

  // 基础分数
  return 50 + lengthScore;
}

// 智能截断
export function smartTruncate(
  messages: Message[],
  maxTokens: number
): Message[] {
  // 检查是否需要截断
  const currentTokens = messages.reduce(
    (sum, m) => sum + estimateMessageTokens(m),
    0
  );
  if (currentTokens <= maxTokens) {
    return messages;
  }

  // 计算每条消息的重要性和 token
  const messageData = messages.map((msg, index) => ({
    message: msg,
    index,
    tokens: estimateMessageTokens(msg),
    importance: getMessageImportance(msg),
    recency: index / messages.length,
    score: 0 as number,
  }));

  // 计算综合分数
  for (const data of messageData) {
    data.score = data.importance * 0.5 + data.recency * 50;
  }

  // 排序：系统消息必须在最前，其他按分数排序
  messageData.sort((a, b) => {
    if (a.message.role === 'system' && b.message.role !== 'system') return -1;
    if (a.message.role !== 'system' && b.message.role === 'system') return 1;
    if (a.message.role === 'system' && b.message.role === 'system') {
      return a.index - b.index;
    }
    return b.score - a.score;
  });

  // 选择消息直到达到 token 限制
  const selected: typeof messageData = [];
  let totalTokens = 0;

  for (const data of messageData) {
    if (totalTokens + data.tokens <= maxTokens) {
      selected.push(data);
      totalTokens += data.tokens;
    }
  }

  // 恢复原始顺序
  selected.sort((a, b) => a.index - b.index);

  return selected.map(d => d.message);
}
