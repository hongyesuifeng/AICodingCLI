# mini-cli Architecture

本文档说明 `mini-cli` 项目的当前架构、核心模块职责，以及模块之间的协作关系。

## 维护约定

每次修改以下任一内容时，应同步更新本文档：

- 新增、删除、拆分核心模块
- 改变模块职责或调用关系
- 新增重要的运行流程
- 新增基础设施层，例如 `providers`、`streaming`、`terminal`、`managers`、`config`、`storage`、`context`、`mcp`、`skills`、`hooks`、`git`
- 调整测试结构，导致测试覆盖边界发生变化

如果只是修改实现细节、文案、注释，且不影响结构和职责，可以不更新本文档。

## 项目目标

`mini-cli` 是一个学习型 AI CLI 项目，目标是逐步实现：

- 多模型 Provider 抽象
- 模型切换与配置加载
- 流式输出处理
- 终端实时渲染
- 工具调用系统（Tool Calling）
- 会话管理与持久化
- 上下文窗口管理
- Token 计数与成本估算
- **MCP 协议支持**（Model Context Protocol）
- **技能系统**（Skills）
- **钩子系统**（Hooks）
- **Git 集成**（Commit 消息生成、状态解析、Diff 解析）

## 目录结构

```text
mini-cli/
├── src/
│   ├── index.ts                # CLI 入口
│   ├── cli/                    # 命令行交互界面层
│   ├── config/                 # 配置与模型元数据
│   ├── managers/               # 运行时管理层
│   ├── providers/              # AI Provider 抽象与实现
│   ├── tools/                  # 工具定义、注册、执行与安全控制
│   ├── storage/                # 会话存储层（内存/文件）
│   ├── context/                # 上下文窗口管理
│   ├── streaming/              # 流式解析与流处理
│   ├── terminal/               # 终端渲染与显示
│   ├── types/                  # 核心类型定义
│   ├── utils/                  # 通用工具
│   ├── mcp/                    # MCP 协议实现 (新增)
│   ├── skills/                 # 技能系统 (新增)
│   ├── hooks/                  # 钩子系统 (新增)
│   └── git/                    # Git 集成 (新增)
├── test/                       # 单元测试
├── package.json
├── tsconfig.json
└── ARCHITECTURE.md
```

## 架构总览

```text
CLI(index.ts)
  -> AIRepl (cli/repl.ts)
    -> HistoryManager
    -> CommandRegistry
    -> SessionManager
  -> ModelManager
    -> ProviderRegistry
      -> OpenAIProvider / MiniMaxProvider
  -> SessionManager
    -> MemoryStorage / FileStorage
    -> TokenCounter
    -> CostCalculator
    -> ContextManager (truncateMessages / smartTruncate)
  -> ToolManager
    -> ToolRegistry
    -> ToolExecutor
  -> StreamRenderer
    -> StreamHandler
      -> provider.stream(...)
  -> SkillRegistry (新增)
    -> CommitSkill / ExplainSkill / ReviewSkill / TestSkill / HelpSkill
  -> HookManager (新增)
    -> LoggingHook / ValidationHook / PerformanceHook / SensitiveFilterHook
  -> GitCommands / GitStatusParser / CommitMessageGenerator (新增)

cli/*
  -> REPL 交互、命令解析、历史管理、Spinner/ProgressBar

config/models.ts
  -> 提供模型元数据和别名解析

config/loader.ts
  -> 从环境变量加载 API Key / 默认模型

mcp/* (新增)
  -> MCP 协议服务端/客户端实现
  -> JSON-RPC 通信
  -> 文件系统 MCP Server

skills/* (新增)
  -> 技能注册与执行
  -> 内置技能实现
  -> 技能触发器匹配

hooks/* (新增)
  -> 钩子注册与触发
  -> 生命周期事件处理
  -> 内置钩子实现

git/* (新增)
  -> Git 命令封装
  -> 状态解析
  -> Diff 解析
  -> AI 驱动的 Commit 消息生成

storage/*
  -> 会话持久化（内存或文件）

context/*
  -> 消息截断、滑动窗口等上下文管理

utils/token-counter.ts
  -> Token 估算

utils/cost-calculator.ts
  -> 成本计算

test/*
  -> 验证各层的核心功能
```

