# 8.1 架构设计和模块划分

## 学习目标

理解完整项目的架构设计，掌握模块划分原则、依赖关系管理和扩展点设计。

## 1. 项目架构总览

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MiniCode CLI 架构                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                          CLI 层 (CLI Layer)                          │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │  │
│   │  │   REPL      │  │   Commands  │  │   Prompts   │  │   Output  │  │  │
│   │  │   交互循环   │  │   命令解析   │  │   交互提示   │  │   输出渲染 │  │  │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│   ┌────────────────────────────────▼─────────────────────────────────────┐  │
│   │                          核心层 (Core Layer)                          │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │  │
│   │  │   Agent     │  │   Session   │  │   Skills    │  │   Hooks   │  │  │
│   │  │   代理运行   │  │   会话管理   │  │   技能系统   │  │   钩子系统 │  │  │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│   ┌────────────────────────────────▼─────────────────────────────────────┐  │
│   │                          服务层 (Service Layer)                       │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │  │
│   │  │   Provider  │  │   Tools     │  │   Storage   │  │   Config  │  │  │
│   │  │   AI 提供者  │  │   工具注册   │  │   数据存储   │  │   配置管理 │  │  │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│   ┌────────────────────────────────▼─────────────────────────────────────┐  │
│   │                          基础层 (Base Layer)                          │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │  │
│   │  │   Logger    │  │   Errors    │  │   Utils     │  │   Types   │  │  │
│   │  │   日志      │  │   错误处理   │  │   工具函数   │  │   类型定义 │  │  │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 目录结构

```
minicode-cli/
├── src/
│   ├── index.ts              # 入口文件
│   ├── cli/                  # CLI 层
│   │   ├── index.ts
│   │   ├── repl.ts           # REPL 实现
│   │   ├── commands/         # 命令定义
│   │   ├── prompts/          # 交互提示
│   │   └── output/           # 输出渲染
│   │
│   ├── core/                 # 核心层
│   │   ├── index.ts
│   │   ├── agent/            # Agent 实现
│   │   ├── session/          # 会话管理
│   │   ├── skills/           # 技能系统
│   │   └── hooks/            # 钩子系统
│   │
│   ├── services/             # 服务层
│   │   ├── index.ts
│   │   ├── providers/        # AI Provider
│   │   ├── tools/            # 工具系统
│   │   ├── storage/          # 存储服务
│   │   └── config/           # 配置管理
│   │
│   ├── base/                 # 基础层
│   │   ├── index.ts
│   │   ├── logger.ts         # 日志
│   │   ├── errors.ts         # 错误定义
│   │   ├── utils/            # 工具函数
│   │   └── types/            # 类型定义
│   │
│   └── bin.ts                # CLI 入口
│
├── tests/                    # 测试
├── docs/                     # 文档
├── package.json
├── tsconfig.json
└── README.md
```

## 2. 模块划分原则

### 2.1 分层原则

```typescript
// 依赖方向：上层依赖下层，下层不依赖上层

// ✅ 正确：CLI 层使用 Core 层
// cli/repl.ts
import { AgentRunner } from '../core/agent';

// ✅ 正确：Core 层使用 Services 层
// core/agent/index.ts
import { AIProvider } from '../../services/providers';

// ❌ 错误：Services 层依赖 Core 层
// services/tools/registry.ts
import { Session } from '../../core/session';  // 错误！
```

### 2.2 模块边界

```typescript
// src/base/types/index.ts - 核心类型定义

// 消息类型（各层通用）
export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

// 工具定义（Services 和 Core 层通用）
export interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (params: any) => Promise<string>;
}

// 配置类型（各层通用）
export interface AppConfig {
  provider: ProviderConfig;
  tools: ToolsConfig;
  ui: UIConfig;
}
```

### 2.3 接口抽象

```typescript
// src/services/providers/interface.ts

// AI Provider 接口（抽象）
export interface IAIProvider {
  readonly name: string;
  readonly model: string;

  chat(messages: Message[], options?: ChatOptions): Promise<ChatResult>;
  stream(messages: Message[], options?: ChatOptions): AsyncGenerator<StreamChunk>;
  chatWithTools(messages: Message[], tools: Tool[], options?: ChatOptions): Promise<ChatResult>;
}

// src/services/storage/interface.ts

// 存储接口（抽象）
export interface IStorage {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<boolean>;
  list(): Promise<string[]>;
}

// src/services/tools/interface.ts

// 工具注册表接口（抽象）
export interface IToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  list(): Tool[];
}
```

