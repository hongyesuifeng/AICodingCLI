/**
 * 配置加载器
 */

import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { fileExists } from '../utils/file.js';

export interface AppConfig {
  version: string;
  ai: {
    model: string;
    apiKey: string;
    baseUrl?: string;
    temperature: number;
    maxTokens: number;
  };
  ui: {
    theme: 'dark' | 'light';
    colorOutput: boolean;
    showTokens: boolean;
  };
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

const DEFAULT_CONFIG: AppConfig = {
  version: '1.0.0',
  ai: {
    model: 'gpt-4o',
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

function getGlobalConfigPath(): string {
  return join(homedir(), '.mini-cli', 'config.json');
}

function getProjectConfigPath(): string {
  return join(process.cwd(), '.mini-cli', 'config.json');
}

async function loadConfigFile(path: string): Promise<Partial<AppConfig> | null> {
  try {
    if (await fileExists(path)) {
      const content = await readFile(path, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    // 忽略错误，使用默认配置
  }
  return null;
}

function loadFromEnv(): Partial<AppConfig> {
  const config: Partial<AppConfig> = {};

  if (process.env.OPENAI_API_KEY) {
    config.ai = { ...config.ai, apiKey: process.env.OPENAI_API_KEY };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    config.ai = { ...config.ai, apiKey: process.env.ANTHROPIC_API_KEY };
  }
  if (process.env.MINI_CLI_MODEL) {
    config.ai = { ...config.ai, model: process.env.MINI_CLI_MODEL };
  }

  return config;
}

function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key])
      ) {
        result[key] = deepMerge(result[key] as any, source[key] as any);
      } else {
        result[key] = source[key] as any;
      }
    }
  }

  return result;
}

export async function loadConfig(): Promise<AppConfig> {
  let config = { ...DEFAULT_CONFIG };

  // 全局配置
  const globalConfig = await loadConfigFile(getGlobalConfigPath());
  if (globalConfig) {
    config = deepMerge(config, globalConfig);
  }

  // 项目配置
  const projectConfig = await loadConfigFile(getProjectConfigPath());
  if (projectConfig) {
    config = deepMerge(config, projectConfig);
  }

  // 环境变量
  const envConfig = loadFromEnv();
  config = deepMerge(config, envConfig);

  return config;
}
