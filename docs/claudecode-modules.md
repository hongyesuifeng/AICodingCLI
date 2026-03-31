# ClaudeCode 模块详解

本文档详细介绍 ClaudeCode 各个核心模块的实现细节。

## 1. Bridge 模块 - 远程桥接系统

### 模块概述

`bridge` 目录是负责远程控制（Remote Control）功能的核心模块，实现了本地开发环境与 claude.ai 云服务之间的双向通信桥接。

### 核心文件

| 文件 | 功能 |
|------|------|
| `bridgeMain.ts` | 桥接主入口，管理生命周期 |
| `bridgeApi.ts` | API 客户端实现 |
| `bridgeConfig.ts` | 配置管理和认证 |
| `replBridge.ts` | v1 模式实现 |
| `remoteBridgeCore.ts` | v2 模式实现（无环境） |
| `replBridgeTransport.ts` | 传输层抽象 |
| `bridgeMessaging.ts` | 消息处理逻辑 |
| `sessionRunner.ts` | 会话运行管理 |
| `jwtUtils.ts` | JWT 令牌管理 |

### 双协议支持

#### v1 模式（Environments API）

```
┌──────────────────────────────────────────────────────────────────┐
│                        v1 工作流程                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 注册桥接环境                                                  │
│     POST /v1/environments/bridge                                 │
│     ↓                                                            │
│  2. 轮询工作项                                                    │
│     GET /v1/environments/{id}/work/poll                          │
│     ↓                                                            │
│  3. 接收工作项并启动会话                                          │
│     通过 HybridTransport 通信                                     │
│     ↓                                                            │
│  4. 会话结束后归档                                                │
│     POST /v1/environments/{id}/work/{workId}/archive             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

#### v2 模式（Code Sessions API）

```
┌──────────────────────────────────────────────────────────────────┐
│                        v2 工作流程                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 直接创建会话                                                  │
│     POST /v1/code/sessions                                       │
│     ↓                                                            │
│  2. 获取桥接凭证                                                  │
│     GET /v1/code/sessions/{id}/bridge                            │
│     ↓                                                            │
│  3. 通过 SSETransport + CCRClient 通信                           │
│     JWT 令牌自动刷新                                              │
│     ↓                                                            │
│  4. 会话结束后归档                                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 传输层设计

```typescript
// replBridgeTransport.ts
export interface ReplBridgeTransport {
  sendToModel: (msg: SDKMessage) => Promise<void>
  sendToUser: (msg: SDKControlResponse) => Promise<void>
  onMessageFromModel: (cb: (msg: SDKMessage) => void) => void
  onMessageFromUser: (cb: (msg: SDKControlRequest) => void) => void
  close: () => void
}

// v1 实现
export function createV1ReplTransport(): ReplBridgeTransport {
  // 基于 HybridTransport
}

// v2 实现
export function createV2ReplTransport(): ReplBridgeTransport {
  // 基于 SSETransport + CCRClient
}
```

### JWT 令牌管理

```typescript
// jwtUtils.ts
export function decodeJwtPayload(token: string): unknown
export function decodeJwtExpiry(token: string): number | null
export function createTokenRefreshScheduler(
  token: string,
  onRefresh: (newToken: string) => void
): () => void
```

### 消息处理

```typescript
// bridgeMessaging.ts
export async function handleInboundMessage(
  message: SDKMessage,
  context: MessageHandlerContext
): Promise<void>

export async function handleServerControlRequest(
  request: SDKControlRequest,
  context: ControlRequestContext
): Promise<SDKControlResponse | null>
```

---

## 2. Tools 模块 - 工具系统

### 核心接口定义

```typescript
// Tool.ts
export type ToolDef<InputSchema, OutputSchema> = {
  name: string
  aliases?: string[]
  searchHint?: string
  maxResultSizeChars?: number

  // 描述和提示
  description(input, options): Promise<string>
  prompt(input, options): Promise<string>

  // Schema 定义
  inputSchema: InputSchema
  outputSchema?: OutputSchema

  // 执行
  call(input, context): Promise<ToolResult<Output>>

  // 权限
  checkPermissions(input, context): Promise<PermissionResult>

  // 特性标记
  isEnabled(): boolean
  isConcurrencySafe(): boolean
  isReadOnly(): boolean
  isDestructive(): boolean

  // UI 渲染
  userFacingName(input): string
  renderToolUseMessage?(input): React.ReactNode
  renderToolResultMessage?(output): React.ReactNode

  // 结果处理
  isResultTruncated?(output): boolean
  mapToolResultToToolResultBlockParam?(content, toolUseID): ToolResultBlockParam
}

export function buildTool<D extends AnyToolDef>(def: D): BuiltTool<D>
```

