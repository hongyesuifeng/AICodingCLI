# 第07章：高级功能

> 实现 MCP 协议、技能系统等高级特性

## 学习目标

完成本章后，你将能够：

1. 理解 MCP (Model Context Protocol) 协议
2. 实现技能系统 (Skills)
3. 构建钩子系统 (Hooks)
4. 集成 Git 操作

## 章节内容

- [7.1 MCP 协议](./01-mcp-protocol.md)
- [7.2 技能系统](./02-skill-system.md)
- [7.3 钩子系统](./03-hook-system.md)
- [7.4 Git 集成](./04-git-integration.md)

## MCP 协议架构

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          MCP 协议架构                                       │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   ┌───────────────────────────────────────────────────────────────────┐  │
│   │                        MCP Client (CLI)                           │  │
│   │                                                                   │  │
│   │  • 发现工具和资源                                                │  │
│   │  • 调用工具                                                      │  │
│   │  • 读取资源                                                      │  │
│   └───────────────────────────────┬───────────────────────────────────┘  │
│                                   │ JSON-RPC                             │
│                                   ▼                                       │
│   ┌───────────────────────────────────────────────────────────────────┐  │
│   │                        MCP Server                                 │  │
│   │                                                                   │  │
│   │  工具列表:                                                        │  │
│   │  ├── read_file                                                   │  │
│   │  ├── write_file                                                  │  │
│   │  ├── execute_command                                             │  │
│   │  └── search_code                                                 │  │
│   │                                                                   │  │
│   │  资源列表:                                                        │  │
│   │  ├── file://path/to/file                                         │  │
│   │  └── git://commit/hash                                           │  │
│   └───────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

## MCP 服务器实现

```typescript
// src/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export class MCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'mini-cli-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // 工具列表
    this.server.setRequestHandler(
      ListToolsRequestSchema,
      async () => ({
        tools: [
          {
            name: 'read_file',
            description: 'Read file contents',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string' },
              },
              required: ['path'],
            },
          },
          {
            name: 'write_file',
            description: 'Write file contents',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                content: { type: 'string' },
              },
              required: ['path', 'content'],
            },
          },
        ],
      })
    );

    // 工具调用
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request) => {
        const { name, arguments: args } = request.params;

        switch (name) {
          case 'read_file':
            return await this.readFile(args.path);
          case 'write_file':
            return await this.writeFile(args.path, args.content);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      }
    );
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  private async readFile(path: string) {
    const content = await fs.readFile(path, 'utf-8');
    return { content: [{ type: 'text', text: content }] };
  }

  private async writeFile(path: string, content: string) {
    await fs.writeFile(path, content, 'utf-8');
    return { content: [{ type: 'text', text: 'File written successfully' }] };
  }
}
```

## 技能系统

```typescript
// src/skills/skill.ts

// 技能定义
export interface Skill {
  name: string;
  description: string;
  trigger: string | RegExp;
  handler: (context: SkillContext) => Promise<void>;
}

// 技能上下文
export interface SkillContext {
  args: string;
  session: SessionManager;
  provider: AIProvider;
  output: (text: string) => void;
}

// 内置技能
export const builtInSkills: Skill[] = [
  {
    name: 'code-review',
    description: 'Review code changes',
    trigger: '/review',
    handler: async (ctx) => {
      // 获取 git diff
      const diff = await execGit('diff HEAD');

      // 发送给 AI 审查
      const response = await ctx.provider.chat([
        {
          role: 'system',
          content: 'You are a code reviewer. Analyze the following diff...',
        },
        { role: 'user', content: diff },
      ]);

      ctx.output(response.content);
    },
  },
  {
    name: 'test-gen',
    description: 'Generate tests for current file',
    trigger: '/test',
    handler: async (ctx) => {
      // 实现测试生成逻辑
    },
  },
  {
    name: 'commit',
    description: 'Generate and create a commit',
    trigger: '/commit',
    handler: async (ctx) => {
      // 生成 commit message
      const diff = await execGit('diff --staged');
      const message = await ctx.provider.chat([
        { role: 'user', content: `Generate a commit message for:\n${diff}` },
      ]);

      // 创建 commit
      await execGit(`commit -m "${message.content}"`);
      ctx.output('Commit created!');
    },
  },
];
```

