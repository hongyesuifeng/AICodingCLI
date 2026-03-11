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
pnpm init
pnpm add typescript tsx commander @types/node
```

### 2. 配置 TypeScript

```json
// tsconfig.json
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

### 3. 创建入口文件

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

### 4. 运行测试

```bash
tsx src/index.ts --help
tsx src/index.ts chat -m gpt-4
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
