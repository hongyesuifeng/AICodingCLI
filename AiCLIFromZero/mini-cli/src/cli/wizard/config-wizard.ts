// src/cli/wizard/config-wizard.ts
import chalk from 'chalk';
import { SimplePrompt } from '../prompts/basic.js';

// 配置步骤
interface ConfigStep {
  name: string;
  title: string;
  execute: (prompt: SimplePrompt, config: Record<string, any>) => Promise<void>;
}

// 配置向导
export class ConfigWizard {
  private steps: ConfigStep[] = [];
  private config: Record<string, any> = {};
  private prompt: SimplePrompt;

  constructor() {
    this.prompt = new SimplePrompt();
  }

  // 添加配置步骤
  addStep(step: ConfigStep): this {
    this.steps.push(step);
    return this;
  }

  // 运行向导
  async run(): Promise<Record<string, any>> {
    console.log(chalk.cyan.bold('\n🚀 AI CLI 配置向导\n'));
    console.log('按 Ctrl+C 可随时退出\n');

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];

      // 显示进度
      console.log(chalk.gray(`[${i + 1}/${this.steps.length}] ${step.title}`));

      // 执行步骤
      await step.execute(this.prompt, this.config);

      console.log(); // 空行
    }

    // 显示配置摘要
    await this.showSummary();

    this.prompt.close();
    return this.config;
  }

  // 显示配置摘要
  private async showSummary(): Promise<void> {
    console.log(chalk.cyan.bold('\n📋 配置摘要\n'));

    for (const [key, value] of Object.entries(this.config)) {
      const displayValue = typeof value === 'string' && value.length > 30
        ? value.slice(0, 30) + '...'
        : value;
      console.log(`  ${key}: ${chalk.green(String(displayValue))}`);
    }

    console.log();

    const confirm = await this.prompt.confirm('确认保存配置？', true);

    if (!confirm) {
      console.log(chalk.yellow('配置已取消'));
      this.config = {};
    }
  }
}

// 创建默认配置向导
export function createDefaultWizard(): ConfigWizard {
  return new ConfigWizard()
    .addStep({
      name: 'provider',
      title: 'AI 提供商设置',
      execute: async (prompt, config) => {
        const provider = await prompt.select('选择 AI 提供商：', [
          'OpenAI',
          'Anthropic',
          'MiniMax',
          '本地模型',
        ]);
        config.provider = provider.toLowerCase();

        if (config.provider !== '本地模型') {
          const apiKey = await prompt.password('输入 API Key');
          config.apiKey = apiKey;
        }
      },
    })
    .addStep({
      name: 'model',
      title: '模型设置',
      execute: async (prompt, config) => {
        let models: string[];

        switch (config.provider) {
          case 'openai':
            models = ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
            break;
          case 'anthropic':
            models = ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'];
            break;
          case 'minimax':
            models = ['MiniMax-M1', 'MiniMax-M2.5', 'MiniMax-Text-01'];
            break;
          default:
            models = ['llama-2', 'mistral'];
        }

        config.model = await prompt.select('选择默认模型：', models);

        const tempInput = await prompt.input('Temperature (0-2)', '0.7');
        config.temperature = parseFloat(tempInput) || 0.7;

        const tokensInput = await prompt.input('最大 Token 数', '4096');
        config.maxTokens = parseInt(tokensInput) || 4096;
      },
    })
    .addStep({
      name: 'tools',
      title: '工具设置',
      execute: async (prompt, config) => {
        const tools = await prompt.multiselect('启用的工具：', [
          '文件操作',
          '命令执行',
          '网络请求',
          '代码执行',
        ]);
        config.enabledTools = tools;

        config.requireConfirmation = await prompt.confirm(
          '执行命令前需要确认？',
          true
        );
      },
    })
    .addStep({
      name: 'appearance',
      title: '外观设置',
      execute: async (prompt, config) => {
        config.theme = await prompt.select('选择主题：', [
          'default',
          'dark',
          'light',
          'colorful',
        ]);

        config.streaming = await prompt.confirm('启用流式输出？', true);
      },
    });
}
