// src/skills/base-skill.ts
// 技能基类

import { Skill, SkillContext, SkillResult, SkillTrigger, SkillParameter } from './types.js';

/**
 * 技能基类
 */
export abstract class BaseSkill implements Skill {
  abstract name: string;
  abstract description: string;
  abstract triggers: SkillTrigger[];
  abstract execute(context: SkillContext, args?: Record<string, any>): Promise<SkillResult>;

  help?: string;
  parameters?: SkillParameter[];
  examples?: string[];

  /**
   * 检查是否应该触发
   */
  shouldTrigger(input: string, context: SkillContext): boolean {
    for (const trigger of this.triggers) {
      // 命令触发
      if (trigger.command) {
        if (input.trim().startsWith(`/${trigger.command}`)) {
          return true;
        }
      }

      // 关键词触发
      if (trigger.keywords) {
        const lowerInput = input.toLowerCase();
        if (trigger.keywords.some((kw) => lowerInput.includes(kw.toLowerCase()))) {
          return true;
        }
      }

      // 正则触发
      if (trigger.pattern) {
        if (trigger.pattern.test(input)) {
          return true;
        }
      }

      // 上下文条件
      if (trigger.contextCondition) {
        if (trigger.contextCondition(context)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 解析参数
   */
  parseArgs(input: string): Record<string, any> {
    const args: Record<string, any> = {};

    if (!this.parameters) return args;

    // 移除命令前缀
    let remaining = input.replace(/^\/\S+\s*/, '').trim();

    // 简单参数解析（空格分隔）
    const parts = remaining.split(/\s+/);

    for (let i = 0; i < this.parameters.length && i < parts.length; i++) {
      const param = this.parameters[i];
      const value = parts[i];

      if (value) {
        args[param.name] = value;
      } else if (param.default !== undefined) {
        args[param.name] = param.default;
      }
    }

    // 设置默认值
    for (const param of this.parameters) {
      if (args[param.name] === undefined && param.default !== undefined) {
        args[param.name] = param.default;
      }
    }

    return args;
  }

  /**
   * 格式化帮助信息
   */
  formatHelp(): string {
    let help = `/${this.name} - ${this.description}\n`;

    if (this.parameters?.length) {
      help += '\n参数:\n';
      for (const param of this.parameters) {
        const required = param.required ? '(必需)' : '(可选)';
        help += `  ${param.name} ${required} - ${param.description || ''}\n`;
      }
    }

    if (this.examples?.length) {
      help += '\n示例:\n';
      for (const example of this.examples) {
        help += `  ${example}\n`;
      }
    }

    return help;
  }

  /**
   * 获取最高优先级
   */
  getMaxPriority(): number {
    return Math.max(...this.triggers.map((t) => t.priority || 0));
  }
}
