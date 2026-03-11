# 第08章：完整项目

> 整合所有模块，构建完整的 AI CLI

## 学习目标

完成本章后，你将能够：

1. 设计和规划项目架构
2. 整合所有已学模块
3. 编写测试和调试
4. 打包和发布 CLI

## 章节内容

- [8.1 架构设计](./01-architecture.md)
- [8.2 代码整合](./02-integration.md)
- [8.3 测试和调试](./03-testing.md)
- [8.4 打包发布](./04-publishing.md)

## 最终项目结构

```
mini-ai-cli/
├── src/
│   ├── index.ts                    # 入口
│   ├── cli.ts                      # CLI 定义
│   │
│   ├── commands/                   # 命令实现
│   │   ├── index.ts
│   │   ├── chat.ts                 # chat 命令
│   │   ├── ask.ts                  # ask 命令
│   │   ├── config.ts               # config 命令
│   │   └── session.ts              # session 命令
│   │
│   ├── providers/                  # AI Provider
│   │   ├── index.ts
│   │   ├── base.ts                 # 基类
│   │   ├── openai.ts               # OpenAI
│   │   ├── anthropic.ts            # Anthropic
│   │   └── registry.ts             # 注册表
│   │
│   ├── tools/                      # 工具系统
│   │   ├── index.ts
│   │   ├── registry.ts             # 工具注册
│   │   ├── executor.ts             # 工具执行
│   │   └── built-in/               # 内置工具
│   │       ├── read-file.ts
│   │       ├── write-file.ts
│   │       ├── execute.ts
│   │       └── search.ts
│   │
│   ├── session/                    # 会话管理
│   │   ├── index.ts
│   │   ├── manager.ts              # 会话管理器
│   │   ├── storage.ts              # 存储实现
│   │   └── context.ts              # 上下文管理
│   │
│   ├── ui/                         # 用户界面
│   │   ├── index.ts
│   │   ├── repl.ts                 # 交互式 REPL
│   │   ├── renderer.ts             # 输出渲染
│   │   └── components/             # UI 组件
│   │       ├── progress.ts
│   │       └── spinner.ts
│   │
│   ├── mcp/                        # MCP 协议
│   │   ├── index.ts
│   │   ├── server.ts               # MCP 服务器
│   │   └── client.ts               # MCP 客户端
│   │
│   ├── skills/                     # 技能系统
│   │   ├── index.ts
│   │   ├── manager.ts              # 技能管理
│   │   └── built-in/               # 内置技能
│   │       ├── review.ts
│   │       └── commit.ts
│   │
│   ├── hooks/                      # 钩子系统
│   │   ├── index.ts
│   │   └── manager.ts              # 钩子管理
│   │
│   ├── git/                        # Git 集成
│   │   ├── index.ts
│   │   └── manager.ts              # Git 管理
│   │
│   ├── config/                     # 配置管理
│   │   ├── index.ts
│   │   ├── loader.ts               # 配置加载
│   │   └── models.ts               # 模型配置
│   │
│   ├── utils/                      # 工具函数
│   │   ├── file.ts                 # 文件操作
│   │   ├── logger.ts               # 日志
│   │   ├── error.ts                # 错误处理
│   │   └── retry.ts                # 重试机制
│   │
│   └── types/                      # 类型定义
│       ├── index.ts
│       ├── message.ts              # 消息类型
│       ├── tool.ts                 # 工具类型
│       ├── session.ts              # 会话类型
│       └── config.ts               # 配置类型
│
├── tests/                          # 测试
│   ├── providers/
│   ├── tools/
│   └── session/
│
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

## 核心入口

```typescript
// src/index.ts
#!/usr/bin/env node

import { Command } from 'commander';
import { registerChatCommand } from './commands/chat.js';
import { registerAskCommand } from './commands/ask.js';
import { registerConfigCommand } from './commands/config.js';
import { registerSessionCommand } from './commands/session.js';
import { loadConfig } from './config/loader.js';
import chalk from 'chalk';

