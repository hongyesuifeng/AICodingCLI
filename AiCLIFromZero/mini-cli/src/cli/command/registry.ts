// src/cli/command/registry.ts
import type { CommandDefinition, CommandContext, CompletionCandidate } from './types.js';
import { CommandParser } from './parser.js';
import { CommandValidator } from './validator.js';

// 命令注册表
export class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();
  private parser = new CommandParser();
  private validator = new CommandValidator();

  // 注册命令
  register(definition: CommandDefinition): void {
    this.commands.set(definition.name, definition);

    // 注册别名
    if (definition.aliases) {
      for (const alias of definition.aliases) {
        this.commands.set(alias, definition);
      }
    }
  }

  // 批量注册
  registerAll(definitions: CommandDefinition[]): void {
    for (const def of definitions) {
      this.register(def);
    }
  }

  // 获取命令定义
  get(name: string): CommandDefinition | undefined {
    return this.commands.get(name);
  }

  // 列出所有命令
  list(): string[] {
    const names = new Set<string>();
    for (const [name, def] of this.commands) {
      names.add(def.name);
    }
    return Array.from(names);
  }

  // 执行命令
  async execute(input: string, repl?: any): Promise<void> {
    const trimmed = input.trim();

    // 检查是否是命令
    if (!trimmed.startsWith('/')) {
      throw new Error('Not a command');
    }

    // 提取命令名
    const commandName = trimmed.split(/\s+/)[0].slice(1);

    // 查找命令定义
    const definition = this.commands.get(commandName);
    if (!definition) {
      throw new Error(`Unknown command: /${commandName}`);
    }

    // 解析命令
    const parsed = this.parser.parse(trimmed, definition);

    // 构建上下文
    const context: CommandContext = {
      command: parsed.command,
      subcommand: parsed.subcommand,
      arguments: parsed.arguments,
      options: parsed.options,
      raw: trimmed,
      repl,
    };

    // 验证
    const validation = this.validator.validate(context, definition);
    if (!validation.valid) {
      throw new Error(validation.errors.join('\n'));
    }

    // 执行
    await definition.handler(context);
  }

  // 获取命令补全
  getCompletions(input: string): CompletionCandidate[] {
    if (!input.startsWith('/')) {
      return [];
    }

    const partial = input.slice(1).toLowerCase();
    const completions: CompletionCandidate[] = [];

    for (const name of this.list()) {
      if (name.toLowerCase().startsWith(partial)) {
        const def = this.commands.get(name);
        completions.push({
          text: `/${name}`,
          display: name,
          description: def?.description,
        });
      }
    }

    return completions;
  }

  // 检查命令是否存在
  has(name: string): boolean {
    return this.commands.has(name);
  }
}
