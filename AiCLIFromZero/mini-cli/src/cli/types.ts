// src/cli/types.ts

// REPL 配置
export interface REPLConfig {
  prompt?: string;
  welcomeMessage?: string;
  goodbyeMessage?: string;
  historyFile?: string;
  historySize?: number;
}

// 命令参数定义
export interface CommandOption {
  name: string;
  alias?: string;
  type: 'string' | 'boolean' | 'number';
  description?: string;
  default?: any;
  required?: boolean;
}

// 命令定义
export interface CommandDefinition {
  name: string;
  description: string;
  aliases?: string[];
  options?: CommandOption[];
  arguments?: {
    name: string;
    description?: string;
    required?: boolean;
    variadic?: boolean;
  }[];
  subcommands?: CommandDefinition[];
  handler: CommandHandler;
  examples?: string[];
}

// 命令处理函数
export type CommandHandler = (context: CommandContext) => Promise<void> | void;

// 命令上下文
export interface CommandContext {
  command: string;
  subcommand?: string;
  arguments: string[];
  options: Record<string, any>;
  raw: string;
  repl?: any;
}

// 补全候选
export interface CompletionCandidate {
  text: string;
  display: string;
  description?: string;
}

// 补全器接口
export interface Completer {
  getCompletions(input: string): Promise<CompletionCandidate[]> | CompletionCandidate[];
}

// 进度条配置
export interface ProgressBarConfig {
  width: number;
  complete: string;
  incomplete: string;
  showPercent: boolean;
  showCount: boolean;
}

// 任务状态
export type TaskState = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

// 任务项
export interface TaskItem {
  id: string;
  label: string;
  state: TaskState;
  detail?: string;
}
