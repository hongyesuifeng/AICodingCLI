// src/hooks/builtin/performance-hook.ts
// 性能监控钩子

import { HookDefinition, HookContext, HookResult } from '../types.js';

/**
 * 性能监控钩子配置
 */
export interface PerformanceHookConfig {
  logToConsole?: boolean;
  slowThreshold?: number; // 慢响应阈值（毫秒）
}

/**
 * 创建性能监控钩子
 */
export function createPerformanceHook(config: PerformanceHookConfig = {}): HookDefinition[] {
  const timings = new Map<string, number>();
  const logToConsole = config.logToConsole !== false;
  const slowThreshold = config.slowThreshold || 5000;

  return [
    {
      name: 'performance-start',
      event: 'preResponse',
      priority: 0,

      handler: async (context: HookContext): Promise<HookResult> => {
        const sessionId = context.sessionId || 'default';
        timings.set(sessionId, Date.now());
        return { proceed: true };
      },
    },
    {
      name: 'performance-end',
      event: 'postResponse',
      priority: 0,

      handler: async (context: HookContext): Promise<HookResult> => {
        const sessionId = context.sessionId || 'default';
        const startTime = timings.get(sessionId) || Date.now();
        const duration = Date.now() - startTime;

        // 清理
        timings.delete(sessionId);

        if (logToConsole) {
          const slow = duration > slowThreshold;
          const prefix = slow ? '[Performance - SLOW]' : '[Performance]';
          console.log(`${prefix} Response time: ${duration}ms`);

          if (context.output?.usage) {
            const { promptTokens, completionTokens } = context.output.usage;
            console.log(`[Performance] Tokens: ${promptTokens} prompt + ${completionTokens} completion`);
          }
        }

        return { proceed: true };
      },
    },
  ];
}
