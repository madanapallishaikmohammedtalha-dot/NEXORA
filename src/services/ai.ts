import { AppState } from '../types';
import { aiService } from './ai/service';
export * from './ai/index';

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
 * Tutor turn delegating to generic AIService
 */
export async function askAITutor(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: {
    topicTitle?: string;
    subjectName?: string;
    currentMastery?: number;
  },
  mode: 'socratic' | 'explain' | 'quiz' | 'breakdown',
  userApiKey?: string,
  modelId?: string
): Promise<{ reply: string }> {
  const topicContext = context.topicTitle ? `Topic: ${context.topicTitle} (${context.subjectName || ''})` : 'Academic Mentorship';
  const systemInstruction = `You are NEXORA's Socratic AI Tutor. Mode: ${mode}. Context: ${topicContext}.`;

  try {
    const res = await aiService.generateText(
      {
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        systemInstruction,
        modelId: modelId || 'gemini-3.8-flash',
        credentials: { apiKey: userApiKey },
      },
      {
        allowFallbackToOffline: true,
        userApiKey,
        modelId,
      }
    );

    return { reply: res.text };
  } catch (err: any) {
    console.warn('AIService tutor error:', err?.message);
    const lastMsg = messages[messages.length - 1]?.content || '';
    return {
      reply: `### Socratic Reflection: ${context.topicTitle || 'Core Concept'}\n\nTo master **"${lastMsg}"**, consider this question:\n\n*What is the critical constraint or assumption this concept relies on, and what would fail if that constraint were violated?*\n\n*(Note: Running in offline local mode. Configure your API key in Settings to unlock real-time Gemini tutoring)*`,
    };
  }
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
