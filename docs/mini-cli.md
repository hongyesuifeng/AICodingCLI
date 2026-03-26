# Mini-CLI 学习型 AI 编程工具

Mini-CLI 是一个从零开始学习 AI 编程 CLI 开发的教学项目，通过逐步实现核心功能来理解现代 AI 编程工具的设计原理。

## 项目定位

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Mini-CLI 核心定位                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🎯 学习型项目                                                               │
│     • 代码结构清晰，便于阅读和理解                                            │
│     • 每个模块职责单一，易于学习                                              │
│     • 完整注释，解释设计决策                                                  │
│                                                                             │
│  📦 功能完整                                                                 │
│     • 多模型支持（OpenAI、MiniMax）                                          │
│     • 流式输出处理                                                           │
│     • 工具调用系统                                                           │
│     • 会话管理与持久化                                                       │
│     • MCP 协议支持                                                           │
│     • 技能系统                                                               │
│     • 钩子系统                                                               │
│     • Git 集成                                                               │
│                                                                             │
│  🔧 对比学习                                                                 │
│     • 与 Claude Code、Codex CLI 等工具对比                                   │
│     • 理解相同功能的不同实现方式                                              │
│     • 学习最佳实践和设计模式                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 功能特性

### 核心功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 多模型 Provider | ✅ | OpenAI、MiniMax（可扩展） |
| 流式输出 | ✅ | 实时显示 AI 响应 |
| 工具调用 | ✅ | 支持文件读写、命令执行 |
| 会话管理 | ✅ | 持久化、上下文窗口管理 |
| Token 统计 | ✅ | 使用量和成本估算 |
| MCP 协议 | ✅ | 服务端和客户端实现 |
| 技能系统 | ✅ | 5 个内置技能 |
| 钩子系统 | ✅ | 生命周期事件处理 |
| Git 集成 | ✅ | 状态解析、Commit 生成 |

### CLI 命令

```bash
# 基础命令
mini-cli --help              # 查看帮助
mini-cli chat                # 交互式聊天
mini-cli ask "问题"          # 单次问答

# 模型相关
mini-cli models              # 列出支持的模型
mini-cli config              # 显示当前配置

# Git 集成
mini-cli git-status          # 显示 Git 状态
mini-cli commit              # AI 生成 commit 消息
mini-cli commit --dry-run    # 只显示消息不提交

# 技能系统
mini-cli skills              # 列出所有技能
```

### 交互模式命令

```
/help                        # 显示帮助
/commit                      # 生成 commit 消息
/explain [file]              # 解释代码
/review [file]               # 审查代码
/test <file>                 # 生成测试
/model [name]                # 切换模型
/session info                # 会话信息
/session stats               # 使用统计
/session clear               # 清空会话
/exit                        # 退出
```

## 架构设计

### 目录结构

```
mini-cli/
├── src/
│   ├── index.ts                # CLI 入口
│   ├── cli/                    # 命令行交互界面层
│   │   ├── repl.ts             # REPL 交互
│   │   ├── history.ts          # 命令历史
│   │   ├── command/            # 命令解析与注册
│   │   └── prompts/            # 交互式输入
│   ├── config/                 # 配置与模型元数据
│   │   ├── models.ts           # 模型定义
│   │   └── loader.ts           # 配置加载
│   ├── managers/               # 运行时管理层
│   │   ├── model-manager.ts    # 模型管理
│   │   └── session-manager.ts  # 会话管理
│   ├── providers/              # AI Provider 抽象
│   │   ├── base-provider.ts    # 基类
│   │   ├── openai.ts           # OpenAI 实现
│   │   ├── minimax.ts          # MiniMax 实现
│   │   └── registry.ts         # Provider 注册表
│   ├── tools/                  # 工具系统
│   │   ├── registry.ts         # 工具注册
│   │   ├── executor.ts         # 工具执行
│   │   ├── built-in.ts         # 内置工具
│   │   └── security/           # 安全控制
│   ├── mcp/                    # MCP 协议
│   │   ├── types.ts            # 类型定义
│   │   ├── jsonrpc.ts          # JSON-RPC 实现
│   │   ├── mcp-server.ts       # MCP 服务器
│   │   ├── mcp-client.ts       # MCP 客户端
│   │   └── file-system-server.ts
│   ├── skills/                 # 技能系统
│   │   ├── types.ts            # 技能类型
│   │   ├── base-skill.ts       # 技能基类
│   │   ├── skill-registry.ts   # 技能注册表
│   │   └── builtin/            # 内置技能
│   ├── hooks/                  # 钩子系统
│   │   ├── types.ts            # 钩子类型
│   │   ├── hook-manager.ts     # 钩子管理器
│   │   └── builtin/            # 内置钩子
│   ├── git/                    # Git 集成
│   │   ├── executor.ts         # 命令执行
│   │   ├── commands.ts         # Git 命令
│   │   ├── status.ts           # 状态解析
│   │   ├── diff.ts             # Diff 解析
│   │   └── commit-generator.ts # Commit 生成
│   ├── storage/                # 会话存储
│   ├── context/                # 上下文管理
│   ├── streaming/              # 流式处理
│   ├── terminal/               # 终端渲染
│   ├── types/                  # 类型定义
│   └── utils/                  # 工具函数
├── test/                       # 单元测试
├── package.json
├── tsconfig.json
└── ARCHITECTURE.md
```