## 3. 核心模块设计

### 3.1 Agent 模块

```typescript
// src/core/agent/index.ts
import { IAIProvider } from '../../services/providers/interface';
import { IToolRegistry } from '../../services/tools/interface';
import { Message, Tool, ToolCallResult } from '../../base/types';

// Agent 配置
export interface AgentConfig {
  maxIterations: number;
  systemPrompt?: string;
  onToolCall?: (call: ToolCall) => void;
  onToolResult?: (result: ToolCallResult) => void;
}

// Agent 运行器
export class AgentRunner {
  private messages: Message[] = [];
  private tools: Tool[] = [];

  constructor(
    private provider: IAIProvider,
    private toolRegistry: IToolRegistry,
    private config: AgentConfig
  ) {}

  /**
   * 注册工具
   */
  registerTool(tool: Tool): void {
    this.tools.push(tool);
    this.toolRegistry.register(tool);
  }

  /**
   * 运行 Agent
   */
  async run(userInput: string): Promise<string> {
    // 添加系统提示
    if (this.config.systemPrompt && this.messages.length === 0) {
      this.messages.push({
        role: 'system',
        content: this.config.systemPrompt,
      });
    }

    // 添加用户消息
    this.messages.push({
      role: 'user',
      content: userInput,
    });

    // 迭代执行
    for (let i = 0; i < this.config.maxIterations; i++) {
      const result = await this.provider.chatWithTools(
        this.messages,
        this.tools
      );

      // 添加助手消息
      this.messages.push({
        role: 'assistant',
        content: result.content,
      });

      // 检查是否需要工具调用
      if (!result.toolCalls || result.toolCalls.length === 0) {
        return result.content;
      }

      // 执行工具调用
      const toolResults = await this.executeToolCalls(result.toolCalls);

      // 添加工具结果
      for (const tr of toolResults) {
        this.messages.push({
          role: 'tool',
          content: tr.result,
        } as any);
      }
    }

    throw new Error('Max iterations reached');
  }

  /**
   * 执行工具调用
   */
  private async executeToolCalls(calls: ToolCall[]): Promise<ToolCallResult[]> {
    const results: ToolCallResult[] = [];

    for (const call of calls) {
      const tool = this.toolRegistry.get(call.name);
      if (!tool) {
        results.push({
          toolCallId: call.id,
          result: `Unknown tool: ${call.name}`,
          isError: true,
        });
        continue;
      }

      try {
        const result = await tool.execute(call.arguments);
        results.push({
          toolCallId: call.id,
          result,
          isError: false,
        });
      } catch (error: any) {
        results.push({
          toolCallId: call.id,
          result: error.message,
          isError: true,
        });
      }
    }

    return results;
  }

  /**
   * 流式运行
   */
  async *runStream(userInput: string): AsyncGenerator<string> {
    this.messages.push({ role: 'user', content: userInput });

    for await (const chunk of this.provider.stream(this.messages)) {
      if (chunk.delta) {
        yield chunk.delta;
      }
    }
  }

  /**
   * 重置会话
   */
  reset(): void {
    this.messages = [];
  }
}
```

### 3.2 Session 模块

```typescript
// src/core/session/index.ts
import { IStorage } from '../../services/storage/interface';
import { Message } from '../../base/types';

// 会话信息
export interface Session {
  id: string;
  title?: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// 会话管理器
export class SessionManager {
  private currentSession: Session | null = null;

  constructor(private storage: IStorage) {}

  /**
   * 创建新会话
   */
  async createSession(id?: string): Promise<Session> {
    const session: Session = {
      id: id || this.generateId(),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.storage.set(`session:${session.id}`, session);
    this.currentSession = session;

    return session;
  }

  /**
   * 获取当前会话
   */
  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  /**
   * 加载会话
   */
  async loadSession(id: string): Promise<Session | null> {
    const session = await this.storage.get(`session:${id}`);
    if (session) {
      this.currentSession = session;
    }
    return session;
  }

  /**
   * 添加消息
   */
  async addMessage(message: Message): Promise<void> {
    if (!this.currentSession) {
      await this.createSession();
    }

    this.currentSession!.messages.push(message);
    this.currentSession!.updatedAt = Date.now();

    await this.storage.set(`session:${this.currentSession!.id}`, this.currentSession);
  }

  /**
   * 保存会话
   */
  async saveSession(): Promise<void> {
    if (this.currentSession) {
      await this.storage.set(`session:${this.currentSession.id}`, this.currentSession);
    }
  }

  /**
   * 列出所有会话
   */
  async listSessions(): Promise<Session[]> {
    const keys = await this.storage.list();
    const sessions: Session[] = [];

    for (const key of keys) {
      if (key.startsWith('session:')) {
        const session = await this.storage.get(key);
        if (session) {
          sessions.push(session);
        }
      }
    }

    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * 删除会话
   */
  async deleteSession(id: string): Promise<boolean> {
    if (this.currentSession?.id === id) {
      this.currentSession = null;
    }
    return this.storage.delete(`session:${id}`);
  }

  /**
   * 生成 ID
   */
  private generateId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
```