## 钩子系统

```typescript
// src/hooks/hooks.ts

// 钩子类型
export type HookEvent =
  | 'user-prompt-submit'
  | 'pre-tool-use'
  | 'post-tool-use'
  | 'notification'
  | 'stop';

// 钩子定义
export interface Hook {
  event: HookEvent;
  matcher?: string | RegExp;
  command: string;
  timeout?: number;
}

// 钩子管理器
export class HookManager {
  private hooks: Hook[] = [];

  register(hook: Hook): void {
    this.hooks.push(hook);
  }

  async trigger(
    event: HookEvent,
    context: Record<string, any>
  ): Promise<void> {
    const matchingHooks = this.hooks.filter(
      (h) => h.event === event && this.matches(h.matcher, context)
    );

    for (const hook of matchingHooks) {
      await this.executeHook(hook, context);
    }
  }

  private matches(
    matcher: string | RegExp | undefined,
    context: Record<string, any>
  ): boolean {
    if (!matcher) return true;
    if (typeof matcher === 'string') {
      return context.toolName === matcher;
    }
    return matcher.test(JSON.stringify(context));
  }

  private async executeHook(
    hook: Hook,
    context: Record<string, any>
  ): Promise<void> {
    // 替换变量
    let command = hook.command;
    for (const [key, value] of Object.entries(context)) {
      command = command.replace(`{{${key}}}`, String(value));
    }

    // 执行命令
    await exec(command, { timeout: hook.timeout });
  }
}

// 配置示例
const hooks: Hook[] = [
  {
    event: 'post-tool-use',
    matcher: 'Write',
    command: 'prettier --write {{file_path}}',
  },
  {
    event: 'post-tool-use',
    matcher: 'Write',
    command: 'eslint --fix {{file_path}}',
  },
];
```

## Git 集成

```typescript
// src/git/git.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitManager {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  // 获取仓库状态
  async status(): Promise<GitStatus> {
    const { stdout } = await execAsync('git status --porcelain', {
      cwd: this.cwd,
    });

    return this.parseStatus(stdout);
  }

  // 获取差异
  async diff(ref?: string): Promise<string> {
    const cmd = ref ? `git diff ${ref}` : 'git diff';
    const { stdout } = await execAsync(cmd, { cwd: this.cwd });
    return stdout;
  }

  // 获取暂存的差异
  async diffStaged(): Promise<string> {
    const { stdout } = await execAsync('git diff --staged', {
      cwd: this.cwd,
    });
    return stdout;
  }

  // 添加文件
  async add(files: string[]): Promise<void> {
    const fileStr = files.map((f) => `"${f}"`).join(' ');
    await execAsync(`git add ${fileStr}`, { cwd: this.cwd });
  }

  // 提交
  async commit(message: string): Promise<void> {
    await execAsync(`git commit -m "${message}"`, { cwd: this.cwd });
  }

  // 获取日志
  async log(count: number = 10): Promise<GitLogEntry[]> {
    const { stdout } = await execAsync(
      `git log --oneline -n ${count}`,
      { cwd: this.cwd }
    );

    return stdout.split('\n').map((line) => {
      const [hash, ...messageParts] = line.split(' ');
      return { hash, message: messageParts.join(' ') };
    });
  }
}
```

## 学习检验

完成本章后，你应该能够：

- [ ] 实现 MCP 服务器
- [ ] 设计可扩展的技能系统
- [ ] 实现事件驱动的钩子系统
- [ ] 集成 Git 操作

## 下一步

开始学习 [7.1 MCP 协议](./01-mcp-protocol.md) →
