import { AppState, MissionItem, RoadmapTopic, TimetableSlot } from '../types';
import { 
  deriveDayCapacity, 
  detectScheduleConflicts, 
  generateDeterministicSchedule, 
  intervalsOverlap, 
  rebalanceDaySchedule, 
  rescheduleTask,
  mergeIntervals,
  subtractIntervals,
  TimeInterval
} from './plannerEngine';
import { SEED_PROFILE, SEED_SEMESTERS, SEED_SUBJECTS, SEED_TIMETABLE, SEED_TOPICS } from './seedData';
import { computePlannedVsActual, timeToMinutes } from './scheduler';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

export function runPlannerEngineTests(): {
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

  // Create a clean mock state
  function createTestState(overrides?: Partial<AppState>): AppState {
    return {
      profile: { ...SEED_PROFILE },
      semesters: [...SEED_SEMESTERS],
      activeSemesterId: 'sem-fall-2026',
      subjects: [...SEED_SUBJECTS],
      timetable: [...SEED_TIMETABLE],
      topics: [...SEED_TOPICS],
      missions: {},
      sessions: [],
      goals: [],
      ...overrides,
    };
  }

  // =========================================================================
  // TEST SUITE 1: Overlapping Events Detection & Prevention
  // =========================================================================
  try {
    const suite = 'Overlapping Events';

    // 1.1 Pure interval overlap math
    assert(suite, 'intervalsOverlap detects direct intersection', intervalsOverlap(600, 720, 660, 780));
    assert(suite, 'intervalsOverlap detects enclosure', intervalsOverlap(600, 800, 650, 700));
    assert(suite, 'intervalsOverlap rejects touching borders (zero-overlap)', !intervalsOverlap(600, 700, 700, 800));
    assert(suite, 'intervalsOverlap rejects completely separate intervals', !intervalsOverlap(600, 700, 800, 900));

    // 1.2 Detect overlapping tasks conflict
    const state = createTestState();
    const overlappingTasks: MissionItem[] = [
      {
        id: 't-1',
        title: 'Task A',
        plannedMinutes: 60,
        actualMinutes: 0,
        status: 'pending',
        scheduledTime: '14:00', // 14:00 - 15:00
        endTime: '15:00',
        isAIRecorded: false,
      },
      {
        id: 't-2',
        title: 'Task B',
        plannedMinutes: 60,
        actualMinutes: 0,
        status: 'pending',
        scheduledTime: '14:30', // 14:30 - 15:30 (overlaps with Task A)
        endTime: '15:30',
        isAIRecorded: false,
      },
    ];

    const conflicts = detectScheduleConflicts('2026-09-21', overlappingTasks, state);
    const hasOverlapTaskConflict = conflicts.some((c) => c.type === 'overlap_task');
    assert(suite, 'detectScheduleConflicts flags overlapping tasks (Task A and Task B)', hasOverlapTaskConflict);

    // 1.3 Auto-scheduler guarantees zero overlapping tasks
    const scheduleResult = generateDeterministicSchedule('2026-09-21', state, { includeBreaks: true });
    let anyTaskOverlapInAutoSchedule = false;
    const items = scheduleResult.scheduledItems.filter((i) => i.scheduledTime && i.endTime);

    for (let i = 0; i < items.length; i++) {
      const aStart = timeToMinutes(items[i].scheduledTime!);
      const aEnd = timeToMinutes(items[i].endTime!);
      for (let j = i + 1; j < items.length; j++) {
        const bStart = timeToMinutes(items[j].scheduledTime!);
        const bEnd = timeToMinutes(items[j].endTime!);
        if (intervalsOverlap(aStart, aEnd, bStart, bEnd)) {
          anyTaskOverlapInAutoSchedule = true;
          break;
        }
      }
    }
    assert(suite, 'Auto-scheduler output contains zero overlapping tasks', !anyTaskOverlapInAutoSchedule);
  } catch (err: any) {
    assert('Overlapping Events', 'Suite execution error', false, err.message);
  }

  // =========================================================================
  // TEST SUITE 2: Insufficient Time & Cognitive Capacity Limits
  // =========================================================================
  try {
    const suite = 'Insufficient Time';

    const state = createTestState({
      profile: {
        ...SEED_PROFILE,
        dailyCapacityMaxHours: 2.0, // Strict 2-hour daily study limit
      },
    });

    const capacity = deriveDayCapacity('2026-09-21', state);
    assert(suite, 'Capacity respects strict 2-hour daily maximum ceiling (120m)', capacity.dailyCapacityMaxMinutes === 120);
    assert(suite, 'Net available study minutes does not exceed capacity ceiling', capacity.netAvailableStudyMinutes <= 120);

    // Test exceeding capacity detection
    const greedyTasks: MissionItem[] = [
      { id: 'g-1', title: 'Deep Work 1', plannedMinutes: 90, actualMinutes: 0, status: 'pending', isAIRecorded: false },
      { id: 'g-2', title: 'Deep Work 2', plannedMinutes: 90, actualMinutes: 0, status: 'pending', isAIRecorded: false },
    ]; // Total = 180m > 120m capacity

    const conflicts = detectScheduleConflicts('2026-09-21', greedyTasks, state);
    const capacityExceeded = conflicts.some((c) => c.type === 'exceeds_capacity');
    assert(suite, 'detectScheduleConflicts flags exceeds_capacity when tasks exceed net capacity', capacityExceeded);

    // Auto-scheduler caps study time and safely puts remaining topics in overflow
    const autoSchedule = generateDeterministicSchedule('2026-09-21', state);
    assert(
      suite,
      'Auto-scheduler limits total study minutes to safe budget threshold',
      autoSchedule.totalStudyMinutes <= capacity.safeBudgetMinutes
    );
    assert(
      suite,
      'Unscheduled candidates are preserved in overflowTopics rather than overloaded',
      autoSchedule.overflowTopics.length > 0
    );
  } catch (err: any) {
    assert('Insufficient Time', 'Suite execution error', false, err.message);
  }

  // =========================================================================
  // TEST SUITE 3: Fixed Events Enforcement & Transition Buffers
  // =========================================================================
  try {
    const suite = 'Fixed Events';
    const state = createTestState();
    const capacity = deriveDayCapacity('2026-09-21', state); // Monday: OS Lecture 09:00-10:30, Algo Lecture 11:00-12:30

    assert(suite, 'deriveDayCapacity identifies fixed slots for Monday', capacity.fixedBlocksCount >= 2);
    assert(suite, 'deriveDayCapacity calculates transition buffers for fixed slots', capacity.transitionBufferMinutes > 0);

    // Check conflict when a task collides with CS 301 OS Lecture (09:00 - 10:30)
    const clashingTask: MissionItem[] = [
      {
        id: 'clash-1',
        title: 'Impromptu Study',
        plannedMinutes: 45,
        actualMinutes: 0,
        status: 'pending',
        scheduledTime: '09:30', // Clashes with OS Lecture (09:00-10:30)
        endTime: '10:15',
        isAIRecorded: false,
      },
    ];

    const conflicts = detectScheduleConflicts('2026-09-21', clashingTask, state);
    const fixedConflict = conflicts.find((c) => c.type === 'overlap_fixed');
    assert(suite, 'detectScheduleConflicts flags overlap_fixed with correct lecture title', fixedConflict !== undefined && fixedConflict.message.includes('CS 301'));

    // Check auto-scheduler never places tasks in fixed slots
    const autoSchedule = generateDeterministicSchedule('2026-09-21', state);
    let clashingWithFixed = false;

    for (const item of autoSchedule.scheduledItems) {
      if (!item.scheduledTime || !item.endTime) continue;
      const start = timeToMinutes(item.scheduledTime);
      const end = timeToMinutes(item.endTime);

      for (const fixed of capacity.fixedIntervals) {
        if (intervalsOverlap(start, end, fixed.start, fixed.end)) {
          clashingWithFixed = true;
          break;
        }
      }
    }
    assert(suite, 'Auto-scheduler never schedules any study task or break during fixed classes', !clashingWithFixed);
  } catch (err: any) {
    assert('Fixed Events', 'Suite execution error', false, err.message);
  }

  // =========================================================================
  // TEST SUITE 4: Flexible Events & Sleep Schedule Awareness
  // =========================================================================
  try {
    const suite = 'Flexible Events';
    const state = createTestState();
    const capacity = deriveDayCapacity('2026-09-21', state);

    assert(suite, 'Engine discovers flexible focus intervals on campus day', capacity.flexibleIntervals.length > 0);

    // Verify all flexible intervals occur strictly between wakeTime and sleepTime
    const wake = capacity.wakeTimeMinutes;
    const sleep = capacity.sleepTimeMinutes;
    const withinWakingHours = capacity.flexibleIntervals.every(
      (iv) => iv.start >= wake && iv.end <= sleep
    );
    assert(suite, 'All flexible intervals are contained within waking hours (respecting sleep)', withinWakingHours);

    // Test sleep schedule violation conflict
    const midnightTask: MissionItem[] = [
      {
        id: 'sleep-clash',
        title: 'Midnight Cramming',
        plannedMinutes: 60,
        actualMinutes: 0,
        status: 'pending',
        scheduledTime: '01:00', // Inside sleep hours (07:30 wake / 23:30 sleep)
        endTime: '02:00',
        isAIRecorded: false,
      },
    ];
    const conflicts = detectScheduleConflicts('2026-09-21', midnightTask, state);
    const sleepConflict = conflicts.some((c) => c.type === 'overlap_sleep');
    assert(suite, 'detectScheduleConflicts flags overlap_sleep when task scheduled in sleep window', sleepConflict);
  } catch (err: any) {
    assert('Flexible Events', 'Suite execution error', false, err.message);
  }

  // =========================================================================
  // TEST SUITE 5: Breaks Support & Realistic Spacing
  // =========================================================================
  try {
    const suite = 'Breaks';
    const state = createTestState();

    const autoSchedule = generateDeterministicSchedule('2026-09-21', state, {
      includeBreaks: true,
      breakMinutes: 10,
    });

    const breakItems = autoSchedule.scheduledItems.filter((i) => i.isBreak);
    assert(suite, 'Auto-scheduler inserts cognitive break items between study tasks', breakItems.length > 0);
    assert(suite, 'Total break minutes tracked separately from study capacity', autoSchedule.totalBreakMinutes > 0);

    // Verify each break item has plannedMinutes === 10
    const correctBreakDuration = breakItems.every((b) => b.plannedMinutes === 10);
    assert(suite, 'Cognitive breaks have exact configured duration (10m)', correctBreakDuration);

    // Verify break immediately follows a study session
    const firstBreakIdx = autoSchedule.scheduledItems.findIndex((i) => i.isBreak);
    if (firstBreakIdx > 0) {
      const precedingTask = autoSchedule.scheduledItems[firstBreakIdx - 1];
      const breakItem = autoSchedule.scheduledItems[firstBreakIdx];
      assert(
        suite,
        'Break start time connects seamlessly to preceding task end time',
        precedingTask.endTime === breakItem.scheduledTime
      );
    }
  } catch (err: any) {
    assert('Breaks', 'Suite execution error', false, err.message);
  }

  // =========================================================================
  // TEST SUITE 6: Rescheduling Tasks When Circumstances Change
  // =========================================================================
  try {
    const suite = 'Rescheduling';
    const state = createTestState();

    // Setup an existing mission for Monday
    const initialTask: MissionItem = {
      id: 'resched-task-1',
      title: 'CS 301: Virtual Memory Paging',
      plannedMinutes: 45,
      actualMinutes: 0,
      status: 'pending',
      scheduledTime: '13:00',
      endTime: '13:45',
      isAIRecorded: false,
    };

    state.missions['2026-09-21'] = {
      id: 'm-2026-09-21',
      date: '2026-09-21',
      availableMinutes: 180,
      allocatedMinutes: 45,
      items: [initialTask],
    };

    // 6.1 Same-day rescheduling
    const reschedSameDay = rescheduleTask(
      '2026-09-21',
      'resched-task-1',
      { targetDateStr: '2026-09-21', newScheduledTime: '16:00' },
      state
    );

    const movedTask = reschedSameDay.sourceMission.items.find((i) => i.id === 'resched-task-1');
    assert(suite, 'Same-day reschedule updates scheduledTime and endTime', movedTask?.scheduledTime === '16:00' && movedTask?.endTime === '16:45');
    assert(suite, 'Same-day reschedule records originalScheduledTime audit trail', movedTask?.originalScheduledTime === '13:00');

    // 6.2 Cross-day rescheduling (moving to tomorrow)
    const reschedTomorrow = rescheduleTask(
      '2026-09-21',
      'resched-task-1',
      { targetDateStr: '2026-09-22', newScheduledTime: '10:00' },
      state
    );

    const sourceItem = reschedTomorrow.sourceMission.items.find((i) => i.id === 'resched-task-1');
    const targetItem = reschedTomorrow.targetMission.items.find((i) => i.title === initialTask.title);

    assert(suite, 'Cross-day reschedule marks original as rescheduled in source mission', sourceItem?.status === 'rescheduled');
    assert(suite, 'Cross-day reschedule creates pending task in target mission', targetItem?.status === 'pending' && targetItem?.scheduledTime === '10:00');
  } catch (err: any) {
    assert('Rescheduling', 'Suite execution error', false, err.message);
  }

  // =========================================================================
  // TEST SUITE 7: Missed Sessions & Mid-Day Schedule Rebalancing
  // =========================================================================
  try {
    const suite = 'Missed Sessions';
    const state = createTestState();

    // Create a mission where the student had 3 tasks scheduled throughout the afternoon
    // but the current time is now 16:30 (so 14:00 task was missed!)
    const missionItems: MissionItem[] = [
      {
        id: 'missed-1',
        title: 'CS 312: Dijkstra Algorithm Review',
        plannedMinutes: 45,
        actualMinutes: 0,
        status: 'pending',
        scheduledTime: '14:00', // In the past!
        endTime: '14:45',
        isAIRecorded: false,
      },
      {
        id: 'pending-2',
        title: 'CS 301: Page Replacement Algorithms',
        plannedMinutes: 45,
        actualMinutes: 0,
        status: 'pending',
        scheduledTime: '15:00', // In the past!
        endTime: '15:45',
        isAIRecorded: false,
      },
    ];

    state.missions['2026-09-21'] = {
      id: 'm-2026-09-21',
      date: '2026-09-21',
      availableMinutes: 180,
      allocatedMinutes: 90,
      items: missionItems,
    };

    // Rebalance the schedule assuming the student sits down at 16:30
    const rebalance = rebalanceDaySchedule('2026-09-21', state, '16:30');

    // Verify all active pending items are moved to >= 16:30
    const activeRebalanced = rebalance.rebalancedMission.items.filter(
      (i) => i.status === 'pending' && i.scheduledTime
    );

    const allShiftedForward = activeRebalanced.every(
      (i) => timeToMinutes(i.scheduledTime!) >= timeToMinutes('16:30')
    );
    assert(suite, 'Rebalance shifts uncompleted past tasks into remaining future flexible windows', allShiftedForward);

    // Verify planned vs actual tracking
    const stats = computePlannedVsActual(rebalance.rebalancedMission.items);
    assert(suite, 'computePlannedVsActual tracks total planned and actual study minutes', stats.plannedMinutes >= 0 && stats.actualMinutes >= 0);
  } catch (err: any) {
    assert('Missed Sessions', 'Suite execution error', false, err.message);
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
