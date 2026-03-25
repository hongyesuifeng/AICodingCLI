// src/cli/repl.ts
import * as readline from 'readline';
import chalk from 'chalk';
import type { REPLConfig } from './types.js';
import { HistoryManager } from './history.js';
import { CommandRegistry, builtinCommands } from './command/index.js';
import type { SessionManager } from '../managers/session-manager.js';

// AI REPL 配置
export interface AIReplConfig extends REPLConfig {
  sessionManager?: SessionManager;
  onMessage?: (message: string) => Promise<string>;
}

// AI REPL
export class AIRepl {
  private rl: readline.Interface;
  private running = false;
  private historyManager: HistoryManager;
  private commandRegistry: CommandRegistry;
  private config: AIReplConfig;

  constructor(config: AIReplConfig = {}) {
    this.config = {
      prompt: config.prompt ?? 'ai> ',
      welcomeMessage: config.welcomeMessage ?? 'Welcome to AI CLI! Type /help for commands.',
      goodbyeMessage: config.goodbyeMessage ?? 'Goodbye!',
      historyFile: config.historyFile ?? './.ai-cli-history',
      historySize: config.historySize ?? 1000,
      sessionManager: config.sessionManager,
      onMessage: config.onMessage,
    };

    // 初始化 readline
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.config.prompt!,
      historySize: this.config.historySize!,
      removeHistoryDuplicates: true,
      completer: this.completer.bind(this),
    });

    // 初始化历史
    this.historyManager = new HistoryManager(
      this.config.historyFile!,
      this.config.historySize!
    );
    (this.rl as any).history = this.historyManager.getHistory();

    // 初始化命令注册表
    this.commandRegistry = new CommandRegistry();
    this.commandRegistry.registerAll(builtinCommands);
  }

  // 启动 REPL
  start(): void {
    this.running = true;

    // 打印欢迎信息
    this.printWelcome();

    // 显示提示符
    this.rl.prompt();

    // 监听输入
    this.rl.on('line', async (input) => {
      await this.handleLine(input);
    });

    // 监听关闭
    this.rl.on('close', () => {
      this.printGoodbye();
    });
  }

  // 处理输入行
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

  // 处理用户输入
  private async handleUserInput(input: string): Promise<void> {
    // 添加用户消息
    if (this.config.sessionManager) {
      await this.config.sessionManager.addMessage({
        role: 'user',
        content: input,
      });
    }

    // 显示 AI 响应
    process.stdout.write(chalk.cyan('\nAI: '));

    // 调用消息处理器
    if (this.config.onMessage) {
      const response = await this.config.onMessage(input);
      process.stdout.write(response);
      process.stdout.write('\n\n');

      // 添加 AI 响应
      if (this.config.sessionManager) {
        await this.config.sessionManager.addMessage({
          role: 'assistant',
          content: response,
        });
      }
    }
  }

  // 处理命令
  private async handleCommand(input: string): Promise<void> {
    try {
      await this.commandRegistry.execute(input, this);
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      console.log(chalk.gray('Type /help for available commands.'));
    }
  }

  // 补全函数
  private async completer(
    input: string,
    callback: (err: any, result: [string[], string]) => void
  ): Promise<void> {
    try {
      const completions = this.commandRegistry.getCompletions(input);

      if (completions.length === 0) {
        callback(null, [[], input]);
        return;
      }

      const texts = completions.map(c => c.text);
      const commonPrefix = this.findCommonPrefix(texts);

      callback(null, [texts, commonPrefix]);
    } catch (error) {
      callback(error, [[], input]);
    }
  }

  // 查找公共前缀
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

  // 打印欢迎信息
  private printWelcome(): void {
    console.log(chalk.cyan.bold(`
╔════════════════════════════════════════════╗
║          Mini AI CLI v1.0.0                 ║
║  Your intelligent coding assistant          ║
╚════════════════════════════════════════════╝
    `));
    console.log(chalk.gray(this.config.welcomeMessage));
    console.log();
  }

  // 打印告别信息
  private printGoodbye(): void {
    console.log(chalk.cyan(`\n${this.config.goodbyeMessage}\n`));
  }

  // 停止 REPL
  stop(): void {
    this.running = false;
    this.rl.close();
  }

  // 获取命令注册表
  getCommandRegistry(): CommandRegistry {
    return this.commandRegistry;
  }

  // 获取会话管理器
  getSessionManager(): SessionManager | undefined {
    return this.config.sessionManager;
  }
}
