import { 
  AIProvider, 
  AIProviderId, 
  GenerateJsonRequest, 
  GenerateJsonResponse, 
  GenerateTextRequest, 
  GenerateTextResponse, 
  ModelProfile, 
  ProviderCredentials, 
  ProviderHealthStatus 
} from './types';
import { ProviderRegistry, providerRegistry } from './registry';
import { 
  AIModelUnavailableError, 
  AIProviderError, 
  normalizeProviderError 
} from './errors';

export interface ServiceExecutionOptions {
  providerId?: AIProviderId;
  modelId?: string;
  userApiKey?: string;
  credentials?: ProviderCredentials;
  allowFallbackToOffline?: boolean;
}

export interface ProviderSummary {
  id: string;
  displayName: string;
  defaultModelId: string;
  models: ModelProfile[];
  capabilities: AIProvider['capabilities'];
  isOffline: boolean;
}

/**
 * Generic AI Service
 * The primary public boundary through which all application modules interact with AI capabilities.
 * Decouples consumers from specific vendor SDKs, handles model resolution, credentials,
 * error normalization, and fallback strategies.
 */
export class AIService {
  private registry: ProviderRegistry;
  private currentModelId: string = 'gemini-3.8-flash';
  private storedCredentials: ProviderCredentials = {};

  constructor(registry: ProviderRegistry = providerRegistry) {
    this.registry = registry;
  }

  /**
   * Sets the global active model identifier
   */
  public setModel(modelId: string): void {
    const provider = this.registry.findProviderForModel(modelId);
    if (!provider) {
      throw new AIModelUnavailableError('generic-service', modelId);
    }
    this.currentModelId = modelId;
  }

  /**
   * Returns current active model identifier
   */
  public getModel(): string {
    return this.currentModelId;
  }

  /**
   * Updates user-configured credentials in memory
   */
  public setCredentials(credentials: ProviderCredentials): void {
    this.storedCredentials = { ...this.storedCredentials, ...credentials };
  }

  /**
   * Clears stored credentials
   */
  public clearCredentials(): void {
    this.storedCredentials = {};
  }

  /**
   * Dispatches a text generation request through the generic provider layer
   */
  public async generateText(
    request: GenerateTextRequest,
    options?: ServiceExecutionOptions
  ): Promise<GenerateTextResponse> {
    const { provider, modelId, credentials } = this.resolveExecutionTarget(request, options);

    const mergedRequest: GenerateTextRequest = {
      ...request,
      modelId,
      credentials,
    };

    try {
      return await provider.generateText(mergedRequest);
    } catch (err) {
      const normalizedError = normalizeProviderError(err, provider.id, modelId);

      // Handle optional degradation to offline heuristic engine
      if (options?.allowFallbackToOffline && provider.id !== 'offline-heuristic') {
        console.warn(
          `[AIService] Primary provider "${provider.id}" failed (${normalizedError.category}). Degrading to offline heuristic engine.`
        );
        const offlineProvider = this.registry.getProvider('offline-heuristic');
        if (offlineProvider) {
          const fallbackRes = await offlineProvider.generateText({
            ...mergedRequest,
            modelId: offlineProvider.defaultModelId,
          });
          return {
            ...fallbackRes,
            text: `${fallbackRes.text}\n\n*(Notice: Primary AI provider encountered an error: ${normalizedError.userFacingMessage} Operating via Local Offline Engine)*`,
          };
        }
      }

      throw normalizedError;
    }
  }

  /**
   * Dispatches a structured JSON request through the generic provider layer
   */
  public async generateStructuredJson<T = unknown>(
    request: GenerateJsonRequest,
    options?: ServiceExecutionOptions
  ): Promise<GenerateJsonResponse<T>> {
    const { provider, modelId, credentials } = this.resolveExecutionTarget(request, options);

    const mergedRequest: GenerateJsonRequest = {
      ...request,
      modelId,
      credentials,
    };

    try {
      return await provider.generateStructuredJson<T>(mergedRequest);
    } catch (err) {
      const normalizedError = normalizeProviderError(err, provider.id, modelId);

      // Handle optional degradation to offline heuristic engine
      if (options?.allowFallbackToOffline && provider.id !== 'offline-heuristic') {
        console.warn(
          `[AIService] Primary provider "${provider.id}" failed (${normalizedError.category}). Degrading to offline heuristic engine.`
        );
        const offlineProvider = this.registry.getProvider('offline-heuristic');
        if (offlineProvider) {
          return await offlineProvider.generateStructuredJson<T>({
            ...mergedRequest,
            modelId: offlineProvider.defaultModelId,
          });
        }
      }

      throw normalizedError;
    }
  }

  /**
   * Checks health of a specific provider or the default provider
   */
  public async checkHealth(
    providerId?: AIProviderId,
    credentials?: ProviderCredentials
  ): Promise<ProviderHealthStatus> {
    const targetProvider = providerId 
      ? this.registry.getProvider(providerId)
      : this.registry.getDefaultProvider();

    if (!targetProvider) {
      return {
        providerId: providerId || 'unknown',
        isHealthy: false,
        hasCredentials: false,
        message: `Provider "${providerId}" is not registered in ProviderRegistry.`,
      };
    }

    const effectiveCreds = credentials || this.storedCredentials;
    return await targetProvider.checkHealth(effectiveCreds);
  }

  /**
   * Summarizes all available providers
   */
  public getAvailableProviders(): ProviderSummary[] {
    return this.registry.getAllProviders().map((p) => ({
      id: p.id,
      displayName: p.displayName,
      defaultModelId: p.defaultModelId,
      models: p.supportedModels,
      capabilities: p.capabilities,
      isOffline: p.capabilities.isOffline,
    }));
  }

  /**
   * Returns list of all supported models across all registered providers
   */
  public getAvailableModels(): ModelProfile[] {
    return this.registry.getAllSupportedModels();
  }

  /**
   * Access to underlying registry for advanced extension
   */
  public getRegistry(): ProviderRegistry {
    return this.registry;
  }

  /**
   * Internal helper resolving the provider, model, and credentials for an execution
   */
  private resolveExecutionTarget(
    request: { modelId?: string; credentials?: ProviderCredentials },
    options?: ServiceExecutionOptions
  ): { provider: AIProvider; modelId: string; credentials: ProviderCredentials } {
    const requestedModel = options?.modelId || request.modelId || this.currentModelId;

    let provider: AIProvider | undefined;

    // 1. If explicit providerId is specified in options, use it
    if (options?.providerId) {
      provider = this.registry.getProvider(options.providerId);
      if (!provider) {
        throw new AIProviderError({
          providerId: options.providerId,
          category: 'invalid_request',
          userFacingMessage: `Requested AI provider "${options.providerId}" is not registered.`,
          recoveryAction: 'Select one of the registered providers in Settings.',
          isRetryable: false,
        });
      }
    } else {
      // 2. Otherwise look up which provider supports the requested model
      provider = this.registry.findProviderForModel(requestedModel);
    }

    // 3. Fallback to default provider if no match
    if (!provider) {
      provider = this.registry.getDefaultProvider();
    }

    // Resolve credentials
    const credentials: ProviderCredentials = {
      ...this.storedCredentials,
      ...(options?.userApiKey ? { apiKey: options.userApiKey } : {}),
      ...(options?.credentials || {}),
      ...(request.credentials || {}),
    };

    return {
      provider,
      modelId: requestedModel,
      credentials,
    };
  }
}

// Global default AIService singleton instance
export const aiService = new AIService();
