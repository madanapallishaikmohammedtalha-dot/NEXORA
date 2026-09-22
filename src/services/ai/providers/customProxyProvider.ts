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
  AINetworkError, 
  AIRateLimitError 
} from '../errors';

/**
 * Custom / Self-Hosted Proxy Provider
 * Demonstrates adding external or local providers (e.g., Ollama, LocalAI, vLLM, OpenAI-compatible proxy)
 * without changing any core application code.
 * Specified in docs/PROVIDERS.md
 */
export class CustomProxyProvider extends BaseAIProvider {
  public readonly id: AIProviderId = 'custom-proxy';
  public readonly displayName = 'Custom Self-Hosted Proxy';
  public readonly defaultModelId = 'llama3-8b';

  public readonly supportedModels: ModelProfile[] = [
    {
      id: 'llama3-8b',
      displayName: 'Llama 3 8B (Self-Hosted / Ollama)',
      providerId: 'custom-proxy',
      contextWindow: 8192,
      recommendedFor: 'Local inference via Ollama / LocalAI on student hardware',
      latencyEstimate: '~800ms–2s',
      isDefault: true,
    },
    {
      id: 'mistral-7b',
      displayName: 'Mistral 7B Instruct',
      providerId: 'custom-proxy',
      contextWindow: 32768,
      recommendedFor: 'Lightweight local tutoring and study planning',
      latencyEstimate: '~500ms–1.5s',
      isDefault: false,
    },
    {
      id: 'deepseek-r1-qwen',
      displayName: 'DeepSeek R1 Qwen (Distilled)',
      providerId: 'custom-proxy',
      contextWindow: 16384,
      recommendedFor: 'STEM and mathematical problem solving on local GPU',
      latencyEstimate: '~1–3s',
      isDefault: false,
    },
  ];

  public readonly capabilities: AIProviderCapabilities = {
    supportsStreaming: true,
    supportsStructuredJson: true,
    supportsSystemInstruction: true,
    supportsChatHistory: true,
    supportsVision: false,
    isOffline: false,
  };

  public async generateText(request: GenerateTextRequest): Promise<GenerateTextResponse> {
    this.validateTextRequest(request);
    const model = request.modelId || this.defaultModelId;
    const baseUrl = request.credentials?.baseUrl || '/api/ai/proxy/custom';

    const { result, latencyMs } = await this.executeSafely('generateText', model, async () => {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/generate-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(request.credentials?.headers || {}),
          },
          body: JSON.stringify({
            prompt: request.prompt,
            messages: request.messages,
            systemInstruction: request.systemInstruction,
            modelId: model,
            temperature: request.temperature ?? 0.7,
            apiKey: request.credentials?.apiKey,
          }),
        });
      } catch (netErr: any) {
        throw new AINetworkError(this.id, netErr);
      }

      if (!response.ok) {
        if (response.status === 401) throw new AIAuthenticationError(this.id, 'Invalid credentials for custom proxy.');
        if (response.status === 429) throw new AIRateLimitError(this.id);
        throw new AIInvalidRequestError(this.id, `Custom proxy error HTTP ${response.status}`);
      }

      const json = await response.json();
      return {
        text: json.text || json.reply || '',
        modelUsed: model,
        providerId: this.id,
        finishReason: 'stop',
        usage: json.usage,
      };
    });

    return { ...result, latencyMs };
  }

  public async generateStructuredJson<T = unknown>(request: GenerateJsonRequest): Promise<GenerateJsonResponse<T>> {
    this.validateJsonRequest(request);
    const model = request.modelId || this.defaultModelId;
    const baseUrl = request.credentials?.baseUrl || '/api/ai/proxy/custom';

    const { result, latencyMs } = await this.executeSafely('generateStructuredJson', model, async () => {
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/generate-json`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(request.credentials?.headers || {}),
          },
          body: JSON.stringify({
            prompt: request.prompt,
            systemInstruction: request.systemInstruction,
            schemaDescription: request.schemaDescription,
            modelId: model,
            temperature: request.temperature ?? 0.2,
            apiKey: request.credentials?.apiKey,
          }),
        });
      } catch (netErr: any) {
        throw new AINetworkError(this.id, netErr);
      }

      if (!response.ok) {
        if (response.status === 401) throw new AIAuthenticationError(this.id, 'Invalid credentials for custom proxy.');
        if (response.status === 429) throw new AIRateLimitError(this.id);
        throw new AIInvalidRequestError(this.id, `Custom proxy error HTTP ${response.status}`);
      }

      const json = await response.json();
      const parsedData = json.data || JSON.parse(json.rawText || '{}');

      return {
        data: parsedData as T,
        rawText: json.rawText || JSON.stringify(parsedData),
        modelUsed: model,
        providerId: this.id,
        usage: json.usage,
      };
    });

    return { ...result, latencyMs };
  }

  public async checkHealth(credentials?: ProviderCredentials): Promise<ProviderHealthStatus> {
    const baseUrl = credentials?.baseUrl || '/api/ai/proxy/custom';
    const startTime = performance.now();
    try {
      const res = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        headers: { ...(credentials?.headers || {}) },
      });
      const latencyMs = Math.round(performance.now() - startTime);

      return {
        providerId: this.id,
        isHealthy: res.ok,
        hasCredentials: Boolean(credentials?.apiKey || credentials?.baseUrl),
        message: res.ok ? 'Custom proxy endpoint is responsive.' : `Proxy returned status ${res.status}`,
        latencyMs,
        modelChecked: this.defaultModelId,
      };
    } catch (err: any) {
      return {
        providerId: this.id,
        isHealthy: false,
        hasCredentials: Boolean(credentials?.apiKey || credentials?.baseUrl),
        message: `Unable to connect to custom proxy at ${baseUrl}: ${err.message}`,
        latencyMs: Math.round(performance.now() - startTime),
      };
    }
  }
}
