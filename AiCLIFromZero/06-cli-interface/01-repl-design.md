# 6.1 交互式 REPL 设计

## 学习目标

理解 REPL（Read-Eval-Print Loop）循环设计，掌握输入处理、多行输入、历史记录和自动补全的实现。

## 1. REPL 概述

### 1.1 什么是 REPL？

REPL（Read-Eval-Print Loop）是一种交互式编程环境，循环执行：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          REPL 循环                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐        │
│    │   Read   │ ──▶ │   Eval   │ ──▶ │  Print   │ ──▶ │   Loop   │        │
│    │  读取输入 │     │  执行命令 │     │  输出结果 │     │  继续循环 │        │
│    └──────────┘     └──────────┘     └──────────┘     └──────────┘        │
│         ▲                                                    │             │
│         └────────────────────────────────────────────────────┘             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 REPL 在 AI CLI 中的应用

| 功能 | 说明 |
|------|------|
| 用户输入 | 接收用户的自然语言问题 |
| 命令解析 | 识别斜杠命令（如 `/help`） |
| AI 交互 | 调用 AI API 获取回复 |
| 输出展示 | 流式显示 AI 响应 |
| 会话管理 | 保持对话上下文 |

## 2. 基础 REPL 实现

### 2.1 使用 readline 模块

```typescript
// src/cli/basic-repl.ts
import * as readline from 'readline';

// 基础 REPL
export class BasicREPL {
  private rl: readline.Interface;
  private running = false;

  constructor(
    private prompt: string = '> ',
    private handler: (input: string) => Promise<string>
  ) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.prompt,
    });
  }

  /**
   * 启动 REPL
   */
  start(): void {
    this.running = true;
    console.log('Welcome! Type "exit" to quit.\n');
    this.rl.prompt();

    this.rl.on('line', async (input) => {
      const trimmed = input.trim();

      // 检查退出命令
      if (trimmed === 'exit' || trimmed === 'quit') {
        this.stop();
        return;
      }

      // 跳过空输入
      if (!trimmed) {
        this.rl.prompt();
        return;
      }

      try {
        // 处理输入
        const result = await this.handler(trimmed);
        console.log(result);
      } catch (error: any) {
        console.error('Error:', error.message);
      }

      this.rl.prompt();
    });

    this.rl.on('close', () => {
      console.log('\nGoodbye!');
      process.exit(0);
    });
  }

  /**
   * 停止 REPL
   */
  stop(): void {
    this.running = false;
    this.rl.close();
  }
}

// 使用示例
async function main() {
  const repl = new BasicREPL('ai> ', async (input) => {
    // 简单的回显处理器
    return `You said: ${input}`;
  });

  repl.start();
}

main();
```

**readline.createInterface 参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `input` | Readable | 输入流 |
| `output` | Writable | 输出流 |
| `prompt` | string | 提示符 |
| `historySize` | number | 历史记录大小 |
| `removeHistoryDuplicates` | boolean | 移除重复历史 |

### 2.2 带历史的 REPL

```typescript
// src/cli/history-repl.ts
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

// 历史记录管理
export class HistoryManager {
  private history: string[] = [];
  private historyFile: string;
  private maxSize: number;

  constructor(historyFile: string, maxSize: number = 1000) {
    this.historyFile = historyFile;
    this.maxSize = maxSize;
    this.load();
  }

  /**
   * 加载历史记录
   */
  private load(): void {
    try {
      if (fs.existsSync(this.historyFile)) {
        const content = fs.readFileSync(this.historyFile, 'utf-8');
        this.history = content.split('\n').filter(Boolean);
      }
    } catch (error) {
      // 忽略加载错误
    }
  }

  /**
   * 保存历史记录
   */
  private save(): void {
    try {
      const dir = path.dirname(this.historyFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.historyFile, this.history.join('\n'), 'utf-8');
    } catch (error) {
      // 忽略保存错误
    }
  }

  /**
   * 添加历史记录
   */
  add(entry: string): void {
    // 不添加重复或空的条目
    if (!entry.trim() || this.history[this.history.length - 1] === entry) {
      return;
    }

    this.history.push(entry);

    // 限制大小
    if (this.history.length > this.maxSize) {
      this.history = this.history.slice(-this.maxSize);
    }

    this.save();
  }

  /**
   * 获取历史记录
   */
  getHistory(): string[] {
    return [...this.history];
  }

  /**
   * 搜索历史记录
   */
  search(query: string): string[] {
    const lowerQuery = query.toLowerCase();
    return this.history.filter(entry =>
      entry.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 清空历史记录
   */
  clear(): void {
    this.history = [];
    this.save();
  }
}

// 带历史的 REPL
export class HistoryREPL extends BasicREPL {
  private historyManager: HistoryManager;

  constructor(
    prompt: string,
    handler: (input: string) => Promise<string>,
    historyFile: string = './.history'
  ) {
    super(prompt, handler);
    this.historyManager = new HistoryManager(historyFile);

    // 配置 readline 使用历史
    (this as any).rl.history = this.historyManager.getHistory();
  }

  start(): void {
    const originalHandler = this.handler;

    // 包装处理器以保存历史
    this.handler = async (input) => {
      this.historyManager.add(input);
      return originalHandler(input);
    };

    super.start();
  }
}
```

