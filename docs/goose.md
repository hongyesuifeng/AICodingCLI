# Goose 技术文档

## 概述

Goose 是 Block 开发的开源 AI 代理框架，采用 Rust 实现，支持 CLI 和 Electron 桌面应用，专注于自动化工程任务。

| 属性 | 描述 |
|------|------|
| **开发者** | Block (Square) |
| **核心定位** | 本地可扩展的自动化 AI 代理 |
| **主要语言** | Rust |
| **运行时** | Rust + Node.js (桌面应用) |
| **桌面应用** | Electron + React |

### 关键特性

- **完全本地运行**: 所有处理都在本地进行，保护隐私
- **多模型支持**: 支持几乎所有 LLM 提供商
- **MCP 协议**: 支持 Model Context Protocol 扩展
- **多平台**: CLI + 桌面应用 (Electron)
- **可扩展**: 内置扩展系统，支持自定义工具

---

## 系统架构

```
┌────────────────────────────────────────────────────────────────────┐
│                        Goose 系统架构                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                      客户端层                                 │  │
│  │  ┌─────────────────┐    ┌─────────────────────────────────┐  │  │
│  │  │   CLI (Rust)    │    │   Desktop (Electron + React)    │  │  │
│  │  │  goose-cli      │    │   ui/desktop                    │  │  │
│  │  └────────┬────────┘    └───────────────┬─────────────────┘  │  │
│  └───────────┼─────────────────────────────┼────────────────────┘  │
│              │                             │                        │
│  ┌───────────▼─────────────────────────────▼────────────────────┐  │
│  │                    Goose Server (goosed)                      │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │  │
│  │  │  Session    │  │   Agent     │  │   Extension         │   │  │
│  │  │  Manager    │  │   Engine    │  │   Manager           │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────────────────────▼───────────────────────────────────┐ │
│  │                    Provider 层 (多模型支持)                     │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │ │
│  │  │ Claude  │ │ OpenAI  │ │ Gemini  │ │ Ollama  │ │ LiteLLM │ │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│  ┌───────────────────────────▼───────────────────────────────────┐ │
│  │                    MCP 扩展层                                  │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │ │
│  │  │  goose-mcp  │  │   memory    │  │   autovisualiser    │   │ │
│  │  │  (内置扩展) │  │  (内存管理) │  │   (自动可视化)      │   │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
goose/
├── crates/                          # Rust crates
│   ├── goose/                       # 核心库
│   │   ├── src/
│   │   │   ├── agents/              # Agent 实现
│   │   │   │   ├── agent.rs         # 主 Agent
│   │   │   │   ├── extension.rs     # 扩展配置
│   │   │   │   ├── extension_manager.rs
│   │   │   │   ├── platform_tools.rs
│   │   │   │   ├── prompt_manager.rs
│   │   │   │   ├── retry.rs         # 重试逻辑
│   │   │   │   └── subagent_*.rs    # 子代理
│   │   │   ├── providers/           # AI 提供商
│   │   │   │   ├── base.rs          # Provider trait
│   │   │   │   ├── anthropic.rs     # Claude
│   │   │   │   ├── openai.rs        # GPT
│   │   │   │   ├── google.rs        # Gemini
│   │   │   │   ├── ollama.rs        # 本地模型
│   │   │   │   ├── litellm.rs       # LiteLLM
│   │   │   │   ├── openrouter.rs    # OpenRouter
│   │   │   │   └── ...
│   │   │   ├── gateway/             # 消息网关
│   │   │   │   ├── telegram.rs      # Telegram 集成
│   │   │   │   └── manager.rs
│   │   │   ├── conversation/        # 会话管理
│   │   │   ├── config/              # 配置系统
│   │   │   ├── permission/          # 权限管理
│   │   │   ├── session/             # 会话持久化
│   │   │   └── security/            # 安全检查
│   │   └── Cargo.toml
│   ├── goose-cli/                   # CLI 实现
│   │   ├── src/
│   │   │   ├── main.rs              # 入口点
│   │   │   └── cli/                 # CLI 逻辑
│   │   └── Cargo.toml
│   ├── goose-server/                # 后端服务
│   │   └── src/main.rs              # goosed 服务
│   ├── goose-mcp/                   # MCP 扩展
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── autovisualiser/      # 自动可视化
│   │   │   ├── memory/              # 内存扩展
│   │   │   ├── computercontroller/  # 电脑控制
│   │   │   └── tutorial/            # 教程
│   ├── goose-acp/                   # Agent Client Protocol
│   └── goose-test/                  # 测试工具
├── ui/                              # UI 应用
│   └── desktop/                     # Electron 桌面应用
│       ├── src/
│       │   ├── main.ts              # Electron 主进程
│       │   ├── App.tsx              # React 应用
│       │   ├── components/          # React 组件
│       │   ├── api/                 # API 客户端
│       │   └── hooks/               # React Hooks
│       ├── package.json
│       └── vite.config.mts
├── services/                        # 服务
│   └── ask-ai-bot/                  # AI 问答机器人
├── evals/                           # 评估基准
├── documentation/                   # 文档
├── examples/                        # 示例
├── workflow_recipes/                # 工作流配方
├── Cargo.toml                       # Workspace 配置
├── Justfile                         # Just 任务
└── flake.nix                        # Nix Flake
```

