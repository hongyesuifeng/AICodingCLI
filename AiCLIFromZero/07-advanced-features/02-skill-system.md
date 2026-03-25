# 7.2 技能系统 (Skills)

## 学习目标

理解技能定义和触发器设计，掌握技能注册和内置技能的实现。

## 1. 技能系统概述

### 1.1 什么是技能？

技能（Skill）是 AI CLI 中的高级功能单元，它封装了特定的能力和工作流程：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          技能系统架构                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   用户输入 ──▶ [触发器检测] ──▶ [技能匹配] ──▶ [技能执行] ──▶ 结果输出        │
│                     │              │              │                         │
│                     ▼              ▼              ▼                         │
│               ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│               │ 关键词    │  │ 技能注册表 │  │ 技能处理器 │                     │
│               │ 模式匹配  │  │ 优先级    │  │ 工具调用   │                     │
│               │ 上下文    │  │ 条件检查  │  │ AI 交互   │                     │
│               └──────────┘  └──────────┘  └──────────┘                     │
│                                                                             │
│   内置技能示例：                                                             │
│   • /commit - 生成 Git commit 消息                                          │
│   • /review - 代码审查                                                       │
│   • /explain - 解释代码                                                      │
│   • /test - 生成测试                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 技能 vs 工具

| 特性 | 工具 (Tool) | 技能 (Skill) |
|------|-------------|--------------|
| 调用方式 | AI 决定调用 | 用户触发或自动检测 |
| 复杂度 | 单一功能 | 可包含多个工具调用 |
| 交互性 | 一次性调用 | 可能多轮交互 |
| 目的 | 提供 AI 能力 | 完成特定任务 |

## 2. 技能定义

### 2.1 技能接口

```typescript
// src/skills/types.ts

// 技能触发器
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

// 技能上下文
export interface SkillContext {
  // 用户输入
  input: string;

  // 当前工作目录
  cwd: string;

  // Git 状态
  gitStatus?: {
    hasChanges: boolean;
    stagedFiles: string[];
    changedFiles: string[];
  };

  // 会话历史
  sessionHistory?: any[];

  // 配置
  config: Record<string, any>;

  // AI Provider
  provider: any;
}

// 技能结果
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

// 技能定义
export interface Skill {
  // 技能名称
  name: string;

  // 描述
  description: string;

  // 触发器
  triggers: SkillTrigger[];

  // 参数定义
  parameters?: {
    name: string;
    description?: string;
    required?: boolean;
    default?: any;
  }[];

  // 处理函数
  execute: (context: SkillContext, args?: Record<string, any>) => Promise<SkillResult>;

  // 帮助信息
  help?: string;

  // 示例
  examples?: string[];
}
```

### 2.2 技能基类

```typescript
// src/skills/base-skill.ts
import { Skill, SkillContext, SkillResult, SkillTrigger } from './types.js';

// 技能基类
export abstract class BaseSkill implements Skill {
  abstract name: string;
  abstract description: string;
  abstract triggers: SkillTrigger[];
  abstract execute(context: SkillContext, args?: Record<string, any>): Promise<SkillResult>;

  help?: string;
  parameters?: Skill['parameters'];
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
        if (trigger.keywords.some(kw => lowerInput.includes(kw.toLowerCase()))) {
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
}
```

## 3. 技能注册表

### 3.1 技能管理器

```typescript
// src/skills/skill-registry.ts
import { Skill, SkillContext, SkillResult } from './types.js';

// 技能注册表
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
      if (skill.shouldTrigger(input, context)) {
        const priority = Math.max(
          ...skill.triggers.map(t => t.priority || 0)
        );
        matchedSkills.push({ skill, priority });
      }
    }

    // 按优先级排序
    matchedSkills.sort((a, b) => b.priority - a.priority);

    return matchedSkills[0]?.skill || null;
  }

  /**
   * 执行技能
   */
  async execute(
    input: string,
    context: SkillContext
  ): Promise<SkillResult | null> {
    const skill = this.match(input, context);
    if (!skill) return null;

    const args = skill.parseArgs ? skill.parseArgs(input) : {};
    return skill.execute(context, args);
  }

  /**
   * 获取帮助
   */
  getHelp(skillName?: string): string {
    if (skillName) {
      const skill = this.skills.get(skillName);
      if (skill) {
        return skill.formatHelp ? skill.formatHelp() : `/${skill.name} - ${skill.description}`;
      }
      return `Unknown skill: ${skillName}`;
    }

    // 返回所有技能
    let help = 'Available skills:\n\n';
    for (const skill of this.skills.values()) {
      help += `  /${skill.name} - ${skill.description}\n`;
    }
    return help;
  }
}
```

