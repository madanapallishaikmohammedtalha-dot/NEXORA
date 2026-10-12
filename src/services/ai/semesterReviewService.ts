/**
 * NEXORA AI Semester Review Engine & Meta-Evaluation Service
 * 
 * Generates high-level retrospective insights, trends, and strategic guidance
 * based on verified deterministic semester telemetry.
 * 
 * STRICT ARCHITECTURAL INVARIANT:
 * - Purely advisory: Never mutates historical records, completed semester data,
 *   topic mastery, timetable slots, or student goals.
 * - Always backed by a deterministic local fallback for 100% offline reliability.
 */

import {
  AISemesterReviewResponse,
  AppState,
  SemesterAchievementReport,
} from '../../types';
import { aiService } from './service';

export const SEMESTER_REVIEW_SYSTEM_INSTRUCTION = `You are NEXORA's Senior Academic & Engineering Career Advisor.
Your role is to analyze a completed academic semester's verified telemetry and provide an empowering, insightful retrospective.

STRICT INVARIANTS:
1. You are strictly advisory. You CANNOT mutate database records, change student goals, or modify topic mastery.
2. Ground all insights in the factual numbers provided (hours, sessions, comprehension ratings, goal progress).
3. Do not make unsupported psychological claims.
4. Provide concrete, actionable career and project recommendations.

Respond ONLY with valid JSON conforming to the requested schema.`;

/**
 * Builds the structured context payload sent to the AI evaluation engine.
 */
export function buildSemesterReviewAIContext(
  report: SemesterAchievementReport,
  state: AppState
): {
  studentName: string;
  degreeMajor: string;
  semesterName: string;
  duration: string;
  metrics: {
    totalActualHours: number;
    totalPlannedHours: number;
    executionPercentage: number;
    sessionsCount: number;
    avgComprehension: number;
    consistencyScore: number;
  };
  subjects: Array<{
    code: string;
    name: string;
    studyHours: number;
    progressPercentage: number;
    avgComprehension: number;
  }>;
  roadmap: {
    completed: number;
    inProgress: number;
    locked: number;
  };
  goals: {
    completed: number;
    incomplete: number;
  };
  timeDistribution: {
    academicHours: number;
    careerHours: number;
    projectHours: number;
    revisionHours: number;
  };
  strongestAreas: string[];
  weakAreas: string[];
} {
  return {
    studentName: state.profile.name,
    degreeMajor: state.profile.degreeMajor,
    semesterName: report.semesterName,
    duration: `${report.startDate} to ${report.endDate} (${report.durationDays} days)`,
    metrics: {
      totalActualHours: Number((report.totalActualStudyMinutes / 60).toFixed(1)),
      totalPlannedHours: Number((report.totalPlannedStudyMinutes / 60).toFixed(1)),
      executionPercentage: report.executionPercentage,
      sessionsCount: report.completedSessionsCount,
      avgComprehension: report.averageComprehension,
      consistencyScore: report.consistencyScore,
    },
    subjects: report.subjectBreakdowns.map((s) => ({
      code: s.code,
      name: s.name,
      studyHours: Number((s.actualStudyMinutes / 60).toFixed(1)),
      progressPercentage: s.progressPercentage,
      avgComprehension: s.averageComprehension,
    })),
    roadmap: {
      completed: report.topicsCompletedCount,
      inProgress: report.topicsInProgressCount,
      locked: report.topicsLockedCount,
    },
    goals: {
      completed: report.goalsCompletedCount,
      incomplete: report.goalsIncompleteCount,
    },
    timeDistribution: {
      academicHours: Number((report.academicMinutes / 60).toFixed(1)),
      careerHours: Number((report.careerMinutes / 60).toFixed(1)),
      projectHours: Number((report.projectMinutes / 60).toFixed(1)),
      revisionHours: Number((report.revisionMinutes / 60).toFixed(1)),
    },
    strongestAreas: report.strongestAreas.map((s) => `${s.name}: ${s.reason}`),
    weakAreas: report.needsAttention.map((w) => `${w.name}: ${w.reason}`),
  };
}

/**
 * Deterministic local fallback generator for offline mode or network errors.
 */
