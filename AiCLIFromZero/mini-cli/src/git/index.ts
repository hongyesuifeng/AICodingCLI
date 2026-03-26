// src/git/index.ts
// Git 模块导出

// 执行器
export { GitExecutor, type GitExecOptions, type GitExecResult } from './executor.js';

// 命令
export { GitCommands } from './commands.js';

// 状态解析
export {
  GitStatusParser,
  type FileStatus,
  type FileStatusInfo,
  type GitStatus,
} from './status.js';

// Diff 解析
export {
  DiffParser,
  type DiffLine,
  type DiffHunk,
  type FileDiff,
} from './diff.js';

// Commit 生成器
export {
  CommitMessageGenerator,
  type CommitGeneratorOptions,
  type AIProvider as GitAIProvider,
} from './commit-generator.js';
