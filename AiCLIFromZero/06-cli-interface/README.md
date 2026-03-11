# 第06章：CLI 界面

> 实现专业的交互式命令行界面

## 学习目标

完成本章后，你将能够：

1. 设计交互式 REPL
2. 实现进度条和加载动画
3. 解析和路由命令
4. 构建 TUI 配置界面

## 章节内容

- [6.1 交互式 REPL 设计](./01-repl-design.md)
- [6.2 进度显示](./02-progress-display.md)
- [6.3 命令解析和路由](./03-command-routing.md)
- [6.4 配置界面](./04-config-ui.md)

## 核心架构

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          CLI 界面架构                                       │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   ┌───────────────────────────────────────────────────────────────────┐  │
│   │                           Input Handler                           │  │
│   │                                                                   │  │
│   │  • 读取用户输入                                                  │  │
│   │  • 处理多行输入                                                  │  │
│   │  • 支持历史记录                                                  │  │
│   │  • 自动补全                                                      │  │
│   └───────────────────────────────┬───────────────────────────────────┘  │
│                                   │                                       │
│                                   ▼                                       │
│   ┌───────────────────────────────────────────────────────────────────┐  │
│   │                          Command Parser                           │  │
│   │                                                                   │  │
│   │  /help     ──▶ 显示帮助                                          │  │
│   │  /config   ──▶ 配置管理                                          │  │
│   │  /model    ──▶ 模型切换                                          │  │
│   │  /clear    ──▶ 清除历史                                          │  │
│   │  其他      ──▶ 发送给 AI                                         │  │
│   └───────────────────────────────┬───────────────────────────────────┘  │
│                                   │                                       │
│                                   ▼                                       │
│   ┌───────────────────────────────────────────────────────────────────┐  │
│   │                          Output Renderer                          │  │
│   │                                                                   │  │
│   │  • Markdown 渲染                                                 │  │
│   │  • 代码高亮                                                      │  │
│   │  • 流式显示                                                      │  │
│   │  • 进度指示                                                      │  │
│   └───────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## 完整 REPL 实现

```typescript
// src/ui/repl.ts
import * as readline from 'readline';
import chalk from 'chalk';
import { SessionManager } from '../managers/session-manager.js';
import { CommandHandler } from './command-handler.js';

export class REPL {
  private rl: readline.Interface;
  private session: SessionManager;
  private commands: CommandHandler;
  private running = true;

  constructor(private config: REPLConfig) {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: config.prompt || '> ',
      historySize: 1000,
    });

    this.session = new SessionManager(config.sessionConfig);
    this.commands = new CommandHandler(this.session);
  }

  // 启动 REPL
  async start(): Promise<void> {
    this.printWelcome();

    this.rl.on('line', async (input) => {
      await this.handleInput(input.trim());
      if (this.running) {
        this.rl.prompt();
      }
    });

    this.rl.on('close', () => {
      this.printGoodbye();
    });

    this.rl.prompt();
  }

  // 处理输入
  private async handleInput(input: string): Promise<void> {
    if (!input) return;

    // 检查是否是命令
    if (input.startsWith('/')) {
      await this.commands.handle(input);
      return;
    }

    // 发送给 AI
    await this.sendToAI(input);
  }

  // 发送给 AI
  private async sendToAI(input: string): Promise<void> {
    // 添加用户消息
    await this.session.addMessage({
      role: 'user',
      content: input,
    });

    // 显示 AI 响应
    process.stdout.write(chalk.blue('\nAI: '));

    const provider = this.session.getProvider();
    const messages = this.session.getMessagesForAPI();

    let fullResponse = '';
    for await (const chunk of provider.stream(messages)) {
      process.stdout.write(chunk.delta);
      fullResponse += chunk.delta;
    }

    console.log('\n');

    // 添加 AI 响应
    await this.session.addMessage({
      role: 'assistant',
      content: fullResponse,
    });
  }

  // 打印欢迎信息
  private printWelcome(): void {
    console.log(chalk.blue(`
╔════════════════════════════════════════════╗
║          Mini AI CLI v1.0.0                ║
║  Your intelligent coding assistant         ║
╚════════════════════════════════════════════╝
    `));
    console.log(chalk.gray('Type /help for available commands\n'));
  }

  // 打印告别信息
  private printGoodbye(): void {
    console.log(chalk.blue('\nGoodbye! 👋\n'));
  }
}
```

## 学习检验

完成本章后，你应该能够：

- [ ] 实现交互式命令行界面
- [ ] 处理多行输入和历史记录
- [ ] 实现漂亮的输出渲染
- [ ] 构建命令系统

## 下一步

开始学习 [6.1 交互式 REPL 设计](./01-repl-design.md) →
