# 1.2 CLI 框架搭建

## 学习目标

掌握使用 Commander.js 构建专业级 CLI 应用的完整流程。

## 1. Commander.js 基础

### 安装和基本配置

```bash
pnpm add commander
```

**命令详解：**

| 命令部分 | 作用 | 详细解释 |
|---------|------|----------|
| `pnpm` | 包管理器 | 使用 pnpm 进行包管理，它比 npm 更快且更节省磁盘空间 |
| `add` | 添加依赖 | 将包添加到 `dependencies`（生产依赖）中 |
| `commander` | 包名 | Node.js 最流行的 CLI 框架，提供命令解析、选项定义、帮助生成等功能 |

**为什么选择 Commander.js？**
- **广泛使用**：超过 1.5 周下载量，稳定可靠
- **功能完整**：支持子命令、选项、参数、帮助生成
- **TypeScript 友好**：自带类型定义，IDE 支持好
- **文档完善**：官方文档详细，社区资源丰富

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

**代码逐行解释：**

| 代码 | 作用 | 详细解释 |
|------|------|----------|
| `import { Command } from 'commander'` | 导入 Command 类 | `Command` 是 commander 的核心类，用于创建和管理 CLI 程序 |
| `const program = new Command()` | 创建程序实例 | 初始化一个新的命令行程序，这是所有配置的基础对象 |
| `.name('mini-cli')` | 设置 CLI 名称 | 用于帮助信息显示，如 `Usage: mini-cli [options]` |
| `.description('...')` | 设置描述 | 在 `--help` 输出的开头显示程序的用途说明 |
| `.version('1.0.0')` | 设置版本号 | 自动添加 `-V, --version` 选项，运行时显示此版本 |
| `program.parse()` | 解析并执行 | 解析 `process.argv`（命令行参数数组），匹配并执行对应命令 |

**process.argv 是什么？**
- Node.js 内置的数组，包含命令行参数
- `process.argv[0]` = Node.js 可执行文件路径
- `process.argv[1]` = 当前脚本路径
- `process.argv[2:]` = 实际的命令行参数

运行：

```bash
tsx src/cli/minimal.ts --help
```

**运行结果：**
```
Usage: mini-cli [options]

A minimal AI coding CLI

Options:
  -V, --version  output the version number
  -h, --help     display help for command
```

```bash
tsx src/cli/minimal.ts --version
```

**运行结果：**
```
1.0.0
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

**代码详解：**

**1. 简单命令（无参数无选项）**
```typescript
program
  .command('hello')      // 定义命令名
  .description('Say hello')  // 命令描述，显示在帮助中
  .action(() => {...});  // 执行逻辑
```
- `.command('hello')` - 创建名为 `hello` 的子命令
- `.action()` - 定义命令被调用时的回调函数
- 使用方式：`tsx src/cli/commands.ts hello`

**2. 带参数的命令**
```typescript
program
  .command('greet <name>')  // <name> 是必需参数
  .action((name: string) => {...});
```
- `<name>` - 尖括号表示**必需参数**，如果不提供会报错
- 参数值会作为 `action` 回调的第一个参数传入
- 使用方式：`tsx src/cli/commands.ts greet John`

**3. 带选项的命令**
```typescript
.option('-m, --model <model>', 'AI model to use', 'gpt-4')
```

**选项语法完整解析：**

| 部分 | 示例 | 含义 |
|------|------|------|
| 短选项 | `-m` | 单字母简写，方便快速输入 |
| 长选项 | `--model` | 完整单词，更清晰 |
| 参数占位符 | `<model>` | 尖括号=必需，方括号=可选 |
| 描述 | `'AI model to use'` | 帮助信息中显示 |
| 默认值 | `'gpt-4'` | 未指定时使用的值 |

**选项类型详解：**
```typescript
// 带默认值的字符串选项
.option('-m, --model <model>', 'AI model to use', 'gpt-4')

// 需要类型转换的数字选项
.option('-t, --temperature <number>', 'Temperature', parseFloat, 0.7)
//          参数值 ↑              描述 ↑        转换函数 ↑     默认值 ↑

