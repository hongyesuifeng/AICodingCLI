# Google Gemini CLI 技术文档

## 概述

Gemini CLI 是 Google 开发的多模型 AI 编程助手，采用纯 TypeScript 实现，注重可扩展性和开发者体验。

| 属性 | 描述 |
|------|------|
| **开发者** | Google |
| **核心定位** | 可扩展的多模型 AI 助手 |
| **主要语言** | TypeScript |
| **运行时** | Node.js 20+ |
| **包管理** | pnpm |

---

## 系统架构

```
┌────────────────────────────────────────────────────────────────────┐
│                      Gemini CLI 系统架构                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐    │
│  │   CLI 层    │───▶│  核心引擎   │───▶│   AI 模型层         │    │
│  │   (Ink)     │    │  (Core)     │    │   (多模型支持)      │    │
│  └─────────────┘    └──────┬──────┘    └─────────────────────┘    │
│                            │                                       │
│         ┌──────────────────┼──────────────────┐                   │
│         ▼                  ▼                  ▼                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐           │
│  │  命令系统   │    │  策略引擎   │    │  遥测系统   │           │
│  │ (.gemini/)  │    │ (策略模板)  │    │(OpenTelemetry)          │
│  └─────────────┘    └─────────────┘    └─────────────┘           │
│                                                                    │
│  ┌─────────────┐    ┌─────────────┐                               │
│  │  DevTools   │    │  A2A Server │                               │
│  │   (React)   │    │ (Agent通信) │                               │
│  └─────────────┘    └─────────────┘                               │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
gemini-cli/
├── packages/
│   ├── cli/                     # 主 CLI 包
│   │   ├── src/index.ts         # 入口文件
│   │   ├── src/commands/        # 命令实现
│   │   │   ├── chat.ts          # 聊天命令
│   │   │   ├── ask.ts           # 问答命令
│   │   │   └── review.ts        # 代码审查
│   │   └── src/ui/              # UI 组件 (Ink)
│   │       ├── ChatInterface.tsx
│   │       └── MessageList.tsx
│   ├── core/                    # 核心库
│   │   ├── src/ai/              # AI 模型集成
│   │   │   ├── providers/       # 模型提供者
│   │   │   ├── chat.ts          # 聊天逻辑
│   │   │   └── stream.ts        # 流式处理
│   │   ├── src/policies/        # 策略定义
│   │   │   ├── read-only.ts
│   │   │   ├── write.ts
│   │   │   └── yolo.ts
│   │   ├── src/tools/           # 工具实现
│   │   │   ├── filesystem.ts
│   │   │   ├── shell.ts
│   │   │   └── git.ts
│   │   └── src/telemetry/       # 遥测
│   │       ├── metrics.ts
│   │       └── tracing.ts
│   ├── a2a-server/              # Agent-to-Agent 服务器
│   │   ├── src/server.ts
│   │   └── src/protocol.ts
│   ├── devtools/                # React 开发工具
│   │   ├── src/App.tsx
│   │   └── src/components/
│   └── test-utils/              # 测试工具
├── .gemini/                     # 配置目录
│   ├── config.json              # 全局配置
│   └── commands/                # 预定义命令
│       ├── core.toml            # 核心命令
│       ├── review-frontend.toml # 前端审查
│       ├── explain.toml         # 代码解释
│       └── test-gen.toml        # 测试生成
├── docs/                        # 文档
└── integration-tests/           # 集成测试
```

---

## 核心技术原理

### 1. 命令系统

Gemini CLI 使用 TOML 文件定义可复用的命令模板：

```toml
# .gemini/commands/review.toml
name = "review"
description = "代码审查命令"
version = "1.0.0"

[[parameters]]
name = "files"
description = "要审查的文件或目录"
type = "string"
required = true
default = "."

[[parameters]]
name = "focus"
description = "审查重点"
type = "enum"
values = ["security", "performance", "style", "all"]
default = "all"

[[tools]]
name = "read_file"
description = "读取文件内容"

[[tools]]
name = "list_files"
description = "列出目录文件"

[prompt]
system = """
你是一位资深代码审查专家，拥有 15 年以上的软件开发经验。
请审查提供的代码，重点关注：
1. 代码质量和可读性
2. 潜在的 bug 和边界情况
3. 性能问题
4. 安全隐患
5. 最佳实践

请用中文输出审查结果。
"""

user = """
请审查以下文件: {{files}}

审查重点: {{focus}}

请按照以下格式输出：
## 概述
[简要描述代码功能]

## 问题列表
| 严重程度 | 位置 | 问题描述 | 建议修复 |
|---------|------|----------|----------|

## 总体建议
[改进建议]
"""
```

