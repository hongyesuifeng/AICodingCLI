# 第01章：基础入门

> 掌握 CLI 开发基础和 TypeScript 异步编程

## 学习目标

完成本章后，你将能够：

1. 使用 TypeScript 编写异步代码
2. 使用 Commander.js 构建 CLI 应用
3. 实现安全的文件系统操作
4. 设计分层配置管理系统

## 章节内容

- [1.1 TypeScript 异步编程基础](./01-async-programming.md)
- [1.2 CLI 框架搭建](./02-cli-framework.md)
- [1.3 文件系统操作](./03-file-system.md)
- [1.4 配置管理](./04-config-management.md)

## 实践项目：Mini CLI 框架

```
mini-cli/
├── src/
│   ├── index.ts              # 入口
│   ├── cli.ts                # CLI 定义
│   ├── commands/
│   │   ├── chat.ts           # chat 命令
│   │   └── config.ts         # config 命令
│   ├── utils/
│   │   ├── file.ts           # 文件操作
│   │   └── config.ts         # 配置加载
│   └── types/
│       └── index.ts          # 类型定义
├── package.json
└── tsconfig.json
```

## 核心概念

### CLI 应用架构

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI 应用分层架构                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                    入口层                            │  │
│   │  • 解析命令行参数                                    │  │
│   │  • 初始化配置                                        │  │
│   │  • 设置日志级别                                      │  │
│   └─────────────────────────┬───────────────────────────┘  │
│                             │                               │
│   ┌─────────────────────────▼───────────────────────────┐  │
│   │                    命令层                            │  │
│   │  ┌───────────┐  ┌───────────┐  ┌───────────────┐   │  │
│   │  │   chat    │  │   ask     │  │    config     │   │  │
│   │  └───────────┘  └───────────┘  └───────────────┘   │  │
│   └─────────────────────────┬───────────────────────────┘  │
│                             │                               │
│   ┌─────────────────────────▼───────────────────────────┐  │
│   │                    服务层                            │  │
│   │  • 文件操作                                          │  │
│   │  • 配置管理                                          │  │
│   │  • 日志服务                                          │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 异步编程模式

```typescript
// Promise 基础
function readFile(path: string): Promise<string> {
  return fs.promises.readFile(path, 'utf-8');
}

// async/await
async function loadConfig(path: string): Promise<Config> {
  const content = await readFile(path);
  return JSON.parse(content);
}

// 流式处理
async function* readLines(path: string): AsyncGenerator<string> {
  const stream = fs.createReadStream(path, 'utf-8');
  const rl = readline.createInterface({ input: stream });

  for await (const line of rl) {
    yield line;
  }
}
```

## 快速开始

### 1. 创建项目

```bash
mkdir mini-cli && cd mini-cli
```

**命令详解：**

| 命令部分 | 作用 | 详细解释 |
|---------|------|----------|
| `mkdir mini-cli` | 创建目录 | `mkdir` = make directory，创建一个名为 `mini-cli` 的新文件夹 |
| `&&` | 逻辑与操作符 | 只有前一个命令成功（退出码为0）才会执行后面的命令。这样可以避免在创建目录失败时执行 cd |
| `cd mini-cli` | 切换目录 | `cd` = change directory，进入刚创建的目录 |

**为什么这样设计？**
- 每个项目都需要独立的目录，保持代码隔离
- 使用 `&&` 连接命令比分开执行更安全、更高效

```bash
pnpm init
```

**命令详解：**

| 命令部分 | 作用 | 详细解释 |
|---------|------|----------|
| `pnpm` | 包管理器 | 高效的 Node.js 包管理器，比 npm 更快、更省空间 |
| `init` | 初始化项目 | 交互式创建 `package.json` 文件 |

**生成的 `package.json` 作用：**
- 记录项目名称、版本、描述等元信息
- 管理 dependencies（运行时依赖）和 devDependencies（开发依赖）
- 定义 scripts（可执行的脚本命令）
- 配置项目的入口文件和打包信息

```bash
pnpm add typescript tsx commander @types/node
```

**每个依赖包的详解：**

| 包名 | 类型 | 作用 | 为什么需要 |
|------|------|------|------------|
| `typescript` | 开发依赖 | TypeScript 编译器 | 将 `.ts` 文件编译成 `.js` 文件，提供类型检查功能 |
| `tsx` | 开发依赖 | TypeScript 执行器 | 可以直接运行 `.ts` 文件，无需先编译。开发时极大提升效率，支持热重载和 sourcemap |
| `commander` | 生产依赖 | CLI 框架 | Node.js 最流行的命令行框架，用于解析命令行参数、定义命令和选项、生成帮助信息 |
| `@types/node` | 开发依赖 | Node.js 类型定义 | 让 TypeScript 能识别 Node.js 内置模块（如 `fs`、`path`、`process`）的类型，提供智能提示 |

**为什么选择 pnpm 而不是 npm？**
1. **磁盘空间节省**：pnpm 使用硬链接，所有项目共享同一个依赖存储
2. **安装速度更快**：并行安装 + 链接机制
3. **严格的依赖管理**：避免"幽灵依赖"（使用未声明的包）

### 2. 配置 TypeScript

在项目根目录创建 `tsconfig.json` 文件：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

**每个配置项的详解：**

