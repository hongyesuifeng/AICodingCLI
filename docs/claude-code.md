# Claude Code 技术文档

## 概述

Claude Code 是 Anthropic 官方开发的命令行 AI 编程代理，基于 Claude 4.5/4.6 模型，是目前最先进的终端编程助手之一。

| 属性 | 描述 |
|------|------|
| **开发者** | Anthropic |
| **核心定位** | 智能终端编程代理 |
| **底层模型** | Claude Opus 4.6 / Sonnet 4.6 / Haiku 4.5 |
| **运行时** | Node.js 18+ |
| **包管理** | npm |
| **开源状态** | **闭源** (有官方 GitHub 仓库用于文档和 issue) |

---

## 系统架构

```
┌────────────────────────────────────────────────────────────────────┐
│                      Claude Code 系统架构                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐    │
│  │   CLI 层    │───▶│  Agent 核心 │───▶│   Claude API        │    │
│  │  (Node.js)  │    │  (闭源)     │    │                     │    │
│  └─────────────┘    └──────┬──────┘    └─────────────────────┘    │
│                            │                                       │
│         ┌──────────────────┼──────────────────┐                   │
│         ▼                  ▼                  ▼                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│  │  MCP 客户端 │    │  技能系统   │    │  钩子系统   │           │
│  │ (工具集成)  │    │ (/commands) │    │ (事件触发)  │           │
│  └─────────────┘    └─────────────┘    └─────────────┘           │
│         │                                                        │
│         ▼                                                        │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                    MCP 服务器生态                          │   │
│  │  GitHub | PostgreSQL | Figma | Jira | Shell | 自定义...   │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## 核心特性

### 1. 模型家族

| 模型 | ID | 特点 |
|------|-----|------|
| **Opus 4.6** | `claude-opus-4-6` | 最强性能，复杂任务 |
| **Sonnet 4.6** | `claude-sonnet-4-6` | 平衡性能与速度 |
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | 快速响应，轻量任务 |

### 2. 配置层级系统

```
配置优先级 (低 → 高):
┌─────────────────────────────────────────────┐
│ 1. ~/.claude/settings.json    (用户级)      │
│ 2. .claude/settings.json      (项目级)      │
│ 3. CLAUDE.md                  (项目上下文)  │
│ 4. 命令行参数                 (临时覆盖)    │
└─────────────────────────────────────────────┘
```

### 3. 上下文窗口管理

- **最大上下文**: 200K tokens
- **重要提示**: 过多 MCP 工具可能消耗 40%+ 上下文
- **最佳实践**: "少即是多"，精简配置

---

## 目录结构

```
~/.claude/                       # 用户级配置
├── settings.json                # 全局设置
├── commands/                    # 全局技能/命令
│   ├── review/                  # /review 命令
│   │   ├── command.md           # 命令定义
│   │   └── args.schema.json     # 参数 schema
│   └── commit/                  # /commit 命令
└── mcp.json                     # MCP 服务器配置

项目目录/
├── .claude/
│   ├── settings.json            # 项目设置
│   ├── commands/                # 项目级技能
│   └── hooks/                   # 钩子脚本
├── CLAUDE.md                    # 项目上下文说明
└── ...
```

---

## 核心技术原理

### 1. MCP (Model Context Protocol) 集成

Claude Code 通过 MCP 协议与外部工具集成：

```
┌─────────────────────────────────────────────────────────┐
│                    MCP 协议架构                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────────┐      MCP Protocol     ┌───────────┐  │
│   │ Claude Code │◄─────────────────────▶│  MCP      │  │
│   │  (Client)   │                       │  Server   │  │
│   └─────────────┘                       └───────────┘  │
│         │                                     │        │
│         │ 工具调用                             │ 资源   │
│         ▼                                     ▼        │
│   ┌───────────────────────────────────────────────┐    │
│   │              外部资源/工具                      │    │
│   │  • GitHub (仓库/Issue/PR)                      │    │
│   │  • PostgreSQL (数据库查询)                     │    │
│   │  • Figma (设计稿读取)                          │    │
│   │  • Shell (命令执行)                            │    │
│   │  • 自定义 API 服务                             │    │
│   └───────────────────────────────────────────────┘    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**MCP 服务器配置示例：**

```json
// ~/.claude/settings.json
{
  "mcpServers": {
    "github": {
      "command": "mcp-github",
      "args": [],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "postgres": {
      "command": "mcp-postgres",
      "args": ["postgresql://user:pass@localhost/db"]
    },
    "shell": {
      "command": "mcp-shell",
      "args": []
    }
  }
}
```

**添加 MCP 服务器：**

```bash
# 通过 CLI 向导添加
claude mcp add

# 或手动编辑配置文件
```

### 2. 技能系统 (Skills)