### 架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Mini-CLI 架构                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                          CLI 层 (index.ts)                           │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │   │
│   │  │   chat      │  │   ask       │  │  commit/git-status/skills   │  │   │
│   │  │   命令      │  │   命令      │  │  管理命令                    │  │   │
│   │  └─────────────┘  └─────────────┘  └─────────────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│   ┌────────────────────────────────▼────────────────────────────────────┐   │
│   │                         管理层                                       │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│   │  │ModelManager │  │SessionMgr   │  │ SkillRegistry│                 │   │
│   │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│   │  ┌─────────────┐  ┌─────────────┐                                   │   │
│   │  │ HookManager │  │ ToolManager │                                   │   │
│   │  └─────────────┘  └─────────────┘                                   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│   ┌────────────────────────────────▼────────────────────────────────────┐   │
│   │                         服务层                                       │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│   │  │  Provider   │  │    Git      │  │    MCP      │                 │   │
│   │  │ (OpenAI/    │  │  Commands   │  │  Server/    │                 │   │
│   │  │  MiniMax)   │  │             │  │  Client     │                 │   │
│   │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│   │  │  Storage    │  │  Context    │  │  Streaming  │                 │   │
│   │  │(Memory/File)│  │  Manager    │  │  Handler    │                 │   │
│   │  └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 核心模块详解

### 1. Provider 层

Provider 层实现了与不同 AI 模型的统一接口：

```typescript
// 统一的 Provider 接口
interface AIProvider {
  name: string;
  chat(messages: Message[]): Promise<ChatResponse>;
  stream(messages: Message[]): AsyncGenerator<StreamChunk>;
  chatWithTools(messages: Message[], tools: Tool[]): Promise<ToolCallResult>;
}

// OpenAI Provider 实现
class OpenAIProvider extends BaseProvider {
  async *stream(messages: Message[]): AsyncGenerator<StreamChunk> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      stream: true,
    });

    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield { type: 'content', text: content };
    }
  }
}
```

**与其他工具对比：**

| 特性 | Mini-CLI | Claude Code | Codex CLI | Aider |
|------|----------|-------------|-----------|-------|
| 语言 | TypeScript | TypeScript | Rust | Python |
| 多模型 | ✅ OpenAI/MiniMax | ❌ 单一 | ❌ 单一 | ✅ LiteLLM |
| 流式输出 | ✅ | ✅ | ✅ | ✅ |
| 工具调用 | ✅ | ✅ | ✅ | ✅ |

### 2. MCP 协议层

实现了 Model Context Protocol 的基础功能：

```typescript
// JSON-RPC 服务器
class JSONRPCServer {
  registerMethod(name: string, handler: MethodHandler): void;
  async handleRequest(request: JSONRPCRequest): Promise<JSONRPCResponse>;
}

// MCP 服务器
class MCPServer {
  registerTool(definition: MCPTool, handler: ToolHandler): void;
  registerResource(definition: MCPResource, handler?: ResourceHandler): void;
  async handleRequest(request: any): Promise<any>;
}

// 文件系统 MCP Server
class FileSystemMCPServer extends MCPServer {
  // 提供文件读写、目录操作等工具
  tools: ['read_file', 'write_file', 'list_directory',
          'create_directory', 'delete_file', 'exists', 'search_files']
}
```

**与其他工具对比：**

