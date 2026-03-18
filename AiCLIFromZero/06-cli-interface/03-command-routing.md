# 6.3 命令解析和路由

## 学习目标

理解斜杠命令系统的设计，掌握命令解析、参数处理和命令补全的实现。

## 1. 斜杠命令系统

### 1.1 命令结构

```
/command [subcommand] [options] [arguments]

示例：
/help                    # 显示帮助
/model gpt-4            # 切换模型
/file read path.txt     # 读取文件
/search --type code "query"  # 带选项的搜索
```

### 1.2 命令定义

```typescript
// src/cli/command/types.ts

// 命令参数定义
export interface CommandOption {
  name: string;           // 选项名
  alias?: string;         // 短别名 (如 -h)
  type: 'string' | 'boolean' | 'number';  // 类型
  description?: string;   // 描述
  default?: any;          // 默认值
  required?: boolean;     // 是否必需
}

// 命令定义
export interface CommandDefinition {
  name: string;           // 命令名
  description: string;    // 描述
  aliases?: string[];     // 别名
  options?: CommandOption[];  // 选项
  arguments?: {           // 参数
    name: string;
    description?: string;
    required?: boolean;
    variadic?: boolean;   // 可变参数 (...args)
  }[];
  subcommands?: CommandDefinition[];  // 子命令
  handler: CommandHandler;  // 处理函数
  examples?: string[];    // 使用示例
}

// 命令处理函数
export type CommandHandler = (
  context: CommandContext
) => Promise<void> | void;

// 命令上下文
export interface CommandContext {
  command: string;        // 命令名
  subcommand?: string;    // 子命令
  arguments: string[];    // 位置参数
  options: Record<string, any>;  // 选项
  raw: string;           // 原始输入
  repl: any;             // REPL 实例引用
}
```

## 2. 命令解析器

### 2.1 解析器实现

```typescript
// src/cli/command/parser.ts
import { CommandDefinition, CommandOption, CommandContext } from './types.js';

// 解析结果
interface ParseResult {
  command: string;
  subcommand?: string;
  arguments: string[];
  options: Record<string, any>;
}

// 命令解析器
export class CommandParser {
  /**
   * 解析命令字符串
   */
  parse(input: string, definition: CommandDefinition): ParseResult {
    const tokens = this.tokenize(input);
    return this.parseTokens(tokens, definition);
  }

  /**
   * 分词
   */
  private tokenize(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < input.length; i++) {
      const char = input[i];

      if (inQuotes) {
        if (char === quoteChar) {
          inQuotes = false;
          tokens.push(current);
          current = '';
        } else {
          current += char;
        }
      } else if (char === '"' || char === "'") {
        inQuotes = true;
        quoteChar = char;
      } else if (char === ' ' || char === '\t') {
        if (current) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  /**
   * 解析 token 序列
   */
  private parseTokens(
    tokens: string[],
    definition: CommandDefinition
  ): ParseResult {
    const result: ParseResult = {
      command: definition.name,
      arguments: [],
      options: {},
    };

    // 初始化选项默认值
    if (definition.options) {
      for (const opt of definition.options) {
        if (opt.default !== undefined) {
          result.options[opt.name] = opt.default;
        }
      }
    }

    let i = 1; // 跳过命令名
    let expectingOptionValue = false;
    let currentOption: CommandOption | null = null;

    // 检查子命令
    if (definition.subcommands && definition.subcommands.length > 0) {
      if (tokens[i] && !tokens[i].startsWith('-')) {
        const subCmd = definition.subcommands.find(s => s.name === tokens[i]);
        if (subCmd) {
          result.subcommand = tokens[i];
          i++;
        }
      }
    }

    while (i < tokens.length) {
      const token = tokens[i];

      // 长选项 (--option)
      if (token.startsWith('--')) {
        const optName = token.slice(2);

        // 检查 --option=value 格式
        const eqIndex = optName.indexOf('=');
        if (eqIndex >= 0) {
          const name = optName.slice(0, eqIndex);
          const value = optName.slice(eqIndex + 1);
          result.options[name] = value;
        } else {
          currentOption = this.findOption(definition, optName);
          if (currentOption) {
            if (currentOption.type === 'boolean') {
              result.options[currentOption.name] = true;
              currentOption = null;
            } else {
              expectingOptionValue = true;
            }
          }
        }
        i++;
        continue;
      }

      // 短选项 (-o)
      if (token.startsWith('-') && token.length > 1) {
        const optAlias = token.slice(1);
        currentOption = this.findOptionByAlias(definition, optAlias);
        if (currentOption) {
          if (currentOption.type === 'boolean') {
            result.options[currentOption.name] = true;
            currentOption = null;
          } else {
            expectingOptionValue = true;
          }
        }
        i++;
        continue;
      }

      // 选项值
      if (expectingOptionValue && currentOption) {
        result.options[currentOption.name] = this.parseValue(token, currentOption.type);
        expectingOptionValue = false;
        currentOption = null;
        i++;
        continue;
      }

      // 位置参数
      result.arguments.push(token);
      i++;
    }

    return result;
  }

  /**
   * 查找选项
   */
  private findOption(
    definition: CommandDefinition,
    name: string
  ): CommandOption | undefined {
    return definition.options?.find(o => o.name === name);
  }

  /**
   * 通过别名查找选项
   */
  private findOptionByAlias(
    definition: CommandDefinition,
    alias: string
  ): CommandOption | undefined {
    return definition.options?.find(o => o.alias === alias);
  }

  /**
   * 解析值
   */
  private parseValue(value: string, type: string): any {
    switch (type) {
      case 'number':
        return parseFloat(value);
      case 'boolean':
        return value === 'true';
      default:
        return value;
    }
  }
}
```

