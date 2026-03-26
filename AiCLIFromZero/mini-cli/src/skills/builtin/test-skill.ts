// src/skills/builtin/test-skill.ts
// 测试生成技能

import { BaseSkill } from '../base-skill.js';
import { SkillContext, SkillResult } from '../types.js';
import { promises as fs } from 'fs';

/**
 * Test 技能
 * 为代码生成单元测试
 */
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

  examples = ['/test src/utils.ts', '/test src/utils.ts --framework vitest'];

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

    const response = await context.provider.chat([{ role: 'user', content: prompt }]);

    // 提取代码块
    const codeMatch = response.content.match(/```(?:typescript|javascript)?\s*([\s\S]*?)```/);
    const testCode = codeMatch ? codeMatch[1].trim() : response.content;

    // 确定测试文件路径
    const testFile = file.replace(/\.(ts|js)$/, '.test.$1');

    return {
      success: true,
      output: `Generated tests for ${file}:\n\n${testCode}\n\nSuggested save path: ${testFile}`,
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
