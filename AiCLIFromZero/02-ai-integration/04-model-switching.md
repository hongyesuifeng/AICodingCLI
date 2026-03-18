# 2.4 模型配置和切换

## 学习目标

实现灵活的模型配置和动态切换机制。

## 1. 模型配置系统

```typescript
// src/config/models.ts

// 模型能力定义
export interface ModelCapabilities {
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;
  inputPrice: number;  // 每百万 token 价格
  outputPrice: number;
}

// 预定义模型
export const MODELS: Record<string, ModelCapabilities> = {
  // OpenAI 模型
  'gpt-4o': {
    provider: 'openai',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    inputPrice: 5.0,
    outputPrice: 15.0,
  },
  'gpt-4o-mini': {
    provider: 'openai',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    inputPrice: 0.15,
    outputPrice: 0.6,
  },
  'o1': {
    provider: 'openai',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    supportsVision: false,
    supportsTools: false,
    supportsStreaming: false,
    inputPrice: 15.0,
    outputPrice: 60.0,
  },
  'o3-mini': {
    provider: 'openai',
    contextWindow: 200000,
    maxOutputTokens: 100000,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    inputPrice: 1.1,
    outputPrice: 4.4,
  },

  // Anthropic 模型
  'claude-opus-4-6': {
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    inputPrice: 15.0,
    outputPrice: 75.0,
  },
  'claude-sonnet-4-6': {
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    inputPrice: 3.0,
    outputPrice: 15.0,
  },
  'claude-haiku-4-5-20251001': {
    provider: 'anthropic',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    inputPrice: 0.8,
    outputPrice: 4.0,
  },

  // 本地模型 (Ollama)
  'ollama:deepseek-coder': {
    provider: 'ollama',
    contextWindow: 32000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsTools: false,
    supportsStreaming: true,
    inputPrice: 0,
    outputPrice: 0,
  },
};

// 模型别名
export const MODEL_ALIASES: Record<string, string> = {
  '4': 'gpt-4o',
  '4o': 'gpt-4o',
  '4o-mini': 'gpt-4o-mini',
  'opus': 'claude-opus-4-6',
  'sonnet': 'claude-sonnet-4-6',
  'haiku': 'claude-haiku-4-5-20251001',
  'claude': 'claude-sonnet-4-6',
  'o1': 'o1',
  'o3': 'o3-mini',
};

// 解析模型名称
export function resolveModel(name: string): string {
  // 检查别名
  if (MODEL_ALIASES[name]) {
    return MODEL_ALIASES[name];
  }

  // 检查 Ollama 前缀
  if (name.startsWith('ollama:')) {
    return name;
  }

  return name;
}

// 获取模型能力
export function getModelCapabilities(model: string): ModelCapabilities {
  const resolved = resolveModel(model);
  const capabilities = MODELS[resolved];

  if (!capabilities) {
    throw new Error(`Unknown model: ${model}`);
  }

  return capabilities;
}

// 列出所有模型
export function listModels(): string[] {
  return Object.keys(MODELS);
}
```

## 2. Provider 工厂

```typescript
// src/providers/factory.ts
import { AIProvider, ProviderConfig } from './base.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { getModelCapabilities } from '../config/models.js';

export function createProvider(
  model: string,
  apiKey?: string
): AIProvider {
  const capabilities = getModelCapabilities(model);
  const provider = capabilities.provider;

  const config: ProviderConfig = {
    apiKey: apiKey || getAPIKey(provider),
    model,
  };

  switch (provider) {
    case 'openai':
      return new OpenAIProvider(config);

    case 'anthropic':
      return new AnthropicProvider(config);

    case 'ollama':
      return createOllamaProvider(config);

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function getAPIKey(provider: string): string {
  const envMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
  };

  const key = process.env[envMap[provider]];
  if (!key) {
    throw new Error(`Missing API key for ${provider}. Set ${envMap[provider]}`);
  }

  return key;
}

function createOllamaProvider(config: ProviderConfig): AIProvider {
  // Ollama 实现略
  throw new Error('Ollama provider not implemented yet');
}
```

## 3. 模型管理器

