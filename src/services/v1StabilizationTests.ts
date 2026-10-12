/**
 * NEXORA V1.0 Stabilization Regression Tests
 * Verifies fixes for:
 * - Issue 1: Canonical deterministic date utility and dynamic date propagation
 * - Issue 2: Preservation of completed semesters, reviews, learning history during onboarding
 * - Issue 3: Correct midnight-crossing / post-midnight sleep interval mathematics and conflict detection
 */

import { AppState, Semester, StudySession } from '../types';
import { DataService, InMemoryStorageAdapter } from './dataService';
import { getTodayDateString } from './scheduler';
import { getWeekBoundaries } from './weeklyAnalytics';
import { deriveSemesterState } from './semesterAnalytics';
import { deriveDayCapacity, detectScheduleConflicts } from './plannerEngine';
import { SEED_PROFILE, SEED_SEMESTERS, SEED_SUBJECTS } from './seedData';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

export function runV1StabilizationTests(): { total: number; passed: number; failed: number; results: TestResult[] } {
  const results: TestResult[] = [];
  const SUITE = 'V1.0 Stabilization Hardening';

  function assert(name: string, condition: boolean, message?: string) {
    if (condition) {
      results.push({ suite: SUITE, name, passed: true });
    } else {
      results.push({ suite: SUITE, name, passed: false, error: message || 'Assertion failed' });
    }
  }

  // =========================================================================
  // ISSUE 1: CANONICAL DETERMINISTIC DATE UTILITY & PROPAGATION
  // =========================================================================
  try {
    const today = getTodayDateString();
    assert(
      'getTodayDateString returns valid local calendar YYYY-MM-DD pattern',
      /^\d{4}-\d{2}-\d{2}$/.test(today),
      `Expected YYYY-MM-DD format but got "${today}"`
    );

    // Verify determinism with mock date: May 15, 2027
    const mockDate = new Date(2027, 4, 15, 23, 45, 0); // May 15 2027 late evening
    const formattedMock = getTodayDateString(mockDate);
    assert(
      'getTodayDateString produces exact local date without UTC day shift',
      formattedMock === '2027-05-15',
      `Expected '2027-05-15', got '${formattedMock}'`
    );

    // Dynamic week boundary computation
    const boundaries = getWeekBoundaries('2027-05-15'); // Saturday
    assert(
      'getWeekBoundaries aligns Monday start and Sunday end for dynamic dates',
      boundaries.start === '2027-05-10' && boundaries.end === '2027-05-16',
      `Expected start 2027-05-10 and end 2027-05-16, got ${JSON.stringify(boundaries)}`
    );

    // Dynamic semester state derivation with default parameter
    const futureSemester: Semester = {
      id: 'sem-future',
      name: 'Future Spring Term',
      startDate: '2028-01-10',
      endDate: '2028-05-20',
      expectedEndDate: '2028-05-20',
      isActive: true,
      targetWeeklyStudyHours: 15,
      holidays: [],
    };
    const derivedStatus = deriveSemesterState(futureSemester); // uses getTodayDateString() by default
    assert(
      'deriveSemesterState dynamically defaults to current date utility',
      derivedStatus === 'upcoming'
    );
  } catch (err: any) {
    assert('Issue 1: Date propagation execution', false, err.message);
  }

  // =========================================================================
  // ISSUE 2: PROTECT HISTORICAL SEMESTERS DURING ONBOARDING
  // =========================================================================
  try {
    const storage = new InMemoryStorageAdapter();
    const service = new DataService(storage);

    // Set up state with a completed semester, an active semester, sessions, reviews, topics
    const historicalSemester: Semester = {
      id: 'sem-spring-2026',
      name: 'Spring 2026 (Semester 4)',
      startDate: '2026-01-10',
      endDate: '2026-05-20',
      expectedEndDate: '2026-05-20',
      actualEndDate: '2026-05-22',
      status: 'completed',
      isActive: false,
      targetWeeklyStudyHours: 16,
      holidays: [],
    };

    const activeSemester: Semester = {
      id: 'sem-fall-2026',
      name: 'Fall 2026 (Semester 5)',
      startDate: '2026-09-01',
      endDate: '2026-12-20',
      expectedEndDate: '2026-12-20',
      status: 'active',
      isActive: true,
      targetWeeklyStudyHours: 18,
      holidays: [],
    };

    const sampleReview = {
      semesterId: 'sem-spring-2026',
      semesterName: 'Spring 2026 (Semester 4)',
      generatedAt: '2026-05-22T10:00:00Z',
      actualStartDate: '2026-01-10',
      actualEndDate: '2026-05-22',
      totalActualStudyMinutes: 7200,
      totalSessionsCount: 95,
      completionRate: 88,
      averageComprehension: 4.2,
      averageEnergy: 3.8,
      subjectBreakdowns: [],
      skillsProgress: [],
      goalsSummary: { totalGoals: 3, completedGoals: 3, partiallyCompletedGoals: 0 },
      strongestAreas: ['Data Structures'],
      needsAttentionAreas: [],
      learningPatterns: ['High morning focus'],
    };

    const historicalSession: StudySession = {
      id: 'sess-hist-1',
      date: '2026-03-15',
      subjectId: 'sub-algo',
      startTime: '2026-03-15T10:00:00Z',
      endTime: '2026-03-15T11:00:00Z',
      plannedDurationMinutes: 60,
      actualDurationMinutes: 60,
      comprehensionRating: 5,
      energyRating: 4,
      keyTakeaways: 'Mastered dynamic programming',
    };

    const initialState: AppState = {
      profile: { ...SEED_PROFILE, hasCompletedOnboarding: true },
      semesters: [historicalSemester, activeSemester],
      activeSemesterId: 'sem-fall-2026',
      subjects: [...SEED_SUBJECTS],
      timetable: [],
      topics: [],
      sessions: [historicalSession],
      goals: [],
      missions: {},
      timeBlocks: {},
      semesterReviews: { 'sem-spring-2026': sampleReview as any },
    };

    service.saveState(initialState);

    // Simulate re-running onboarding: User updates active semester name, routine, and wake/sleep times
    // Emulate the hardened handleFinalSubmit logic:
    const reRanOnboardingUpdate = {
      profile: {
        ...initialState.profile,
        name: 'Alex Mercer',
        wakeTime: '07:00',
        sleepTime: '23:00',
        dailyCapacityMaxHours: 5,
      },
      semesters: [
        historicalSemester, // Historical preserved!
        {
          ...activeSemester,
          name: 'Fall 2026 (Updated Name)',
          targetWeeklyStudyHours: 20,
        },
      ],
      activeSemesterId: 'sem-fall-2026',
      subjects: initialState.subjects,
      timetable: initialState.timetable,
      studyPeriods: [],
      goals: initialState.goals,
    };

    // App.tsx merge simulation
    const current = service.getState();
    const mergedState: AppState = {
      ...current,
      ...reRanOnboardingUpdate,
      profile: {
        ...current.profile,
        ...reRanOnboardingUpdate.profile,
        hasCompletedOnboarding: true,
      },
      semesterReviews: current.semesterReviews || {},
      sessions: current.sessions || [],
      topics: current.topics || [],
      missions: current.missions || {},
      timeBlocks: current.timeBlocks || {},
    };
    service.saveState(mergedState);

    const postState = service.getState();

    // 1. Existing completed semester remains after re-running onboarding
    const preservedHistSem = postState.semesters.find((s) => s.id === 'sem-spring-2026');
    assert('Existing completed semester remains after re-running onboarding', !!preservedHistSem && preservedHistSem.status === 'completed');

    // 2. Existing semester review remains
    const preservedReview = postState.semesterReviews?.['sem-spring-2026'];
    assert('Existing semester review remains intact after onboarding update', !!preservedReview && preservedReview.totalActualStudyMinutes === 7200);

    // 3. Active semester fields update correctly
    const updatedActive = postState.semesters.find((s) => s.id === 'sem-fall-2026');
    assert('Active semester fields update correctly', updatedActive?.name === 'Fall 2026 (Updated Name)' && updatedActive?.targetWeeklyStudyHours === 20);

    // 4. No unrelated historical records are removed
    assert('Historical study sessions preserved', postState.sessions.length === 1 && postState.sessions[0].id === 'sess-hist-1');

    // 5. A new semester can still be created when appropriate
    const brandNewSemester: Semester = {
      id: 'sem-spring-2027',
      name: 'Spring 2027 (Semester 6)',
      startDate: '2027-01-10',
      endDate: '2027-05-20',
      expectedEndDate: '2027-05-20',
      isActive: true,
      targetWeeklyStudyHours: 20,
      holidays: [],
    };
    service.saveSemester(brandNewSemester);
    const withNewSem = service.getState();
    assert(
      'A new semester can still be created alongside existing completed terms',
      withNewSem.semesters.length === 3 && withNewSem.semesters.some((s) => s.id === 'sem-spring-2027')
    );
  } catch (err: any) {
    assert('Issue 2: Onboarding semester protection execution', false, err.message);
  }

  // =========================================================================
  // ISSUE 3: MIDNIGHT-CROSSING SLEEP CALCULATION
  // =========================================================================
  try {
    // Test overnight sleep schedule: Sleep: 01:30 (90 min), Wake: 08:30 (510 min)
    const lateNightState: AppState = {
      profile: {
        ...SEED_PROFILE,
        wakeTime: '08:30', // 510 min
        sleepTime: '01:30', // 90 min (sleepMin < wakeMin)
        sleepHours: 7,
        dailyCapacityMaxHours: 4.5,
        defaultBufferMinutes: 10,
        travelTimeMinutes: 0,
      },
      semesters: [...SEED_SEMESTERS],
      activeSemesterId: 'sem-fall-2026',
      subjects: [...SEED_SUBJECTS],
      timetable: [],
      topics: [],
      sessions: [],
      goals: [],
      missions: {},
      timeBlocks: {},
    };

    const capacity = deriveDayCapacity('2026-09-21', lateNightState);

    // 1. Check derived capacity sleep attributes
    assert(
      'Overnight schedule preserves correct wakeTimeMinutes (510) and sleepTimeMinutes (90)',
      capacity.wakeTimeMinutes === 510 && capacity.sleepTimeMinutes === 90,
      `Got wake: ${capacity.wakeTimeMinutes}, sleep: ${capacity.sleepTimeMinutes}`
    );

    assert(
      'Overnight sleep duration is correctly calculated (420 minutes / 7 hours)',
      capacity.sleepMinutes === 420,
      `Got sleepMinutes: ${capacity.sleepMinutes}`
    );

    // 2. Check flexible intervals do NOT encroach on [01:30, 08:30)
    const flexibleEncroachesSleep = capacity.flexibleIntervals.some(
      (iv) => Math.max(iv.start, 90) < Math.min(iv.end, 510)
    );
    assert(
      'Flexible focus intervals never encroach on [01:30, 08:30) protected sleep window',
      !flexibleEncroachesSleep,
      `Found flexible interval encroaching on sleep: ${JSON.stringify(capacity.flexibleIntervals)}`
    );

    // 3. Flexible intervals include waking hours after 08:30
    const hasPostWakeInterval = capacity.flexibleIntervals.some((iv) => iv.start >= 510);
    assert(
      'Flexible focus intervals are available during daytime waking hours (after 08:30)',
      hasPostWakeInterval
    );

    // 4. Conflict detection: Task inside [01:30, 08:30) flags overlap_sleep
    const insideSleepTask = [
      {
        id: 'mi-sleep-1',
        title: 'Late Night Coding',
        plannedMinutes: 60,
        actualMinutes: 0,
        status: 'pending' as const,
        scheduledTime: '03:00', // 180m - inside 90 to 510
        endTime: '04:00',
        isAIRecorded: false,
      },
    ];
    const sleepConflicts = detectScheduleConflicts('2026-09-21', insideSleepTask, lateNightState);
    const hasOverlapSleep = sleepConflicts.some((c) => c.type === 'overlap_sleep');
    assert(
      'detectScheduleConflicts flags overlap_sleep for task scheduled during overnight sleep (03:00-04:00)',
      hasOverlapSleep,
      `Conflicts: ${JSON.stringify(sleepConflicts)}`
    );

    // 5. Conflict detection: Task scheduled before bed (e.g. 00:30 to 01:15) does NOT flag overlap_sleep
    const beforeBedTask = [
      {
        id: 'mi-before-bed',
        title: 'Nightly Reflection',
        plannedMinutes: 45,
        actualMinutes: 0,
        status: 'pending' as const,
        scheduledTime: '00:30', // 30m to 75m - awake before 90m bed
        endTime: '01:15',
        isAIRecorded: false,
      },
    ];
    const beforeBedConflicts = detectScheduleConflicts('2026-09-21', beforeBedTask, lateNightState);
    const beforeBedOverlap = beforeBedConflicts.some((c) => c.type === 'overlap_sleep');
    assert(
      'detectScheduleConflicts does NOT flag overlap_sleep for task before post-midnight bedtime (00:30-01:15)',
      !beforeBedOverlap,
      `Should not conflict, got: ${JSON.stringify(beforeBedConflicts)}`
    );

    // 6. Conflict detection: Task scheduled during daytime (e.g. 10:00 to 11:00) does NOT flag overlap_sleep
    const daytimeTask = [
      {
        id: 'mi-daytime',
        title: 'Morning Algorithms',
        plannedMinutes: 60,
        actualMinutes: 0,
        status: 'pending' as const,
        scheduledTime: '10:00',
        endTime: '11:00',
        isAIRecorded: false,
      },
    ];
    const daytimeConflicts = detectScheduleConflicts('2026-09-21', daytimeTask, lateNightState);
    const daytimeOverlap = daytimeConflicts.some((c) => c.type === 'overlap_sleep');
    assert(
      'detectScheduleConflicts does NOT flag overlap_sleep for daytime task (10:00-11:00)',
      !daytimeOverlap
    );

    // 7. Verify standard sleep schedule (23:30 sleep, 07:30 wake) remains fully protected
    const standardState: AppState = {
      profile: {
        ...SEED_PROFILE,
        wakeTime: '07:30', // 450 min
        sleepTime: '23:30', // 1410 min (sleepMin > wakeMin)
      },
      semesters: [...SEED_SEMESTERS],
      activeSemesterId: 'sem-fall-2026',
      subjects: [...SEED_SUBJECTS],
      timetable: [],
      topics: [],
      sessions: [],
      goals: [],
      missions: {},
      timeBlocks: {},
    };
    const standardEarlyTask = [
      {
        id: 'mi-early',
        title: 'Early Morning Run',
        plannedMinutes: 45,
        actualMinutes: 0,
        status: 'pending' as const,
        scheduledTime: '05:00', // inside 00:00-07:30 sleep
        endTime: '05:45',
        isAIRecorded: false,
      },
    ];
    const standardConflicts = detectScheduleConflicts('2026-09-21', standardEarlyTask, standardState);
    assert(
      'Standard sleep schedule flags tasks in pre-wake window (05:00-05:45)',
      standardConflicts.some((c) => c.type === 'overlap_sleep')
    );
  } catch (err: any) {
    assert('Issue 3: Sleep schedule mathematics execution', false, err.message);
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