### 2.2 参数验证

```typescript
// src/cli/command/validator.ts
import { CommandDefinition, CommandContext } from './types.js';

// 验证结果
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// 命令验证器
export class CommandValidator {
  /**
   * 验证命令上下文
   */
  validate(
    context: CommandContext,
    definition: CommandDefinition
  ): ValidationResult {
    const errors: string[] = [];

    // 验证必需选项
    if (definition.options) {
      for (const opt of definition.options) {
        if (opt.required && context.options[opt.name] === undefined) {
          errors.push(`Missing required option: --${opt.name}`);
        }
      }
    }

    // 验证必需参数
    if (definition.arguments) {
      const requiredArgs = definition.arguments.filter(a => a.required);
      if (context.arguments.length < requiredArgs.length) {
        errors.push(
          `Expected at least ${requiredArgs.length} arguments, got ${context.arguments.length}`
        );
      }
    }

    // 验证选项值类型
    if (definition.options) {
      for (const opt of definition.options) {
        const value = context.options[opt.name];
        if (value !== undefined) {
          const typeError = this.validateType(value, opt.type, opt.name);
          if (typeError) {
            errors.push(typeError);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 验证类型
   */
  private validateType(
    value: any,
    expectedType: string,
    optionName: string
  ): string | null {
    const actualType = typeof value;

    switch (expectedType) {
      case 'string':
        if (actualType !== 'string') {
          return `Option --${optionName} must be a string`;
        }
        break;
      case 'number':
        if (actualType !== 'number' || isNaN(value)) {
          return `Option --${optionName} must be a number`;
        }
        break;
      case 'boolean':
        if (actualType !== 'boolean') {
          return `Option --${optionName} must be a boolean`;
        }
        break;
    }

    return null;
  }
}
```

## 3. 命令路由

### 3.1 命令注册表

