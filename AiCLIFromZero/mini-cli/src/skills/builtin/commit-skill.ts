// src/skills/builtin/commit-skill.ts
// Git Commit 技能

import { BaseSkill } from '../base-skill.js';
import { SkillContext, SkillResult } from '../types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Commit 技能
 * 分析暂存的更改并生成 conventional commit 消息
 */
export class CommitSkill extends BaseSkill {
  name = 'commit';
  description = 'Generate a Git commit message from staged changes';
  help = 'Analyzes staged changes and generates a conventional commit message';

  triggers = [
    { command: 'commit', priority: 100 },
    { keywords: ['commit', '提交'], priority: 50 },
  ];

  examples = ['/commit', '/commit --amend', '/commit "fix: bug fix"'];

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

Types: feat, fix, docs, style, refactor, test, chore

Diff:
\`\`\`diff
${diff.slice(0, 5000)}
\`\`\`

Respond with only the commit message, no explanation.`;

      const response = await context.provider.chat([
        { role: 'user', content: prompt },
      ]);

      const commitMessage = response.content.trim();

      return {
        success: true,
        output: `Suggested commit message:\n\n  ${commitMessage}\n\nUse 'git commit -m "message"' to apply.`,
        requiresInput: true,
        nextAction: async () => {
          const { stdout } = await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
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
