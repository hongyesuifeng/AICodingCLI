// src/git/executor.ts
// Git 命令执行器

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Git 执行选项
 */
export interface GitExecOptions {
  cwd?: string;
  encoding?: BufferEncoding;
  maxBuffer?: number;
  timeout?: number;
}

/**
 * Git 执行结果
 */
export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Git 执行器
 */
export class GitExecutor {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * 设置工作目录
   */
  setCwd(cwd: string): void {
    this.cwd = cwd;
  }

  /**
   * 获取工作目录
   */
  getCwd(): string {
    return this.cwd;
  }

  /**
   * 执行 Git 命令
   */
  async exec(args: string, options: GitExecOptions = {}): Promise<GitExecResult> {
    const {
      cwd = this.cwd,
      encoding = 'utf-8',
      maxBuffer = 1024 * 1024,
      timeout = 30000,
    } = options;

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

  /**
   * 获取仓库根目录
   */
  async getRepoRoot(): Promise<string> {
    const result = await this.exec('rev-parse --show-toplevel');
    return result.exitCode === 0 ? result.stdout.trim() : '';
  }

  /**
   * 获取 Git 版本
   */
  async getVersion(): Promise<string> {
    const result = await this.exec('--version');
    const match = result.stdout.match(/git version (\d+\.\d+\.\d+)/);
    return match ? match[1] : '';
  }
}