```typescript
// src/cli/command/registry.ts
import { CommandDefinition, CommandContext } from './types.js';
import { CommandParser } from './parser.js';
import { CommandValidator } from './validator.js';

// 命令注册表
export class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();
  private parser = new CommandParser();
  private validator = new CommandValidator();

  /**
   * 注册命令
   */
  register(definition: CommandDefinition): void {
    this.commands.set(definition.name, definition);

    // 注册别名
    if (definition.aliases) {
      for (const alias of definition.aliases) {
        this.commands.set(alias, definition);
      }
    }
  }

  /**
   * 批量注册
   */
  registerAll(definitions: CommandDefinition[]): void {
    for (const def of definitions) {
      this.register(def);
    }
  }

  /**
   * 获取命令定义
   */
  get(name: string): CommandDefinition | undefined {
    return this.commands.get(name);
  }

  /**
   * 列出所有命令
   */
  list(): string[] {
    const names = new Set<string>();
    for (const [name, def] of this.commands) {
      names.add(def.name);
    }
    return Array.from(names);
  }

  /**
   * 执行命令
   */
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

  /**
   * 获取命令补全
   */
  getCompletions(input: string): string[] {
    if (!input.startsWith('/')) {
      return [];
    }

    const partial = input.slice(1).toLowerCase();
    const completions: string[] = [];

    for (const name of this.list()) {
      if (name.toLowerCase().startsWith(partial)) {
        completions.push(`/${name}`);
      }
    }

    return completions;
  }
}
```

### 3.2 内置命令

```typescript
// src/cli/command/builtin-commands.ts
import { CommandDefinition } from './types.js';
import chalk from 'chalk';

// 帮助命令
export const helpCommand: CommandDefinition = {
  name: 'help',
  description: 'Show help information',
  aliases: ['h', '?'],
  options: [
    {
      name: 'command',
      alias: 'c',
      type: 'string',
      description: 'Show help for a specific command',
    },
  ],
  handler: async (ctx) => {
    const registry = ctx.repl?.commandRegistry;
    if (!registry) return;

    const commandName = ctx.options.command;

    if (commandName) {
      // 显示单个命令的帮助
      const cmd = registry.get(commandName);
      if (cmd) {
        console.log(chalk.cyan(`/${cmd.name}`));
        console.log(`  ${cmd.description}`);

        if (cmd.options?.length) {
          console.log('\nOptions:');
          for (const opt of cmd.options) {
            const alias = opt.alias ? `-${opt.alias}, ` : '';
            console.log(`  ${alias}--${opt.name}  ${opt.description || ''}`);
          }
        }

        if (cmd.examples?.length) {
          console.log('\nExamples:');
          for (const ex of cmd.examples) {
            console.log(`  ${ex}`);
          }
        }
      } else {
        console.log(chalk.red(`Unknown command: ${commandName}`));
      }
    } else {
      // 显示所有命令
      console.log(chalk.cyan('Available commands:\n'));

      const commands = registry.list();
      for (const name of commands) {
        const cmd = registry.get(name);
        if (cmd) {
          console.log(`  /${name.padEnd(15)} ${cmd.description}`);
        }
      }

      console.log(`\nType ${chalk.cyan('/help <command>')} for more information.`);
    }
  },
};

// 清屏命令
export const clearCommand: CommandDefinition = {
  name: 'clear',
  description: 'Clear the screen',
  aliases: ['cls'],
  handler: async () => {
    console.clear();
  },
};

// 退出命令
export const exitCommand: CommandDefinition = {
  name: 'exit',
  description: 'Exit the CLI',
  aliases: ['quit', 'q'],
  handler: async (ctx) => {
    console.log(chalk.cyan('Goodbye!'));
    process.exit(0);
  },
};

// 模型命令
export const modelCommand: CommandDefinition = {
  name: 'model',
  description: 'Show or change the current model',
  arguments: [
    {
      name: 'model',
      description: 'Model name to switch to',
      required: false,
    },
  ],
  options: [
    {
      name: 'list',
      alias: 'l',
      type: 'boolean',
      description: 'List available models',
    },
  ],
  handler: async (ctx) => {
    if (ctx.options.list) {
      console.log('Available models:');
      console.log('  gpt-4-turbo    - GPT-4 Turbo (recommended)');
      console.log('  gpt-4          - GPT-4');
      console.log('  gpt-3.5-turbo  - GPT-3.5 Turbo (fast)');
      console.log('  claude-3-opus  - Claude 3 Opus');
      console.log('  claude-3-sonnet - Claude 3 Sonnet');
    } else if (ctx.arguments[0]) {
      const model = ctx.arguments[0];
      console.log(chalk.green(`Model changed to: ${model}`));
      // 实际实现会更新 provider 配置
    } else {
      const currentModel = ctx.repl?.config?.model || 'gpt-4-turbo';
      console.log(`Current model: ${chalk.cyan(currentModel)}`);
    }
  },
};

// 导出所有内置命令
export const builtinCommands: CommandDefinition[] = [
  helpCommand,
  clearCommand,
  exitCommand,
  modelCommand,
];
```

