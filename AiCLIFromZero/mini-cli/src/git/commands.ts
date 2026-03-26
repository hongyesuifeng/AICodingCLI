// src/git/commands.ts
// Git 命令封装

import { GitExecutor, GitExecResult } from './executor.js';

/**
 * Git 命令封装
 */
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
  async commit(
    message: string,
    options: { amend?: boolean; noVerify?: boolean } = {}
  ): Promise<GitExecResult> {
    const flags = [];
    if (options.amend) flags.push('--amend');
    if (options.noVerify) flags.push('--no-verify');
    const escapedMessage = message.replace(/"/g, '\\"');
    return this.executor.exec(`commit ${flags.join(' ')} -m "${escapedMessage}"`);
  }

  /**
   * git push
   */
  async push(
    options: { remote?: string; branch?: string; force?: boolean; setUpstream?: boolean } = {}
  ): Promise<GitExecResult> {
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
  async pull(
    options: { remote?: string; branch?: string; rebase?: boolean } = {}
  ): Promise<GitExecResult> {
    const flags = [];
    if (options.rebase) flags.push('--rebase');

    const remote = options.remote || 'origin';
    const branch = options.branch || '';

    return this.executor.exec(`pull ${flags.join(' ')} ${remote} ${branch}`);
  }

  /**
   * git fetch
   */
  async fetch(remote?: string): Promise<GitExecResult> {
    return this.executor.exec(`fetch ${remote || ''}`);
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
   * 创建分支
   */
  async createBranch(name: string, startPoint?: string): Promise<GitExecResult> {
    const args = startPoint ? `${name} ${startPoint}` : name;
    return this.executor.exec(`branch ${args}`);
  }

  /**
   * 删除分支
   */
  async deleteBranch(name: string, force: boolean = false): Promise<GitExecResult> {
    const flag = force ? '-D' : '-d';
    return this.executor.exec(`branch ${flag} ${name}`);
  }

  /**
   * git checkout
   */
  async checkout(target: string, options: { create?: boolean } = {}): Promise<GitExecResult> {
    const flags = options.create ? '-b' : '';
    return this.executor.exec(`checkout ${flags} ${target}`);
  }

  /**
   * git switch
   */
  async switch(branch: string, options: { create?: boolean } = {}): Promise<GitExecResult> {
    const flags = options.create ? '-c' : '';
    return this.executor.exec(`switch ${flags} ${branch}`);
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

  /**
   * git show
   */
  async show(ref: string, options: { format?: string } = {}): Promise<GitExecResult> {
    const args = [ref];
    if (options.format) {
      args.unshift(`--format="${options.format}"`);
    }
    return this.executor.exec(`show ${args.join(' ')}`);
  }

  // ==================== Stash 命令 ====================

  /**
   * git stash
   */
  async stash(options: { message?: string; includeUntracked?: boolean } = {}): Promise<GitExecResult> {
    const args = ['push'];
    if (options.message) {
      args.push('-m', `"${options.message}"`);
    }
    if (options.includeUntracked) {
      args.push('-u');
    }
    return this.executor.exec(`stash ${args.join(' ')}`);
  }

  /**
   * git stash list
   */
  async stashList(): Promise<GitExecResult> {
    return this.executor.exec('stash list');
  }

  /**
   * git stash pop
   */
  async stashPop(index?: number): Promise<GitExecResult> {
    const ref = index !== undefined ? `stash@{${index}}` : '';
    return this.executor.exec(`stash pop ${ref}`);
  }

  /**
   * git stash drop
   */
  async stashDrop(index?: number): Promise<GitExecResult> {
    const ref = index !== undefined ? `stash@{${index}}` : '';
    return this.executor.exec(`stash drop ${ref}`);
  }

  // ==================== 远程命令 ====================

  /**
   * git remote
   */
  async remote(options: { verbose?: boolean } = {}): Promise<GitExecResult> {
    const flags = options.verbose ? '-v' : '';
    return this.executor.exec(`remote ${flags}`);
  }

  /**
   * git remote add
   */
  async remoteAdd(name: string, url: string): Promise<GitExecResult> {
    return this.executor.exec(`remote add ${name} ${url}`);
  }

  /**
   * git remote remove
   */
  async remoteRemove(name: string): Promise<GitExecResult> {
    return this.executor.exec(`remote remove ${name}`);
  }

  /**
   * 获取执行器
   */
  getExecutor(): GitExecutor {
    return this.executor;
  }
}
