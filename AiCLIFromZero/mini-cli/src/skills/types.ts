// src/skills/types.ts
// 技能系统类型定义

/**
 * 技能触发器
 */
export interface SkillTrigger {
  // 命令触发（如 /commit）
  command?: string;

  // 关键词触发
  keywords?: string[];

  // 正则匹配
  pattern?: RegExp;

  // 上下文条件
  contextCondition?: (context: SkillContext) => boolean;

  // 优先级（数字越大优先级越高）
  priority?: number;
}

/**
 * Git 状态信息
 */
export interface SkillGitStatus {
  hasChanges: boolean;
  stagedFiles: string[];
  changedFiles: string[];
  currentBranch?: string;
}

/**
 * 技能上下文
 */
export interface SkillContext {
  // 用户输入
  input: string;

  // 当前工作目录
  cwd: string;

  // Git 状态
  gitStatus?: SkillGitStatus;

  // 会话历史
  sessionHistory?: Array<{ role: string; content: string }>;

  // 配置
  config: Record<string, any>;

  // AI Provider
  provider: {
    chat: (messages: Array<{ role: string; content: string }>) => Promise<{ content: string }>;
  };

  // 输出函数
  output: (text: string) => void;
}

/**
 * 技能结果
 */
export interface SkillResult {
  // 是否成功
  success: boolean;

  // 输出内容
  output: string;

  // 是否需要继续交互
  requiresInput?: boolean;

  // 后续动作
  nextAction?: () => Promise<SkillResult>;
}

/**
 * 技能参数定义
 */
export interface SkillParameter {
  name: string;
  description?: string;
  required?: boolean;
  default?: any;
}

/**
 * 技能定义
 */
export interface Skill {
  // 技能名称
  name: string;

  // 描述
  description: string;

  // 触发器
  triggers: SkillTrigger[];

  // 参数定义
  parameters?: SkillParameter[];

  // 处理函数
  execute: (context: SkillContext, args?: Record<string, any>) => Promise<SkillResult>;

  // 检查是否应该触发
  shouldTrigger?: (input: string, context: SkillContext) => boolean;

  // 解析参数
  parseArgs?: (input: string) => Record<string, any>;

  // 帮助信息
  help?: string;

  // 示例
  examples?: string[];

  // 格式化帮助信息
  formatHelp?: () => string;
}
