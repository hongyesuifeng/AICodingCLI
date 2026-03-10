# OpenCode 技术文档

## 概述

OpenCode 是一个现代化的全栈 AI 开发平台，支持 CLI、Web 和桌面应用，采用 Bun 运行时和 Turbo monorepo 架构。

| 属性 | 描述 |
|------|------|
| **开发者** | Anomaly / SST |
| **核心定位** | 现代化全栈 AI 开发平台 |
| **主要语言** | TypeScript |
| **运行时** | Bun |
| **包管理** | Bun + Turbo |

---

## 系统架构

```
┌────────────────────────────────────────────────────────────────────┐
│                      OpenCode 系统架构                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                        客户端层                               │  │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────────────────────┐  │  │
│  │  │   CLI   │    │   Web   │    │    Desktop (Tauri)      │  │  │
│  │  │  (Bun)  │    │(SolidJS)│    │      (Rust + React)     │  │  │
│  │  └────┬────┘    └────┬────┘    └───────────┬─────────────┘  │  │
│  └───────┼──────────────┼─────────────────────┼────────────────┘  │
│          │              │                     │                    │
│          └──────────────┼─────────────────────┘                    │
│                         │                                          │
│  ┌──────────────────────▼──────────────────────────────────────┐  │
│  │                      服务层 (Hono)                           │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │  Session    │  │   Model     │  │    Workspace        │  │  │
│  │  │  Manager    │  │  Gateway    │  │    Manager          │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                     │
│  ┌───────────────────────────▼──────────────────────────────────┐  │
│  │                    数据层 (Drizzle + SQLite)                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
│  │  │  Sessions   │  │  Messages   │  │    Workspaces       │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
opencode/
├── packages/
│   ├── opencode/               # CLI 核心
│   │   ├── src/index.ts        # 入口
│   │   ├── src/commands/       # 命令实现
│   │   │   ├── chat.ts         # 聊天
│   │   │   ├── session.ts      # 会话管理
│   │   │   └── workspace.ts    # 工作空间
│   │   ├── src/session/        # 会话管理
│   │   │   ├── manager.ts
│   │   │   └── store.ts
│   │   └── src/models/         # 模型集成
│   │       ├── openai.ts
│   │       ├── anthropic.ts
│   │       └── index.ts
│   ├── app/                    # Web 应用
│   │   ├── src/                # SolidJS 前端
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   └── routes/
│   │   ├── vite.config.ts      # Vite 配置
│   │   └── package.json
│   ├── console/                # 控制台应用
│   │   ├── app/                # 前端路由
│   │   │   └── src/routes/     # 页面路由
│   │   │       ├── index.tsx
│   │   │       ├── sessions/
│   │   │       ├── workspaces/
│   │   │       └── settings/
│   │   └── core/               # 后端核心
│   │       ├── src/db/         # Drizzle ORM
│   │       │   ├── schema.ts
│   │       │   └── migrations/
│   │       ├── src/api/        # API 路由
│   │       └── src/services/   # 业务服务
│   ├── desktop/                # Tauri 桌面应用
│   │   ├── src-tauri/          # Rust 后端
│   │   │   ├── src/main.rs
│   │   │   ├── Cargo.toml
│   │   │   └── tauri.conf.json
│   │   └── src/                # React 前端
│   │       ├── App.tsx
│   │       └── components/
│   ├── sdk/                    # JavaScript SDK
│   │   ├── src/client.ts
│   │   └── src/types.ts
│   └── ui/                     # UI 组件库
│       ├── src/components/
│       └── src/styles/
├── turbo.json                  # Turbo 配置
├── bunfig.toml                 # Bun 配置
└── package.json                # 根 package.json
```

---

## 核心技术原理

### 1. Bun 运行时

Bun 是 OpenCode 的核心运行时，提供高性能的 JavaScript/TypeScript 执行环境：

```typescript
// Bun 特有 API
import { file, serve, sql, $ } from 'bun';

// 文件操作 - 极快的文件读取
const text = await file('./input.txt').text();
const json = await file('./data.json').json();
const buffer = await file('./image.png').arrayBuffer();

// 高性能 HTTP 服务器
serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/api/chat') {
      const body = await req.json();
      return Response.json({ reply: 'Hello' });
    }

    return new Response('Not Found', { status: 404 });
  },
});

// 内置 SQLite - 无需额外依赖
const db = sql`
  SELECT * FROM sessions
  WHERE workspace_id = ${workspaceId}
  ORDER BY created_at DESC
