import { type AIProvider, type ProviderConfig } from './base-provider.js';

export type ProviderFactory = (config: ProviderConfig) => AIProvider;

export class ProviderRegistry {
  private readonly factories = new Map<string, ProviderFactory>();

  register(name: string, factory: ProviderFactory): void {
    this.factories.set(name, factory);
  }

  has(name: string): boolean {
    return this.factories.has(name);
  }

  create(name: string, config: ProviderConfig): AIProvider {
    const factory = this.factories.get(name);

    if (!factory) {
      throw new Error(`Provider not registered: ${name}`);
    }

    return factory(config);
  }

  list(): string[] {
    return Array.from(this.factories.keys()).sort();
  }
}
