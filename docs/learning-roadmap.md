# AI 编程 CLI 开发学习路线

本文档提供从零开始学习到独立开发 AI 编程 CLI 工具的完整路线图。每个阶段都有明确的学习目标、推荐阅读的源码文件和实战练习。

> **相关文档**:
> - [ClaudeCode 架构详解](./claudecode-architecture.md) - 项目整体架构和目录结构
> - [ClaudeCode 模块详解](./claudecode-modules.md) - 各模块实现细节
> - [ClaudeCode API 参考](./claudecode-api.md) - 核心 API 接口说明
> - [ClaudeCode 安全机制](./claudecode-security.md) - 安全设计详解

## 目标

完成本学习路线后，你将能够：

1. 理解 AI 编程工具的核心架构设计
2. 实现与多种 LLM 的集成
3. 构建 CLI 交互界面和流式输出
4. 设计安全的代码执行沙箱
5. 开发一个功能完整的 AI 编程助手

---

## 阶段概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          学习路线图                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   第一阶段          第二阶段          第三阶段          第四阶段             │
│   基础入门    →     核心原理    →     源码研读    →     实战开发             │
│   (2-4周)          (4-6周)          (持续)           (8-12周)              │
│                                                                             │
│   • 语言基础        • AI 模型集成     • Codex CLI       • Mini AI CLI        │
│   • CLI 开发        • 流式处理        • Gemini CLI      • MCP 服务器         │
│   • 异步编程        • 沙箱安全        • OpenCode        • 完整项目           │
│   • Git 操作        • 工具系统        • Aider                                │
│                    • 技能系统         • Mini-CLI       • 自定义扩展          │
│                    • 钩子系统                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 第一阶段：基础入门 (2-4 周)

### 1.1 编程语言基础

#### TypeScript (必修)

TypeScript 是 Gemini CLI、OpenCode 的核心语言，也是现代 CLI 开发的主流选择。

**学习要点：**
- 类型系统（interface, type, generics）
- 异步编程（Promise, async/await, streams）
- 模块系统（ESM, CommonJS）
- Node.js API（fs, path, process, child_process）

