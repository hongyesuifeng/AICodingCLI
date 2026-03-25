// src/cli/command/validator.ts
import type { CommandDefinition, CommandContext } from './types.js';

// 验证结果
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// 命令验证器
export class CommandValidator {
  // 验证命令上下文
  validate(
    context: CommandContext,
    definition: CommandDefinition
  ): ValidationResult {
    const errors: string[] = [];

    // 验证必需选项
    if (definition.options) {
      for (const opt of definition.options) {
        if (opt.required && context.options[opt.name] === undefined) {
          errors.push(`Missing required option: --${opt.name}`);
        }
      }
    }

    // 验证必需参数
    if (definition.arguments) {
      const requiredArgs = definition.arguments.filter(a => a.required);
      if (context.arguments.length < requiredArgs.length) {
        errors.push(
          `Expected at least ${requiredArgs.length} arguments, got ${context.arguments.length}`
        );
      }
    }

    // 验证选项值类型
    if (definition.options) {
      for (const opt of definition.options) {
        const value = context.options[opt.name];
        if (value !== undefined) {
          const typeError = this.validateType(value, opt.type, opt.name);
          if (typeError) {
            errors.push(typeError);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // 验证类型
  private validateType(
    value: any,
    expectedType: string,
    optionName: string
  ): string | null {
    const actualType = typeof value;

    switch (expectedType) {
      case 'string':
        if (actualType !== 'string') {
          return `Option --${optionName} must be a string`;
        }
        break;
      case 'number':
        if (actualType !== 'number' || isNaN(value)) {
          return `Option --${optionName} must be a number`;
        }
        break;
      case 'boolean':
        if (actualType !== 'boolean') {
          return `Option --${optionName} must be a boolean`;
        }
        break;
    }

    return null;
  }
}
