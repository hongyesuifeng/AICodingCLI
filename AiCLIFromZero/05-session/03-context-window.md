# 5.3 上下文窗口管理

## 学习目标

理解上下文窗口限制，掌握消息截断策略、摘要压缩和滑动窗口的实现。

## 1. 上下文窗口限制

### 1.1 什么是上下文窗口？

上下文窗口（Context Window）是指模型一次能处理的最大 token 数量。不同模型有不同的限制：

| 模型 | 上下文窗口 | 说明 |
|------|-----------|------|
| GPT-3.5 | 4,096 tokens | 基础版本 |
| GPT-4 | 8,192 tokens | 标准版本 |
| GPT-4-32k | 32,768 tokens | 扩展版本 |
| GPT-4-turbo | 128,000 tokens | 长上下文版本 |
| Claude 3 Opus | 200,000 tokens | 超长上下文 |
| Claude 3.5 Sonnet | 200,000 tokens | 最新版本 |

### 1.2 为什么需要管理？

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        上下文窗口问题                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   用户消息 1 ────┐                                                          │
│   AI 回复 1   ────┼─── 上下文不断增长                                        │
│   用户消息 2 ────┤                                                          │
│   AI 回复 2   ────┤                                                          │
│   ...          ────┼─── 超过窗口限制 ──▶ API 报错                           │
│   用户消息 N ────┤                                                          │
│   AI 回复 N   ────┘                                                          │
│                                                                             │
│   解决方案：                                                                 │
│   1. 截断旧消息                                                              │
│   2. 摘要压缩                                                                │
│   3. 滑动窗口                                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Token 估算

### 2.1 简单估算

```typescript
// src/utils/token-estimator.ts

// 估算文本的 token 数（简化版）
export function estimateTokens(text: string): number {
  // 简单估算规则：
  // - 英文：约 4 字符 = 1 token
  // - 中文：约 2 字符 = 1 token（实际更复杂）

  // 统计中文字符
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;

  // 统计其他字符
  const otherChars = text.length - chineseChars;

  // 估算
  const chineseTokens = Math.ceil(chineseChars / 2);
  const englishTokens = Math.ceil(otherChars / 4);

  return chineseTokens + englishTokens;
}

// 估算消息的 token 数
export function estimateMessageTokens(message: any): number {
  let tokens = 4; // 消息基础开销

  // 角色开销
  tokens += 1;

  // 内容
  if (typeof message.content === 'string') {
    tokens += estimateTokens(message.content);
  } else if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part.type === 'text') {
        tokens += estimateTokens(part.text);
      } else if (part.type === 'image') {
        // 图片 token 估算（简化）
        tokens += 85; // 低分辨率图片
      }
    }
  }

  // 工具调用
  if (message.toolCalls) {
    for (const call of message.toolCalls) {
      tokens += estimateTokens(call.name);
      tokens += estimateTokens(JSON.stringify(call.arguments));
    }
  }

  return tokens;
}

// 估算消息数组的 token 数
export function estimateConversationTokens(messages: any[]): number {
  let total = 3; // 对话基础开销

  for (const message of messages) {
    total += estimateMessageTokens(message);
  }

  return total;
}
```

### 2.2 使用 tiktoken（精确估算）

