// src/index.ts
// Mini AI CLI 主入口
// 加载环境变量（必须在其他导入之前）
import 'dotenv/config';

import { Command } from 'commander';
import chalk from 'chalk';
import process from 'node:process';

// Providers
import { MiniMaxProvider } from './providers/minimax.js';
import { OpenAIProvider } from './providers/openai.js';
import { ProviderRegistry } from './providers/registry.js';

// Managers
import { ModelManager } from './managers/model-manager.js';
import { SessionManager } from './managers/session-manager.js';

// Terminal
import { StreamRenderer } from './terminal/stream-renderer.js';

// Types
import { type Message } from './types/message.js';

// Tools
import { createBuiltInTools } from './tools/built-in.js';
import { ToolExecutor } from './tools/executor.js';
import { ToolRegistry } from './tools/registry.js';
import { ToolManager } from './tools/tool-manager.js';

// Storage
import { MemoryStorage } from './storage/memory-storage.js';

// Config
import {
  resolveModel,
  MODEL_ALIASES,
  MODELS,
  loadConfig,
} from './config/loader.js';

// Skills (新增)
import { createDefaultSkillRegistry, SkillRegistry } from './skills/index.js';

// Hooks (新增)
import { HookManager, createPerformanceHook, createSensitiveFilterHook } from './hooks/index.js';

// Git (新增)
import { GitCommands, GitStatusParser, CommitMessageGenerator } from './git/index.js';

// MCP (新增)
import { MCPServer, MCPClient, FileSystemMCPServer } from './mcp/index.js';

interface ModelOption {
  model: string;
}

interface SessionOption {
  session?: string;
  save?: boolean;
}

const program = new Command();
const config = loadConfig();
const registry = new ProviderRegistry();

// 注册 providers
registry.register('openai', (providerConfig) => new OpenAIProvider(providerConfig));
registry.register('minimax', (providerConfig) => new MiniMaxProvider(providerConfig));

// 初始化模型管理器
const modelManager = new ModelManager(
  config.ai.defaultModel || 'MiniMax-M2.5',
  { registry }
);

// 初始化流式渲染器
const streamRenderer = new StreamRenderer();

// 初始化工具系统
const toolRegistry = new ToolRegistry();
const toolExecutor = new ToolExecutor(toolRegistry, {
  cwd: process.cwd(),
});
toolRegistry.registerAll(createBuiltInTools(toolExecutor));
const toolManager = new ToolManager(toolRegistry, toolExecutor);

// 初始化会话管理器
const sessionManager = new SessionManager({
  defaultModel: config.ai.defaultModel || 'MiniMax-M2.5',
  maxContextTokens: 4000,
  storage: new MemoryStorage(),
});

// 初始化技能系统 (新增)
const skillRegistry = createDefaultSkillRegistry();

// 初始化钩子系统 (新增)
const hookManager = new HookManager();

// 注册性能监控钩子
const performanceHooks = createPerformanceHook({ logToConsole: false });
for (const hook of performanceHooks) {
  hookManager.register(hook);
}

// 注册敏感信息过滤钩子
hookManager.register(createSensitiveFilterHook({ logFiltered: false }));

async function runConversation(
  model: string,
  messages: Message[]
): Promise<{ fullResponse: string; messages: Message[] }> {
  const provider = modelManager.getProvider(model);

  // 触发 preResponse 钩子
  await hookManager.trigger('preResponse', {
    sessionId: sessionManager.getSessionId() ?? undefined,
    input: { messages, model },
  });

  let result: { fullResponse: string; messages: Message[] };

  if (provider.capabilities().tools) {
    const toolResult = await toolManager.runConversation(provider, messages);
    process.stdout.write(chalk.cyan('AI: '));
    process.stdout.write(toolResult.content);
    process.stdout.write('\n\n');
    result = {
      fullResponse: toolResult.content,
      messages: toolResult.messages,
    };
  } else {
    const fullResponse = await streamRenderer.render(provider.stream(messages));
    result = {
      fullResponse,
      messages: [...messages, { role: 'assistant', content: fullResponse }],
    };
  }

  // 触发 postResponse 钩子
  const hookResult = await hookManager.trigger('postResponse', {
    sessionId: sessionManager.getSessionId() ?? undefined,
    input: { messages, model },
    output: {
      content: result.fullResponse,
      usage: { promptTokens: 0, completionTokens: 0 },
    },
  });

  // 如果钩子修改了输出
  if (hookResult.modifiedOutput?.content) {
    result.fullResponse = hookResult.modifiedOutput.content;
    result.messages[result.messages.length - 1].content = hookResult.modifiedOutput.content;
  }

  return result;
}