## 3. 多行输入

### 3.1 多行输入处理

```typescript
// src/cli/multiline-repl.ts
import * as readline from 'readline';

// 多行输入状态
interface MultilineState {
  active: boolean;
  lines: string[];
  delimiter: string;
}

// 多行 REPL
export class MultilineREPL extends BasicREPL {
  private multilineState: MultilineState = {
    active: false,
    lines: [],
    delimiter: '"""',
  };

  constructor(
    prompt: string,
    handler: (input: string) => Promise<string>,
    delimiter: string = '"""'
  ) {
    super(prompt, handler);
    this.multilineState.delimiter = delimiter;
  }

  start(): void {
    console.log(`Use ${this.multilineState.delimiter} for multiline input.\n`);
    super.start();
  }

  protected async handleInput(input: string): Promise<string | null> {
    const trimmed = input.trim();
    const delimiter = this.multilineState.delimiter;

    // 开始多行模式
    if (trimmed === delimiter && !this.multilineState.active) {
      this.multilineState.active = true;
      this.multilineState.lines = [];
      (this as any).rl.setPrompt('... ');
      return null;
    }

    // 结束多行模式
    if (trimmed === delimiter && this.multilineState.active) {
      this.multilineState.active = false;
      (this as any).rl.setPrompt(this.prompt);
      const content = this.multilineState.lines.join('\n');
      this.multilineState.lines = [];
      return this.handler(content);
    }

    // 多行模式中
    if (this.multilineState.active) {
      this.multilineState.lines.push(input);
      return null;
    }

    // 单行模式
    return this.handler(input);
  }
}
```

### 3.2 括号匹配的多行

```typescript
// src/cli/bracket-multiline.ts

// 检查括号是否匹配
function checkBrackets(text: string): { balanced: boolean; openCount: number } {
  const brackets: Record<string, string> = {
    '(': ')',
    '[': ']',
    '{': '}',
  };

  const stack: string[] = [];

  for (const char of text) {
    if (brackets[char]) {
      stack.push(char);
    } else if (Object.values(brackets).includes(char)) {
      const last = stack.pop();
      if (!last || brackets[last] !== char) {
        return { balanced: false, openCount: stack.length };
      }
    }
  }

  return { balanced: stack.length === 0, openCount: stack.length };
}

// 检查字符串是否完整
function isStringComplete(text: string): boolean {
  let inString = false;
  let escapeNext = false;
  let stringChar = '';

  for (const char of text) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if ((char === '"' || char === "'" || char === '`') && !inString) {
      inString = true;
      stringChar = char;
    } else if (char === stringChar && inString) {
      inString = false;
    }
  }

  return !inString;
}

// 智能多行检测
export function needsMoreInput(text: string): boolean {
  // 检查括号
  const bracketCheck = checkBrackets(text);
  if (!bracketCheck.balanced || bracketCheck.openCount > 0) {
    return true;
  }

  // 检查字符串
  if (!isStringComplete(text)) {
    return true;
  }

  // 检查末尾的反斜杠
  if (text.trimEnd().endsWith('\\')) {
    return true;
  }

  return false;
}
```

## 4. 自动补全

### 4.1 基础自动补全

```typescript
// src/cli/autocomplete.ts
import * as readline from 'readline';

