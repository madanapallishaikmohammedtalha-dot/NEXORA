/**
 * NEXORA Weekly Review Advisory Service
 * 
 * Prepares strictly structured weekly context for the AI, constructs system instructions,
 * executes AI requests via AIService, and validates proposed recommendations.
 * 
 * CRITICAL ARCHITECTURAL BOUNDARY:
 * The AI acts SOLELY in an advisory capacity. It is strictly forbidden from:
 * - Directly mutating goals
 * - Directly modifying timetable records
 * - Directly altering mastery
 * - Directly writing to database storage
 * All suggestions are structured proposals that must be reviewed, modified,
 * accepted, or skipped by the user.
 */

import {
  AIWeeklyReviewContext,
  AIWeeklyReviewResponse,
  AppState,
  NextWeekProposedItem,
  WeeklyAnalyticsReport,
} from '../../types';
import { aiService } from './service';

/**
 * Builds the comprehensive structured context payload sent to the AI review engine.
 */
export function buildWeeklyReviewAIContext(
  report: WeeklyAnalyticsReport,
  state: AppState
): AIWeeklyReviewContext {
  const activeSemester = state.semesters.find((s) => s.id === state.activeSemesterId);

  return {
    studentName: state.profile.name || 'Student',
    degreeMajor: state.profile.degreeMajor || 'Computer Science',
    semesterName: activeSemester?.name || 'Active Semester',
    weekRange: {
      start: report.weekStartDate,
      end: report.weekEndDate,
    },
    metrics: {
      plannedMinutes: report.plannedStudyMinutes,
      actualMinutes: report.actualStudyMinutes,
      executionPercentage: report.executionPercentage,
      sessionsCompleted: report.completedSessionsCount,
      sessionsSkipped: report.skippedSessionsCount,
      sessionsMissed: report.missedSessionsCount,
      averageComprehension: report.averageComprehension,
      averageEnergy: report.averageEnergy,
      consistencyScore: report.consistency.score,
    },
    timeDistribution: {
      academicHours: Number((report.academicMinutes / 60).toFixed(1)),
      careerHours: Number((report.careerMinutes / 60).toFixed(1)),
      projectHours: Number((report.projectMinutes / 60).toFixed(1)),
      revisionHours: Number((report.revisionMinutes / 60).toFixed(1)),
    },
    subjectPacing: report.subjectBreakdowns.map((sb) => ({
      code: sb.code,
      actualHours: Number((sb.actualMinutes / 60).toFixed(1)),
      targetHours: sb.targetWeeklyHours,
      avgComprehension: sb.averageComprehension,
    })),
    masteryChanges: report.masteryChanges.map((mc) => ({
      title: mc.title,
      subjectCode: mc.subjectCode,
      delta: mc.deltaMastery,
    })),
    detectedPatterns: report.learningPatterns.map((p) => `${p.title}: ${p.description} (${p.evidence})`),
    strongestAreas: report.strongestAreas.map((s) => `${s.subjectCode} (${s.reason})`),
    weakAreas: report.weakAreas.map((w) => `${w.subjectCode} (${w.reason})`),
  };
}

/**
 * System instruction enforcing the pedagogical role and strict advisory boundary
 */
export const WEEKLY_REVIEW_SYSTEM_INSTRUCTION = `You are NEXORA's Academic Analytics & Meta-Cognitive Review Advisor.
Your mission is to provide rigorous, constructive, evidence-based feedback on the student's completed academic week,
and to advise them on strategic priorities and study distribution adjustments for next week.

CRITICAL ARCHITECTURAL BOUNDARY & SAFETY INVARIANTS:
1. ADVISORY ONLY: You have ZERO authority to mutate state, change database records, alter timetable slots, modify goals, or change topic mastery levels.
2. EVIDENCE GROUNDED: All observations, explanations, and advice must stem directly from the provided real metrics and detected patterns. Do NOT invent phantom study hours or assume feelings.
3. CONSTRUCTIVE & ACTIONABLE: Emphasize deliberate practice over passive tutorials. If comprehension was low, advise prerequisite revision before progression.
4. PROPOSED NEXT-WEEK FOCUS: Propose 3-5 concrete study targets with realistic session counts (2-3 sessions each) and clear data-driven justifications.

OUTPUT FORMAT:
You MUST respond with valid JSON adhering to the specified schema.`;

/**
 * Schema definition for structured JSON generation
 */