## 核心模块

### 1. CLI 入口

文件: [src/index.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/index.ts)

职责：

- 定义命令行命令：`chat`、`ask`、`models`、`config`、`sessions`、`commit`、`git-status`、`skills`
- 初始化 `ProviderRegistry`
- 初始化 `ModelManager`
- 初始化 `SessionManager`
- 初始化内置工具注册表与 `ToolManager`
- 初始化 `SkillRegistry`（技能系统）
- 初始化 `HookManager`（钩子系统）
- 将 provider 输出交给 `StreamRenderer` 进行终端渲染
- 处理技能命令并触发钩子

它是编排层，不应承载复杂的 provider 选择逻辑或流式解析细节。

### 2. 配置层

文件：

- [src/config/models.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/config/models.ts)
- [src/config/loader.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/config/loader.ts)

职责：

- 维护模型元数据
- 定义模型别名
- 解析模型名
- 从环境变量读取 API Key 和默认模型

关系：

- `ModelManager` 依赖 `models.ts` 做模型解析
- `ModelManager` 默认依赖 `loader.ts` 获取 API Key
- `index.ts` 依赖 `loader.ts` 读取全局配置

### 3. 管理层

文件：

- [src/managers/model-manager.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/managers/model-manager.ts)
- [src/managers/session-manager.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/managers/session-manager.ts)

职责：

**ModelManager**
- 管理当前模型
- 根据模型能力解析出目标 provider
- 通过 `ProviderRegistry` 创建 provider
- 缓存已创建的 provider 实例

**SessionManager**
- 创建/加载/保存会话
- 管理消息历史
- 处理上下文窗口（自动截断）
- 跟踪 token 使用和成本
- 提供格式化的会话信息

关系：

- 向上为 CLI 提供统一的接口
- 向下依赖 `ProviderRegistry`、存储层、上下文管理层

### 4. Provider 抽象层

文件：

- [src/providers/base-provider.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/providers/base-provider.ts)
- [src/providers/registry.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/providers/registry.ts)
- [src/providers/index.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/providers/index.ts)

职责：

- 定义统一的 AI Provider 接口
- 提供公共校验逻辑
- 提供 provider 注册机制

关系：

- `ModelManager` 使用 `ProviderRegistry`
- 各 provider 实现继承 `BaseProvider`

### 5. Provider 实现层

文件：

- [src/providers/openai.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/providers/openai.ts)
- [src/providers/minimax.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/providers/minimax.ts)

职责：

- 适配不同模型服务商的 SDK
- 将统一的消息结构转换为各自 SDK 需要的格式
- 实现 `chat`、`stream`、`chatWithTools`

当前状态：

- `OpenAIProvider` 负责 OpenAI Chat Completions 风格接口
- `MiniMaxProvider` 基于 Anthropic 兼容接口实现，并支持 `thinking` 类型流块

### 6. 流式处理层

文件：

- [src/streaming/buffer-manager.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/streaming/buffer-manager.ts)
- [src/streaming/sse-parser.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/streaming/sse-parser.ts)
- [src/streaming/json-stream-parser.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/streaming/json-stream-parser.ts)
- [src/streaming/stream-handler.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/streaming/stream-handler.ts)

职责：

- 管理流式缓冲区
- 解析 SSE 消息
- 处理被拆分的 JSON 片段
- 将 provider 输出转换为更高层的流式事件

关系：

- `StreamRenderer` 依赖 `StreamHandler`
- 这些模块本身不依赖具体 provider，实现上保持纯工具化和可测试

### 7. 工具系统层

文件：

- [src/tools/registry.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/tools/registry.ts)
- [src/tools/executor.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/tools/executor.ts)
- [src/tools/built-in.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/tools/built-in.ts)
- [src/tools/tool-manager.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/tools/tool-manager.ts)
- [src/tools/security/path-validator.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/tools/security/path-validator.ts)
- [src/tools/security/command-filter.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/tools/security/command-filter.ts)

