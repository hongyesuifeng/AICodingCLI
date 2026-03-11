# 1.4 配置管理

## 学习目标

实现分层、灵活的配置管理系统，支持多环境配置。

## 1. 配置架构设计

```
配置优先级 (低 → 高):
┌─────────────────────────────────────────────┐
│ 1. 默认配置         (代码中定义)            │
│ 2. 全局配置         (~/.mini-cli/config)    │
│ 3. 项目配置         (./.mini-cli/config)    │
│ 4. 环境变量         (MINI_CLI_*)            │
│ 5. 命令行参数       (--option)              │
└─────────────────────────────────────────────┘
```

## 2. 配置类型定义

```typescript
// src/types/config.ts

export interface AIConfig {
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
}

export interface UIConfig {
  theme: 'dark' | 'light';
  colorOutput: boolean;
  showTokens: boolean;
}

export interface AppConfig {
  version: string;
  ai: AIConfig;
  ui: UIConfig;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// 默认配置
export const DEFAULT_CONFIG: AppConfig = {
  version: '1.0.0',
  ai: {
    model: 'gpt-4',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 4096,
  },
  ui: {
    theme: 'dark',
    colorOutput: true,
    showTokens: true,
  },
  logLevel: 'info',
};
```

## 3. 配置加载器

```typescript
// src/utils/config.ts
import { homedir } from 'os';
import { join } from 'path';
import { fileExists, readJsonFile, writeJsonFile, ensureDir } from './file.js';
import { DEFAULT_CONFIG, AppConfig } from '../types/config.js';

// 配置文件路径
export function getGlobalConfigPath(): string {
  return join(homedir(), '.mini-cli', 'config.json');
}

export function getProjectConfigPath(): string {
  return join(process.cwd(), '.mini-cli', 'config.json');
}

// 加载配置文件
async function loadConfigFile(path: string): Promise<Partial<AppConfig> | null> {
  try {
    if (await fileExists(path)) {
      return await readJsonFile<Partial<AppConfig>>(path);
    }
  } catch (error) {
    console.warn(`Failed to load config from ${path}:`, error);
  }
  return null;
}

// 从环境变量加载
function loadFromEnv(): Partial<AppConfig> {
  const config: Partial<AppConfig> = {};

  if (process.env.MINI_CLI_MODEL) {
    config.ai = { ...config.ai, model: process.env.MINI_CLI_MODEL };
  }
  if (process.env.MINI_CLI_API_KEY) {
    config.ai = { ...config.ai, apiKey: process.env.MINI_CLI_API_KEY };
  }
  if (process.env.MINI_CLI_LOG_LEVEL) {
    config.logLevel = process.env.MINI_CLI_LOG_LEVEL as AppConfig['logLevel'];
  }

  return config;
}

// 深度合并配置
function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key])
      ) {
        result[key] = deepMerge(result[key], source[key] as any);
      } else {
        result[key] = source[key] as any;
      }
    }
  }

  return result;
}

// 加载所有配置（合并）
export async function loadConfig(): Promise<AppConfig> {
  let config = { ...DEFAULT_CONFIG };

  // 1. 全局配置
  const globalConfig = await loadConfigFile(getGlobalConfigPath());
  if (globalConfig) {
    config = deepMerge(config, globalConfig);
  }

  // 2. 项目配置
  const projectConfig = await loadConfigFile(getProjectConfigPath());
  if (projectConfig) {
    config = deepMerge(config, projectConfig);
  }

  // 3. 环境变量
  const envConfig = loadFromEnv();
  config = deepMerge(config, envConfig);

  return config;
}

// 保存配置
export async function saveConfig(
  config: Partial<AppConfig>,
  global: boolean = true
): Promise<void> {
  const path = global ? getGlobalConfigPath() : getProjectConfigPath();
  await ensureDir(join(path, '..'));
  await writeJsonFile(path, config);
}
```

## 4. 配置验证

