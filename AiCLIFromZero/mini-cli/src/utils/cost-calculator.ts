// src/utils/cost-calculator.ts
import type { Pricing, TokenUsageStats, CostResult } from '../types/session.js';

// 各模型价格（每 1M tokens）
export const MODEL_PRICING: Record<string, Pricing> = {
  // OpenAI
  'gpt-4': { input: 30, output: 60 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4o': { input: 5, output: 15 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },

  // Anthropic
  'claude-3-opus': { input: 15, output: 75 },
  'claude-3-sonnet': { input: 3, output: 15 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-3-5-sonnet': { input: 3, output: 15 },

  // MiniMax
  'MiniMax-M1': { input: 2, output: 8 },
  'MiniMax-M2.5': { input: 1, output: 4 },
  'MiniMax-Text-01': { input: 0.6, output: 2.4 },
};

// 获取模型价格
export function getModelPricing(model: string): Pricing {
  // 尝试精确匹配
  if (MODEL_PRICING[model]) {
    return MODEL_PRICING[model];
  }

  // 尝试前缀匹配
  const prefix = Object.keys(MODEL_PRICING).find(p =>
    model.toLowerCase().startsWith(p.toLowerCase())
  );
  if (prefix) {
    return MODEL_PRICING[prefix];
  }

  // 默认返回 GPT-3.5 价格
  return MODEL_PRICING['gpt-3.5-turbo'];
}

// 成本计算器
export class CostCalculator {
  private totalUsage: TokenUsageStats = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  private totalCost = 0;

  // 计算单次调用成本
  calculate(model: string, usage: TokenUsageStats): CostResult {
    const pricing = getModelPricing(model);

    const inputCost = (usage.promptTokens / 1000000) * pricing.input;
    const outputCost = (usage.completionTokens / 1000000) * pricing.output;
    const cost = inputCost + outputCost;

    // 累计统计
    this.totalUsage.promptTokens += usage.promptTokens;
    this.totalUsage.completionTokens += usage.completionTokens;
    this.totalUsage.totalTokens += usage.totalTokens;
    this.totalCost += cost;

    return {
      inputCost,
      outputCost,
      totalCost: cost,
      usage,
    };
  }

  // 预估成本
  estimate(model: string, promptTokens: number, estimatedCompletionTokens: number): CostResult {
    return this.calculate(model, {
      promptTokens,
      completionTokens: estimatedCompletionTokens,
      totalTokens: promptTokens + estimatedCompletionTokens,
    });
  }

  // 获取累计统计
  getTotalUsage(): TokenUsageStats {
    return { ...this.totalUsage };
  }

  // 获取累计成本
  getTotalCost(): number {
    return this.totalCost;
  }

  // 格式化成本显示
  formatCost(cost: number): string {
    if (cost < 0.01) {
      return `$${(cost * 100).toFixed(4)}¢`;
    }
    return `$${cost.toFixed(4)}`;
  }

  // 重置统计
  reset(): void {
    this.totalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    this.totalCost = 0;
  }
}
