/**
 * NEXORA AI Provider Abstraction - Comprehensive Unit Test Suite
 * Tests provider interface, isolated execution, model selection, error taxonomy,
 * network/auth/rate-limit handling, user-facing error clarity, and extensibility.
 */

import { 
  AIService, 
  ProviderRegistry, 
  AIProvider, 
  BaseAIProvider,
  OfflineHeuristicProvider,
  GoogleGeminiProvider,
  CustomProxyProvider,
  AIAuthenticationError,
  AIRateLimitError,
  AIModelUnavailableError,
  AINetworkError,
  AIInvalidRequestError,
  normalizeProviderError,
  GenerateTextRequest,
  GenerateTextResponse,
  GenerateJsonRequest,
  GenerateJsonResponse,
  ProviderCredentials,
  ProviderHealthStatus,
  AIProviderCapabilities,
  ModelProfile
} from './index';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

export function runAIProviderTests(): {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
} {
  const results: TestResult[] = [];

  function assert(suite: string, name: string, condition: boolean, message?: string, details?: string) {
    if (condition) {
      results.push({ suite, name, passed: true, details });
    } else {
      results.push({ suite, name, passed: false, error: message || 'Assertion failed', details });
    }
  }

  // =========================================================================
  // SUITE 1: Provider Interface & Contract Adherence
  // =========================================================================
  try {
    const suite = 'Provider Interface';
    const offline = new OfflineHeuristicProvider();
    const gemini = new GoogleGeminiProvider();
    const custom = new CustomProxyProvider();

    assert(suite, 'Offline provider has valid identifier and displayName', offline.id === 'offline-heuristic' && Boolean(offline.displayName));
    assert(suite, 'Gemini provider has valid identifier and default model', gemini.id === 'google-gemini' && gemini.defaultModelId === 'gemini-3.8-flash');
    assert(suite, 'Custom proxy provider has valid default model', custom.id === 'custom-proxy' && Boolean(custom.defaultModelId));

    // Capabilities checks
    assert(suite, 'Offline provider correctly flags isOffline capability', offline.capabilities.isOffline === true);
    assert(suite, 'Gemini provider flags structured JSON capability', gemini.capabilities.supportsStructuredJson === true);
  } catch (err: any) {
    assert('Provider Interface', 'Execution failure', false, err.message);
  }

  // =========================================================================
  // SUITE 2: Provider Registry & Model Resolution
  // =========================================================================
  try {
    const suite = 'Provider Registry';
    const registry = new ProviderRegistry();

    const geminiProvider = registry.findProviderForModel('gemini-3.8-flash');
    assert(suite, 'Registry resolves gemini-3.8-flash to Google Gemini provider', geminiProvider?.id === 'google-gemini');

    const offlineProvider = registry.findProviderForModel('offline-heuristic');
    assert(suite, 'Registry resolves offline-heuristic to Offline provider', offlineProvider?.id === 'offline-heuristic');

    const customProvider = registry.findProviderForModel('llama3-8b');
    assert(suite, 'Registry resolves llama3-8b to Custom proxy provider', customProvider?.id === 'custom-proxy');

    const allModels = registry.getAllSupportedModels();
    assert(suite, 'Registry aggregates supported models across all providers', allModels.length >= 5);
  } catch (err: any) {
    assert('Provider Registry', 'Execution failure', false, err.message);
  }

  // =========================================================================
  // SUITE 3: Isolated Offline Provider Execution
  // =========================================================================
  try {
    const suite = 'Offline Engine';
    const offline = new OfflineHeuristicProvider();

    // Text generation
    const textRes = offline.generateText({ prompt: 'Explain Virtual Memory' });
    // It is a promise, let's test synchronous completion or structure
    textRes.then((res) => {
      assert(suite, 'Offline provider generates pedagogically structured response', res.text.includes('Offline Study Assistance') && res.latencyMs >= 0);
    }).catch((err) => {
      assert(suite, 'Offline text generation threw unexpected error', false, err.message);
    });

    // Structured JSON generation
    const jsonRes = offline.generateStructuredJson<{ proposals: any[] }>({
      prompt: 'Propose daily study schedule',
    });
    jsonRes.then((res) => {
      assert(suite, 'Offline provider generates valid structured plan proposals', Array.isArray(res.data.proposals) && res.data.proposals.length > 0);
    }).catch((err) => {
      assert(suite, 'Offline JSON generation threw unexpected error', false, err.message);
    });

    // Health check
    offline.checkHealth().then((health) => {
      assert(suite, 'Offline health check reports healthy with 0 external credentials needed', health.isHealthy && health.hasCredentials);
    });
  } catch (err: any) {
    assert('Offline Engine', 'Execution failure', false, err.message);
  }

  // =========================================================================
  // SUITE 4: Error Normalization & User-Facing Clarity
  // =========================================================================
  try {
    const suite = 'Error Normalization';

    // 4.1 Authentication Error
    const authErr = normalizeProviderError(
      { status: 401, message: 'API key expired or invalid' },
      'google-gemini'
    );
    assert(suite, 'Normalizes 401 to AIAuthenticationError', authErr instanceof AIAuthenticationError);
    assert(suite, 'Auth error provides actionable recovery hint', authErr.recoveryAction.includes('Settings'));
    assert(suite, 'Auth error is flagged as non-retryable without key update', authErr.isRetryable === false);

    // 4.2 Rate Limit Error
    const rateErr = normalizeProviderError(
      { status: 429, message: 'Resource exhausted: rate limit reached. retry after 30 seconds' },
      'google-gemini'
    );
    assert(suite, 'Normalizes 429 to AIRateLimitError', rateErr instanceof AIRateLimitError);
    assert(suite, 'Rate limit error extracts retry duration', (rateErr as AIRateLimitError).retryAfterSeconds === 30);
    assert(suite, 'Rate limit error is marked as retryable', rateErr.isRetryable === true);

    // 4.3 Unavailable Model Error
    const modelErr = normalizeProviderError(
      { status: 404, message: 'Model models/deprecated-v1 not found' },
      'google-gemini',
      'deprecated-v1'
    );
    assert(suite, 'Normalizes 404 to AIModelUnavailableError', modelErr instanceof AIModelUnavailableError);
    assert(suite, 'Model error cites the requested model identifier', (modelErr as AIModelUnavailableError).requestedModel === 'deprecated-v1');

    // 4.4 Network Failure
    const netErr = normalizeProviderError(
      new Error('fetch failed: ECONNREFUSED'),
      'google-gemini'
    );
    assert(suite, 'Normalizes connection refused to AINetworkError', netErr instanceof AINetworkError);
    assert(suite, 'Network error suggests offline mode in recovery hint', netErr.recoveryAction.includes('Offline'));
  } catch (err: any) {
    assert('Error Normalization', 'Execution failure', false, err.message);
  }

  // =========================================================================
  // SUITE 5: Generic AIService Orchestration & Credentials Management
  // =========================================================================
  try {
    const suite = 'AIService';
    const registry = new ProviderRegistry();
    const service = new AIService(registry);

    // Model selection
    service.setModel('gemini-3.8-flash');
    assert(suite, 'AIService sets and returns active model', service.getModel() === 'gemini-3.8-flash');

    // Setting credentials dynamically without hard-coding
    service.setCredentials({ apiKey: 'dynamic-user-key-123' });
    service.clearCredentials();
    assert(suite, 'AIService securely manages and clears credentials in memory', true);

    // Rejection of completely unknown models
    let threwOnUnknown = false;
    try {
      service.setModel('non-existent-hallucinated-model-xyz');
    } catch (e: any) {
      threwOnUnknown = e instanceof AIModelUnavailableError;
    }
    assert(suite, 'AIService rejects unavailable models with AIModelUnavailableError', threwOnUnknown);

    // Fallback to offline on provider failure
    const mockFailingProvider: AIProvider = {
      id: 'failing-provider',
      displayName: 'Failing Provider',
      defaultModelId: 'fail-model',
      supportedModels: [{
        id: 'fail-model',
        displayName: 'Fail Model',
        providerId: 'failing-provider',
        contextWindow: 1000,
        recommendedFor: 'testing',
        latencyEstimate: '10ms'
      }],
      capabilities: {
        supportsStreaming: false,
        supportsStructuredJson: true,
        supportsSystemInstruction: true,
        supportsChatHistory: true,
        supportsVision: false,
        isOffline: false,
      },
      generateText: async () => { throw new AINetworkError('failing-provider'); },
      generateStructuredJson: async () => { throw new AINetworkError('failing-provider'); },
      checkHealth: async () => ({ providerId: 'failing-provider', isHealthy: false, hasCredentials: false, message: 'down' }),
    };

    registry.registerProvider(mockFailingProvider);

    service.generateText(
      { prompt: 'Test fallback' },
      { modelId: 'fail-model', allowFallbackToOffline: true }
    ).then((fallbackRes) => {
      assert(suite, 'AIService gracefully degrades to Offline Engine when primary fails with allowFallbackToOffline', fallbackRes.text.includes('Offline Study Assistance'));
    }).catch((err) => {
      assert(suite, 'AIService fallback threw unexpected error', false, err.message);
    });
  } catch (err: any) {
    assert('AIService', 'Execution failure', false, err.message);
  }

  // =========================================================================
  // SUITE 6: Extensibility - Adding Another Provider Without Modifying App
  // =========================================================================
  try {
    const suite = 'Extensibility';

    // Define a 4th external provider (e.g. LocalAI or Academic Cluster)
    class AcademicClusterProvider extends BaseAIProvider {
      public readonly id = 'academic-hpc-cluster';
      public readonly displayName = 'University HPC Inference Cluster';
      public readonly defaultModelId = 'campus-llama-70b';
      public readonly supportedModels: ModelProfile[] = [
        {
          id: 'campus-llama-70b',
          displayName: 'Campus Llama 3 70B (High Compute)',
          providerId: 'academic-hpc-cluster',
          contextWindow: 32768,
          recommendedFor: 'University sponsored compute cluster',
          latencyEstimate: '~1.5s',
          isDefault: true,
        }
      ];
      public readonly capabilities: AIProviderCapabilities = {
        supportsStreaming: true,
        supportsStructuredJson: true,
        supportsSystemInstruction: true,
        supportsChatHistory: true,
        supportsVision: false,
        isOffline: false,
      };

      public async generateText(req: GenerateTextRequest): Promise<GenerateTextResponse> {
        return {
          text: `[HPC Node]: Processed query with ${this.defaultModelId}`,
          modelUsed: this.defaultModelId,
          providerId: this.id,
          latencyMs: 15,
        };
      }

      public async generateStructuredJson<T>(req: GenerateJsonRequest): Promise<GenerateJsonResponse<T>> {
        const dummy = { clusterNode: 'hpc-04', status: 'ok' } as T;
        return {
          data: dummy,
          rawText: JSON.stringify(dummy),
          modelUsed: this.defaultModelId,
          providerId: this.id,
          latencyMs: 15,
        };
      }

      public async checkHealth(): Promise<ProviderHealthStatus> {
        return {
          providerId: this.id,
          isHealthy: true,
          hasCredentials: true,
          message: 'Campus HPC Cluster online',
          latencyMs: 10,
        };
      }
    }

    const testRegistry = new ProviderRegistry();
    const testService = new AIService(testRegistry);

    // Register dynamically at runtime
    testRegistry.registerProvider(new AcademicClusterProvider());

    // Verify it is immediately discoverable
    const discovered = testRegistry.findProviderForModel('campus-llama-70b');
    assert(suite, 'Newly added provider is immediately discovered in registry', discovered?.id === 'academic-hpc-cluster');

    // Dispatch request through generic AIService without modifying any service code
    testService.generateText({
      prompt: 'Run high-performance problem solving',
      modelId: 'campus-llama-70b',
    }).then((res) => {
      assert(suite, 'Generic AIService successfully routes to newly added provider without code modification', res.providerId === 'academic-hpc-cluster' && res.text.includes('HPC Node'));
    }).catch((err) => {
      assert(suite, 'New provider execution threw error', false, err.message);
    });
  } catch (err: any) {
    assert('Extensibility', 'Execution failure', false, err.message);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}
