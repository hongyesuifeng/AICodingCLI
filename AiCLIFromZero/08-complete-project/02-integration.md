# 8.2 代码整合和重构

## 学习目标

掌握模块整合、依赖注入、配置加载和初始化流程的实现。

## 1. 入口文件设计

### 1.1 CLI 入口

```typescript
// src/bin.ts
#!/usr/bin/env node
import { Command } from 'commander';
import { main } from './index';
import { version } from '../package.json';

const program = new Command();

program
  .name('minicode')
  .description('AI-powered coding CLI assistant')
  .version(version);

// 默认命令：启动交互模式
program
  .argument('[input]', 'Initial input to process')
  .option('-m, --model <model>', 'AI model to use')
  .option('-p, --provider <provider>', 'AI provider (openai, anthropic)')
  .option('-c, --config <path>', 'Path to config file')
  .option('--no-stream', 'Disable streaming output')
  .action(async (input, options) => {
    await main({
      input,
      model: options.model,
      provider: options.provider,
      configPath: options.config,
      stream: options.stream !== false,
    });
  });

// chat 命令
program
  .command('chat [message]')
  .description('Start an interactive chat session')
  .option('-s, --session <id>', 'Continue an existing session')
  .action(async (message, options) => {
    await main({
      input: message,
      sessionId: options.session,
      interactive: true,
    });
  });

// ask 命令
program
  .command('ask <question>')
  .description('Ask a single question and exit')
  .option('-m, --model <model>', 'AI model to use')
  .action(async (question, options) => {
    await main({
      input: question,
      model: options.model,
      interactive: false,
    });
  });

// config 命令
program
  .command('config')
  .description('Manage configuration')
  .command('init')
  .description('Initialize configuration file')
  .action(async () => {
    const { initConfig } = await import('./cli/commands/config');
    await initConfig();
  });

program.parse();
```

### 1.2 主入口

```typescript
// src/index.ts
import { Container } from './base/di/container';
import { loadConfig, AppConfig } from './services/config/loader';
import { registerServices } from './services';
import { registerCore } from './core';
import { CLI } from './cli';

// 应用选项
export interface AppOptions {
  input?: string;
  model?: string;
  provider?: string;
  configPath?: string;
  sessionId?: string;
  interactive?: boolean;
  stream?: boolean;
}

// 主函数
export async function main(options: AppOptions = {}): Promise<void> {
  try {
    // 1. 加载配置
    const config = await loadConfig(options.configPath);

    // 2. 应用命令行选项覆盖
    applyOptions(config, options);

    // 3. 创建依赖容器
    const container = createContainer(config);

    // 4. 注册服务
    registerServices(container);
    registerCore(container);

    // 5. 初始化服务
    await initializeServices(container);

    // 6. 启动 CLI
    const cli = new CLI(container, {
      initialInput: options.input,
      sessionId: options.sessionId,
      interactive: options.interactive !== false,
    });

    await cli.start();
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// 应用选项覆盖
function applyOptions(config: AppConfig, options: AppOptions): void {
  if (options.model) {
    config.provider.model = options.model;
  }
  if (options.provider) {
    config.provider.type = options.provider;
  }
  if (options.stream !== undefined) {
    config.ui.streaming = options.stream;
  }
}

// 创建容器
function createContainer(config: AppConfig): Container {
  const container = new Container();

  // 注册配置
  container.registerSingleton('config', () => config);

  return container;
}

// 初始化服务
async function initializeServices(container: Container): Promise<void> {
  // 初始化存储
  const storage = container.get('storage');
  if (storage.initialize) {
    await storage.initialize();
  }

  // 加载内置工具
  const toolRegistry = container.get('toolRegistry');
  const builtinTools = container.get('builtinTools');
  for (const tool of builtinTools) {
    toolRegistry.register(tool);
  }

  // 加载钩子配置
  const hookManager = container.get('hookManager');
  const hooks = container.get('hooks');
  for (const hook of hooks) {
    hookManager.register(hook);
  }
}
```

## 2. 配置加载

### 2.1 配置定义

