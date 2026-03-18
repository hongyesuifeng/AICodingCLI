// src/config/models.ts

// 模型能力定义
export interface ModelCapabilities {
  provider: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsThinking: boolean; // MiniMax 特有
  inputPrice: number; // 每百万 token 价格
  outputPrice: number;
}

// 预定义模型
export const MODELS: Record<string, ModelCapabilities> = {
  // MiniMax 模型
  'MiniMax-M2.5': {
    provider: 'minimax',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    supportsThinking: true,
    inputPrice: 0.6,
    outputPrice: 2.4,
  },
  'MiniMax-M2.5-highspeed': {
    provider: 'minimax',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    supportsThinking: true,
    inputPrice: 0.2,
    outputPrice: 0.6,
  },
  'MiniMax-M2.1': {
    provider: 'minimax',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    supportsThinking: true,
    inputPrice: 0.4,
    outputPrice: 1.6,
  },
  'MiniMax-M2.1-highspeed': {
    provider: 'minimax',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    supportsThinking: true,
    inputPrice: 0.1,
    outputPrice: 0.4,
  },
  'MiniMax-M2': {
    provider: 'minimax',
    contextWindow: 32000,
    maxOutputTokens: 4096,
    supportsVision: false,
    supportsTools: true,
    supportsStreaming: true,
    supportsThinking: false,
    inputPrice: 0.1,
    outputPrice: 0.1,
  },
};

// 模型别名
export const MODEL_ALIASES: Record<string, string> = {
  // MiniMax 别名
  'm25': 'MiniMax-M2.5',
  'm25-fast': 'MiniMax-M2.5-highspeed',
  'm21': 'MiniMax-M2.1',
  'm21-fast': 'MiniMax-M2.1-highspeed',
  'm2': 'MiniMax-M2',
  'minimax': 'MiniMax-M2.5',
};

// 解析模型名称
export function resolveModel(name: string): string {
  // 检查别名
  if (MODEL_ALIASES[name]) {
    return MODEL_ALIASES[name];
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
