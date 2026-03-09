# AI 编程工具技术文档

本文档详细介绍三个主流 AI 编程工具的技术架构、实现原理、最佳实践和学习路线。

## 目录

1. [概述与对比](#概述与对比)
2. [OpenAI Codex CLI](#codex-cli)
3. [Google Gemini CLI](#gemini-cli)
4. [OpenCode](#opencode)
5. [学习路线](#学习路线)

## 详细文档

每个工具都有独立的技术文档，请参考：

| 工具 | 文档路径 | 核心特点 |
|------|----------|----------|
| [Codex CLI](./codex-cli.md) | `docs/codex-cli.md` | Rust 安全沙箱、Python 技能系统 |
| [Gemini CLI](./gemini-cli.md) | `docs/gemini-cli.md` | TOML 命令模板、多模型支持、OpenTelemetry |
| [OpenCode](./opencode.md) | `docs/opencode.md` | Bun 运行时、SolidJS、Tauri 桌面应用 |

---

## 概述与对比

### 工具定位

| 工具 | 开发者 | 核心定位 | 主要语言 |
|------|--------|----------|----------|
| Codex CLI | OpenAI | 安全优先的 AI 编程代理 | Rust + TypeScript |
| Gemini CLI | Google | 可扩展的多模型 AI 助手 | TypeScript |
| OpenCode | Anomaly | 现代化全栈 AI 开发平台 | TypeScript (Bun) |

### 技术栈对比

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          技术栈层次对比                                  │
├─────────────┬─────────────────┬─────────────────┬───────────────────────┤
│    层级     │    Codex CLI    │    Gemini CLI   │      OpenCode         │
├─────────────┼─────────────────┼─────────────────┼───────────────────────┤
│ 运行时      │ Node.js 16+     │ Node.js 20+     │ Bun                   │
│ 核心语言    │ Rust            │ TypeScript      │ TypeScript            │
│ 包管理      │ Cargo + npm     │ pnpm            │ Bun + Turbo           │
│ UI 框架     │ Ratatui (TUI)   │ Ink + React     │ SolidJS + Tauri       │
│ 数据存储    │ 文件系统        │ 文件系统        │ SQLite + Drizzle      │
│ AI 集成     │ OpenAI API      │ Google Gemini   │ 多模型 (AI SDK)       │
│ 沙箱安全    │ 原生实现        │ 有限支持        │ 系统沙箱              │
│ 架构模式    │ Monorepo        │ Monorepo        │ Monorepo              │
└─────────────┴─────────────────┴─────────────────┴───────────────────────┘
```

### 核心特性对比

| 特性 | Codex CLI | Gemini CLI | OpenCode |
|------|:---------:|:----------:|:--------:|
| CLI 支持 | ✅ | ✅ | ✅ |
| Web 界面 | ❌ | ✅ (DevTools) | ✅ |
| 桌面应用 | ❌ | ❌ | ✅ (Tauri) |
| 安全沙箱 | ✅ 原生 | ⚠️ 有限 | ⚠️ 系统 |
| 多模型支持 | ❌ | ✅ | ✅ |
| MCP 协议 | ✅ | ✅ | ✅ |
| 插件系统 | ✅ Skills | ✅ Commands | ✅ Plugins |
| 云服务集成 | ❌ | ❌ | ✅ |
| 开源 | ✅ | ✅ | ✅ |

---

## Codex CLI

### 技术架构

Codex CLI 是 OpenAI 开发的命令行 AI 编程代理，采用 Rust + TypeScript 混合架构，核心特点是对安全性的高度重视。

```
┌────────────────────────────────────────────────────────────────────┐
│                      Codex CLI 系统架构                             │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐    │
│  │   CLI 层    │───▶│  核心逻辑   │───▶│   OpenAI API        │    │
│  │  (Rust)     │    │  (Rust)     │    │                     │    │
│  └─────────────┘    └──────┬──────┘    └─────────────────────┘    │
│                            │                                       │
│         ┌──────────────────┼──────────────────┐                   │
│         ▼                  ▼                  ▼                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│  │  沙箱系统   │    │  技能系统   │    │  钩子系统   │           │
│  │ (安全隔离)  │    │ (Python)    │    │ (事件触发)  │           │
│  └─────────────┘    └─────────────┘    └─────────────┘           │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 目录结构

```
codex/
├── codex-rs/                    # Rust 核心实现
│   ├── cli/                     # 命令行入口
│   │   ├── src/main.rs          # 主程序入口
│   │   └── src/cli.rs           # CLI 参数解析
│   ├── core/                    # 核心业务逻辑
│   │   ├── src/agent/           # Agent 实现
│   │   ├── src/session/         # 会话管理
│   │   └── src/message/         # 消息处理
│   ├── config/                  # 配置管理
│   ├── app-server/              # WebSocket 应用服务器
│   ├── mcp-server/              # MCP 协议实现
│   ├── skills/                  # 技能系统
│   ├── hooks/                   # 钩子系统
│   ├── linux-sandbox/           # Linux 沙箱 (Landlock + seccomp)
│   └── windows-sandbox/         # Windows 沙箱
├── codex-cli/                   # TypeScript CLI 包装器
└── .codex/                      # 用户配置
    └── skills/                  # 自定义技能
```

### 核心技术原理

#### 1. 安全沙箱系统

Codex CLI 最核心的特性是其多平台安全沙箱实现：

```rust
// 沙箱架构示意
pub trait Sandbox {
    /// 在沙箱中执行命令
    async fn execute(&self, cmd: Command) -> Result<Output>;

    /// 配置文件系统访问权限
    fn configure_fs_access(&mut self, paths: Vec<PathBuf>);

    /// 配置网络访问权限
    fn configure_network(&mut self, allowed: bool);
}

// 平台特定实现
// Linux: Landlock + seccomp
// macOS: Seatbelt (sandbox-exec)
// Windows: Restricted Token
```

**沙箱技术对比：**

| 平台 | 技术 | 原理 |
|------|------|------|
| Linux | Landlock | 内核级文件系统访问控制 |
| Linux | seccomp | 系统调用过滤 |
| macOS | Seatbelt | macOS 沙箱配置文件 |
| Windows | Restricted Token | 令牌权限限制 |

#### 2. 技能系统 (Skills)

```python
# 技能定义示例 (.codex/skills/example.py)
from codex import Skill, Context

class MySkill(Skill):
    """自定义技能"""

    name = "my-skill"
    description = "示例技能"

    async def execute(self, context: Context):
        # 访问文件系统
        files = await context.read_directory("./src")

        # 调用 AI
        response = await context.chat("分析这些文件")

        # 执行操作
        await context.write_file("result.md", response)
```

#### 3. 钩子系统 (Hooks)

```toml
# 钩子配置示例
[[hooks]]
name = "auto-format"
trigger = "file-save"
pattern = "*.rs"
command = "rustfmt {file}"

[[hooks]]
name = "test-on-change"
trigger = "file-change"
pattern = "src/**/*.ts"
command = "npm test -- {file}"
```

#### 4. MCP (Model Context Protocol) 支持

```
┌─────────────────────────────────────────────────────────┐
│                    MCP 协议架构                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────────┐      MCP Protocol     ┌───────────┐  │
│   │  Codex CLI  │◄─────────────────────▶│  MCP      │  │
│   │  (Client)   │                       │  Server   │  │
│   └─────────────┘                       └───────────┘  │
│         │                                     │        │
│         │ 上下文请求                           │ 资源   │
│         ▼                                     ▼        │
│   ┌───────────────────────────────────────────────┐    │
│   │              外部资源/工具                      │    │
│   │  • 文件系统                                    │    │
│   │  • 数据库                                      │    │
│   │  • API 服务                                    │    │
│   │  • 代码仓库                                    │    │
│   └───────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 关键依赖

```toml
# Cargo.toml 核心依赖
[dependencies]
# 异步运行时
tokio = { version = "1", features = ["full"] }
async-trait = "0.1"

# Web 服务
axum = "0.7"
reqwest = { version = "0.12", features = ["json"] }

# 序列化
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# CLI
clap = { version = "4", features = ["derive"] }

# TUI
ratatui = "0.26"

# 错误处理
anyhow = "1"
thiserror = "1"

# 配置
toml = "0.8"
```

### 命令参考

```bash
# 基础命令
codex chat                    # 启动交互式对话
codex exec "指令"             # 执行单次指令
codex apply diff.patch        # 应用补丁文件

# 服务器模式
codex serve --port 8080       # 启动 WebSocket 服务器

# 配置管理
codex login                   # 登录 OpenAI
codex config set key value    # 设置配置项

# 沙箱控制
codex --sandbox=strict        # 严格沙箱模式
codex --sandbox=permissive    # 宽松沙箱模式
codex --no-sandbox            # 禁用沙箱 (不推荐)
```

---

## Gemini CLI

### 技术架构

Gemini CLI 是 Google 开发的多模型 AI 编程助手，采用纯 TypeScript 实现，注重可扩展性。

```
┌────────────────────────────────────────────────────────────────────┐
│                      Gemini CLI 系统架构                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐    │
│  │   CLI 层    │───▶│  核心引擎   │───▶│   AI 模型层         │    │
│  │   (Ink)     │    │  (Core)     │    │   (多模型支持)      │    │
│  └─────────────┘    └──────┬──────┘    └─────────────────────┘    │
│                            │                                       │
│         ┌──────────────────┼──────────────────┐                   │
│         ▼                  ▼                  ▼                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│  │  命令系统   │    │  策略引擎   │    │  遥测系统   │           │
│  │ (.gemini/)  │    │ (策略模板)  │    │(OpenTelemetry)          │
│  └─────────────┘    └─────────────┘    └─────────────┘           │
│                                                                    │
│  ┌─────────────┐    ┌─────────────┐                               │
│  │  DevTools   │    │  A2A Server │                               │
│  │   (React)   │    │ (Agent通信) │                               │
│  └─────────────┘    └─────────────┘                               │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 目录结构

```
gemini-cli/
├── packages/
│   ├── cli/                     # 主 CLI 包
│   │   ├── src/index.ts         # 入口文件
│   │   ├── src/commands/        # 命令实现
│   │   └── src/ui/              # UI 组件 (Ink)
│   ├── core/                    # 核心库
│   │   ├── src/ai/              # AI 模型集成
│   │   ├── src/policies/        # 策略定义
│   │   ├── src/tools/           # 工具实现
│   │   └── src/telemetry/       # 遥测
│   ├── a2a-server/              # Agent-to-Agent 服务器
│   ├── devtools/                # React 开发工具
│   └── test-utils/              # 测试工具
├── .gemini/                     # 配置目录
│   └── commands/                # 预定义命令
│       ├── core.toml            # 核心命令
│       ├── review-frontend.toml # 前端审查
│       └── explain.toml         # 代码解释
├── docs/                        # 文档
└── integration-tests/           # 集成测试
```

### 核心技术原理

#### 1. 命令系统

Gemini CLI 使用 TOML 文件定义可复用的命令模板：

```toml
# .gemini/commands/review.toml
name = "review"
description = "代码审查命令"

[[parameters]]
name = "files"
description = "要审查的文件"
required = true

[[tools]]
name = "read_file"
description = "读取文件内容"

[prompt]
system = """
你是一位资深代码审查专家。
请审查以下代码，关注：
1. 代码质量
2. 潜在bug
3. 性能问题
4. 安全隐患
"""

user = """
请审查文件: {{files}}
"""
```

#### 2. 策略引擎

```typescript
// 策略定义示例
export const policies = {
  // 只读策略 - 不修改任何文件
  'read-only': {
    canWrite: false,
    canExecute: false,
    canDelete: false,
  },

  // 写入策略 - 允许修改文件
  'write': {
    canWrite: true,
    canExecute: false,
    canDelete: false,
    maxFileSize: 1024 * 1024, // 1MB
  },

  // 完全控制策略
  'yolo': {
    canWrite: true,
    canExecute: true,
    canDelete: true,
  },
};
```

#### 3. 多模型支持

```typescript
// AI 模型适配器
interface AIModel {
  generate(prompt: string): Promise<string>;
  stream(prompt: string): AsyncIterator<string>;
}

class GeminiAdapter implements AIModel {
  constructor(private model: 'gemini-pro' | 'gemini-ultra') {}

  async generate(prompt: string): Promise<string> {
    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }
}

// 模型工厂
function createModel(provider: string): AIModel {
  switch (provider) {
    case 'google':
      return new GeminiAdapter('gemini-pro');
    case 'anthropic':
      return new ClaudeAdapter('claude-3');
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
```

#### 4. 遥测系统

```typescript
// OpenTelemetry 集成
import { trace, metrics } from '@opentelemetry/api';

const tracer = trace.getTracer('gemini-cli');

async function executeCommand(cmd: string) {
  const span = tracer.startSpan('command.execute');

  try {
    span.setAttribute('command.name', cmd);
    const result = await runCommand(cmd);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}
```

### 关键依赖

```json
{
  "dependencies": {
    // CLI 框架
    "yargs": "^17.0.0",
    "ink": "^4.0.0",
    "react": "^18.0.0",

    // AI 集成
    "@google/genai": "^0.1.0",
    "@modelcontextprotocol/sdk": "^1.0.0",

    // 遥测
    "@opentelemetry/api": "^1.0.0",
    "@opentelemetry/sdk-node": "^0.45.0",

    // 工具
    "tree-sitter": "^0.20.0",
    "marked": "^9.0.0",
    "node-pty": "^1.0.0",

    // 配置
    "@iarna/toml": "^2.2.0",
    "zod": "^3.0.0"
  }
}
```

### 命令参考

```bash
# 基础命令
gemini chat                    # 启动交互式对话
gemini ask "问题"              # 单次问答
gemini review ./src            # 代码审查
gemini explain file.ts         # 解释代码

# 使用特定策略
gemini --policy=read-only chat # 只读模式
gemini --policy=write chat     # 写入模式

# DevTools
gemini devtools                # 启动开发工具界面

# A2A 服务器
gemini serve --a2a             # 启动 Agent 通信服务器
```

---

## OpenCode

### 技术架构

OpenCode 是一个现代化的全栈 AI 开发平台，支持 CLI、Web 和桌面应用。

```
┌────────────────────────────────────────────────────────────────────┐
│                      OpenCode 系统架构                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                        客户端层                               │  │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────────────────────┐  │  │
│  │  │   CLI   │    │   Web   │    │    Desktop (Tauri)      │  │  │
│  │  │  (Bun)  │    │(SolidJS)│    │      (Rust + React)     │  │  │
│  │  └────┬────┘    └────┬────┘    └───────────┬─────────────┘  │  │
│  └───────┼──────────────┼─────────────────────┼────────────────┘  │
│          │              │                     │                    │
│          └──────────────┼─────────────────────┘                    │
│                         │                                          │
│  ┌──────────────────────▼──────────────────────────────────────┐  │
│  │                      服务层 (Hono)                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │  Session    │  │   Model     │  │    Workspace        │  │  │
│  │  │  Manager    │  │  Gateway    │  │    Manager          │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│  ┌───────────────────────────▼──────────────────────────────────┐  │
│  │                    数据层 (Drizzle + SQLite)                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │  Sessions   │  │  Messages   │  │    Workspaces       │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 目录结构

```
opencode/
├── packages/
│   ├── opencode/               # CLI 核心
│   │   ├── src/index.ts        # 入口
│   │   ├── src/commands/       # 命令实现
│   │   ├── src/session/        # 会话管理
│   │   └── src/models/         # 模型集成
│   ├── app/                    # Web 应用
│   │   ├── src/                # SolidJS 前端
│   │   └── vite.config.ts      # Vite 配置
│   ├── console/                # 控制台应用
│   │   ├── app/                # 前端路由
│   │   │   └── src/routes/     # 页面路由
│   │   └── core/               # 后端核心
│   │       └── db/             # Drizzle ORM
│   ├── desktop/                # Tauri 桌面应用
│   │   ├── src-tauri/          # Rust 后端
│   │   └── src/                # React 前端
│   ├── sdk/                    # JavaScript SDK
│   └── ui/                     # UI 组件库
├── turbo.json                  # Turbo 配置
└── bunfig.toml                 # Bun 配置
```

### 核心技术原理

#### 1. Bun 运行时

```typescript
// Bun 特有 API 使用
import { file, serve, sql } from 'bun';

// 文件操作
const text = await file('./input.txt').text();

// 高性能 HTTP 服务器
serve({
  port: 3000,
  async fetch(req) {
    return new Response('Hello from Bun!');
  },
});

// 内置 SQLite
const db = sql`SELECT * FROM users`;
```

#### 2. Drizzle ORM

```typescript
// schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey(),
  workspaceId: integer('workspace_id'),
  title: text('title'),
  createdAt: integer('created_at'),
});

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  sessionId: integer('session_id'),
  role: text('role'), // 'user' | 'assistant'
  content: text('content'),
  createdAt: integer('created_at'),
});

// 查询
const sessionMessages = await db
  .select()
  .from(messages)
  .where(eq(messages.sessionId, sessionId));
```

#### 3. SolidJS 响应式

```tsx
// SolidJS 组件示例
import { createSignal, For } from 'solid-js';

function ChatInterface() {
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [input, setInput] = createSignal('');

  const sendMessage = async () => {
    const userMessage = { role: 'user', content: input() };
    setMessages(prev => [...prev, userMessage]);

    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ message: input() }),
    });

    const data = await response.json();
    setMessages(prev => [...prev, data.message]);
    setInput('');
  };

  return (
    <div class="chat-container">
      <For each={messages()}>
        {(msg) => <div class={`message ${msg.role}`}>{msg.content}</div>}
      </For>
      <input
        value={input()}
        onInput={(e) => setInput(e.currentTarget.value)}
      />
      <button onClick={sendMessage}>发送</button>
    </div>
  );
}
```

#### 4. Tauri 桌面应用

```rust
// src-tauri/src/main.rs
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            execute_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn execute_command(cmd: String) -> Result<String, String> {
    let output = Command::new("sh")
        .arg("-c")
        .arg(&cmd)
        .output()
        .map_err(|e| e.to_string())?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
```

#### 5. Hono Web 框架

```typescript
// API 路由示例
import { Hono } from 'hono';

const app = new Hono();

// 会话管理
app.post('/api/sessions', async (c) => {
  const body = await c.req.json();
  const session = await createSession(body);
  return c.json(session);
});

// 聊天接口
app.post('/api/chat', async (c) => {
  const { message, sessionId } = await c.req.json();

  // 流式响应
  return c.stream(async (stream) => {
    for await (const chunk of streamChat(message)) {
      await stream.write(chunk);
    }
  });
});

export default app;
```

### 关键依赖

```json
{
  "dependencies": {
    // 运行时
    "bun": "latest",

    // Web 框架
    "hono": "^4.0.0",

    // 前端
    "solid-js": "^1.8.0",

    // 数据库
    "drizzle-orm": "^0.29.0",
    "better-sqlite3": "^9.0.0",

    // AI
    "ai": "^3.0.0",
    "@ai-sdk/openai": "^0.0.1",
    "@ai-sdk/anthropic": "^0.0.1",

    // 样式
    "tailwindcss": "^4.0.0",

    // 构建
    "turbo": "^1.0.0"
  }
}
```

### 命令参考

```bash
# CLI 命令
opencode chat                   # 启动交互式对话
opencode session new            # 创建新会话
opencode session list           # 列出会话
opencode workspace create       # 创建工作空间

# 开发命令
opencode dev                    # 开发模式
opencode build                  # 构建生产版本

# 桌面应用
opencode desktop                # 启动桌面应用

# 云服务
opencode deploy                 # 部署到云端
opencode logs                   # 查看日志
```

---

## 学习路线

### 第一阶段：基础入门 (2-4 周)

#### 1.1 编程语言基础

```
┌─────────────────────────────────────────────────────────────────┐
│                    语言学习优先级                                │
├─────────────────┬───────────────────────────────────────────────┤
│  TypeScript     │ 必修 - 所有三个工具都使用                     │
│  Rust           │ 进阶 - Codex CLI 核心，Tauri 桌面应用         │
│  Python         │ 可选 - Codex 技能系统                         │
└─────────────────┴───────────────────────────────────────────────┘
```

**TypeScript 学习路径：**
```typescript
// 1. 基础类型
let name: string = "opencode";
let count: number = 42;
let items: string[] = ["a", "b", "c"];

// 2. 接口和类型
interface Session {
  id: string;
  messages: Message[];
}

type Status = 'pending' | 'completed' | 'error';

// 3. 泛型
function createArray<T>(item: T): T[] {
  return [item];
}

// 4. 异步编程
async function fetchSession(id: string): Promise<Session> {
  const response = await fetch(`/api/sessions/${id}`);
  return response.json();
}

// 5. 装饰器 (用于依赖注入等)
@injectable()
class SessionService {
  constructor(private db: Database) {}
}
```

#### 1.2 包管理和构建工具

| 工具 | 使用场景 | 学习资源 |
|------|----------|----------|
| npm/pnpm | Node.js 包管理 | [pnpm 官方文档](https://pnpm.io) |
| Cargo | Rust 包管理 | [Cargo Book](https://doc.rust-lang.org/cargo/) |
| Bun | 现代运行时和包管理 | [Bun 官方文档](https://bun.sh) |
| Turbo | Monorepo 构建 | [Turbo 官方文档](https://turbo.build) |

#### 1.3 CLI 开发基础

```typescript
// 使用 yargs 创建 CLI
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

yargs(hideBin(process.argv))
  .command('chat', '开始对话', {}, async (argv) => {
    console.log('启动聊天模式...');
  })
  .command('session <action>', '会话管理', (yargs) => {
    return yargs.positional('action', {
      choices: ['new', 'list', 'delete'] as const,
    });
  })
  .demandCommand()
  .help()
  .argv;
```

### 第二阶段：深入理解 (4-8 周)

#### 2.1 AI 模型集成

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI 集成技术栈                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  应用层                                                    │ │
│  │  • Prompt Engineering (提示工程)                          │ │
│  │  • Context Management (上下文管理)                        │ │
│  │  • Response Parsing (响应解析)                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              │                                  │
│  ┌───────────────────────────▼───────────────────────────────┐ │
│  │  SDK 层                                                   │ │
│  │  • @google/genai (Gemini)                                │ │
│  │  • openai (OpenAI)                                        │ │
│  │  • @anthropic-ai/sdk (Claude)                            │ │
│  │  • ai (Vercel AI SDK - 多模型统一)                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              │                                  │
│  ┌───────────────────────────▼───────────────────────────────┐ │
│  │  协议层                                                   │ │
│  │  • MCP (Model Context Protocol)                          │ │
│  │  • A2A (Agent-to-Agent)                                  │ │
│  │  • WebSocket (实时通信)                                   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**MCP 协议示例：**
```typescript
// MCP 客户端实现
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const client = new Client({
  name: 'my-mcp-client',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
    resources: {},
  },
});

