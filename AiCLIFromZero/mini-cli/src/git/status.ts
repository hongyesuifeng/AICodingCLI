// src/git/status.ts
// Git 状态解析

import { GitCommands } from './commands.js';

/**
 * 文件状态
 */
export type FileStatus =
  | 'added' // 新增 (A)
  | 'modified' // 修改 (M)
  | 'deleted' // 删除 (D)
  | 'renamed' // 重命名 (R)
  | 'copied' // 复制 (C)
  | 'unmerged' // 未合并 (U)
  | 'untracked' // 未跟踪 (??)
  | 'ignored'; // 忽略 (!!)

/**
 * 文件状态信息
 */
export interface FileStatusInfo {
  path: string;
  status: FileStatus;
  staged: boolean; // 是否已暂存
  oldPath?: string; // 重命名时的旧路径
}

/**
 * Git 状态信息
 */
export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: FileStatusInfo[];
  unstaged: FileStatusInfo[];
  untracked: FileStatusInfo[];
  conflicts: FileStatusInfo[];
  isClean: boolean;
}

/**
 * Git 状态解析器
 */
export class GitStatusParser {
  private commands: GitCommands;

  constructor(cwd?: string) {
    this.commands = new GitCommands(cwd);
  }

  /**
   * 获取完整状态
   */
  async getStatus(): Promise<GitStatus> {
    const result = await this.commands.status({ short: true, branch: true });

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get git status: ${result.stderr}`);
    }

    return this.parseStatus(result.stdout);
  }

  /**
   * 解析 git status 输出
   */
  private parseStatus(output: string): GitStatus {
    const lines = output.split('\n').filter(Boolean);

    // 第一行是分支信息
    const branchLine = lines[0];
    const { branch, ahead, behind } = this.parseBranchLine(branchLine);

    const staged: FileStatusInfo[] = [];
    const unstaged: FileStatusInfo[] = [];
    const untracked: FileStatusInfo[] = [];
    const conflicts: FileStatusInfo[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const info = this.parseStatusLine(line);

      if (!info) continue;

      if (info.status === 'untracked') {
        untracked.push(info);
      } else if (info.status === 'unmerged') {
        conflicts.push(info);
      } else {
        if (info.staged) {
          staged.push(info);
        } else {
          unstaged.push(info);
        }
      }
    }

    const isClean = staged.length === 0 && unstaged.length === 0 && untracked.length === 0;

    return {
      branch,
      ahead,
      behind,
      staged,
      unstaged,
      untracked,
      conflicts,
      isClean,
    };
  }

  /**
   * 解析分支行
   */
  private parseBranchLine(line: string): { branch: string; ahead: number; behind: number } {
    // ## main...origin/main [ahead 1, behind 2]
    const branchMatch = line.match(/^## (.+?)(?:\.\.\.(.+?))?(?:\s+\[.*?\])?$/);

    if (!branchMatch) {
      return { branch: line.replace('## ', ''), ahead: 0, behind: 0 };
    }

    const branch = branchMatch[1];
    let ahead = 0;
    let behind = 0;

    const aheadMatch = line.match(/ahead (\d+)/);
    const behindMatch = line.match(/behind (\d+)/);

    if (aheadMatch) ahead = parseInt(aheadMatch[1]);
    if (behindMatch) behind = parseInt(behindMatch[1]);

    return { branch, ahead, behind };
  }

  /**
   * 解析状态行
   */
  private parseStatusLine(line: string): FileStatusInfo | null {
    // XY PATH
    // X 表示暂存区状态，Y 表示工作区状态
    if (line.length < 4) return null;

    const x = line[0];
    const y = line[1];
    const path = line.substring(3);

    // 判断状态
    let status: FileStatus;
    let staged = false;

    if (x === '?' && y === '?') {
      status = 'untracked';
    } else if (x === '!' && y === '!') {
      status = 'ignored';
    } else if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) {
      status = 'unmerged';
    } else {
      // 检查暂存状态
      staged = x !== ' ' && x !== '?';

      // 确定文件状态
      if (x === 'A' || y === 'A') {
        status = 'added';
      } else if (x === 'D' || y === 'D') {
        status = 'deleted';
      } else if (x === 'R' || y === 'R') {
        status = 'renamed';
      } else if (x === 'C' || y === 'C') {
        status = 'copied';
      } else {
        status = 'modified';
      }
    }

    return { path, status, staged };
  }

  /**
   * 检查是否有未提交的更改
   */
  async hasChanges(): Promise<boolean> {
    const status = await this.getStatus();
    return !status.isClean;
  }

  /**
   * 获取暂存的文件
   */
  async getStagedFiles(): Promise<string[]> {
    const status = await this.getStatus();
    return status.staged.map((f) => f.path);
  }

  /**
   * 获取所有更改的文件
   */
  async getChangedFiles(): Promise<string[]> {
    const status = await this.getStatus();
    return [...status.staged, ...status.unstaged, ...status.untracked].map((f) => f.path);
  }

  /**
   * 格式化状态为字符串
   */
  formatStatus(status: GitStatus): string {
    const lines: string[] = [];

    lines.push(`On branch ${status.branch}`);

    if (status.ahead > 0 || status.behind > 0) {
      const parts: string[] = [];
      if (status.ahead > 0) parts.push(`ahead ${status.ahead}`);
      if (status.behind > 0) parts.push(`behind ${status.behind}`);
      lines.push(`Your branch is ${parts.join(' and ')} of origin/${status.branch}.`);
    }

    if (status.isClean) {
      lines.push('nothing to commit, working tree clean');
      return lines.join('\n');
    }

    if (status.staged.length > 0) {
      lines.push('\nChanges to be committed:');
      for (const file of status.staged) {
        lines.push(`  ${this.getStatusLabel(file.status)}: ${file.path}`);
      }
    }

    if (status.unstaged.length > 0) {
      lines.push('\nChanges not staged for commit:');
      for (const file of status.unstaged) {
        lines.push(`  ${this.getStatusLabel(file.status)}: ${file.path}`);
      }
    }

    if (status.untracked.length > 0) {
      lines.push('\nUntracked files:');
      for (const file of status.untracked) {
        lines.push(`  ${file.path}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 获取状态标签
   */
  private getStatusLabel(status: FileStatus): string {
    const labels: Record<FileStatus, string> = {
      added: 'new file',
      modified: 'modified',
      deleted: 'deleted',
      renamed: 'renamed',
      copied: 'copied',
      unmerged: 'unmerged',
      untracked: 'untracked',
      ignored: 'ignored',
    };
    return labels[status];
  }
}
