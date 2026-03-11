#!/usr/bin/env node
/**
 * Mini AI CLI - 最小可用版本
 *
 * 这是完成所有章节学习后的完整示例项目
 * 包含所有核心功能：多模型支持、工具系统、会话管理
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'readline';
import { OpenAIProvider } from './providers/openai.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { ToolRegistry } from './tools/registry.js';
import { SessionManager } from './session/manager.js';
import { registerBuiltInTools } from './tools/built-in.js';
import { loadConfig } from './config/loader.js';

// ============ 类型定义 ============

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CLIOptions {
  model: string;
  debug: boolean;
}

// ============ Provider 创建 ============

function createProvider(model: string, config: any) {
  if (model.includes('gpt') || model.includes('o1') || model.includes('o3')) {
    return new OpenAIProvider({
      apiKey: config.ai.apiKey || process.env.OPENAI_API_KEY,
      model,
    });
  }

  if (model.includes('claude')) {
    return new AnthropicProvider({
      apiKey: config.ai.apiKey || process.env.ANTHROPIC_API_KEY,
      model,
    });
  }

  throw new Error(`Unknown model: ${model}`);
}

// ============ REPL 实现 ============

class REPL {
  private rl: readline.Interface;
  private running = true;

  constructor(
    private provider: any,
    private session: SessionManager,
    private tools: ToolRegistry
  ) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.green('> '),
    });
  }

  async start(): Promise<void> {
    this.printWelcome();

    this.rl.on('line', async (input) => {
      await this.handleInput(input.trim());
      if (this.running) {
        this.rl.prompt();
      }
    });

    this.rl.on('close', () => {
      console.log(chalk.blue('\n再见! 👋\n'));
    });

    this.rl.prompt();
  }

  private printWelcome(): void {
    console.log(chalk.blue(`
╔═══════════════════════════════════════════════════════════════╗
║                    Mini AI CLI v1.0.0                         ║
║              Your intelligent coding assistant                ║
╠═══════════════════════════════════════════════════════════════╣
║  命令:                                                        ║
║    /help     - 显示帮助                                      ║
║    /clear    - 清除对话                                      ║
║    /model    - 切换模型                                      ║
║    /tools    - 列出工具                                      ║
║    /exit     - 退出                                          ║
╚═══════════════════════════════════════════════════════════════╝
    `));
  }

  private async handleInput(input: string): Promise<void> {
    if (!input) return;

    // 处理命令
    if (input.startsWith('/')) {
      await this.handleCommand(input);
      return;
    }

    // 发送给 AI
    await this.sendToAI(input);
  }

  private async handleCommand(command: string): Promise<void> {
    const [cmd, ...args] = command.slice(1).split(' ');

    switch (cmd) {
      case 'help':
        this.showHelp();
        break;

      case 'clear':
        this.session.clear();
        console.log(chalk.yellow('对话已清除'));
        break;

      case 'model':
        if (args[0]) {
          console.log(chalk.yellow(`切换到模型: ${args[0]}`));
          // 重新创建 provider
        } else {
          console.log(chalk.gray(`当前模型: ${this.provider.model}`));
        }
        break;

      case 'tools':
        console.log(chalk.blue('可用工具:'));
        for (const tool of this.tools.getAll()) {
          console.log(`  • ${tool.name}: ${tool.description}`);
        }
        break;

      case 'exit':
      case 'quit':
        this.running = false;
        this.rl.close();
        break;

      default:
        console.log(chalk.red(`未知命令: /${cmd}`));
    }
  }

  private showHelp(): void {
    console.log(chalk.blue(`
可用命令:
  /help           显示帮助
  /clear          清除对话历史
  /model <name>   切换 AI 模型
  /tools          列出可用工具
  /exit           退出程序
    `));
  }

  private async sendToAI(input: string): Promise<void> {
    // 添加用户消息
    this.session.addMessage({ role: 'user', content: input });

    // 获取 API 消息格式
    const messages = this.session.getMessagesForAPI();

    try {
      // 流式输出
      process.stdout.write(chalk.blue('\nAI: '));

      let fullResponse = '';

      for await (const chunk of this.provider.stream(messages)) {
        process.stdout.write(chunk.delta);
        fullResponse += chunk.delta;
      }

      console.log('\n');

      // 保存 AI 响应
      this.session.addMessage({ role: 'assistant', content: fullResponse });

    } catch (error) {
      console.error(chalk.red(`\n错误: ${(error as Error).message}`));
    }
  }
}

// ============ 主程序 ============

async function main() {
  // 加载配置
  const config = await loadConfig();

  // 设置命令行
  const program = new Command();

  program
    .name('mini-cli')
    .description('Mini AI Coding CLI')
    .version('1.0.0')
    .option('-m, --model <model>', 'AI model to use', config.ai.model)
    .option('-d, --debug', 'Enable debug mode');

  // chat 命令
  program
    .command('chat')
    .description('Start interactive chat')
    .action(async () => {
      const options = program.opts();

      // 创建 provider
      const provider = createProvider(options.model, config);

      // 创建工具注册表
      const tools = new ToolRegistry();
      registerBuiltInTools(tools);

      // 创建会话管理器
      const session = new SessionManager();

      // 启动 REPL
      const repl = new REPL(provider, session, tools);
      await repl.start();
    });

  // ask 命令
  program
    .command('ask <question>')
    .description('Ask a single question')
    .action(async (question: string) => {
      const options = program.opts();

      const provider = createProvider(options.model, config);

      console.log(chalk.gray('思考中...'));

      const result = await provider.chat([
        { role: 'user', content: question }
      ]);

      console.log(chalk.blue('\nAI:'), result.content);
    });

  // config 命令
  program
    .command('config')
    .description('Manage configuration')
    .command('list')
    .action(() => {
      console.log(JSON.stringify(config, null, 2));
    });

  // 默认动作
  program
    .argument('[message]')
    .action(async (message?: string) => {
      if (message) {
        // 快速问答
        const options = program.opts();
        const provider = createProvider(options.model, config);

        const result = await provider.chat([
          { role: 'user', content: message }
        ]);

        console.log(result.content);
      } else {
        // 启动聊天
        program.parse(['node', 'mini-cli', 'chat']);
      }
    });

  await program.parseAsync();
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
