// src/hooks/builtin/validation-hook.ts
// 输入验证钩子

import { HookDefinition, HookContext, HookResult } from '../types.js';

/**
 * 验证钩子配置
 */
export interface ValidationHookConfig {
  maxLength?: number;
  forbiddenPatterns?: RegExp[];
  forbiddenWords?: string[];
}

/**
 * 创建输入验证钩子
 */
export function createValidationHook(config: ValidationHookConfig = {}): HookDefinition {
  const forbiddenPatterns = config.forbiddenPatterns || [];
  const forbiddenWords = config.forbiddenWords || [];

  return {
    name: 'input-validation',
    event: 'preInput',
    priority: 100, // 高优先级

    handler: async (context: HookContext): Promise<HookResult> => {
      const input = context.input?.rawInput || '';

      // 长度检查
      if (config.maxLength && input.length > config.maxLength) {
        return {
          proceed: false,
          error: `Input too long. Maximum ${config.maxLength} characters.`,
        };
      }

      // 模式检查
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(input)) {
          return {
            proceed: false,
            error: 'Input contains forbidden content.',
          };
        }
      }

      // 禁用词检查
      const lowerInput = input.toLowerCase();
      for (const word of forbiddenWords) {
        if (lowerInput.includes(word.toLowerCase())) {
          return {
            proceed: false,
            error: `Input contains forbidden word: ${word}`,
          };
        }
      }

      return { proceed: true };
    },
  };
}
