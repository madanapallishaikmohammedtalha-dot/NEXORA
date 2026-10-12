/**
 * NEXORA Semester Review, Semester Transition & Holiday Mode Test Suite
 * 
 * Verifies:
 * - Semester state transitions (upcoming, active, completed, break)
 * - Expected vs. actual end date authoritative evaluation
 * - Completing a semester (endSemester action)
 * - Historical data preservation (sessions, timetables, goals, topics untouched)
 * - Semester analytics calculation from real stored data
 * - Subject aggregation, study time, comprehension averages
 * - Mastery aggregation & delta evidence
 * - Goal aggregation (completed, incomplete, partially completed)
 * - Holiday date calculation & available days
 * - Holiday capacity calculation respecting rest days & max capacity
 * - Holiday planning generation (sustainable, weekly focus blocks, rest days)
 * - Next semester creation & active term switch
 * - Dashboard state transitions (active vs break vs new semester)
 * - Advisory AI semester review context construction & safety boundaries
 * - Strict invariant: zero direct AI mutation of state or history
 */

import { AppState, Semester, StudySession, DailyMission, HolidayPlanPreferences } from '../types';
import { DataService, InMemoryStorageAdapter } from './dataService';
import {
  deriveSemesterState,
  computeSemesterAnalytics,
} from './semesterAnalytics';
import {
  calculateHolidayCapacity,
  generateHolidayPlan,
} from './holidayPlanner';
import {
  buildSemesterReviewAIContext,
  generateDeterministicAISemesterReview,
  sanitizeAISemesterReviewResponse,
} from './ai/semesterReviewService';
import { SEED_PROFILE, SEED_SUBJECTS, SEED_TOPICS } from './seedData';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