`;

// Shell 命令
await $`echo "Hello World"`;
const result = await $`git status`.quiet();
```

**Bun vs Node.js 性能对比：**

| 操作 | Bun | Node.js |
|------|-----|---------|
| 启动时间 | ~5ms | ~100ms |
| 文件读取 | ~50MB/s | ~30MB/s |
| HTTP 请求 | ~50k req/s | ~30k req/s |
| 包安装 | ~2s | ~10s |

### 2. Drizzle ORM

```typescript
// packages/console/core/src/db/schema.ts
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// 工作空间表
export const workspaces = sqliteTable('workspaces', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  path: text('path').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  nameIdx: index('workspace_name_idx').on(table.name),
}));

// 会话表
export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: integer('workspace_id').notNull().references(() => workspaces.id),
  title: text('title'),
  model: text('model').notNull().default('gpt-4'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  workspaceIdx: index('session_workspace_idx').on(table.workspaceId),
}));

// 消息表
export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id').notNull().references(() => sessions.id),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  tokens: integer('tokens'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  sessionIdx: index('message_session_idx').on(table.sessionId),
}));

// 关系定义
export const workspacesRelations = relations(workspaces, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [sessions.workspaceId],
    references: [workspaces.id],
  }),
  messages: many(messages),
}));
```

**数据库操作：**

```typescript
// packages/console/core/src/db/index.ts
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';

const sqlite = new Database('opencode.db');
export const db = drizzle(sqlite, { schema });

// 查询示例
import { eq, desc, and, like } from 'drizzle-orm';

// 创建会话
const session = await db.insert(sessions)
  .values({ workspaceId: 1, title: '新对话' })
  .returning();

// 查询会话及其消息
const sessionWithMessages = await db.query.sessions.findFirst({
  where: eq(sessions.id, 1),
  with: {
    messages: {
      orderBy: desc(messages.createdAt),
    },
  },
});

// 复杂查询
const recentSessions = await db
  .select()
  .from(sessions)
  .where(and(
    eq(sessions.workspaceId, workspaceId),
    like(sessions.title, '%bug%')
  ))
  .orderBy(desc(sessions.updatedAt))
  .limit(10);
```

### 3. SolidJS 响应式

```tsx
// packages/app/src/App.tsx
import { createSignal, createEffect, For, Show, onMount } from 'solid-js';
import { render } from 'solid-js/web';

// 状态管理
const [sessions, setSessions] = createSignal<Session[]>([]);
const [activeSession, setActiveSession] = createSignal<Session | null>(null);
const [messages, setMessages] = createSignal<Message[]>([]);
const [input, setInput] = createSignal('');
const [isLoading, setIsLoading] = createSignal(false);

// 副作用 - 加载会话
onMount(async () => {
  const data = await fetch('/api/sessions').then(r => r.json());
  setSessions(data);
});

// 副作用 - 加载消息
createEffect(() => {
  const session = activeSession();
  if (session) {
    loadMessages(session.id);
  }
});

// 组件
function ChatInterface() {
  let inputRef: HTMLTextAreaElement;

  const sendMessage = async () => {
    if (!input().trim() || isLoading()) return;

    const userMessage = {
      role: 'user' as const,
      content: input(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: activeSession()?.id,
          message: userMessage.content,
        }),
      });

      const data = await response.json();
      setMessages(prev => [...prev, data.message]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div class="chat-container">
      <div class="messages">
        <For each={messages()}>
          {(msg) => (
            <div class={`message ${msg.role}`}>
              {msg.content}
            </div>
          )}
        </For>

        <Show when={isLoading()}>
          <div class="message assistant loading">
            思考中...
          </div>
        </Show>
      </div>

      <div class="input-area">
        <textarea
          ref={inputRef}
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <button onClick={sendMessage} disabled={isLoading()}>
          发送
        </button>
      </div>
    </div>
  );
}
```