async function main() {
  // 加载配置
  const config = await loadConfig();

  // 创建 CLI
  const program = new Command();

  program
    .name('mini-ai-cli')
    .description('AI Coding CLI - Your intelligent coding assistant')
    .version('1.0.0')
    .option('-m, --model <model>', 'AI model to use', config.ai.model)
    .option('-d, --debug', 'Enable debug mode')
    .hook('preAction', async (thisCommand) => {
      const options = thisCommand.opts();
      if (options.debug) {
        process.env.DEBUG = 'true';
      }
    });

  // 注册命令
  registerChatCommand(program);
  registerAskCommand(program);
  registerConfigCommand(program);
  registerSessionCommand(program);

  // 默认命令
  program
    .argument('[message]')
    .description('Send a quick message to AI')
    .action(async (message?: string) => {
      if (message) {
        // 快速问答
        const { quickAsk } = await import('./commands/ask.js');
        await quickAsk(message, program.opts());
      } else {
        // 启动交互式聊天
        const { startChat } = await import('./commands/chat.js');
        await startChat(program.opts());
      }
    });

  // 错误处理
  program.exitOverride((err) => {
    if (err.code === 'commander.help') {
      process.exit(0);
    }
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
  });

  await program.parseAsync();
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
```

## package.json

```json
{
  "name": "mini-ai-cli",
  "version": "1.0.0",
  "description": "AI Coding CLI - Your intelligent coding assistant",
  "type": "module",
  "bin": {
    "mini-cli": "./dist/index.js"
  },
  "files": [
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src",
    "format": "prettier --write src",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.27.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "chalk": "^5.3.0",
    "commander": "^12.0.0",
    "inquirer": "^9.2.0",
    "js-tiktoken": "^1.0.0",
    "openai": "^4.0.0",
    "ora": "^8.0.0"
  },
  "devDependencies": {
    "@types/inquirer": "^9.0.0",
    "@types/node": "^20.0.0",
    "eslint": "^8.0.0",
    "prettier": "^3.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "ai",
    "cli",
    "coding",
    "assistant",
    "chatgpt",
    "claude"
  ],
  "license": "MIT"
}
```

## 功能清单

完成项目后，你的 CLI 应该具备以下功能：

| 功能 | 状态 | 说明 |
|------|------|------|
| 多模型支持 | ✅ | OpenAI, Anthropic |
| 流式输出 | ✅ | 实时显示 AI 响应 |
| 工具系统 | ✅ | 文件操作、命令执行 |
| 会话管理 | ✅ | 持久化、历史记录 |
| 交互式 REPL | ✅ | 多行输入、历史 |
| MCP 协议 | ✅ | 作为 Server 运行 |
| 技能系统 | ✅ | 代码审查、提交 |
| 钩子系统 | ✅ | 自动格式化 |
| Git 集成 | ✅ | 状态、提交、日志 |
| 配置管理 | ✅ | 多层配置 |

## 测试清单

```typescript
// tests/integration/cli.test.ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('CLI Integration', () => {
  it('should show help', () => {
    const output = execSync('tsx src/index.ts --help').toString();
    expect(output).toContain('AI Coding CLI');
  });

  it('should show version', () => {
    const output = execSync('tsx src/index.ts --version').toString();
    expect(output).toContain('1.0.0');
  });

  it('should handle ask command', async () => {
    // 需要 mock API
  });
});
```

## 发布清单

- [ ] 代码完成并通过测试
- [ ] README 文档完整
- [ ] CHANGELOG 更新
- [ ] 版本号更新
- [ ] npm 发布测试
- [ ] GitHub Release

## 学习检验

完成本章后，你应该能够：

- [ ] 整合所有模块到完整项目
- [ ] 编写测试覆盖核心功能
- [ ] 打包并发布到 npm

## 恭喜!

你已经完成了整个课程！

你现在掌握了：

1. **TypeScript 异步编程** - Promise、async/await、流
2. **CLI 开发** - Commander.js、交互式界面
3. **AI API 集成** - OpenAI、Anthropic
4. **工具系统** - Tool Calling、工具执行
5. **会话管理** - 持久化、上下文窗口
6. **高级功能** - MCP、技能、钩子
7. **项目整合** - 架构设计、测试、发布

## 继续学习

- [Claude Code 源码](https://github.com/anthropics/claude-code)
- [Codex CLI 源码](https://github.com/openai/codex)
- [Aider 源码](https://github.com/Aider-AI/aider)
- [OpenCode 源码](https://github.com/sst/opencode)
- [MCP 协议规范](https://modelcontextprotocol.io/)