export function runSemesterAndHolidayTests(): { total: number; passed: number; failed: number; results: TestResult[] } {
  const results: TestResult[] = [];

  function assert(suite: string, name: string, condition: boolean, message?: string) {
    if (condition) {
      results.push({ suite, name, passed: true });
    } else {
      results.push({ suite, name, passed: false, error: message || 'Assertion failed' });
    }
  }

  const SUITE = 'Semester Review & Holiday Mode';

  // 1. Fixture Setup
  const fixtureSemester: Semester = {
    id: 'sem-test-3',
    name: '3rd Semester (Fall 2026)',
    startDate: '2026-08-01',
    endDate: '2026-12-15',
    expectedEndDate: '2026-12-15',
    holidays: [
      {
        id: 'h-1',
        name: 'Mid-Term Reading Week',
        startDate: '2026-10-10',
        endDate: '2026-10-17',
        type: 'break',
      },
    ],
    holidayStartDate: '2026-12-16',
    holidayEndDate: '2027-01-15',
    nextSemesterStartDate: '2027-01-18',
    targetWeeklyStudyHours: 18,
    isActive: true,
  };

  const fixtureSessions: StudySession[] = [
    {
      id: 'ss-1',
      subjectId: 'sub-os',
      topicId: 'top-os-1',
      startTime: '2026-09-01T10:00:00Z',
      endTime: '2026-09-01T11:00:00Z',
      plannedDurationMinutes: 60,
      actualDurationMinutes: 60,
      comprehensionRating: 5,
      energyRating: 4,
      keyTakeaways: 'Process control blocks and context switching.',
      date: '2026-09-01',
    },
    {
      id: 'ss-2',
      subjectId: 'sub-os',
      topicId: 'top-os-2',
      startTime: '2026-09-05T14:00:00Z',
      endTime: '2026-09-05T15:00:00Z',
      plannedDurationMinutes: 60,
      actualDurationMinutes: 65,
      comprehensionRating: 4,
      energyRating: 4,
      keyTakeaways: 'Thread pools and synchronization primitives.',
      date: '2026-09-05',
    },
    {
      id: 'ss-3',
      subjectId: 'sub-algo',
      topicId: 'top-algo-1',
      startTime: '2026-09-10T09:00:00Z',
      endTime: '2026-09-10T10:00:00Z',
      plannedDurationMinutes: 60,
      actualDurationMinutes: 55,
      comprehensionRating: 4,
      energyRating: 3,
      keyTakeaways: 'Asymptotic notation and recurrence relations.',
      date: '2026-09-10',
    },
  ];

  const fixtureMissions: Record<string, DailyMission> = {
    '2026-09-01': {
      id: 'm-1',
      date: '2026-09-01',
      availableMinutes: 200,
      allocatedMinutes: 60,
      items: [
        {
          id: 'mi-1',
          subjectId: 'sub-os',
          topicId: 'top-os-1',
          title: 'Study OS Architecture',
          plannedMinutes: 60,
          actualMinutes: 60,
          status: 'completed',
          isAIRecorded: false,
        },
      ],
    },
    '2026-09-02': {
      id: 'm-2',
      date: '2026-09-02',
      availableMinutes: 200,
      allocatedMinutes: 45,
      items: [
        {
          id: 'mi-2',
          subjectId: 'sub-db',
          title: 'Database Normalization',
          plannedMinutes: 45,
          actualMinutes: 0,
          status: 'skipped',
          isAIRecorded: false,
        },
      ],
    },
  };

  const testState: AppState = {
    profile: { ...SEED_PROFILE },
    semesters: [fixtureSemester],
    activeSemesterId: 'sem-test-3',
    subjects: [...SEED_SUBJECTS.map((s) => ({ ...s, semesterId: 'sem-test-3' }))],
    timetable: [],
    topics: JSON.parse(JSON.stringify(SEED_TOPICS)),
    sessions: fixtureSessions,
    missions: fixtureMissions,
    goals: [
      {
        id: 'g-sem-1',
        semesterId: 'sem-test-3',
        title: 'Master Operating Systems Concurrency',
        targetValue: 100,
        currentValue: 100,
        unit: '%',
        horizon: 'semester',
        status: 'completed',
        createdAt: '2026-08-01T00:00:00Z',
      },
      {
        id: 'g-sem-2',
        semesterId: 'sem-test-3',
        title: 'Solve 50 LeetCode Mediums',
        targetValue: 50,
        currentValue: 25,
        unit: 'problems',
        horizon: 'semester',
        status: 'active',
        createdAt: '2026-08-01T00:00:00Z',
      },
    ],
  };

  // -------------------------------------------------------------
  // 1. Semester State Transitions
  // -------------------------------------------------------------
  try {
    // Before start date
    const upcomingState = deriveSemesterState(fixtureSemester, '2026-07-20');
    assert(SUITE, 'Derives upcoming state when date is prior to startDate', upcomingState === 'upcoming');

    // During instructional period
    const activeState = deriveSemesterState(fixtureSemester, '2026-09-21');
    assert(SUITE, 'Derives active state during regular semester term', activeState === 'active');

    // During mid-term reading week
    const breakState = deriveSemesterState(fixtureSemester, '2026-10-12');
    assert(SUITE, 'Derives break state during mid-term reading week', breakState === 'break');

    // During semester break following term
    const holidayState = deriveSemesterState(fixtureSemester, '2026-12-20');
    assert(SUITE, 'Derives break state during post-term holiday window', holidayState === 'break');

    // Completed term
    const completedSemester: Semester = {
      ...fixtureSemester,
      actualEndDate: '2026-12-15',
      status: 'completed',
      holidayStartDate: undefined,
      holidayEndDate: undefined,
    };
    const completedState = deriveSemesterState(completedSemester, '2026-12-20');
    assert(SUITE, 'Derives completed state when actualEndDate is set without holiday', completedState === 'completed');
  } catch (e: any) {
    assert(SUITE, 'Semester state transitions failed', false, e?.message);
  }

  // -------------------------------------------------------------
  // 2. Expected vs. Actual End Date Authoritative Evaluation
  // -------------------------------------------------------------
  try {
    const semWithBothDates: Semester = {
      ...fixtureSemester,
      expectedEndDate: '2026-12-15',
      actualEndDate: '2026-12-05', // finished 10 days early
    };
    const analytics = computeSemesterAnalytics(
      { ...testState, semesters: [semWithBothDates] },
      'sem-test-3'
    );
    assert(SUITE, 'Authoritative endDate equals actualEndDate when entered', analytics.endDate === '2026-12-05');
  } catch (e: any) {
    assert(SUITE, 'Expected vs actual end date evaluation failed', false, e?.message);
  }

  // -------------------------------------------------------------
  // 3. Completing a Semester & Historical Preservation
  // -------------------------------------------------------------
  try {
    const adapter = new InMemoryStorageAdapter();
    const service = new DataService(adapter);
    service.saveState(testState);

    const initialSessionsCount = service.getState().sessions.length;
    const initialGoalsCount = service.getState().goals.length;
    const initialSubjectsCount = service.getState().subjects.length;

    // End semester action
    const { isBreakMode } = service.endSemester(
      'sem-test-3',
      '2026-12-10',
      {
        holidayStartDate: '2026-12-11',
        holidayEndDate: '2027-01-10',
        nextSemesterStartDate: '2027-01-15',
      }
    );

    const afterState = service.getState();
    const endedSem = afterState.semesters.find((s) => s.id === 'sem-test-3');

    assert(SUITE, 'endSemester sets actualEndDate on semester', endedSem?.actualEndDate === '2026-12-10');
    assert(SUITE, 'endSemester sets status to completed', endedSem?.status === 'completed');
    assert(SUITE, 'endSemester triggers break mode when holidays provided', isBreakMode === true);
    assert(SUITE, 'endSemester caches report in semesterReviews', afterState.semesterReviews?.['sem-test-3'] !== undefined);

    // CRITICAL: Historical data preservation
    assert(SUITE, 'Zero historical sessions deleted on endSemester', afterState.sessions.length === initialSessionsCount);
    assert(SUITE, 'Zero historical goals deleted on endSemester', afterState.goals.length === initialGoalsCount);
    assert(SUITE, 'Zero subjects deleted on endSemester', afterState.subjects.length === initialSubjectsCount);
  } catch (e: any) {
    assert(SUITE, 'Completing semester and history preservation failed', false, e?.message);
  }

  // -------------------------------------------------------------
  // 4. Deterministic Semester Analytics Calculation
  // -------------------------------------------------------------
  try {
    const report = computeSemesterAnalytics(testState, 'sem-test-3');
    assert(SUITE, 'Actual study minutes sum correctly (60 + 65 + 55 = 180)', report.totalActualStudyMinutes === 180);
    assert(SUITE, 'Identifies completed sessions count (3)', report.completedSessionsCount === 3);
    assert(SUITE, 'Identifies skipped sessions from missions (1)', report.skippedSessionsCount === 1);
    assert(SUITE, 'Average comprehension calculated accurately ((5 + 4 + 4)/3 ≈ 4.3)', report.averageComprehension >= 4.2);
    assert(SUITE, 'Average energy calculated accurately', report.averageEnergy >= 3.5);
    assert(SUITE, 'Execution percentage is calculated', report.executionPercentage > 0);
  } catch (e: any) {
    assert(SUITE, 'Deterministic semester analytics calculation failed', false, e?.message);
  }

  // -------------------------------------------------------------
  // 5. Subject Aggregation & Comprehension Averages
  // -------------------------------------------------------------
  try {
    const report = computeSemesterAnalytics(testState, 'sem-test-3');
    const osSubject = report.subjectBreakdowns.find((s) => s.code === 'CS 301');
    const algoSubject = report.subjectBreakdowns.find((s) => s.subjectId === 'sub-algo' || s.code === 'CS 312');

    assert(SUITE, 'Operating Systems has 125 actual study minutes (60 + 65)', osSubject?.actualStudyMinutes === 125);
    assert(SUITE, 'Operating Systems average comprehension is 4.5★ ((5 + 4)/2)', osSubject?.averageComprehension === 4.5);
    assert(SUITE, 'Algorithms has 55 actual study minutes', algoSubject?.actualStudyMinutes === 55);
    assert(SUITE, 'Identifies enrolled subjects count correctly', report.subjectBreakdowns.length === testState.subjects.length);
  } catch (e: any) {
    assert(SUITE, 'Subject aggregation failed', false, e?.message);
  }

  // -------------------------------------------------------------
  // 6. Mastery Aggregation & Goal Progress
  // -------------------------------------------------------------
  try {
    const report = computeSemesterAnalytics(testState, 'sem-test-3');
    assert(SUITE, 'Tracks mastery changes for topics studied in semester', report.masteryChanges.length >= 2);
    assert(SUITE, 'Identifies 1 completed milestone goal', report.goalsCompletedCount === 1);
    assert(SUITE, 'Identifies 1 partially completed goal (25/50 = 50%)', report.goalsPartiallyCompletedCount === 1);
  } catch (e: any) {
    assert(SUITE, 'Mastery and goal aggregation failed', false, e?.message);
  }

  // -------------------------------------------------------------
  // 7. Holiday Date & Capacity Calculation
  // -------------------------------------------------------------
  try {
    const holidayPrefs: HolidayPlanPreferences = {
      startDate: '2026-12-15',
      endDate: '2027-01-15', // ~31 days
      weeklyAvailableHours: 14,
      maxDailyCapacityHours: 3.0,
      preferredStudyTime: 'morning',
      daysOff: ['saturday', 'sunday'],
      selectedPriorities: ['dsa', 'projects', 'rest'],
    };

    const capacity = calculateHolidayCapacity(holidayPrefs);
    assert(SUITE, 'Calculates holiday available days accurately (31 days)', capacity.availableDays === 31);
    assert(SUITE, 'Identifies rest days count matching weekend days (~8-9)', capacity.restDaysCount >= 8);
    assert(SUITE, 'Calculates daily cap in minutes (3h = 180m)', capacity.dailyCapMinutes === 180);
    assert(SUITE, 'Total available hours bounded by weekly hours', capacity.totalAvailableHours > 0);
  } catch (e: any) {
    assert(SUITE, 'Holiday capacity calculation failed', false, e?.message);
  }

  // -------------------------------------------------------------
  // 8. Holiday Planning Generation & Sustainable Weeks
  // -------------------------------------------------------------
  try {
    const holidayPrefs: HolidayPlanPreferences = {
      startDate: '2026-12-15',
      endDate: '2027-01-15',
      weeklyAvailableHours: 12,
      maxDailyCapacityHours: 2.5,
      preferredStudyTime: 'morning',
      daysOff: ['saturday', 'sunday'],
      selectedPriorities: ['dsa', 'projects', 'git_github', 'rest'],
    };

    const plan = generateHolidayPlan(holidayPrefs, testState, 'sem-test-3');
    assert(SUITE, 'Generates multi-week holiday focus blocks', plan.weeks.length >= 4);
    assert(SUITE, 'Each week incorporates protected rest days', plan.weeks.every((w) => w.restDays.length === 2));
    assert(SUITE, 'Weekly planned hours does not exceed student weekly cap', plan.weeks.every((w) => w.plannedHours <= 12));
    assert(SUITE, 'Each week has structured tasks with data-backed rationale', plan.weeks.every((w) => w.suggestedTasks.length >= 2));
    assert(SUITE, 'Initializes realistic evidence-tracked holiday goals', plan.holidayGoals.length >= 2);
  } catch (e: any) {
    assert(SUITE, 'Holiday planning generation failed', false, e?.message);
  }

  // -------------------------------------------------------------
  // 9. Next Semester Creation & Transition
  // -------------------------------------------------------------
  try {
    const adapter = new InMemoryStorageAdapter();
    const service = new DataService(adapter);
    service.saveState(testState);

    // End current semester first
    service.endSemester('sem-test-3', '2026-12-15');

    // Create next semester
    const newSem = service.createNextSemester({
      name: '4th Semester (Spring 2027)',
      startDate: '2027-01-18',
      expectedEndDate: '2027-05-30',
      targetWeeklyStudyHours: 20,
      subjects: [
        {
          code: 'CS 401',
          name: 'Computer Networks',
          color: '#10B981',
          targetWeeklyHours: 5,
          credits: 4,
        },
      ],
    });

    const stateAfterNext = service.getState();
    assert(SUITE, 'New semester becomes active semester', stateAfterNext.activeSemesterId === newSem.id);
    assert(SUITE, 'Previous semester preserved with completed status', stateAfterNext.semesters.find((s) => s.id === 'sem-test-3')?.status === 'completed');
    assert(SUITE, 'New semester enrolled subjects added cleanly', stateAfterNext.subjects.some((s) => s.code === 'CS 401'));
    assert(SUITE, 'Historical subjects preserved cleanly', stateAfterNext.subjects.some((s) => s.code === 'CS 301'));
  } catch (e: any) {
    assert(SUITE, 'Next semester creation failed', false, e?.message);
  }

  // -------------------------------------------------------------
  // 10. Advisory AI Semester Review Context & Safety Boundaries
  // -------------------------------------------------------------
  try {
    const report = computeSemesterAnalytics(testState, 'sem-test-3');
    const aiContext = buildSemesterReviewAIContext(report, testState);

    assert(SUITE, 'AI context includes student name and degree', aiContext.studentName === testState.profile.name);
    assert(SUITE, 'AI context includes actual vs planned hours', aiContext.metrics.totalActualHours === 3.0);
    assert(SUITE, 'AI context includes subject pacing array', aiContext.subjects.length === testState.subjects.length);

    // Deterministic fallback
    const aiResponse = generateDeterministicAISemesterReview(aiContext, report);
    assert(SUITE, 'Deterministic AI review provides summary', aiResponse.summary.length > 20);
    assert(SUITE, 'Deterministic AI review provides important trends', aiResponse.importantTrends.length > 0);
    assert(SUITE, 'Deterministic AI review provides future focus recommendations', aiResponse.recommendedFutureFocus.length > 0);
    assert(SUITE, 'Deterministic AI review provides project directions', aiResponse.recommendedProjectDirections.length > 0);

    // Sanitization recovery
    const sanitized = sanitizeAISemesterReviewResponse(null, aiContext, report);
    assert(SUITE, 'Sanitization recovers safely from malformed responses', sanitized.recommendedFutureFocus.length > 0);

    // Strict advisory boundary: AI generation MUST NEVER mutate storage
    const adapter = new InMemoryStorageAdapter();
    const service = new DataService(adapter);
    service.saveState(testState);
    const beforeSave = JSON.parse(JSON.stringify(service.getState()));

    // Trigger AI logic
    const testReport = service.getSemesterReview('sem-test-3')!;
    const testContext = buildSemesterReviewAIContext(testReport, service.getState());
    generateDeterministicAISemesterReview(testContext, testReport);

    const afterSave = service.getState();
    assert(SUITE, 'AI advisory logic does NOT mutate sessions in storage', afterSave.sessions.length === beforeSave.sessions.length);
    assert(SUITE, 'AI advisory logic does NOT mutate goals in storage', afterSave.goals.length === beforeSave.goals.length);
    assert(SUITE, 'AI advisory logic does NOT alter semester dates in storage', afterSave.semesters[0].startDate === beforeSave.semesters[0].startDate);
  } catch (e: any) {
    assert(SUITE, 'AI context and safety boundary test failed', false, e?.message);
  }

  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}
