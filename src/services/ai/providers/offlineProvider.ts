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

/**
 * Local-First Offline Deterministic Heuristic Engine
 * Implements provider interface without requiring internet or API credentials.
 * Specified in docs/PROVIDERS.md
 */
export class OfflineHeuristicProvider extends BaseAIProvider {
  public readonly id: AIProviderId = 'offline-heuristic';
  public readonly displayName = 'Local-First Offline Engine';
  public readonly defaultModelId = 'offline-heuristic';

  public readonly supportedModels: ModelProfile[] = [
    {
      id: 'offline-heuristic',
      displayName: 'Offline Heuristic Engine',
      providerId: 'offline-heuristic',
      contextWindow: 16384,
      recommendedFor: 'Flight mode, zero network connectivity, deterministic local execution',
      latencyEstimate: '< 5 ms',
      isDefault: true,
    },
  ];

  public readonly capabilities: AIProviderCapabilities = {
    supportsStreaming: false,
    supportsStructuredJson: true,
    supportsSystemInstruction: true,
    supportsChatHistory: true,
    supportsVision: false,
    isOffline: true,
  };

  public async generateText(request: GenerateTextRequest): Promise<GenerateTextResponse> {
    this.validateTextRequest(request);
    const model = this.resolveModelId(request.modelId);

    const { result, latencyMs } = await this.executeSafely('generateText', model, async () => {
      const lastMessage = request.prompt || request.messages?.[request.messages.length - 1]?.content || '';
      
      // Deterministic pedagogical scaffold
      const responseText = `### Offline Study Assistance (${this.displayName})

You are operating in **Offline Heuristic Mode** with zero external network dependencies.

**Active Reflection on:** "${lastMessage.slice(0, 100)}"

1. **First-Principles Decomposition**: Break this problem down into fundamental axioms. What are the inviolable rules governing this concept?
2. **Mechanisms & Control Flow**: Trace the sequence of state transitions step by step. Where does data or control transfer?
3. **Synthesis & Verification**: Formulate a concrete test case or counter-example to verify your mental model.

*(Tip: To enable live multimodal reasoning and dynamic dialogue, configure a Gemini API key in Settings)*`;

      return {
        text: responseText,
        modelUsed: model,
        providerId: this.id,
        finishReason: 'stop',
        usage: {
          promptTokens: Math.ceil(lastMessage.length / 4),
          completionTokens: Math.ceil(responseText.length / 4),
          totalTokens: Math.ceil((lastMessage.length + responseText.length) / 4),
        },
      };
    });

    return { ...result, latencyMs };
  }

  public async generateStructuredJson<T = unknown>(request: GenerateJsonRequest): Promise<GenerateJsonResponse<T>> {
    this.validateJsonRequest(request);
    const model = this.resolveModelId(request.modelId);

    const { result, latencyMs } = await this.executeSafely('generateStructuredJson', model, async () => {
      // Provide clean deterministic mock structures based on prompt keywords
      const promptLower = request.prompt.toLowerCase();
      let structuredData: any;

      if (promptLower.includes('plan') || promptLower.includes('proposal') || promptLower.includes('schedule')) {
        structuredData = {
          rationale: 'Local-first deterministic planner allocated study blocks according to priority weighting and prerequisite order.',
          proposals: [
            {
              title: 'Core Subject Foundations Review',
              plannedMinutes: 45,
              reason: 'Prioritized to maintain weekly academic pacing while offline.',
              priorityScore: 85,
            },
            {
              title: 'Problem Set Deep Work',
              plannedMinutes: 45,
              reason: 'Active recall and algorithmic problem solving.',
              priorityScore: 80,
            },
          ],
        };
      } else if (promptLower.includes('roadmap') || promptLower.includes('syllabus')) {
        structuredData = {
          topics: [
            {
              title: 'Foundations & Architectural Models',
              description: 'Fundamental definitions, abstractions, and standard paradigms.',
              estimatedMinutes: 45,
              prerequisiteIndices: [],
            },
            {
              title: 'Mechanisms & Core Protocols',
              description: 'Algorithmic mechanics, flow control, and data transformations.',
              estimatedMinutes: 60,
              prerequisiteIndices: [0],
            },
            {
              title: 'Application, Edge Cases & Verification',
              description: 'Practical problem solving, scenario testing, and performance analysis.',
              estimatedMinutes: 60,
              prerequisiteIndices: [1],
            },
          ],
        };
      } else {
        structuredData = {
          success: true,
          mode: 'offline-heuristic',
          message: 'Deterministic fallback response generated successfully.',
        };
      }

      const rawText = JSON.stringify(structuredData, null, 2);

      return {
        data: structuredData as T,
        rawText,
        modelUsed: model,
        providerId: this.id,
        usage: {
          promptTokens: Math.ceil(request.prompt.length / 4),
          completionTokens: Math.ceil(rawText.length / 4),
          totalTokens: Math.ceil((request.prompt.length + rawText.length) / 4),
        },
      };
    });

    return { ...result, latencyMs };
  }

  public async checkHealth(_credentials?: ProviderCredentials): Promise<ProviderHealthStatus> {
    return {
      providerId: this.id,
      isHealthy: true,
      hasCredentials: true,
      message: 'Local offline engine is fully functional and ready.',
      latencyMs: 1,
      modelChecked: this.defaultModelId,
    };
  }
}
