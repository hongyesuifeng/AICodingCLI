# 7.3 钩子系统 (Hooks)

## 学习目标

理解钩子事件类型、钩子注册机制、执行时机和配置格式。

## 1. 钩子系统概述

### 1.1 什么是钩子？

钩子（Hook）是在特定事件发生时执行的回调函数，允许在关键节点插入自定义逻辑：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          钩子执行流程                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   用户输入 ──▶ [pre-input] ──▶ 处理 ──▶ [post-process] ──▶ AI 调用          │
│                                                      │                      │
│                                                      ▼                      │
│   返回用户 ◀── [post-response] ◀── 格式化 ◀── [pre-response] ◀── AI 返回    │
│                                                                             │
│   可用钩子：                                                                 │
│   • preInput      - 用户输入前                                               │
│   • postInput     - 用户输入后                                               │
│   • preToolCall   - 工具调用前                                               │
│   • postToolCall  - 工具调用后                                               │
│   • preResponse   - AI 响应前                                                │
│   • postResponse  - AI 响应后                                                │
│   • onError       - 发生错误时                                               │
│   • onSessionEnd  - 会话结束时                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 钩子的用途

| 用途 | 示例 |
|------|------|
| 日志记录 | 记录所有请求和响应 |
| 输入验证 | 检查用户输入 |
| 权限控制 | 限制某些操作 |
| 内容过滤 | 过滤敏感信息 |
| 性能监控 | 记录执行时间 |
| 自动化 | 自动执行某些动作 |

## 2. 钩子类型定义

### 2.1 事件类型

```typescript
// src/hooks/types.ts

// 钩子事件类型
export type HookEvent =
  | 'preInput'        // 用户输入前
  | 'postInput'       // 用户输入后（处理后）
  | 'preToolCall'     // 工具调用前
  | 'postToolCall'    // 工具调用后
  | 'preResponse'     // AI 响应返回前
  | 'postResponse'    // AI 响应返回后
  | 'onError'         // 发生错误时
  | 'onSessionStart'  // 会话开始
  | 'onSessionEnd'    // 会话结束
  | 'onFileRead'      // 文件读取时
  | 'onFileWrite'     // 文件写入时
  | 'onCommandExec';  // 命令执行时

// 钩子上下文
export interface HookContext {
  // 事件名称
  event: HookEvent;

  // 时间戳
  timestamp: number;

  // 会话 ID
  sessionId?: string;

  // 输入数据
  input?: any;

  // 输出数据
  output?: any;

  // 错误信息
  error?: Error;

  // 元数据
  metadata?: Record<string, any>;
}

// 钩子结果
export interface HookResult {
  // 是否继续执行
  proceed: boolean;

  // 修改后的数据
  modifiedInput?: any;
  modifiedOutput?: any;

  // 错误信息（用于中断）
  error?: string;
}

// 钩子函数类型
export type HookFunction = (context: HookContext) => Promise<HookResult> | HookResult;

// 钩子定义
export interface HookDefinition {
  // 钩子名称
  name: string;

  // 监听的事件
  event: HookEvent;

  // 钩子函数
  handler: HookFunction;

  // 优先级（数字越大越先执行）
  priority?: number;

  // 是否异步（不阻塞主流程）
  async?: boolean;

  // 是否启用
  enabled?: boolean;
}
```

### 2.2 预定义上下文结构

```typescript
// src/hooks/contexts.ts

// 用户输入上下文
export interface PreInputContext extends HookContext {
  event: 'preInput';
  input: {
    rawInput: string;     // 原始输入
    cwd: string;          // 当前目录
  };
}

// 工具调用上下文
export interface ToolCallContext extends HookContext {
  event: 'preToolCall' | 'postToolCall';
  input: {
    toolName: string;
    arguments: Record<string, any>;
  };
  output?: {
    result: string;
    isError: boolean;
  };
}

// AI 响应上下文
export interface ResponseContext extends HookContext {
  event: 'preResponse' | 'postResponse';
  input: {
    messages: any[];
    model: string;
  };
  output?: {
    content: string;
    toolCalls?: any[];
    usage?: {
      promptTokens: number;
      completionTokens: number;
    };
  };
}
```

## 3. 钩子管理器

### 3.1 钩子注册表

