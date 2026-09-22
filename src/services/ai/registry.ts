import { AIProvider, AIProviderId, ModelProfile } from './types';
import { GoogleGeminiProvider } from './providers/geminiProvider';
import { OfflineHeuristicProvider } from './providers/offlineProvider';
import { CustomProxyProvider } from './providers/customProxyProvider';

/**
 * Provider Registry
 * Maintains the collection of available AI providers and model mappings.
 * Allows adding new providers dynamically without changing core application logic.
 */
export class ProviderRegistry {
  private providers = new Map<AIProviderId, AIProvider>();
  private defaultProviderId: AIProviderId = 'google-gemini';

  constructor() {
    // Register built-in providers
    this.registerProvider(new GoogleGeminiProvider());
    this.registerProvider(new OfflineHeuristicProvider());
    this.registerProvider(new CustomProxyProvider());
  }

  /**
   * Registers a new AIProvider into the ecosystem
   */
  public registerProvider(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Unregisters a provider by identifier
   */
  public unregisterProvider(providerId: AIProviderId): boolean {
    return this.providers.delete(providerId);
  }

  /**
   * Retrieves a specific provider by its ID
   */
  public getProvider(providerId: AIProviderId): AIProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Sets the default active provider ID
   */
  public setDefaultProviderId(providerId: AIProviderId): void {
    if (!this.providers.has(providerId)) {
      throw new Error(`Cannot set unknown provider "${providerId}" as default.`);
    }
    this.defaultProviderId = providerId;
  }

  /**
   * Retrieves the current default provider
   */
  public getDefaultProvider(): AIProvider {
    const provider = this.providers.get(this.defaultProviderId);
    if (!provider) {
      // Fallback to offline provider if default is missing
      const offline = this.providers.get('offline-heuristic');
      if (offline) return offline;
      throw new Error('No AI providers registered in registry.');
    }
    return provider;
  }

  /**
   * Returns all registered providers
   */
  public getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Finds the provider that supports a given model ID
   */
  public findProviderForModel(modelId: string): AIProvider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.supportedModels.some((m) => m.id === modelId)) {
        return provider;
      }
    }
    return undefined;
  }

  /**
   * Aggregates all model profiles available across all registered providers
   */
  public getAllSupportedModels(): ModelProfile[] {
    const models: ModelProfile[] = [];
    for (const provider of this.providers.values()) {
      models.push(...provider.supportedModels);
    }
    return models;
  }
}

// Global registry singleton
export const providerRegistry = new ProviderRegistry();