---

## 核心技术原理

### 1. Agent 系统

```rust
// crates/goose/src/agents/agent.rs
pub struct Agent {
    pub(super) provider: SharedProvider,
    pub config: AgentConfig,

    pub extension_manager: Arc<ExtensionManager>,
    pub(super) final_output_tool: Arc<Mutex<Option<FinalOutputTool>>>,
    pub(super) frontend_tools: Mutex<HashMap<String, FrontendTool>>,
    pub(super) prompt_manager: Mutex<PromptManager>,

    pub(super) retry_manager: RetryManager,
    pub(super) tool_inspection_manager: ToolInspectionManager,
}

pub struct AgentConfig {
    pub session_manager: Arc<SessionManager>,
    pub permission_manager: Arc<PermissionManager>,
    pub scheduler_service: Option<Arc<dyn SchedulerTrait>>,
    pub goose_mode: GooseMode,
    pub goose_platform: GoosePlatform,
}

// Agent 平台类型
pub enum GoosePlatform {
    GooseDesktop,
    GooseCli,
}
```

### 2. Provider 系统

```rust
// crates/goose/src/providers/base.rs
#[async_trait]
pub trait Provider: Send + Sync {
    /// 完成请求
    async fn complete(
        &self,
        system: &str,
        messages: &[Message],
        tools: &[Tool],
        tool_choice: Option<ToolChoice>,
    ) -> Result<ProviderResponse>;

    /// 流式完成
    async fn complete_stream(
        &self,
        system: &str,
        messages: &[Message],
        tools: &[Tool],
        tool_choice: Option<ToolChoice>,
    ) -> Result<BoxStream<Result<ProviderResponse>>>;

    /// 模型信息
    fn model(&self) -> &str;
}
```

**支持的 Provider:**

| Provider | 文件 | 说明 |
|----------|------|------|
| Anthropic | `anthropic.rs` | Claude 系列 |
| OpenAI | `openai.rs` | GPT 系列 |
| Google | `google.rs` | Gemini 系列 |
| Ollama | `ollama.rs` | 本地模型 |
| LiteLLM | `litellm.rs` | 多模型统一接口 |
| OpenRouter | `openrouter.rs` | 模型聚合 |
| Azure | `azure.rs` | Azure OpenAI |
| Bedrock | `bedrock.rs` | AWS Bedrock |
| xAI | `xai.rs` | Grok |

### 3. MCP 扩展系统

```rust
// crates/goose-mcp/src/lib.rs
pub mod autovisualiser;
pub mod computercontroller;
pub mod memory;
pub mod peekaboo;
pub mod subprocess;
pub mod tutorial;

// MCP 服务器运行器
pub struct McpServerRunner {
    // MCP 协议实现
}
```

**内置扩展:**

| 扩展 | 功能 |
|------|------|
| `autovisualiser` | 自动生成数据可视化 |
| `memory` | 长期记忆存储 |
| `computercontroller` | 电脑操作控制 |
| `peekaboo` | 屏幕查看 |
| `subprocess` | 子进程执行 |
| `tutorial` | 教程引导 |

### 4. 权限管理