// 连接服务器
await client.connect(transport);

// 列出可用工具
const tools = await client.listTools();

// 调用工具
const result = await client.callTool({
  name: 'read_file',
  arguments: { path: './src/index.ts' },
});
```

#### 2.2 安全沙箱实现

```rust
// Linux Landlock 沙箱示例
use landlock::{Access, AccessFs, Ruleset, RulesetAttr, RulesetCreated};

fn setup_sandbox() -> Result<()> {
    let abi = landlock::ABI::V1;

    let ruleset = Ruleset::new()
        .handle(AccessFs::from_all(abi))?
        .add_rule(
            RulesetAttr::new()
                .allow(AccessFs::ReadFile | AccessFs::ReadDir)
                .path("/workspace")?
        )?
        .create()?;

    ruleset.restrict_self()?;

    Ok(())
}
```

#### 2.3 响应式 UI 开发

```tsx
// SolidJS 状态管理
import { createSignal, createEffect, createContext, useContext } from 'solid-js';

// 上下文
const SessionContext = createContext<SessionStore>();

function SessionProvider(props: { children: any }) {
  const [sessions, setSessions] = createSignal<Session[]>([]);
  const [activeSession, setActiveSession] = createSignal<Session | null>(null);

  // 副作用 - 自动保存
  createEffect(() => {
    localStorage.setItem('sessions', JSON.stringify(sessions()));
  });

  const store: SessionStore = {
    sessions,
    activeSession,
    createSession: (title: string) => {
      const session = { id: crypto.randomUUID(), title };
      setSessions(prev => [...prev, session]);
      return session;
    },
  };

  return (
    <SessionContext.Provider value={store}>
      {props.children}
    </SessionContext.Provider>
  );
}
```

### 第三阶段：实战项目 (8-12 周)

#### 3.1 项目一：简化版 AI CLI

```typescript
// 项目结构
my-ai-cli/
├── src/
│   ├── index.ts           # 入口
│   ├── commands/
│   │   ├── chat.ts        # 聊天命令
│   │   └── ask.ts         # 问答命令
│   ├── ai/
│   │   ├── provider.ts    # AI 提供者接口
│   │   └── openai.ts      # OpenAI 实现
│   └── utils/
│       └── file.ts        # 文件工具
├── package.json
└── tsconfig.json
```

#### 3.2 项目二：MCP 服务器

```typescript
// 文件系统 MCP 服务器
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

