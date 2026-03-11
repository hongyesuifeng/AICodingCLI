# 1.2 CLI 框架搭建

## 学习目标

掌握使用 Commander.js 构建专业级 CLI 应用的完整流程。

## 1. Commander.js 基础

### 安装和基本配置

```bash
pnpm add commander
```

### 最小化 CLI

```typescript
// src/cli/minimal.ts
import { Command } from 'commander';

const program = new Command();

program
  .name('mini-cli')
  .description('A minimal AI coding CLI')
  .version('1.0.0');

program.parse();
```

运行：

```bash
tsx src/cli/minimal.ts --help
tsx src/cli/minimal.ts --version
```

## 2. 命令定义

### 基本命令

```typescript
// src/cli/commands.ts
import { Command } from 'commander';

const program = new Command();

// 简单命令
program
  .command('hello')
  .description('Say hello')
  .action(() => {
    console.log('Hello, World!');
  });

// 带参数的命令
program
  .command('greet <name>')
  .description('Greet someone')
  .action((name: string) => {
    console.log(`Hello, ${name}!`);
  });

// 带选项的命令
program
  .command('chat')
  .description('Start interactive chat')
  .option('-m, --model <model>', 'AI model to use', 'gpt-4')
  .option('-t, --temperature <number>', 'Temperature', parseFloat, 0.7)
  .option('-v, --verbose', 'Enable verbose output')
  .action((options) => {
    console.log('Model:', options.model);
    console.log('Temperature:', options.temperature);
    console.log('Verbose:', options.verbose);
  });

// 可选参数
program
  .command('ask [question]')
  .description('Ask a question')
  .action((question?: string) => {
    if (question) {
      console.log('Question:', question);
    } else {
      console.log('Please provide a question');
    }
  });

program.parse();
```

### 命令选项类型

```typescript
// src/cli/options.ts
import { Command } from 'commander';

const program = new Command();

program
  .command('configure')
  .description('Configure the CLI')

  // 字符串选项
  .option('-m, --model <model>', 'AI model name')

  // 数字选项
  .option('-t, --timeout <ms>', 'Timeout in milliseconds', parseInt)

  // 布尔选项
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-q, --quiet', 'Suppress output')

  // 可重复选项
  .option('-f, --file <files...>', 'Files to process')

  // 必需选项
  .requiredOption('-k, --api-key <key>', 'API key (required)')

  // 带默认值
  .option('-p, --port <number>', 'Server port', '3000')

  // 自定义处理
  .option(
    '-l, --log-level <level>',
    'Log level',
    (value: string) => {
      const levels = ['debug', 'info', 'warn', 'error'];
      if (!levels.includes(value)) {
        throw new Error(`Invalid log level: ${value}`);
      }
      return value;
    },
    'info'
  )

  .action((options) => {
    console.log('Options:', options);
  });

program.parse();
```

## 3. 子命令和嵌套

### 子命令模式

```typescript
// src/cli/subcommands.ts
import { Command } from 'commander';

const program = new Command();

// 主程序
program
  .name('mini-cli')
  .description('AI Coding CLI')
  .version('1.0.0');

// chat 子命令
const chatCommand = program
  .command('chat')
  .description('Interactive chat with AI');

chatCommand
  .command('start')
  .description('Start a new chat session')
  .option('-m, --model <model>', 'Model to use', 'gpt-4')
  .action((options) => {
    console.log('Starting chat with', options.model);
  });

chatCommand
  .command('resume <session-id>')
  .description('Resume a previous session')
  .action((sessionId: string) => {
    console.log('Resuming session:', sessionId);
  });

chatCommand
  .command('list')
  .description('List all sessions')
  .action(() => {
    console.log('Listing sessions...');
  });

// config 子命令
const configCommand = program
  .command('config')
  .description('Manage configuration');

configCommand
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action((key: string, value: string) => {
    console.log(`Setting ${key} = ${value}`);
  });

configCommand
  .command('get <key>')
  .description('Get a configuration value')
  .action((key: string) => {
    console.log(`Getting ${key}`);
  });

configCommand
  .command('list')
  .description('List all configuration')
  .action(() => {
    console.log('Listing configuration...');
  });

program.parse();
```