```typescript
// src/utils/tiktoken-counter.ts
import { encoding_for_model, Tiktoken } from 'tiktoken';

// Token 计数器
export class TokenCounter {
  private encoder: Tiktoken | null = null;
  private modelName: string;

  constructor(modelName: string = 'gpt-4') {
    this.modelName = modelName;
    this.initEncoder();
  }

  /**
   * 初始化编码器
   */
  private initEncoder(): void {
    try {
      this.encoder = encoding_for_model(this.modelName as any);
    } catch (error) {
      // 降级到简单估算
      console.warn('Failed to load tiktoken encoder, using estimation');
      this.encoder = null;
    }
  }

  /**
   * 计算文本的 token 数
   */
  count(text: string): number {
    if (this.encoder) {
      return this.encoder.encode(text).length;
    }
    return estimateTokens(text);
  }

  /**
   * 计算消息的 token 数
   */
  countMessage(message: any): number {
    if (this.encoder) {
      // 精确计算
      let tokens = 4; // 消息基础开销

      tokens += this.encoder.encode(message.role).length;

      if (typeof message.content === 'string') {
        tokens += this.encoder.encode(message.content).length;
      }

      if (message.toolCalls) {
        tokens += this.encoder.encode(JSON.stringify(message.toolCalls)).length;
      }

      return tokens;
    }

    return estimateMessageTokens(message);
  }

  /**
   * 计算对话的 token 数
   */
  countConversation(messages: any[]): number {
    let total = 3; // 对话基础开销

    for (const message of messages) {
      total += this.countMessage(message);
    }

    return total;
  }

  /**
   * 释放资源
   */
  dispose(): void {
    if (this.encoder) {
      this.encoder.free();
      this.encoder = null;
    }
  }
}

// 单例实例
let defaultCounter: TokenCounter | null = null;

export function getTokenCounter(modelName?: string): TokenCounter {
  if (!defaultCounter) {
    defaultCounter = new TokenCounter(modelName);
  }
  return defaultCounter;
}
```

## 3. 消息截断策略

### 3.1 基础截断策略

```typescript
// src/context/truncation.ts
import { Message } from '../types/message.js';
import { estimateConversationTokens } from '../utils/token-estimator.js';

// 截断配置
export interface TruncationConfig {
  maxTokens: number;           // 最大 token 数
  preserveSystemMessage: boolean;  // 保留系统消息
  preserveFirstN: number;      // 保留前 N 条消息
  preserveLastN: number;       // 保留后 N 条消息
}

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
    const msgTokens = estimateConversationTokens([middle[i]]);
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
```

### 3.2 智能截断策略

```typescript
// src/context/smart-truncation.ts
import { Message } from '../types/message.js';
import { estimateMessageTokens } from '../utils/token-estimator.js';

// 消息重要性评分
function getMessageImportance(message: Message): number {
  // 系统消息最重要
  if (message.role === 'system') return 100;

  // 带工具调用的消息较重要
  if ((message as any).toolCalls) return 80;

  // 较长的消息可能包含更多信息
  const length = typeof message.content === 'string'
    ? message.content.length
    : 100;
  const lengthScore = Math.min(50, length / 100);

  // 基础分数
  return 50 + lengthScore;
}

// 智能截断
export function smartTruncate(
  messages: Message[],
  maxTokens: number
): Message[] {
  // 检查是否需要截断
  const currentTokens = messages.reduce((sum, m) => sum + estimateMessageTokens(m), 0);
  if (currentTokens <= maxTokens) {
    return messages;
  }

  // 计算每条消息的重要性和 token
  const messageData = messages.map((msg, index) => ({
    message: msg,
    index,
    tokens: estimateMessageTokens(msg),
    importance: getMessageImportance(msg),
    recency: index / messages.length, // 越新越重要
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
      return a.index - b.index; // 保持原始顺序
    }
    return b.score - a.score; // 按分数降序
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
```

## 4. 摘要压缩

### 4.1 摘要生成器

```typescript
// src/context/summarizer.ts
import { AIProvider } from '../providers/base.js';
import { Message, AssistantMessage } from '../types/message.js';
import { extractText } from '../utils/content-utils.js';

// 摘要配置
export interface SummarizerConfig {
  maxSummaryTokens: number;    // 摘要最大 token 数
  summaryPrompt?: string;      // 自定义提示词
}

const DEFAULT_PROMPT = `请将以下对话历史压缩成一个简洁的摘要，保留关键信息：

{conversation}