**命令模板语法：**

| 语法 | 说明 |
|------|------|
| `{{param}}` | 参数替换 |
| `{{#if condition}}...{{/if}}` | 条件渲染 |
| `{{#each items}}...{{/each}}` | 循环渲染 |
| `{{> partial}}` | 引用局部模板 |

### 2. 策略引擎

策略引擎控制 AI 的执行权限：

```typescript
// packages/core/src/policies/index.ts
export interface Policy {
  name: string;
  description: string;
  permissions: {
    canRead: boolean;
    canWrite: boolean;
    canExecute: boolean;
    canDelete: boolean;
    canAccessNetwork: boolean;
  };
  constraints?: {
    maxFileSize?: number;
    allowedPaths?: string[];
    deniedPaths?: string[];
    allowedCommands?: string[];
  };
}

export const policies: Record<string, Policy> = {
  // 只读策略 - 不修改任何文件
  'read-only': {
    name: 'read-only',
    description: '只读模式，不修改任何文件',
    permissions: {
      canRead: true,
      canWrite: false,
      canExecute: false,
      canDelete: false,
      canAccessNetwork: false,
    },
  },

  // 写入策略 - 允许修改文件
  'write': {
    name: 'write',
    description: '写入模式，允许修改文件',
    permissions: {
      canRead: true,
      canWrite: true,
      canExecute: false,
      canDelete: false,
      canAccessNetwork: false,
    },
    constraints: {
      maxFileSize: 1024 * 1024, // 1MB
      deniedPaths: ['**/.env*', '**/secrets/**'],
    },
  },

  // 完全控制策略
  'yolo': {
    name: 'yolo',
    description: '完全控制模式，允许所有操作',
    permissions: {
      canRead: true,
      canWrite: true,
      canExecute: true,
      canDelete: true,
      canAccessNetwork: true,
    },
  },
};
```

**策略执行器：**

```typescript
// packages/core/src/policies/executor.ts
export class PolicyExecutor {
  constructor(private policy: Policy) {}

  async readFile(path: string): Promise<string> {
    this.checkPermission('canRead');
    this.checkPath(path);
    return fs.readFile(path, 'utf-8');
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.checkPermission('canWrite');
    this.checkPath(path);
    this.checkFileSize(content);

    await fs.writeFile(path, content);
    this.recordAction('write', path);
  }

  async execute(command: string): Promise<Output> {
    this.checkPermission('canExecute');
    this.checkCommand(command);

    return exec(command);
  }

  private checkPermission(perm: keyof Policy['permissions']): void {
    if (!this.policy.permissions[perm]) {
      throw new PolicyError(`Permission denied: ${perm}`);
    }
  }
}
```

### 3. 多模型支持

```typescript
// packages/core/src/ai/providers/index.ts
export interface AIProvider {
  name: string;
  generate(prompt: string, options?: GenerateOptions): Promise<string>;
  stream(prompt: string, options?: GenerateOptions): AsyncIterator<string>;
  countTokens(text: string): number;
}

export interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

// Google Gemini 实现
export class GeminiProvider implements AIProvider {
  name = 'google-gemini';

  constructor(private apiKey: string) {}

  async generate(prompt: string, options?: GenerateOptions): Promise<string> {
    const model = options?.model || 'gemini-pro';
    const genAI = new GoogleGenerativeAI(this.apiKey);

    const result = await genAI.getGenerativeModel({ model }).generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature,
        maxOutputTokens: options?.maxTokens,
      },
    });

    return result.response.text();
  }

  async *stream(prompt: string, options?: GenerateOptions): AsyncIterator<string> {
    const model = options?.model || 'gemini-pro';
    const genAI = new GoogleGenerativeAI(this.apiKey);

    const result = await genAI.getGenerativeModel({ model }).generateContentStream({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    for await (const chunk of result.stream) {
      yield chunk.text();
    }
  }
}

// 模型工厂
export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.type) {
    case 'google':
      return new GeminiProvider(config.apiKey);
    case 'anthropic':
      return new AnthropicProvider(config.apiKey);
    case 'openai':
      return new OpenAIProvider(config.apiKey);
    default:
      throw new Error(`Unknown provider: ${config.type}`);
  }
}
```

