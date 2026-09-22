import { AppState } from '../types';
import { DataService, InMemoryStorageAdapter } from './dataService';
import { SEED_PROFILE, SEED_SEMESTERS, SEED_SUBJECTS } from './seedData';
import {
  detectCycleInTopics,
  validateGoal,
  validateRoadmapTopic,
  validateSemester,
  validateStudySession,
  validateSubject,
  validateTimeBlock,
  validateTimetableSlot,
  validateUserProfile,
} from './validation';
import { runPlannerEngineTests } from './plannerEngineTests';
import { runAIProviderTests } from './ai/aiProviderTests';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

export function runDataLayerTests(): { total: number; passed: number; failed: number; results: TestResult[] } {
  const results: TestResult[] = [];

  function assert(suite: string, name: string, condition: boolean, message?: string) {
    if (condition) {
      results.push({ suite, name, passed: true });
    } else {
      results.push({ suite, name, passed: false, error: message || 'Assertion failed' });
    }
  }

  // -------------------------------------------------------------
  // Test Suite 1: Validation Engine
  // -------------------------------------------------------------
  try {
    // 1.1 UserProfile validation
    const validProfile = validateUserProfile(SEED_PROFILE);
    assert('Validation Engine', 'Valid user profile passes validation', validProfile.isValid);

    const invalidProfile = validateUserProfile({ name: '', dailyCapacityMaxHours: 20 });
    assert('Validation Engine', 'Invalid profile returns errors', !invalidProfile.isValid && invalidProfile.errors.length >= 2);

    // 1.2 Semester validation
    const validSemester = validateSemester(SEED_SEMESTERS[0]);
    assert('Validation Engine', 'Valid semester passes validation', validSemester.isValid);

    const invalidDates = validateSemester({
      id: 'sem-invalid',
      name: 'Invalid Semester',
      startDate: '2026-12-01',
      endDate: '2026-09-01', // End before start
    });
    assert('Validation Engine', 'Semester with end date before start date fails', !invalidDates.isValid);

    // 1.3 Subject validation
    const validSubject = validateSubject(SEED_SUBJECTS[0]);
    assert('Validation Engine', 'Valid subject passes validation', validSubject.isValid);

    // 1.4 Timetable slot validation
    const validSlot = validateTimetableSlot({
      id: 'tt-test',
      semesterId: 'sem-fall-2026',
      title: 'Lab',
      dayOfWeek: 'monday',
      startTime: '10:00',
      endTime: '11:30',
      type: 'lab',
      isFixed: true,
    });
    assert('Validation Engine', 'Valid timetable slot passes validation', validSlot.isValid);

    const invertedSlot = validateTimetableSlot({
      id: 'tt-inv',
      semesterId: 'sem-fall-2026',
      title: 'Lab',
      dayOfWeek: 'monday',
      startTime: '12:00',
      endTime: '10:00', // End before start
      type: 'lab',
      isFixed: true,
    });
    assert('Validation Engine', 'Timetable slot with end time before start time fails', !invertedSlot.isValid);

    // 1.5 TimeBlock validation
    const validBlock = validateTimeBlock({
      id: 'tb-test',
      date: '2026-09-21',
      title: 'Study Window',
      startTime: '14:00',
      endTime: '15:30',
      durationMinutes: 90,
      type: 'study_window',
      isFixed: false,
    });
    assert('Validation Engine', 'Valid timeblock passes validation', validBlock.isValid);

    // 1.6 StudySession validation
    const validSession = validateStudySession({
      id: 'sess-test',
      subjectId: 'sub-os',
      date: '2026-09-21',
      startTime: '2026-09-21T14:00:00Z',
      plannedDurationMinutes: 45,
      actualDurationMinutes: 45,
      comprehensionRating: 5,
      energyRating: 4,
      keyTakeaways: 'Testing',
    });
    assert('Validation Engine', 'Valid study session passes validation', validSession.isValid);

    // 1.7 Goal validation
    const validGoal = validateGoal({
      id: 'goal-test',
      title: 'Learn C++',
      targetValue: 100,
      currentValue: 20,
      unit: '%',
      horizon: 'monthly',
      status: 'active',
    });
    assert('Validation Engine', 'Valid goal passes validation', validGoal.isValid);

    // 1.8 Prerequisite Cycle Detection (DAG)
    const acyclicTopics = [
      { id: 'A', subjectId: 'sub-1', title: 'A', description: '', estimatedMinutes: 30, prerequisiteTopicIds: [], status: 'completed' as const, masteryLevel: 100, orderIndex: 1 },
      { id: 'B', subjectId: 'sub-1', title: 'B', description: '', estimatedMinutes: 30, prerequisiteTopicIds: ['A'], status: 'ready' as const, masteryLevel: 0, orderIndex: 2 },
      { id: 'C', subjectId: 'sub-1', title: 'C', description: '', estimatedMinutes: 30, prerequisiteTopicIds: ['B'], status: 'locked' as const, masteryLevel: 0, orderIndex: 3 },
    ];
    assert('Validation Engine', 'Acyclic topic graph passes cycle check', detectCycleInTopics(acyclicTopics) === null);

    const cyclicTopics = [
      { id: 'A', subjectId: 'sub-1', title: 'A', description: '', estimatedMinutes: 30, prerequisiteTopicIds: ['C'], status: 'ready' as const, masteryLevel: 0, orderIndex: 1 },
      { id: 'B', subjectId: 'sub-1', title: 'B', description: '', estimatedMinutes: 30, prerequisiteTopicIds: ['A'], status: 'ready' as const, masteryLevel: 0, orderIndex: 2 },
      { id: 'C', subjectId: 'sub-1', title: 'C', description: '', estimatedMinutes: 30, prerequisiteTopicIds: ['B'], status: 'ready' as const, masteryLevel: 0, orderIndex: 3 },
    ];
    assert('Validation Engine', 'Cyclic topic graph (A -> C -> B -> A) is detected', detectCycleInTopics(cyclicTopics) !== null);
  } catch (err: any) {
    assert('Validation Engine', 'Validation suite threw unexpected error', false, err?.message);
  }

  // -------------------------------------------------------------
  // Test Suite 2: DataService CRUD & Storage Encapsulation
  // -------------------------------------------------------------
  try {
    const memoryAdapter = new InMemoryStorageAdapter();
    const service = new DataService(memoryAdapter);

    // 2.1 Initialization & Seed verification
    const state = service.getState();
    assert('DataService CRUD', 'Service auto-initializes with seeded profile', state.profile.name === 'Alex Mercer');
    assert('DataService CRUD', 'Service auto-seeds subjects', state.subjects.length > 0);
    assert('DataService CRUD', 'Service auto-seeds timetable', state.timetable.length > 0);
    assert('DataService CRUD', 'Service auto-seeds topics', state.topics.length > 0);
    assert('DataService CRUD', 'Service auto-seeds goals', state.goals.length > 0);

    // 2.2 Profile update & validation barrier
    service.updateProfile({ name: 'Alex M.', dailyCapacityMaxHours: 4.0 });
    assert('DataService CRUD', 'Profile update modifies name and capacity', service.getProfile().name === 'Alex M.' && service.getProfile().dailyCapacityMaxHours === 4.0);

    let profileThrew = false;
    try {
      service.updateProfile({ dailyCapacityMaxHours: -5 });
    } catch {
      profileThrew = true;
    }
    assert('DataService CRUD', 'Invalid profile update is rejected by service barrier', profileThrew);

    // 2.3 Subject CRUD
    const newSubject = service.saveSubject({
      id: 'sub-ml',
      semesterId: 'sem-fall-2026',
      code: 'CS 480',
      name: 'Applied Machine Learning',
      color: '#EC4899',
      targetWeeklyHours: 4,
      credits: 3,
      syllabusOverview: 'Linear regression, neural networks, backpropagation.',
    });
    assert('DataService CRUD', 'Subject creation succeeds', service.getSubjectById('sub-ml')?.name === 'Applied Machine Learning');

    // 2.4 Timetable CRUD
    const newSlot = service.saveTimetableSlot({
      id: 'tt-ml-1',
      semesterId: 'sem-fall-2026',
      subjectId: 'sub-ml',
      title: 'CS 480: ML Lecture',
      dayOfWeek: 'friday',
      startTime: '14:00',
      endTime: '15:30',
      isFixed: true,
      type: 'lecture',
    });
    assert('DataService CRUD', 'Timetable slot creation succeeds', service.getTimetable('sem-fall-2026', 'friday').some((s) => s.id === 'tt-ml-1'));

    // 2.5 TimeBlock CRUD
    service.saveTimeBlock({
      id: 'tb-test-date',
      date: '2026-09-21',
      title: 'Afternoon Focus Window',
      startTime: '15:00',
      endTime: '16:30',
      durationMinutes: 90,
      type: 'study_window',
      isFixed: false,
    });
    assert('DataService CRUD', 'TimeBlock creation persists for calendar date', service.getTimeBlocksForDate('2026-09-21').some((b) => b.id === 'tb-test-date'));

    // 2.6 Goal CRUD & Progress update
    const savedGoal = service.saveGoal({
      id: 'goal-unit-test',
      title: 'Solve 10 LeetCode Mediums',
      targetValue: 10,
      currentValue: 4,
      unit: 'problems',
      horizon: 'weekly',
      status: 'active',
      createdAt: new Date().toISOString(),
    });
    assert('DataService CRUD', 'Goal creation succeeds', service.getGoalById('goal-unit-test')?.currentValue === 4);

    const updatedGoal = service.updateGoalProgress('goal-unit-test', 6);
    assert('DataService CRUD', 'Goal progress increment works and auto-completes', updatedGoal.currentValue === 10 && updatedGoal.status === 'completed');

    // 2.7 StudySession recording & automated topic mastery boost
    const topicBefore = service.getTopicById('top-os-3')!;
    const initialMastery = topicBefore.masteryLevel;

    service.recordStudySession({
      id: 'sess-unit-test',
      subjectId: 'sub-os',
      topicId: 'top-os-3',
      startTime: new Date().toISOString(),
      plannedDurationMinutes: 45,
      actualDurationMinutes: 45,
      comprehensionRating: 5, // 5 * 5 = +25 boost
      energyRating: 5,
      keyTakeaways: 'Verified mutual exclusion in hardware atomic test_and_set.',
      date: '2026-09-21',
    });

    const topicAfter = service.getTopicById('top-os-3')!;
    assert('DataService CRUD', 'Study session records and boosts topic mastery', topicAfter.masteryLevel === initialMastery + 25);

    // 2.8 Learning Progress Analytics Calculation
    const progress = service.getLearningProgress('sub-os');
    const os3Progress = progress.find((p) => p.topicId === 'top-os-3');
    assert('DataService CRUD', 'Learning progress aggregates logged sessions and comprehension', os3Progress !== undefined && os3Progress.sessionsCount >= 1 && os3Progress.averageComprehension > 0);

    // 2.9 Prerequisite Cycle Rejection in Service
    let cycleThrew = false;
    try {
      // Attempt to make top-os-1 depend on top-os-5 (which depends on 4, which depends on 3, which depends on 1!)
      service.saveTopic({
        ...service.getTopicById('top-os-1')!,
        prerequisiteTopicIds: ['top-os-5'],
      });
    } catch {
      cycleThrew = true;
    }
    assert('DataService CRUD', 'Service prevents saving topic that introduces prerequisite cycle', cycleThrew);

    // 2.10 Daily Mission and Mission Item CRUD & synchronization
    const testDate = '2026-09-25';
    service.saveDailyMission({
      id: `m-${testDate}`,
      date: testDate,
      availableMinutes: 180,
      allocatedMinutes: 45,
      items: [
        {
          id: 'item-sync-test',
          topicId: 'top-os-2',
          subjectId: 'sub-os',
          title: 'Review System Calls',
          plannedMinutes: 45,
          actualMinutes: 0,
          status: 'pending',
          isAIRecorded: false,
        },
      ],
    });
    assert('DataService CRUD', 'saveDailyMission persists mission and item', service.getDailyMission(testDate)?.items.length === 1);

    // 2.11 saveMissionItem updates allocatedMinutes correctly
    service.saveMissionItem(testDate, {
      id: 'item-sync-2',
      topicId: 'top-os-4',
      subjectId: 'sub-os',
      title: 'Explore Deadlocks',
      plannedMinutes: 60,
      actualMinutes: 0,
      status: 'pending',
      isAIRecorded: false,
    });
    const updatedMission = service.getDailyMission(testDate);
    assert('DataService CRUD', 'saveMissionItem adds item and recalculates allocated minutes', updatedMission?.items.length === 2 && updatedMission?.allocatedMinutes === 105);

    // 2.12 Study session syncs mission item status and actualMinutes
    service.recordStudySession({
      id: 'sess-sync-test',
      subjectId: 'sub-os',
      topicId: 'top-os-2',
      missionItemId: 'item-sync-test',
      startTime: new Date().toISOString(),
      plannedDurationMinutes: 45,
      actualDurationMinutes: 50,
      comprehensionRating: 4,
      energyRating: 4,
      keyTakeaways: 'System call dispatch table in trap handler.',
      date: testDate,
    });
    const itemAfterSession = service.getDailyMission(testDate)?.items.find((i: any) => i.id === 'item-sync-test');
    assert('DataService CRUD', 'recordStudySession auto-syncs mission item status to completed and updates actualMinutes', itemAfterSession?.status === 'completed' && itemAfterSession?.actualMinutes === 50);

    // 2.13 updateTopicMastery enforces MASTERY_THRESHOLD_COMPLETED (80)
    service.updateTopicMastery('top-os-2', 85);
    const masteredTopic = service.getTopicById('top-os-2');
    assert('DataService CRUD', 'updateTopicMastery marks topic status as completed when mastery >= 80', masteredTopic?.masteryLevel === 85 && masteredTopic?.status === 'completed');

    service.updateTopicMastery('top-os-2', 65);
    const inProgressTopic = service.getTopicById('top-os-2');
    assert('DataService CRUD', 'updateTopicMastery marks topic status as in_progress when mastery < 80', inProgressTopic?.masteryLevel === 65 && inProgressTopic?.status === 'in_progress');
  } catch (err: any) {
    assert('DataService CRUD', 'CRUD suite threw unexpected error', false, err?.message);
  }

  // -------------------------------------------------------------
  // Test Suite 3: NEXORA Deterministic Planner Engine Tests
  // (Overlapping events, insufficient time, fixed events, flexible events, breaks, rescheduling, missed sessions)
  // -------------------------------------------------------------
  try {
    const plannerTestReport = runPlannerEngineTests();
    results.push(...plannerTestReport.results);
  } catch (err: any) {
    assert('Planner Engine', 'Planner engine test suite threw unexpected error', false, err?.message);
  }

  // -------------------------------------------------------------
  // Test Suite 4: NEXORA AI Provider Abstraction Tests (docs/PROVIDERS.md)
  // (Provider interface, isolation, model selection, auth errors, rate limits, network failures, user-facing errors, extensibility)
  // -------------------------------------------------------------
  try {
    const aiProviderTestReport = runAIProviderTests();
    results.push(...aiProviderTestReport.results);
  } catch (err: any) {
    assert('AI Provider', 'AI Provider test suite threw unexpected error', false, err?.message);
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
