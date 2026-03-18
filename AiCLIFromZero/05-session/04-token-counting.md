# 5.4 Token 计数和优化

## 学习目标

理解 Token 计数原理，掌握 tiktoken 库的使用、成本估算和优化策略。

## 1. Token 计数原理

### 1.1 什么是 Token？

Token 是文本被分词后的最小单位。不同模型的分词方式不同：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Token 示例                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   原文: "Hello, world!"                                                     │
│   Tokens: ["Hello", ",", " world", "!"]                                    │
│   Count: 4 tokens                                                           │
│                                                                             │
│   原文: "你好，世界！"                                                       │
│   Tokens: ["你", "好", "，", "世界", "！"]                                  │
│   Count: 5 tokens                                                           │
│                                                                             │
│   原文: "function add(a, b) { return a + b; }"                              │
│   Tokens: ["function", " add", "(", "a", ",", " b", ")", " {", ...]        │
│   Count: ~15 tokens                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Token 计数规则

| 内容类型 | 估算规则 | 说明 |
|----------|----------|------|
| 英文文本 | ~4 字符 = 1 token | 单词边界会影响 |
| 中文文本 | ~1.5-2 字符 = 1 token | 常用字更高效 |
| 代码 | ~3-4 字符 = 1 token | 关键字更高效 |
| 空白 | 通常合并 | 连续空白常合并 |
| 特殊字符 | 1-3 tokens | 取决于编码 |

## 2. tiktoken 使用

### 2.1 安装和基础使用

```bash
# 安装 tiktoken
npm install tiktoken
```

```typescript
// src/utils/tiktoken-usage.ts
import { encoding_for_model, get_encoding, Tiktoken } from 'tiktoken';

// 使用模型特定的编码
function countTokensForModel(text: string, model: string): number {
  const encoding = encoding_for_model(model as any);
  const tokens = encoding.encode(text);
  encoding.free(); // 释放资源
  return tokens.length;
}

// 使用通用编码
function countTokensGeneric(text: string): number {
  const encoding = get_encoding('cl100k_base'); // GPT-4/3.5 使用的编码
  const tokens = encoding.encode(text);
  encoding.free();
  return tokens.length;
}

// 示例
const text = "Hello, world! This is a test.";
console.log(`Token count: ${countTokensGeneric(text)}`);
// Token count: 9
```

### 2.2 编码类型

```typescript
// src/utils/encodings.ts

// 不同模型使用的编码
export const MODEL_ENCODINGS: Record<string, string> = {
  // GPT-4 系列
  'gpt-4': 'cl100k_base',
  'gpt-4-turbo': 'cl100k_base',
  'gpt-4-32k': 'cl100k_base',

  // GPT-3.5 系列
  'gpt-3.5-turbo': 'cl100k_base',
  'gpt-3.5-turbo-16k': 'cl100k_base',

  // 旧模型
  'text-davinci-003': 'p50k_base',
  'text-davinci-002': 'p50k_base',

  // Codex
  'code-davinci-002': 'p50k_base',
  'code-cushman-001': 'p50k_base',
};

// 获取模型编码
export function getEncodingForModel(model: string): string {
  return MODEL_ENCODINGS[model] || 'cl100k_base';
}
```

### 2.3 Token 计数器类