## 4. 命令补全

### 4.1 命令补全器

```typescript
// src/cli/command/completer.ts
import { CommandRegistry } from './registry.js';
import { CommandDefinition } from './types.js';

// 命令补全器
export class CommandCompleter {
  constructor(private registry: CommandRegistry) {}

  /**
   * 获取补全建议
   */
  getCompletions(input: string): CompletionResult {
    if (!input.startsWith('/')) {
      return { completions: [], type: 'none' };
    }

    const tokens = input.split(/\s+/);
    const commandName = tokens[0].slice(1);

    // 命令名补全
    if (tokens.length === 1) {
      return this.completeCommand(commandName);
    }

    // 选项补全
    if (tokens[tokens.length - 1].startsWith('-')) {
      return this.completeOption(commandName, tokens);
    }

    // 子命令补全
    return this.completeSubcommand(commandName, tokens);
  }

  /**
   * 补全命令名
   */
  private completeCommand(partial: string): CompletionResult {
    const completions = this.registry
      .list()
      .filter(name => name.startsWith(partial))
      .map(name => ({
        text: `/${name}`,
        display: name,
        description: this.registry.get(name)?.description,
      }));

    return { completions, type: 'command' };
  }

  /**
   * 补全选项
   */
  private completeOption(
    commandName: string,
    tokens: string[]
  ): CompletionResult {
    const definition = this.registry.get(commandName);
    if (!definition?.options) {
      return { completions: [], type: 'none' };
    }

    const lastToken = tokens[tokens.length - 1];
    const completions: Completion[] = [];

    for (const opt of definition.options) {
      if (lastToken.startsWith('--')) {
        const partial = lastToken.slice(2);
        if (opt.name.startsWith(partial)) {
          completions.push({
            text: `--${opt.name}`,
            display: `--${opt.name}`,
            description: opt.description,
          });
        }
      } else if (lastToken.startsWith('-')) {
        if (opt.alias) {
          completions.push({
            text: `-${opt.alias}`,
            display: `-${opt.alias}`,
            description: `${opt.name}: ${opt.description || ''}`,
          });
        }
      }
    }

    return { completions, type: 'option' };
  }

  /**
   * 补全子命令
   */
  private completeSubcommand(
    commandName: string,
    tokens: string[]
  ): CompletionResult {
    const definition = this.registry.get(commandName);
    if (!definition?.subcommands) {
      return { completions: [], type: 'none' };
    }

    const lastToken = tokens[tokens.length - 1];
    const completions: Completion[] = [];

    for (const sub of definition.subcommands) {
      if (sub.name.startsWith(lastToken)) {
        completions.push({
          text: sub.name,
          display: sub.name,
          description: sub.description,
        });
      }
    }

    return { completions, type: 'subcommand' };
  }
}

// 补全结果
interface CompletionResult {
  completions: Completion[];
  type: 'command' | 'option' | 'subcommand' | 'none';
}

interface Completion {
  text: string;
  display: string;
  description?: string;
}
```

## 5. 完整示例

### 5.1 使用命令系统