// 补全候选
export interface CompletionCandidate {
  text: string;       // 补全文本
  display: string;    // 显示文本
  description?: string; // 描述
}

// 补全器接口
export interface Completer {
  getCompletions(input: string): Promise<CompletionCandidate[]>;
}

// 命令补全器
export class CommandCompleter implements Completer {
  private commands: string[];

  constructor(commands: string[]) {
    this.commands = commands;
  }

  async getCompletions(input: string): Promise<CompletionCandidate[]> {
    // 只补全以 / 开头的命令
    if (!input.startsWith('/')) {
      return [];
    }

    const partial = input.toLowerCase();

    return this.commands
      .filter(cmd => cmd.toLowerCase().startsWith(partial))
      .map(cmd => ({
        text: cmd,
        display: cmd,
        description: `Command: ${cmd}`,
      }));
  }
}

// 文件路径补全器
export class FilePathCompleter implements Completer {
  async getCompletions(input: string): Promise<CompletionCandidate[]> {
    // 检测文件路径模式
    const pathMatch = input.match(/(?:^|\s)(\.?\.?\/[^\s]*|[^\s]*\/[^\s]*)$/);
    if (!pathMatch) {
      return [];
    }

    const partial = pathMatch[1];
    const dir = partial.substring(0, partial.lastIndexOf('/') + 1);
    const prefix = partial.substring(partial.lastIndexOf('/') + 1);

    try {
      const fs = require('fs');
      const entries = fs.readdirSync(dir || '.');

      return entries
        .filter((name: string) => name.startsWith(prefix))
        .map((name: string) => ({
          text: input.replace(partial, dir + name),
          display: name,
          description: `File: ${dir}${name}`,
        }));
    } catch {
      return [];
    }
  }
}

// 组合补全器
export class CombinedCompleter implements Completer {
  private completers: Completer[] = [];

  addCompleter(completer: Completer): void {
    this.completers.push(completer);
  }

  async getCompletions(input: string): Promise<CompletionCandidate[]> {
    const results = await Promise.all(
      this.completers.map(c => c.getCompletions(input))
    );

    return results.flat();
  }
}
```

### 4.2 集成自动补全

```typescript
// src/cli/autocomplete-repl.ts
import * as readline from 'readline';

// 带自动补全的 REPL
export class AutocompleteREPL extends BasicREPL {
  private completer: Completer;

  constructor(
    prompt: string,
    handler: (input: string) => Promise<string>,
    completer: Completer
  ) {
    super(prompt, handler);
    this.completer = completer;
    this.setupAutocomplete();
  }

  private setupAutocomplete(): void {
    // 替换 readline 实例
    (this as any).rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.prompt,
      completer: async (input: string, callback: (err: any, completions: string[]) => void) => {
        try {
          const candidates = await this.completer.getCompletions(input);
          const completions = candidates.map(c => c.text);
          callback(null, completions);
        } catch (error) {
          callback(error, []);
        }
      },
    });
  }
}

// Tab 补全处理器
export function createCompleterFunction(
  completer: Completer
): (input: string) => Promise<[string[], string]> {
  return async (input: string) => {
    const candidates = await completer.getCompletions(input);

    if (candidates.length === 0) {
      return [[], input];
    }

    if (candidates.length === 1) {
      return [[candidates[0].text], input];
    }

    // 多个匹配：返回公共前缀
    const texts = candidates.map(c => c.text);
    const commonPrefix = findCommonPrefix(texts);

    return [texts, commonPrefix];
  };
}

// 查找公共前缀
function findCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return '';

  let prefix = strings[0];

  for (const str of strings.slice(1)) {
    while (!str.startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
      if (prefix === '') return '';
    }
  }

  return prefix;
}
```

## 5. 高级 REPL

### 5.1 完整的 AI REPL

```typescript
// src/cli/ai-repl.ts
import * as readline from 'readline';
import chalk from 'chalk';
import { AIProvider } from '../providers/base.js';
import { MessageBuilder } from '../utils/message-builder.js';
import { HistoryManager } from './history-repl.js';
import { CombinedCompleter, CommandCompleter } from './autocomplete.js';

// AI REPL 配置
export interface AIReplConfig {
  prompt?: string;
  welcomeMessage?: string;
  historyFile?: string;
  model?: string;
  systemPrompt?: string;
}

