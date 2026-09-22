/**
 * NEXORA AI Provider Abstraction - Types
 * Specified in docs/PROVIDERS.md
 */

export type AIProviderId = 'google-gemini' | 'offline-heuristic' | 'custom-proxy' | string;

export interface ModelProfile {
  id: string;
  displayName: string;
  providerId: AIProviderId;
  contextWindow: number;
  recommendedFor: string;
  latencyEstimate: string;
  isDefault?: boolean;
}

export interface ProviderCredentials {
  apiKey?: string;
  baseUrl?: string;
  organizationId?: string;
  headers?: Record<string, string>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface GenerateTextRequest {
  prompt?: string;
  messages?: ChatMessage[];
  systemInstruction?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  credentials?: ProviderCredentials;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GenerateTextResponse {
  text: string;
  modelUsed: string;
  providerId: string;
  finishReason?: string;
  usage?: TokenUsage;
  latencyMs: number;
}

export interface GenerateJsonRequest {
  prompt: string;
  systemInstruction?: string;
  schemaDescription?: string;
  modelId?: string;
  temperature?: number;
  credentials?: ProviderCredentials;
}

export interface GenerateJsonResponse<T> {
  data: T;
  rawText: string;
  modelUsed: string;
  providerId: string;
  usage?: TokenUsage;
  latencyMs: number;
}

export interface ProviderHealthStatus {
  providerId: string;
  isHealthy: boolean;
  hasCredentials: boolean;
  message: string;
  latencyMs?: number;
  modelChecked?: string;
}

export interface AIProviderCapabilities {
  supportsStreaming: boolean;
  supportsStructuredJson: boolean;
  supportsSystemInstruction: boolean;
  supportsChatHistory: boolean;
  supportsVision: boolean;
  isOffline: boolean;
}

/**
 * Generic AI Provider Interface
 * All AI engine adapters must implement this contract.
 */
export interface AIProvider {
  /** Unique provider identifier */
  readonly id: AIProviderId;

  /** Human-readable display label */
  readonly displayName: string;

  /** Default model identifier */
  readonly defaultModelId: string;

  /** List of model profiles supported by this provider */
  readonly supportedModels: ModelProfile[];

  /** Functional capabilities */
  readonly capabilities: AIProviderCapabilities;

  /**
   * Generates standard text/dialogue completion
   */
  generateText(request: GenerateTextRequest): Promise<GenerateTextResponse>;

  /**
   * Generates structured JSON adhering to a specified schema/shape
   */
  generateStructuredJson<T = unknown>(request: GenerateJsonRequest): Promise<GenerateJsonResponse<T>>;

  /**
   * Checks provider connectivity, authentication, and service health
   */
  checkHealth(credentials?: ProviderCredentials): Promise<ProviderHealthStatus>;
}