```typescript
// src/services/config/types.ts

// 完整配置
export interface AppConfig {
  // 提供者配置
  provider: ProviderConfig;

  // 工具配置
  tools: ToolsConfig;

  // Agent 配置
  agent: AgentConfig;

  // 存储配置
  storage: StorageConfig;

  // UI 配置
  ui: UIConfig;

  // 钩子配置
  hooks: HookConfig[];
}

// Provider 配置
export interface ProviderConfig {
  type: 'openai' | 'anthropic' | 'local';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  timeout?: number;
}

// 工具配置
export interface ToolsConfig {
  enabled: string[];
  disabled: string[];
  permissions: Record<string, string[]>;
}

// Agent 配置
export interface AgentConfig {
  maxIterations: number;
  systemPrompt?: string;
}

// 存储配置
export interface StorageConfig {
  type: 'memory' | 'file' | 'sqlite';
  path?: string;
}

// UI 配置
export interface UIConfig {
  theme: 'default' | 'dark' | 'light';
  streaming: boolean;
  showTokens: boolean;
}

// 钩子配置
export interface HookConfig {
  name: string;
  event: string;
  enabled: boolean;
  config?: Record<string, any>;
}

// 默认配置
export const DEFAULT_CONFIG: AppConfig = {
  provider: {
    type: 'openai',
    model: 'gpt-4-turbo',
  },
  tools: {
    enabled: ['read_file', 'write_file', 'list_directory', 'execute_command'],
    disabled: [],
    permissions: {},
  },
  agent: {
    maxIterations: 10,
    systemPrompt: 'You are a helpful AI coding assistant.',
  },
  storage: {
    type: 'file',
    path: './.minicode',
  },
  ui: {
    theme: 'default',
    streaming: true,
    showTokens: true,
  },
  hooks: [],
};
```

### 2.2 配置加载器

```typescript
// src/services/config/loader.ts
import * as fs from 'fs';
import * as path from 'path';
import { AppConfig, DEFAULT_CONFIG } from './types';

// 配置文件名
const CONFIG_FILES = [
  '.minicode.json',
  '.minicode.yaml',
  'minicode.config.json',
  'minicode.config.yaml',
];

// 加载配置
export async function loadConfig(configPath?: string): Promise<AppConfig> {
  let config = { ...DEFAULT_CONFIG };

  // 查找配置文件
  const configFile = configPath || findConfigFile();

  if (configFile) {
    try {
      const fileContent = fs.readFileSync(configFile, 'utf-8');
      const fileConfig = configFile.endsWith('.yaml')
        ? parseYaml(fileContent)
        : JSON.parse(fileContent);

      config = deepMerge(config, fileConfig);
    } catch (error: any) {
      console.warn(`Failed to load config file: ${error.message}`);
    }
  }

  // 加载环境变量覆盖
  config = applyEnvOverrides(config);

  return config;
}

// 查找配置文件
function findConfigFile(): string | null {
  for (const file of CONFIG_FILES) {
    if (fs.existsSync(file)) {
      return file;
    }
  }
  return null;
}

// 应用环境变量覆盖
function applyEnvOverrides(config: AppConfig): AppConfig {
  const env = process.env;

  // Provider 配置
  if (env.OPENAI_API_KEY) {
    config.provider.apiKey = env.OPENAI_API_KEY;
  }
  if (env.ANTHROPIC_API_KEY && config.provider.type === 'anthropic') {
    config.provider.apiKey = env.ANTHROPIC_API_KEY;
  }
  if (env.MINICODE_MODEL) {
    config.provider.model = env.MINICODE_MODEL;
  }
  if (env.MINICODE_PROVIDER) {
    config.provider.type = env.MINICODE_PROVIDER as any;
  }

  return config;
}

// 深度合并
function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key])
      ) {
        result[key] = deepMerge(result[key], source[key] as any);
      } else {
        result[key] = source[key] as any;
      }
    }
  }

  return result;
}

// 解析 YAML（简化实现）
function parseYaml(content: string): any {
  // 实际项目应使用 js-yaml 库
  // 这里仅作示例
  throw new Error('YAML parsing not implemented');
}

// 保存配置
export async function saveConfig(config: AppConfig, configPath?: string): Promise<void> {
  const file = configPath || '.minicode.json';
  const content = JSON.stringify(config, null, 2);
  await fs.promises.writeFile(file, content, 'utf-8');
}
```

## 3. 服务注册

### 3.1 服务层注册