摘要（不超过 {maxTokens} tokens）：`;

// 摘要生成器
export class ContextSummarizer {
  constructor(
    private provider: AIProvider,
    private config: SummarizerConfig = { maxSummaryTokens: 500 }
  ) {}

  /**
   * 生成对话摘要
   */
  async summarize(messages: Message[]): Promise<string> {
    // 格式化对话
    const conversation = messages.map(msg => {
      const content = extractText(msg.content);
      return `${msg.role}: ${content}`;
    }).join('\n\n');

    // 构建提示词
    const prompt = (this.config.summaryPrompt || DEFAULT_PROMPT)
      .replace('{conversation}', conversation)
      .replace('{maxTokens}', String(this.config.maxSummaryTokens));

    // 调用 AI 生成摘要
    const response = await this.provider.chat([
      { role: 'user', content: prompt },
    ]);

    return response.content;
  }

  /**
   * 压缩对话：保留系统消息 + 摘要 + 最近消息
   */
  async compress(
    messages: Message[],
    keepLastN: number = 2
  ): Promise<Message[]> {
    if (messages.length <= keepLastN + 1) {
      return messages;
    }

    // 分离消息
    const systemMessages = messages.filter(m => m.role === 'system');
    const toSummarize = messages.filter(m => m.role !== 'system').slice(0, -keepLastN);
    const keepRecent = messages.filter(m => m.role !== 'system').slice(-keepLastN);

    // 生成摘要
    const summary = await this.summarize(toSummarize);

    // 构建新对话
    const summaryMessage: AssistantMessage = {
      role: 'assistant',
      content: `[对话历史摘要]\n${summary}`,
    };

    return [...systemMessages, summaryMessage, ...keepRecent];
  }
}
```

### 4.2 渐进式摘要

```typescript
// src/context/progressive-summarizer.ts
import { Message } from '../types/message.js';
import { ContextSummarizer } from './summarizer.js';

// 渐进式摘要配置
export interface ProgressiveConfig {
  summaryThreshold: number;    // 触发摘要的消息数
  summaryKeepN: number;        // 摘要时保留的消息数
  maxSummaries: number;        // 最大摘要数
}

// 渐进式摘要管理器
export class ProgressiveSummarizer {
  private summaries: string[] = [];

  constructor(
    private summarizer: ContextSummarizer,
    private config: ProgressiveConfig = {
      summaryThreshold: 20,
      summaryKeepN: 10,
      maxSummaries: 5,
    }
  ) {}

  /**
   * 处理消息，必要时生成摘要
   */
  async process(messages: Message[]): Promise<Message[]> {
    if (messages.length <= this.config.summaryThreshold) {
      return messages;
    }

    // 分离系统消息
    const systemMessages = messages.filter(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');

    // 需要摘要的部分
    const toSummarize = otherMessages.slice(0, -this.config.summaryKeepN);
    const keepRecent = otherMessages.slice(-this.config.summaryKeepN);

    // 生成新摘要
    const newSummary = await this.summarizer.summarize(toSummarize);
    this.summaries.push(newSummary);

    // 限制摘要数量
    if (this.summaries.length > this.config.maxSummaries) {
      // 合并旧摘要
      const oldSummaries = this.summaries.slice(0, -1);
      const merged = await this.summarizer.summarize(
        oldSummaries.map(s => ({
          role: 'assistant' as const,
          content: s,
        }))
      );
      this.summaries = [merged, this.summaries[this.summaries.length - 1]];
    }

    // 构建消息
    const summaryMessage: Message = {
      role: 'assistant',
      content: this.summaries.map((s, i) => `[摘要 ${i + 1}]\n${s}`).join('\n\n'),
    };

    return [...systemMessages, summaryMessage, ...keepRecent];
  }

  /**
   * 获取所有摘要
   */
  getSummaries(): string[] {
    return [...this.summaries];
  }

  /**
   * 清空摘要
   */
  clearSummaries(): void {
    this.summaries = [];
  }
}
```

## 5. 滑动窗口