## 4. 交互式命令

### 使用 readline

```typescript
// src/cli/interactive.ts
import * as readline from 'readline';
import { Command } from 'commander';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function interactiveChat(): Promise<void> {
  console.log('Welcome to Mini CLI Chat!');
  console.log('Type "exit" to quit.\n');

  while (true) {
    const input = await question('You: ');

    if (input.toLowerCase() === 'exit') {
      console.log('Goodbye!');
      rl.close();
      break;
    }

    // 模拟 AI 响应
    console.log('AI:', `You said: "${input}"`);
  }
}

const program = new Command();

program
  .command('chat')
  .description('Start interactive chat')
  .action(interactiveChat);

program.parse();
```

### 使用 inquirer (更强大的交互)

```bash
pnpm add inquirer
pnpm add -D @types/inquirer
```

```typescript
// src/cli/inquirer.ts
import inquirer from 'inquirer';
import { Command } from 'commander';

interface Answers {
  model: string;
  temperature: number;
  task: string;
}

async function setupWizard(): Promise<void> {
  const answers = await inquirer.prompt<Answers>([
    {
      type: 'list',
      name: 'model',
      message: 'Select AI model:',
      choices: [
        { name: 'GPT-4 (Recommended)', value: 'gpt-4' },
        { name: 'GPT-3.5 Turbo (Faster)', value: 'gpt-3.5-turbo' },
        { name: 'Claude 3 Opus', value: 'claude-3-opus' },
        { name: 'Claude 3 Sonnet', value: 'claude-3-sonnet' },
      ],
      default: 'gpt-4',
    },
    {
      type: 'number',
      name: 'temperature',
      message: 'Set temperature (0-1):',
      default: 0.7,
      validate: (input: number) => {
        if (input < 0 || input > 1) {
          return 'Temperature must be between 0 and 1';
        }
        return true;
      },
    },
    {
      type: 'checkbox',
      name: 'features',
      message: 'Enable features:',
      choices: [
        { name: 'Auto-save', value: 'autoSave', checked: true },
        { name: 'Syntax highlighting', value: 'syntaxHighlight' },
        { name: 'Code completion', value: 'codeCompletion' },
      ],
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'Enter your API key:',
      when: (answers) => answers.model.startsWith('gpt'),
      validate: (input: string) => {
        if (!input.startsWith('sk-')) {
          return 'API key must start with "sk-"';
        }
        return true;
      },
    },
    {
      type: 'expand',
      name: 'confirm',
      message: 'Save configuration?',
      choices: [
        { key: 'y', name: 'Yes', value: 'yes' },
        { key: 'n', name: 'No', value: 'no' },
        { key: 'e', name: 'Edit', value: 'edit' },
      ],
    },
  ]);

  console.log('\nConfiguration:');
  console.log(JSON.stringify(answers, null, 2));
}

const program = new Command();

program
  .command('setup')
  .description('Interactive setup wizard')
  .action(setupWizard);

program.parse();
```

## 5. 完整 CLI 示例

### 项目结构

```
src/
├── index.ts              # 入口
├── cli.ts                # CLI 定义
├── commands/
│   ├── index.ts          # 命令导出
│   ├── chat.ts           # chat 命令
│   ├── config.ts         # config 命令
│   └── session.ts        # session 命令
├── utils/
│   ├── logger.ts         # 日志工具
│   └── config.ts         # 配置工具
└── types/
    └── index.ts          # 类型定义
```

### 入口文件

```typescript
// src/index.ts
#!/usr/bin/env node

import { program } from './cli.js';

program.parse();
```

### CLI 定义

