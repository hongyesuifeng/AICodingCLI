# 7.4 Git 集成

## 学习目标

掌握 Git 命令封装、diff 解析、状态检测和自动 commit 生成的实现。

## 1. Git 命令封装

### 1.1 Git 执行器

```typescript
// src/git/executor.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Git 执行选项
export interface GitExecOptions {
  cwd?: string;
  encoding?: BufferEncoding;
  maxBuffer?: number;
  timeout?: number;
}

// Git 执行结果
export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// Git 执行器
export class GitExecutor {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * 执行 Git 命令
   */
  async exec(
    args: string,
    options: GitExecOptions = {}
  ): Promise<GitExecResult> {
    const { cwd = this.cwd, encoding = 'utf-8', maxBuffer = 1024 * 1024, timeout = 30000 } = options;

    try {
      const { stdout, stderr } = await execAsync(`git ${args}`, {
        cwd,
        encoding,
        maxBuffer,
        timeout,
      });

      return {
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: 0,
      };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1,
      };
    }
  }

  /**
   * 检查是否在 Git 仓库中
   */
  async isRepo(): Promise<boolean> {
    const result = await this.exec('rev-parse --git-dir');
    return result.exitCode === 0;
  }

  /**
   * 获取当前分支
   */
  async getCurrentBranch(): Promise<string> {
    const result = await this.exec('rev-parse --abbrev-ref HEAD');
    return result.exitCode === 0 ? result.stdout.trim() : '';
  }

  /**
   * 获取远程仓库 URL
   */
  async getRemoteUrl(remote: string = 'origin'): Promise<string> {
    const result = await this.exec(`remote get-url ${remote}`);
    return result.exitCode === 0 ? result.stdout.trim() : '';
  }
}
```

### 1.2 Git 命令封装