```typescript
// src/services/index.ts
import { Container } from '../base/di/container';
import { AppConfig } from './config/types';

// 注册所有服务
export function registerServices(container: Container): void {
  registerProviders(container);
  registerTools(container);
  registerStorage(container);
  registerHooks(container);
}

// 注册 Provider
function registerProviders(container: Container): void {
  const config = container.get<AppConfig>('config');

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
}

// 注册工具
function registerTools(container: Container): void {
  const config = container.get<AppConfig>('config');

  container.registerSingleton('toolRegistry', () => {
    return new ToolRegistry();
  });

  container.registerSingleton('builtinTools', () => {
    return createBuiltinTools(config.tools.permissions);
  });
}

// 注册存储
function registerStorage(container: Container): void {
  const config = container.get<AppConfig>('config');

  container.registerSingleton('storage', () => {
    switch (config.storage.type) {
      case 'memory':
        return new MemoryStorage();
      case 'file':
        return new FileStorage(config.storage.path || './.minicode/data');
      case 'sqlite':
        return new SQLiteStorage(config.storage.path || './.minicode/data.db');
      default:
        throw new Error(`Unknown storage type: ${config.storage.type}`);
    }
  });
}

// 注册钩子
function registerHooks(container: Container): void {
  const config = container.get<AppConfig>('config');

  container.registerSingleton('hooks', () => {
    return config.hooks
      .filter(h => h.enabled)
      .map(h => createHook(h));
  });
}

// 创建内置工具
function createBuiltinTools(permissions: Record<string, string[]>): Tool[] {
  const tools: Tool[] = [];

  // 文件操作工具
  tools.push(createReadFileTool(permissions['read_file']));
  tools.push(createWriteFileTool(permissions['write_file']));
  tools.push(createListDirectoryTool(permissions['list_directory']));

  // 命令执行工具
  tools.push(createExecuteCommandTool(permissions['execute_command']));

  return tools;
}

// 创建钩子
function createHook(config: HookConfig): HookDefinition {
  const factories: Record<string, () => HookDefinition> = {
    logging: () => createLoggingHook(config.config),
    'input-validation': () => createValidationHook(config.config),
    'sensitive-filter': () => createSensitiveFilterHook(),
    performance: () => createPerformanceHook(),
  };

  const factory = factories[config.name];
  if (!factory) {
    throw new Error(`Unknown hook: ${config.name}`);
  }

  return factory();
}
```

### 3.2 核心层注册

```typescript
// src/core/index.ts
import { Container } from '../base/di/container';
import { AppConfig } from '../services/config/types';

// 注册核心模块
export function registerCore(container: Container): void {
  registerSession(container);
  registerAgent(container);
  registerSkills(container);
  registerHookManager(container);
}

// 注册会话管理器
function registerSession(container: Container): void {
  container.registerSingleton('sessionManager', (c) => {
    const storage = c.get('storage');
    return new SessionManager(storage);
  });
}

// 注册 Agent
function registerAgent(container: Container): void {
  const config = container.get<AppConfig>('config');

  container.registerSingleton('agent', (c) => {
    return new AgentRunner(
      c.get('provider'),
      c.get('toolRegistry'),
      {
        maxIterations: config.agent.maxIterations,
        systemPrompt: config.agent.systemPrompt,
      }
    );
  });
}

// 注册技能
function registerSkills(container: Container): void {
  container.registerSingleton('skillRegistry', () => {
    const registry = new SkillRegistry();

    // 注册内置技能
    registry.registerAll([
      new CommitSkill(),
      new ExplainSkill(),
      new ReviewSkill(),
      new TestSkill(),
    ]);

    return registry;
  });
}

// 注册钩子管理器
function registerHookManager(container: Container): void {
  container.registerSingleton('hookManager', () => {
    return new HookManager();
  });
}
```

## 4. CLI 实现

### 4.1 CLI 类

```typescript
// src/cli/index.ts
import { Container } from '../base/di/container';
import { AgentRunner } from '../core/agent';
import { SessionManager } from '../core/session';
import { SkillRegistry } from '../core/skills';
import { HookManager } from '../core/hooks';
import { CommandRegistry } from './commands';
import { REPL } from './repl';
import { AppConfig } from '../services/config/types';

// CLI 选项
export interface CLIOptions {
  initialInput?: string;
  sessionId?: string;
  interactive?: boolean;
}

// CLI 主类
export class CLI {
  private agent: AgentRunner;
  private sessionManager: SessionManager;
  private skillRegistry: SkillRegistry;
  private hookManager: HookManager;
  private commandRegistry: CommandRegistry;
  private config: AppConfig;

  constructor(
    private container: Container,
    private options: CLIOptions = {}
  ) {
    this.agent = container.get('agent');
    this.sessionManager = container.get('sessionManager');
    this.skillRegistry = container.get('skillRegistry');
    this.hookManager = container.get('hookManager');
    this.config = container.get('config');

    this.commandRegistry = new CommandRegistry(container);
  }

  /**
   * 启动 CLI
   */
  async start(): Promise<void> {
    // 加载或创建会话
    if (this.options.sessionId) {
      await this.sessionManager.loadSession(this.options.sessionId);
    } else {
      await this.sessionManager.createSession();
    }

    // 触发会话开始钩子
    await this.hookManager.trigger('onSessionStart', {
      sessionId: this.sessionManager.getCurrentSession()?.id,
    });

    // 如果有初始输入，先处理
    if (this.options.initialInput) {
      await this.processInput(this.options.initialInput);
    }

    // 启动交互模式
    if (this.options.interactive !== false) {
      await this.startInteractive();
    }
  }

  /**
   * 处理输入
   */
  async processInput(input: string): Promise<string> {
    // 触发输入前钩子
    const preResult = await this.hookManager.trigger('preInput', {
      input: { rawInput: input },
    });

    if (!preResult.proceed) {
      return preResult.error || 'Input rejected';
    }

    const processedInput = preResult.modifiedInput?.rawInput || input;

    // 检查是否是命令
    if (processedInput.startsWith('/')) {
      return this.handleCommand(processedInput);
    }

    // 检查是否触发技能
    const skill = this.skillRegistry.match(processedInput, this.getSkillContext());
    if (skill) {
      const result = await skill.execute(this.getSkillContext());
      return result.output;
    }

    // 调用 Agent
    let response: string;
    if (this.config.ui.streaming) {
      response = '';
      for await (const chunk of this.agent.runStream(processedInput)) {
        response += chunk;
        process.stdout.write(chunk);
      }
      console.log();
    } else {
      response = await this.agent.run(processedInput);
      console.log(response);
    }

    // 触发响应后钩子
    await this.hookManager.trigger('postResponse', {
      output: { content: response },
    });

    // 保存会话
    await this.sessionManager.addMessage({ role: 'user', content: processedInput });
    await this.sessionManager.addMessage({ role: 'assistant', content: response });

    return response;
  }

  /**
   * 处理命令
   */
  private async handleCommand(input: string): Promise<string> {
    try {
      await this.commandRegistry.execute(input, this);
      return '';
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  }

  /**
   * 启动交互模式
   */
  private async startInteractive(): Promise<void> {
    const repl = new REPL({
      prompt: 'minicode> ',
      handler: async (input) => {
        return this.processInput(input);
      },
    });

    await repl.start();
  }

  /**
   * 获取技能上下文
   */
  private getSkillContext(): SkillContext {
    return {
      input: '',
      cwd: process.cwd(),
      config: this.config,
      provider: this.container.get('provider'),
      sessionHistory: this.sessionManager.getCurrentSession()?.messages || [],
    };
  }
}
```

