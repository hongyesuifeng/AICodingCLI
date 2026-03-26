// src/skills/factory.ts
// 技能工厂

import { SkillRegistry } from './skill-registry.js';
import { CommitSkill } from './builtin/commit-skill.js';
import { ExplainSkill } from './builtin/explain-skill.js';
import { ReviewSkill } from './builtin/review-skill.js';
import { TestSkill } from './builtin/test-skill.js';
import { HelpSkill } from './builtin/help-skill.js';

/**
 * 创建默认技能注册表
 */
export function createDefaultSkillRegistry(): SkillRegistry {
  const registry = new SkillRegistry();

  // 注册内置技能
  registry.registerAll([
    new CommitSkill(),
    new ExplainSkill(),
    new ReviewSkill(),
    new TestSkill(),
  ]);

  // Help 技能需要注册表引用
  registry.register(new HelpSkill(registry));

  return registry;
}

/**
 * 注册自定义技能
 */
export function registerCustomSkill(registry: SkillRegistry, skill: any): void {
  registry.register(skill);
}

// 导出所有内置技能
export { CommitSkill } from './builtin/commit-skill.js';
export { ExplainSkill } from './builtin/explain-skill.js';
export { ReviewSkill } from './builtin/review-skill.js';
export { TestSkill } from './builtin/test-skill.js';
export { HelpSkill } from './builtin/help-skill.js';
