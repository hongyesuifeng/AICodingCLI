import { getApiKey } from '../config/loader.js';
import { getModelCapabilities, resolveModel } from '../config/models.js';
import { type AIProvider } from '../providers/base-provider.js';
import { ProviderRegistry } from '../providers/registry.js';

export interface ModelManagerOptions {
  registry: ProviderRegistry;
  getApiKey?: (provider: string) => string;
}

export class ModelManager {
  private readonly registry: ProviderRegistry;
  private readonly apiKeyResolver: (provider: string) => string;
  private readonly providers = new Map<string, AIProvider>();
  private currentModel: string;

  constructor(
    defaultModel = 'MiniMax-M2.5',
    options: ModelManagerOptions
  ) {
    this.currentModel = resolveModel(defaultModel);
    this.registry = options.registry;
    this.apiKeyResolver = options.getApiKey ?? getApiKey;
  }

  getCurrentModel(): string {
    return this.currentModel;
  }

  switchModel(model: string): string {
    const resolvedModel = resolveModel(model);
    getModelCapabilities(resolvedModel);
    this.currentModel = resolvedModel;
    return this.currentModel;
  }

  getCurrentProvider(): AIProvider {
    return this.getProvider(this.currentModel);
  }

  getProvider(model: string, apiKey?: string): AIProvider {
    const resolvedModel = resolveModel(model);

    if (this.providers.has(resolvedModel)) {
      return this.providers.get(resolvedModel)!;
    }

    const capabilities = getModelCapabilities(resolvedModel);
    const provider = this.registry.create(capabilities.provider, {
      apiKey: apiKey ?? this.apiKeyResolver(capabilities.provider),
      model: resolvedModel,
    });

    this.providers.set(resolvedModel, provider);
    return provider;
  }
}
