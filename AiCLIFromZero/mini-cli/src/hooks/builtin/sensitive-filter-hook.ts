// src/hooks/builtin/sensitive-filter-hook.ts
// 敏感信息过滤钩子

import { HookDefinition, HookContext, HookResult } from '../types.js';

/**
 * 敏感信息模式
 */
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // OpenAI API Key
  { pattern: /sk-[a-zA-Z0-9]{48}/g, replacement: '[OPENAI_KEY_REDACTED]' },
  // Anthropic API Key
  { pattern: /sk-ant-[a-zA-Z0-9-]{80,}/g, replacement: '[ANTHROPIC_KEY_REDACTED]' },
  // MiniMax API Key
  { pattern: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, replacement: '[MINIMAX_KEY_REDACTED]' },
  // 通用密钥模式
  { pattern: /api[_-]?key\s*=\s*['"][^'"]+['"]/gi, replacement: 'api_key="[REDACTED]"' },
  // 密码模式
  { pattern: /password\s*=\s*['"][^'"]+['"]/gi, replacement: 'password="[REDACTED]"' },
  // Token 模式
  { pattern: /token\s*=\s*['"][^'"]+['"]/gi, replacement: 'token="[REDACTED]"' },
  // 可能的密钥（32位十六进制）
  { pattern: /\b[a-f0-9]{32}\b/gi, replacement: '[HASH_REDACTED]' },
];

/**
 * 敏感信息过滤钩子配置
 */
export interface SensitiveFilterHookConfig {
  patterns?: Array<{ pattern: RegExp; replacement: string }>;
  logFiltered?: boolean;
}

/**
 * 创建敏感信息过滤钩子
 */
export function createSensitiveFilterHook(config: SensitiveFilterHookConfig = {}): HookDefinition {
  const patterns = config.patterns || SENSITIVE_PATTERNS;

  return {
    name: 'sensitive-filter',
    event: 'postResponse',
    priority: 50,

    handler: async (context: HookContext): Promise<HookResult> => {
      let content = context.output?.content || '';
      let modified = false;

      if (typeof content !== 'string') {
        return { proceed: true };
      }

      for (const { pattern, replacement } of patterns) {
        // 重置正则的 lastIndex
        pattern.lastIndex = 0;

        if (pattern.test(content)) {
          pattern.lastIndex = 0; // 重置
          content = content.replace(pattern, replacement);
          modified = true;

          if (config.logFiltered) {
            console.log(`[SensitiveFilter] Filtered pattern: ${pattern.source}`);
          }
        }
      }

      if (modified) {
        return {
          proceed: true,
          modifiedOutput: {
            ...context.output,
            content,
          },
        };
      }

      return { proceed: true };
    },
  };
}