export const WEEKLY_REVIEW_SCHEMA = `{
  "interpretation": "2-3 sentences interpreting weekly execution vs plan",
  "learningObservations": ["observation 1", "observation 2", "observation 3"],
  "explanations": "Concrete explanation of why certain bottlenecks or strengths occurred",
  "recommendedPriorities": ["priority 1", "priority 2", "priority 3"],
  "distributionSuggestions": "Advice on rebalancing academic, career, and project time",
  "revisionRecommendations": ["revision action 1", "revision action 2"],
  "potentialBottlenecks": ["bottleneck 1", "bottleneck 2"],
  "proposedNextWeekPlan": [
    {
      "subjectCode": "CS 301",
      "title": "Topic or focus title",
      "recommendedSessions": 3,
      "estimatedMinutesPerSession": 45,
      "reason": "Specific data-grounded rationale",
      "category": "academic"
    }
  ]
}`;

/**
 * Generates an offline deterministic review fallback if API or offline provider is used
 */
export function generateDeterministicAIWeeklyReview(
  context: AIWeeklyReviewContext,
  report: WeeklyAnalyticsReport
): AIWeeklyReviewResponse {
  const comp = context.metrics.averageComprehension;
  const exec = context.metrics.executionPercentage;

  const interpretation = exec >= 80
    ? `Strong weekly execution at ${exec}% of planned study capacity (${context.metrics.sessionsCompleted} sessions completed). Pacing was sustainable with an average energy rating of ${context.metrics.averageEnergy}/5.`
    : `Executed ${exec}% of planned study capacity with ${context.metrics.sessionsCompleted} sessions completed and ${context.metrics.sessionsSkipped} skipped. Pacing reflects realistic time-budget constraints.`;

  const learningObservations = [
    ...report.deterministicObservations.slice(0, 3),
    `Consistency score reached ${context.metrics.consistencyScore}/100 across execution, practice chunks, and reflective assessment.`,
  ];

  const explanations = report.weakAreas.length > 0
    ? `Areas such as ${report.weakAreas.map((w) => w.subjectCode).join(', ')} experienced reduced momentum primarily due to schedule constraints or low comprehension feedback.`
    : `Even distribution observed across registered coursework with positive mastery progression.`;

  const recommendedPriorities = [
    report.weakAreas[0]
      ? `Prioritize prerequisite reinforcement in ${report.weakAreas[0].subjectCode}.`
      : 'Maintain deliberate practice momentum in core coursework.',
    context.timeDistribution.careerHours < 1.5
      ? 'Schedule 2 deliberate blocks for career skills (DSA / Algorithmic Practice).'
      : 'Continue regular algorithmic practice.',
    'Protect 15-minute buffers after campus lectures to prevent cognitive fatigue.',
  ];

  const distributionSuggestions = context.timeDistribution.projectHours === 0
    ? 'Consider dedicating at least one 45-minute block next week to practical project development to reinforce theoretical concepts.'
    : 'Current distribution between academic study and career practice is balanced.';

  const revisionRecommendations = report.masteryChanges.filter((m) => m.currentMastery < 80).map(
    (m) => `Run Socratic 'Explain It Back' or Practice mode for "${m.title}" (${m.subjectCode}) to cement mastery.`
  );
  if (revisionRecommendations.length === 0) {
    revisionRecommendations.push('Schedule a 30-minute spaced retrieval session for key terminology and proof outlines.');
  }

  const potentialBottlenecks = report.learningPatterns
    .filter((p) => p.severity === 'warning')
    .map((p) => `${p.title}: ${p.description}`);
  if (potentialBottlenecks.length === 0) {
    potentialBottlenecks.push('Ensure upcoming exam deadlines are tagged in daily mission check-ins.');
  }

  const proposedNextWeekPlan: AIWeeklyReviewResponse['proposedNextWeekPlan'] = report.weakAreas.map((w) => ({
    subjectCode: w.subjectCode,
    title: `${w.name} Core Practice`,
    recommendedSessions: 3,
    estimatedMinutesPerSession: 45,
    reason: `Target hours deficit remediation (${w.reason})`,
    category: 'academic' as const,
  }));

  if (proposedNextWeekPlan.length < 3) {
    proposedNextWeekPlan.push({
      subjectCode: 'DSA',
      title: 'Graph Traversal & Dynamic Programming',
      recommendedSessions: 2,
      estimatedMinutesPerSession: 45,
      reason: 'Sustained career interview preparedness and algorithmic problem solving.',
      category: 'career' as const,
    });
    proposedNextWeekPlan.push({
      subjectCode: 'REV',
      title: 'Spaced Retrieval & Flash Assessment',
      recommendedSessions: 2,
      estimatedMinutesPerSession: 30,
      reason: 'Consolidate newly acquired mastery before moving to advanced syllabus chapters.',
      category: 'revision' as const,
    });
  }

  return {
    interpretation,
    learningObservations,
    explanations,
    recommendedPriorities,
    distributionSuggestions,
    revisionRecommendations,
    potentialBottlenecks,
    proposedNextWeekPlan,
  };
}

/**
 * Validates and sanitizes AI response to prevent malformed proposals
 */
