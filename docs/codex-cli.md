# OpenAI Codex CLI 技术文档

## 概述

Codex CLI 是 OpenAI 开发的命令行 AI 编程代理，采用 Rust + TypeScript 混合架构，核心特点是对安全性的高度重视。

| 属性 | 描述 |
|------|------|
| **开发者** | OpenAI |
| **核心定位** | 安全优先的 AI 编程代理 |
| **主要语言** | Rust + TypeScript |
| **运行时** | Node.js 16+ |
| **包管理** | Cargo + npm |

---

## 系统架构

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

## 目录结构

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

---

## 核心技术原理

### 1. 安全沙箱系统

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
```

**平台特定实现：**

| 平台 | 技术 | 原理 |
|------|------|------|
| Linux | Landlock | 内核级文件系统访问控制 |
| Linux | seccomp | 系统调用过滤 |
| macOS | Seatbelt | macOS 沙箱配置文件 |
| Windows | Restricted Token | 令牌权限限制 |

**Linux Landlock 示例：**

```rust
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

**macOS Seatbelt 示例：**

```xml
<!-- sandbox-exec 配置 -->
(version 1)
(deny default)
(allow file-read* (subpath "/workspace"))
(allow file-write* (subpath "/workspace"))
(deny network*)
```

### 2. 技能系统 (Skills)

技能系统允许用户扩展 Codex CLI 的能力，支持 Python 编写：

```python
# .codex/skills/example.py
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

        return response
```

**技能目录结构：**

```
.codex/skills/
├── code-review/
│   ├── skill.py          # 技能主文件
│   ├── config.toml       # 配置文件
│   └── templates/        # 模板文件
├── test-generator/
│   └── skill.py
└── documentation/
    └── skill.py
```

### 3. 钩子系统 (Hooks)

钩子系统允许在特定事件触发时执行自定义命令：

```toml
# .codex/hooks.toml
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

[[hooks]]
name = "git-auto-commit"
trigger = "session-end"
condition = "has-changes"
command = "git add -A && git commit -m 'Auto commit by Codex'"
```

**支持的触发器：**

| 触发器 | 说明 |
|--------|------|
| `file-save` | 文件保存时 |
| `file-change` | 文件内容变化时 |
| `file-create` | 文件创建时 |
| `file-delete` | 文件删除时 |
| `session-start` | 会话开始时 |
| `session-end` | 会话结束时 |
| `command-pre` | 命令执行前 |
| `command-post` | 命令执行后 |

### 4. MCP (Model Context Protocol) 支持

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

**MCP 服务器实现：**

```rust
// codex-rs/mcp-server/src/server.rs
pub struct McpServer {
    tools: Vec<Tool>,
    resources: Vec<Resource>,
}

impl McpServer {
    pub async fn handle_request(&self, request: Request) -> Response {
        match request.method.as_str() {
            "tools/list" => self.list_tools(),
            "tools/call" => self.call_tool(request.params),
            "resources/list" => self.list_resources(),
            "resources/read" => self.read_resource(request.params),
            _ => Response::error("Unknown method"),
        }
    }
}
```

### 5. 应用服务器

基于 WebSocket 的实时通信服务器：

```rust
// codex-rs/app-server/src/server.rs
use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::Response,
    routing::get,
    Router,
};

pub async fn websocket_handler(ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(socket: WebSocket) {
    let (sender, receiver) = socket.split();

    // 处理消息
    while let Some(msg) = receiver.next().await {
        match msg {
            Ok(Message::Text(text)) => {
                // 处理文本消息
                let response = process_message(text).await;
                sender.send(Message::Text(response)).await;
            }
            Ok(Message::Binary(data)) => {
                // 处理二进制消息
            }
            _ => break,
        }
    }
}
```

---

## 关键依赖

```toml
# Cargo.toml 核心依赖
[dependencies]
# 异步运行时
tokio = { version = "1", features = ["full"] }
async-trait = "0.1"
futures = "0.3"

# Web 服务
axum = "0.7"
tower = "0.4"
reqwest = { version = "0.12", features = ["json", "stream"] }

# 序列化
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# CLI
clap = { version = "4", features = ["derive", "env"] }

# TUI
ratatui = "0.26"
crossterm = "0.27"

# 错误处理
anyhow = "1"
thiserror = "1"

# 配置
toml = "0.8"
toml_edit = "0.22"

# 安全
libc = "0.2"

# 日志
tracing = "0.1"
tracing-subscriber = "0.3"

[dev-dependencies]
tokio-test = "0.4"
```

