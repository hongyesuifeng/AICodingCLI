// src/cli/command/builtin.ts
import type { CommandDefinition } from './types.js';
import chalk from 'chalk';

// 帮助命令
export const helpCommand: CommandDefinition = {
  name: 'help',
  description: 'Show help information',
  aliases: ['h', '?'],
  options: [
    {
      name: 'command',
      alias: 'c',
      type: 'string',
      description: 'Show help for a specific command',
    },
  ],
  handler: async (ctx) => {
    const registry = ctx.repl?.commandRegistry;
    if (!registry) return;

    const commandName = ctx.options.command;

    if (commandName) {
      const cmd = registry.get(commandName);
      if (cmd) {
        console.log(chalk.cyan(`/${cmd.name}`));
        console.log(`  ${cmd.description}`);

        if (cmd.options?.length) {
          console.log('\nOptions:');
          for (const opt of cmd.options) {
            const alias = opt.alias ? `-${opt.alias}, ` : '';
            console.log(`  ${alias}--${opt.name}  ${opt.description || ''}`);
          }
        }

        if (cmd.examples?.length) {
          console.log('\nExamples:');
          for (const ex of cmd.examples) {
            console.log(`  ${ex}`);
          }
        }
      } else {
        console.log(chalk.red(`Unknown command: ${commandName}`));
      }
    } else {
      console.log(chalk.cyan('Available commands:\n'));

      const commands = registry.list();
      for (const name of commands) {
        const cmd = registry.get(name);
        if (cmd) {
          console.log(`  /${name.padEnd(15)} ${cmd.description}`);
        }
      }

      console.log(`\nType ${chalk.cyan('/help <command>')} for more information.`);
    }
  },
};

// 清屏命令
export const clearCommand: CommandDefinition = {
  name: 'clear',
  description: 'Clear the screen',
  aliases: ['cls'],
  handler: async () => {
    console.clear();
  },
};

// 退出命令
export const exitCommand: CommandDefinition = {
  name: 'exit',
  description: 'Exit the CLI',
  aliases: ['quit', 'q'],
  handler: async () => {
    console.log(chalk.cyan('Goodbye!'));
    process.exit(0);
  },
};

// 模型命令
export const modelCommand: CommandDefinition = {
  name: 'model',
  description: 'Show or change the current model',
  arguments: [
    {
      name: 'model',
      description: 'Model name to switch to',
      required: false,
    },
  ],
  options: [
    {
      name: 'list',
      alias: 'l',
      type: 'boolean',
      description: 'List available models',
    },
  ],
  handler: async (ctx) => {
    const sessionManager = ctx.repl?.sessionManager;

    if (ctx.options.list) {
      console.log('Available models:');
      console.log('  gpt-4o         - GPT-4o (recommended)');
      console.log('  gpt-4-turbo    - GPT-4 Turbo');
      console.log('  gpt-4          - GPT-4');
      console.log('  gpt-3.5-turbo  - GPT-3.5 Turbo (fast)');
      console.log('  MiniMax-M2.5   - MiniMax M2.5');
      console.log('  claude-3-opus  - Claude 3 Opus');
      console.log('  claude-3-sonnet - Claude 3 Sonnet');
    } else if (ctx.arguments[0]) {
      const model = ctx.arguments[0];
      if (sessionManager) {
        sessionManager.setModel(model);
        console.log(chalk.green(`Model changed to: ${model}`));
      }
    } else {
      const currentModel = sessionManager?.getModel() || 'gpt-4';
      console.log(`Current model: ${chalk.cyan(currentModel)}`);
    }
  },
};

// 会话命令
export const sessionCommand: CommandDefinition = {
  name: 'session',
  description: 'Session management',
  subcommands: [
    {
      name: 'info',
      description: 'Show session information',
      handler: async (ctx) => {
        const sessionManager = ctx.repl?.sessionManager;
        if (sessionManager) {
          console.log(sessionManager.formatSessionInfo());
        }
      },
    },
    {
      name: 'clear',
      description: 'Clear session messages',
      handler: async (ctx) => {
        const sessionManager = ctx.repl?.sessionManager;
        if (sessionManager) {
          await sessionManager.clearMessages();
          console.log(chalk.green('Session cleared.'));
        }
      },
    },
    {
      name: 'stats',
      description: 'Show session statistics',
      handler: async (ctx) => {
        const sessionManager = ctx.repl?.sessionManager;
        if (sessionManager) {
          const tokenStats = sessionManager.getTokenStats();
          const costStats = sessionManager.getCostStats();
          console.log(chalk.cyan('\nSession Statistics:'));
          console.log(`  Tokens: ${tokenStats.current}/${tokenStats.max}`);
          console.log(`  Session Cost: $${costStats.sessionCost.toFixed(4)}`);
          console.log(`  Total Cost: $${costStats.totalCost.toFixed(4)}`);
        }
      },
    },
  ],
  handler: async () => {
    console.log('Please specify a subcommand: info, clear, stats');
  },
};

// 导出所有内置命令
export const builtinCommands: CommandDefinition[] = [
  helpCommand,
  clearCommand,
  exitCommand,
  modelCommand,
  sessionCommand,
];