### 4. Tauri 桌面应用

```rust
// packages/desktop/src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{command, Manager, Window};
use std::process::Command;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            execute_command,
            get_system_info,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[command]
async fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content)
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[command]
async fn execute_command(cmd: String, args: Vec<String>) -> Result<String, String> {
    let output = Command::new(&cmd)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[command]
async fn get_system_info() -> SystemInfo {
    SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

#[derive(serde::Serialize)]
struct SystemInfo {
    os: String,
    arch: String,
    version: String,
}
```

**前端调用：**

```tsx
// packages/desktop/src/App.tsx
import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/dialog';

async function openFile() {
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Text', extensions: ['txt', 'md', 'json'] }],
  });

  if (selected) {
    const content = await invoke('read_file', { path: selected });
    console.log(content);
  }
}

async function runCommand() {
  const result = await invoke('execute_command', {
    cmd: 'git',
    args: ['status'],
  });
  console.log(result);
}
```

### 5. Hono Web 框架

```typescript
// packages/console/core/src/api/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { stream } from 'hono/streaming';

const app = new Hono();

// 中间件
app.use('*', cors());
app.use('*', logger());

// 会话路由
const sessions = new Hono();

sessions.get('/', async (c) => {
  const workspaceId = c.req.query('workspaceId');
  const list = await db.query.sessions.findMany({
    where: eq(sessions.workspaceId, parseInt(workspaceId)),
    orderBy: desc(sessions.updatedAt),
  });
  return c.json(list);
});

sessions.post('/', async (c) => {
  const body = await c.req.json();
  const session = await db.insert(sessions)
    .values(body)
    .returning();
  return c.json(session[0], 201);
});

sessions.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
  const session = await db.query.sessions.findFirst({
    where: eq(sessions.id, id),
    with: { messages: true },
  });
  return c.json(session);
});

app.route('/api/sessions', sessions);

// 聊天路由 - 流式响应
app.post('/api/chat', async (c) => {
  const { sessionId, message } = await c.req.json();

  // 保存用户消息
  await db.insert(messages).values({
    sessionId,
    role: 'user',
    content: message,
  });

  // 流式响应
  return stream(c, async (stream) => {
    const response = await ai.stream(message);

    let fullContent = '';
    for await (const chunk of response) {
      fullContent += chunk;
      await stream.write(chunk);
    }

    // 保存 AI 响应
    await db.insert(messages).values({
      sessionId,
      role: 'assistant',
      content: fullContent,
    });
  });
});

// 工作空间路由
app.get('/api/workspaces', async (c) => {
  const list = await db.query.workspaces.findMany();
  return c.json(list);
});

export default app;
```

### 6. AI SDK 集成

```typescript
// packages/opencode/src/models/index.ts
import { generateText, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

// 模型配置
const models = {
  'gpt-4': openai('gpt-4-turbo'),
  'gpt-3.5': openai('gpt-3.5-turbo'),
  'claude-3': anthropic('claude-3-opus-20240229'),
  'claude-instant': anthropic('claude-instant-1.2'),
};

// 生成文本
export async function chat(
  model: string,
  messages: Message[],
  options?: ChatOptions
): Promise<string> {
  const result = await generateText({
    model: models[model],
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
  });

  return result.text;
}

// 流式生成
export async function* streamChat(
  model: string,
  messages: Message[]
): AsyncGenerator<string> {
  const result = await streamText({
    model: models[model],
    messages: messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  for await (const chunk of result.textStream) {
    yield chunk;
  }
}

// 带工具调用
export async function chatWithTools(
  model: string,
  messages: Message[],
  tools: Tool[]
): Promise<ChatResult> {
  const result = await generateText({
    model: models[model],
    messages,
    tools: {
      read_file: {
        description: 'Read file content',
        parameters: z.object({
          path: z.string(),
        }),
        execute: async ({ path }) => {
          return await fs.readFile(path, 'utf-8');
        },
      },
    },
  });

  return {
    text: result.text,
    toolCalls: result.toolCalls,
  };
}
```

---

## 关键依赖