// 处理技能命令
async function handleSkillCommand(
  input: string,
  context: { cwd: string; provider: any }
): Promise<boolean> {
  if (!skillRegistry.isSkillCommand(input)) {
    return false;
  }

  const skillContext = {
    input,
    cwd: context.cwd,
    config: {},
    provider: context.provider,
    output: (text: string) => console.log(chalk.cyan(text)),
    sessionHistory: sessionManager.getMessagesForAPI().map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    })),
  };

  const result = await skillRegistry.execute(input, skillContext);

  if (result) {
    if (result.success) {
      console.log(chalk.green('\n' + result.output));
    } else {
      console.log(chalk.red('\n' + result.output));
    }
    return true;
  }

  return false;
}

program
  .name('mini-cli')
  .description('Mini AI Coding CLI - 支持 MiniMax 模型，集成 MCP/Skills/Hooks/Git')
  .version('1.0.0');

// 交互式聊天命令
program
  .command('chat')
  .description('Start interactive chat with AI')
  .option('-m, --model <model>', 'AI model to use', config.ai.defaultModel || 'MiniMax-M2.5')
  .option('-s, --session <id>', 'Resume session with given ID')
  .action(async (options: ModelOption & SessionOption) => {
    try {
      const model = resolveModel(options.model);

      // 创建或加载会话
      if (options.session) {
        const loaded = await sessionManager.loadSession(options.session);
        if (!loaded) {
          console.log(chalk.yellow(`Session ${options.session} not found, creating new session`));
          await sessionManager.createSession();
        }
      } else {
        await sessionManager.createSession();
      }

      sessionManager.setModel(model);

      // 触发会话开始钩子
      await hookManager.trigger('onSessionStart', {
        sessionId: sessionManager.getSessionId() || undefined,
      });

      console.log(chalk.blue(`Starting chat with model: ${model}`));
      console.log(chalk.gray(`Session ID: ${sessionManager.getSessionId()}`));
      console.log(chalk.gray('Type "exit" or "quit" to end the chat.'));
      console.log(chalk.gray('Type "stats" to see session statistics.'));
      console.log(chalk.gray('Type /help to see available skills.\n'));

      // 简单的 REPL 循环
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const askQuestion = (query: string): Promise<string> => {
        return new Promise((resolve) => rl.question(query, resolve));
      };

      const provider = modelManager.getProvider(model);

      while (true) {
        const userInput = await askQuestion(chalk.green('You: '));

        if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
          // 触发会话结束钩子
          await hookManager.trigger('onSessionEnd', {
            sessionId: sessionManager.getSessionId() ?? undefined,
          });

          console.log(chalk.gray('\nGoodbye!'));
          console.log(chalk.gray(`Session: ${sessionManager.formatSessionInfo()}`));
          rl.close();
          break;
        }

        if (userInput.toLowerCase() === 'stats') {
          console.log(chalk.blue('\nSession Statistics:'));
          console.log(sessionManager.formatSessionInfo());
          console.log();
          continue;
        }

        if (!userInput.trim()) {
          continue;
        }

        // 检查是否是技能命令
        const isSkill = await handleSkillCommand(userInput, {
          cwd: process.cwd(),
          provider: {
            chat: async (messages: Message[]) => {
              const result = await provider.chat(messages);
              return { content: result.content };
            },
          },
        });

        if (isSkill) {
          console.log();
          continue;
        }

        // 添加用户消息
        await sessionManager.addMessage({ role: 'user', content: userInput });

        // 获取用于 API 的消息（可能被截断）
        const messages = sessionManager.getMessagesForAPI();

        // 流式输出响应
        try {
          const result = await runConversation(model, messages);

          // 更新会话
          for (const msg of result.messages.slice(messages.length)) {
            await sessionManager.addMessage(msg);
          }
        } catch (error: any) {
          console.error(chalk.red(`\nError: ${error.message}\n`));

          // 触发错误钩子
          await hookManager.trigger('onError', {
            sessionId: sessionManager.getSessionId() ?? undefined,
            error,
            input: userInput,
          });
        }
      }
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// 单次问答命令
program
  .command('ask <prompt>')
  .description('Ask a single question to AI')
  .option('-m, --model <model>', 'AI model to use', config.ai.defaultModel || 'MiniMax-M2.5')
  .action(async (prompt: string, options: ModelOption) => {
    try {
      const model = resolveModel(options.model);
      const messages: Message[] = [
        { role: 'user', content: prompt },
      ];

      await runConversation(model, messages);
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Git Commit 生成命令 (新增)
program
  .command('commit')
  .description('Generate and create a Git commit message using AI')
  .option('--no-verify', 'Skip pre-commit hooks', false)
  .option('--dry-run', 'Only show the generated message, do not commit', false)
  .action(async (options: { noVerify: boolean; dryRun: boolean }) => {
    try {
      const model = config.ai.defaultModel || 'MiniMax-M2.5';
      const provider = modelManager.getProvider(model);

      const generator = new CommitMessageGenerator(
        {
          chat: async (messages: Array<{ role: string; content: string }>) => {
            const result = await provider.chat(messages as Message[]);
            return { content: result.content };
          },
        },
        process.cwd()
      );

      const message = await generator.generate();

      console.log(chalk.blue('\nGenerated commit message:'));
      console.log(chalk.green(`  ${message}\n`));

      if (options.dryRun) {
        console.log(chalk.gray('Dry run - not committing.'));
        return;
      }

      const result = await generator.commit(message, { noVerify: options.noVerify });
      console.log(chalk.green('Committed successfully!'));
      console.log(result);
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Git 状态命令 (新增)
program
  .command('git-status')
  .description('Show Git repository status')
  .action(async () => {
    try {
      const parser = new GitStatusParser(process.cwd());
      const status = await parser.getStatus();
      console.log(parser.formatStatus(status));
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// 技能列表命令 (新增)
program
  .command('skills')
  .description('List all available skills')
  .action(() => {
    console.log(chalk.blue('Available skills:\n'));
    const skills = skillRegistry.list();

    for (const skill of skills) {
      console.log(chalk.green(`  /${skill.name}`));
      console.log(chalk.gray(`    ${skill.description}`));
    }

    console.log(chalk.gray('\nUse /help <skill-name> in chat for more details.'));
  });

// 模型列表命令
program
  .command('models')
  .description('List all available models')
  .action(() => {
    console.log(chalk.blue('Available models:\n'));

    const grouped = new Map<string, [string, typeof MODELS[string]][]>();

    for (const [name, caps] of Object.entries(MODELS)) {
      if (!grouped.has(caps.provider)) {
        grouped.set(caps.provider, []);
      }
      grouped.get(caps.provider)!.push([name, caps]);
    }

    for (const [provider, providerModels] of grouped) {
      console.log(chalk.yellow(`${provider}:`));
      for (const [name, caps] of providerModels) {
        console.log(`  ${name}`);
        console.log(chalk.gray(`    Context: ${caps.contextWindow.toLocaleString()} tokens`));
        console.log(chalk.gray(`    Thinking: ${caps.supportsThinking ? 'Yes' : 'No'}`));
        console.log(chalk.gray(`    Price: $${caps.inputPrice}/$${caps.outputPrice} per 1M tokens`));
      }
      console.log();
    }

    // 显示别名
    console.log(chalk.blue('Model aliases:'));
    for (const [alias, model] of Object.entries(MODEL_ALIASES)) {
      console.log(`  ${alias} → ${model}`);
    }
  });

// 显示当前配置
program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    console.log(chalk.blue('Current configuration:\n'));
    console.log(`  Default model: ${config.ai.defaultModel}`);
    console.log(`  OpenAI API Key: ${config.ai.openaiApiKey ? '***' + config.ai.openaiApiKey.slice(-4) : 'Not set'}`);
    console.log(`  MiniMax API Key: ${config.ai.minimaxApiKey ? '***' + config.ai.minimaxApiKey.slice(-4) : 'Not set'}`);
    console.log();
    console.log(chalk.gray('Set OPENAI_API_KEY or MINIMAX_API_KEY environment variables to configure your API key.'));
  });

// 会话列表命令
program
  .command('sessions')
  .description('List all saved sessions')
  .action(async () => {
    try {
      const sessions = await sessionManager.listSessions();
      if (sessions.length === 0) {
        console.log(chalk.yellow('No sessions found.'));
        return;
      }

      console.log(chalk.blue('Saved sessions:\n'));
      for (const session of sessions) {
        const date = new Date(session.updatedAt).toLocaleString();
        console.log(`  ${chalk.green(session.id)}`);
        console.log(chalk.gray(`    Messages: ${session.messageCount}`));
        console.log(chalk.gray(`    Updated: ${date}`));
        console.log();
      }
    } catch (error: any) {
      console.error(chalk.red(`Error: ${error.message}`));
    }
  });

// 导出模块 (供外部使用)
export {
  // MCP
  MCPServer,
  MCPClient,
  FileSystemMCPServer,
  // Skills
  skillRegistry,
  SkillRegistry,
  createDefaultSkillRegistry,
  // Hooks
  hookManager,
  HookManager,
  // Git
  GitCommands,
  GitStatusParser,
  CommitMessageGenerator,
  // Managers
  modelManager,
  sessionManager,
  toolManager,
};

program.parse();
