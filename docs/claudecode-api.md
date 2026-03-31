# ClaudeCode API 参考

本文档提供 ClaudeCode 的核心 API 参考。

## 核心 API

### 1. QueryEngine - 查询引擎

```typescript
class QueryEngine {
  constructor(config: QueryEngineConfig)

  // 执行查询
  async ask(params: QueryParams): AsyncGenerator<QueryResult>

  // 中止查询
  abort(): void

  // 获取状态
  getState(): QueryEngineState
}

interface QueryEngineConfig {
  cwd: string
  tools: Tools
  commands: Command[]
  mcpClients: MCPServerConnection[]
  agents: AgentDefinition[]
  canUseTool: CanUseToolFn
  // ...
}

interface QueryParams {
  messages: Message[]
  systemPrompt: SystemPrompt
  userContext: Record<string, string>
  systemContext: Record<string, string>
  canUseTool: CanUseToolFn
  toolUseContext: ToolUseContext
  // ...
}
```

### 2. Tool - 工具接口

```typescript
interface Tool<Input = AnyObject, Output = unknown> {
  // 基础属性
  name: string
  aliases?: string[]
  searchHint?: string
  maxResultSizeChars?: number

  // 描述
  description(input: Input, options: ToolOptions): Promise<string>
  prompt(input: Input, options: ToolOptions): Promise<string>

  // Schema
  inputSchema: z.ZodType<Input>
  outputSchema?: z.ZodType<Output>

  // 执行
  call(
    input: Input,
    context: ToolUseContext
  ): Promise<ToolResult<Output>>

  // 权限
  checkPermissions(
    input: Input,
    context: ToolUseContext
  ): Promise<PermissionResult>

  // 特性
  isEnabled(): boolean
  isConcurrencySafe(): boolean
  isReadOnly(): boolean
  isDestructive(): boolean
  isOpenWorld(): boolean

  // UI
  userFacingName(input: Input): string
  renderToolUseMessage?(input: Input): React.ReactNode
  renderToolUseProgressMessage?(progress: ToolProgressData): React.ReactNode
  renderToolResultMessage?(output: Output): React.ReactNode

  // 结果处理
  isResultTruncated?(output: Output): boolean
  mapToolResultToToolResultBlockParam?(
    content: Output,
    toolUseID: string
  ): ToolResultBlockParam
}

type ToolResult<T> =
  | { type: 'success'; data: T }
  | { type: 'error'; error: string }

type PermissionResult =
  | { behavior: 'allow'; message?: string }
  | { behavior: 'deny'; message: string }
  | { behavior: 'ask'; message: string }
  | { behavior: 'passthrough'; message: string }
```

### 3. Command - 命令接口

```typescript
// 基础命令属性
interface CommandBase {
  name: string
  description: string
  availability?: CommandAvailability[]
  isEnabled?: () => boolean
  isHidden?: boolean
  aliases?: string[]
  argumentHint?: string
  whenToUse?: string
  version?: string
  disableModelInvocation?: boolean
  userInvocable?: boolean
  loadedFrom?: 'commands_DEPRECATED' | 'skills' | 'plugin' | 'managed' | 'bundled' | 'mcp'
  kind?: 'workflow'
  immediate?: boolean
  isSensitive?: boolean
  userFacingName?: () => string
}

// Prompt 命令
interface PromptCommand extends CommandBase {
  type: 'prompt'
  progressMessage: string
  contentLength: number
  argNames?: string[]
  allowedTools?: string[]
  model?: string
  source: SettingSource | 'builtin' | 'mcp' | 'plugin' | 'bundled'
  pluginInfo?: {
    pluginManifest: PluginManifest
    repository: string
  }
  disableNonInteractive?: boolean
  hooks?: HooksSettings
  skillRoot?: string
  context?: 'inline' | 'fork'
  agent?: string
  effort?: EffortValue
  paths?: string[]
  getPromptForCommand(
    args: string,
    context: ToolUseContext
  ): Promise<ContentBlockParam[]>
}

// Local 命令
interface LocalCommand extends CommandBase {
  type: 'local'
  supportsNonInteractive: boolean
  load: () => Promise<LocalCommandModule>
}

// Local-JSX 命令
interface LocalJSXCommand extends CommandBase {
  type: 'local-jsx'
  load: () => Promise<LocalJSXCommandModule>
}

type Command = PromptCommand | LocalCommand | LocalJSXCommand
```