## 4. 内置技能实现

### 4.1 Commit 技能

```typescript
// src/skills/builtin/commit-skill.ts
import { BaseSkill, SkillContext, SkillResult } from '../base-skill.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class CommitSkill extends BaseSkill {
  name = 'commit';
  description = 'Generate a Git commit message from staged changes';
  help = 'Analyzes staged changes and generates a conventional commit message';

  triggers = [
    { command: 'commit', priority: 100 },
    { keywords: ['commit', '提交'], priority: 50 },
  ];

  examples = [
    '/commit',
    '/commit --amend',
    '/commit "fix: bug fix"',
  ];

  async execute(context: SkillContext): Promise<SkillResult> {
    try {
      // 检查是否在 Git 仓库中
      await execAsync('git rev-parse --git-dir', { cwd: context.cwd });

      // 获取暂存的更改
      const { stdout: diff } = await execAsync('git diff --cached', {
        cwd: context.cwd,
      });

      if (!diff.trim()) {
        return {
          success: false,
          output: 'No staged changes found. Use `git add` to stage changes first.',
        };
      }

      // 使用 AI 生成 commit 消息
      const prompt = `Generate a concise Git commit message for the following changes. Use conventional commit format (type: description).

Diff:
\`\`\`diff
${diff}
\`\`\`

Respond with only the commit message, no explanation.`;

      const response = await context.provider.chat([
        { role: 'user', content: prompt },
      ]);

      const commitMessage = response.content.trim();

      return {
        success: true,
        output: `Suggested commit message:\n\n  ${commitMessage}\n\nUse /commit-apply to apply this message.`,
        requiresInput: true,
        nextAction: async () => {
          const { stdout } = await execAsync(`git commit -m "${commitMessage}"`, {
            cwd: context.cwd,
          });
          return { success: true, output: stdout };
        },
      };
    } catch (error: any) {
      return {
        success: false,
        output: `Error: ${error.message}`,
      };
    }
  }
}
```

### 4.2 Explain 技能

```typescript
// src/skills/builtin/explain-skill.ts
import { BaseSkill, SkillContext, SkillResult } from '../base-skill.js';
import { promises as fs } from 'fs';

export class ExplainSkill extends BaseSkill {
  name = 'explain';
  description = 'Explain code in detail';

  triggers = [
    { command: 'explain', priority: 100 },
    { keywords: ['explain', '解释', '说明'], priority: 50 },
  ];

  parameters = [
    {
      name: 'file',
      description: 'File path to explain',
      required: false,
    },
  ];

  examples = [
    '/explain src/index.ts',
    '/explain',
  ];