### BashTool - 命令执行工具

#### 安全机制

```typescript
// bashSecurity.ts

// 命令替换检测
const COMMAND_SUBSTITUTION_PATTERNS = [
  { pattern: /<\(/, message: 'process substitution <()' },
  { pattern: />\(/, message: 'process substitution >()' },
  { pattern: /\$\(/, message: '$() command substitution' },
  { pattern: /\${/, message: '${} parameter substitution' },
  // ...
]

// Zsh 危险命令
const ZSH_DANGEROUS_COMMANDS = new Set([
  'zmodload',    // 模块加载
  'emulate',     // 模式切换
  'sysopen',     // 文件操作
  'zpty',        // 伪终端
  'ztcp',        // 网络连接
  // ...
])
```

#### 执行流程

```
用户命令
    ↓
解析和验证
    ↓
┌───────────────┐
│ 安全检查      │
│ • 命令注入    │
│ • 危险模式    │
│ • 权限验证    │
└───────────────┘
    ↓
沙盒执行 / 原生执行
    ↓
实时输出流
    ↓
结果处理
```

### FileReadTool - 文件读取工具

#### 多格式支持

```typescript
// 支持的格式
- 文本文件（带行号）
- 图片（PNG, JPG, JPEG）
- PDF 文档（分页提取）
- Jupyter Notebook（.ipynb）

// 参数
{
  file_path: string     // 文件路径
  offset?: number       // 起始行号
  limit?: number        // 读取行数
  pages?: string        // PDF 页面范围
}
```

#### 图片处理

```typescript
// apiLimits.ts
export const API_IMAGE_MAX_BASE64_SIZE = 5 * 1024 * 1024  // 5 MB
export const IMAGE_MAX_WIDTH = 2000
export const IMAGE_MAX_HEIGHT = 2000
```

### FileEditTool - 文件编辑工具

#### 编辑流程

```
1. 读取原文件
    ↓
2. 查找 old_string
    ↓
3. 替换为 new_string
    ↓
4. 验证内容
    ↓
5. 写入文件
    ↓
6. LSP 通知
```

#### 特性
- 精确字符串匹配
- 批量替换支持
- 编码保持
- 行尾格式保留

### AgentTool - 代理工具

#### 代理配置

```typescript
type AgentDefinition = {
  name: string
  description: string
  agentType: string

  // 模型配置
  model?: string
  effort?: EffortValue

  // 工具配置
  tools?: string[]
  allowedAgentTypes?: string[]

  // 执行配置
  context?: 'inline' | 'fork'
  isAsync?: boolean

  // 记忆配置
  memoryScope?: 'session' | 'project' | 'user'
}
```

---

## 3. Commands 模块 - 命令系统

### 命令类型定义

```typescript
// types/command.ts

export type Command = CommandBase & (
  | PromptCommand
  | LocalCommand
  | LocalJSXCommand
)

// Prompt 命令 - AI 可调用
export type PromptCommand = {
  type: 'prompt'
  progressMessage: string
  contentLength: number
  allowedTools?: string[]
  model?: string
  source: SettingSource | 'builtin' | 'mcp' | 'plugin' | 'bundled'
  getPromptForCommand(args, context): Promise<ContentBlockParam[]>
}

// Local 命令 - 本地执行
export type LocalCommand = {
  type: 'local'
  supportsNonInteractive: boolean
  load: () => Promise<LocalCommandModule>
}

// Local-JSX 命令 - UI 交互
export type LocalJSXCommand = {
  type: 'local-jsx'
  load: () => Promise<LocalJSXCommandModule>
}
```

### 命令加载流程

```typescript
// commands.ts
export async function getCommands(cwd: string): Promise<Command[]> {
  const allCommands = await loadAllCommands(cwd)

  // 获取动态技能
  const dynamicSkills = getDynamicSkills()

  // 过滤可用命令
  const baseCommands = allCommands.filter(
    cmd => meetsAvailabilityRequirement(cmd) && isCommandEnabled(cmd)
  )

  // 合并动态技能
  return [...baseCommands, ...uniqueDynamicSkills]
}
```

### 命令来源