技能是 Claude Code 的扩展机制，通过 `/command` 方式调用：

**技能目录结构：**

```
commands/
├── code-review/                 # /code-review 技能
│   ├── command.md               # 技能定义 (必需)
│   ├── args.schema.json         # 参数 schema (可选)
│   └── templates/               # 模板文件
├── test-gen/
│   └── command.md
└── commit/
    └── command.md
```

**技能定义示例：**

```markdown
# commands/review/command.md

你是一个代码审查专家。请审查用户提供的代码变更：

1. 检查代码质量和最佳实践
2. 识别潜在的 bug 和安全问题
3. 提供具体的改进建议
4. 使用清晰的格式输出审查结果

审查范围：{{args.scope}}
重点关注：{{args.focus}}
```

**参数 Schema：**

```json
// commands/review/args.schema.json
{
  "type": "object",
  "properties": {
    "scope": {
      "type": "string",
      "description": "审查范围 (all|changed|staged)",
      "default": "changed"
    },
    "focus": {
      "type": "string",
      "description": "重点关注领域",
      "enum": ["security", "performance", "style", "all"],
      "default": "all"
    }
  }
}
```

### 3. 钩子系统 (Hooks)

钩子允许在特定事件触发时执行自定义命令：

**配置示例：**

```json
// ~/.claude/settings.json
{
  "hooks": {
    "user-prompt-submit": {
      "command": "echo 'Processing prompt...'",
      "timeout": 5000
    },
    "PreToolUse": [
      {
        "matcher": "Bash",
        "command": "echo 'About to run bash command'"
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write",
        "command": "prettier --write {{file_path}}"
      }
    ]
  }
}
```

**支持的钩子事件：**

| 事件 | 说明 |
|------|------|
| `user-prompt-submit` | 用户提交 prompt 时 |
| `PreToolUse` | 工具执行前 |
| `PostToolUse` | 工具执行后 |
| `Notification` | 通知事件 |
| `Stop` | 会话停止时 |

### 4. CLAUDE.md 项目上下文

`CLAUDE.md` 文件为项目提供持久化上下文：

```markdown
# 项目名称

## 技术栈
- React 18 + TypeScript
- Tailwind CSS
- Node.js 20

## 代码规范
- 使用函数式组件
- 遵循 Airbnb 风格指南
- 测试覆盖要求 80%+

## 重要文件
- src/api/ - API 接口
- src/components/ - UI 组件
- src/hooks/ - 自定义 Hooks

## 注意事项
- 不要修改 .env 文件
- 提交前运行 npm test
```

### 5. Agent 子代理系统

Claude Code 支持创建专门的子代理处理特定任务：

```javascript
// Agent 配置示例
{
  "agents": {
    "test-runner": {
      "description": "运行测试并报告结果",
      "tools": ["Bash", "Read"],
      "prompt": "你是测试专家，负责运行和分析测试结果"
    },
    "code-reviewer": {
      "description": "审查代码变更",
      "tools": ["Read", "Grep", "Glob"],
      "prompt": "你是代码审查专家，专注于安全和性能"
    }
  }
}
```

### 6. Claude Code 作为 MCP Server

Claude Code 也可以作为 MCP 服务器运行，供其他应用调用：

```bash
# 启动 MCP 服务器模式
claude mcp serve --port 3000
```

---

## 配置文件详解

### 全局设置

```json
// ~/.claude/settings.json
{
  "model": "claude-sonnet-4-6",

  "apiProvider": "anthropic",

  "permissions": {
    "allow": [
      "Bash(npm install:*)",
      "Bash(npm run:*)",
      "Read",
      "Write",
      "Edit"
    ],
    "deny": [
      "Bash(rm -rf:*)",
      "Bash(sudo:*)"
    ]
  },

  "mcpServers": {
    "github": {
      "command": "mcp-github",
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  },

  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "command": "eslint --fix {{file_path}}"
      }
    ]
  },

  "ui": {
    "theme": "dark",
    "showTokenCount": true
  }
}
```

### 项目设置

```json
// .claude/settings.json
{
  "project": {
    "name": "my-project",
    "contextFiles": ["README.md", "CLAUDE.md"]
  },

  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist", ".git"],

  "commands": {
    "enabled": ["review", "commit", "test"]
  }
}
```

---

## 命令参考

### 基础命令

```bash
# 启动交互式会话
claude

# 执行单次指令
claude "分析这个项目的架构"

# 使用指定模型
claude --model claude-opus-4-6 "复杂的重构任务"

# 快速模式 (使用相同模型但更快输出)
claude --fast "简单的代码修改"
```

### 斜杠命令