const server = new Server({
  name: 'filesystem-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
    resources: {},
  },
});

// 注册工具
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'read_file',
      description: '读取文件内容',
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
  if (request.params.name === 'read_file') {
    const content = await fs.readFile(request.params.arguments.path, 'utf-8');
    return { content: [{ type: 'text', text: content }] };
  }
});
```

#### 3.3 项目三：全栈 AI 应用

```
┌─────────────────────────────────────────────────────────────────┐
│                    项目架构                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend (SolidJS)          Backend (Hono)                    │
│  ┌─────────────────┐         ┌─────────────────┐               │
│  │ • Chat UI       │◄───────▶│ • REST API      │               │
│  │ • Session List  │  HTTP   │ • WebSocket     │               │
│  │ • Settings      │         │ • AI Gateway    │               │
│  └─────────────────┘         └────────┬────────┘               │
│                                       │                         │
│                              ┌────────▼────────┐               │
│                              │  SQLite (Drizzle)│              │
│                              │  • Sessions      │              │
│                              │  • Messages      │              │
│                              └─────────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 第四阶段：源码研读 (持续)

#### 推荐阅读顺序

```
Codex CLI:
1. codex-rs/cli/src/main.rs      → 入口点
2. codex-rs/core/src/agent/      → Agent 逻辑
3. codex-rs/linux-sandbox/       → 沙箱实现
4. codex-rs/mcp-server/          → MCP 协议

Gemini CLI:
1. packages/cli/src/index.ts     → 入口点
2. packages/core/src/ai/         → AI 集成
3. packages/core/src/policies/   → 策略引擎
4. .gemini/commands/             → 命令模板

OpenCode:
1. packages/opencode/src/        → CLI 核心
2. packages/console/core/        → 后端逻辑
3. packages/console/app/         → Web 前端
4. packages/desktop/src-tauri/   → 桌面应用
```

