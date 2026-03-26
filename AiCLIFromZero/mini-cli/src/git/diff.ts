// src/git/diff.ts
// Git Diff 解析

import { GitCommands } from './commands.js';

/**
 * Diff 行
 */
export interface DiffLine {
  type: 'context' | 'add' | 'delete';
  content: string;
  oldNumber?: number;
  newNumber?: number;
}

/**
 * Diff 块
 */
export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

/**
 * 文件 Diff
 */
export interface FileDiff {
  oldPath: string;
  newPath: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

/**
 * Diff 解析器
 */
export class DiffParser {
  private commands: GitCommands;

  constructor(cwd?: string) {
    this.commands = new GitCommands(cwd);
  }

  /**
   * 获取 Diff
   */
  async getDiff(options: { staged?: boolean; file?: string } = {}): Promise<FileDiff[]> {
    const result = await this.commands.diff(options);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get diff: ${result.stderr}`);
    }

    return this.parseDiff(result.stdout);
  }

  /**
   * 解析 Diff 输出
   */
  private parseDiff(diff: string): FileDiff[] {
    const files: FileDiff[] = [];
    const fileDiffs = diff.split(/^diff --git /m).filter(Boolean);

    for (const fileDiff of fileDiffs) {
      const parsed = this.parseFileDiff(fileDiff);
      if (parsed) {
        files.push(parsed);
      }
    }

    return files;
  }

  /**
   * 解析单个文件 Diff
   */
  private parseFileDiff(diff: string): FileDiff | null {
    const lines = diff.split('\n');

    // 解析文件路径
    const headerMatch = lines[0]?.match(/^a\/(.+) b\/(.+)$/);
    if (!headerMatch) return null;

    const oldPath = headerMatch[1];
    const newPath = headerMatch[2];

    // 找到所有 hunk
    const hunks: DiffHunk[] = [];
    let currentHunk: DiffHunk | null = null;
    let oldLine = 0;
    let newLine = 0;

    for (const line of lines) {
      // Hunk 头部: @@ -oldStart,oldLines +newStart,newLines @@ ...
      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);

      if (hunkMatch) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }

        currentHunk = {
          oldStart: parseInt(hunkMatch[1]),
          oldLines: parseInt(hunkMatch[2] || '1'),
          newStart: parseInt(hunkMatch[3]),
          newLines: parseInt(hunkMatch[4] || '1'),
          lines: [],
        };

        oldLine = currentHunk.oldStart;
        newLine = currentHunk.newStart;
        continue;
      }

      if (!currentHunk) continue;

      if (line.startsWith('+')) {
        currentHunk.lines.push({
          type: 'add',
          content: line.substring(1),
          newNumber: newLine++,
        });
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({
          type: 'delete',
          content: line.substring(1),
          oldNumber: oldLine++,
        });
      } else if (line.startsWith(' ')) {
        currentHunk.lines.push({
          type: 'context',
          content: line.substring(1),
          oldNumber: oldLine++,
          newNumber: newLine++,
        });
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    // 统计增删行数
    const additions = hunks.reduce((sum, h) => sum + h.lines.filter((l) => l.type === 'add').length, 0);
    const deletions = hunks.reduce((sum, h) => sum + h.lines.filter((l) => l.type === 'delete').length, 0);

    return {
      oldPath,
      newPath,
      hunks,
      additions,
      deletions,
    };
  }

  /**
   * 生成 Diff 摘要
   */
  getDiffSummary(diffs: FileDiff[]): string {
    const summary: string[] = [];

    for (const diff of diffs) {
      const changes = diff.additions + diff.deletions;
      summary.push(`${diff.newPath}: +${diff.additions} -${diff.deletions} (${changes} changes)`);
    }

    return summary.join('\n');
  }

  /**
   * 格式化 Diff 为字符串
   */
  formatDiff(diffs: FileDiff[]): string {
    const output: string[] = [];

    for (const diff of diffs) {
      output.push(`diff --git a/${diff.oldPath} b/${diff.newPath}`);
      output.push(`--- a/${diff.oldPath}`);
      output.push(`+++ b/${diff.newPath}`);

      for (const hunk of diff.hunks) {
        output.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`);

        for (const line of hunk.lines) {
          if (line.type === 'add') {
            output.push(`+${line.content}`);
          } else if (line.type === 'delete') {
            output.push(`-${line.content}`);
          } else {
            output.push(` ${line.content}`);
          }
        }
      }
    }

    return output.join('\n');
  }

  /**
   * 统计总变更
   */
  getTotalChanges(diffs: FileDiff[]): { files: number; additions: number; deletions: number } {
    return {
      files: diffs.length,
      additions: diffs.reduce((sum, d) => sum + d.additions, 0),
      deletions: diffs.reduce((sum, d) => sum + d.deletions, 0),
    };
  }
}