```typescript
// src/hooks/hook-manager.ts
import {
  HookEvent,
  HookDefinition,
  HookFunction,
  HookContext,
  HookResult,
} from './types.js';

// 钩子管理器
export class HookManager {
  private hooks = new Map<HookEvent, HookDefinition[]>();

  /**
   * 注册钩子
   */
  register(definition: HookDefinition): void {
    const { event } = definition;

    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }

    const hooks = this.hooks.get(event)!;
    hooks.push(definition);

    // 按优先级排序
    hooks.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /**
   * 简化注册方式
   */
  on(event: HookEvent, handler: HookFunction, options?: Partial<HookDefinition>): void {
    this.register({
      name: options?.name || `hook-${Date.now()}`,
      event,
      handler,
      ...options,
    });
  }

  /**
   * 移除钩子
   */
  remove(name: string): boolean {
    for (const [event, hooks] of this.hooks) {
      const index = hooks.findIndex(h => h.name === name);
      if (index >= 0) {
        hooks.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * 触发钩子
   */
  async trigger(event: HookEvent, context: Omit<HookContext, 'event' | 'timestamp'>): Promise<HookResult> {
    const hooks = this.hooks.get(event) || [];
    const fullContext: HookContext = {
      ...context,
      event,
      timestamp: Date.now(),
    };

    let currentContext = { ...fullContext };
    const result: HookResult = { proceed: true };

    for (const hook of hooks) {
      // 跳过禁用的钩子
      if (hook.enabled === false) continue;

      try {
        if (hook.async) {
          // 异步执行，不等待
          hook.handler(currentContext).catch(err => {
            console.error(`Async hook ${hook.name} error:`, err);
          });
        } else {
          // 同步执行
          const hookResult = await hook.handler(currentContext);

          // 检查是否中断
          if (!hookResult.proceed) {
            return hookResult;
          }

          // 更新上下文
          if (hookResult.modifiedInput !== undefined) {
            currentContext.input = hookResult.modifiedInput;
            result.modifiedInput = hookResult.modifiedInput;
          }

          if (hookResult.modifiedOutput !== undefined) {
            currentContext.output = hookResult.modifiedOutput;
            result.modifiedOutput = hookResult.modifiedOutput;
          }
        }
      } catch (error: any) {
        console.error(`Hook ${hook.name} error:`, error);

        // 错误时可以选择继续或中断
        if (hook.priority && hook.priority >= 100) {
          return {
            proceed: false,
            error: `Hook ${hook.name} failed: ${error.message}`,
          };
        }
      }
    }

    return result;
  }

  /**
   * 获取某事件的所有钩子
   */
  getHooks(event: HookEvent): HookDefinition[] {
    return this.hooks.get(event) || [];
  }

  /**
   * 清除所有钩子
   */
  clear(): void {
    this.hooks.clear();
  }
}
```

## 4. 内置钩子

### 4.1 日志钩子

```typescript
// src/hooks/builtin/logging-hook.ts
import { HookDefinition, HookContext, HookResult } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';

// 日志钩子
export function createLoggingHook(logDir: string): HookDefinition {
  const logFile = path.join(logDir, 'hooks.log');

  return {
    name: 'logging',
    event: 'postResponse',
    priority: 0,
    async: true, // 异步执行，不阻塞

    handler: async (context: HookContext): Promise<HookResult> => {
      const logEntry = {
        timestamp: new Date(context.timestamp).toISOString(),
        event: context.event,
        input: context.input?.messages?.slice(-1)?.[0]?.content?.slice(0, 100),
        output: context.output?.content?.slice(0, 100),
        usage: context.output?.usage,
      };

      const logLine = JSON.stringify(logEntry) + '\n';

      // 确保目录存在
      fs.mkdirSync(logDir, { recursive: true });
      fs.appendFileSync(logFile, logLine);

      return { proceed: true };
    },
  };
}
```

### 4.2 输入验证钩子

```typescript
// src/hooks/builtin/validation-hook.ts
import { HookDefinition, HookContext, HookResult } from '../types.js';

// 输入验证钩子
export function createValidationHook(
  options: {
    maxLength?: number;
    forbiddenPatterns?: RegExp[];
  } = {}
): HookDefinition {
  return {
    name: 'input-validation',
    event: 'preInput',
    priority: 100, // 高优先级

    handler: async (context: HookContext): Promise<HookResult> => {
      const input = context.input?.rawInput || '';

      // 长度检查
      if (options.maxLength && input.length > options.maxLength) {
        return {
          proceed: false,
          error: `Input too long. Maximum ${options.maxLength} characters.`,
        };
      }

      // 模式检查
      for (const pattern of options.forbiddenPatterns || []) {
        if (pattern.test(input)) {
          return {
            proceed: false,
            error: 'Input contains forbidden content.',
          };
        }
      }

      return { proceed: true };
    },
  };
}
```