export function sanitizeAIWeeklyReviewResponse(
  raw: any,
  context: AIWeeklyReviewContext,
  report: WeeklyAnalyticsReport
): AIWeeklyReviewResponse {
  if (!raw || typeof raw !== 'object') {
    return generateDeterministicAIWeeklyReview(context, report);
  }

  const interpretation = typeof raw.interpretation === 'string' && raw.interpretation.trim().length > 0
    ? raw.interpretation.trim()
    : `Weekly study session review generated for ${context.studentName}.`;

  const learningObservations = Array.isArray(raw.learningObservations) && raw.learningObservations.length > 0
    ? raw.learningObservations.filter((item: any) => typeof item === 'string')
    : report.deterministicObservations.slice(0, 3);

  const explanations = typeof raw.explanations === 'string' && raw.explanations.trim().length > 0
    ? raw.explanations.trim()
    : 'Study distribution and comprehension ratings were analyzed from your session logs.';

  const recommendedPriorities = Array.isArray(raw.recommendedPriorities) && raw.recommendedPriorities.length > 0
    ? raw.recommendedPriorities.filter((item: any) => typeof item === 'string')
    : ['Focus on lowest mastery topics', 'Protect cognitive transition buffers'];

  const distributionSuggestions = typeof raw.distributionSuggestions === 'string' && raw.distributionSuggestions.trim().length > 0
    ? raw.distributionSuggestions.trim()
    : 'Balanced distribution recommended.';

  const revisionRecommendations = Array.isArray(raw.revisionRecommendations) && raw.revisionRecommendations.length > 0
    ? raw.revisionRecommendations.filter((item: any) => typeof item === 'string')
    : ['Review low-comprehension topics'];

  const potentialBottlenecks = Array.isArray(raw.potentialBottlenecks) && raw.potentialBottlenecks.length > 0
    ? raw.potentialBottlenecks.filter((item: any) => typeof item === 'string')
    : ['Check daily capacity before adding extra commitments'];

  const proposedNextWeekPlan: AIWeeklyReviewResponse['proposedNextWeekPlan'] = [];
  if (Array.isArray(raw.proposedNextWeekPlan)) {
    raw.proposedNextWeekPlan.forEach((item: any) => {
      if (item && typeof item.title === 'string') {
        proposedNextWeekPlan.push({
          subjectCode: typeof item.subjectCode === 'string' ? item.subjectCode : 'GEN',
          title: item.title,
          recommendedSessions: typeof item.recommendedSessions === 'number' ? Math.max(1, Math.min(5, item.recommendedSessions)) : 2,
          estimatedMinutesPerSession: typeof item.estimatedMinutesPerSession === 'number' ? item.estimatedMinutesPerSession : 45,
          reason: typeof item.reason === 'string' ? item.reason : 'Recommended study focus',
          category: ['academic', 'career', 'project', 'revision'].includes(item.category) ? item.category : 'academic',
        });
      }
    });
  }

  if (proposedNextWeekPlan.length === 0) {
    const fallback = generateDeterministicAIWeeklyReview(context, report);
    return {
      interpretation,
      learningObservations,
      explanations,
      recommendedPriorities,
      distributionSuggestions,
      revisionRecommendations,
      potentialBottlenecks,
      proposedNextWeekPlan: fallback.proposedNextWeekPlan,
    };
  }

  return {
    interpretation,
    learningObservations,
    explanations,
    recommendedPriorities,
    distributionSuggestions,
    revisionRecommendations,
    potentialBottlenecks,
    proposedNextWeekPlan,
  };
}

/**
 * Requests an AI Weekly Review via AIService
 */
export async function requestAIWeeklyReview(
  report: WeeklyAnalyticsReport,
  state: AppState
): Promise<AIWeeklyReviewResponse> {
  const context = buildWeeklyReviewAIContext(report, state);
  const prompt = `Review the student's completed academic week from ${context.weekRange.start} to ${context.weekRange.end}.
Structured Weekly Context:
${JSON.stringify(context, null, 2)}

Provide meta-cognitive analysis, evidence-based pattern insights, and next-week priority proposals.`;

  try {
    const res = await aiService.generateStructuredJson<AIWeeklyReviewResponse>(
      {
        prompt,
        systemInstruction: WEEKLY_REVIEW_SYSTEM_INSTRUCTION,
        schemaDescription: WEEKLY_REVIEW_SCHEMA,
        temperature: 0.2, // Low temperature for high factual accuracy
      },
      {
        allowFallbackToOffline: true,
        userApiKey: state.profile.apiKey,
      }
    );

    return sanitizeAIWeeklyReviewResponse(res.data, context, report);
  } catch (err) {
    console.warn('[WeeklyReview] AI provider failed, using deterministic review:', err);
    return generateDeterministicAIWeeklyReview(context, report);
  }
}