const DEFAULT_CONFIG: AIReplConfig = {
  prompt: 'ai> ',
  welcomeMessage: 'Welcome to AI CLI! Type /help for commands.',
  historyFile: './.ai-cli-history',
  model: 'gpt-4-turbo',
  systemPrompt: 'You are a helpful assistant.',
};

// AI REPL
export class AIRepl {
  private rl: readline.Interface;
  private running = false;
  private messages = new MessageBuilder();
  private historyManager: HistoryManager;
  private completer: CombinedCompleter;
  private commands = new Map<string, (args: string) => Promise<void>>();

  constructor(
    private provider: AIProvider,
    private config: AIReplConfig = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // 初始化补全器
    this.completer = new CombinedCompleter();
    this.completer.addCompleter(new CommandCompleter(['/help', '/clear', '/exit', '/model', '/history']));

    // 初始化 readline
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.config.prompt!,
      historySize: 1000,
      removeHistoryDuplicates: true,
      completer: this.completerFunction.bind(this),
    });

    // 初始化历史
    this.historyManager = new HistoryManager(this.config.historyFile!);
    (this.rl as any).history = this.historyManager.getHistory();

    // 初始化系统消息
    if (this.config.systemPrompt) {
      this.messages.system(this.config.systemPrompt);
    }

    // 注册内置命令
    this.registerCommands();
  }

  /**
   * 启动 REPL
   */
  start(): void {
    this.running = true;

    if (this.config.welcomeMessage) {
      console.log(chalk.cyan(this.config.welcomeMessage));
      console.log();
    }

    this.rl.prompt();

    this.rl.on('line', async (input) => {
      await this.handleLine(input);
    });

    this.rl.on('close', () => {
      console.log(chalk.cyan('\nGoodbye!'));
      process.exit(0);
    });
  }

  /**
   * 处理输入行
   */
  private async handleLine(input: string): Promise<void> {
    const trimmed = input.trim();

    if (!trimmed) {
      this.rl.prompt();
      return;
    }

    // 保存历史
    this.historyManager.add(trimmed);

    // 处理命令
    if (trimmed.startsWith('/')) {
      await this.handleCommand(trimmed);
      this.rl.prompt();
      return;
    }

    // 处理普通输入
    try {
      await this.handleUserInput(trimmed);
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
    }

    this.rl.prompt();
  }

  /**
   * 处理用户输入
   */
  private async handleUserInput(input: string): Promise<void> {
    // 添加用户消息
    this.messages.user(input);

    // 显示思考指示
    process.stdout.write(chalk.gray('Thinking...'));

    try {
      // 调用 AI
      const response = await this.provider.chat(this.messages.build());

      // 清除思考指示
      process.stdout.write('\r' + ' '.repeat(20) + '\r');

      // 添加助手消息
      this.messages.assistant(response.content);

      // 显示回复
      console.log(chalk.green(response.content));
      console.log();
    } catch (error) {
      // 清除思考指示
      process.stdout.write('\r' + ' '.repeat(20) + '\r');
      throw error;
    }
  }

  /**
   * 处理命令
   */
  private async handleCommand(input: string): Promise<void> {
    const [command, ...args] = input.split(/\s+/);
    const cmdName = command.toLowerCase();
    const argsStr = args.join(' ');

    const handler = this.commands.get(cmdName);
    if (handler) {
      await handler(argsStr);
    } else {
      console.log(chalk.red(`Unknown command: ${command}`));
      console.log(chalk.gray('Type /help for available commands.'));
    }
  }

  /**
   * 注册命令
   */
  private registerCommands(): void {
    // /help - 显示帮助
    this.commands.set('/help', async () => {
      console.log(chalk.cyan('Available commands:'));
      console.log('  /help     - Show this help');
      console.log('  /clear    - Clear conversation');
      console.log('  /history  - Show conversation history');
      console.log('  /model    - Show or change model');
      console.log('  /exit     - Exit the REPL');
    });

    // /clear - 清空对话
    this.commands.set('/clear', async () => {
      this.messages.clear();
      if (this.config.systemPrompt) {
        this.messages.system(this.config.systemPrompt);
      }
      console.log(chalk.green('Conversation cleared.'));
    });

    // /history - 显示历史
    this.commands.set('/history', async () => {
      const history = this.historyManager.getHistory();
      console.log(chalk.cyan(`Command history (${history.length} entries):`));
      history.slice(-10).forEach((entry, i) => {
        console.log(`  ${i + 1}. ${entry}`);
      });
    });

    // /model - 显示/切换模型
    this.commands.set('/model', async (args) => {
      if (args) {
        console.log(chalk.yellow(`Model switching not implemented. Current: ${this.config.model}`));
      } else {
        console.log(chalk.cyan(`Current model: ${this.config.model}`));
      }
    });

    // /exit - 退出
    this.commands.set('/exit', async () => {
      this.stop();
    });
  }

  /**
   * 补全函数
   */
  private async completerFunction(
    input: string,
    callback: (err: any, completions: [string[], string]) => void
  ): Promise<void> {
    try {
      const candidates = await this.completer.getCompletions(input);
      const completions = candidates.map(c => c.text);

      if (completions.length === 0) {
        callback(null, [[], input]);
        return;
      }

      // 找公共前缀
      const commonPrefix = this.findCommonPrefix(completions);
      callback(null, [completions, commonPrefix]);
    } catch (error) {
      callback(error, [[], input]);
    }
  }

  /**
   * 查找公共前缀
   */
  private findCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return '';
    if (strings.length === 1) return strings[0];

    let prefix = strings[0];
    for (const str of strings.slice(1)) {
      while (!str.startsWith(prefix)) {
        prefix = prefix.slice(0, -1);
        if (!prefix) return '';
      }
    }
    return prefix;
  }

  /**
   * 停止 REPL
   */
  stop(): void {
    this.running = false;
    this.rl.close();
  }
}
```

## 参数说明

### readline.Interface 选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `input` | Readable | - | 输入流 |
| `output` | Writable | - | 输出流 |
| `prompt` | string | '> ' | 提示符 |
| `historySize` | number | 30 | 历史大小 |
| `removeHistoryDuplicates` | boolean | false | 去重 |

### AIReplConfig 字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `prompt` | string | 'ai> ' | 提示符 |
| `welcomeMessage` | string | - | 欢迎消息 |
| `historyFile` | string | '.history' | 历史文件 |
| `model` | string | 'gpt-4-turbo' | 模型名 |
| `systemPrompt` | string | - | 系统提示 |

### CompletionCandidate 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `text` | string | 补全文本 |
| `display` | string | 显示文本 |
| `description` | string | 描述 |

## 练习题

### 练习 1: 实现语法高亮

```typescript
// exercises/01-syntax-highlight.ts
// TODO: 为输入的代码实现语法高亮
// 要求：
// 1. 检测输入中的代码块
// 2. 应用语法高亮
// 3. 支持多种语言

