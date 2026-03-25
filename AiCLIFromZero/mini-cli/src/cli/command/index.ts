// src/cli/command/index.ts
export { CommandParser } from './parser.js';
export { CommandValidator } from './validator.js';
export { CommandRegistry } from './registry.js';
export { builtinCommands } from './builtin.js';
export type {
  CommandDefinition,
  CommandOption,
  CommandHandler,
  CommandContext,
  ParseResult,
  CompletionCandidate,
  CompletionResult,
} from './types.js';
