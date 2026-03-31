# ClaudeCode 架构详解

ClaudeCode 是一个功能强大的 AI 编程助手命令行工具，基于 Claude API 构建。本文档详细介绍其架构设计和实现原理。

## 项目概述

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ClaudeCode 核心架构                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🎯 核心定位                                                                 │
│     • 基于 Claude API 的智能编程助手                                          │
│     • 支持多种 AI 模型（Opus、Sonnet、Haiku）                                 │
│     • 提供完整的文件操作、代码编辑、命令执行能力                                │
│     • 支持远程协作、插件扩展、MCP 协议                                         │
│                                                                             │
│  📦 技术栈                                                                   │
│     • TypeScript + React (Ink 终端 UI)                                      │
│     • Bun 运行时                                                            │
│     • Zod schema 验证                                                       │
│     • Anthropic SDK                                                        │
│                                                                             │
│  🔧 核心能力                                                                 │
│     • 工具系统（文件读写、命令执行、搜索等）                                    │
│     • 技能系统（可扩展的命令/技能）                                            │
│     • 插件系统（第三方扩展支持）                                               │
│     • 桥接系统（远程控制能力）                                                │
│     • 代理系统（多代理协作）                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
claudecode/src/
├── main.tsx                    # 应用主入口
├── QueryEngine.ts              # AI 查询引擎核心
├── query.ts                    # 查询处理逻辑
├── commands.ts                 # 命令系统管理
├── context.ts                  # 上下文管理
├── Tool.ts                     # 工具接口定义
├── Task.ts                     # 任务系统
│
├── assistant/                  # 助手模块
│   └── sessionHistory.ts       # 会话历史管理
│
├── bootstrap/                  # 启动引导
│   └── state.ts                # 启动状态管理
│
├── bridge/                     # 远程桥接系统
│   ├── bridgeMain.ts           # 桥接主入口
│   ├── bridgeApi.ts            # API 客户端
│   ├── bridgeConfig.ts         # 配置管理
│   ├── replBridge.ts           # v1 模式实现
│   ├── remoteBridgeCore.ts     # v2 模式实现
│   └── ...                     # 其他支持模块
│
├── buddy/                      # 陪伴助手（UI 增效）
│   ├── companion.ts            # 陪伴助手核心
│   └── CompanionSprite.tsx     # 精灵渲染
│
├── cli/                        # CLI 相关功能
│   ├── handlers/               # 命令处理器
│   ├── transports/             # 传输层实现
│   └── structuredIO.ts         # 结构化 I/O
│
├── commands/                   # 内置命令
│   ├── help/                   # 帮助命令
│   ├── skills/                 # 技能列表
│   ├── clear/                  # 清除命令
│   ├── commit/                 # Git 提交
│   ├── config/                 # 配置管理
│   └── ...                     # 其他命令
│
├── components/                 # React UI 组件
│   ├── design-system/          # 设计系统组件
│   ├── agents/                 # 代理相关组件
│   ├── CustomSelect/           # 自定义选择器
│   ├── shell/                  # Shell 输出组件
│   └── ...                     # 其他组件
│
├── constants/                  # 常量定义
│   ├── apiLimits.ts            # API 限制
│   ├── files.ts                # 文件类型定义
│   ├── prompts.ts              # 提示词模板
│   └── ...                     # 其他常量
│
├── context/                    # React Context
│   ├── mailbox.tsx             # 消息信箱
│   ├── modalContext.tsx        # 模态框上下文
│   └── overlayContext.tsx      # 覆盖层上下文
│
├── coordinator/                # 协调器模式
│   └── coordinatorMode.ts      # 协调模式实现
│
├── entrypoints/                # 入口点定义
│   ├── agentSdkTypes.ts        # Agent SDK 类型
│   ├── sandboxTypes.ts         # 沙箱类型
│   └── sdk/                    # SDK 核心
│
├── hooks/                      # React Hooks
│   ├── useSettings.ts          # 设置访问
│   ├── useBlink.ts             # 闪烁动画
│   └── ...                     # 其他 Hooks
│
├── ink/                        # Ink 终端 UI 框架
│   ├── components/             # Ink 组件
│   ├── hooks/                  # Ink Hooks
│   └── ...                     # 其他 Ink 模块
│
├── keybindings/                # 快捷键系统
│   ├── KeybindingProviderSetup.tsx
│   ├── useKeybinding.ts        # 快捷键 Hook
│   └── ...                     # 其他快捷键模块
│
├── memdir/                     # 内存目录管理
├── migrations/                 # 数据迁移
├── moreright/                  # 扩展权限
├── native-ts/                  # 原生 TypeScript 模块
├── outputStyles/               # 输出样式定义
│
├── plugins/                    # 插件系统
│   └── ...                     # 插件加载和管理
│
├── query/                      # 查询相关模块
├── remote/                     # 远程功能
├── schemas/                    # Zod Schema 定义
├── screens/                    # 屏幕组件
│   ├── Doctor.tsx              # 诊断屏幕
│   └── ...                     # 其他屏幕
│
├── services/                   # 服务层
│   ├── analytics/              # 分析服务
│   ├── api/                    # API 服务
│   ├── compact/                # 压缩服务
│   ├── mcp/                    # MCP 服务
│   └── ...                     # 其他服务
│
├── skills/                     # 技能系统
│   ├── bundledSkills.ts        # 内置技能
│   ├── loadSkillsDir.ts        # 技能加载
│   └── ...                     # 技能相关
│
├── state/                      # 状态管理
│   ├── AppState.ts             # 应用状态
│   ├── store.ts                # Store 实现
│   └── ...                     # 状态相关
│
├── tasks/                      # 任务系统
├── tools/                      # 工具实现
│   ├── BashTool/               # 命令执行工具
│   ├── FileReadTool/           # 文件读取工具
│   ├── FileEditTool/           # 文件编辑工具
│   ├── FileWriteTool/          # 文件写入工具
│   ├── GlobTool/               # 文件搜索工具
│   ├── GrepTool/               # 内容搜索工具
│   ├── AgentTool/              # 代理工具
│   ├── MCPTool/                # MCP 工具
│   ├── SkillTool/              # 技能工具
│   └── ...                     # 其他工具
│
├── types/                      # 类型定义
│   ├── command.ts              # 命令类型
│   ├── message.ts              # 消息类型
│   ├── hooks.ts                # 钩子类型
│   └── ...                     # 其他类型
│
├── utils/                      # 工具函数
│   ├── bash/                   # Bash 相关
│   ├── permissions/            # 权限管理
│   ├── settings/               # 设置管理
│   └── ...                     # 其他工具
│
├── vim/                        # Vim 模式
│   ├── types.ts                # Vim 类型
│   └── ...                     # Vim 实现
│
└── voice/                      # 语音功能
```

## 核心架构

### 1. 状态管理架构

采用集中式状态管理，基于简单的 Store 模式：

```typescript
// store.ts - 基础 Store 实现
export type Store<T> = {
  getState: () => T
  setState: (updater: (prev: T) => T) => void
  subscribe: (listener: Listener) => () => void
}
```

**AppState 核心结构**：
```typescript
interface AppState {
  // 基础设置
  settings: Settings
  verbose: boolean
  mainLoopModel: string