```
┌─────────────────────────────────────────────────────────────────┐
│                      命令来源层次                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Built-in Commands     - 内置命令（commands/）               │
│  2. Bundled Skills        - 打包技能（skills/bundled/）         │
│  3. File-based Skills     - 文件技能（.claude/skills/）         │
│  4. Plugin Commands       - 插件命令                            │
│  5. MCP Commands          - MCP 服务器命令                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Skills 模块 - 技能系统

### 技能定义

```typescript
// bundledSkills.ts
export type BundledSkillDefinition = {
  name: string
  description: string
  aliases?: string[]
  whenToUse?: string
  argumentHint?: string
  allowedTools?: string[]
  model?: string
  disableModelInvocation?: boolean
  userInvocable?: boolean
  isEnabled?: () => boolean
  hooks?: HooksSettings
  context?: 'inline' | 'fork'
  agent?: string
  files?: Record<string, string>
  getPromptForCommand(args, context): Promise<ContentBlockParam[]>
}
```

### 技能发现机制

```typescript
// loadSkillsDir.ts
export async function loadSkillsDir(
  dir: string,
  source: 'skills' | 'commands_DEPRECATED',
  cwd: string
): Promise<Command[]> {
  // 扫描目录
  const entries = await fs.readdir(dir, { withFileTypes: true })

  // 解析 Markdown 文件
  for (const entry of entries) {
    if (entry.name.endsWith('.md')) {
      const skill = await loadSkillFile(path.join(dir, entry.name))
      // ...
    }
  }
}
```

### 条件技能

```yaml
---
name: "TypeScript Helper"
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
# 只在处理 TypeScript 文件时激活
```

### 执行上下文

```
Inline 模式：
┌─────────────────────────────────────┐
│  当前对话上下文                      │
│  ├── 共享对话历史                    │
│  ├── 共享工具权限                    │
│  └── 直接执行                        │
└─────────────────────────────────────┘

Fork 模式：
┌─────────────────────────────────────┐
│  独立子代理                          │
│  ├── 独立上下文                      │
│  ├── 独立 token 预算                 │
│  ├── 工具隔离                        │
│  └── 可指定代理类型                  │
└─────────────────────────────────────┘
```

---

## 5. Plugins 模块 - 插件系统

### 插件类型

```typescript
// 内置插件
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

// 市场插件
type MarketplacePlugin = {
  id: string
  repository: string
  version: string
  manifest: PluginManifest
}
```

### 插件生命周期

```
1. initBuiltinPlugins()     - 注册内置插件
    ↓
2. 扫描配置的插件仓库
    ↓
3. 解析插件 manifest
    ↓
4. 加载插件组件
   ├── Skills
   ├── Hooks
   ├── MCP Servers
   └── LSP Servers
    ↓
5. 去重和合并
```

### 插件 Manifest 格式

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "Plugin description",
  "skills": [
    {
      "name": "skill-name",
      "file": "skills/skill.md"
    }
  ],
  "hooks": {
    "pre-tool-use": [
      {
        "matcher": "Bash",
        "command": "echo 'Before bash'"
      }
    ]
  },
  "mcpServers": {
    "server-name": {
      "command": "node",
      "args": ["server.js"]
    }
  }
}
```

---

## 6. State 模块 - 状态管理

### Store 实现

```typescript
// store.ts
export type Store<T> = {
  getState: () => T
  setState: (updater: (prev: T) => T) => void
  subscribe: (listener: Listener) => () => void
}

export function createStore<T>(initialState: T): Store<T> {
  let state = initialState
  const listeners = new Set<Listener>()

  return {
    getState: () => state,
    setState: (updater) => {
      state = updater(state)
      listeners.forEach(listener => listener(state))
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
}
```

### AppState 结构

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
  plugins: {
    enabled: Plugin[]
    available: PluginDefinition[]
  }

  // MCP
  mcp: {
    clients: MCPServerConnection[]
    commands: Command[]
    tools: Tool[]
  }

  // 权限
  toolPermissionContext: ToolPermissionContext

  // 其他...
}
```

---

## 7. Components 模块 - UI 组件

### 设计系统

```typescript
// design-system/Dialog.tsx
export function Dialog({
  title,
  subtitle,
  children,
  onCancel,
  color,
  hideInputGuide,
  hideBorder,
  inputGuide,
  isCancelActive
}: DialogProps): React.ReactNode

// design-system/Pane.tsx
export function Pane({
  children,
  color
}: PaneProps): React.ReactNode

// design-system/KeyboardShortcutHint.tsx
export function KeyboardShortcutHint({
  shortcut,
  action,
  parens,
  bold
}: KeyboardShortcutHintProps): React.ReactNode
```

### Agent 组件

```typescript
// agents/AgentsList.tsx
export function AgentsList({
  source,
  agents,
  onBack,
  onSelect,
  onCreateNew,
  changes
}: AgentsListProps): React.ReactNode