### 4. AppState - 应用状态

```typescript
interface AppState {
  // 基础设置
  settings: Settings
  verbose: boolean
  mainLoopModel: string
  fastMode: boolean
  advisorModel: string | null
  effortValue: EffortValue | null

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
    available: Plugin[]
  }
  mcp: {
    clients: MCPServerConnection[]
    commands: Command[]
    resources: MCPResource[]
    tools: MCPTool[]
  }

  // 权限系统
  toolPermissionContext: ToolPermissionContext
  denialTracking: {
    deniedTools: Set<string>
    deniedPaths: Set<string>
  }

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

### 5. ToolPermissionContext - 权限上下文

```typescript
interface ToolPermissionContext {
  mode: PermissionMode
  additionalWorkingDirectories: Map<string, AdditionalWorkingDirectory>
  alwaysAllowRules: ToolPermissionRulesBySource
  alwaysDenyRules: ToolPermissionRulesBySource
  alwaysAskRules: ToolPermissionRulesBySource
  command: string[]
}

type PermissionMode =
  | 'default'
  | 'acceptEdits'
  | 'bypassPermissions'
  | 'plan'
  | 'auto'

interface ToolPermissionRules {
  Bash?: PermissionRule[]
  Read?: PermissionRule[]
  Edit?: PermissionRule[]
  Write?: PermissionRule[]
  // ...
}

interface PermissionRule {
  path: string
  behavior: PermissionBehavior
}

type PermissionBehavior = 'allow' | 'deny' | 'ask'
```

---

## 工具 API

### BashTool

```typescript
// 输入
interface BashToolInput {
  command: string
  timeout?: number
  run_in_background?: boolean
  dangerouslyDisableSandbox?: boolean
}

// 输出
interface BashToolOutput {
  stdout: string
  stderr: string
  exitCode: number
  signal?: string
}

// 示例
await bashTool.call({
  command: 'npm test',
  timeout: 60000
}, context)
```

### FileReadTool

```typescript
// 输入
interface FileReadToolInput {
  file_path: string
  offset?: number
  limit?: number
  pages?: string  // PDF 页面范围，如 "1-5, 10-20"
}

// 输出
type FileReadToolOutput =
  | { type: 'text'; content: string; lines: number }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'pdf'; pages: PDFPage[] }
  | { type: 'notebook'; cells: NotebookCell[] }

// 示例
const result = await fileReadTool.call({
  file_path: '/path/to/file.ts',
  offset: 1,
  limit: 100
}, context)
```

### FileEditTool

```typescript
// 输入
interface FileEditToolInput {
  file_path: string
  old_string: string
  new_string: string
  replace_all?: boolean
}

// 输出
interface FileEditToolOutput {
  success: boolean
  path: string
  originalContent: string
  newContent: string
}

// 示例
await fileEditTool.call({
  file_path: '/path/to/file.ts',
  old_string: 'const x = 1',
  new_string: 'const x = 2'
}, context)
```

### FileWriteTool

```typescript
// 输入
interface FileWriteToolInput {
  file_path: string
  content: string
}

// 输出
interface FileWriteToolOutput {
  success: boolean
  path: string
  bytesWritten: number
}

// 示例
await fileWriteTool.call({
  file_path: '/path/to/new-file.ts',
  content: 'export const x = 1'
}, context)
```

### GlobTool

```typescript
// 输入
interface GlobToolInput {
  pattern: string
  path?: string
}

// 输出
interface GlobToolOutput {
  files: string[]
}

// 示例
const result = await globTool.call({
  pattern: '**/*.ts',
  path: '/project/src'
}, context)
```

### GrepTool

```typescript
// 输入
interface GrepToolInput {
  pattern: string
  path?: string
  glob?: string
  output_mode: 'content' | 'files_with_matches' | 'count'
  '-B'?: number  // 前置行数
  '-A'?: number  // 后置行数
  '-C'?: number  // 上下文行数
  '-n'?: boolean  // 显示行号
  '-i'?: boolean  // 忽略大小写
  type?: string   // 文件类型
}

// 输出
type GrepToolOutput =
  | { type: 'files'; files: string[] }
  | { type: 'content'; matches: GrepMatch[] }
  | { type: 'count'; counts: Record<string, number> }