职责：

- 定义工具注册与发现
- 按 schema 校验参数并执行工具
- 对文件路径和 shell 命令做安全限制
- 编排多轮 tool calling 对话

关系：

- `ToolManager` 依赖 `ToolRegistry` 和 `ToolExecutor`
- provider 的 `chatWithTools` 与工具系统一起完成多轮调用

### 8. 会话存储层

文件：

- [src/storage/memory-storage.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/storage/memory-storage.ts)
- [src/storage/file-storage.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/storage/file-storage.ts)
- [src/storage/factory.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/storage/factory.ts)

职责：

- 定义统一的 `SessionStorage` 接口
- 实现内存存储（`MemoryStorage`）
- 实现文件存储（`FileStorage`）
- 提供存储工厂（`StorageFactory`）

关系：

- `SessionManager` 依赖 `SessionStorage` 接口
- 可根据配置切换存储后端

### 9. 上下文管理层

文件：

- [src/context/truncation.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/context/truncation.ts)
- [src/context/sliding-window.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/context/sliding-window.ts)

职责：

- 消息截断策略（`truncateMessages`、`smartTruncate`）
- 滑动窗口实现（`FixedSlidingWindow`）
- 保留系统消息和最近消息
- 基于 token 限制智能截断

关系：

- `SessionManager` 使用截断函数管理上下文窗口

### 10. 终端渲染层

文件：

- [src/terminal/ansi.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/terminal/ansi.ts)
- [src/terminal/progress-bar.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/terminal/progress-bar.ts)
- [src/terminal/stream-renderer.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/terminal/stream-renderer.ts)

职责：

- 封装 ANSI 控制字符
- 提供单行进度更新能力
- 将流式事件渲染到终端

关系：

- `index.ts` 通过 `StreamRenderer` 输出 AI 响应
- `StreamRenderer` 内部依赖 `StreamHandler`

### 11. CLI 交互层

文件：

- [src/cli/repl.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/cli/repl.ts)
- [src/cli/history.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/cli/history.ts)
- [src/cli/spinner.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/cli/spinner.ts)
- [src/cli/types.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/cli/types.ts)
- [src/cli/command/parser.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/cli/command/parser.ts)
- [src/cli/command/validator.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/cli/command/validator.ts)
- [src/cli/command/registry.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/cli/command/registry.ts)
- [src/cli/command/builtin.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/cli/command/builtin.ts)
- [src/cli/prompts/basic.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/cli/prompts/basic.ts)
- [src/cli/wizard/config-wizard.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/cli/wizard/config-wizard.ts)

职责：

- **AIRepl**: 交互式 REPL 循环，处理用户输入、命令执行、自动补全
- **HistoryManager**: 命令历史持久化与加载
- **SimpleSpinner/ProgressBar**: 加载动画和进度条显示
- **CommandParser**: 命令词法分析和语法解析（tokenize + parse）
- **CommandValidator**: 命令参数校验
- **CommandRegistry**: 命令注册、查找、执行、补全
- **builtinCommands**: 内置命令实现（help、clear、exit、model、session）
- **SimplePrompt**: 交互式输入（文本、密码、确认、选择、多选）
- **ConfigWizard**: 分步配置向导，引导用户完成初始化设置

关系：

- `AIRepl` 是 CLI 的主入口，组合了 HistoryManager 和 CommandRegistry
- `CommandRegistry` 依赖 Parser、Validator 执行命令
- `SimplePrompt` 为 ConfigWizard 提供交互能力
- `AIRepl` 可选集成 `SessionManager` 实现会话持久化

### 12. 类型层

文件：

- [src/types/message.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/types/message.ts)
- [src/types/session.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/types/session.ts)
- [src/types/stream.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/types/stream.ts)
- [src/types/tool.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/types/tool.ts)

职责：

- 定义消息、工具、token 使用、流块等核心类型
- 定义会话、存储、上下文等类型
- 为各层提供稳定契约

### 13. 通用工具层

文件：