  // UI 状态
  expandedView: ExpandedView | null
  viewSelectionMode: ViewSelectionMode
  footerSelection: number

  // 任务管理
  tasks: Map<string, Task>
  foregroundedTaskId: string | null
  viewingAgentTaskId: string | null

  // 插件系统
  plugins: PluginState
  mcp: MCPState

  // 权限系统
  toolPermissionContext: ToolPermissionContext
  denialTracking: DenialTracking

  // 会话状态
  remoteSessionUrl: string | null
  replBridgeEnabled: boolean
  teamContext: TeamContext | null

  // 分析功能
  analytics: AnalyticsState
  speculation: SpeculationState
  promptSuggestion: PromptSuggestionState
}
```

### 2. 工具系统架构

所有工具遵循统一的 `Tool` 接口：

```typescript
type Tool<Input = AnyObject, Output = unknown, P = ToolProgressData> = {
  name: string
  aliases?: string[]
  searchHint?: string
  description(input, options): Promise<string>
  inputSchema: Input
  outputSchema?: z.ZodType
  call(args, context, canUseTool, parentMessage, onProgress): Promise<ToolResult<Output>>
  userFacingName(input): string
  checkPermissions(input, context): Promise<PermissionResult>
  isConcurrencySafe(): boolean
  isReadOnly(): boolean
  isDestructive(): boolean
  // ... 其他方法
}
```

**核心工具列表**：

| 工具 | 功能 | 特性 |
|------|------|------|
| BashTool | 命令执行 | 沙盒隔离、超时控制、后台执行 |
| FileReadTool | 文件读取 | 多格式支持、分页读取、图片处理 |
| FileEditTool | 文件编辑 | 精确替换、批量操作、LSP 集成 |
| FileWriteTool | 文件写入 | 原子操作、编码保持 |
| GlobTool | 文件搜索 | 模式匹配、快速查找 |
| GrepTool | 内容搜索 | ripgrep 引擎、上下文显示 |
| AgentTool | 代理系统 | 异步执行、工具隔离 |
| MCPTool | MCP 协议 | 外部服务集成 |
| SkillTool | 技能系统 | 动态加载、技能发现 |

### 3. 命令系统架构

支持三种命令类型：

```typescript
type Command =
  | PromptCommand    // AI 模型可调用
  | LocalCommand     // 本地执行
  | LocalJSXCommand  // UI 交互
```

**命令分类**：

```
命令系统
├── Prompt 命令（AI 可调用）
│   ├── /init       # 初始化项目
│   ├── /commit     # Git 提交
│   ├── /review     # 代码审查
│   ├── /memory     # 记忆管理
│   └── /model      # 模型选择
│
├── Local 命令（本地执行）
│   ├── /clear      # 清除对话
│   ├── /advisor    # 顾问配置
│   ├── /color      # 主题配置
│   └── /cost       # 成本计算
│
└── Local-JSX 命令（UI 交互）
    ├── /help       # 帮助界面
    ├── /skills     # 技能列表
    ├── /settings   # 设置界面
    └── /plugin     # 插件管理