interface GrepMatch {
  file: string
  line: number
  content: string
  context?: {
    before: string[]
    after: string[]
  }
}

// 示例
const result = await grepTool.call({
  pattern: 'function.*\\(',
  path: '/project/src',
  output_mode: 'content',
  '-n': true,
  '-C': 3
}, context)
```

---

## Hooks API

### Hook 配置

```typescript
// 钩子类型
type HookCommand =
  | { type: 'bash'; command: string; timeout?: number }
  | { type: 'prompt'; prompt: string }
  | { type: 'agent'; agent: string; prompt: string }
  | { type: 'http'; url: string; method?: string; headers?: Record<string, string> }

// 钩子匹配器
interface HookMatcher {
  matcher?: string
  hooks: HookCommand[]
}

// 钩子设置
interface HooksSettings {
  'pre-sampling'?: HookMatcher[]
  'post-sampling'?: HookMatcher[]
  'pre-tool-use'?: HookMatcher[]
  'post-tool-use'?: HookMatcher[]
  'session-start'?: HookMatcher[]
  'session-end'?: HookMatcher[]
  // ...
}
```

### Hook 执行结果

```typescript
type HookResult =
  | { type: 'continue' }
  | { type: 'suppress' }
  | { type: 'reject'; reason: string }
  | { type: 'replace'; content: string }
  | { type: 'async'; message: string }
```

---

## MCP API

### MCP 客户端配置

```typescript
interface MCPServerConfig {
  type: 'stdio' | 'sse' | 'ws' | 'streamable-http'
  command?: string      // stdio 类型
  args?: string[]       // stdio 类型
  url?: string          // sse/ws/http 类型
  env?: Record<string, string>
  headers?: Record<string, string>
  timeout?: number
}

interface ScopedMcpServerConfig extends MCPServerConfig {
  scope: 'user' | 'project' | 'local'
}
```

### MCP 工具

```typescript
interface MCPTool {
  name: string
  description: string
  inputSchema: JSONSchema
  serverName: string
}

// MCP 工具通过 MCPTool 调用
await mcpTool.call({
  // 工具名和参数由具体 MCP 服务器定义
  serverName: 'my-server',
  toolName: 'my-tool',
  arguments: { /* ... */ }
}, context)
```

---

## Agent API

### Agent 定义

```typescript
interface AgentDefinition {
  name: string
  agentType: string
  description: string
  model?: string
  tools?: string[]
  allowedAgentTypes?: string[]
  prompt: string
  source: SettingSource | 'builtin' | 'plugin'
  isAsync?: boolean
  memoryScope?: 'session' | 'project' | 'user'
  color?: string
  hooks?: HooksSettings
}
```

### Agent 执行

```typescript
// 通过 AgentTool 执行
interface AgentToolInput {
  model?: string
  effort?: EffortValue
  tools?: string[]
  allowedAgentTypes?: string[]
  context?: 'inline' | 'fork'
  isAsync?: boolean
  memoryScope?: 'session' | 'project' | 'user'
  prompt: string
}

// 示例
await agentTool.call({
  prompt: '分析这个项目的依赖关系',
  model: 'claude-3-sonnet-20240229',
  tools: ['read', 'glob', 'grep'],
  context: 'fork'
}, context)
```

---

## Settings API

### 设置结构

```typescript
interface Settings {
  // API 配置
  apiKey?: string
  baseUrl?: string

  // 模型配置
  model?: string

  // 权限配置
  permissionMode?: PermissionMode
  alwaysAllowRules?: ToolPermissionRules
  alwaysDenyRules?: ToolPermissionRules

  // 插件配置
  enabledPlugins?: Record<string, boolean>
  pluginRepositories?: Record<string, PluginRepository>

  // MCP 配置
  mcpServers?: Record<string, ScopedMcpServerConfig>

  // 技能配置
  skills?: SkillsSettings

  // 钩子配置
  hooks?: HooksSettings

  // UI 配置
  theme?: 'light' | 'dark' | 'system'
  color?: string
}

// 设置来源
type SettingSource =
  | 'user'      // ~/.claude/settings.json
  | 'project'   // .claude/settings.json
  | 'local'     // .claude/settings.local.json
  | 'cli'       // 命令行参数
  | 'mdm'       // MDM 配置
  | 'env'       // 环境变量
```

---

> 本文档基于 ClaudeCode 源代码分析生成，提供了核心 API 的参考信息。