```typescript
// src/utils/config-validator.ts

// 配置验证规则
interface ValidationRule<T> {
  validate: (value: any) => boolean;
  message: string;
}

const RULES: Record<string, ValidationRule<any>[]> = {
  'ai.model': [
    {
      validate: (v) => typeof v === 'string' && v.length > 0,
      message: 'Model must be a non-empty string',
    },
  ],
  'ai.temperature': [
    {
      validate: (v) => typeof v === 'number' && v >= 0 && v <= 1,
      message: 'Temperature must be between 0 and 1',
    },
  ],
  'ai.maxTokens': [
    {
      validate: (v) => typeof v === 'number' && v > 0,
      message: 'Max tokens must be a positive number',
    },
  ],
};

// 验证配置
export function validateConfig(config: Partial<AppConfig>): string[] {
  const errors: string[] = [];

  function validate(path: string, value: any): void {
    const rules = RULES[path];
    if (rules) {
      for (const rule of rules) {
        if (!rule.validate(value)) {
          errors.push(`${path}: ${rule.message}`);
        }
      }
    }
  }

  // 验证嵌套配置
  if (config.ai) {
    validate('ai.model', config.ai.model);
    validate('ai.temperature', config.ai.temperature);
    validate('ai.maxTokens', config.ai.maxTokens);
  }

  return errors;
}
```

## 5. 配置管理器类

```typescript
// src/utils/config-manager.ts

export class ConfigManager {
  private config: AppConfig;
  private configPath: string;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.configPath = getGlobalConfigPath();
  }

  // 加载配置
  async load(): Promise<void> {
    this.config = await loadConfig();
  }

  // 获取配置
  get(): Readonly<AppConfig> {
    return this.config;
  }

  // 设置单个值
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
  }

  // 获取嵌套值
  getNested<K1 extends keyof AppConfig, K2 extends keyof AppConfig[K1]>(
    k1: K1,
    k2: K2
  ): AppConfig[K1][K2] {
    return this.config[k1][k2];
  }

  // 设置嵌套值
  setNested<
    K1 extends keyof AppConfig,
    K2 extends keyof AppConfig[K1]
  >(k1: K1, k2: K2, value: AppConfig[K1][K2]): void {
    (this.config[k1] as any)[k2] = value;
  }

  // 保存配置
  async save(global: boolean = true): Promise<void> {
    const errors = validateConfig(this.config);
    if (errors.length > 0) {
      throw new Error(`Config validation failed:\n${errors.join('\n')}`);
    }
    await saveConfig(this.config, global);
  }

  // 重置为默认值
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
  }
}
```

## 6. 使用示例

```typescript
// src/commands/config.ts
import { Command } from 'commander';
import { ConfigManager } from '../utils/config-manager.js';
import chalk from 'chalk';

const configManager = new ConfigManager();

export function registerConfigCommand(program: Command): void {
  const config = program.command('config');

  config
    .command('list')
    .description('List all configuration')
    .action(async () => {
      await configManager.load();
      console.log(chalk.blue('Current configuration:'));
      console.log(JSON.stringify(configManager.get(), null, 2));
    });

  config
    .command('get <key>')
    .description('Get a configuration value')
    .action(async (key: string) => {
      await configManager.load();
      const keys = key.split('.');
      let value: any = configManager.get();

      for (const k of keys) {
        value = value?.[k];
      }

      if (value !== undefined) {
        console.log(value);
      } else {
        console.log(chalk.yellow(`Key "${key}" not found`));
      }
    });

  config
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action(async (key: string, value: string) => {
      await configManager.load();

      // 解析值
      let parsedValue: any = value;
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (!isNaN(Number(value))) parsedValue = Number(value);

      const keys = key.split('.');
      if (keys.length === 1) {
        configManager.set(keys[0] as any, parsedValue);
      } else if (keys.length === 2) {
        configManager.setNested(keys[0] as any, keys[1] as any, parsedValue);
      }

      await configManager.save();
      console.log(chalk.green(`Set ${key} = ${parsedValue}`));
    });
}
```

## 练习

1. **添加配置迁移**: 支持配置版本升级
2. **添加配置加密**: 敏感信息加密存储
3. **添加配置导入导出**: 支持 YAML/JSON 格式转换

## 下一步

完成第01章后，继续学习 [第02章：AI 模型集成](../02-ai-integration/README.md) →