### 4. 遥测系统 (OpenTelemetry)

```typescript
// packages/core/src/telemetry/index.ts
import { trace, metrics, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('gemini-cli', '1.0.0');
const meter = metrics.getMeter('gemini-cli', '1.0.0');

// 计数器
const commandCounter = meter.createCounter('commands_executed', {
  description: 'Number of commands executed',
});

const tokenCounter = meter.createCounter('tokens_used', {
  description: 'Number of tokens consumed',
});

// 直方图
const latencyHistogram = meter.createHistogram('command_latency', {
  description: 'Command execution latency',
  unit: 'ms',
});

// 追踪命令执行
export async function tracedCommand<T>(
  commandName: string,
  fn: () => Promise<T>
): Promise<T> {
  const span = tracer.startSpan(`command.${commandName}`);
  const startTime = Date.now();

  try {
    const result = await fn();

    span.setStatus({ code: SpanStatusCode.OK });
    commandCounter.add(1, { command: commandName, status: 'success' });

    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });

    commandCounter.add(1, { command: commandName, status: 'error' });
    throw error;
  } finally {
    latencyHistogram.record(Date.now() - startTime, { command: commandName });
    span.end();
  }
}

// 追踪 AI 调用
export async function tracedAICall<T>(
  provider: string,
  model: string,
  fn: () => Promise<T>
): Promise<T> {
  const span = tracer.startSpan(`ai.${provider}.${model}`);

  try {
    const result = await fn();
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}
```

### 5. DevTools (React)

```tsx
// packages/devtools/src/App.tsx
import React from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { MessageList } from './components/MessageList';
import { SessionPanel } from './components/SessionPanel';

export function DevToolsApp() {
  const { messages, sessions, sendMessage } = useWebSocket('ws://localhost:8080');
  const [activeSession, setActiveSession] = useState<string | null>(null);

  return (
    <div className="app">
      <aside className="sidebar">
        <SessionPanel
          sessions={sessions}
          activeSession={activeSession}
          onSelect={setActiveSession}
        />
      </aside>

      <main className="main">
        <MessageList messages={messages} />

        <ChatInput onSend={(msg) => sendMessage(activeSession, msg)} />
      </main>

      <aside className="panel">
        <MetricsPanel />
        <ToolsPanel />
      </aside>
    </div>
  );
}
```

### 6. A2A Server (Agent-to-Agent)

```typescript
// packages/a2a-server/src/server.ts
import { WebSocketServer, WebSocket } from 'ws';

interface Agent {
  id: string;
  name: string;
  capabilities: string[];
  socket: WebSocket;
}

export class A2AServer {
  private agents: Map<string, Agent> = new Map();
  private wss: WebSocketServer;

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      });
    });
  }

  private handleMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case 'register':
        this.registerAgent(ws, message);
        break;
      case 'request':
        this.handleAgentRequest(message);
        break;
      case 'response':
        this.handleAgentResponse(message);
        break;
    }
  }

  // Agent 间协作
  async collaborate(
    requesterId: string,
    targetCapability: string,
    task: any
  ): Promise<any> {
    // 找到具有目标能力的 Agent
    const target = this.findAgentByCapability(targetCapability);
    if (!target) {
      throw new Error(`No agent with capability: ${targetCapability}`);
    }

    // 发送协作请求
    return new Promise((resolve) => {
      const requestId = crypto.randomUUID();

      target.socket.send(JSON.stringify({
        type: 'request',
        requestId,
        from: requesterId,
        task,
      }));

      // 等待响应
      this.pendingRequests.set(requestId, resolve);
    });
  }
}
```

---

## 关键依赖

```json
{
  "dependencies": {
    "yargs": "^17.7.2",
    "ink": "^4.4.1",
    "react": "^18.2.0",

    "@google/generative-ai": "^0.1.3",
    "@modelcontextprotocol/sdk": "^1.0.0",

    "@opentelemetry/api": "^1.7.0",
    "@opentelemetry/sdk-node": "^0.45.0",
    "@opentelemetry/exporter-trace-otlp-grpc": "^0.45.0",

    "tree-sitter": "^0.20.8",
    "marked": "^9.1.0",
    "node-pty": "^1.0.0",

    "@iarna/toml": "^2.2.5",
    "zod": "^3.22.4",
    "handlebars": "^4.7.8"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0"
  }
}
```

