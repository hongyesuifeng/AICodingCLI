# AI 编程工具技术文档

本文档详细介绍主流 AI 编程工具的技术架构、实现原理、最佳实践和学习路线。

---

## 核心工具 (日常使用)

这三个工具是日常开发的主力，每个都有详细的技术文档：

| 工具 | 核心优势 | 文档路径 |
|------|----------|----------|
| **Claude Code** | 上下文理解最强、代码质量最高 | [claude-code.md](./claude-code.md) |
| **Codex CLI** | 安全沙箱、企业级安全 | [codex-cli.md](./codex-cli.md) |
| **OpenCode** | 全栈平台、多模型、GUI | [opencode.md](./opencode.md) |

---

## 三大核心工具对比

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        核心工具特性对比                                      │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│     特性        │   Claude Code   │    Codex CLI    │      OpenCode         │
├─────────────────┼─────────────────┼─────────────────┼───────────────────────┤
│ 核心优势        │ 上下文理解      │ 安全沙箱        │ 全栈平台              │
│ 底层模型        │ Claude 4.5/4.6  │ GPT-4o/o1/o3    │ 多模型支持            │
│ 上下文窗口      │ 200K            │ 128K            │ 视模型而定            │
│ 开源状态        │ 闭源            │ Apache 2.0      │ 开源                  │
│ 多客户端        │ CLI             │ CLI             │ CLI+Web+Desktop       │
│ 沙箱安全        │ 权限系统        │ 原生多平台      │ 系统沙箱              │
│ 多模型支持      │ 单一模型        │ 单一模型        │ 原生多模型            │
│ 本地模型        │ 无              │ 无              │ Ollama 集成           │
└─────────────────┴─────────────────┴─────────────────┴───────────────────────┘
```

### 选择决策树

```
┌─────────────────────────────────────────────────────────────────┐
│                     工具选择决策树                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  需要最高代码质量？                                             │
│         │                                                       │
│         ├─ 是 ──▶ Claude Code (Opus 4.6)                       │
│         │                                                       │
│         └─ 否                                                   │
│              │                                                  │
│              ├─ 需要最高安全隔离？                               │
│              │      │                                           │
│              │      ├─ 是 ──▶ Codex CLI                         │
│              │      │                                           │
│              │      └─ 否                                       │
│              │           │                                      │
│              │           ├─ 需要 GUI 界面？                      │
│              │           │      │                               │
│              │           │      ├─ 是 ──▶ OpenCode             │
│              │           │      │                               │
│              │           │      └─ 否                          │
│              │           │           │                          │
│              │           │           ├─ 需要多模型切换？        │
│              │           │           │      │                   │
│              │           │           │      ├─ 是 ──▶ OpenCode │
│              │           │           │      │                   │
│              │           │           │      └─ 否              │
│              │           │           │           │              │
│              │           │           │           ▼              │
│              │           │           │    Claude Code           │
│              │           │           │    (日常开发首选)        │
│              │           │                                      │
│              └─ 默认 ──▶ Claude Code (Sonnet 4.6)              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 使用场景推荐

| 场景 | 推荐工具 | 原因 |
|------|----------|------|
| **日常开发** | Claude Code | 上下文理解最强，代码质量最高 |
| **复杂重构** | Claude Code Opus | 200K 上下文 + 最强推理 |
| **安全敏感环境** | Codex CLI | 多平台沙箱隔离 |
| **企业级项目** | Codex CLI | 安全合规 + 审计日志 |
| **需要 GUI** | OpenCode | 唯一支持桌面/Web 界面 |
| **团队协作** | OpenCode Web | 共享会话和配置 |
| **多模型切换** | OpenCode | 原生多模型支持 |
| **成本优化** | OpenCode + Haiku | 可选择便宜模型 |
| **本地/离线开发** | OpenCode + Ollama | 支持本地模型 |

---

## Claude Code 详解

**核心定位**：上下文理解最强的 AI 编程助手

### 技术特点

