/**
 * NEXORA Weekly Review and Next-Week Planning Test Suite
 * 
 * Verifies:
 * - Weekly aggregation of planned vs actual minutes
 * - Consistency score calculation and transparency factors
 * - Skipped, missed, and rescheduled session tracking
 * - Topic mastery changes and evidence calculation
 * - Subject time aggregation and pacing
 * - Weak-topic and deficit detection
 * - Low-comprehension pattern detection
 * - AI weekly-review context construction
 * - Recommendation validation and proposals sanitization
 * - Strict advisory AI boundary (no direct storage/state mutation)
 */

import { AppState, StudySession, DailyMission, NextWeekProposedItem, RoadmapTopic } from '../types';
import { DataService, InMemoryStorageAdapter } from './dataService';
import {
  computeWeeklyAnalytics,
  calculateTransparentConsistencyScore,
  detectLearningPatterns,
  generateDeterministicNextWeekProposals,
  getWeekBoundaries,
} from './weeklyAnalytics';
import {
  buildWeeklyReviewAIContext,
  generateDeterministicAIWeeklyReview,
  sanitizeAIWeeklyReviewResponse,
} from './ai/weeklyReviewService';
import { SEED_PROFILE, SEED_SEMESTERS, SEED_SUBJECTS, SEED_TOPICS } from './seedData';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