---

## 命令参考

### 基础命令

```bash
# 启动交互式对话
codex chat

# 执行单次指令
codex exec "创建一个 React 组件"

# 应用补丁文件
codex apply diff.patch

# 查看帮助
codex --help
```

### 服务器模式

```bash
# 启动 WebSocket 服务器
codex serve --port 8080

# 指定主机地址
codex serve --host 0.0.0.0 --port 8080

# 启用认证
codex serve --auth-token my-secret-token
```

### 配置管理

```bash
# 登录 OpenAI
codex login

# 设置配置项
codex config set model gpt-4-turbo
codex config set sandbox strict

# 查看当前配置
codex config list

# 重置配置
codex config reset
```

### 沙箱控制

```bash
# 严格沙箱模式 (默认)
codex --sandbox=strict chat

# 宽松沙箱模式
codex --sandbox=permissive chat

# 禁用沙箱 (不推荐)
codex --no-sandbox chat

# 指定允许的路径
codex --allow-path=/workspace --allow-path=/tmp chat
```

### 技能管理

```bash
# 列出可用技能
codex skills list

# 安装技能
codex skills install github.com/user/skill-name

# 运行技能
codex skills run code-review

# 创建新技能
codex skills create my-skill
```

---

## 配置文件

### 全局配置

```toml
# ~/.codex/config.toml
[general]
model = "gpt-4-turbo"
language = "zh-CN"

[api]
base_url = "https://api.openai.com/v1"
timeout = 60

[sandbox]
enabled = true
mode = "strict"  # strict | permissive | disabled

[sandbox.paths]
read = ["/home/user/projects"]
write = ["/home/user/projects/workspace"]

[ui]
theme = "dark"
show_tokens = true
```

### 项目配置

```toml
# .codex/project.toml
[project]
name = "my-project"
description = "我的项目"

[context]
include = ["src/**/*.ts", "README.md"]
exclude = ["node_modules", "dist"]

[skills]
enabled = ["code-review", "test-generator"]

[hooks]
enabled = true
config = ".codex/hooks.toml"
```

---

## 最佳实践

### 1. 安全配置

```bash
# ✅ 推荐：使用严格沙箱
codex --sandbox=strict chat

# ✅ 推荐：限制允许路径
codex --allow-path=$(pwd) chat

# ❌ 不推荐：禁用沙箱
codex --no-sandbox chat
```

### 2. 技能开发

```python
# ✅ 推荐：结构化技能
class CodeReviewSkill(Skill):
    name = "code-review"
    version = "1.0.0"

    def __init__(self):
        self.rules = self.load_rules()

    async def execute(self, context: Context):
        files = await context.get_changed_files()
        for file in files:
            review = await self.review_file(file)
            await context.add_comment(file, review)
```

### 3. 钩子配置

```toml
# ✅ 推荐：条件触发
[[hooks]]
name = "format-on-save"
trigger = "file-save"
pattern = "src/**/*.ts"
condition = "is-typeScript-file"
command = "prettier --write {file}"
```

---

## 学习路线

### 阶段一：基础使用 (1-2 周)

1. 安装和配置 Codex CLI
2. 掌握基本命令 (chat, exec, apply)
3. 理解沙箱安全模型
4. 配置项目和全局设置

### 阶段二：进阶功能 (2-4 周)

1. 编写自定义技能 (Python)
2. 配置钩子系统
3. 使用 MCP 协议集成外部工具
4. 理解 WebSocket 服务器模式

### 阶段三：源码研读 (持续)

```
推荐阅读顺序：
1. codex-rs/cli/src/main.rs      → 入口点
2. codex-rs/core/src/agent/      → Agent 逻辑
3. codex-rs/linux-sandbox/       → 沙箱实现
4. codex-rs/mcp-server/          → MCP 协议
5. codex-rs/app-server/          → WebSocket 服务
```

---

## 参考资源

- [Codex CLI GitHub](https://github.com/openai/codex)
- [Rust 官方文档](https://www.rust-lang.org/)
- [Landlock 文档](https://landlock.io/)
- [MCP 协议规范](https://modelcontextprotocol.io/)
