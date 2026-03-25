# mini-cli Architecture

本文档说明 `mini-cli` 项目的当前架构、核心模块职责，以及模块之间的协作关系。

## 维护约定

每次修改以下任一内容时，应同步更新本文档：

- 新增、删除、拆分核心模块
- 改变模块职责或调用关系
- 新增重要的运行流程
- 新增基础设施层，例如 `providers`、`streaming`、`terminal`、`managers`、`config`、`storage`、`context`
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
│   └── utils/                  # 通用工具
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

cli/*
  -> REPL 交互、命令解析、历史管理、Spinner/ProgressBar

config/models.ts
  -> 提供模型元数据和别名解析

config/loader.ts
  -> 从环境变量加载 API Key / 默认模型

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

- 定义命令行命令：`chat`、`ask`、`models`、`config`、`sessions`
- 初始化 `ProviderRegistry`
- 初始化 `ModelManager`
- 初始化 `SessionManager`
- 初始化内置工具注册表与 `ToolManager`
- 将 provider 输出交给 `StreamRenderer` 进行终端渲染

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

## 关键调用链

### REPL 交互流程

1. `AIRepl.start()` 启动交互式 REPL
2. 用户输入通过 `readline` 监听 `line` 事件
3. `HistoryManager.add()` 保存输入历史
4. 如果输入以 `/` 开头，调用 `CommandRegistry.execute()`
5. `CommandParser` 解析命令名、参数、选项
6. `CommandValidator` 校验参数类型和必填项
7. 对应的命令 handler 执行，可能调用 `SessionManager` 或其他服务
8. 如果是普通消息，调用 `onMessage` 回调处理
9. 循环等待下一次输入

### `chat` 命令执行流程

1. `index.ts` 读取命令行参数与环境配置
2. `SessionManager.createSession()` 创建新会话或加载现有会话
3. 用户输入通过 `SessionManager.addMessage()` 添加到会话
4. `SessionManager.getMessagesForAPI()` 获取消息（可能被截断）
5. `ModelManager` 解析模型并返回对应 provider
6. 如果 provider 支持工具调用，则进入 `ToolManager` 多轮对话流程
7. 如果不走工具调用，则 provider 执行 `stream(messages)`
8. `StreamRenderer` 消费 stream 并渲染到终端
9. AI 响应通过 `SessionManager.addMessage()` 保存
10. 退出时显示会话统计信息

### `ask` 命令执行流程

1. 创建临时消息数组
2. `ModelManager` 解析模型
3. provider 执行对话
4. 输出结果

### Tool Calling 执行流程

1. `ToolManager` 将已注册工具暴露给 provider
2. provider 通过 `chatWithTools()` 返回工具调用请求
3. `ToolExecutor` 做参数校验和安全检查后执行工具
4. 工具结果以 `tool` 消息回填到对话历史
5. provider 基于工具结果生成下一轮回复或继续调用工具

### 会话管理流程

1. `SessionManager.createSession()` 创建会话
2. 每条消息通过 `addMessage()` 添加
3. `estimateMessageTokens()` 计算 token 数
4. 如果超过上下文限制，`smartTruncate()` 自动截断
5. 成本通过 `CostCalculator` 累计
6. 可通过 `saveSession()` 持久化（使用 FileStorage 时）

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
- `cli.test.ts`: REPL、命令解析、历史管理（待添加）

## 当前设计边界

当前项目仍然是一个轻量学习项目，因此有几个明确边界：

- CLI 编排仍集中在 `index.ts`，交互式 REPL 在 `cli/repl.ts`
- 命令系统支持解析、校验、注册、补全
- 会话管理已实现基础功能（创建、消息、token 统计、成本计算）
- 上下文窗口支持智能截断
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
- 新增基础设施模块时，先更新本文档，再补测试