// agents/AgentEditor.tsx
export function AgentEditor({
  agent,
  tools,
  onSaved,
  onBack
}: AgentEditorProps): React.ReactNode

// agents/ModelSelector.tsx
export function ModelSelector({
  initialModel,
  onComplete,
  onCancel
}: ModelSelectorProps): React.ReactNode
```

### CustomSelect 组件

```typescript
// CustomSelect/select.tsx
export type OptionWithDescription<T> = {
  type?: 'text'
  label: ReactNode
  value: T
  description?: string
  disabled?: boolean
} | {
  type: 'input'
  label: ReactNode
  value: T
  onChange: (value: string) => void
  placeholder?: string
  initialValue?: string
  allowEmptySubmitToCancel?: boolean
}

export function Select<T>({
  options,
  onChange,
  initialValue,
  // ...
}: SelectProps<T>): React.ReactNode
```

---

## 8. Keybindings 模块 - 快捷键系统

### 快捷键配置

```typescript
// keybindings.ts
interface KeybindingConfig {
  context: KeybindingContextName
  bindings: Record<string, string>
}

// 示例
{
  "context": "Chat",
  "bindings": {
    "escape": "chat:cancel",
    "ctrl+x ctrl+k": "chat:killAgents",
    "enter": "chat:submit"
  }
}
```

### 快捷键解析

```typescript
// 解析修饰键
ctrl/control → ctrl
alt/opt/option → alt (macOS: opt)
cmd/command/super → meta

// 特殊键转换
esc → escape
return → enter
```

### 和弦序列

```typescript
// 支持 ctrl+k ctrl+s 这样的组合
const pendingChord = {
  sequence: 'ctrl+k',
  timestamp: Date.now()
}

// 匹配流程
keydown → 检查是否和弦开始 → 等待下一个键 → 完成或取消
```

---

## 9. Vim 模块 - Vim 编辑模式

### 状态机设计

```typescript
// vim/types.ts
type VimState =
  | { mode: 'INSERT'; insertedText: string }
  | { mode: 'NORMAL'; command: CommandState }

type CommandState =
  | { type: 'idle' }
  | { type: 'count'; digits: string }
  | { type: 'operator'; op: Operator; count: number }
  | { type: 'operatorFind'; op: Operator; count: number; find: FindType }
  | { type: 'find'; find: FindType }
  | { type: 'motion'; motion: Motion; count: number }
  | { type: 'textObject'; op: Operator; count: number }
  | { type: 'replace'; count: number }

type Operator = 'delete' | 'change' | 'yank'
type FindType = 'f' | 'F' | 't' | 'T'
```

### 运动命令

```typescript
// 字符级
h, l - 左右移动
j, k - 上下移动

// 单词级
w, W - 下一个词首
b, B - 上一个词首
e, E - 当前/下一个词尾

// 行级
0 - 行首
^ - 第一个非空白字符
$ - 行尾
gg - 文件开头
G - 文件末尾
```

### 文本对象

```typescript
// 词对象
iw - inner word
aw - around word

// 括号对象
i", a" - 引号内/周围
i(, a( - 括号内/周围
i[, a[ - 方括号内/周围
i{, a{ - 花括号内/周围
```

---

## 10. Hooks 模块 - 事件钩子系统

### 钩子类型

```typescript
// types/hooks.ts
type HookType = 'command' | 'prompt' | 'agent' | 'http'

type HookEvent =
  | 'pre-sampling'
  | 'post-sampling'
  | 'pre-tool-use'
  | 'post-tool-use'
  | 'session-start'
  | 'session-end'
  // ...
```

### 钩子配置

```typescript
type HookConfig = {
  matcher?: string        // 匹配模式
  hooks: HookCommand[]    // 钩子命令列表
}

type HookCommand =
  | BashCommandHook
  | PromptHook
  | AgentHook
  | HttpHook
```

### 钩子执行

```typescript
// hooks.ts
export async function executeHooks(
  event: HookEvent,
  context: HookContext
): Promise<HookResult> {
  const matchingHooks = getMatchingHooks(event, context)

  for (const hook of matchingHooks) {
    const result = await executeHook(hook, context)

    if (result.type === 'reject') {
      return result
    }
  }

  return { type: 'continue' }
}
```

---

> 本文档基于 ClaudeCode 源代码分析生成，详细描述了各模块的实现细节。
