import { BaseAIProvider } from './baseProvider';
import { 
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
import { 
  AIAuthenticationError, 
  AIInvalidRequestError, 
  AIModelUnavailableError, 
  AINetworkError, 
  AIRateLimitError 
} from '../errors';

/**
 * Google Gemini Provider Adapter
 * Encapsulates communication with Google's Gemini models.
 * Proxies requests via server-side endpoint to protect credentials and handle server GEMINI_API_KEY.
 * Specified in docs/PROVIDERS.md and gemini-api skill.
 */
export class GoogleGeminiProvider extends BaseAIProvider {
  public readonly id: AIProviderId = 'google-gemini';
  public readonly displayName = 'Google Gemini';
  public readonly defaultModelId = 'gemini-3.8-flash';

  public readonly supportedModels: ModelProfile[] = [
    {
      id: 'gemini-3.8-flash',
      displayName: 'Gemini 3.8 Flash (Recommended)',
      providerId: 'google-gemini',
      contextWindow: 1048576,
      recommendedFor: 'Real-time plan proposals, interactive Socratic tutoring, rapid syllabus breakdown. High JSON fidelity.',
      latencyEstimate: '~350–700 ms',
      isDefault: true,
    },
    {
      id: 'gemini-2.5-pro',
      displayName: 'Gemini 2.5 Pro (Deep Reasoning)',
      providerId: 'google-gemini',
      contextWindow: 2097152,
      recommendedFor: 'Complex mathematical proofs, comprehensive syllabus breakdowns, deep STEM reasoning.',
      latencyEstimate: '~1.2–2.5 s',
      isDefault: false,
    },
    {
      id: 'gemini-3.1-pro-preview',
      displayName: 'Gemini 3.1 Pro Preview',
      providerId: 'google-gemini',
      contextWindow: 2097152,
      recommendedFor: 'Advanced coding, long-context reasoning, multi-turn dialogue.',
      latencyEstimate: '~1.5–3.0 s',
      isDefault: false,
    },
  ];

  public readonly capabilities: AIProviderCapabilities = {
    supportsStreaming: true,
    supportsStructuredJson: true,
    supportsSystemInstruction: true,
    supportsChatHistory: true,
    supportsVision: true,
    isOffline: false,
  };

  /**
   * Dispatches text generation through the secure proxy endpoint
   */
  public async generateText(request: GenerateTextRequest): Promise<GenerateTextResponse> {
    this.validateTextRequest(request);
    const model = this.resolveModelId(request.modelId);

    const { result, latencyMs } = await this.executeSafely('generateText', model, async () => {
      const response = await this.callProxyApi('/api/ai/proxy/generate-text', {
        prompt: request.prompt,
        messages: request.messages,
        systemInstruction: request.systemInstruction,
        modelId: model,
        temperature: request.temperature ?? 0.7,
        maxTokens: request.maxTokens,
        stopSequences: request.stopSequences,
        userApiKey: request.credentials?.apiKey,
      }, model);

      return {
        text: response.text,
        modelUsed: response.modelUsed || model,
        providerId: this.id,
        finishReason: response.finishReason || 'stop',
        usage: response.usage,
      };
    });

    return { ...result, latencyMs };
  }

  /**
   * Dispatches structured JSON generation through the secure proxy endpoint
   */
  public async generateStructuredJson<T = unknown>(request: GenerateJsonRequest): Promise<GenerateJsonResponse<T>> {
    this.validateJsonRequest(request);
    const model = this.resolveModelId(request.modelId);

    const { result, latencyMs } = await this.executeSafely('generateStructuredJson', model, async () => {
      const response = await this.callProxyApi('/api/ai/proxy/generate-json', {
        prompt: request.prompt,
        systemInstruction: request.systemInstruction,
        schemaDescription: request.schemaDescription,
        modelId: model,
        temperature: request.temperature ?? 0.2,
        userApiKey: request.credentials?.apiKey,
      }, model);

      let parsedData: T;
      if (typeof response.data === 'object' && response.data !== null) {
        parsedData = response.data as T;
      } else if (response.rawText) {
        try {
          parsedData = JSON.parse(response.rawText.trim()) as T;
        } catch (jsonErr: any) {
          throw new AIInvalidRequestError(this.id, `Provider returned unparseable JSON: ${jsonErr.message}`);
        }
      } else {
        throw new AIInvalidRequestError(this.id, 'Provider returned empty response data.');
      }

      return {
        data: parsedData,
        rawText: response.rawText || JSON.stringify(parsedData),
        modelUsed: response.modelUsed || model,
        providerId: this.id,
        usage: response.usage,
      };
    });

    return { ...result, latencyMs };
  }

  /**
   * Health check verifying API connectivity and credentials
   */
  public async checkHealth(credentials?: ProviderCredentials): Promise<ProviderHealthStatus> {
    const startTime = performance.now();
    try {
      const res = await fetch('/api/ai/proxy/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userApiKey: credentials?.apiKey }),
      });

      const latencyMs = Math.round(performance.now() - startTime);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) {
          return {
            providerId: this.id,
            isHealthy: false,
            hasCredentials: false,
            message: 'Authentication failed. Please verify your Gemini API key in Settings.',
            latencyMs,
          };
        }
        return {
          providerId: this.id,
          isHealthy: false,
          hasCredentials: Boolean(credentials?.apiKey),
          message: errorData.message || `Server returned HTTP ${res.status}`,
          latencyMs,
        };
      }

      const data = await res.json();
      return {
        providerId: this.id,
        isHealthy: data.isHealthy !== false,
        hasCredentials: data.hasCredentials ?? Boolean(credentials?.apiKey),
        message: data.message || 'Connected to Google Gemini API.',
        latencyMs,
        modelChecked: this.defaultModelId,
      };
    } catch (err: any) {
      return {
        providerId: this.id,
        isHealthy: false,
        hasCredentials: Boolean(credentials?.apiKey),
        message: `Network error connecting to Gemini service: ${err.message}`,
        latencyMs: Math.round(performance.now() - startTime),
      };
    }
  }

  /**
   * Internal proxy fetch wrapper with normalized error handling
   */
  private async callProxyApi(endpoint: string, payload: Record<string, any>, modelId: string): Promise<any> {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (fetchErr: any) {
      throw new AINetworkError(this.id, fetchErr);
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const msg = errBody.error || errBody.message || `HTTP ${response.status}`;

      if (response.status === 401 || response.status === 403) {
        throw new AIAuthenticationError(this.id, msg);
      }
      if (response.status === 429) {
        throw new AIRateLimitError(this.id, errBody.retryAfterSeconds);
      }
      if (response.status === 404) {
        throw new AIModelUnavailableError(this.id, modelId);
      }
      if (response.status === 400) {
        throw new AIInvalidRequestError(this.id, msg);
      }

      throw new AINetworkError(this.id, new Error(msg));
    }

    return await response.json();
  }
}