## 4. 依赖注入

### 4.1 容器实现

```typescript
// src/base/di/container.ts

// 服务工厂类型
type Factory<T> = () => T;

// 依赖容器
export class Container {
  private factories = new Map<string, Factory<any>>();
  private instances = new Map<string, any>();

  /**
   * 注册服务工厂
   */
  register<T>(name: string, factory: Factory<T>): void {
    this.factories.set(name, factory);
  }

  /**
   * 注册单例
   */
  registerSingleton<T>(name: string, factory: Factory<T>): void {
    this.factories.set(name, () => {
      if (!this.instances.has(name)) {
        this.instances.set(name, factory());
      }
      return this.instances.get(name);
    });
  }

  /**
   * 获取服务
   */
  get<T>(name: string): T {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Service not found: ${name}`);
    }
    return factory();
  }

  /**
   * 检查服务是否存在
   */
  has(name: string): boolean {
    return this.factories.has(name);
  }
}
```

### 4.2 服务注册

```typescript
// src/index.ts
import { Container } from './base/di/container';
import { AIProvider } from './services/providers/interface';
import { OpenAIProvider } from './services/providers/openai';
import { AnthropicProvider } from './services/providers/anthropic';
import { ToolRegistry } from './services/tools/registry';
import { FileStorage } from './services/storage/file';
import { SessionManager } from './core/session';
import { AgentRunner } from './core/agent';
import { HookManager } from './core/hooks';
import { loadConfig } from './services/config/loader';

// 创建容器
export function createContainer(config: AppConfig): Container {
  const container = new Container();

  // 注册配置
  container.registerSingleton('config', () => config);

  // 注册 Provider
  container.registerSingleton('provider', () => {
    const { provider: providerConfig } = config;

    switch (providerConfig.type) {
      case 'openai':
        return new OpenAIProvider(providerConfig);
      case 'anthropic':
        return new AnthropicProvider(providerConfig);
      default:
        throw new Error(`Unknown provider: ${providerConfig.type}`);
    }
  });

  // 注册工具注册表
  container.registerSingleton('toolRegistry', () => new ToolRegistry());

  // 注册存储
  container.registerSingleton('storage', () => {
    return new FileStorage(config.storage.path);
  });

  // 注册会话管理器
  container.registerSingleton('sessionManager', (c) => {
    return new SessionManager(c.get('storage'));
  });

  // 注册钩子管理器
  container.registerSingleton('hookManager', () => new HookManager());

  // 注册 Agent
  container.registerSingleton('agent', (c) => {
    return new AgentRunner(
      c.get<AIProvider>('provider'),
      c.get('toolRegistry'),
      {
        maxIterations: config.agent.maxIterations,
        systemPrompt: config.agent.systemPrompt,
      }
    );
  });

  return container;
}

// 应用入口
export async function main() {
  // 加载配置
  const config = await loadConfig();

  // 创建容器
  const container = createContainer(config);

  // 启动 CLI
  const cli = new CLI(container);
  await cli.start();
}
```

## 5. 扩展点设计

### 5.1 Provider 扩展

```typescript
// src/services/providers/interface.ts

// Provider 工厂函数类型
export type ProviderFactory = (config: any) => IAIProvider;

// Provider 注册表
export class ProviderRegistry {
  private factories = new Map<string, ProviderFactory>();

  /**
   * 注册 Provider
   */
  register(name: string, factory: ProviderFactory): void {
    this.factories.set(name, factory);
  }

