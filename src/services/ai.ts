import { AppState, TutorContext, TutorMode } from '../types';
import { aiService } from './ai/service';
import { 
  askContextAwareTutor, 
  constructTutorSystemPrompt,
  buildTutorContext,
  generateDeterministicTutorFallback 
} from './ai/tutorService';

export * from './ai/index';
export * from './ai/tutorService';

export interface PlanProposalResult {
  rationale: string;
  proposals: Array<{
    topicId?: string;
    subjectId?: string;
    title: string;
    plannedMinutes: number;
    reason: string;
    priorityScore: number;
  }>;
}

/**
 * Plan proposal delegating to generic AIService
 */
export async function requestAIPlanProposal(
  dateStr: string,
  state: AppState,
  netAvailableMinutes: number,
  fixedBlocks: any[],
  candidateTopics: any[]
): Promise<PlanProposalResult> {
  const recentFeedback = state.sessions.slice(0, 5).map((s) => {
    const sub = state.subjects.find((item) => item.id === s.subjectId);
    return {
      subjectName: sub?.name || 'Subject',
      comprehensionRating: s.comprehensionRating,
      energyRating: s.energyRating,
    };
  });

  const prompt = `You are the NEXORA Scheduling Advisory Engine.
The student has real constraints. You must propose an optimal study mission within the strict capacity limit.

Student Constraints:
- Target Date: ${dateStr}
- Available Study Time: ${netAvailableMinutes} minutes
- Fixed commitments today: ${JSON.stringify(fixedBlocks)}
- Enrolled subjects: ${JSON.stringify(state.subjects)}
- Ready Topics (Prerequisites met): ${JSON.stringify(candidateTopics.filter((t: any) => t.prerequisitesMet))}
- Recent session feedback & energy: ${JSON.stringify(recentFeedback)}

RULES:
1. Total planned minutes across all items MUST NOT exceed ${Math.floor(netAvailableMinutes * 0.85)} minutes.
2. If available time is under 45 minutes, propose only 1 high-leverage or review item.
3. Prioritize subjects with lowest weekly hours completed or topics with low mastery.`;

  const schemaDescription = `{
  "rationale": "string",
  "proposals": [
    {
      "topicId": "string",
      "subjectId": "string",
      "title": "string",
      "plannedMinutes": 45,
      "reason": "string",
      "priorityScore": 90
    }
  ]
}`;

  try {
    const res = await aiService.generateStructuredJson<PlanProposalResult>(
      {
        prompt,
        schemaDescription,
        modelId: state.profile.aiModel || 'gemini-3.8-flash',
        credentials: { apiKey: state.profile.apiKey },
      },
      {
        allowFallbackToOffline: true,
        userApiKey: state.profile.apiKey,
        modelId: state.profile.aiModel,
      }
    );
    return res.data;
  } catch (err: any) {
    console.warn('AIService plan call error, using local heuristic plan:', err?.message);

    // High quality deterministic fallback
    const safeMinutes = Math.min(netAvailableMinutes, Math.floor(netAvailableMinutes * 0.8));
    const ready = candidateTopics.filter((t: any) => t.prerequisitesMet);
    const sorted = [...ready].sort((a: any, b: any) => (a.masteryLevel || 0) - (b.masteryLevel || 0));

    const proposals = sorted.slice(0, 3).map((t: any, idx: number) => ({
      topicId: t.id,
      subjectId: t.subjectId,
      title: `Active Study: ${t.title}`,
      plannedMinutes: Math.min(45, Math.floor(safeMinutes / 2)),
      reason: `Prerequisites met and mastery is at ${t.masteryLevel || 0}%. High priority for study block ${idx + 1}.`,
      priorityScore: 90 - idx * 10,
    }));

    return {
      rationale: `Local-first deterministic planner budgeted ${safeMinutes}m study time from your ${netAvailableMinutes}m available window.`,
      proposals: proposals.length > 0 ? proposals : [
        {
          subjectId: state.subjects[0]?.id,
          title: `Study Session: ${state.subjects[0]?.name || 'Core Subject'}`,
          plannedMinutes: 45,
          reason: 'General subject study block to maintain weekly pacing.',
          priorityScore: 75,
        }
      ],
    };
  }
}

/**
 * Tutor turn delegating to generic AIService or context-aware tutor engine
 */