export class SyntaxHighlighter {
  // TODO: 实现
  highlight(input: string): string { return input; }
}
```

### 练习 2: 实现输入验证

```typescript
// exercises/02-input-validation.ts
// TODO: 实现输入验证器
// 要求：
// 1. 检测输入长度限制
// 2. 检测敏感信息
// 3. 提供友好的错误提示

export class InputValidator {
  // TODO: 实现
  validate(input: string): { valid: boolean; error?: string } {
    return { valid: true };
  }
}
```

### 练习 3: 实现会话恢复

```typescript
// exercises/03-session-resume.ts
// TODO: 实现会话恢复功能
// 要求：
// 1. 自动保存会话状态
// 2. 重启后恢复上次的会话
// 3. 支持多个命名会话

export class SessionPersistence {
  // TODO: 实现
  save(name: string): void {}
  load(name: string): boolean { return false; }
  list(): string[] { return []; }
}
```

### 练习 4: 实现快捷键

```typescript
// exercises/04-keybindings.ts
// TODO: 实现自定义快捷键
// 要求：
// 1. 支持 Ctrl+X 组合键
// 2. 支持自定义绑定
// 3. 显示快捷键帮助

export class KeyBindings {
  // TODO: 实现
  bind(key: string, action: () => void): void {}
  handle(key: string): boolean { return false; }
}
```

## 下一步

完成本节后，继续学习 [6.2 进度条和加载动画](./02-progress-display.md) →