```typescript
// src/git/commands.ts
import { GitExecutor, GitExecResult } from './executor.js';

// Git 命令封装
export class GitCommands {
  private executor: GitExecutor;

  constructor(cwd?: string) {
    this.executor = new GitExecutor(cwd);
  }

  // ==================== 基础命令 ====================

  /**
   * git init
   */
  async init(): Promise<GitExecResult> {
    return this.executor.exec('init');
  }

  /**
   * git clone
   */
  async clone(url: string, directory?: string): Promise<GitExecResult> {
    const dir = directory ? ` ${directory}` : '';
    return this.executor.exec(`clone ${url}${dir}`);
  }

  /**
   * git status
   */
  async status(options: { short?: boolean; branch?: boolean } = {}): Promise<GitExecResult> {
    const flags = [];
    if (options.short) flags.push('-s');
    if (options.branch) flags.push('-b');
    return this.executor.exec(`status ${flags.join(' ')}`);
  }

  /**
   * git add
   */
  async add(files: string | string[]): Promise<GitExecResult> {
    const filesStr = Array.isArray(files) ? files.join(' ') : files;
    return this.executor.exec(`add ${filesStr}`);
  }

  /**
   * git commit
   */
  async commit(message: string, options: { amend?: boolean; noVerify?: boolean } = {}): Promise<GitExecResult> {
    const flags = [];
    if (options.amend) flags.push('--amend');
    if (options.noVerify) flags.push('--no-verify');
    const escapedMessage = message.replace(/"/g, '\\"');
    return this.executor.exec(`commit ${flags.join(' ')} -m "${escapedMessage}"`);
  }

  /**
   * git push
   */
  async push(options: { remote?: string; branch?: string; force?: boolean; setUpstream?: boolean } = {}): Promise<GitExecResult> {
    const flags = [];
    if (options.force) flags.push('--force');
    if (options.setUpstream) flags.push('-u');

    const remote = options.remote || 'origin';
    const branch = options.branch || '';

    return this.executor.exec(`push ${flags.join(' ')} ${remote} ${branch}`);
  }

  /**
   * git pull
   */
  async pull(options: { remote?: string; branch?: string; rebase?: boolean } = {}): Promise<GitExecResult> {
    const flags = [];
    if (options.rebase) flags.push('--rebase');

    const remote = options.remote || 'origin';
    const branch = options.branch || '';

    return this.executor.exec(`pull ${flags.join(' ')} ${remote} ${branch}`);
  }

  // ==================== 分支命令 ====================

  /**
   * git branch
   */
  async branch(options: { list?: boolean; all?: boolean } = {}): Promise<GitExecResult> {
    const flags = [];
    if (options.list) flags.push('--list');
    if (options.all) flags.push('-a');
    return this.executor.exec(`branch ${flags.join(' ')}`);
  }

  /**
   * git checkout
   */
  async checkout(target: string, options: { create?: boolean } = {}): Promise<GitExecResult> {
    const flags = options.create ? '-b' : '';
    return this.executor.exec(`checkout ${flags} ${target}`);
  }

  /**
   * git merge
   */
  async merge(branch: string, options: { noFf?: boolean } = {}): Promise<GitExecResult> {
    const flags = options.noFf ? '--no-ff' : '';
    return this.executor.exec(`merge ${flags} ${branch}`);
  }

  // ==================== 差异命令 ====================

  /**
   * git diff
   */
  async diff(options: {
    staged?: boolean;
    file?: string;
    branch1?: string;
    branch2?: string;
  } = {}): Promise<GitExecResult> {
    const args = [];

    if (options.staged) {
      args.push('--staged');
    }

    if (options.branch1 && options.branch2) {
      args.push(`${options.branch1}..${options.branch2}`);
    }

    if (options.file) {
      args.push('--', options.file);
    }

    return this.executor.exec(`diff ${args.join(' ')}`);
  }

  /**
   * git log
   */
  async log(options: {
    oneline?: boolean;
    number?: number;
    format?: string;
    follow?: string;
  } = {}): Promise<GitExecResult> {
    const args = [];

    if (options.oneline) {
      args.push('--oneline');
    }

    if (options.number) {
      args.push(`-n ${options.number}`);
    }

    if (options.format) {
      args.push(`--format="${options.format}"`);
    }

    if (options.follow) {
      args.push('--follow', '--', options.follow);
    }

    return this.executor.exec(`log ${args.join(' ')}`);
  }
}
```

## 2. Git 状态检测

### 2.1 状态解析

```typescript
// src/git/status.ts
import { GitCommands } from './commands.js';

// 文件状态
export type FileStatus =
  | 'added'       // 新增 (A)
  | 'modified'    // 修改 (M)
  | 'deleted'     // 删除 (D)
  | 'renamed'     // 重命名 (R)
  | 'copied'      // 复制 (C)
  | 'unmerged'    // 未合并 (U)
  | 'untracked'   // 未跟踪 (??)
  | 'ignored';    // 忽略 (!!)

// 文件状态信息
export interface FileStatusInfo {
  path: string;
  status: FileStatus;
  staged: boolean;     // 是否已暂存
  oldPath?: string;    // 重命名时的旧路径
}

// Git 状态信息
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

// Git 状态解析器
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
    } else if (x === 'U' || y === 'U' || x === 'A' && y === 'A' || x === 'D' && y === 'D') {
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
    return status.staged.map(f => f.path);
  }

  /**
   * 获取所有更改的文件
   */
  async getChangedFiles(): Promise<string[]> {
    const status = await this.getStatus();
    return [
      ...status.staged,
      ...status.unstaged,
      ...status.untracked,
    ].map(f => f.path);
  }
}
```

## 3. Diff 解析

### 3.1 Diff 解析器