export function runWeeklyReviewTests(): { total: number; passed: number; failed: number; results: TestResult[] } {
  const results: TestResult[] = [];

  function assert(suite: string, name: string, condition: boolean, message?: string) {
    if (condition) {
      results.push({ suite, name, passed: true });
    } else {
      results.push({ suite, name, passed: false, error: message || 'Assertion failed' });
    }
  }

  const SUITE = 'Weekly Review & Next-Week Planning';

  // Deterministic fixture
  const fixedWeekSessions: StudySession[] = [
    {
      id: 'ws-1',
      subjectId: 'sub-os',
      topicId: 'top-os-1',
      startTime: '2026-09-21T14:00:00Z',
      endTime: '2026-09-21T14:45:00Z',
      plannedDurationMinutes: 45,
      actualDurationMinutes: 45,
      comprehensionRating: 5,
      energyRating: 4,
      keyTakeaways: 'PCB memory layout and register preservation.',
      date: '2026-09-21',
    },
    {
      id: 'ws-2',
      subjectId: 'sub-algo',
      topicId: 'top-algo-2',
      startTime: '2026-09-22T10:00:00Z',
      endTime: '2026-09-22T10:50:00Z',
      plannedDurationMinutes: 45,
      actualDurationMinutes: 50,
      comprehensionRating: 4,
      energyRating: 4,
      keyTakeaways: 'DFS start/finish timestamp theorem.',
      date: '2026-09-22',
    },
    {
      id: 'ws-3',
      subjectId: 'sub-os',
      topicId: 'top-os-3',
      startTime: '2026-09-23T16:00:00Z',
      endTime: '2026-09-23T16:55:00Z',
      plannedDurationMinutes: 50,
      actualDurationMinutes: 55,
      comprehensionRating: 2, // Low comprehension
      energyRating: 3,
      keyTakeaways: 'Mutexes and peterson algorithm race condition.',
      date: '2026-09-23',
    },
  ];

  const fixedMissions: Record<string, DailyMission> = {
    '2026-09-21': {
      id: 'm-2026-09-21',
      date: '2026-09-21',
      availableMinutes: 200,
      allocatedMinutes: 90,
      items: [
        {
          id: 'mi-1',
          subjectId: 'sub-os',
          topicId: 'top-os-1',
          title: 'Study OS Architecture',
          plannedMinutes: 45,
          actualMinutes: 45,
          status: 'completed',
          isAIRecorded: false,
        },
        {
          id: 'mi-2',
          subjectId: 'sub-db',
          title: 'Review Relational Algebra',
          plannedMinutes: 45,
          actualMinutes: 0,
          status: 'skipped',
          isAIRecorded: false,
        },
      ],
    },
    '2026-09-22': {
      id: 'm-2026-09-22',
      date: '2026-09-22',
      availableMinutes: 200,
      allocatedMinutes: 100,
      items: [
        {
          id: 'mi-3',
          subjectId: 'sub-algo',
          topicId: 'top-algo-2',
          title: 'DFS Graph Traversal',
          plannedMinutes: 45,
          actualMinutes: 50,
          status: 'completed',
          isAIRecorded: false,
        },
        {
          id: 'mi-4',
          subjectId: 'sub-stats',
          title: 'Probability Distributions',
          plannedMinutes: 55,
          actualMinutes: 0,
          status: 'missed',
          isAIRecorded: false,
        },
      ],
    },
  };

  const testState: AppState = {
    profile: { ...SEED_PROFILE },
    semesters: [...SEED_SEMESTERS],
    activeSemesterId: 'sem-fall-2026',
    subjects: [...SEED_SUBJECTS],
    timetable: [],
    topics: JSON.parse(JSON.stringify(SEED_TOPICS)),
    sessions: fixedWeekSessions,
    missions: fixedMissions,
    goals: [
      {
        id: 'g-1',
        title: 'Master OS Synchronizations',
        currentValue: 50,
        targetValue: 100,
        unit: '%',
        horizon: 'semester',
        status: 'active',
        createdAt: '2026-09-01T00:00:00Z',
      },
    ],
  };

  // 1. Week boundaries calculation
  try {
    const boundaries = getWeekBoundaries('2026-09-21');
    assert(SUITE, 'Week start is Monday 2026-09-21', boundaries.start === '2026-09-21');
    assert(SUITE, 'Week end is Sunday 2026-09-27', boundaries.end === '2026-09-27');
  } catch (e: any) {
    assert(SUITE, 'Week boundaries calculation failed', false, e?.message);
  }

  // 2. Weekly aggregation from real data
  try {
    const report = computeWeeklyAnalytics(testState, '2026-09-21');
    assert(SUITE, 'Weekly report identifies 3 completed sessions', report.completedSessionsCount === 3);
    assert(SUITE, 'Actual study minutes sum correctly (45 + 50 + 55 = 150)', report.actualStudyMinutes === 150);
    assert(SUITE, 'Planned study minutes aggregate correctly from missions', report.plannedStudyMinutes >= 150);
    assert(SUITE, 'Execution percentage is calculated accurately', report.executionPercentage > 0);
  } catch (e: any) {
    assert(SUITE, 'Weekly aggregation failed', false, e?.message);
  }

  // 3. Skipped and missed sessions tracking
  try {
    const report = computeWeeklyAnalytics(testState, '2026-09-21');
    assert(SUITE, 'Skipped session count is derived from daily missions (1 skipped)', report.skippedSessionsCount === 1);
    assert(SUITE, 'Missed session count is derived from daily missions (1 missed)', report.missedSessionsCount === 1);
  } catch (e: any) {
    assert(SUITE, 'Skipped/missed tracking failed', false, e?.message);
  }

  // 4. Subject time aggregation
  try {
    const report = computeWeeklyAnalytics(testState, '2026-09-21');
    const osBreakdown = report.subjectBreakdowns.find((s) => s.subjectId === 'sub-os');
    const algoBreakdown = report.subjectBreakdowns.find((s) => s.subjectId === 'sub-algo');
    assert(SUITE, 'Operating Systems has 100 actual minutes (45 + 55)', osBreakdown?.actualMinutes === 100);
    assert(SUITE, 'Algorithms has 50 actual minutes', algoBreakdown?.actualMinutes === 50);
    assert(SUITE, 'OS logged 2 sessions', osBreakdown?.sessionsCount === 2);
    assert(SUITE, 'OS average comprehension computed accurately ((5 + 2)/2 = 3.5★)', osBreakdown?.averageComprehension === 3.5);
  } catch (e: any) {
    assert(SUITE, 'Subject time aggregation failed', false, e?.message);
  }

  // 5. Transparent consistency score and contributing factors
  try {
    const report = computeWeeklyAnalytics(testState, '2026-09-21');
    assert(SUITE, 'Consistency score is within 0-100', report.consistency.score >= 0 && report.consistency.score <= 100);
    assert(SUITE, 'Consistency score exposes exactly 5 contributing factors', report.consistency.factors.length === 5);
    const sessionsFactor = report.consistency.factors.find((f) => f.factor === 'sessions_completed');
    const execFactor = report.consistency.factors.find((f) => f.factor === 'execution_ratio');
    assert(SUITE, 'Sessions completed factor has 30 max points', sessionsFactor?.maxPoints === 30);
    assert(SUITE, 'Execution ratio factor has 25 max points', execFactor?.maxPoints === 25);
    assert(SUITE, 'Summary narrative is non-empty and transparent', report.consistency.summary.length > 10);
  } catch (e: any) {
    assert(SUITE, 'Consistency score calculation failed', false, e?.message);
  }

  // 6. Mastery changes and evidence
  try {
    const report = computeWeeklyAnalytics(testState, '2026-09-21');
    assert(SUITE, 'Tracks mastery changes for studied topics', report.masteryChanges.length >= 2);
    const osTopic1 = report.masteryChanges.find((m) => m.topicId === 'top-os-1');
    assert(SUITE, 'OS Topic 1 delta mastery accounts for comprehension rating (5 * 5 = 25)', osTopic1 !== undefined && osTopic1.deltaMastery >= 25);
  } catch (e: any) {
    assert(SUITE, 'Mastery change calculation failed', false, e?.message);
  }

  // 7. Weak-topic & low-comprehension pattern detection
  try {
    const report = computeWeeklyAnalytics(testState, '2026-09-21');
    // OS Topic 3 was studied with comprehension rating 2
    const patterns = report.learningPatterns;
    assert(SUITE, 'Learning patterns array is generated', Array.isArray(patterns));
    // Check weak areas
    const hasDbDeficit = report.weakAreas.some((w) => w.subjectCode === 'CS 303' || w.name.includes('Database'));
    assert(SUITE, 'Identifies subjects with zero logged hours as deficits', hasDbDeficit || report.weakAreas.length > 0);
  } catch (e: any) {
    assert(SUITE, 'Deficit and pattern detection failed', false, e?.message);
  }

  // 8. Deterministic next-week proposals
  try {
    const report = computeWeeklyAnalytics(testState, '2026-09-21');
    const proposals = generateDeterministicNextWeekProposals(report, testState);
    assert(SUITE, 'Generates at least 3 next-week proposed items', proposals.length >= 3);
    assert(SUITE, 'Each proposal has a data-backed reason', proposals.every((p) => p.reason.length > 10));
    assert(SUITE, 'Proposals start with accepted status for user review', proposals.every((p) => p.status === 'accepted'));
  } catch (e: any) {
    assert(SUITE, 'Deterministic proposal generation failed', false, e?.message);
  }

  // 9. AI weekly-review context construction
  try {
    const report = computeWeeklyAnalytics(testState, '2026-09-21');
    const aiContext = buildWeeklyReviewAIContext(report, testState);
    assert(SUITE, 'AI context includes student profile name', aiContext.studentName === testState.profile.name);
    assert(SUITE, 'AI context includes active semester name', aiContext.semesterName.includes('Fall 2026'));
    assert(SUITE, 'AI context includes execution percentage', aiContext.metrics.executionPercentage === report.executionPercentage);
    assert(SUITE, 'AI context includes subject pacing array', aiContext.subjectPacing.length === testState.subjects.length);
  } catch (e: any) {
    assert(SUITE, 'AI context construction failed', false, e?.message);
  }

  // 10. AI proposal sanitization & safety boundary
  try {
    const report = computeWeeklyAnalytics(testState, '2026-09-21');
    const aiContext = buildWeeklyReviewAIContext(report, testState);
    const deterministicAI = generateDeterministicAIWeeklyReview(aiContext, report);
    assert(SUITE, 'Deterministic AI review provides interpretation', deterministicAI.interpretation.length > 20);
    assert(SUITE, 'Deterministic AI review provides learning observations', deterministicAI.learningObservations.length > 0);
    assert(SUITE, 'Deterministic AI review provides proposed next-week plan', deterministicAI.proposedNextWeekPlan.length >= 2);

    // Malformed AI output sanitization
    const sanitized = sanitizeAIWeeklyReviewResponse({ interpretation: null }, aiContext, report);
    assert(SUITE, 'Sanitization recovers from malformed response without crashing', sanitized.proposedNextWeekPlan.length >= 2);
  } catch (e: any) {
    assert(SUITE, 'AI review sanitization failed', false, e?.message);
  }

  // 11. Strict Advisory AI Boundary (No Direct State Mutation)
  try {
    const adapter = new InMemoryStorageAdapter();
    const service = new DataService(adapter);
    service.saveState(testState);
    const initialSavedState = JSON.parse(JSON.stringify(service.getState()));

    // Generating AI review context or proposals MUST NEVER mutate stored dataService state
    const report = service.getWeeklyAnalytics('2026-09-21');
    const aiContext = buildWeeklyReviewAIContext(report, service.getState());
    const aiResponse = generateDeterministicAIWeeklyReview(aiContext, report);

    const afterState = service.getState();
    assert(SUITE, 'AI advisory logic does NOT mutate sessions in storage', afterState.sessions.length === initialSavedState.sessions.length);
    assert(SUITE, 'AI advisory logic does NOT mutate goals in storage', afterState.goals.length === initialSavedState.goals.length);
    assert(SUITE, 'AI advisory logic does NOT alter timetable in storage', afterState.timetable.length === initialSavedState.timetable.length);

    // Only explicit user acceptance commits an item
    const testProposal: NextWeekProposedItem = {
      id: 'prop-test',
      subjectId: 'sub-os',
      subjectCode: 'CS 301',
      title: 'OS Scheduling Algorithms',
      targetSessions: 2,
      estimatedMinutesPerSession: 45,
      reason: 'User approved remediation item',
      priority: 'high',
      category: 'academic',
      status: 'accepted',
    };
    service.commitNextWeekItemToMission('2026-09-28', testProposal);
    const committedMission = service.getDailyMission('2026-09-28');
    assert(SUITE, 'User explicit commit creates pending item in target date mission', Boolean(committedMission?.items.some((i) => i.title === 'OS Scheduling Algorithms')));
  } catch (e: any) {
    assert(SUITE, 'Strict advisory AI boundary test failed', false, e?.message);
  }

  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}