  async execute(context: SkillContext, args?: Record<string, any>): Promise<SkillResult> {
    let code: string;
    let fileName: string;

    if (args?.file) {
      // 解释指定文件
      fileName = args.file;
      try {
        code = await fs.readFile(fileName, 'utf-8');
      } catch (error: any) {
        return {
          success: false,
          output: `Failed to read file: ${error.message}`,
        };
      }
    } else {
      // 解释最近的代码片段（从上下文获取）
      const lastMessage = context.sessionHistory?.slice(-1)[0];
      if (!lastMessage?.content) {
        return {
          success: false,
          output: 'No code to explain. Provide a file path or paste code first.',
        };
      }
      code = lastMessage.content;
      fileName = 'provided code';
    }

    const prompt = `Please explain the following code in detail:

File: ${fileName}

\`\`\`
${code}
\`\`\`

Provide:
1. A summary of what the code does
2. Key functions/classes and their purposes
3. Important logic or algorithms
4. Any potential issues or improvements`;

    const response = await context.provider.chat([
      { role: 'user', content: prompt },
    ]);

    return {
      success: true,
      output: response.content,
    };
  }
}
```

### 4.3 Review 技能

```typescript
// src/skills/builtin/review-skill.ts
import { BaseSkill, SkillContext, SkillResult } from '../base-skill.js';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ReviewSkill extends BaseSkill {
  name = 'review';
  description = 'Review code for issues and improvements';

  triggers = [
    { command: 'review', priority: 100 },
    { command: 'code-review', priority: 100 },
    { keywords: ['review', '审查', '检查'], priority: 50 },
  ];

  parameters = [
    {
      name: 'file',
      description: 'File or directory to review',
      required: false,
    },
  ];

  async execute(context: SkillContext, args?: Record<string, any>): Promise<SkillResult> {
    let codeToReview: string;
    let targetName: string;

    if (args?.file) {
      // 审查指定文件
      try {
        const stat = await fs.stat(args.file);
        if (stat.isDirectory()) {
          // 获取目录中的所有代码文件
          const { stdout } = await execAsync(
            `find ${args.file} -name "*.ts" -o -name "*.js" -o -name "*.py" | head -20`,
            { cwd: context.cwd }
          );
          const files = stdout.trim().split('\n').filter(Boolean);

          let allCode = '';
          for (const file of files) {
            const content = await fs.readFile(file, 'utf-8');
            allCode += `\n\n// === ${file} ===\n${content}`;
          }

          codeToReview = allCode;
          targetName = `directory: ${args.file}`;
        } else {
          codeToReview = await fs.readFile(args.file, 'utf-8');
          targetName = args.file;
        }
      } catch (error: any) {
        return {
          success: false,
          output: `Failed to read: ${error.message}`,
        };
      }
    } else {
      // 审查最近的更改（Git diff）
      try {
        const { stdout } = await execAsync('git diff HEAD', {
          cwd: context.cwd,
        });
        if (!stdout.trim()) {
          return {
            success: false,
            output: 'No changes to review. Specify a file or make some changes first.',
          };
        }
        codeToReview = stdout;
        targetName = 'recent changes';
      } catch {
        return {
          success: false,
          output: 'Not in a Git repository. Specify a file to review.',
        };
      }
    }

    const prompt = `Please review the following code and provide feedback:

Target: ${targetName}

\`\`\`
${codeToReview.slice(0, 10000)} // Limit size
\`\`\`

Focus on:
1. **Bugs**: Potential errors or edge cases
2. **Security**: Security vulnerabilities
3. **Performance**: Performance issues
4. **Style**: Code style and best practices
5. **Maintainability**: Code organization and readability

Format your response with clear sections and code examples where relevant.`;

    const response = await context.provider.chat([
      { role: 'user', content: prompt },
    ]);

    return {
      success: true,
      output: response.content,
    };
  }
}
```

### 4.4 Test 技能

```typescript
// src/skills/builtin/test-skill.ts
import { BaseSkill, SkillContext, SkillResult } from '../base-skill.js';
import { promises as fs } from 'fs';

export class TestSkill extends BaseSkill {
  name = 'test';
  description = 'Generate unit tests for code';

  triggers = [
    { command: 'test', priority: 100 },
    { command: 'gen-test', priority: 100 },
    { keywords: ['generate test', '写测试', '生成测试'], priority: 50 },
  ];

  parameters = [
    {
      name: 'file',
      description: 'File to generate tests for',
      required: true,
    },
    {
      name: 'framework',
      description: 'Test framework (jest, vitest, mocha)',
      required: false,
      default: 'jest',
    },
  ];

  examples = [
    '/test src/utils.ts',
    '/test src/utils.ts --framework vitest',
  ];