```
┌────────────────────────────────────────────────────────────────────┐
│                      Claude Code 核心优势                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  1. 200K 上下文窗口                                                │
│     • 理解整个项目结构                                             │
│     • 跨文件关联分析                                               │
│     • 长对话不丢失上下文                                           │
│                                                                    │
│  2. 代码质量                                                       │
│     • 生成高质量、可维护代码                                       │
│     • 自动遵循最佳实践                                             │
│     • 安全意识强                                                   │
│                                                                    │
│  3. 生态集成                                                       │
│     • MCP 协议原生支持                                             │
│     • 技能系统 (/commands)                                         │
│     • 钩子自动化                                                   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 日常使用命令

```bash
# 启动会话
claude

# 指定模型
claude --model claude-opus-4-6 "复杂任务"
claude --fast "快速任务"

# 常用斜杠命令
/help          # 帮助
/config        # 设置
/clear         # 清除
/cost          # 成本
/compact       # 压缩历史
```

### 最佳实践

1. **创建 CLAUDE.md**：项目上下文持久化
2. **精简 MCP 配置**：避免上下文浪费
3. **使用钩子**：自动化格式化和检查
4. **模型选择**：Opus (复杂) / Sonnet (日常) / Haiku (快速)

---

## Codex CLI 详解

**核心定位**：安全优先的 AI 编程代理

### 技术特点

```
┌────────────────────────────────────────────────────────────────────┐
│                      Codex CLI 核心优势                             │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  1. 多平台安全沙箱                                                 │
│     • Linux: Landlock + seccomp                                    │
│     • macOS: Seatbelt                                              │
│     • Windows: Restricted Token                                    │
│                                                                    │
│  2. 技能系统 (Python)                                              │
│     • 自定义技能扩展                                               │
│     • 项目级配置                                                   │
│                                                                    │
│  3. 钩子系统                                                       │
│     • 事件触发自动化                                               │
│     • 文件变更监听                                                 │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 日常使用命令

```bash
# 启动会话
codex chat

# 沙箱控制
codex --sandbox=strict chat      # 严格模式
codex --sandbox=permissive chat  # 宽松模式
codex --allow-path=$(pwd) chat   # 限制路径

# 技能管理
codex skills list
codex skills run code-review
```

### 安全最佳实践

```bash
# 生产环境：严格沙箱 + 限制路径
codex --sandbox=strict \
  --allow-path=/app/src:ro \
  --allow-path=/app/tests:rw \
  chat
```

---

## OpenCode 详解

**核心定位**：现代化全栈 AI 开发平台

### 技术特点

```
┌────────────────────────────────────────────────────────────────────┐
│                      OpenCode 核心优势                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  1. 多客户端支持                                                   │
│     • CLI: Bun + TypeScript                                       │
│     • Web: SolidJS + Vite                                         │
│     • Desktop: Tauri + React                                      │
│                                                                    │
│  2. 多模型支持                                                     │
│     • OpenAI (GPT-4o, etc.)                                       │
│     • Anthropic (Claude 3)                                        │
│     • Google (Gemini)                                             │
│     • 本地 (Ollama)                                               │
│                                                                    │
│  3. 持久化会话                                                     │
│     • SQLite + Drizzle ORM                                        │
│     • 跨设备同步                                                   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 日常使用命令

```bash
# CLI 模式
opencode chat

# 多模型切换
opencode chat --model=gpt-4
opencode chat --model=claude-3-sonnet
opencode chat --model=ollama:deepseek-coder

# 桌面应用
opencode desktop

# Web 服务
opencode serve --port 3000
```

### 多客户端工作流

```bash
# 办公室：桌面应用
opencode desktop

# 远程：Web 界面
opencode serve --port 3000
# 访问 http://localhost:3000

# SSH：CLI 模式
opencode chat