```

### 4. 技能和插件系统

#### 技能类型

1. **Bundled Skills** - 内置技能
   - 编译到 CLI 二进制文件
   - 所有用户可用

2. **File-based Skills** - 文件系统技能
   - Markdown 格式定义
   - 支持多层级目录

#### 技能配置示例

```yaml
---
name: "Skill Name"
description: "Skill description"
when_to_use: "When to use this skill"
model: "claude-3-sonnet-20240229"
allowed-tools: ["read", "write"]
context: "inline"  # 或 "fork"
agent: "bash"
paths:
  - "**/*.ts"
hooks:
  pre-sampling: [...]
---
# Skill content...
```

#### 插件架构

```typescript
type BuiltinPluginDefinition = {
  name: string
  description: string
  version?: string
  skills?: BundledSkillDefinition[]
  hooks?: HooksSettings
  mcpServers?: Record<string, McpServerConfig>
  isAvailable?: () => boolean
  defaultEnabled?: boolean
}
```

### 5. 远程桥接系统

支持两种通信模式：

```
┌─────────────────────────────────────────────────────────────────┐
│                      Bridge 架构                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  v1 模式（Environments API）                                     │
│  ├── 注册桥接环境                                                │
│  ├── 轮询工作项                                                  │
│  ├── HybridTransport 通信                                       │
│  └── 会话归档                                                    │
│                                                                 │
│  v2 模式（Code Sessions API）                                    │
│  ├── 直接创建会话                                                │
│  ├── 获取桥接凭证                                                │
│  ├── SSETransport + CCRClient 通信                              │
│  ├── JWT 令牌自动刷新                                           │
│  └── 会话归档                                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6. Vim 模式集成

采用状态机设计：

```typescript
type VimState =
  | { mode: 'INSERT'; insertedText: string }
  | { mode: 'NORMAL'; command: CommandState }

type CommandState =
  | { type: 'idle' }
  | { type: 'count'; digits: string }
  | { type: 'operator'; op: Operator; count: number }
  | { type: 'operatorFind'; op: Operator; count: number; find: FindType }
  // ... 其他状态
```

**支持的 Vim 功能**：
- 运动命令：`hjkl`, `wbeWBE`, `0^$`, `G`
- 操作符：`delete`, `change`, `yank`
- 文本对象：`iw`, `aw`, `i"`, `a"`, `i(`, `a(`
- 点重复（`.`）

### 7. 快捷键系统

采用 React Context + 钩子模式：

```typescript
// 上下文优先级
const contextsToCheck: KeybindingContextName[] = [
  ...keybindingContext.activeContexts,
  context,
  'Global',
]

// 和弦序列支持
"ctrl+x ctrl+k" → "chat:killAgents"
```

**特性**：
- 平台自适应
- 用户自定义配置
- 热重载
- 和弦序列支持

## 设计模式应用

| 模式 | 应用场景 |
|------|----------|
| 工厂模式 | API 客户端创建、工具构建 |
| 观察者模式 | 事件系统、状态订阅 |
| 策略模式 | MCP 传输选择、v1/v2 桥接 |
| 适配器模式 | 传输层适配 |
| 状态模式 | Vim 状态机、桥接状态 |
| 命令模式 | 控制请求处理 |
| 代理模式 | MCPTool 代理 |

## 性能优化策略

### 1. 缓存机制
- **Memo 化缓存**：频繁计算结果缓存
- **LRU 策略**：缓存大小限制
- **文件状态缓存**：避免重复读取

### 2. 懒加载
- 命令延迟加载
- 技能按需发现
- 插件动态加载

### 3. 并发控制
- 工具级别并发判断
- 原子操作保护
- 资源隔离

## 安全机制

### 1. Bash 命令安全
- 命令解析验证
- 危险模式检测
- 沙盒执行隔离
- Zsh 危险命令阻止

### 2. 文件操作安全
- 路径规范化
- 二进制文件检测
- 敏感内容保护
- 写入权限检查

### 3. 权限系统
```typescript
type ToolPermissionContext = {
  mode: PermissionMode
  additionalWorkingDirectories: Map<string, AdditionalWorkingDirectory>
  alwaysAllowRules: ToolPermissionRulesBySource
  alwaysDenyRules: ToolPermissionRulesBySource
  alwaysAskRules: ToolPermissionRulesBySource
}
```

## 扩展性设计

### 1. Hook 事件系统
支持 14 种生命周期事件：
- `pre-sampling` / `post-sampling`
- `pre-tool-use` / `post-tool-use`
- `session-start` / `session-end`
- ...

### 2. MCP 协议集成
- SSE 传输
- WebSocket 传输
- Stdio 传输
- StreamableHTTP 传输

### 3. 插件生态
- 统一的 manifest 格式
- 版本和依赖管理
- 市场 place 集成

---

> 本文档基于 ClaudeCode 源代码分析生成，描述了项目的核心架构和实现原理。
