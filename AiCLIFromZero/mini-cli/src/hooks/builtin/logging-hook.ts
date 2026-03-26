// src/hooks/builtin/logging-hook.ts
// 日志钩子

import { HookDefinition, HookContext, HookResult } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 日志钩子配置
 */
export interface LoggingHookConfig {
  logDir: string;
  logFile?: string;
  format?: 'json' | 'text';
}

/**
 * 创建日志钩子
 */
export function createLoggingHook(config: LoggingHookConfig): HookDefinition {
  const logFile = config.logFile || path.join(config.logDir, 'hooks.log');
  const format = config.format || 'json';

  return {
    name: 'logging',
    event: 'postResponse',
    priority: 0,
    async: true, // 异步执行，不阻塞

    handler: async (_context: HookContext): Promise<HookResult> => {
      const context = _context;
      const logEntry: Record<string, any> = {
        timestamp: new Date(context.timestamp).toISOString(),
        event: context.event,
      };

      // 记录输入摘要
      if (context.input?.messages) {
        const lastMessage = context.input.messages.slice(-1)[0];
        logEntry.input = lastMessage?.content?.slice(0, 100);
      }

      // 记录输出摘要
      if (context.output?.content) {
        logEntry.output = context.output.content.slice(0, 100);
      }

      // 记录 token 使用
      if (context.output?.usage) {
        logEntry.usage = context.output.usage;
      }

      let logLine: string;
      if (format === 'json') {
        logLine = JSON.stringify(logEntry) + '\n';
      } else {
        logLine = `[${logEntry.timestamp}] ${logEntry.event}: ${logEntry.input || ''} -> ${logEntry.output || ''}\n`;
      }

      // 确保目录存在
      fs.mkdirSync(config.logDir, { recursive: true });
      fs.appendFileSync(logFile, logLine);

      return { proceed: true };
    },
  };
}
