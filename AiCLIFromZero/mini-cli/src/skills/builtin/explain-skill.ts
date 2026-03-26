// src/skills/builtin/explain-skill.ts
// 代码解释技能

import { BaseSkill } from '../base-skill.js';
import { SkillContext, SkillResult } from '../types.js';
import { promises as fs } from 'fs';

/**
 * Explain 技能
 * 详细解释代码的功能和结构
 */
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

  examples = ['/explain src/index.ts', '/explain'];

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

    const response = await context.provider.chat([{ role: 'user', content: prompt }]);

    return {
      success: true,
      output: response.content,
    };
  }
}