## 5. 初始化流程

### 5.1 启动时序

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          启动时序图                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   1. 加载配置                                                               │
│      └── loadConfig()                                                       │
│          ├── 查找配置文件                                                   │
│          ├── 合并默认配置                                                   │
│          └── 应用环境变量                                                   │
│                                                                             │
│   2. 创建容器                                                               │
│      └── createContainer()                                                  │
│          └── 注册配置单例                                                   │
│                                                                             │
│   3. 注册服务                                                               │
│      └── registerServices()                                                 │
│          ├── registerProviders()                                            │
│          ├── registerTools()                                                │
│          ├── registerStorage()                                              │
│          └── registerHooks()                                                │
│                                                                             │
│   4. 注册核心                                                               │
│      └── registerCore()                                                     │
│          ├── registerSession()                                              │
│          ├── registerAgent()                                                │
│          └── registerSkills()                                               │
│                                                                             │
│   5. 初始化服务                                                             │
│      └── initializeServices()                                               │
│          ├── 初始化存储                                                     │
│          ├── 加载内置工具                                                   │
│          └── 加载钩子配置                                                   │
│                                                                             │
│   6. 启动 CLI                                                               │
│      └── CLI.start()                                                        │
│          ├── 加载/创建会话                                                  │
│          ├── 处理初始输入                                                   │
│          └── 启动交互模式                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 练习题

### 练习 1: 实现配置验证

```typescript
// exercises/01-config-validator.ts
// TODO: 实现配置验证器
// 要求：
// 1. 验证配置结构
// 2. 检查必需字段
// 3. 提供友好错误提示

export class ConfigValidator {
  // TODO: 实现
  validate(config: any): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }
}
```

### 练习 2: 实现服务健康检查

```typescript
// exercises/02-health-check.ts
// TODO: 实现服务健康检查
// 要求：
// 1. 检查各服务状态
// 2. 验证配置是否有效
// 3. 测试 API 连接

export class HealthChecker {
  // TODO: 实现
  async check(): Promise<HealthStatus> {
    return { healthy: true };
  }
}
```

### 练习 3: 实现优雅关闭

```typescript
// exercises/03-graceful-shutdown.ts
// TODO: 实现优雅关闭
// 要求：
// 1. 保存当前状态
// 2. 关闭所有服务
// 3. 处理进行中的请求

export class GracefulShutdown {
  // TODO: 实现
  register(): void {}
  shutdown(): Promise<void> { return Promise.resolve(); }
}
```

### 练习 4: 实现依赖图

```typescript
// exercises/04-dependency-graph.ts
// TODO: 实现服务依赖图
// 要求：
// 1. 分析服务依赖
// 2. 按依赖顺序初始化
// 3. 检测循环依赖

export class DependencyGraph {
  // TODO: 实现
  addService(name: string, dependencies: string[]): void {}
  getInitializationOrder(): string[] { return []; }
}
```

## 下一步

完成本节后，继续学习 [8.3 测试和调试](./03-testing.md) →