### 4.3 性能监控钩子

```typescript
// src/hooks/builtin/performance-hook.ts
import { HookDefinition, HookContext, HookResult } from '../types.js';

// 性能监控钩子
export function createPerformanceHook(): HookDefinition[] {
  const timings = new Map<string, number>();

  return [
    {
      name: 'performance-start',
      event: 'preResponse',
      priority: 0,

      handler: async (context: HookContext): Promise<HookResult> => {
        timings.set(context.sessionId || 'default', Date.now());
        return { proceed: true };
      },
    },
    {
      name: 'performance-end',
      event: 'postResponse',
      priority: 0,

      handler: async (context: HookContext): Promise<HookResult> => {
        const startTime = timings.get(context.sessionId || 'default') || Date.now();
        const duration = Date.now() - startTime;

        console.log(`[Performance] Response time: ${duration}ms`);

        if (context.output?.usage) {
          const { promptTokens, completionTokens } = context.output.usage;
          console.log(`[Performance] Tokens: ${promptTokens} prompt + ${completionTokens} completion`);
        }

        return { proceed: true };
      },
    },
  ];
}
```

### 4.4 敏感信息过滤钩子

```typescript
// src/hooks/builtin/sensitive-filter-hook.ts
import { HookDefinition, HookContext, HookResult } from '../types.js';

// 敏感信息模式
const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{48}/g,                          // OpenAI API Key
  /sk-ant-[a-zA-Z0-9-]{80,}/g,                   // Anthropic API Key
  /[a-f0-9]{32}/gi,                               // 可能的密钥
  /password\s*=\s*['"][^'"]+['"]/gi,             // 密码
  /api[_-]?key\s*=\s*['"][^'"]+['"]/gi,          // API Key
];

// 敏感信息过滤钩子
export function createSensitiveFilterHook(): HookDefinition {
  return {
    name: 'sensitive-filter',
    event: 'postResponse',
    priority: 50,

    handler: async (context: HookContext): Promise<HookResult> => {
      let content = context.output?.content || '';
      let modified = false;

      for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(content)) {
          content = content.replace(pattern, '[REDACTED]');
          modified = true;
        }
      }

      if (modified) {
        return {
          proceed: true,
          modifiedOutput: {
            ...context.output,
            content,
          },
        };
      }

      return { proceed: true };
    },
  };
}
```

## 5. 配置格式

### 5.1 配置文件格式

```json
// .ai-cli/hooks.json
{
  "hooks": [
    {
      "name": "logging",
      "event": "postResponse",
      "enabled": true,
      "priority": 0,
      "async": true,
      "config": {
        "logDir": "./logs"
      }
    },
    {
      "name": "input-validation",
      "event": "preInput",
      "enabled": true,
      "priority": 100,
      "config": {
        "maxLength": 10000,
        "forbiddenPatterns": ["rm -rf", "DROP TABLE"]
      }
    },
    {
      "name": "performance",
      "event": "postResponse",
      "enabled": true,
      "async": true
    }
  ]
}
```

### 5.2 配置加载器

```typescript
// src/hooks/config-loader.ts
import { HookManager } from './hook-manager.js';
import { HookDefinition, HookEvent } from './types.js';
import * as fs from 'fs';

// 钩子配置
interface HookConfig {
  name: string;
  event: HookEvent;
  enabled?: boolean;
  priority?: number;
  async?: boolean;
  config?: Record<string, any>;
}

// 钩子配置文件
interface HooksConfigFile {
  hooks: HookConfig[];
}

// 内置钩子工厂
const BUILTIN_HOOKS: Record<string, (config: any) => HookDefinition> = {
  logging: createLoggingHook,
  'input-validation': createValidationHook,
  'sensitive-filter': createSensitiveFilterHook,
};

// 从配置加载钩子
export function loadHooksFromConfig(
  manager: HookManager,
  configPath: string
): void {
  if (!fs.existsSync(configPath)) {
    return;
  }

  const config: HooksConfigFile = JSON.parse(
    fs.readFileSync(configPath, 'utf-8')
  );

  for (const hookConfig of config.hooks) {
    if (hookConfig.enabled === false) continue;

    // 查找内置钩子
    const factory = BUILTIN_HOOKS[hookConfig.name];
    if (factory) {
      const definition = factory(hookConfig.config || {});
      definition.priority = hookConfig.priority ?? definition.priority;
      definition.async = hookConfig.async ?? definition.async;
      manager.register(definition);
    } else {
      console.warn(`Unknown hook: ${hookConfig.name}`);
    }
  }
}
```