```typescript
// src/utils/token-counter.ts
import { encoding_for_model, Tiktoken, TiktokenEncoding } from 'tiktoken';

// Token 计数器
export class TokenCounter {
  private encoder: Tiktoken | null = null;
  private encoding: TiktokenEncoding;

  constructor(encoding: TiktokenEncoding = 'cl100k_base') {
    this.encoding = encoding;
    this.initEncoder();
  }

  /**
   * 为特定模型创建计数器
   */
  static forModel(modelName: string): TokenCounter {
    const encoding = MODEL_ENCODINGS[modelName] || 'cl100k_base';
    return new TokenCounter(encoding as TiktokenEncoding);
  }

  /**
   * 初始化编码器
   */
  private initEncoder(): void {
    try {
      this.encoder = encoding_for_model(this.encoding as any);
    } catch {
      // 降级到通用编码
      const { get_encoding } = require('tiktoken');
      this.encoder = get_encoding(this.encoding);
    }
  }

  /**
   * 计算文本 token 数
   */
  count(text: string): number {
    if (!this.encoder) {
      return this.estimateTokens(text);
    }
    return this.encoder.encode(text).length;
  }

  /**
   * 批量计算
   */
  countBatch(texts: string[]): number[] {
    return texts.map(text => this.count(text));
  }

  /**
   * 获取 token 列表
   */
  tokenize(text: string): number[] {
    if (!this.encoder) {
      return [];
    }
    return this.encoder.encode(text);
  }

  /**
   * 从 token 解码回文本
   */
  decode(tokens: number[]): string {
    if (!this.encoder) {
      return '';
    }
    return this.encoder.decode(tokens);
  }

  /**
   * 截断文本到指定 token 数
   */
  truncate(text: string, maxTokens: number): string {
    const tokens = this.tokenize(text);
    if (tokens.length <= maxTokens) {
      return text;
    }
    return this.decode(tokens.slice(0, maxTokens));
  }

  /**
   * 估算 token（降级方案）
   */
  private estimateTokens(text: string): number {
    // 简单估算
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 2) + Math.ceil(otherChars / 4);
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
```

## 3. 消息 Token 计算

### 3.1 消息格式开销

```typescript
// src/utils/message-tokens.ts
import { Message, ToolResultMessage } from '../types/message.js';
import { TokenCounter } from './token-counter.js';

// 消息格式开销（每条消息的额外 token）
// 这是 OpenAI API 的内部开销
const MESSAGE_TOKEN_OVERHEAD = 4; // 每条消息

// 角色名称的 token 数
const ROLE_TOKENS: Record<string, number> = {
  system: 1,
  user: 1,
  assistant: 1,
  tool: 1,
};

// 计算单条消息的 token 数
export function countMessageTokens(
  message: Message | ToolResultMessage,
  counter: TokenCounter
): number {
  let tokens = MESSAGE_TOKEN_OVERHEAD;

  // 角色
  tokens += ROLE_TOKENS[message.role] || 1;

  // 内容
  if (typeof message.content === 'string') {
    tokens += counter.count(message.content);
  } else if (Array.isArray(message.content)) {
    // 多模态内容
    for (const part of message.content) {
      if (part.type === 'text') {
        tokens += counter.count(part.text);
      } else if (part.type === 'image') {
        // 图片 token 计算
        tokens += estimateImageTokens(part);
      }
    }
  }

  // 工具调用
  if ((message as any).toolCalls) {
    for (const call of (message as any).toolCalls) {
      tokens += counter.count(call.name);
      tokens += counter.count(JSON.stringify(call.arguments));
      tokens += 4; // 工具调用开销
    }
  }

  // 工具结果
  if ((message as ToolResultMessage).toolCallId) {
    tokens += counter.count((message as ToolResultMessage).toolCallId);
    tokens += 4; // 工具结果开销
  }

  // 如果内容为空（工具调用情况）
  if (!message.content || message.content === '') {
    tokens += 1; // 空内容也有开销
  }

  return tokens;
}

// 估算图片 token 数
function estimateImageTokens(imagePart: any): number {
  // OpenAI 的图片 token 计算
  // 低分辨率 (512x512): 85 tokens
  // 高分辨率: 基于 tile 数量计算

  if (imagePart.source?.type === 'url') {
    // 假设低分辨率
    return 85;
  }

  // 高分辨率计算
  // tile 数量 = ceil(width/512) * ceil(height/512)
  // tokens = 85 + 170 * tiles
  return 85; // 简化处理
}

// 计算对话总 token 数
export function countConversationTokens(
  messages: (Message | ToolResultMessage)[],
  counter: TokenCounter
): number {
  // 对话基础开销
  let total = 3;

  for (const message of messages) {
    total += countMessageTokens(message, counter);
  }

  return total;
}
```

### 3.2 消息 Token 计算示例

