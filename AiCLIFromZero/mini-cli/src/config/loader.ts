// src/config/loader.ts
import { resolveModel, getModelCapabilities, listModels, MODEL_ALIASES, MODELS, type ModelCapabilities } from './models.js';

export {
  resolveModel,
  getModelCapabilities,
  listModels,
  MODEL_ALIASES,
  MODELS,
  type ModelCapabilities,
};

// 配置接口
export interface AppConfig {
  ai: {
    minimaxApiKey?: string;
    openaiApiKey?: string;
    defaultModel?: string;
  };
}

// 从环境变量加载配置
export function loadConfig(): AppConfig {
  return {
    ai: {
      minimaxApiKey: process.env.MINIMAX_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      defaultModel: process.env.DEFAULT_MODEL || 'MiniMax-M2.5',
    },
  };
}

// 获取 API Key
export function getApiKey(provider: string): string {
  const envMap: Record<string, string> = {
    minimax: 'MINIMAX_API_KEY',
    openai: 'OPENAI_API_KEY',
  };

  const key = process.env[envMap[provider]];
  if (!key) {
    throw new Error(`Missing API key for ${provider}. Set ${envMap[provider]}`);
  }

  return key;
}