```json
{
  "dependencies": {
    "hono": "^4.0.0",
    "solid-js": "^1.8.0",

    "drizzle-orm": "^0.29.0",
    "better-sqlite3": "^9.4.0",

    "ai": "^3.0.0",
    "@ai-sdk/openai": "^0.0.1",
    "@ai-sdk/anthropic": "^0.0.1",

    "tailwindcss": "^4.0.0",

    "yargs": "^17.7.2"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "turbo": "^1.12.0",
    "drizzle-kit": "^0.20.0"
  }
}
```

---

## 命令参考

### CLI 命令

```bash
# 启动交互式对话
opencode chat

# 指定模型
opencode chat --model=gpt-4

# 会话管理
opencode session new           # 创建新会话
opencode session list          # 列出会话
opencode session show <id>     # 查看会话详情

# 工作空间
opencode workspace create      # 创建工作空间
opencode workspace list        # 列出工作空间
opencode workspace switch <id> # 切换工作空间
```

### 开发命令

```bash
# 开发模式
opencode dev

# 构建生产版本
opencode build

# 数据库迁移
opencode db generate           # 生成迁移
opencode db migrate            # 执行迁移
```

### 桌面应用

```bash
# 启动桌面应用
opencode desktop

# 构建 Tauri 应用
opencode desktop build
```

### 云服务

```bash
# 部署到云端
opencode deploy

# 查看日志
opencode logs

# 管理配置
opencode config set key value
```

---

## 配置文件

### Bun 配置

```toml
# bunfig.toml
[install]
auto = "auto"

[run]
bun = true

[test]
coverage = true
```

### Turbo 配置

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

### 应用配置

```typescript
// opencode.config.ts
export default {
  ai: {
    defaultModel: 'gpt-4',
    providers: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
      },
    },
  },
  database: {
    path: './data/opencode.db',
  },
  server: {
    port: 3000,
  },
};
```

---

## 最佳实践

### 1. 响应式状态管理

```tsx
// ✅ 推荐：细粒度响应式
function Component() {
  const [count, setCount] = createSignal(0);
  const [name, setName] = createSignal('');

  // 只在 count 变化时重新计算
  const doubled = createMemo(() => count() * 2);

  // 只在 name 变化时执行
  createEffect(() => {
    console.log('Name changed:', name());
  });

  return (
    <div>
      <p>Count: {count()} (doubled: {doubled()})</p>
      <input value={name()} onInput={e => setName(e.currentTarget.value)} />
    </div>
  );
}
```

### 2. 数据库查询

```typescript
// ✅ 推荐：使用事务
await db.transaction(async (tx) => {
  const session = await tx.insert(sessions)
    .values({ workspaceId, title })
    .returning();

  await tx.insert(messages)
    .values({ sessionId: session[0].id, role: 'user', content });
});
```

### 3. API 设计

```typescript
// ✅ 推荐：RESTful + 流式响应
app.post('/api/chat', async (c) => {
  return stream(c, async (stream) => {
    // 流式响应
  });
});

// ✅ 推荐：错误处理
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});
```

---

## 学习路线

### 阶段一：基础使用 (1-2 周)

1. 安装 Bun 运行时
2. 掌握 OpenCode CLI 基本命令
3. 理解工作空间和会话概念
4. 使用桌面应用

### 阶段二：Web 开发 (2-4 周)

1. 学习 SolidJS 响应式原理
2. 掌握 Hono 框架
3. 理解 Drizzle ORM
4. 开发自定义功能

### 阶段三：桌面应用 (2-4 周)

1. 学习 Tauri 架构
2. Rust 基础
3. 前后端通信
4. 打包和分发

### 阶段四：源码研读 (持续)

```
推荐阅读顺序：
1. packages/opencode/src/        → CLI 核心
2. packages/console/core/        → 后端逻辑
3. packages/console/app/         → Web 前端
4. packages/desktop/src-tauri/   → 桌面应用
5. packages/sdk/                 → SDK
```

---

## 参考资源

- [OpenCode GitHub](https://github.com/sst/opencode)
- [Bun 官方文档](https://bun.sh)
- [SolidJS 文档](https://www.solidjs.com/)
- [Tauri 文档](https://tauri.app)
- [Hono 文档](https://hono.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Vercel AI SDK](https://sdk.vercel.ai/)