```rust
// crates/goose/src/permission/
pub struct PermissionManager {
    // 权限配置和检查
}

pub enum PermissionCheckResult {
    Allowed,
    Denied,
    AskUser,
}

// 权限检查器
pub struct PermissionInspector {
    // 检查工具调用权限
}
```

### 5. 会话管理

```rust
// crates/goose/src/session/
pub struct SessionManager {
    // 会话持久化和恢复
}

pub struct Session {
    pub id: Uuid,
    pub messages: Vec<Message>,
    pub extension_state: ExtensionState,
}
```

### 6. Gateway 系统

```rust
// crates/goose/src/gateway/mod.rs
#[async_trait]
pub trait Gateway: Send + Sync + 'static {
    fn gateway_type(&self) -> &str;

    async fn start(
        &self,
        handler: GatewayHandler,
        cancel: CancellationToken,
    ) -> anyhow::Result<()>;

    async fn send_message(
        &self,
        user: &PlatformUser,
        message: OutgoingMessage,
    ) -> anyhow::Result<()>;
}

// Telegram Gateway
pub struct TelegramGateway {
    // Telegram Bot 集成
}
```

### 7. 桌面应用架构

```tsx
// ui/desktop/src/App.tsx
import { useState, useEffect } from 'react';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // 与 goosed 服务通信
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:38457');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleServerMessage(data);
    };
  }, []);

  return (
    <div className="app">
      <Sidebar sessions={sessions} />
      <ChatWindow messages={messages} />
      <ExtensionPanel extensions={extensions} />
    </div>
  );
}
```

---

## 关键依赖

### Rust 依赖 (Cargo.toml)

```toml
[workspace.dependencies]
# 异步运行时
tokio = { version = "1.49", features = ["full"] }
async-trait = "0.1"
futures = "0.3"

# Web 框架
axum = "0.8"
tower-http = "0.6.8"

# MCP 协议
rmcp = { version = "1.1.0", features = ["schemars", "auth"] }

# CLI
clap = { version = "4", features = ["derive"] }

# 序列化
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# 错误处理
anyhow = "1.0"
thiserror = "1.0"

# 日志
tracing = "0.1"
tracing-subscriber = "0.3"

# OpenTelemetry
opentelemetry = "0.31"
opentelemetry-otlp = "0.31"

# Tree-sitter (代码解析)
tree-sitter = "0.26"
tree-sitter-rust = "0.24"
tree-sitter-python = "0.25"
tree-sitter-javascript = "0.25"
tree-sitter-typescript = "0.23"
```

### 桌面应用依赖

```json
{
  "dependencies": {
    "electron": "^33.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.0.0",
    "tailwindcss": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vite": "^6.0.0",
    "electron-forge": "^7.0.0",
    "playwright": "^1.0.0",
    "vitest": "^3.0.0"
  }
}
```

---

## 命令参考

### CLI 命令

```bash
# 启动交互模式
goose

# 指定模型
goose --model claude-3-5-sonnet
goose --model gpt-4o
goose --model gemini-2.0-flash

# 使用 Ollama 本地模型
goose --model ollama://llama3.2

# 执行单次任务
goose "创建一个 React 组件"

# 指定配置文件
goose --config ~/.config/goose/config.yaml

# 调试模式
goose --debug

# 版本信息
goose --version
```

### 桌面应用

```bash
# 启动桌面应用
cd ui/desktop
npm install
npm run start-gui

# 开发模式
npm run start-gui-debug

# 构建应用
npm run package
npm run make

# 测试
npm run test
npm run test-e2e
```

### 开发命令

```bash
# 激活开发环境
source bin/activate-hermit

# 构建
cargo build              # debug
cargo build --release    # release
just release-binary      # release + openapi

# 测试
cargo test               # 所有测试
cargo test -p goose      # 特定 crate

# 代码检查
cargo fmt
cargo clippy --all-targets -- -D warnings

# 生成 OpenAPI
just generate-openapi

# 运行 UI
just run-ui
```

---

## 配置文件

### Goose 配置

```yaml
# ~/.config/goose/config.yaml
provider:
  type: anthropic
  model: claude-3-5-sonnet

extensions:
  - name: developer
    enabled: true
  - name: memory
    enabled: true
  - name: autovisualiser
    enabled: false

permissions:
  mode: ask  # ask / allow / deny
  tools:
    shell: ask
    file_write: ask
    file_read: allow

session:
  save_history: true
  max_history: 100

ui:
  theme: dark
  language: zh-CN
```