- [src/utils/errors.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/utils/errors.ts)
- [src/utils/retry.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/utils/retry.ts)
- [src/utils/timeout.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/utils/timeout.ts)
- [src/utils/token-counter.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/utils/token-counter.ts)
- [src/utils/cost-calculator.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/utils/cost-calculator.ts)

职责：

- 统一错误模型与错误映射
- 提供重试逻辑
- Token 估算（`estimateTokens`、`TokenCounter`）
- 成本计算（`CostCalculator`、`MODEL_PRICING`）

### 14. MCP 协议层 (新增)

文件：

- [src/mcp/types.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/mcp/types.ts)
- [src/mcp/jsonrpc.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/mcp/jsonrpc.ts)
- [src/mcp/mcp-server.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/mcp/mcp-server.ts)
- [src/mcp/mcp-client.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/mcp/mcp-client.ts)
- [src/mcp/file-system-server.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/mcp/file-system-server.ts)
- [src/mcp/index.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/mcp/index.ts)

职责：

- **types.ts**: 定义 MCP 和 JSON-RPC 类型
- **jsonrpc.ts**: JSON-RPC 服务器实现，处理请求/响应/通知
- **MCPServer**: MCP 服务器核心类，支持工具/资源/提示词注册
- **MCPClient**: MCP 客户端，通过子进程连接外部 MCP 服务器
- **FileSystemMCPServer**: 文件系统 MCP Server 实现，提供文件读写/目录操作工具

关系：

- `MCPServer` 依赖 `JSONRPCServer` 处理通信
- `MCPClient` 通过子进程与外部 MCP Server 通信
- `FileSystemMCPServer` 继承 `MCPServer` 提供文件系统工具

### 15. 技能系统层 (新增)

文件：

- [src/skills/types.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/skills/types.ts)
- [src/skills/base-skill.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/skills/base-skill.ts)
- [src/skills/skill-registry.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/skills/skill-registry.ts)
- [src/skills/factory.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/skills/factory.ts)
- [src/skills/builtin/commit-skill.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/skills/builtin/commit-skill.ts)
- [src/skills/builtin/explain-skill.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/skills/builtin/explain-skill.ts)
- [src/skills/builtin/review-skill.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/skills/builtin/review-skill.ts)
- [src/skills/builtin/test-skill.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/skills/builtin/test-skill.ts)
- [src/skills/builtin/help-skill.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/skills/builtin/help-skill.ts)

职责：

- **types.ts**: 定义技能触发器、上下文、结果等类型
- **BaseSkill**: 技能基类，提供触发检测、参数解析、帮助格式化
- **SkillRegistry**: 技能注册表，管理技能注册、匹配、执行
- **CommitSkill**: 分析暂存更改并生成 conventional commit 消息
- **ExplainSkill**: 详细解释代码的功能和结构
- **ReviewSkill**: 审查代码并提供改进建议
- **TestSkill**: 为代码生成单元测试
- **HelpSkill**: 显示技能帮助信息

关系：

- `SkillRegistry` 管理所有注册的技能
- 各技能继承 `BaseSkill` 实现具体功能
- 技能可通过 `SkillContext` 访问 AI Provider

### 16. 钩子系统层 (新增)

文件：

- [src/hooks/types.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/hooks/types.ts)
- [src/hooks/hook-manager.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/hooks/hook-manager.ts)
- [src/hooks/config-loader.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/hooks/config-loader.ts)
- [src/hooks/builtin/logging-hook.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/hooks/builtin/logging-hook.ts)
- [src/hooks/builtin/validation-hook.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/hooks/builtin/validation-hook.ts)
- [src/hooks/builtin/performance-hook.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/hooks/builtin/performance-hook.ts)
- [src/hooks/builtin/sensitive-filter-hook.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/hooks/builtin/sensitive-filter-hook.ts)

职责：

- **types.ts**: 定义钩子事件类型、上下文、结果、钩子定义
- **HookManager**: 钩子管理器，处理钩子注册、触发、优先级排序
- **config-loader.ts**: 从配置文件加载钩子
- **logging-hook**: 记录请求和响应到日志文件
- **validation-hook**: 输入验证（长度限制、禁用模式）
- **performance-hook**: 性能监控，记录响应时间和 token 使用
- **sensitive-filter-hook**: 敏感信息过滤（API Key、密码等）

