// src/cli/index.ts
// CLI Interface Layer - 第六章：命令行交互界面

// REPL 核心
export { AIRepl, type AIReplConfig } from './repl.js';

// 历史管理
export { HistoryManager } from './history.js';

// Spinner 和进度条
export { SimpleSpinner, ProgressBar } from './spinner.js';

// 类型定义
export type {
  REPLConfig,
  CommandOption,
  CommandDefinition,
  CommandHandler,
  CommandContext,
  CompletionCandidate,
  Completer,
  ProgressBarConfig,
  TaskState,
  TaskItem,
} from './types.js';

// 命令系统
export {
  CommandParser,
  CommandValidator,
  CommandRegistry,
  builtinCommands,
} from './command/index.js';
export type {
  ParseResult,
  CompletionResult,
} from './command/index.js';

// 交互式提示
export { SimplePrompt } from './prompts/basic.js';

// 配置向导
export { ConfigWizard, createDefaultWizard } from './wizard/config-wizard.js';