export function generateDeterministicAISemesterReview(
  context: ReturnType<typeof buildSemesterReviewAIContext>,
  report: SemesterAchievementReport
): AISemesterReviewResponse {
  const summary = `You completed ${report.semesterName} with ${context.metrics.totalActualHours}h of logged focused study across ${context.metrics.sessionsCount} sessions, achieving an execution rate of ${context.metrics.executionPercentage}% and a consistency rating of ${context.metrics.consistencyScore}%.`;

  const importantTrends = [
    `Deliberate practice was concentrated in ${context.strongestAreas[0]?.split(':')[0] || 'core subjects'} with an average comprehension of ${report.averageComprehension}★.`,
    `Roadmap velocity yielded ${report.topicsCompletedCount} fully mastered topics with ${report.topicsInProgressCount} active in progress.`,
  ];

  if (report.skippedSessionsCount >= 3) {
    importantTrends.push(`Mid-semester schedule friction led to ${report.skippedSessionsCount} skipped sessions, which were balanced by recovery blocks.`);
  }

  const strengths: string[] = report.strongestAreas.map((s) => s.name);
  if (strengths.length === 0) strengths.push('Consistent session start adherence');

  const weaknesses: string[] = report.needsAttention.map((w) => w.name);
  if (weaknesses.length === 0) weaknesses.push('Balancing theoretical review with hands-on implementation');

  const recommendedFutureFocus = [
    'Deepen Data Structures & Algorithms problem-solving routines ahead of recruiting season.',
    'Consolidate operating systems and concurrency primitives through practical implementations.',
    'Schedule regular spaced retrieval blocks early in the upcoming semester to avoid pre-exam cramming.',
  ];

  const skillsWorthExploring = [
    'Modern Cloud & Containerization (Docker, CI/CD pipelines)',
    'Low-Level Systems Programming (Rust or Go)',
    'Relational Database Indexing & Query Profiling',
  ];

  const recommendedProjectDirections = [
    'Full-Stack Distributed Key-Value Store with replication',
    'Custom Memory Allocator or POSIX Shell in C/Rust',
    'Interactive Visualizer for Graph & Tree Algorithms',
  ];

  return {
    summary,
    importantTrends,
    strengthsAndWeaknesses: {
      strengths,
      weaknesses,
    },
    recommendedFutureFocus,
    skillsWorthExploring,
    recommendedProjectDirections,
  };
}

/**
 * Requests an AI Semester Review, falling back to deterministic local generation.
 */
export async function requestAISemesterReview(
  report: SemesterAchievementReport,
  state: AppState
): Promise<AISemesterReviewResponse> {
  const context = buildSemesterReviewAIContext(report, state);

  if (state.profile.aiProvider === 'offline') {
    return generateDeterministicAISemesterReview(context, report);
  }

  const prompt = `Analyze this completed semester telemetry report and produce a strategic advisory retrospective:
${JSON.stringify(context, null, 2)}

Provide summary, important trends, strengths, weaknesses, future focus, skills to explore, and project directions.`;

  try {
    const res = await aiService.generateStructuredJson<AISemesterReviewResponse>(
      {
        prompt,
        systemInstruction: SEMESTER_REVIEW_SYSTEM_INSTRUCTION,
      },
      {
        allowFallbackToOffline: true,
        userApiKey: state.profile.apiKey,
      }
    );
    return sanitizeAISemesterReviewResponse(res.data, context, report);
  } catch (err) {
    console.warn('AI Semester Review API call failed, falling back to local engine:', err);
    return generateDeterministicAISemesterReview(context, report);
  }
}

/**
 * Sanitizes and validates AI output to protect system safety.
 */
export function sanitizeAISemesterReviewResponse(
  raw: any,
  context: ReturnType<typeof buildSemesterReviewAIContext>,
  report: SemesterAchievementReport
): AISemesterReviewResponse {
  if (!raw || typeof raw !== 'object') {
    return generateDeterministicAISemesterReview(context, report);
  }

  const fallback = generateDeterministicAISemesterReview(context, report);

  return {
    summary: typeof raw.summary === 'string' && raw.summary.trim().length > 10 ? raw.summary : fallback.summary,
    importantTrends: Array.isArray(raw.importantTrends) && raw.importantTrends.length > 0 ? raw.importantTrends : fallback.importantTrends,
    strengthsAndWeaknesses: {
      strengths: Array.isArray(raw.strengthsAndWeaknesses?.strengths) && raw.strengthsAndWeaknesses.strengths.length > 0
        ? raw.strengthsAndWeaknesses.strengths
        : fallback.strengthsAndWeaknesses.strengths,
      weaknesses: Array.isArray(raw.strengthsAndWeaknesses?.weaknesses) && raw.strengthsAndWeaknesses.weaknesses.length > 0
        ? raw.strengthsAndWeaknesses.weaknesses
        : fallback.strengthsAndWeaknesses.weaknesses,
    },
    recommendedFutureFocus: Array.isArray(raw.recommendedFutureFocus) && raw.recommendedFutureFocus.length > 0
      ? raw.recommendedFutureFocus
      : fallback.recommendedFutureFocus,
    skillsWorthExploring: Array.isArray(raw.skillsWorthExploring) && raw.skillsWorthExploring.length > 0
      ? raw.skillsWorthExploring
      : fallback.skillsWorthExploring,
    recommendedProjectDirections: Array.isArray(raw.recommendedProjectDirections) && raw.recommendedProjectDirections.length > 0
      ? raw.recommendedProjectDirections
      : fallback.recommendedProjectDirections,
  };
}