关系：

- `HookManager` 管理所有钩子的生命周期
- 钩子可在特定事件（如 preResponse、postResponse）时触发
- 支持同步和异步执行模式

### 17. Git 集成层 (新增)

文件：

- [src/git/executor.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/git/executor.ts)
- [src/git/commands.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/git/commands.ts)
- [src/git/status.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/git/status.ts)
- [src/git/diff.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/git/diff.ts)
- [src/git/commit-generator.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/git/commit-generator.ts)
- [src/git/index.ts](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/src/git/index.ts)

职责：

- **GitExecutor**: Git 命令执行器，封装 git 命令执行
- **GitCommands**: Git 命令封装（init、clone、status、add、commit、push、pull、branch 等）
- **GitStatusParser**: Git 状态解析器，解析 git status 输出
- **DiffParser**: Diff 解析器，解析 git diff 输出
- **CommitMessageGenerator**: AI 驱动的 Commit 消息生成器

关系：

- `GitCommands` 依赖 `GitExecutor` 执行命令
- `CommitMessageGenerator` 依赖 AI Provider 生成消息
- `GitStatusParser` 和 `DiffParser` 提供格式化的输出

## 关键调用链

### REPL 交互流程

1. `AIRepl.start()` 启动交互式 REPL
2. 用户输入通过 `readline` 监听 `line` 事件
3. `HistoryManager.add()` 保存输入历史
4. 如果输入以 `/` 开头，调用 `CommandRegistry.execute()` 或 `SkillRegistry.execute()`
5. `CommandParser` 解析命令名、参数、选项
6. `CommandValidator` 校验参数类型和必填项
7. 对应的命令 handler 执行，可能调用 `SessionManager` 或其他服务
8. 如果是普通消息，调用 `onMessage` 回调处理
9. 循环等待下一次输入

### `chat` 命令执行流程

1. `index.ts` 读取命令行参数与环境配置
2. `SessionManager.createSession()` 创建新会话或加载现有会话
3. **触发 `onSessionStart` 钩子**
4. 用户输入通过 `SessionManager.addMessage()` 添加到会话
5. **检查是否是技能命令，如果是则执行技能**
6. **触发 `preInput` 钩子**
7. `SessionManager.getMessagesForAPI()` 获取消息（可能被截断）
8. **触发 `preResponse` 钩子**
9. `ModelManager` 解析模型并返回对应 provider
10. 如果 provider 支持工具调用，则进入 `ToolManager` 多轮对话流程
11. 如果不走工具调用，则 provider 执行 `stream(messages)`
12. `StreamRenderer` 消费 stream 并渲染到终端
13. **触发 `postResponse` 钩子**
14. AI 响应通过 `SessionManager.addMessage()` 保存
15. 退出时**触发 `onSessionEnd` 钩子**，显示会话统计信息

### `ask` 命令执行流程

1. 创建临时消息数组
2. `ModelManager` 解析模型
3. provider 执行对话
4. 输出结果

### Tool Calling 执行流程

1. `ToolManager` 将已注册工具暴露给 provider
2. provider 通过 `chatWithTools()` 返回工具调用请求
3. **触发 `preToolCall` 钩子**
4. `ToolExecutor` 做参数校验和安全检查后执行工具
5. **触发 `postToolCall` 钩子**
6. 工具结果以 `tool` 消息回填到对话历史
7. provider 基于工具结果生成下一轮回复或继续调用工具

### 会话管理流程

1. `SessionManager.createSession()` 创建会话
2. 每条消息通过 `addMessage()` 添加
3. `estimateMessageTokens()` 计算 token 数
4. 如果超过上下文限制，`smartTruncate()` 自动截断
5. 成本通过 `CostCalculator` 累计
6. 可通过 `saveSession()` 持久化（使用 FileStorage 时）

### 技能执行流程 (新增)

