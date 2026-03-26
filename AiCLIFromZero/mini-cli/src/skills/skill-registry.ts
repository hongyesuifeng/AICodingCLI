// src/skills/skill-registry.ts
// 技能注册表

import { Skill, SkillContext, SkillResult } from './types.js';

/**
 * 技能注册表
 */
export class SkillRegistry {
  private skills = new Map<string, Skill>();
  private skillsByCommand = new Map<string, Skill>();

  /**
   * 注册技能
   */
  register(skill: Skill): void {
    this.skills.set(skill.name, skill);

    // 注册命令触发
    for (const trigger of skill.triggers) {
      if (trigger.command) {
        this.skillsByCommand.set(trigger.command, skill);
      }
    }
  }

  /**
   * 批量注册
   */
  registerAll(skills: Skill[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  /**
   * 移除技能
   */
  unregister(name: string): boolean {
    const skill = this.skills.get(name);
    if (!skill) return false;

    this.skills.delete(name);

    // 移除命令映射
    for (const trigger of skill.triggers) {
      if (trigger.command) {
        this.skillsByCommand.delete(trigger.command);
      }
    }

    return true;
  }

  /**
   * 获取技能
   */
  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * 列出所有技能
   */
  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * 根据输入匹配技能
   */
  match(input: string, context: SkillContext): Skill | null {
    // 首先检查命令触发
    const commandMatch = input.match(/^\/(\S+)/);
    if (commandMatch) {
      const skill = this.skillsByCommand.get(commandMatch[1]);
      if (skill) return skill;
    }

    // 检查其他触发条件
    const matchedSkills: { skill: Skill; priority: number }[] = [];

    for (const skill of this.skills.values()) {
      const shouldTrigger = skill.shouldTrigger
        ? skill.shouldTrigger(input, context)
        : this.defaultShouldTrigger(skill, input, context);

      if (shouldTrigger) {
        const priority = this.getMaxPriority(skill);
        matchedSkills.push({ skill, priority });
      }
    }

    // 按优先级排序
    matchedSkills.sort((a, b) => b.priority - a.priority);

    return matchedSkills[0]?.skill || null;
  }

  /**
   * 默认触发检查
   */
  private defaultShouldTrigger(skill: Skill, input: string, context: SkillContext): boolean {
    for (const trigger of skill.triggers) {
      // 命令触发
      if (trigger.command && input.trim().startsWith(`/${trigger.command}`)) {
        return true;
      }

      // 关键词触发
      if (trigger.keywords) {
        const lowerInput = input.toLowerCase();
        if (trigger.keywords.some((kw) => lowerInput.includes(kw.toLowerCase()))) {
          return true;
        }
      }

      // 正则触发
      if (trigger.pattern && trigger.pattern.test(input)) {
        return true;
      }

      // 上下文条件
      if (trigger.contextCondition && trigger.contextCondition(context)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取技能最高优先级
   */
  private getMaxPriority(skill: Skill): number {
    return Math.max(...skill.triggers.map((t) => t.priority || 0));
  }

  /**
   * 执行技能
   */
  async execute(input: string, context: SkillContext): Promise<SkillResult | null> {
    const skill = this.match(input, context);
    if (!skill) return null;

    const args = skill.parseArgs ? skill.parseArgs(input) : {};
    return skill.execute(context, args);
  }

  /**
   * 检查是否是技能命令
   */
  isSkillCommand(input: string): boolean {
    const commandMatch = input.match(/^\/(\S+)/);
    if (!commandMatch) return false;

    return this.skillsByCommand.has(commandMatch[1]);
  }

  /**
   * 获取帮助
   */
  getHelp(skillName?: string): string {
    if (skillName) {
      const skill = this.skills.get(skillName);
      if (skill) {
        return skill.formatHelp
          ? skill.formatHelp()
          : `/${skill.name} - ${skill.description}`;
      }
      return `Unknown skill: ${skillName}`;
    }

    // 返回所有技能
    let help = 'Available skills:\n\n';
    for (const skill of this.skills.values()) {
      help += `  /${skill.name} - ${skill.description}\n`;
    }
    help += '\nUse /help <skill-name> for more details.';
    return help;
  }

  /**
   * 获取技能数量
   */
  size(): number {
    return this.skills.size;
  }
}