# 会话自动同步
```

---

## 学习型项目

| 工具 | 文档路径 | 核心特点 |
|------|----------|----------|
| [Mini-CLI](./mini-cli.md) | 学习型 | TypeScript、完整功能、对比学习 |

## 其他工具参考

| 工具 | 文档路径 | 核心特点 |
|------|----------|----------|
| [Gemini CLI](./gemini-cli.md) | Google | TOML 命令模板、OpenTelemetry |
| [Aider](./aider.md) | 开源 | Python、代码地图、语音输入 |
| [Goose](./goose.md) | Block | Rust、Electron、MCP 扩展 |

---

## 完整特性对比

```
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│     特性        │   Claude Code   │    Codex CLI    │    OpenCode     │    Gemini CLI   │      Aider      │      Goose      │
├─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ CLI 支持        │       ✅        │       ✅        │       ✅        │       ✅        │       ✅        │       ✅        │
│ Web 界面        │       ❌        │       ❌        │       ✅        │       ✅        │       ❌        │       ❌        │
│ 桌面应用        │       ❌        │       ❌        │    ✅ Tauri     │       ❌        │       ❌        │   ✅ Electron   │
│ 安全沙箱        │    权限系统     │   ✅ 原生多平台 │    系统沙箱     │    ⚠️ 有限      │       ❌        │    ⚠️ 有限      │
│ 多模型支持      │   单一模型      │   单一模型      │   ✅ 原生       │       ✅        │       ✅        │       ✅        │
│ MCP 协议        │       ✅        │       ✅        │       ✅        │       ✅        │       ❌        │       ✅        │
│ 本地模型        │       ❌        │       ❌        │   ✅ Ollama     │       ❌        │       ✅        │   ✅ Ollama     │
│ 代码地图        │       ❌        │       ❌        │       ❌        │       ❌        │       ✅        │       ❌        │
│ 语音输入        │       ❌        │       ❌        │       ❌        │       ❌        │       ✅        │       ❌        │
│ 开源            │       ❌        │   ✅ Apache2   │       ✅        │       ✅        │       ✅        │       ✅        │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

---

## 组合使用策略

### 策略 1：主次搭配

```bash
# Claude Code 为主 (代码质量)
# OpenCode 为辅 (GUI + 多模型)
```

### 策略 2：场景切换

```bash
# 复杂任务 → Claude Code Opus
# 简单任务 → Claude Code Haiku / OpenCode
# 安全敏感 → Codex CLI
```

### 策略 3：成本优化

```bash
# 高质量任务 → Claude Code Opus
# 日常开发 → Claude Code Sonnet
# 快速任务 → OpenCode + Haiku / 本地模型
```

---

## 学习路线

### 阶段一：基础使用 (1-2 周)

1. **Claude Code**：安装、基本命令、CLAUDE.md 配置
2. **Codex CLI**：安装、沙箱概念、技能系统
3. **OpenCode**：安装、多模型切换、桌面应用

### 阶段二：进阶功能 (2-4 周)

1. **MCP 集成**：配置外部工具
2. **技能开发**：自定义命令
3. **钩子系统**：自动化工作流

### 阶段三：最佳实践 (持续)

1. **上下文管理**：优化 token 使用
2. **安全配置**：权限和沙箱
3. **团队协作**：共享配置和工作流

---

## 参考资源

### 核心工具官方文档
- [Claude Code 官方文档](https://code.claude.com/docs)
- [Claude Code GitHub](https://github.com/anthropics/claude-code)
- [Codex CLI GitHub](https://github.com/openai/codex)
- [OpenCode GitHub](https://github.com/sst/opencode)

### 相关技术
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Bun Runtime](https://bun.sh)
- [Tauri Desktop](https://tauri.app)
- [Ollama](https://ollama.ai/)

### 本地详细文档
- [Claude Code 详细文档](./claude-code.md)
- [Codex CLI 详细文档](./codex-cli.md)
- [OpenCode 详细文档](./opencode.md)
- [Gemini CLI 详细文档](./gemini-cli.md)
- [Aider 详细文档](./aider.md)
- [Goose 详细文档](./goose.md)
