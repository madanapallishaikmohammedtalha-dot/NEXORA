import { 
  AIProvider, 
  AIProviderCapabilities, 
  AIProviderId, 
  GenerateJsonRequest, 
  GenerateJsonResponse, 
  GenerateTextRequest, 
  GenerateTextResponse, 
  ModelProfile, 
  ProviderCredentials, 
  ProviderHealthStatus 
} from '../types';
import { normalizeProviderError } from '../errors';

/**
 * Base abstract AI Provider providing common scaffolding, timing, and error trapping
 */
export abstract class BaseAIProvider implements AIProvider {
  public abstract readonly id: AIProviderId;
  public abstract readonly displayName: string;
  public abstract readonly defaultModelId: string;
  public abstract readonly supportedModels: ModelProfile[];
  public abstract readonly capabilities: AIProviderCapabilities;

  /**
   * Resolves the target model ID, falling back to default if unselected or unsupported
   */
  protected resolveModelId(requestedModelId?: string): string {
    if (!requestedModelId) return this.defaultModelId;
    const isSupported = this.supportedModels.some((m) => m.id === requestedModelId);
    return isSupported ? requestedModelId : this.defaultModelId;
  }

  /**
   * Validates common text request constraints
   */
  protected validateTextRequest(request: GenerateTextRequest): void {
    if (!request.prompt && (!request.messages || request.messages.length === 0)) {
      throw new Error('GenerateTextRequest must include either a prompt string or at least one message.');
    }
  }

  /**
   * Validates common JSON request constraints
   */
  protected validateJsonRequest(request: GenerateJsonRequest): void {
    if (!request.prompt || !request.prompt.trim()) {
      throw new Error('GenerateJsonRequest must include a prompt string.');
    }
  }

  /**
   * Core generation methods implemented by concrete providers
   */
  public abstract generateText(request: GenerateTextRequest): Promise<GenerateTextResponse>;
  public abstract generateStructuredJson<T = unknown>(request: GenerateJsonRequest): Promise<GenerateJsonResponse<T>>;
  public abstract checkHealth(credentials?: ProviderCredentials): Promise<ProviderHealthStatus>;

  /**
   * Safe execution wrapper that measures latency and normalizes errors
   */
  protected async executeSafely<T>(
    operationName: string,
    modelId: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; latencyMs: number }> {
    const startTime = performance.now();
    try {
      const result = await fn();
      const latencyMs = Math.round(performance.now() - startTime);
      return { result, latencyMs };
    } catch (err) {
      throw normalizeProviderError(err, this.id, modelId);
    }
  }
}
