// src/git/commit-generator.ts
// Commit 消息生成器

import { GitCommands } from './commands.js';
import { DiffParser, FileDiff } from './diff.js';
import { GitStatusParser, GitStatus } from './status.js';

/**
 * Commit 消息生成选项
 */
export interface CommitGeneratorOptions {
  // 最大 diff 长度
  maxDiffLength?: number;

  // 自定义提示词
  customPrompt?: string;

  // 是否包含未暂存的更改
  includeUnstaged?: boolean;
}

/**
 * AI Provider 接口
 */
export interface AIProvider {
  chat(messages: Array<{ role: string; content: string }>): Promise<{ content: string }>;
}

/**
 * Commit 消息生成器
 */
export class CommitMessageGenerator {
  private commands: GitCommands;
  private statusParser: GitStatusParser;
  private diffParser: DiffParser;

  constructor(private provider: AIProvider, cwd?: string) {
    this.commands = new GitCommands(cwd);
    this.statusParser = new GitStatusParser(cwd);
    this.diffParser = new DiffParser(cwd);
  }

  /**
   * 生成 Commit 消息
   */
  async generate(options: CommitGeneratorOptions = {}): Promise<string> {
    const { maxDiffLength = 5000, customPrompt } = options;

    // 获取状态
    const status = await this.statusParser.getStatus();

    if (status.staged.length === 0) {
      throw new Error('No staged changes. Use `git add` to stage changes first.');
    }

    // 获取 Diff
    const diffs = await this.diffParser.getDiff({ staged: true });

    // 构建 Diff 文本
    let diffText = this.formatDiffsForPrompt(diffs);

    // 截断过长的 Diff
    if (diffText.length > maxDiffLength) {
      diffText = diffText.slice(0, maxDiffLength) + '\n... (truncated)';
    }

    // 构建提示词
    const prompt = customPrompt || this.getDefaultPrompt(status, diffText);

    // 调用 AI
    const response = await this.provider.chat([{ role: 'user', content: prompt }]);

    return this.cleanCommitMessage(response.content);
  }

  /**
   * 获取默认提示词
   */
  private getDefaultPrompt(status: GitStatus, diffText: string): string {
    const files = status.staged.map((f) => f.path).join(', ');

    return `Generate a Git commit message for the following changes.

Changed files: ${files}

Diff:
\`\`\`diff
${diffText}
\`\`\`

Requirements:
1. Use conventional commit format (type: description)
2. Types: feat, fix, docs, style, refactor, test, chore
3. Keep the description under 72 characters
4. Use imperative mood (e.g., "add" not "added")
5. Don't include the diff in the message

Respond with only the commit message.`;
  }

  /**
   * 格式化 Diff 用于提示
   */
  private formatDiffsForPrompt(diffs: FileDiff[]): string {
    const parts: string[] = [];

    for (const diff of diffs) {
      parts.push(`--- ${diff.oldPath}`);
      parts.push(`+++ ${diff.newPath}`);

      for (const hunk of diff.hunks) {
        parts.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);

        for (const line of hunk.lines) {
          if (line.type === 'add') {
            parts.push(`+${line.content}`);
          } else if (line.type === 'delete') {
            parts.push(`-${line.content}`);
          }
        }
      }
    }

    return parts.join('\n');
  }

  /**
   * 清理生成的消息
   */
  private cleanCommitMessage(message: string): string {
    // 移除代码块标记
    let cleaned = message.replace(/```.*?\n?/g, '');

    // 移除前后空白
    cleaned = cleaned.trim();

    // 移除可能的引号
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }

    // 限制长度
    const lines = cleaned.split('\n');
    if (lines.length > 1) {
      // 只保留第一行作为标题
      cleaned = lines[0];
    }

    return cleaned;
  }

  /**
   * 提交更改
   */
  async commit(message: string, options: { noVerify?: boolean } = {}): Promise<string> {
    const result = await this.commands.commit(message, options);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to commit: ${result.stderr}`);
    }

    return result.stdout;
  }

  /**
   * 生成并提交
   */
  async generateAndCommit(options: CommitGeneratorOptions & { noVerify?: boolean } = {}): Promise<string> {
    const { noVerify, ...genOptions } = options;
    const message = await this.generate(genOptions);
    return this.commit(message, { noVerify });
  }
}