```typescript
// src/managers/model-manager.ts
import { AIProvider } from '../providers/base.js';
import { createProvider } from '../providers/factory.js';
import {
  getModelCapabilities,
  resolveModel,
  ModelCapabilities,
} from '../config/models.js';

export class ModelManager {
  private providers = new Map<string, AIProvider>();
  private currentModel: string;

  constructor(defaultModel: string = 'gpt-4o') {
    this.currentModel = resolveModel(defaultModel);
  }

  // 获取当前模型
  getCurrentModel(): string {
    return this.currentModel;
  }

  // 获取当前 Provider
  getCurrentProvider(): AIProvider {
    return this.getProvider(this.currentModel);
  }

  // 切换模型
  switchModel(model: string): void {
    const resolved = resolveModel(model);
    this.currentModel = resolved;
  }

  // 获取 Provider
  getProvider(model: string): AIProvider {
    const resolved = resolveModel(model);

    if (!this.providers.has(resolved)) {
      this.providers.set(resolved, createProvider(resolved));
    }

    return this.providers.get(resolved)!;
  }

  // 获取模型能力
  getCapabilities(model?: string): ModelCapabilities {
    return getModelCapabilities(model || this.currentModel);
  }

  // 计算成本
  estimateCost(
    inputTokens: number,
    outputTokens: number,
    model?: string
  ): number {
    const caps = this.getCapabilities(model);
    const inputCost = (inputTokens / 1_000_000) * caps.inputPrice;
    const outputCost = (outputTokens / 1_000_000) * caps.outputPrice;
    return inputCost + outputCost;
  }

  // 列出可用模型
  listModels(): { name: string; provider: string }[] {
    const models = getModelCapabilities;
    return Object.entries(MODELS).map(([name, caps]) => ({
      name,
      provider: caps.provider,
    }));
  }
}
```

## 4. CLI 集成

```typescript
// src/commands/model.ts
import { Command } from 'commander';
import chalk from 'chalk';
import { ModelManager } from '../managers/model-manager.js';
import { MODELS, MODEL_ALIASES } from '../config/models.js';

const modelManager = new ModelManager();

export function registerModelCommand(program: Command): void {
  const model = program.command('model');

  model
    .description('Manage AI models')

    // 显示当前模型
    .command('current')
    .description('Show current model')
    .action(() => {
      const current = modelManager.getCurrentModel();
      const caps = modelManager.getCapabilities();
      console.log(chalk.blue('Current model:'), current);
      console.log(chalk.gray('Provider:'), caps.provider);
      console.log(chalk.gray('Context window:'), caps.contextWindow);
    })

    // 列出所有模型
    .command('list')
    .description('List all available models')
    .option('-p, --provider <name>', 'Filter by provider')
    .action((options) => {
      console.log(chalk.blue('Available models:\n'));

      const models = Object.entries(MODELS);
      const grouped = new Map<string, typeof models>();

      for (const [name, caps] of models) {
        if (options.provider && caps.provider !== options.provider) {
          continue;
        }
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
          console.log(chalk.gray(`    Price: $${caps.inputPrice}/$${caps.outputPrice} per 1M tokens`));
        }
        console.log();
      }
    })

    // 切换模型
    .command('use <model>')
    .description('Switch to a different model')
    .action((modelName: string) => {
      try {
        modelManager.switchModel(modelName);
        console.log(chalk.green(`Switched to model: ${modelName}`));
      } catch (error) {
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
    })

    // 显示别名
    .command('aliases')
    .description('Show model aliases')
    .action(() => {
      console.log(chalk.blue('Model aliases:'));
      for (const [alias, model] of Object.entries(MODEL_ALIASES)) {
        console.log(`  ${alias} → ${model}`);
      }
    });
}
```

## 5. 使用示例

```typescript
// src/examples/model-switching.ts
import { ModelManager } from '../managers/model-manager.js';

const manager = new ModelManager();

async function main() {
  // 使用默认模型
  console.log('Current model:', manager.getCurrentModel());

  const provider = manager.getCurrentProvider();
  const response = await provider.chat([
    { role: 'user', content: 'Hello!' }
  ]);
  console.log('Response:', response.content);

  // 切换模型
  manager.switchModel('claude');
  console.log('Switched to:', manager.getCurrentModel());

  // 使用新模型
  const claudeProvider = manager.getCurrentProvider();
  const response2 = await claudeProvider.chat([
    { role: 'user', content: 'Hello!' }
  ]);
  console.log('Claude response:', response2.content);

  // 计算成本
  const cost = manager.estimateCost(1000, 500);
  console.log('Estimated cost:', `$${cost.toFixed(4)}`);
}

main();
```

## 练习

1. **实现模型推荐**: 根据任务类型推荐最合适的模型
2. **实现成本追踪**: 追踪 API 调用成本
3. **实现模型测试**: 比较不同模型的响应

## 下一步

完成本节后，继续学习 [2.5 MiniMax SDK 集成](./05-minimax-sdk.md) →