```typescript
// src/git/diff.ts
import { GitCommands } from './commands.js';

// Diff 块
export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

// Diff 行
export interface DiffLine {
  type: 'context' | 'add' | 'delete';
  content: string;
  oldNumber?: number;
  newNumber?: number;
}

// 文件 Diff
export interface FileDiff {
  oldPath: string;
  newPath: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
}

// Diff 解析器
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
    const additions = hunks.reduce(
      (sum, h) => sum + h.lines.filter(l => l.type === 'add').length,
      0
    );
    const deletions = hunks.reduce(
      (sum, h) => sum + h.lines.filter(l => l.type === 'delete').length,
      0
    );

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
}
```

## 4. Commit 消息生成

### 4.1 Commit 消息生成器

```typescript
// src/git/commit-generator.ts
import { AIProvider } from '../providers/base.js';
import { GitCommands } from './commands.js';
import { DiffParser, FileDiff } from './diff.js';
import { GitStatusParser, GitStatus } from './status.js';

// Commit 消息生成选项
export interface CommitGeneratorOptions {
  // 最大 diff 长度
  maxDiffLength?: number;

  // 自定义提示词
  customPrompt?: string;

  // 是否包含未暂存的更改
  includeUnstaged?: boolean;
}

// Commit 消息生成器
export class CommitMessageGenerator {
  private commands: GitCommands;
  private statusParser: GitStatusParser;
  private diffParser: DiffParser;

  constructor(
    private provider: AIProvider,
    cwd?: string
  ) {
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
    const response = await this.provider.chat([
      { role: 'user', content: prompt },
    ]);

    return this.cleanCommitMessage(response.content);
  }

  /**
   * 获取默认提示词
   */
  private getDefaultPrompt(status: GitStatus, diffText: string): string {
    const files = status.staged.map(f => f.path).join(', ');

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
  async commit(message: string, options: { noVerify?: boolean } = {}): Promise<void> {
    const result = await this.commands.commit(message, options);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to commit: ${result.stderr}`);
    }

    console.log(result.stdout);
  }
}
```

## 参数说明

### GitStatus 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `branch` | string | 当前分支 |
| `ahead` | number | 领先远程的提交数 |
| `behind` | number | 落后远程的提交数 |
| `staged` | FileStatusInfo[] | 暂存的文件 |
| `unstaged` | FileStatusInfo[] | 未暂存的更改 |
| `untracked` | FileStatusInfo[] | 未跟踪的文件 |
| `isClean` | boolean | 是否干净 |

### FileDiff 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `oldPath` | string | 旧路径 |
| `newPath` | string | 新路径 |
| `hunks` | DiffHunk[] | Diff 块 |
| `additions` | number | 添加行数 |
| `deletions` | number | 删除行数 |

## 练习题

### 练习 1: 实现分支管理

```typescript
// exercises/01-branch-manager.ts
// TODO: 实现分支管理器
// 要求：
// 1. 创建/删除分支
// 2. 切换分支
// 3. 合并分支

export class BranchManager {
  // TODO: 实现
}
```

### 练习 2: 实现 stash 管理

```typescript
// exercises/02-stash-manager.ts
// TODO: 实现 Git stash 管理
// 要求：
// 1. 保存/恢复 stash
// 2. 列出所有 stash
// 3. 应用指定 stash

export class StashManager {
  // TODO: 实现
}
```

### 练习 3: 实现交互式 rebase

```typescript
// exercises/03-interactive-rebase.ts
// TODO: 实现交互式 rebase 辅助
// 要求：
// 1. 显示待 rebase 的提交
// 2. 支持选择操作（pick, squash, drop）
// 3. 生成 rebase 命令

export class InteractiveRebase {
  // TODO: 实现
}
```

### 练习 4: 实现 PR 创建

```typescript
// exercises/04-pr-creator.ts
// TODO: 实现 PR 创建辅助
// 要求：
// 1. 检测远程仓库类型
// 2. 生成 PR 标题和描述
// 3. 打开 PR 创建页面

export class PRCreator {
  // TODO: 实现
}
```

## 下一步

恭喜完成第07章！继续学习 [第08章：完整项目](../08-complete-project/README.md) →