// 布尔标志选项（无需值）
.option('-v, --verbose', 'Enable verbose output')
// 出现即为 true，不出现为 undefined
```

**4. 可选参数命令**
```typescript
.command('ask [question]')  // [question] 方括号表示可选
.action((question?: string) => {...})
```
- `[question]` - 方括号表示**可选参数**
- 使用方式：`ask` 或 `ask "你的问题"`

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

**所有选项类型详解：**

| 类型 | 示例 | 说明 | 使用方式 |
|------|------|------|----------|
| 字符串 | `-m, --model <model>` | 默认就是字符串 | `--model gpt-4` |
| 数字 | `parseInt` 作为转换函数 | 需要显式转换 | `--timeout 5000` → 5000 |
| 布尔 | `-v, --verbose` | 出现即为 true | `--verbose` |
| 可重复 | `<files...>` | 收集所有值到数组 | `--file a.txt --file b.txt` → ['a.txt', 'b.txt'] |
| 必需 | `requiredOption()` | 不提供则报错 | 必须指定 |
| 自定义处理 | 传入函数 | 验证/转换值 | 可抛出错误拒绝无效值 |

**自定义处理函数详解：**
```typescript
.option(
  '-l, --log-level <level>',  // 选项定义
  'Log level',                // 描述
  (value: string) => {        // 处理函数：验证并转换用户输入
    const levels = ['debug', 'info', 'warn', 'error'];
    if (!levels.includes(value)) {
      throw new Error(`Invalid log level: ${value}`);
    }
    return value;
  },
  'info'  // 默认值
)
```
- 处理函数接收用户输入的字符串
- 返回转换后的值（可以是任意类型）
- 抛出错误会阻止程序继续执行

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

**子命令嵌套结构详解：**

```
mini-cli                       # 根命令
├── chat                       # 一级子命令（chatCommand）
│   ├── start                  # 二级子命令
│   ├── resume <session-id>    # 二级子命令（带参数）
│   └── list                   # 二级子命令
└── config                     # 一级子命令（configCommand）
    ├── set <key> <value>      # 二级子命令（带多个参数）
    ├── get <key>              # 二级子命令
    └── list                   # 二级子命令
```

**代码结构解析：**

```typescript
// 步骤 1: 创建一级子命令
const chatCommand = program
  .command('chat')              // 在 program 上定义 'chat' 命令
  .description('Interactive chat with AI');

// 步骤 2: 在一级命令上定义二级子命令
chatCommand
  .command('start')             // 在 chatCommand 上定义 'start' 子命令
  .option('-m, --model <model>', 'Model to use', 'gpt-4')
  .action((options) => {...});
```

**使用方式：**
```bash
# chat 命令组
tsx src/cli/subcommands.ts chat start -m gpt-4    # 启动聊天
tsx src/cli/subcommands.ts chat resume abc123     # 恢复会话
tsx src/cli/subcommands.ts chat list              # 列出会话