```typescript
// src/cli/command/example.ts
import { CommandRegistry, builtinCommands } from './index.js';

// 创建命令注册表
const registry = new CommandRegistry();

// 注册内置命令
registry.registerAll(builtinCommands);

// 注册自定义命令
registry.register({
  name: 'search',
  description: 'Search for files or content',
  subcommands: [
    {
      name: 'files',
      description: 'Search for files',
      options: [
        {
          name: 'pattern',
          alias: 'p',
          type: 'string',
          description: 'Search pattern',
          required: true,
        },
        {
          name: 'type',
          alias: 't',
          type: 'string',
          description: 'File type (js, ts, etc.)',
        },
      ],
      handler: async (ctx) => {
        console.log(`Searching files with pattern: ${ctx.options.pattern}`);
        console.log(`Type filter: ${ctx.options.type || 'all'}`);
      },
    },
    {
      name: 'content',
      description: 'Search within file contents',
      options: [
        {
          name: 'query',
          alias: 'q',
          type: 'string',
          description: 'Search query',
          required: true,
        },
      ],
      handler: async (ctx) => {
        console.log(`Searching content: ${ctx.options.query}`);
      },
    },
  ],
  handler: async (ctx) => {
    console.log('Please specify a subcommand: files, content');
  },
});

// 执行命令
async function main() {
  await registry.execute('/search files --pattern "*.ts" --type ts');
  // Output:
  // Searching files with pattern: *.ts
  // Type filter: ts

  await registry.execute('/help search');
  // Output:
  // /search
  //   Search for files or content
  // ...
}

main();
```

## 参数说明

### CommandDefinition 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✓ | 命令名 |
| `description` | string | ✓ | 描述 |
| `aliases` | string[] | - | 别名列表 |
| `options` | CommandOption[] | - | 选项定义 |
| `arguments` | object[] | - | 参数定义 |
| `subcommands` | CommandDefinition[] | - | 子命令 |
| `handler` | function | ✓ | 处理函数 |

### CommandOption 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 选项名 |
| `alias` | string | 短别名 |
| `type` | string | 类型 |
| `description` | string | 描述 |
| `default` | any | 默认值 |
| `required` | boolean | 是否必需 |

### CommandContext 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `command` | string | 命令名 |
| `subcommand` | string | 子命令 |
| `arguments` | string[] | 位置参数 |
| `options` | object | 选项 |
| `raw` | string | 原始输入 |
| `repl` | any | REPL 引用 |

## 练习题

### 练习 1: 实现命令历史搜索

```typescript
// exercises/01-command-history.ts
// TODO: 实现命令历史搜索 (Ctrl+R)
// 要求：
// 1. 记录执行过的命令
// 2. 支持增量搜索
// 3. 显示匹配的历史

export class CommandHistorySearch {
  // TODO: 实现
}
```

### 练习 2: 实现命令别名

```typescript
// exercises/02-command-alias.ts
// TODO: 实现用户自定义命令别名
// 要求：
// 1. 保存别名配置
// 2. 别名展开
// 3. 别名管理命令

export class CommandAliasManager {
  // TODO: 实现
  setAlias(alias: string, command: string): void {}
  expand(input: string): string { return input; }
}
```

### 练习 3: 实现命令管道

```typescript
// exercises/03-command-pipe.ts
// TODO: 实现命令管道 (|)
// 要求：
// 1. 解析管道语法
// 2. 传递上一个命令的输出
// 3. 处理错误

export class CommandPipeline {
  // TODO: 实现
  async execute(pipeline: string): Promise<string> { return ''; }
}
```

### 练习 4: 实现命令撤销

```typescript
// exercises/04-command-undo.ts
// TODO: 实现命令撤销功能
// 要求：
// 1. 记录命令状态
// 2. 支持撤销操作
// 3. 限制撤销步数

export class CommandUndoManager {
  // TODO: 实现
  canUndo(): boolean { return false; }
  undo(): void {}
}
```

## 下一步

完成本节后，继续学习 [6.4 配置界面 (TUI)](./04-config-ui.md) →