| 特性 | Mini-CLI | Claude Code | Codex CLI | Gemini CLI |
|------|----------|-------------|-----------|------------|
| MCP 服务端 | ✅ | ❌ | ✅ | ✅ |
| MCP 客户端 | ✅ | ✅ | ✅ | ✅ |
| 文件系统工具 | ✅ | ✅ | ✅ | ✅ |

### 3. 技能系统

实现了可扩展的技能系统：

```typescript
// 技能基类
abstract class BaseSkill implements Skill {
  abstract name: string;
  abstract description: string;
  abstract triggers: SkillTrigger[];
  abstract execute(context: SkillContext, args?: any): Promise<SkillResult>;

  shouldTrigger(input: string, context: SkillContext): boolean;
  parseArgs(input: string): Record<string, any>;
}

// 内置技能
class CommitSkill extends BaseSkill {
  name = 'commit';
  triggers = [
    { command: 'commit', priority: 100 },
    { keywords: ['commit', '提交'], priority: 50 },
  ];

  async execute(context: SkillContext): Promise<SkillResult> {
    // 分析暂存更改，生成 commit 消息
  }
}
```

**内置技能列表：**

| 技能 | 命令 | 触发方式 | 功能 |
|------|------|----------|------|
| Commit | `/commit` | 命令/关键词 | 生成 conventional commit 消息 |
| Explain | `/explain [file]` | 命令/关键词 | 解释代码功能 |
| Review | `/review [file]` | 命令/关键词 | 代码审查 |
| Test | `/test <file>` | 命令/关键词 | 生成单元测试 |
| Help | `/help [skill]` | 命令 | 显示帮助 |

### 4. 钩子系统

实现了生命周期事件处理：

```typescript
// 钩子管理器
class HookManager {
  register(definition: HookDefinition): void;
  async trigger(event: HookEvent, context: HookContext): Promise<HookResult>;
}

// 钩子事件类型
type HookEvent =
  | 'preInput'      // 用户输入前
  | 'postInput'     // 用户输入后
  | 'preResponse'   // AI 响应前
  | 'postResponse'  // AI 响应后
  | 'preToolCall'   // 工具调用前
  | 'postToolCall'  // 工具调用后
  | 'onSessionStart'// 会话开始
  | 'onSessionEnd'  // 会话结束
  | 'onError';      // 错误发生

// 内置钩子
const performanceHook = createPerformanceHook({ logToConsole: false });
const sensitiveFilterHook = createSensitiveFilterHook({ logFiltered: false });
```

### 5. Git 集成

实现了 Git 操作的封装和 AI 驱动的 commit 生成：

```typescript
// Git 命令封装
class GitCommands {
  async status(): Promise<string>;
  async add(files: string[]): Promise<void>;
  async commit(message: string): Promise<string>;
  async diff(options?: DiffOptions): Promise<string>;
}

// 状态解析
class GitStatusParser {
  async getStatus(): Promise<GitStatus>;
  formatStatus(status: GitStatus): string;
}

// Diff 解析
class DiffParser {
  parse(diffText: string): FileDiff[];
}

// AI 驱动的 Commit 生成
class CommitMessageGenerator {
  async generate(): Promise<string>;
  async commit(message: string, options?: CommitOptions): Promise<string>;
}
```

## 与其他工具对比

### 架构对比

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│     特性        │    Mini-CLI     │   Claude Code   │    Codex CLI    │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ 实现语言        │   TypeScript    │   TypeScript    │      Rust       │
│ 开源状态        │      ✅         │       ❌        │   ✅ Apache2    │
│ 代码复杂度      │      低         │       高        │       高        │
│ 学习难度        │      低         │       高        │       高        │
│ 生产就绪        │      ❌         │       ✅        │       ✅        │
│ 安全沙箱        │      ❌         │    权限系统     │   ✅ 原生多平台 │
│ MCP 支持        │      ✅         │       ✅        │       ✅        │
│ 技能系统        │      ✅         │       ✅        │       ✅        │
│ 钩子系统        │      ✅         │       ✅        │       ✅        │
│ 多模型          │      ✅         │       ❌        │       ❌        │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### 功能对比