export async function askAITutor(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: {
    topicTitle?: string;
    subjectName?: string;
    currentMastery?: number;
  } | TutorContext,
  mode: TutorMode | 'socratic' | 'explain' | 'quiz' | 'breakdown' | string,
  userApiKey?: string,
  modelId?: string,
  isSoloMode?: boolean
): Promise<{ reply: string; isOfflineFallback?: boolean }> {
  // Normalize to TutorContext
  const isFullContext = (ctx: any): ctx is TutorContext => 'topic' in ctx || 'semester' in ctx || 'domain' in ctx;

  let tutorCtx: TutorContext;
  if (isFullContext(context)) {
    tutorCtx = context;
  } else {
    const simple = context as { topicTitle?: string; subjectName?: string; currentMastery?: number };
    tutorCtx = {
      topic: simple.topicTitle ? {
        id: 'topic-ctx',
        title: simple.topicTitle,
        description: '',
        masteryLevel: simple.currentMastery ?? 0,
        status: (simple.currentMastery ?? 0) >= 80 ? 'completed' : 'in_progress',
      } : undefined,
      subject: simple.subjectName ? {
        id: 'sub-ctx',
        code: simple.subjectName,
        name: simple.subjectName,
      } : undefined,
      topicMastery: simple.currentMastery ?? 0,
    };
  }

  // Map legacy mode strings to canonical TutorMode
  let canonicalMode: TutorMode = 'explain';
  if (mode === 'socratic' || mode === 'why') canonicalMode = 'why';
  else if (mode === 'quiz' || mode === 'test') canonicalMode = 'test';
  else if (mode === 'breakdown' || mode === 'analogy') canonicalMode = 'analogy';
  else if (mode === 'example') canonicalMode = 'example';
  else if (mode === 'practice') canonicalMode = 'practice';
  else if (mode === 'explain_back') canonicalMode = 'explain_back';
  else if (mode === 'review_answer') canonicalMode = 'review_answer';
  else canonicalMode = 'explain';

  return await askContextAwareTutor(messages, tutorCtx, canonicalMode, {
    isSoloMode,
    userApiKey,
    modelId,
  });
}

/**
 * Roadmap generator delegating to generic AIService
 */
export async function generateSubjectRoadmap(
  subjectName: string,
  subjectCode: string,
  syllabusNotes?: string,
  userApiKey?: string,
  modelId?: string
): Promise<{ topics: Array<{ title: string; description: string; estimatedMinutes: number; prerequisiteIndices: number[] }> }> {
  const prompt = `Generate a structured, sequential learning roadmap for the college subject: "${subjectName}" (${subjectCode || ''}).
${syllabusNotes ? `Additional Syllabus Context: ${syllabusNotes}` : ''}`;

  const schemaDescription = `{
  "topics": [
    {
      "title": "Introduction to Architecture",
      "description": "Fundamental concepts and essential abstractions",
      "estimatedMinutes": 45,
      "prerequisiteIndices": []
    }
  ]
}`;

  try {
    const res = await aiService.generateStructuredJson<{ topics: any[] }>(
      {
        prompt,
        schemaDescription,
        modelId: modelId || 'gemini-3.8-flash',
        credentials: { apiKey: userApiKey },
      },
      {
        allowFallbackToOffline: true,
        userApiKey,
        modelId,
      }
    );

    return res.data;
  } catch (err: any) {
    console.warn('AIService roadmap error:', err?.message);
    return {
      topics: [
        {
          title: `Foundations of ${subjectName}`,
          description: 'Core syntax, essential abstractions, and foundational mental models.',
          estimatedMinutes: 45,
          prerequisiteIndices: [],
        },
        {
          title: 'Architectural Patterns & Core Mechanisms',
          description: 'Primary internal algorithms, control structures, and standard protocols.',
          estimatedMinutes: 60,
          prerequisiteIndices: [0],
        },
        {
          title: 'Practical Application & Problem Solving',
          description: 'End-to-end implementation, edge cases, and exam-level scenario questions.',
          estimatedMinutes: 60,
          prerequisiteIndices: [1],
        },
        {
          title: 'Advanced Optimization & System Tradeoffs',
          description: 'Efficiency limits, scaling implications, and synthesis with other topics.',
          estimatedMinutes: 75,
          prerequisiteIndices: [1, 2],
        },
      ],
    };
  }
}