# config 命令组
tsx src/cli/subcommands.ts config set model gpt-4 # 设置配置
tsx src/cli/subcommands.ts config get model       # 获取配置
tsx src/cli/subcommands.ts config list            # 列出所有配置
```

**为什么使用子命令？**
1. **组织性**：相关功能归类到同一命令组（如 chat、config）
2. **可扩展**：添加新功能只需在对应命令组下新增子命令
3. **用户体验**：命令结构清晰，易于理解和使用

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

**代码详解：**

```typescript
// 1. 创建 readline 接口
const rl = readline.createInterface({
  input: process.stdin,   // 标准输入（键盘）
  output: process.stdout  // 标准输出（终端）
});
```
- `readline` 是 Node.js 内置模块，用于逐行读取输入
- `process.stdin` - 标准输入流，接收用户键盘输入
- `process.stdout` - 标准输出流，向终端显示内容

```typescript
// 2. 将 rl.question 封装为 Promise
function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);  // prompt 是提示文字，resolve 是回调函数
  });
}
```
- `rl.question()` 原本是回调风格，封装后可用 `await`
- 使用方式：`const answer = await question('Your name: ')`

```typescript
// 3. 交互循环
while (true) {
  const input = await question('You: ');  // 等待用户输入

  if (input.toLowerCase() === 'exit') {
    rl.close();  // 关闭 readline 接口，释放资源
    break;       // 退出循环
  }

  console.log('AI:', `You said: "${input}"`);
}
```
- `while (true)` - 无限循环，持续接收输入
- `rl.close()` - 必须调用，否则程序不会退出

### 使用 inquirer (更强大的交互)

```bash
pnpm add inquirer
pnpm add -D @types/inquirer
```

**命令详解：**

| 命令部分 | 作用 | 详细解释 |
|---------|------|----------|
| `pnpm add inquirer` | 安装 inquirer | 功能丰富的交互式命令行界面库，支持多种问题类型 |
| `-D` 或 `--save-dev` | 添加到开发依赖 | `@types/inquirer` 只在开发时需要，不会打包到生产代码 |
| `@types/inquirer` | TypeScript 类型定义 | 让 TypeScript 能识别 inquirer 的 API，提供类型检查和智能提示 |

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

**inquirer 问题类型详解：**

| type | 名称 | 用途 | 返回值类型 |
|------|------|------|-----------|
| `input` | 文本输入 | 获取用户输入的字符串 | `string` |
| `number` | 数字输入 | 获取数字，自动转换 | `number` |
| `password` | 密码输入 | 输入内容不可见 | `string` |
| `list` | 单选列表 | 从选项中选择一个 | `string` |
| `rawlist` | 编号单选 | 输入编号选择 | `string` |
| `checkbox` | 多选列表 | 可选择多个选项 | `string[]` |
| `confirm` | 确认 | Yes/No 选择 | `boolean` |
| `expand` | 展开选择 | 按键快速选择 | `string` |

**问题配置字段详解：**

| 字段 | 作用 | 示例 |
|------|------|------|
| `type` | 问题类型 | `'list'`, `'input'`, `'checkbox'` |
| `name` | 答案存储的键名 | `'model'` → `answers.model` |
| `message` | 显示给用户的提示 | `'Select AI model:'` |
| `choices` | 可选项列表（list/checkbox 用） | `[{ name: 'GPT-4', value: 'gpt-4' }]` |
| `default` | 默认值/默认选中 | `'gpt-4'` 或 `true` |
| `validate` | 验证函数，返回 true 或错误消息 | `(input) => input.length > 0` |
| `when` | 条件函数，决定是否显示此问题 | `(answers) => answers.needApiKey` |
| `filter` | 过滤函数，对输入进行转换 | `(input) => input.toLowerCase()` |

**choices 配置详解：**
```typescript
choices: [
  { name: 'GPT-4 (Recommended)', value: 'gpt-4' },  // name=显示文字, value=实际值
  { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo', short: 'GPT-3.5' },  // short=选中后显示
  new inquirer.Separator(),  // 分隔线
  { name: 'Other', value: 'other', disabled: 'Coming soon' },  // 禁用选项
]
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

**package.json 关键字段详解：**

| 字段 | 值 | 作用 | 详细解释 |
|------|-----|------|----------|
| `name` | `"mini-ai-cli"` | 包名 | npm 上的唯一标识符，安装后作为命令名（如果配置了 bin） |
| `version` | `"1.0.0"` | 版本号 | 遵循语义化版本规范：`主版本.次版本.补丁版本` |
| `type` | `"module"` | 模块类型 | 使用 ES Module（import/export），而不是 CommonJS（require） |
| `bin` | `{...}` | 命令映射 | key 是命令名，value 是可执行文件路径。用户安装后可运行该命令 |
| `files` | `["dist"]` | 发布文件 | 发布到 npm 时只包含这些文件/目录，避免发布源码和测试文件 |

**bin 配置详解：**
```json
"bin": {
  "mini-cli": "./dist/index.js"
}
```
- `mini-cli` - 用户安装后可以在终端运行的命令名
- `./dist/index.js` - 入口文件路径（相对于 package.json）
- 入口文件必须有 shebang：`#!/usr/bin/env node`

**scripts 字段详解：**

| 脚本 | 命令 | 作用 | 详细解释 |
|------|------|------|----------|
| `build` | `tsc` | 编译 TypeScript | 调用 TypeScript 编译器，根据 tsconfig.json 配置将 `.ts` 编译成 `.js` |
| `dev` | `tsx src/index.ts` | 开发运行 | 使用 tsx 直接运行 TypeScript，支持热重载和 sourcemap |
| `start` | `node dist/index.js` | 生产运行 | 直接运行编译后的 JavaScript 文件 |
| `prepublishOnly` | `npm run build` | 发布前钩子 | 执行 `npm publish` 前自动运行，确保发布的代码是最新编译的 |

**dependencies vs devDependencies：**

| 类型 | 包 | 原因 |
|------|-----|------|
| `dependencies` | `commander`, `chalk`, `inquirer` | 运行时需要，用户安装包时会一起安装 |
| `devDependencies` | `typescript`, `tsx`, `@types/*` | 仅开发和编译时需要，用户安装包时不会安装 |

### 本地测试

```bash
# 链接到全局
pnpm link --global
```

**命令详解：**

| 命令部分 | 作用 | 详细解释 |
|---------|------|----------|
| `pnpm` | 包管理器 | 使用 pnpm 执行命令 |
| `link` | 创建符号链接 | 将当前项目链接到全局 node_modules |
| `--global` | 全局模式 | 链接到全局目录，使得可以在任何位置使用 |

**链接后发生了什么？**
1. 在全局 `node_modules` 创建指向当前项目的符号链接
2. 注册 `bin` 中定义的命令
3. 现在可以在任意目录运行 `mini-cli` 命令

```bash
# 现在可以运行
mini-cli --help
mini-cli chat
```

```bash
# 取消链接
pnpm unlink --global
```

**取消链接的作用：**
- 移除全局符号链接
- `mini-cli` 命令将不再可用

**完整发布流程：**
```bash
# 1. 编译代码
pnpm build

# 2. 本地测试
pnpm link --global
mini-cli --help  # 测试命令

# 3. 取消链接
pnpm unlink --global

# 4. 发布到 npm（需要有账号）
npm login
npm publish
```

## 练习

1. **添加版本检查**: 实现检查是否有新版本可用
2. **添加彩色输出**: 使用 chalk 美化输出
3. **添加进度条**: 实现长时间操作时的进度显示

## 下一步

完成本节后，继续学习 [1.3 文件系统操作](./03-file-system.md) →