```
# 会话中可用的斜杠命令
/help              # 显示帮助
/config            # 打开设置界面
/clear             # 清除会话
/cost              # 显示成本统计
/compact           # 压缩对话历史
/permissions       # 管理权限设置
/hooks             # 配置钩子
/mcp               # 管理 MCP 服务器
/bug               # 报告问题
```

### 自定义技能命令

```bash
# 调用自定义技能
/review --scope changed
/commit
/test --coverage
/generate-api --openapi spec.yaml
```

### MCP 管理

```bash
# 添加 MCP 服务器
claude mcp add

# 列出已配置的 MCP 服务器
claude mcp list

# 测试 MCP 服务器连接
claude mcp test github

# 作为 MCP 服务器运行
claude mcp serve
```

### Git 集成

```bash
# 创建提交
claude "提交当前的更改"

# 创建 PR
claude "创建一个 PR 到 main 分支"

# 解决合并冲突
claude "解决当前的合并冲突"
```

---

## 权限系统

### 权限配置

```json
{
  "permissions": {
    "allow": [
      // 允许所有读取操作
      "Read",

      // 允许特定 Bash 命令模式
      "Bash(npm:*)",
      "Bash(git:*)",
      "Bash(ls:*)",

      // 允许特定路径的写入
      "Write(/home/user/projects/**)"
    ],
    "deny": [
      // 禁止危险命令
      "Bash(rm -rf /*)",
      "Bash(sudo:*)",
      "Bash(chmod:*)"
    ]
  }
}
```

### 权限模式

| 模式 | 说明 |
|------|------|
| `accept` | 自动允许所有操作 |
| `plan` | 只读模式，仅分析和规划 |
| `default` | 交互式确认 |

```bash
# 使用不同权限模式
claude --permission-mode accept    # 自动允许
claude --permission-mode plan      # 只读规划
```

---

## 最佳实践

### 1. 配置精简化

```bash
# 不推荐：加载过多 MCP 工具
{
  "mcpServers": {
    "github": {...},
    "gitlab": {...},
    "jira": {...},
    "notion": {...},
    "slack": {...},
    // ... 更多工具会消耗大量上下文
  }
}

# 推荐：只加载必要的工具
{
  "mcpServers": {
    "github": {...}  // 只配置当前项目需要的
  }
}
```

### 2. 使用 CLAUDE.md 管理上下文

```markdown
# 推荐：结构化的 CLAUDE.md

## 项目概述
简短描述项目目的和架构

## 开发规范
列出重要的编码规范

## 常用命令
- npm run dev: 启动开发服务器
- npm test: 运行测试

## 注意事项
列出需要避免的操作
```

### 3. 技能组织

```
# 推荐：按功能组织技能
commands/
├── dev/                    # 开发相关
│   ├── review/
│   └── test/
├── git/                    # Git 操作
│   ├── commit/
│   └── pr/
└── docs/                   # 文档相关
    └── readme/
```

### 4. 钩子使用

```json
// 推荐：有意义的钩子
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write(*.ts)",
        "command": "eslint --fix {{file_path}}"
      },
      {
        "matcher": "Write(*.py)",
        "command": "black {{file_path}}"
      }
    ]
  }
}
```

---

## 与竞品对比

| 特性 | Claude Code | OpenAI Codex CLI | Gemini CLI |
|------|-------------|------------------|------------|
| **开源** | 否 | 是 (Apache 2.0) | 是 (Apache 2.0) |
| **模型** | Claude 4.5/4.6 | GPT-4o | Gemini 2.0 |
| **上下文窗口** | 200K | 128K | 1M |
| **MCP 支持** | 原生 | 原生 | 原生 |
| **技能系统** | 有 | 有 | 有 |
| **沙箱安全** | 权限系统 | 多平台沙箱 | 沙箱 |
| **Agent SDK** | 有 | 有 | 有 |

---

## 学习路线

### 阶段一：基础使用 (1-2 周)

1. 安装 Claude Code (`npm install -g @anthropic-ai/claude-code`)
2. 掌握基本命令和斜杠命令
3. 理解权限系统
4. 配置 CLAUDE.md

### 阶段二：进阶功能 (2-4 周)

1. 配置 MCP 服务器集成
2. 创建自定义技能
3. 配置钩子系统
4. 理解 Agent 子代理

### 阶段三：高级应用 (持续)

1. 构建 Claude Agent SDK 应用
2. Claude Code 作为 MCP Server
3. 多 Agent 协作工作流
4. 性能优化和上下文管理

---

## 参考资源

- [Claude Code 官方文档](https://code.claude.com/docs)
- [Claude Code GitHub](https://github.com/anthropics/claude-code)
- [Claude API 文档](https://docs.anthropic.com/)
- [MCP 协议规范](https://modelcontextprotocol.io/)
- [Anthropic 开发者平台](https://www.anthropic.com/engineering)