  /**
   * 创建 Provider
   */
  create(name: string, config: any): IAIProvider {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Unknown provider: ${name}`);
    }
    return factory(config);
  }
}

// 使用示例：添加自定义 Provider
const registry = new ProviderRegistry();

// 注册内置 Provider
registry.register('openai', (config) => new OpenAIProvider(config));
registry.register('anthropic', (config) => new AnthropicProvider(config));

// 用户可以注册自定义 Provider
registry.register('custom', (config) => new CustomProvider(config));
```

### 5.2 Tool 扩展

```typescript
// src/services/tools/registry.ts

// 工具模块接口
export interface ToolModule {
  name: string;
  version: string;
  tools: Tool[];
  initialize?: () => Promise<void>;
  cleanup?: () => Promise<void>;
}

// 工具注册表
export class ToolRegistry implements IToolRegistry {
  private tools = new Map<string, Tool>();
  private modules = new Map<string, ToolModule>();

  /**
   * 注册单个工具
   */
  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * 注册工具模块
   */
  async registerModule(module: ToolModule): Promise<void> {
    if (module.initialize) {
      await module.initialize();
    }

    for (const tool of module.tools) {
      this.tools.set(tool.name, tool);
    }

    this.modules.set(module.name, module);
  }

  /**
   * 获取工具
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * 列出所有工具
   */
  list(): Tool[] {
    return Array.from(this.tools.values());
  }
}
```

### 5.3 Skill 扩展

```typescript
// src/core/skills/interface.ts

// 技能接口
export interface ISkill {
  name: string;
  description: string;
  triggers: SkillTrigger[];
  execute(context: SkillContext): Promise<SkillResult>;
}

// 技能注册表
export class SkillRegistry {
  private skills = new Map<string, ISkill>();

  /**
   * 注册技能
   */
  register(skill: ISkill): void {
    this.skills.set(skill.name, skill);
  }

  /**
   * 从文件加载技能
   */
  async loadFromFile(path: string): Promise<void> {
    const module = await import(path);
    if (module.default && this.isSkill(module.default)) {
      this.register(module.default);
    }
  }

  /**
   * 检查是否是有效技能
   */
  private isSkill(obj: any): obj is ISkill {
    return (
      typeof obj.name === 'string' &&
      typeof obj.description === 'string' &&
      Array.isArray(obj.triggers) &&
      typeof obj.execute === 'function'
    );
  }
}
```

## 参数说明

### AppConfig 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `provider` | ProviderConfig | AI 提供者配置 |
| `tools` | ToolsConfig | 工具配置 |
| `agent` | AgentConfig | Agent 配置 |
| `storage` | StorageConfig | 存储配置 |
| `ui` | UIConfig | UI 配置 |

### AgentConfig 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `maxIterations` | number | 最大迭代次数 |
| `systemPrompt` | string | 系统提示 |
| `model` | string | 模型名称 |

### Session 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 会话 ID |
| `title` | string | 标题 |
| `messages` | Message[] | 消息列表 |
| `createdAt` | number | 创建时间 |
| `updatedAt` | number | 更新时间 |

## 练习题

### 练习 1: 实现模块加载器

```typescript
// exercises/01-module-loader.ts
// TODO: 实现动态模块加载器
// 要求：
// 1. 扫描指定目录
// 2. 自动加载模块
// 3. 处理依赖关系

export class ModuleLoader {
  // TODO: 实现
}
```

### 练习 2: 实现事件总线

```typescript
// exercises/02-event-bus.ts
// TODO: 实现跨模块事件通信
// 要求：
// 1. 发布/订阅模式
// 2. 类型安全的事件
// 3. 支持异步处理

export class EventBus {
  // TODO: 实现
}
```

### 练习 3: 实现插件系统

```typescript
// exercises/03-plugin-system.ts
// TODO: 实现插件系统
// 要求：
// 1. 定义插件接口
// 2. 支持插件生命周期
// 3. 隔离插件执行

export class PluginSystem {
  // TODO: 实现
}
```

### 练习 4: 实现配置热更新

```typescript
// exercises/04-hot-reload.ts
// TODO: 实现配置热更新
// 要求：
// 1. 监听配置文件变化
// 2. 重新加载配置
// 3. 通知相关服务

export class ConfigHotReloader {
  // TODO: 实现
}
```

## 下一步

完成本节后，继续学习 [8.2 代码整合和重构](./02-integration.md) →