| 功能 | Mini-CLI | Claude Code | Codex CLI | Aider | Gemini CLI |
|------|----------|-------------|-----------|-------|------------|
| 交互式聊天 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 流式输出 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 工具调用 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 会话持久化 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 上下文管理 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Token 统计 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 成本估算 | ✅ | ✅ | ❌ | ❌ | ❌ |
| Git 集成 | ✅ | ✅ | ✅ | ✅ | ✅ |
| MCP 协议 | ✅ | ✅ | ✅ | ❌ | ✅ |
| 技能系统 | ✅ | ✅ | ✅ | ❌ | ✅ |
| 钩子系统 | ✅ | ✅ | ✅ | ❌ | ✅ |
| 代码地图 | ❌ | ❌ | ❌ | ✅ | ❌ |
| 安全沙箱 | ❌ | 权限系统 | ✅ | ❌ | ⚠️ 有限 |

## 学习路线

### 阶段一：基础理解 (1 周)

1. **阅读项目结构**
   - 理解目录组织
   - 了解模块职责
   - 跟踪 CLI 入口

2. **理解 Provider 模式**
   - 阅读 `base-provider.ts`
   - 分析 OpenAI 实现
   - 对比 MiniMax 实现

### 阶段二：核心功能 (2 周)

1. **流式处理**
   - 阅读 `streaming/` 目录
   - 理解 SSE 解析
   - 分析缓冲区管理

2. **工具系统**
   - 阅读 `tools/` 目录
   - 理解工具注册和执行
   - 分析安全控制

3. **会话管理**
   - 阅读 `session-manager.ts`
   - 理解上下文窗口
   - 分析持久化机制

### 阶段三：高级特性 (2 周)

1. **MCP 协议**
   - 阅读 `mcp/` 目录
   - 理解 JSON-RPC
   - 分析服务端/客户端实现

2. **技能系统**
   - 阅读 `skills/` 目录
   - 理解触发机制
   - 实现自定义技能

3. **钩子系统**
   - 阅读 `hooks/` 目录
   - 理解生命周期
   - 实现自定义钩子

### 阶段四：对比学习 (持续)

1. **对比 Claude Code**
   - 相同功能的不同实现
   - 架构设计差异
   - 最佳实践学习

2. **对比 Codex CLI**
   - Rust vs TypeScript
   - 安全沙箱设计
   - 性能考量

## 快速开始

### 安装

```bash
cd mini-cli
npm install
npm run build
```

### 配置

```bash
# 创建 .env 文件
cat > .env << EOF
MINIMAX_API_KEY=your_minimax_key
OPENAI_API_KEY=your_openai_key
EOF
```

### 使用

```bash
# 查看帮助
node dist/index.js --help

# 交互式聊天
node dist/index.js chat

# 单次问答
node dist/index.js ask "解释一下 TypeScript 的泛型"

# 查看支持的模型
node dist/index.js models

# Git 状态
node dist/index.js git-status

# 生成 commit 消息
node dist/index.js commit --dry-run
```

## 扩展开发

### 添加新的 Provider

```typescript
// src/providers/custom.ts
import { BaseProvider } from './base-provider.js';

export class CustomProvider extends BaseProvider {
  name = 'custom';

  async *stream(messages: Message[]): AsyncGenerator<StreamChunk> {
    // 实现流式输出
  }
}

// 注册 Provider
registry.register('custom', (config) => new CustomProvider(config));
```

### 添加新的技能

```typescript
// src/skills/builtin/custom-skill.ts
import { BaseSkill } from '../base-skill.js';

export class CustomSkill extends BaseSkill {
  name = 'custom';
  description = 'Custom skill description';

  triggers = [
    { command: 'custom', priority: 100 },
  ];

  async execute(context: SkillContext, args?: any): Promise<SkillResult> {
    // 实现技能逻辑
    return { success: true, output: 'Result' };
  }
}
```

### 添加新的钩子

```typescript
// src/hooks/builtin/custom-hook.ts
export function createCustomHook(): HookDefinition {
  return {
    name: 'custom-hook',
    event: 'postResponse',
    priority: 50,
    handler: async (context: HookContext): Promise<HookResult> => {
      // 实现钩子逻辑
      return { proceed: true };
    },
  };
}
```

## 参考资源

- [项目架构文档](../AiCLIFromZero/mini-cli/ARCHITECTURE.md)
- [测试计划](../AiCLIFromZero/mini-cli/TEST_PLAN.md)
- [学习路线](./learning-roadmap.md)
- [Claude Code 文档](./claude-code.md)
- [Codex CLI 文档](./codex-cli.md)
- [MCP 协议规范](https://modelcontextprotocol.io/)