| 配置项 | 值 | 作用 | 详细解释 |
|--------|-----|------|----------|
| `target` | `ES2022` | 编译目标版本 | 编译后的 JavaScript 代码使用 ES2022 语法标准。ES2022 支持 `top-level await`、`class fields`、`private methods` 等现代特性 |
| `module` | `ESNext` | 模块系统 | 使用最新的 ES Module（import/export）而非 CommonJS（require）。这是 Node.js 和浏览器的未来标准 |
| `moduleResolution` | `bundler` | 模块解析策略 | `bundler` 模式适合使用 tsx/esbuild/webpack 等工具的项目。它会正确处理 `.js` 扩展名的导入 |
| `strict` | `true` | 严格模式 | 启用所有严格类型检查选项，包括 `noImplicitAny`、`strictNullChecks` 等。帮助在编译时发现更多潜在 bug |
| `esModuleInterop` | `true` | ESM 互操作 | 允许从 CommonJS 模块中 default import。例如可以写 `import fs from 'fs'` 而不是 `import * as fs from 'fs'` |
| `outDir` | `dist` | 输出目录 | 编译后的 `.js` 文件存放在 `dist` 目录，与源码分离 |
| `rootDir` | `src` | 源码目录 | 告诉编译器所有 `.ts` 源文件都在 `src` 目录下 |
| `include` | `["src/**/*"]` | 包含文件 | `**` 匹配任意目录，`*` 匹配任意文件。表示编译 `src` 下所有文件 |

**为什么需要 tsconfig.json？**
- TypeScript 需要知道如何编译你的代码
- 配置类型检查的严格程度
- 指定输入输出目录，保持项目结构清晰

### 3. 创建入口文件

创建 `src/index.ts` 文件：

```typescript
// src/index.ts
import { Command } from 'commander';

const program = new Command();

program
  .name('mini-cli')
  .description('Mini AI Coding CLI')
  .version('1.0.0');

program
  .command('chat')
  .description('Start interactive chat')
  .option('-m, --model <model>', 'AI model to use')
  .action(async (options) => {
    console.log('Starting chat with model:', options.model);
  });

program.parse();
```

**代码逐行解释：**

| 代码行 | 作用 | 详细解释 |
|--------|------|----------|
| `import { Command } from 'commander'` | 导入 Command 类 | 从 commander 库导入命令类，用于创建 CLI 程序 |
| `const program = new Command()` | 创建 CLI 实例 | 初始化一个命令行程序对象，所有命令都基于这个实例 |
| `.name('mini-cli')` | 设置程序名 | 显示在帮助信息中，例如 `Usage: mini-cli [options]` |
| `.description('...')` | 设置描述 | 程序的简短描述，显示在 `--help` 输出的开头 |
| `.version('1.0.0')` | 设置版本 | 支持 `--version` 或 `-V` 选项显示版本号 |
| `.command('chat')` | 定义子命令 | 创建名为 `chat` 的子命令，用户运行 `mini-cli chat` |
| `.option('-m, --model <model>')` | 定义选项 | `-m` 是短格式，`--model` 是长格式，`<model>` 表示必需参数（尖括号） |
| `.action(async (options) => {...})` | 定义执行逻辑 | 当命令被调用时执行的回调函数，`options` 包含解析后的选项值 |
| `program.parse()` | 解析命令行 | 解析 `process.argv`（命令行参数）并执行相应命令 |

**Commander.js 选项语法详解：**
- `<value>` - 必需参数（尖括号）
- `[value]` - 可选参数（方括号）
- `..` - 可变参数
- `-v, --verbose` - 布尔标志（无需值，出现即为 true）

### 4. 运行测试

```bash
tsx src/index.ts --help
```

**命令详解：**

| 命令部分 | 作用 | 详细解释 |
|---------|------|----------|
| `tsx` | TypeScript 执行器 | 直接运行 `.ts` 文件，内部使用 esbuild 进行快速编译 |
| `src/index.ts` | 入口文件 | 要执行的 TypeScript 源文件 |
| `--help` | 帮助选项 | Commander.js 内置选项，显示程序帮助信息 |

**输出示例：**
```
Usage: mini-cli [options] [command]

Mini AI Coding CLI

Options:
  -V, --version   output the version number
  -h, --help      display help for command

Commands:
  chat            Start interactive chat
  help [command]  display help for command
```

```bash
tsx src/index.ts chat -m gpt-4
```

**命令详解：**

| 命令部分 | 作用 | 详细解释 |
|---------|------|----------|
| `chat` | 子命令 | 调用我们定义的 chat 命令 |
| `-m gpt-4` | 选项参数 | `-m` 是 `--model` 的简写，`gpt-4` 是传入的值 |

**输出：**
```
Starting chat with model: gpt-4
```

## 学习检验

完成本章后，你应该能够：

- [ ] 编写一个基本的 CLI 应用
- [ ] 使用 async/await 处理异步操作
- [ ] 实现文件读取和写入
- [ ] 设计配置加载机制

## 练习题

1. **CLI 命令扩展**: 添加 `version` 和 `info` 命令
2. **配置文件支持**: 实现 JSON/YAML 配置文件加载
3. **日志系统**: 添加不同级别的日志输出
4. **错误处理**: 实现优雅的错误处理和退出

## 下一步

完成本章后，继续学习 [第02章：AI 模型集成](../02-ai-integration/README.md) →
