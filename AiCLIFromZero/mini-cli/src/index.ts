// src/index.ts
import { Command } from 'commander';
import chalk from 'chalk';
import process from 'node:process';
import { MiniMaxProvider } from './providers/minimax.js';
import { OpenAIProvider } from './providers/openai.js';
import { ProviderRegistry } from './providers/registry.js';
import { ModelManager } from './managers/model-manager.js';
import { StreamRenderer } from './terminal/stream-renderer.js';
import { type Message } from './types/message.js';
import { createBuiltInTools } from './tools/built-in.js';
import { ToolExecutor } from './tools/executor.js';
import { ToolRegistry } from './tools/registry.js';
import { ToolManager } from './tools/tool-manager.js';
import {
  resolveModel,
  MODEL_ALIASES,
  MODELS,
  loadConfig,
} from './config/loader.js';

interface ModelOption {
  model: string;
}

const program = new Command();
const config = loadConfig();
const registry = new ProviderRegistry();

registry.register('openai', (providerConfig) => new OpenAIProvider(providerConfig));
registry.register('minimax', (providerConfig) => new MiniMaxProvider(providerConfig));

const modelManager = new ModelManager(
  config.ai.defaultModel || 'MiniMax-M2.5',
  { registry }
);
const streamRenderer = new StreamRenderer();
const toolRegistry = new ToolRegistry();
const toolExecutor = new ToolExecutor(toolRegistry, {
  cwd: process.cwd(),
});
toolRegistry.registerAll(createBuiltInTools(toolExecutor));
const toolManager = new ToolManager(toolRegistry, toolExecutor);

async function runConversation(
  model: string,
  messages: Message[]
): Promise<{ fullResponse: string; messages: Message[] }> {
  const provider = modelManager.getProvider(model);

  if (provider.capabilities().tools) {
    const result = await toolManager.runConversation(provider, messages);
    process.stdout.write(chalk.cyan('AI: '));
    process.stdout.write(result.content);
    process.stdout.write('\n\n');
    return {
      fullResponse: result.content,
      messages: result.messages,
    };
  }

  const fullResponse = await streamRenderer.render(provider.stream(messages));
  return {
    fullResponse,
    messages: [...messages, { role: 'assistant', content: fullResponse }],
  };
}

program
  .name('mini-cli')
  .description('Mini AI Coding CLI - 支持 MiniMax 模型')
  .version('1.0.0');

// 交互式聊天命令
program
  .command('chat')
  .description('Start interactive chat with AI')
  .option('-m, --model <model>', 'AI model to use', config.ai.defaultModel || 'MiniMax-M2.5')
  .action(async (options: ModelOption) => {
    try {
      const model = resolveModel(options.model);
      console.log(chalk.blue(`Starting chat with model: ${model}`));
      console.log(chalk.gray('Type "exit" or "quit" to end the chat.\n'));

      const messages: Message[] = [];

      // 简单的 REPL 循环
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const askQuestion = (query: string): Promise<string> => {
        return new Promise((resolve) => rl.question(query, resolve));
      };

      while (true) {
        const userInput = await askQuestion(chalk.green('You: '));

        if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
          console.log(chalk.gray('\nGoodbye!'));
          rl.close();
          break;
        }

        if (!userInput.trim()) {
          continue;
        }

        // 添加用户消息
        messages.push({ role: 'user', content: userInput });

        // 流式输出响应
        try {
          const result = await runConversation(model, messages);
          messages.splice(0, messages.length, ...result.messages);
        } catch (error: any) {
          console.error(chalk.red(`\nError: ${error.message}\n`));
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

program.parse();
