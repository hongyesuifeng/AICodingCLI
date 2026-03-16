// src/index.ts
import { Command } from 'commander';

const program = new Command();

program
  .name('mini-cli')
  .description('Mini AI Coding CLI')
  .version('1.0.0');

program
  .command('chat')
  .description('Start interactive chat')
  .option('-m, --model <model>', 'AI model to use')
  .action(async (options) => {
    console.log('Starting chat with model:', options.model);
  });

program.parse();