---

## 命令参考

### 基础命令

```bash
# 启动交互式对话
gemini chat

# 单次问答
gemini ask "解释这段代码的作用"

# 代码审查
gemini review ./src

# 代码解释
gemini explain file.ts

# 生成测试
gemini test-gen file.ts
```

### 使用特定策略

```bash
# 只读模式
gemini --policy=read-only chat

# 写入模式
gemini --policy=write chat

# 完全控制模式
gemini --policy=yolo chat
```

### 模型选择

```bash
# 使用 Gemini Pro
gemini --model=gemini-pro chat

# 使用 Gemini Ultra
gemini --model=gemini-ultra chat

# 列出可用模型
gemini models list
```

### DevTools

```bash
# 启动开发工具界面
gemini devtools

# 指定端口
gemini devtools --port 3000
```

### A2A 服务器

```bash
# 启动 Agent 通信服务器
gemini serve --a2a

# 指定端口
gemini serve --a2a --port 9000
```

---

## 配置文件

### 全局配置

```json
// ~/.gemini/config.json
{
  "provider": {
    "type": "google",
    "apiKey": "${GOOGLE_API_KEY}"
  },
  "model": {
    "default": "gemini-pro",
    "fallback": "gemini-pro"
  },
  "policy": {
    "default": "write"
  },
  "telemetry": {
    "enabled": true,
    "endpoint": "http://localhost:4317"
  },
  "ui": {
    "theme": "dark",
    "language": "zh-CN"
  }
}
```

### 项目配置

```json
// .gemini/project.json
{
  "name": "my-project",
  "context": {
    "include": ["src/**/*.ts", "lib/**/*.rs"],
    "exclude": ["node_modules", "target"]
  },
  "commands": {
    "enabled": ["review", "test-gen", "explain"]
  }
}
```

---

## 最佳实践

### 1. 命令模板设计

```toml
# ✅ 推荐：结构化命令
[command]
name = "refactor"
description = "智能重构代码"

[[parameters]]
name = "file"
required = true

[[parameters]]
name = "type"
type = "enum"
values = ["extract-function", "extract-class", "simplify"]
default = "simplify"

[prompt]
system = "你是重构专家..."
user = "重构文件 {{file}}，使用策略：{{type}}"
```

### 2. 策略选择

```typescript
// ✅ 推荐：根据操作类型选择策略
function selectPolicy(operation: string): string {
  switch (operation) {
    case 'read':
    case 'explain':
      return 'read-only';
    case 'write':
    case 'refactor':
      return 'write';
    case 'execute':
      return 'yolo'; // 仅在必要时使用
    default:
      return 'read-only';
  }
}
```

### 3. 遥测配置

```typescript
// ✅ 推荐：完整的遥测配置
const telemetryConfig = {
  enabled: true,
  traces: {
    enabled: true,
    sampler: 'always_on',
    exporter: 'otlp',
  },
  metrics: {
    enabled: true,
    interval: 60000,
  },
  logs: {
    enabled: true,
    level: 'info',
  },
};
```

---

## 学习路线

### 阶段一：基础使用 (1-2 周)

1. 安装和配置 Gemini CLI
2. 掌握基本命令 (chat, ask, review)
3. 理解策略系统
4. 使用预定义命令模板

### 阶段二：进阶功能 (2-4 周)

1. 编写自定义命令模板 (TOML)
2. 理解多模型集成
3. 使用 DevTools 调试
4. 配置 OpenTelemetry 遥测

### 阶段三：高级应用 (4-6 周)

1. A2A 服务器和 Agent 协作
2. 扩展 AI Provider
3. 自定义策略实现
4. 集成测试编写

### 阶段四：源码研读 (持续)

```
推荐阅读顺序：
1. packages/cli/src/index.ts     → 入口点
2. packages/core/src/ai/         → AI 集成
3. packages/core/src/policies/   → 策略引擎
4. .gemini/commands/             → 命令模板
5. packages/a2a-server/          → Agent 通信
```

---

## 参考资源

- [Gemini CLI GitHub](https://github.com/google/gemini-cli)
- [Google Generative AI](https://ai.google.dev/)
- [OpenTelemetry](https://opentelemetry.io/)
- [Ink - React for CLI](https://github.com/vadimdemedes/ink)
- [pnpm Workspace](https://pnpm.io/workspaces)
