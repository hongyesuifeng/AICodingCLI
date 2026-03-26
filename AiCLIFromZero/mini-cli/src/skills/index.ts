// src/skills/index.ts
// 技能模块导出

// 类型导出
export * from './types.js';

// 基类
export { BaseSkill } from './base-skill.js';

// 注册表
export { SkillRegistry } from './skill-registry.js';

// 工厂函数
export { createDefaultSkillRegistry, registerCustomSkill } from './factory.js';

// 内置技能
export {
  CommitSkill,
  ExplainSkill,
  ReviewSkill,
  TestSkill,
  HelpSkill,
} from './builtin/index.js';
