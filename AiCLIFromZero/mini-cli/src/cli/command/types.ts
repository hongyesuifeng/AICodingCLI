// src/cli/command/types.ts

// 命令选项定义
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

// 解析结果
export interface ParseResult {
  command: string;
  subcommand?: string;
  arguments: string[];
  options: Record<string, any>;
}

// 补全候选
export interface CompletionCandidate {
  text: string;
  display: string;
  description?: string;
}

// 补全结果
export interface CompletionResult {
  completions: CompletionCandidate[];
  type: 'command' | 'option' | 'subcommand' | 'none';
}