## 6. 钩子使用示例

### 6.1 集成到 CLI

```typescript
// src/cli/hooks-integration.ts
import { HookManager } from '../hooks/hook-manager.js';
import { AIProvider } from '../providers/base.js';

export class CLIWithHooks {
  private hookManager: HookManager;

  constructor(
    private provider: AIProvider,
    hooks: HookDefinition[] = []
  ) {
    this.hookManager = new HookManager();

    // 注册钩子
    for (const hook of hooks) {
      this.hookManager.register(hook);
    }
  }

  async processInput(input: string): Promise<string> {
    // 触发 preInput 钩子
    const preResult = await this.hookManager.trigger('preInput', {
      input: { rawInput: input, cwd: process.cwd() },
    });

    if (!preResult.proceed) {
      return `Error: ${preResult.error}`;
    }

    // 使用可能的修改后的输入
    const processedInput = preResult.modifiedInput?.rawInput || input;

    // 调用 AI
    const response = await this.provider.chat([
      { role: 'user', content: processedInput },
    ]);

    // 触发 postResponse 钩子
    const postResult = await this.hookManager.trigger('postResponse', {
      input: { messages: [{ role: 'user', content: processedInput }], model: 'default' },
      output: {
        content: response.content,
        usage: response.usage,
      },
    });

    return postResult.modifiedOutput?.content || response.content;
  }
}
```

## 参数说明

### HookDefinition 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | ✓ | 钩子名称 |
| `event` | HookEvent | ✓ | 监听事件 |
| `handler` | function | ✓ | 处理函数 |
| `priority` | number | - | 优先级 |
| `async` | boolean | - | 是否异步 |
| `enabled` | boolean | - | 是否启用 |

### HookContext 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `event` | string | 事件名称 |
| `timestamp` | number | 时间戳 |
| `sessionId` | string | 会话 ID |
| `input` | any | 输入数据 |
| `output` | any | 输出数据 |
| `error` | Error | 错误信息 |
| `metadata` | object | 元数据 |

### HookResult 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `proceed` | boolean | 是否继续 |
| `modifiedInput` | any | 修改后的输入 |
| `modifiedOutput` | any | 修改后的输出 |
| `error` | string | 错误信息 |

## 练习题

### 练习 1: 实现缓存钩子

```typescript
// exercises/01-cache-hook.ts
// TODO: 实现响应缓存钩子
// 要求：
// 1. 缓存相同输入的响应
// 2. 可配置缓存过期时间
// 3. 支持手动清除缓存

export function createCacheHook(): HookDefinition {
  // TODO: 实现
}
```

### 练习 2: 实现限流钩子

```typescript
// exercises/02-rate-limit-hook.ts
// TODO: 实现请求限流钩子
// 要求：
// 1. 限制每分钟请求数
// 2. 超限时返回友好提示
// 3. 支持滑动窗口

export function createRateLimitHook(): HookDefinition {
  // TODO: 实现
}
```

### 练习 3: 实现通知钩子

```typescript
// exercises/03-notification-hook.ts
// TODO: 实现事件通知钩子
// 要求：
// 1. 发送桌面通知
// 2. 支持自定义通知内容
// 3. 可配置触发条件

export function createNotificationHook(): HookDefinition {
  // TODO: 实现
}
```

### 练习 4: 实现钩子链

```typescript
// exercises/04-hook-chain.ts
// TODO: 实现可配置的钩子执行链
// 要求：
// 1. 定义执行顺序
// 2. 支持条件跳过
// 3. 支持错误恢复

export class HookChain {
  // TODO: 实现
}
```

## 下一步

完成本节后，继续学习 [7.4 Git 集成](./04-git-integration.md) →