```typescript
// src/examples/token-counting.ts
import { TokenCounter, countMessageTokens, countConversationTokens } from '../utils/index.js';

const counter = new TokenCounter('cl100k_base');

// 单条消息
const userMessage = {
  role: 'user' as const,
  content: '请帮我写一个 TypeScript 函数，计算斐波那契数列',
};

console.log('User message tokens:', countMessageTokens(userMessage, counter));
// User message tokens: ~30

// 完整对话
const conversation = [
  { role: 'system' as const, content: '你是一个有帮助的编程助手。' },
  { role: 'user' as const, content: '什么是斐波那契数列？' },
  {
    role: 'assistant' as const,
    content: '斐波那契数列是一个数学序列，每个数是前两个数之和...',
  },
  { role: 'user' as const, content: '请给我一个代码示例' },
];

console.log('Total tokens:', countConversationTokens(conversation, counter));
// Total tokens: ~150

counter.dispose();
```

## 4. 成本估算

### 4.1 价格表

```typescript
// src/costs/pricing.ts

// 价格信息（每 1K tokens）
export interface Pricing {
  input: number;   // 输入价格 ($/1K tokens)
  output: number;  // 输出价格 ($/1K tokens)
}

// 各模型价格（2024 年数据，请参考官方最新价格）
export const MODEL_PRICING: Record<string, Pricing> = {
  // GPT-4 Turbo
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
  'gpt-4-0125-preview': { input: 0.01, output: 0.03 },
  'gpt-4-1106-preview': { input: 0.01, output: 0.03 },

  // GPT-4
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-32k': { input: 0.06, output: 0.12 },

  // GPT-3.5 Turbo
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },

  // Claude 3 (Anthropic)
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
};

// 获取模型价格
export function getModelPricing(model: string): Pricing {
  // 尝试精确匹配
  if (MODEL_PRICING[model]) {
    return MODEL_PRICING[model];
  }

  // 尝试前缀匹配
  const prefix = Object.keys(MODEL_PRICING).find(p => model.startsWith(p));
  if (prefix) {
    return MODEL_PRICING[prefix];
  }

  // 默认返回 GPT-3.5 价格
  return MODEL_PRICING['gpt-3.5-turbo'];
}
```

### 4.2 成本计算器

```typescript
// src/costs/calculator.ts
import { Pricing, getModelPricing } from './pricing.js';

// Token 使用统计
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// 成本计算结果
export interface CostResult {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  usage: TokenUsage;
}

// 成本计算器
export class CostCalculator {
  private totalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  private totalCost = 0;

  /**
   * 计算单次调用成本
   */
  calculate(model: string, usage: TokenUsage): CostResult {
    const pricing = getModelPricing(model);

    const inputCost = (usage.promptTokens / 1000) * pricing.input;
    const outputCost = (usage.completionTokens / 1000) * pricing.output;
    const totalCost = inputCost + outputCost;

    // 累计统计
    this.totalUsage.promptTokens += usage.promptTokens;
    this.totalUsage.completionTokens += usage.completionTokens;
    this.totalUsage.totalTokens += usage.totalTokens;
    this.totalCost += totalCost;

    return {
      inputCost,
      outputCost,
      totalCost,
      usage,
    };
  }

  /**
   * 预估成本
   */
  estimate(model: string, promptTokens: number, estimatedCompletionTokens: number): CostResult {
    return this.calculate(model, {
      promptTokens,
      completionTokens: estimatedCompletionTokens,
      totalTokens: promptTokens + estimatedCompletionTokens,
    });
  }

  /**
   * 获取累计统计
   */
  getTotalUsage(): TokenUsage {
    return { ...this.totalUsage };
  }

  /**
   * 获取累计成本
   */
  getTotalCost(): number {
    return this.totalCost;
  }

  /**
   * 格式化成本显示
   */
  formatCost(cost: number): string {
    if (cost < 0.01) {
      return `$${(cost * 100).toFixed(4)}¢`;
    }
    return `$${cost.toFixed(4)}`;
  }

  /**
   * 重置统计
   */
  reset(): void {
    this.totalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    this.totalCost = 0;
  }
}
```

### 4.3 成本估算示例

