// src/skills/builtin/review-skill.ts
// 代码审查技能

import { BaseSkill } from '../base-skill.js';
import { SkillContext, SkillResult } from '../types.js';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Review 技能
 * 审查代码并提供改进建议
 */
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
          // 获取目录中的代码文件
          const { stdout } = await execAsync(
            `find ${args.file} -name "*.ts" -o -name "*.js" -o -name "*.py" | head -10`,
            { cwd: context.cwd }
          );
          const files = stdout.trim().split('\n').filter(Boolean);

          let allCode = '';
          for (const file of files.slice(0, 5)) {
            // 限制文件数量
            try {
              const content = await fs.readFile(file, 'utf-8');
              allCode += `\n\n// === ${file} ===\n${content.slice(0, 2000)}`;
            } catch {
              // 忽略读取错误
            }
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
${codeToReview.slice(0, 10000)}
\`\`\`

Focus on:
1. **Bugs**: Potential errors or edge cases
2. **Security**: Security vulnerabilities
3. **Performance**: Performance issues
4. **Style**: Code style and best practices
5. **Maintainability**: Code organization and readability

Format your response with clear sections and code examples where relevant.`;

    const response = await context.provider.chat([{ role: 'user', content: prompt }]);

    return {
      success: true,
      output: response.content,
    };
  }
}