```typescript
// src/cli.ts
import { Command } from 'commander';
import { registerChatCommand } from './commands/chat.js';
import { registerConfigCommand } from './commands/config.js';
import { registerSessionCommand } from './commands/session.js';

export const program = new Command();

program
  .name('mini-cli')
  .description('AI Coding CLI - Your intelligent coding assistant')
  .version('1.0.0')
  .option('-d, --debug', 'Enable debug mode')
  .option('-c, --config <path>', 'Config file path')
  .hook('preAction', (thisCommand) => {
    // 在执行任何命令之前运行
    const options = thisCommand.opts();
    if (options.debug) {
      process.env.DEBUG = 'true';
      console.log('Debug mode enabled');
    }
  });

// 注册命令
registerChatCommand(program);
registerConfigCommand(program);
registerSessionCommand(program);

// 默认命令
program
  .argument('[message]')
  .description('Send a quick message to AI')
  .action(async (message?: string) => {
    if (message) {
      console.log('Processing:', message);
    } else {
      program.help();
    }
  });
```

### Chat 命令

```typescript
// src/commands/chat.ts
import { Command } from 'commander';
import chalk from 'chalk';

interface ChatOptions {
  model: string;
  temperature: number;
  verbose: boolean;
}

export function registerChatCommand(program: Command): void {
  const chat = program.command('chat');

  chat
    .description('Start interactive chat with AI')
    .option('-m, --model <model>', 'AI model to use', 'gpt-4')
    .option('-t, --temperature <number>', 'Temperature', parseFloat, 0.7)
    .option('-v, --verbose', 'Verbose output')
    .action(async (options: ChatOptions) => {
      console.log(chalk.blue('Starting chat...'));
      console.log(chalk.gray(`Model: ${options.model}`));
      console.log(chalk.gray(`Temperature: ${options.temperature}`));

      // TODO: 实现聊天逻辑
    });

  // chat 子命令
  chat
    .command('history')
    .description('Show chat history')
    .option('-l, --limit <number>', 'Number of messages', '10')
    .action((options) => {
      console.log('Showing last', options.limit, 'messages');
    });

  chat
    .command('clear')
    .description('Clear chat history')
    .action(() => {
      console.log('History cleared');
    });
}
```

### Config 命令

```typescript
// src/commands/config.ts
import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, saveConfig, getConfigPath } from '../utils/config.js';

export function registerConfigCommand(program: Command): void {
  const config = program.command('config');

  config
    .description('Manage CLI configuration')

    // 显示配置
    .command('list')
    .description('List all configuration')
    .action(() => {
      const cfg = loadConfig();
      console.log(chalk.blue('Configuration:'));
      console.log(JSON.stringify(cfg, null, 2));
    })

    // 设置配置
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action((key: string, value: string) => {
      const cfg = loadConfig();
      (cfg as any)[key] = value;
      saveConfig(cfg);
      console.log(chalk.green(`Set ${key} = ${value}`));
    })

    // 获取配置
    .command('get <key>')
    .description('Get a configuration value')
    .action((key: string) => {
      const cfg = loadConfig();
      const value = (cfg as any)[key];
      if (value !== undefined) {
        console.log(value);
      } else {
        console.log(chalk.yellow(`Key "${key}" not found`));
      }
    })

    // 显示配置文件路径
    .command('path')
    .description('Show config file path')
    .action(() => {
      console.log(getConfigPath());
    });
}
```

## 6. 打包和发布

### package.json 配置

```json
{
  "name": "mini-ai-cli",
  "version": "1.0.0",
  "description": "AI Coding CLI",
  "type": "module",
  "bin": {
    "mini-cli": "./dist/index.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "chalk": "^5.3.0",
    "inquirer": "^9.2.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsx": "^4.7.0",
    "@types/node": "^20.0.0",
    "@types/inquirer": "^9.0.0"
  }
}
```

### 本地测试

```bash
# 链接到全局
pnpm link --global

# 现在可以运行
mini-cli --help
mini-cli chat

# 取消链接
pnpm unlink --global
```

## 练习

1. **添加版本检查**: 实现检查是否有新版本可用
2. **添加彩色输出**: 使用 chalk 美化输出
3. **添加进度条**: 实现长时间操作时的进度显示

## 下一步

完成本节后，继续学习 [1.3 文件系统操作](./03-file-system.md) →