```typescript
// src/examples/cost-estimation.ts
import { CostCalculator } from '../costs/calculator.js';
import { TokenCounter, countConversationTokens } from '../utils/index.js';

const calculator = new CostCalculator();
const counter = new TokenCounter('cl100k_base');

// 对话消息
const messages = [
  { role: 'system' as const, content: '你是一个有帮助的助手。' },
  { role: 'user' as const, content: '请解释一下 TypeScript 中的泛型' },
];

// 计算输入 token
const promptTokens = countConversationTokens(messages, counter);
console.log(`Prompt tokens: ${promptTokens}`);

// 预估输出（假设 500 tokens）
const estimatedCompletion = 500;

// 计算预估成本
const estimate = calculator.estimate('gpt-4-turbo', promptTokens, estimatedCompletion);
console.log('Estimated cost:', calculator.formatCost(estimate.totalCost));
// Estimated cost: $0.0250

// 模拟实际调用
const actualUsage = {
  promptTokens,
  completionTokens: 450,
  totalTokens: promptTokens + 450,
};

const actual = calculator.calculate('gpt-4-turbo', actualUsage);
console.log('Actual cost:', calculator.formatCost(actual.totalCost));
console.log('Total session cost:', calculator.formatCost(calculator.getTotalCost()));

counter.dispose();
```

## 5. 优化策略

### 5.1 Token 优化技巧

```typescript
// src/utils/token-optimization.ts
import { Message } from '../types/message.js';
import { TokenCounter } from './token-counter.js';

// 优化策略
export class TokenOptimizer {
  constructor(private counter: TokenCounter) {}

  /**
   * 压缩空白字符
   */
  compressWhitespace(text: string): string {
    return text
      .replace(/[ \t]+/g, ' ')      // 压缩空格和制表符
      .replace(/\n{3,}/g, '\n\n');  // 压缩多个换行
  }

  /**
   * 移除注释（代码）
   */
  removeComments(code: string): string {
    // 单行注释
    let result = code.replace(/\/\/.*$/gm, '');

    // 多行注释
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');

    return result;
  }

  /**
   * 缩短长字符串
   */
  truncateLongStrings(text: string, maxLength: number = 1000): string {
    // 找到长字符串并截断
    return text.replace(/"([^"]{100,})"/g, (match, content) => {
      if (content.length > maxLength) {
        return `"${content.slice(0, maxLength)}...[truncated ${content.length - maxLength} chars]"`;
      }
      return match;
    });
  }

  /**
   * 优化消息内容
   */
  optimizeMessage(message: Message): Message {
    let content = typeof message.content === 'string'
      ? message.content
      : '';

    // 应用优化
    content = this.compressWhitespace(content);

    return {
      ...message,
      content,
    };
  }

  /**
   * 批量优化消息
   */
  optimizeMessages(messages: Message[]): Message[] {
    return messages.map(msg => this.optimizeMessage(msg));
  }

  /**
   * 计算优化效果
   */
  measureOptimization(original: string, optimized: string): {
    originalTokens: number;
    optimizedTokens: number;
    savedTokens: number;
    savedPercent: number;
  } {
    const originalTokens = this.counter.count(original);
    const optimizedTokens = this.counter.count(optimized);

    return {
      originalTokens,
      optimizedTokens,
      savedTokens: originalTokens - optimizedTokens,
      savedPercent: ((originalTokens - optimizedTokens) / originalTokens) * 100,
    };
  }
}
```

### 5.2 提示词优化

```typescript
// src/utils/prompt-optimization.ts

// 精简系统提示词
export function compactSystemPrompt(prompt: string): string {
  // 移除多余的描述词
  const replacements: [RegExp, string][] = [
    [/you are a (highly |very |extremely )?(helpful|useful|capable|competent) (assistant|AI|AI assistant)/gi, 'You are an assistant'],
    [/please (note that |be aware that )?/gi, ''],
    [/it is (important to |essential to )?note that /gi, ''],
    [/keep in mind that /gi, ''],
    [/make sure to /gi, ''],
    [/always /gi, ''],
    [/never /gi, ''],
  ];

  let result = prompt;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }

  return result.trim();
}

// 示例
const verbosePrompt = `You are a highly helpful and capable AI assistant.
Please note that you should always be accurate and helpful.
It is important to note that you should never make up information.
Make sure to be concise and clear in your responses.`;

const compactPrompt = compactSystemPrompt(verbosePrompt);
console.log('Original:', verbosePrompt.length, 'chars');
console.log('Compact:', compactPrompt.length, 'chars');
// Original: 245 chars
// Compact: 54 chars
```