### 扩展配置

```yaml
# ~/.config/goose/extensions.yaml
extensions:
  - name: developer
    description: "开发工具扩展"
    tools:
      - shell
      - file_read
      - file_write
      - search

  - name: browser
    description: "浏览器扩展"
    tools:
      - navigate
      - screenshot
      - click
```

---

## 最佳实践

### 1. 模型选择

```bash
# ✅ 推荐：Claude Sonnet (最佳性能)
goose --model claude-3-5-sonnet

# ✅ 推荐：本地模型 (隐私保护)
goose --model ollama://llama3.2

# ✅ 成本优化：使用 LiteLLM
goose --model litellm://gpt-4o-mini
```

### 2. 权限配置

```yaml
# ✅ 推荐：默认询问
permissions:
  mode: ask

# ✅ 信任的只读操作
permissions:
  tools:
    file_read: allow
    search: allow

# ⚠️ 谨慎：自动允许所有
permissions:
  mode: allow  # 仅在隔离环境使用
```

### 3. 扩展开发

```rust
// ✅ 推荐：实现 MCP 协议
pub struct MyExtension {
    // 扩展状态
}

#[async_trait]
impl McpExtension for MyExtension {
    async fn call_tool(
        &self,
        name: &str,
        arguments: Value,
    ) -> Result<CallToolResult> {
        match name {
            "my_tool" => self.handle_my_tool(arguments).await,
            _ => Err(anyhow!("Unknown tool: {}", name)),
        }
    }
}
```

---

## 与其他工具对比

| 特性 | Goose | Codex CLI | Aider |
|------|:-----:|:---------:|:-----:|
| **语言** | Rust | Rust+TS | Python |
| **桌面应用** | ✅ Electron | ❌ | ❌ |
| **安全沙箱** | ⚠️ 有限 | ✅ 原生 | ❌ |
| **多模型** | ✅ | ❌ | ✅ |
| **MCP 协议** | ✅ | ✅ | ❌ |
| **本地模型** | ✅ Ollama | ❌ | ✅ |
| **消息平台** | ✅ Telegram | ❌ | ❌ |
| **扩展系统** | ✅ MCP | ✅ Skills | ❌ |

---

## 学习路线

### 阶段一：基础使用 (1-2 周)

1. 安装 Goose CLI 和桌面应用
2. 配置 AI 模型提供商
3. 掌握基本命令和交互
4. 理解权限系统

### 阶段二：进阶功能 (2-4 周)

1. 配置和使用扩展
2. 理解 MCP 协议
3. 会话管理和历史
4. 桌面应用高级功能

### 阶段三：高级应用 (4-6 周)

1. 开发自定义 MCP 扩展
2. 配置消息网关 (Telegram)
3. 本地模型集成 (Ollama)
4. 性能调优

### 阶段四：源码研读 (持续)

```
推荐阅读顺序：
1. crates/goose-cli/src/main.rs        → 入口点
2. crates/goose/src/agents/agent.rs    → Agent 核心
3. crates/goose/src/providers/base.rs  → Provider trait
4. crates/goose/src/permission/        → 权限系统
5. crates/goose-mcp/src/lib.rs         → MCP 扩展
6. ui/desktop/src/App.tsx              → 桌面应用
```

---

## 参考资源

### 官方资源
- [Goose 官网](https://block.github.io/goose/)
- [GitHub 仓库](https://github.com/block/goose)
- [快速入门](https://block.github.io/goose/docs/quickstart)
- [安装指南](https://block.github.io/goose/docs/getting-started/installation)
- [教程](https://block.github.io/goose/docs/category/tutorials)

### 社区资源
- [Discord](https://discord.gg/goose-oss)
- [YouTube](https://www.youtube.com/@goose-oss)
- [Twitter/X](https://x.com/goose_oss)

### 相关技术
- [MCP 协议](https://modelcontextprotocol.io/)
- [Ollama](https://ollama.ai/)
- [Electron](https://www.electronjs.org/)
- [LiteLLM](https://github.com/BerriAI/litellm)