### 5.1 固定窗口

```typescript
// src/context/sliding-window.ts
import { Message } from '../types/message.js';
import { estimateConversationTokens } from '../utils/token-estimator.js';

// 滑动窗口配置
export interface SlidingWindowConfig {
  maxTokens: number;           // 最大 token 数
  overlap: number;             // 重叠消息数
  preserveSystem: boolean;     // 保留系统消息
}

// 固定大小滑动窗口
export class FixedSlidingWindow {
  private messages: Message[] = [];

  constructor(private config: SlidingWindowConfig) {}

  /**
   * 添加消息
   */
  add(message: Message): void {
    this.messages.push(message);
    this.trim();
  }

  /**
   * 批量添加消息
   */
  addAll(messages: Message[]): void {
    this.messages.push(...messages);
    this.trim();
  }

  /**
   * 修剪消息以符合窗口大小
   */
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
      const msgTokens = estimateConversationTokens([otherMessages[i]]);
      if (tokens + msgTokens <= availableTokens) {
        selected.unshift(otherMessages[i]);
        tokens += msgTokens;
      } else {
        break;
      }
    }

    this.messages = [...systemMessages, ...selected];
  }

  /**
   * 获取当前窗口内的消息
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * 清空窗口
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * 获取当前 token 数
   */
  getCurrentTokens(): number {
    return estimateConversationTokens(this.messages);
  }
}
```

### 5.2 动态窗口

```typescript
// src/context/dynamic-window.ts
import { Message } from '../types/message.js';
import { estimateMessageTokens } from '../utils/token-estimator.js';

// 消息优先级
type Priority = 'high' | 'medium' | 'low';

// 带优先级的消息
interface PrioritizedMessage {
  message: Message;
  priority: Priority;
  timestamp: number;
}

// 动态窗口配置
export interface DynamicWindowConfig {
  maxTokens: number;
  highPriorityRatio: number;   // 高优先级消息占比
  mediumPriorityRatio: number; // 中优先级消息占比
}

// 动态滑动窗口
export class DynamicSlidingWindow {
  private messages: PrioritizedMessage[] = [];

  constructor(private config: DynamicWindowConfig) {}

  /**
   * 添加消息
   */
  add(message: Message, priority: Priority = 'medium'): void {
    this.messages.push({
      message,
      priority,
      timestamp: Date.now(),
    });
    this.optimize();
  }

  /**
   * 批量添加消息
   */
  addAll(messages: Array<{ message: Message; priority?: Priority }>): void {
    for (const { message, priority } of messages) {
      this.messages.push({
        message,
        priority: priority || 'medium',
        timestamp: Date.now(),
      });
    }
    this.optimize();
  }

  /**
   * 优化窗口内容
   */
  private optimize(): void {
    // 计算当前 token
    const totalTokens = this.messages.reduce(
      (sum, m) => sum + estimateMessageTokens(m.message),
      0
    );

    if (totalTokens <= this.config.maxTokens) {
      return;
    }

    // 按优先级分组
    const high: PrioritizedMessage[] = [];
    const medium: PrioritizedMessage[] = [];
    const low: PrioritizedMessage[] = [];

    for (const msg of this.messages) {
      switch (msg.priority) {
        case 'high': high.push(msg); break;
        case 'medium': medium.push(msg); break;
        case 'low': low.push(msg); break;
      }
    }

    // 计算各优先级可用的 token
    const highTokens = this.config.maxTokens * this.config.highPriorityRatio;
    const mediumTokens = this.config.maxTokens * this.config.mediumPriorityRatio;
    const lowTokens = this.config.maxTokens - highTokens - mediumTokens;

    // 选择消息
    const selected: PrioritizedMessage[] = [];

    // 高优先级：全部保留（如果空间足够）
    selected.push(...this.selectByTokens(high, highTokens));

    // 中优先级：优先保留最近的
    medium.sort((a, b) => b.timestamp - a.timestamp);
    selected.push(...this.selectByTokens(medium, mediumTokens));

    // 低优先级：只保留最近的几条
    low.sort((a, b) => b.timestamp - a.timestamp);
    selected.push(...this.selectByTokens(low, lowTokens));

    // 按时间排序
    selected.sort((a, b) => a.timestamp - b.timestamp);

    this.messages = selected;
  }

  /**
   * 按 token 限制选择消息
   */
  private selectByTokens(
    messages: PrioritizedMessage[],
    maxTokens: number
  ): PrioritizedMessage[] {
    const selected: PrioritizedMessage[] = [];
    let tokens = 0;

    for (const msg of messages) {
      const msgTokens = estimateMessageTokens(msg.message);
      if (tokens + msgTokens <= maxTokens) {
        selected.push(msg);
        tokens += msgTokens;
      }
    }

    return selected;
  }

  /**
   * 获取当前消息
   */
  getMessages(): Message[] {
    return this.messages.map(m => m.message);
  }

  /**
   * 更新消息优先级
   */
  updatePriority(index: number, priority: Priority): void {
    if (index >= 0 && index < this.messages.length) {
      this.messages[index].priority = priority;
      this.optimize();
    }
  }
}
```