  async execute(context: SkillContext, args?: Record<string, any>): Promise<SkillResult> {
    const file = args?.file;
    const framework = args?.framework || 'jest';

    if (!file) {
      return {
        success: false,
        output: 'Please specify a file to generate tests for.',
      };
    }

    let code: string;
    try {
      code = await fs.readFile(file, 'utf-8');
    } catch (error: any) {
      return {
        success: false,
        output: `Failed to read file: ${error.message}`,
      };
    }

    const prompt = `Generate comprehensive unit tests for the following code using ${framework}.

File: ${file}

\`\`\`typescript
${code}
\`\`\`

Requirements:
1. Test all exported functions
2. Include edge cases
3. Use descriptive test names
4. Include both positive and negative tests
5. Mock external dependencies if needed

Output only the test file content, ready to save.`;

    const response = await context.provider.chat([
      { role: 'user', content: prompt },
    ]);

    // 提取代码块
    const codeMatch = response.content.match(/```(?:typescript|javascript)?\s*([\s\S]*?)```/);
    const testCode = codeMatch ? codeMatch[1].trim() : response.content;

    // 确定测试文件路径
    const testFile = file.replace(/\.(ts|js)$/, '.test.$1');

    return {
      success: true,
      output: `Generated tests for ${file}:\n\n${testCode}\n\nSave to: ${testFile}`,
      requiresInput: true,
      nextAction: async () => {
        await fs.writeFile(testFile, testCode, 'utf-8');
        return {
          success: true,
          output: `Test file created: ${testFile}`,
        };
      },
    };
  }
}
```

## 5. 技能工厂

```typescript
// src/skills/skill-factory.ts
import { SkillRegistry } from './skill-registry.js';
import { CommitSkill } from './builtin/commit-skill.js';
import { ExplainSkill } from './builtin/explain-skill.js';
import { ReviewSkill } from './builtin/review-skill.js';
import { TestSkill } from './builtin/test-skill.js';

// 创建默认技能注册表
export function createDefaultSkillRegistry(): SkillRegistry {
  const registry = new SkillRegistry();

  // 注册内置技能
  registry.registerAll([
    new CommitSkill(),
    new ExplainSkill(),
    new ReviewSkill(),
    new TestSkill(),
  ]);

  return registry;
}
```

## 参数说明

### Skill 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✓ | 技能名称 |
| `description` | string | ✓ | 描述 |
| `triggers` | SkillTrigger[] | ✓ | 触发器列表 |
| `parameters` | object[] | - | 参数定义 |
| `execute` | function | ✓ | 执行函数 |
| `help` | string | - | 帮助信息 |
| `examples` | string[] | - | 示例 |

### SkillTrigger 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `command` | string | 命令触发 |
| `keywords` | string[] | 关键词触发 |
| `pattern` | RegExp | 正则匹配 |
| `contextCondition` | function | 上下文条件 |
| `priority` | number | 优先级 |

### SkillResult 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | boolean | 是否成功 |
| `output` | string | 输出内容 |
| `requiresInput` | boolean | 是否需要输入 |
| `nextAction` | function | 后续动作 |

## 练习题

### 练习 1: 实现重构技能

```typescript
// exercises/01-refactor-skill.ts
// TODO: 实现代码重构技能
// 要求：
// 1. 支持指定重构类型
// 2. 生成重构建议
// 3. 可选自动应用

export class RefactorSkill extends BaseSkill {
  // TODO: 实现
}
```

### 练习 2: 实现文档生成技能

```typescript
// exercises/02-docs-skill.ts
// TODO: 实现文档生成技能
// 要求：
// 1. 生成 API 文档
// 2. 支持 JSDoc 格式
// 3. 生成 README

export class DocsSkill extends BaseSkill {
  // TODO: 实现
}
```

### 练习 3: 实现调试技能

```typescript
// exercises/03-debug-skill.ts
// TODO: 实现调试辅助技能
// 要求：
// 1. 分析错误信息
// 2. 提供修复建议
// 3. 可选自动修复

export class DebugSkill extends BaseSkill {
  // TODO: 实现
}
```

### 练习 4: 实现技能组合

```typescript
// exercises/04-composite-skill.ts
// TODO: 实现组合技能
// 要求：
// 1. 组合多个技能
// 2. 定义执行顺序
// 3. 共享中间结果

export class CompositeSkill extends BaseSkill {
  // TODO: 实现
}
```

## 下一步

完成本节后，继续学习 [7.3 钩子系统 (Hooks)](./03-hook-system.md) →