**推荐资源：**
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Node.js API 文档](https://nodejs.org/api/)

#### Python (必修)

Python 是 Aider 的核心语言，也是 Codex CLI 技能系统的实现语言。

**学习要点：**
- 类和对象（class, inheritance, dataclass）
- 异步编程（asyncio, aiohttp）
- 文件操作和路径处理
- 正则表达式

**推荐资源：**
- [Python 官方教程](https://docs.python.org/zh-cn/3/tutorial/)
- [Python 异步编程](https://docs.python.org/zh-cn/3/library/asyncio.html)

#### Rust (进阶)

Rust 是 Codex CLI 的核心实现语言，用于高性能和安全关键的组件。

**学习要点：**
- 所有权和借用
- Trait 系统
- 异步运行时（tokio）
- 错误处理（Result, Option）

**推荐资源：**
- [Rust 程序设计语言](https://doc.rust-lang.org/book/)
- [Rust by Example](https://doc.rust-lang.org/rust-by-example/)

### 1.2 CLI 开发基础

**学习目标：** 掌握命令行工具的基本开发模式

#### 推荐 CLI 框架

| 语言 | 框架 | 学习顺序 |
|------|------|----------|
| TypeScript | yargs, commander, oclif | 先学 |
| Python | argparse, click, typer | 先学 |
| Rust | clap, structopt | 后学 |

#### 实践代码：创建基础 CLI

```typescript
// src/index.ts - 基础 CLI 框架
import { Command } from 'commander';

const program = new Command();

program
  .name('my-cli')
  .description('My AI Coding CLI')
  .version('1.0.0');

program
  .command('chat')
  .description('Start interactive chat')
  .option('-m, --model <model>', 'AI model to use', 'gpt-4')
  .action(async (options) => {
    console.log(`Starting chat with ${options.model}...`);
    // TODO: 实现聊天逻辑
  });

program
  .command('ask <question>')
  .description('Ask a single question')
  .action(async (question) => {
    console.log(`Question: ${question}`);
    // TODO: 实现问答逻辑
  });

program.parse();
```

#### 推荐阅读源码

**Gemini CLI 入口：**
```
gemini-cli/packages/cli/src/index.ts
```
学习要点：命令行参数解析、入口点设计

### 1.3 异步编程深入

**学习目标：** 理解异步流和流式处理

#### TypeScript 异步模式

```typescript
// 流式读取文件
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

async function processFileStream(path: string) {
  const stream = createReadStream(path, { encoding: 'utf-8' });

  for await (const chunk of stream) {
    console.log('Received chunk:', chunk.length);
  }
}

// 流式 API 调用
async function* streamAPI(url: string, body: any): AsyncGenerator<string> {
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value);
  }
}
```

#### Python 异步模式

```python
import asyncio
import aiohttp

async def stream_api(url: str, prompt: str):
    """流式调用 API"""
    async with aiohttp.ClientSession() as session:
        async with session.post(
            url,
            json={"prompt": prompt},
            headers={"Accept": "text/event-stream"}
        ) as response:
            async for line in response.content:
                yield line.decode()

async def main():
    async for chunk in stream_api("https://api.example.com/chat", "Hello"):
        print(chunk, end='')

asyncio.run(main())
```

### 1.4 Git 操作基础

**学习目标：** 掌握程序化 Git 操作

**推荐阅读源码：**

```
aider/aider/repo.py
```

学习要点：
- GitPython 库使用
- 获取仓库状态
- 自动提交更改
- 处理合并冲突

```python
# aider/aider/repo.py 核心模式
import git

class GitRepo:
    def __init__(self, io, fnames, git_dname):
        self.repo = git.Repo(git_dname)

    def get_tracked_files(self):
        """获取所有被跟踪的文件"""
        return [item.a_path for item in self.repo.index.diff(None)]

    def commit(self, message):
        """提交所有更改"""
        self.repo.git.add(A=True)
        self.repo.index.commit(message)
```

---

## 第二阶段：核心原理 (4-6 周)

### 2.1 AI 模型集成

**学习目标：** 实现与多种 LLM 的统一集成

#### 模型适配器模式

**推荐阅读源码：**

```
aider/aider/models.py          # 模型配置和初始化
aider/aider/llm.py             # LiteLLM 集成
gemini-cli/packages/core/src/prompts/  # Prompt 管理
```

**学习要点：**

```typescript
// 模型适配器接口设计
interface AIProvider {
  name: string;
  chat(messages: Message[]): Promise<string>;
  stream(messages: Message[]): AsyncGenerator<string>;
}

class OpenAIProvider implements AIProvider {
  name = 'openai';

  async *stream(messages: Message[]): AsyncGenerator<string> {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages,
      stream: true,
    });

    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }
}

class AnthropicProvider implements AIProvider {
  name = 'anthropic';

  async *stream(messages: Message[]): AsyncGenerator<string> {
    const response = await anthropic.messages.stream({
      model: 'claude-3-sonnet',
      max_tokens: 4096,
      messages,
    });

    for await (const event of response) {
      if (event.type === 'content_block_delta') {
        yield event.delta.text;
      }
    }
  }
}
```

**推荐阅读顺序：**

1. `aider/aider/models.py` - 理解模型配置结构
2. `aider/aider/llm.py` - LiteLLM 统一接口
3. `aider/aider/sendchat.py` - 发送消息逻辑

### 2.2 提示工程

**学习目标：** 设计有效的系统提示和上下文管理

**推荐阅读源码：**

```
codex/codex-rs/core/prompt.md              # Codex 主提示
codex/codex-rs/core/templates/             # 提示模板系统
aider/aider/coders/base_prompts.py         # Aider 提示定义
```

**学习要点：**

```python
# aider/aider/coders/base_prompts.py 示例
class BasePrompts:
    main_system = """You are an expert software developer.
Your task is to help with coding tasks.

Key rules:
1. Always show the full file content when editing
2. Use proper diff format
3. Explain your changes clearly
"""

    system_reminder = """Do not modify code that you don't understand.
Ask for clarification if needed."""

    def get_system_prompt(self):
        return f"{self.main_system}\n{self.system_reminder}"
```

### 2.3 流式输出处理

**学习目标：** 实现实时流式响应和进度显示

**推荐阅读源码：**

```
gemini-cli/packages/core/src/core/         # 核心流处理
opencode/packages/opencode/src/session/    # 会话流管理
```

**关键实现：**

```typescript
// 流式响应处理器
class StreamHandler {
  private buffer = '';
  private onChunk: (text: string) => void;
  private onComplete: (fullText: string) => void;

  async handleStream(stream: AsyncGenerator<string>): Promise<string> {
    let fullText = '';

    for await (const chunk of stream) {
      this.buffer += chunk;
      fullText += chunk;

      // 实时显示
      this.onChunk(chunk);

      // 检测完整块
      const completeBlock = this.extractCompleteBlock();
      if (completeBlock) {
        await this.processBlock(completeBlock);
      }
    }

    this.onComplete(fullText);
    return fullText;
  }

  private extractCompleteBlock(): string | null {
    // 检测代码块、段落等完整单元
    const codeBlockRegex = /```[\s\S]*?```/g;
    const match = this.buffer.match(codeBlockRegex);
    if (match) {
      this.buffer = this.buffer.replace(codeBlockRegex, '');
      return match[0];
    }
    return null;
  }
}
```

### 2.4 工具系统设计

**学习目标：** 实现可扩展的工具调用机制

**推荐阅读源码：**

```
gemini-cli/packages/core/src/tools/       # 工具实现
codex/codex-rs/skills/                    # 技能系统
```

**工具接口设计：**

```typescript
// 工具定义接口
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (params: any) => Promise<ToolResult>;
}

interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

// 文件读取工具
const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read the contents of a file',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to read' },
    },
    required: ['path'],
  },
  execute: async ({ path }) => {
    try {
      const content = await fs.readFile(path, 'utf-8');
      return { success: true, output: content };
    } catch (error) {
      return { success: false, output: '', error: error.message };
    }
  },
};

// 工具注册器
class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  getToolDefinitions() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  async executeTool(name: string, params: any): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, output: '', error: `Unknown tool: ${name}` };
    }
    return tool.execute(params);
  }
}
```

### 2.5 安全沙箱

**学习目标：** 理解代码执行的安全隔离机制

**推荐阅读源码：**

```
codex/codex-rs/linux-sandbox/     # Linux Landlock 沙箱
codex/codex-rs/process-hardening/ # 进程加固
```

**沙箱设计原理：**

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          沙箱架构                                          │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   ┌─────────────────┐          ┌─────────────────┐                       │
│   │   主进程         │          │    沙箱进程      │                       │
│   │                 │  IPC     │                 │                       │
│   │  • 配置管理     │◄────────►│  • 代码执行     │                       │
│   │  • 用户交互     │          │  • 文件访问     │                       │
│   │  • AI 调用      │          │  • 进程创建     │                       │
│   └─────────────────┘          └─────────────────┘                       │
│                                          │                               │
│                                          │ 安全限制                       │
│                                          ▼                               │
│                                  ┌───────────────┐                       │
│                                  │   系统层       │                       │
│                                  │ • Landlock    │                       │
│                                  │ • seccomp     │                       │
│                                  │ • namespaces  │                       │
│                                  └───────────────┘                       │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**关键概念：**

| 技术 | 平台 | 功能 |
|------|------|------|
| Landlock | Linux | 文件系统访问控制 |
| seccomp | Linux | 系统调用过滤 |
| Seatbelt | macOS | 沙箱配置文件 |
| Restricted Token | Windows | 权限限制 |

---

## 第三阶段：源码研读 (持续)

### 3.1 Codex CLI 源码精读

**推荐阅读顺序：**

```
1. 入口和配置
   codex/codex-rs/cli/src/main.rs        # 主入口
   codex/codex-rs/core/src/config/       # 配置系统

2. 核心逻辑
   codex/codex-rs/core/src/agent/        # Agent 实现
   codex/codex-rs/core/src/session/      # 会话管理
   codex/codex-rs/protocol/              # 通信协议

3. 安全系统
   codex/codex-rs/linux-sandbox/         # Linux 沙箱
   codex/codex-rs/process-hardening/     # 进程加固

4. MCP 集成
   codex/codex-rs/app-server/            # 应用服务器
   codex/codex-rs/docs/codex_mcp_interface.md  # MCP 文档
```

**重点学习文件：**

| 文件 | 学习要点 |
|------|----------|
| `cli/src/main.rs` | CLI 入口设计、参数解析 |
| `core/src/agent/` | Agent 状态机、任务调度 |
| `core/src/config/` | 配置加载、分层覆盖 |
| `linux-sandbox/src/lib.rs` | Landlock API 使用 |

### 3.2 Aider 源码精读

**推荐阅读顺序：**

```
1. 入口和初始化
   aider/aider/main.py              # 主入口，参数解析
   aider/aider/args.py              # 命令行参数定义

2. 核心架构
   aider/aider/coders/base_coder.py # 核心 Coder 基类
   aider/aider/io.py                # 输入输出处理
   aider/aider/history.py           # 对话历史管理

3. 代码处理
   aider/aider/repomap.py           # 代码地图生成
   aider/aider/diffs.py             # 差异处理
   aider/aider/linter.py            # 代码检查

4. 编辑器实现
   aider/aider/coders/editblock_coder.py    # 编辑块模式
   aider/aider/coders/wholefile_coder.py    # 整文件模式
   aider/aider/coders/udiff_coder.py        # Unified diff 模式
```

**重点学习文件：**

| 文件 | 学习要点 |
|------|----------|
| `main.py` | 应用初始化流程、依赖注入 |
| `coders/base_coder.py` | 核心抽象类、模板方法模式 |
| `repomap.py` | Tree-sitter 使用、代码解析 |
| `commands.py` | 命令系统设计 |

### 3.3 Gemini CLI 源码精读

**推荐阅读顺序：**

```
1. 入口
   gemini-cli/packages/cli/src/index.ts

2. 核心功能
   gemini-cli/packages/core/src/core/      # 核心逻辑
   gemini-cli/packages/core/src/prompts/   # 提示管理
   gemini-cli/packages/core/src/tools/     # 工具实现

3. 特性模块
   gemini-cli/packages/core/src/mcp/       # MCP 集成
   gemini-cli/packages/core/src/policy/    # 策略系统
   gemini-cli/packages/core/src/commands/  # 命令模板

4. 遥测
   gemini-cli/packages/core/src/telemetry/ # OpenTelemetry 集成
```

### 3.4 OpenCode 源码精读

**推荐阅读顺序：**

```
1. CLI 核心
   opencode/packages/opencode/src/         # CLI 实现

2. 后端服务
   opencode/packages/console/core/         # 后端核心
   opencode/packages/console/core/db/      # 数据库层

3. 前端
   opencode/packages/app/                  # Web 应用
   opencode/packages/ui/                   # UI 组件库

4. 桌面应用
   opencode/packages/desktop/              # Electron/Tauri
```

### 3.5 Mini-CLI 源码精读 (学习推荐)

**为什么推荐 Mini-CLI 作为学习起点？**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Mini-CLI 学习优势                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. 代码简洁                                                                │
│     • 每个模块职责单一                                                      │
│     • 完整的中文注释                                                        │
│     • 没有过度工程化                                                        │
│                                                                             │
│  2. 功能完整                                                                │
│     • 多模型 Provider 抽象                                                  │
│     • 流式输出处理                                                          │
│     • 工具调用系统                                                          │
│     • MCP 协议支持                                                          │
│     • 技能/钩子系统                                                         │
│     • Git 集成                                                              │
│                                                                             │
│  3. 对比学习                                                                │
│     • 与 Claude Code、Codex CLI 对比                                       │
│     • 理解相同功能的不同实现                                                │
│     • 学习最佳实践                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**推荐阅读顺序：**

```
1. 入口和配置 (Day 1-2)
   mini-cli/src/index.ts              # CLI 入口，命令定义
   mini-cli/src/config/loader.ts      # 配置加载
   mini-cli/src/config/models.ts      # 模型元数据

2. 核心管理层 (Day 3-5)
   mini-cli/src/managers/model-manager.ts    # 模型管理
   mini-cli/src/managers/session-manager.ts  # 会话管理

3. Provider 层 (Day 6-8)
   mini-cli/src/providers/base-provider.ts   # Provider 基类
   mini-cli/src/providers/openai.ts          # OpenAI 实现
   mini-cli/src/providers/minimax.ts         # MiniMax 实现
   mini-cli/src/providers/registry.ts        # Provider 注册表

4. 工具系统 (Day 9-11)
   mini-cli/src/tools/registry.ts            # 工具注册
   mini-cli/src/tools/executor.ts            # 工具执行
   mini-cli/src/tools/built-in.ts            # 内置工具
   mini-cli/src/tools/security/              # 安全控制

5. 流式处理 (Day 12-14)
   mini-cli/src/streaming/buffer-manager.ts  # 缓冲区管理
   mini-cli/src/streaming/sse-parser.ts      # SSE 解析
   mini-cli/src/streaming/stream-handler.ts  # 流处理

6. 高级特性 (Day 15-20)
   mini-cli/src/mcp/                         # MCP 协议
   mini-cli/src/skills/                      # 技能系统
   mini-cli/src/hooks/                       # 钩子系统
   mini-cli/src/git/                         # Git 集成
```

**重点学习文件：**

| 文件 | 学习要点 | 对比参考 |
|------|----------|----------|
| `index.ts` | CLI 编排、命令定义 | Codex CLI `main.rs` |
| `providers/base-provider.ts` | 抽象类设计 | Aider `models.py` |
| `tools/executor.ts` | 工具执行、安全检查 | Codex CLI `skills/` |
| `streaming/stream-handler.ts` | 流式处理 | Gemini CLI `core/` |
| `mcp/mcp-server.ts` | MCP 协议实现 | Codex CLI `app-server/` |
| `skills/skill-registry.ts` | 技能注册与匹配 | Claude Code 技能系统 |
| `hooks/hook-manager.ts` | 钩子生命周期 | Codex CLI 钩子系统 |
| `git/commit-generator.ts` | AI 驱动 Commit | Aider `repo.py` |

---

## 第四阶段：实战项目 (8-12 周)

### 项目一：Mini AI CLI (2-3 周)

**目标：** 构建一个最小可行的 AI CLI 工具

> **💡 学习提示：** 完整的参考实现见 [Mini-CLI](./mini-cli.md)，包含详细的架构文档和测试计划。

**功能需求：**
- 交互式聊天
- 文件读取和编辑
- 流式输出
- 多模型支持

**项目结构：**

```
mini-ai-cli/
├── src/
│   ├── index.ts              # 入口
│   ├── cli.ts                # CLI 定义
│   ├── providers/
│   │   ├── index.ts          # Provider 接口
│   │   ├── openai.ts         # OpenAI 实现
│   │   └── anthropic.ts      # Anthropic 实现
│   ├── tools/
│   │   ├── index.ts          # 工具注册
│   │   ├── read-file.ts      # 文件读取
│   │   └── write-file.ts     # 文件写入
│   ├── session/
│   │   └── manager.ts        # 会话管理
│   └── utils/
│       └── stream.ts         # 流处理
├── package.json
└── tsconfig.json
```

**实现步骤：**

#### Step 1: CLI 框架 (Day 1-2)

```typescript
// src/cli.ts
import { Command } from 'commander';
import { startChat } from './session/manager';

export const program = new Command();

program
  .command('chat')
  .description('Start interactive chat')
  .option('-p, --provider <provider>', 'AI provider', 'openai')
  .option('-m, --model <model>', 'Model name')
  .action(startChat);

program
  .command('ask <question>')
  .description('Ask a single question')
  .option('-p, --provider <provider>', 'AI provider', 'openai')
  .action(askQuestion);
```

#### Step 2: Provider 接口 (Day 3-4)

```typescript
// src/providers/index.ts
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface Provider {
  name: string;
  chat(messages: Message[]): Promise<string>;
  stream(messages: Message[]): AsyncGenerator<string>;
}

// src/providers/openai.ts
import OpenAI from 'openai';
import { Provider, Message } from './index';

export class OpenAIProvider implements Provider {
  name = 'openai';
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async *stream(messages: Message[]): AsyncGenerator<string> {
    const stream = await this.client.chat.completions.create({
      model: 'gpt-4',
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  }
}
```

#### Step 3: 工具系统 (Day 5-7)

```typescript
// src/tools/index.ts
export interface Tool {
  name: string;
  description: string;
  execute: (params: any) => Promise<string>;
}

// src/tools/read-file.ts
import { readFile } from 'fs/promises';

export const readFileTool: Tool = {
  name: 'read_file',
  description: 'Read file contents',
  execute: async ({ path }) => {
    return await readFile(path, 'utf-8');
  },
};
```

#### Step 4: 会话管理 (Day 8-10)

```typescript
// src/session/manager.ts
import { Message, Provider } from '../providers';
import { Tool } from '../tools';

export class SessionManager {
  private messages: Message[] = [];
  private provider: Provider;
  private tools: Tool[];

  constructor(provider: Provider, tools: Tool[]) {
    this.provider = provider;
    this.tools = tools;
    this.messages.push({
      role: 'system',
      content: this.getSystemPrompt(),
    });
  }

  async chat(userInput: string): Promise<void> {
    this.messages.push({ role: 'user', content: userInput });

    process.stdout.write('Assistant: ');
    for await (const chunk of this.provider.stream(this.messages)) {
      process.stdout.write(chunk);
    }
    console.log();
  }

  private getSystemPrompt(): string {
    return `You are an AI coding assistant.
Available tools: ${this.tools.map(t => t.name).join(', ')}`;
  }
}
```

### 项目二：MCP 服务器 (2 周)

**目标：** 实现一个完整的 MCP 服务器

> **💡 学习提示：** Mini-CLI 提供了完整的 MCP 实现，包括服务端、客户端和文件系统服务器，详见 [mini-cli/src/mcp/](../AiCLIFromZero/mini-cli/src/mcp/)

**参考源码：**
```
codex/codex-rs/docs/codex_mcp_interface.md
gemini-cli/packages/core/src/mcp/
mini-cli/src/mcp/                      # 完整的 MCP 实现 (推荐学习)
```

**项目结构：**

```
mcp-filesystem-server/
├── src/
│   ├── index.ts              # 服务器入口
│   ├── server.ts             # MCP 服务器实现
│   └── tools/
│       ├── read-file.ts
│       ├── write-file.ts
│       ├── list-dir.ts
│       └── search.ts
├── package.json
└── tsconfig.json
```

**核心实现：**

```typescript
// src/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'filesystem-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
    resources: {},
  },
});

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'read_file',
      description: 'Read file contents',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
        required: ['path'],
      },
    },
  ],
}));

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'read_file':
      return await handleReadFile(args.path);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// 启动服务器
const transport = new StdioServerTransport();
await server.connect(transport);
```

### 项目三：完整 AI 编程 CLI (4-6 周)

**目标：** 整合所学知识，开发一个功能完整的工具

**功能清单：**

| 功能 | 优先级 | 参考 |
|------|--------|------|
| 多模型支持 | P0 | aider/models.py |
| 交互式聊天 | P0 | aider/io.py |
| 文件操作工具 | P0 | gemini-cli/tools/ |
| 流式输出 | P0 | opencode/session/ |
| Git 集成 | P1 | aider/repo.py |
| 代码地图 | P1 | aider/repomap.py |
| 沙箱执行 | P2 | codex/linux-sandbox/ |
| MCP 协议 | P2 | codex/app-server/ |

**架构设计：**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          完整架构                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                          CLI 层                                      │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │   │
│   │  │   chat      │  │   ask       │  │   config/skill/session      │  │   │
│   │  │   命令      │  │   命令      │  │   管理命令                   │  │   │
│   │  └─────────────┘  └─────────────┘  └─────────────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│   ┌────────────────────────────────▼────────────────────────────────────┐   │
│   │                         核心层                                       │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│   │  │  Session    │  │   Agent     │  │   Tool      │                 │   │
│   │  │  Manager    │  │   Runner    │  │   Registry  │                 │   │
│   │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│   ┌────────────────────────────────▼────────────────────────────────────┐   │
│   │                         服务层                                       │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│   │  │   AI        │  │   Git       │  │   Sandbox   │                 │   │
│   │  │   Provider  │  │   Service   │  │   Manager   │                 │   │
│   │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│   │  │   File      │  │   MCP       │  │   Config    │                 │   │
│   │  │   System    │  │   Client    │  │   Loader    │                 │   │
│   │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**实现路线图：**

```
Week 1-2: 核心框架
├── CLI 框架搭建
├── Provider 接口实现
├── 基础工具系统
└── 会话管理

Week 3-4: 功能增强
├── Git 集成
├── 代码编辑模式
├── 流式输出优化
└── 错误处理

Week 5-6: 高级特性
├── 沙箱执行
├── MCP 协议支持
├── 配置系统
└── 测试覆盖
```

---

## 学习检验清单

### 第一阶段检验

- [ ] 能用 TypeScript/Python 创建基础 CLI
- [ ] 理解 async/await 和流式处理
- [ ] 能使用 GitPython/NodeGit 操作仓库
- [ ] 理解基本的 AI API 调用

### 第二阶段检验

- [ ] 能实现 Provider 适配器模式
- [ ] 理解工具调用的完整流程
- [ ] 能处理流式 API 响应
- [ ] 理解沙箱安全的基本原理

### 第三阶段检验

- [ ] 能追踪 Codex CLI 的核心流程
- [ ] 能理解 Aider 的代码编辑实现
- [ ] 能分析 Gemini CLI 的工具系统
- [ ] 能阅读 OpenCode 的架构设计

### 第四阶段检验

- [ ] 完成 Mini AI CLI 项目
- [ ] 实现 MCP 服务器
- [ ] 完成完整项目
- [ ] 能独立扩展新功能

---

## 推荐学习资源

### 官方文档
- [OpenAI API 文档](https://platform.openai.com/docs)
- [Anthropic API 文档](https://docs.anthropic.com)
- [MCP 协议规范](https://modelcontextprotocol.io)

### 技术博客
- [Aider 设计文档](https://aider.chat/docs/techniques.html)
- [OpenAI Codex 博客](https://openai.com/blog)

### 相关技术
- [Tree-sitter](https://tree-sitter.github.io/) - 代码解析
- [LiteLLM](https://github.com/BerriAI/litellm) - 多模型统一
- [Ratatui](https://ratatui.rs/) - Rust TUI

---

## 常见问题

### Q: 应该先学哪个项目？

**建议从 Aider 开始**，因为：
1. Python 代码相对易读
2. 架构设计清晰
3. 文档完善

### Q: TypeScript vs Python 选哪个？

**建议都学**，但有优先级：
- 先学 TypeScript（生态更广）
- Python 作为补充（Aider 使用）

### Q: 如何调试这些项目？

1. **Aider**: `aider --verbose` 开启详细日志
2. **Codex CLI**: `RUST_LOG=debug codex chat`
3. **Gemini CLI**: `DEBUG=* gemini chat`

### Q: 学习时间如何安排？

| 阶段 | 建议时间 | 每周投入 |
|------|----------|----------|
| 第一阶段 | 2-4 周 | 10-15 小时 |
| 第二阶段 | 4-6 周 | 15-20 小时 |
| 第三阶段 | 持续 | 每周 5-10 小时 |
| 第四阶段 | 8-12 周 | 20+ 小时 |

---

## 总结

本学习路线从基础到高级，循序渐进地介绍了 AI 编程 CLI 开发所需的全部知识。通过阅读优秀的开源项目源码，配合动手实践，你将能够：

1. **理解** 现代 AI 编程工具的设计理念
2. **掌握** LLM 集成和流式处理技术
3. **实现** 功能完整的 AI 编程助手
4. **扩展** 新特性和工具

## 学习资源汇总

### 本地文档

| 文档 | 路径 | 内容 |
|------|------|------|
| Mini-CLI 文档 | [mini-cli.md](./mini-cli.md) | 学习型 AI CLI 项目详解 |
| Mini-CLI 架构 | [../AiCLIFromZero/mini-cli/ARCHITECTURE.md](../AiCLIFromZero/mini-cli/ARCHITECTURE.md) | 详细架构文档 |
| Mini-CLI 测试 | [../AiCLIFromZero/mini-cli/TEST_PLAN.md](../AiCLIFromZero/mini-cli/TEST_PLAN.md) | 测试计划和用例 |
| Claude Code | [claude-code.md](./claude-code.md) | Claude Code 详解 |
| Codex CLI | [codex-cli.md](./codex-cli.md) | Codex CLI 详解 |
| Gemini CLI | [gemini-cli.md](./gemini-cli.md) | Gemini CLI 详解 |
| Aider | [aider.md](./aider.md) | Aider 详解 |
| OpenCode | [opencode.md](./opencode.md) | OpenCode 详解 |
| Goose | [goose.md](./goose.md) | Goose 详解 |

祝你学习顺利！如有问题，可以参考各项目的 GitHub Issues 和社区讨论。