1. 用户输入以 `/` 开头的命令
2. `SkillRegistry.isSkillCommand()` 检测是否是技能命令
3. `SkillRegistry.match()` 匹配对应的技能
4. 技能的 `parseArgs()` 解析参数
5. 技能的 `execute()` 执行，可能调用 AI Provider
6. 返回执行结果（成功/失败、输出内容）

### 钩子触发流程 (新增)

1. 在关键节点调用 `HookManager.trigger(event, context)`
2. 获取该事件的所有钩子，按优先级排序
3. 依次执行钩子：
   - 异步钩子：不等待，后台执行
   - 同步钩子：等待结果
4. 如果钩子返回 `proceed: false`，中断流程
5. 如果钩子修改了输入/输出，更新上下文

### Git Commit 生成流程 (新增)

1. 调用 `CommitMessageGenerator.generate()`
2. `GitStatusParser.getStatus()` 获取暂存文件
3. `DiffParser.getDiff()` 获取暂存的 diff
4. 格式化 diff 作为提示词
5. 调用 AI Provider 生成 commit 消息
6. 清理和验证生成的消息
7. 可选调用 `commit()` 执行提交

## 测试结构

测试目录: [test](/mnt/d/AICodeCLI/AiCLIFromZero/mini-cli/test)

当前覆盖重点：

- `base-provider.test.ts`: Provider 抽象层基础行为
- `config.test.ts`: 模型配置和环境变量加载
- `errors.test.ts`: 错误映射
- `retry.test.ts`: 重试逻辑
- `provider-registry.test.ts`: provider 注册与创建
- `model-manager.test.ts`: 模型切换与 provider 缓存
- `streaming.test.ts`: buffer、SSE、JSON、stream handler
- `terminal.test.ts`: 进度条和终端流渲染
- `tool-registry.test.ts`: 工具注册与发现
- `tool-executor.test.ts`: 工具执行、安全限制和参数校验
- `tool-manager.test.ts`: 多轮 tool calling 编排
- `session-manager.test.ts`: 会话创建、消息管理、token 统计
- `storage.test.ts`: 内存和文件存储
- `context.test.ts`: 消息截断策略
- `cli.test.ts`: REPL、命令解析、历史管理
- `mcp.test.ts`: MCP 协议实现（待添加）
- `skills.test.ts`: 技能注册与执行（待添加）
- `hooks.test.ts`: 钩子注册与触发（待添加）
- `git.test.ts`: Git 命令和解析（待添加）

## 当前设计边界

当前项目仍然是一个轻量学习项目，因此有几个明确边界：

- CLI 编排仍集中在 `index.ts`，交互式 REPL 在 `cli/repl.ts`
- 命令系统支持解析、校验、注册、补全
- 会话管理已实现基础功能（创建、消息、token 统计、成本计算）
- 上下文窗口支持智能截断
- **技能系统支持命令触发和关键词触发**
- **钩子系统支持生命周期事件处理**
- **Git 集成支持状态解析、Diff 解析、Commit 消息生成**
- **MCP 协议支持基础的服务端和客户端实现**
- 还没有更完整的 provider 集成测试
- 还没有将 streaming 工具接入底层 HTTP/SSE 读取流程，目前主要用于结构化学习和单元测试
- `chat` / `ask` 已接入内置工具系统和会话管理

## 后续修改建议

后续如果继续扩展，优先保持以下原则：

- `index.ts` 只做编排，不堆业务细节
- `cli/` 层负责用户交互，不处理 AI 协议细节
- provider 层只处理模型适配，不处理终端渲染
- streaming 层保持与 provider 解耦
- terminal 层只关心输出，不关心模型协议
- storage 层保持接口统一，支持多种后端
- context 层只关心消息截断策略，不关心具体业务
- **mcp/ 层保持协议实现纯粹，不混入业务逻辑**
- **skills/ 层保持技能独立，每个技能专注于单一职责**
- **hooks/ 层保持钩子轻量，避免阻塞主流程**
- **git/ 层只处理 Git 操作，不涉及其他功能**
- 新增基础设施模块时，先更新本文档，再补测试