## 参数说明

### TruncationConfig 字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `maxTokens` | number | 4000 | 最大 token 数 |
| `preserveSystemMessage` | boolean | true | 保留系统消息 |
| `preserveFirstN` | number | 0 | 保留前 N 条消息 |
| `preserveLastN` | number | 4 | 保留后 N 条消息 |

### SlidingWindowConfig 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `maxTokens` | number | 最大 token 数 |
| `overlap` | number | 重叠消息数 |
| `preserveSystem` | boolean | 保留系统消息 |

### SummarizerConfig 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `maxSummaryTokens` | number | 摘要最大 token 数 |
| `summaryPrompt` | string | 自定义提示词 |

## 练习题

### 练习 1: 实现优先级队列窗口

```typescript
// exercises/01-priority-window.ts
// TODO: 实现基于优先级的消息窗口
// 要求：
// 1. 消息有不同的优先级
// 2. 高优先级消息优先保留
// 3. 同优先级按时间排序

export class PriorityWindow {
  // TODO: 实现
  add(message: Message, priority: number): void {}
  getMessages(): Message[] { return []; }
}
```

### 练习 2: 实现话题追踪窗口

```typescript
// exercises/02-topic-window.ts
// TODO: 实现追踪对话话题的窗口
// 要求：
// 1. 检测话题变化
// 2. 保留当前话题的相关消息
// 3. 压缩旧话题的内容

export class TopicTrackingWindow {
  // TODO: 实现
  add(message: Message): void {}
  getCurrentTopic(): string { return ''; }
  getMessages(): Message[] { return []; }
}
```

### 练习 3: 实现分层摘要

```typescript
// exercises/03-hierarchical-summary.ts
// TODO: 实现分层摘要系统
// 要求：
// 1. 不同时间粒度的摘要（小时、天、周）
// 2. 支持从粗到细的查询
// 3. 自动合并旧摘要

export class HierarchicalSummarizer {
  // TODO: 实现
  async addMessages(messages: Message[]): Promise<void> {}
  getSummary(level: 'hour' | 'day' | 'week'): string { return ''; }
}
```

### 练习 4: 实现上下文预测

```typescript
// exercises/04-context-prediction.ts
// TODO: 实现预测即将超出窗口的机制
// 要求：
// 1. 预测对话增长速度
// 2. 提前触发压缩
// 3. 平滑处理避免突然截断

export class ContextPredictor {
  // TODO: 实现
  predictFullIn(): number { return 0; } // 预测多少条消息后填满
  shouldCompress(): boolean { return false; }
}
```

## 下一步

完成本节后，继续学习 [5.4 Token 计数和优化](./04-token-counting.md) →