---

## 最佳实践

### 1. 安全性

```typescript
// ✅ 正确：验证用户输入
function sanitizePath(path: string): string {
  const resolved = path.resolve(path);
  if (!resolved.startsWith(process.cwd())) {
    throw new Error('路径不允许');
  }
  return resolved;
}

// ❌ 错误：直接使用用户输入
function unsafeRead(path: string) {
  return fs.readFile(path); // 可能路径遍历
}
```

### 2. 错误处理

```typescript
// ✅ 正确：结构化错误处理
class AIError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean
  ) {
    super(message);
  }
}

async function callAI(prompt: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      return await ai.generate(prompt);
    } catch (error) {
      if (error instanceof AIError && error.retryable && i < retries - 1) {
        await sleep(1000 * Math.pow(2, i));
        continue;
      }
      throw error;
    }
  }
}
```

### 3. 配置管理

```typescript
// ✅ 正确：分层配置
interface Config {
  ai: {
    provider: 'openai' | 'anthropic' | 'google';
    model: string;
    apiKey: string;
  };
  sandbox: {
    enabled: boolean;
    allowedPaths: string[];
  };
}

function loadConfig(): Config {
  return {
    ai: {
      provider: process.env.AI_PROVIDER || 'openai',
      model: process.env.AI_MODEL || 'gpt-4',
      apiKey: process.env.AI_API_KEY!,
    },
    sandbox: {
      enabled: process.env.SANDBOX !== 'false',
      allowedPaths: process.cwd().split(','),
    },
  };
}
```

### 4. 性能优化

```typescript
// ✅ 正确：流式响应
async function* streamChat(message: string): AsyncGenerator<string> {
  const stream = await ai.stream(message);

  for await (const chunk of stream) {
    yield chunk.text;
  }
}

// 使用
for await (const chunk of streamChat('Hello')) {
  process.stdout.write(chunk);
}
```

---

## 参考资源

### 官方文档
- [OpenAI Codex CLI](https://github.com/openai/codex)
- [Google Gemini CLI](https://github.com/google/gemini-cli)
- [OpenCode](https://github.com/sst/opencode)

### 相关技术
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Bun Runtime](https://bun.sh)
- [Tauri Desktop](https://tauri.app)
- [SolidJS](https://www.solidjs.com/)
- [Drizzle ORM](https://orm.drizzle.team/)

### 学习课程
- [TypeScript 深入浅出](https://www.typescriptlang.org/docs/handbook/)
- [Rust 程序设计语言](https://doc.rust-lang.org/book/)
- [AI Engineering 课程](https://www.deeplearning.ai/)