### 5.3 缓存策略

```typescript
// src/utils/response-cache.ts
import { createHash } from 'crypto';

// 缓存条目
interface CacheEntry {
  response: string;
  usage: { promptTokens: number; completionTokens: number };
  timestamp: number;
  hits: number;
}

// 响应缓存
export class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private maxEntries: number;
  private ttlMs: number;

  constructor(maxEntries: number = 100, ttlMs: number = 3600000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  /**
   * 生成缓存键
   */
  private generateKey(messages: any[], model: string): string {
    const content = JSON.stringify({ messages, model });
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * 获取缓存的响应
   */
  get(messages: any[], model: string): CacheEntry | null {
    const key = this.generateKey(messages, model);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry;
  }

  /**
   * 缓存响应
   */
  set(
    messages: any[],
    model: string,
    response: string,
    usage: { promptTokens: number; completionTokens: number }
  ): void {
    // 清理旧条目
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    const key = this.generateKey(messages, model);
    this.cache.set(key, {
      response,
      usage,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  /**
   * 清理最老的条目
   */
  private evictOldest(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldest = key;
      }
    }

    if (oldest) {
      this.cache.delete(oldest);
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): { entries: number; totalHits: number; estimatedTokensSaved: number } {
    let totalHits = 0;
    let tokensSaved = 0;

    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      tokensSaved += entry.hits * entry.usage.completionTokens;
    }

    return {
      entries: this.cache.size,
      totalHits,
      estimatedTokensSaved: tokensSaved,
    };
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }
}
```

## 参数说明

### TokenUsage 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `promptTokens` | number | 输入 token 数 |
| `completionTokens` | number | 输出 token 数 |
| `totalTokens` | number | 总 token 数 |

### Pricing 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `input` | number | 输入价格 ($/1K tokens) |
| `output` | number | 输出价格 ($/1K tokens) |

### CostResult 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `inputCost` | number | 输入成本 |
| `outputCost` | number | 输出成本 |
| `totalCost` | number | 总成本 |
| `usage` | TokenUsage | 使用统计 |

## 练习题

### 练习 1: 实现实时 Token 监控

```typescript
// exercises/01-token-monitor.ts
// TODO: 实现实时监控对话 token 使用情况
// 要求：
// 1. 实时显示当前 token 数
// 2. 预警接近限制时
// 3. 显示成本累计

export class TokenMonitor {
  // TODO: 实现
  addMessage(message: Message): void {}
  getCurrentTokens(): number { return 0; }
  getEstimatedCost(): number { return 0; }
}
```

### 练习 2: 实现智能压缩

```typescript
// exercises/02-smart-compression.ts
// TODO: 实现智能压缩策略
// 要求：
// 1. 分析消息重要性
// 2. 选择性压缩低优先级内容
// 3. 保持对话连贯性

export class SmartCompressor {
  // TODO: 实现
  compress(messages: Message[], targetTokens: number): Message[] {
    return messages;
  }
}
```

### 练习 3: 实现成本预算控制

```typescript
// exercises/03-budget-control.ts
// TODO: 实现成本预算控制
// 要求：
// 1. 设置每日/每小时预算
// 2. 超预算时警告或阻止
// 3. 生成成本报告

export class BudgetController {
  // TODO: 实现
  setBudget(limit: number, period: 'hour' | 'day'): void {}
  checkAllowed(estimatedCost: number): boolean { return true; }
  getReport(): string { return ''; }
}
```

### 练习 4: 实现 Token 使用分析

```typescript
// exercises/04-usage-analysis.ts
// TODO: 实现 Token 使用分析工具
// 要求：
// 1. 分析不同类型消息的 token 占比
// 2. 识别 token 消耗热点
// 3. 生成优化建议

export class UsageAnalyzer {
  // TODO: 实现
  analyze(messages: Message[]): {
    totalTokens: number;
    byRole: Record<string, number>;
    hotspots: Array<{ index: number; tokens: number; suggestion: string }>;
  } {
    return { totalTokens: 0, byRole: {}, hotspots: [] };
  }
}
```

## 下一步

恭喜完成第05章！继续学习 [第06章：CLI 界面](../06-cli-interface/README.md) →
