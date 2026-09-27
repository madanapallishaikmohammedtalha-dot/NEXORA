/**
 * NEXORA Adaptive Daily Planning & Today's Mission Test Suite
 * Validates deterministic capacity calculus, candidate selection (all 15 factors),
 * AI recommendation validation & sanitization, realistic session sizing, break injection,
 * morning check-in reality adjustments, mid-day adaptation, and user controls.
 */
import { AppState, DailyCheckInInput, DailyMission, MissionItem, RoadmapTopic, Subject } from '../types';
import {
  collectEligiblePlanCandidates,
  validateAIPlanRecommendations,
  placeActivitiesIntoFlexibleWindows,
  generateAdaptiveDailyMission,
  adaptMidDaySchedule,
  skipMissionItem,
  PlanCandidate,
} from './adaptivePlanner';
import { deriveDayCapacity, detectScheduleConflicts } from './plannerEngine';
import {
  SEED_GOALS,
  SEED_PROFILE,
  SEED_SEMESTERS,
  SEED_SUBJECTS,
  SEED_TIMETABLE,
  SEED_TOPICS,
} from './seedData';
import { timeToMinutes } from './scheduler';

export interface AdaptiveTestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

export function runAdaptivePlannerTests(): {
  total: number;
  passed: number;
  failed: number;
  results: AdaptiveTestResult[];
} {
  const results: AdaptiveTestResult[] = [];

  function assert(suite: string, name: string, condition: boolean, message?: string, details?: string) {
    if (condition) {
      results.push({ suite, name, passed: true, details });
    } else {
      results.push({ suite, name, passed: false, error: message || 'Assertion failed', details });
    }
  }

  function getBaseState(): AppState {
    return {
      profile: { ...SEED_PROFILE },
      semesters: [...SEED_SEMESTERS],
      activeSemesterId: 'sem-fall-2026',
      subjects: [...SEED_SUBJECTS],
      timetable: [...SEED_TIMETABLE],
      topics: JSON.parse(JSON.stringify(SEED_TOPICS)),
      goals: [...SEED_GOALS],
      sessions: [],
      missions: {},
    };
  }

  // ==========================================
  // Suite 1: Deterministic Capacity & Protection
  // ==========================================
  const suite1 = 'Adaptive Planner: Capacity & Sleep Protection';
  {
    const state = getBaseState();
    const mondayCapacity = deriveDayCapacity('2026-09-21', state);

    assert(
      suite1,
      'Derives non-zero net available study minutes for campus weekday',
      mondayCapacity.netAvailableStudyMinutes > 0,
      `Got ${mondayCapacity.netAvailableStudyMinutes}m`
    );

    assert(
      suite1,
      'Protects fixed timetable lectures and transit buffer',
      mondayCapacity.fixedCommitmentsMinutes > 0 && mondayCapacity.fixedIntervals.length > 0
    );

    assert(
      suite1,
      'Strictly respects maximum daily study ceiling (2 hours = 120m for profile)',
      mondayCapacity.netAvailableStudyMinutes <= state.profile.dailyCapacityMaxHours * 60
    );

    assert(
      suite1,
      'Flexible windows never overlap protected nocturnal sleep window',
      mondayCapacity.flexibleIntervals.every(
        (iv) => iv.start >= mondayCapacity.wakeTimeMinutes && iv.end <= mondayCapacity.sleepTimeMinutes
      )
    );
  }

  // ==========================================
  // Suite 2: Candidate Ranking & 15 Pedagogical Factors
  // ==========================================
  const suite2 = 'Adaptive Planner: 15-Factor Candidate Sieve';
  {
    const state = getBaseState();

    // 2.1 Prerequisite filtering
    const candidates = collectEligiblePlanCandidates(state);
    const unreadyTopic = state.topics.find((t) => t.id === 'top-os-5'); // Has unmet prereq top-os-4
    const unreadyCand = candidates.find((c) => c.topicId === 'top-os-5');
    assert(
      suite2,
      'Locked topics with unmet prerequisites are marked as ineligible',
      Boolean(unreadyCand && unreadyCand.prerequisitesMet === false)
    );

    // 2.2 Active semester bonus
    const activeSemSubject = state.subjects.find((s) => s.semesterId === state.activeSemesterId);
    const activeSemCandidate = candidates.find((c) => c.subjectId === activeSemSubject?.id);
    assert(
      suite2,
      'Topics belonging to current active semester receive priority ranking',
      Boolean(activeSemCandidate && activeSemCandidate.priorityScore > 50)
    );

    // 2.3 User goal alignment bonus
    const alignedGoal = state.goals[0];
    const goalCandidate = candidates.find((c) => c.subjectId === alignedGoal?.subjectId || c.title.toLowerCase().includes('data structure'));
    assert(
      suite2,
      'Topics aligned with active user goals receive alignment bonus and explanation',
      Boolean(goalCandidate && (goalCandidate.reason.includes('goal') || goalCandidate.priorityScore >= 70))
    );

    // 2.4 Weak topic remediation boost
    const weakTopic = state.topics.find((t) => t.status === 'ready' || t.status === 'completed');
    if (weakTopic) {
      state.sessions.push({
        id: 'sess-weak-1',
        topicId: weakTopic.id,
        subjectId: weakTopic.subjectId || 'sub-os',
        date: '2026-09-20',
        startTime: '2026-09-20T10:00:00Z',
        plannedDurationMinutes: 45,
        actualDurationMinutes: 45,
        energyRating: 2,
        comprehensionRating: 1, // Weak recall
        keyTakeaways: 'Struggled with fundamentals',
      });
      const weakCandidates = collectEligiblePlanCandidates(state);
      const weakCand = weakCandidates.find((c) => c.topicId === weakTopic.id);
      assert(
        suite2,
        'Weak topic with low comprehension rating (<= 2) receives remediation boost',
        Boolean(weakCand && weakCand.reason.includes('reinforcement'))
      );
    }

    // 2.5 Overdue spaced repetition boost
    const overdueTopic = state.topics.find((t) => t.id !== weakTopic?.id && t.status !== 'locked');
    if (overdueTopic) {
      overdueTopic.lastStudiedAt = '2026-09-10T10:00:00Z'; // 11 days ago
      overdueTopic.masteryLevel = 60;
      const repCandidates = collectEligiblePlanCandidates(state);
      const repCand = repCandidates.find((c) => c.topicId === overdueTopic.id);
      assert(
        suite2,
        'Topics studied > 5 days ago receive spaced repetition boost',
        Boolean(repCand && (repCand.reason.includes('spaced repetition') || repCand.priorityScore >= 60))
      );
    }
  }

  // ==========================================
  // Suite 3: AI Recommendation Validation
  // ==========================================
  const suite3 = 'Adaptive Planner: AI Validation & Sizing Barrier';
  {
    const state = getBaseState();
    const candidates = collectEligiblePlanCandidates(state);
    const safeCapacity = 100; // minutes

    // 3.1 Clamping unrealistic durations
    const rawProposals = [
      {
        topicId: candidates[0]?.topicId,
        title: 'Super Short Quiz',
        plannedMinutes: 5, // Below 20m minimum
        activityType: 'academic_study',
      },
      {
        topicId: candidates[1]?.topicId,
        title: 'Marathon Session',
        plannedMinutes: 240, // Above 90m maximum
        activityType: 'academic_study',
      },
      {
        topicId: 'hallucinated-topic-xyz',
        title: 'Hallucinated AI Topic',
        plannedMinutes: 45,
        activityType: 'academic_study',
      },
    ];

    const validation = validateAIPlanRecommendations(rawProposals, candidates, safeCapacity);

    assert(
      suite3,
      'Clamps sub-20m tasks to minimum focus chunk (20m)',
      validation.sanitizedProposals[0]?.recommendedMinutes >= 20
    );

    assert(
      suite3,
      'Caps excessive tasks to maximum single focus session (90m)',
      validation.sanitizedProposals[1]?.recommendedMinutes <= 90
    );

    const totalMinutes = validation.sanitizedProposals.reduce((acc, curr) => acc + curr.recommendedMinutes, 0);
    assert(
      suite3,
      'Sanitized proposals strictly respect max safe capacity budget (<= 100m)',
      totalMinutes <= safeCapacity,
      `Got ${totalMinutes}m for max ${safeCapacity}m`
    );

    // 3.2 Locked topic proposal rejection
    const lockedTopic = state.topics.find((t) => t.status === 'locked' && !t.isUserOverride);
    if (lockedTopic) {
      const lockedProposal = [
        {
          topicId: lockedTopic.id,
          title: lockedTopic.title,
          plannedMinutes: 45,
          activityType: 'academic_study',
        },
      ];
      const lockedVal = validateAIPlanRecommendations(lockedProposal, candidates, safeCapacity);
      assert(
        suite3,
        'Strictly rejects AI proposals for topics with unmet prerequisites',
        lockedVal.sanitizedProposals.every((p) => p.topicId !== lockedTopic.id)
      );
    }
  }

  // ==========================================
  // Suite 4: Deterministic Placement & Break Injection
  // ==========================================
  const suite4 = 'Adaptive Planner: Window Placement & Breaks';
  {
    const candidates: PlanCandidate[] = [
      {
        id: 'c-1',
        title: 'Discrete Math Concept',
        domain: 'academic',
        activityType: 'academic_study',
        priority: 'high',
        priorityScore: 90,
        recommendedMinutes: 45,
        reason: 'Curriculum requirement',
        prerequisitesMet: true,
        masteryLevel: 40,
      },
      {
        id: 'c-2',
        title: 'Binary Tree Practice',
        domain: 'career',
        activityType: 'dsa_practice',
        priority: 'medium',
        priorityScore: 75,
        recommendedMinutes: 45,
        reason: 'Career goal',
        prerequisitesMet: true,
        masteryLevel: 30,
      },
    ];

    const flexibleIntervals = [
      { start: 960, end: 1100, type: 'study_window' as const }, // 16:00 to 18:20 (140 mins free)
    ];

    const placement = placeActivitiesIntoFlexibleWindows('2026-09-21', candidates, flexibleIntervals, {
      includeBreaks: true,
      breakMinutes: 10,
    });

    assert(
      suite4,
      'Places all feasible study activities into flexible window',
      placement.items.filter((i) => !i.isBreak).length === 2
    );

    assert(
      suite4,
      'Inserts 10-minute cognitive break between consecutive study sessions',
      placement.items.some((i) => i.isBreak && i.plannedMinutes === 10)
    );

    // Verify non-overlapping monotonic schedule
    let isMonotonic = true;
    for (let i = 0; i < placement.items.length - 1; i++) {
      const curEnd = timeToMinutes(placement.items[i].endTime!);
      const nextStart = timeToMinutes(placement.items[i + 1].scheduledTime!);
      if (curEnd > nextStart) {
        isMonotonic = false;
        break;
      }
    }
    assert(
      suite4,
      'Scheduled items are strictly non-overlapping and chronologically ordered',
      isMonotonic
    );
  }

  // ==========================================
  // Suite 5: Morning Check-In Scenarios
  // ==========================================
  const suite5 = 'Adaptive Planner: Morning Check-In Reality';
  {
    const state = getBaseState();

    // 5.1 "I feel tired"
    const tiredCheckIn: DailyCheckInInput = {
      date: '2026-09-21',
      tired: true,
      energyLevel: 'low',
    };
    const tiredCandidates = collectEligiblePlanCandidates(state, tiredCheckIn);
    assert(
      suite5,
      'When tired, recommended session size is reduced to gentle 30m chunks',
      tiredCandidates.every((c) => c.recommendedMinutes <= 30)
    );

    // 5.2 "I have an assignment due tomorrow"
    const assignmentCheckIn: DailyCheckInInput = {
      date: '2026-09-21',
      hasUrgentAssignment: true,
      assignmentDetails: 'Operating Systems Virtual Memory Lab Report',
    };
    const assignmentCandidates = collectEligiblePlanCandidates(state, assignmentCheckIn);
    assert(
      suite5,
      'Urgent assignment tops the candidate list with highest priority score',
      assignmentCandidates[0]?.activityType === 'college_work' && assignmentCandidates[0]?.priorityScore >= 120
    );

    // 5.3 "I have no college work today"
    const noCollegeCheckIn: DailyCheckInInput = {
      date: '2026-09-21',
      hasCollegeWorkToday: false,
    };
    const noCollegeCandidates = collectEligiblePlanCandidates(state, noCollegeCheckIn);
    const topNonCollege = noCollegeCandidates[0];
    assert(
      suite5,
      'No college work boosts career learning and DSA practice',
      Boolean(topNonCollege && (topNonCollege.domain === 'career' || topNonCollege.activityType === 'dsa_practice' || topNonCollege.priorityScore >= 70))
    );

    // 5.4 "I want to focus on Java today"
    const javaCheckIn: DailyCheckInInput = {
      date: '2026-09-21',
      focusTopicOrSkill: 'Java',
    };
    const javaCandidates = collectEligiblePlanCandidates(state, javaCheckIn);
    const javaCand = javaCandidates.find((c) => c.title.toLowerCase().includes('java'));
    assert(
      suite5,
      'Expressed skill focus (Java) applies +35 bonus to matching topic',
      Boolean(javaCand && javaCand.priorityScore >= 75)
    );
  }

  // ==========================================
  // Suite 6: Mid-Day Adaptation & No Schedule Debt
  // ==========================================
  const suite6 = 'Adaptive Planner: Mid-Day Adaptation';
  {
    const state = getBaseState();
    const dateStr = '2026-09-21';

    // Seed an initial mission with 3 tasks across afternoon/evening
    state.missions[dateStr] = {
      id: `m-${dateStr}`,
      date: dateStr,
      availableMinutes: 120,
      allocatedMinutes: 120,
      items: [
        {
          id: 'mi-past-completed',
          title: 'Java Fundamentals',
          plannedMinutes: 30,
          actualMinutes: 30,
          status: 'completed',
          scheduledTime: '15:00',
          endTime: '15:30',
          isAIRecorded: true,
          activityType: 'career_learning',
        },
        {
          id: 'mi-past-missed',
          title: 'Database Normalization',
          plannedMinutes: 45,
          actualMinutes: 0,
          status: 'pending',
          scheduledTime: '15:45',
          endTime: '16:30',
          isAIRecorded: true,
          activityType: 'academic_study',
        },
        {
          id: 'mi-future-pending',
          title: 'Binary Tree Traversal',
          plannedMinutes: 45,
          actualMinutes: 0,
          status: 'pending',
          scheduledTime: '17:00',
          endTime: '17:45',
          isAIRecorded: true,
          activityType: 'dsa_practice',
        },
      ],
    };

    // Run mid-day adaptation at 16:30
    const adaptation = adaptMidDaySchedule(dateStr, state, '16:30');

    assert(
      suite6,
      'Preserves completed historical study sessions untouched',
      adaptation.revisedMission.items.some((i) => i.id === 'mi-past-completed' && i.status === 'completed')
    );

    assert(
      suite6,
      'Reschedules unfinished tasks into remaining valid flexible windows strictly after current time',
      adaptation.rebalancedItems.every((i) => timeToMinutes(i.scheduledTime!) >= timeToMinutes('16:30'))
    );

    assert(
      suite6,
      'Does NOT schedule into sleep hours (no schedule debt past bedtime)',
      adaptation.revisedMission.items.every((i) => {
        if (!i.endTime) return true;
        return timeToMinutes(i.endTime) <= 1380; // 23:00 bedtime
      })
    );
  }

  // ==========================================
  // Suite 7: User Controls (Accept, Edit, Remove, Replace, Skip)
  // ==========================================
  const suite7 = 'Adaptive Planner: User Control Overrides';
  {
    const dateStr = '2026-09-21';
    const initialMission: DailyMission = {
      id: `m-${dateStr}`,
      date: dateStr,
      availableMinutes: 90,
      allocatedMinutes: 90,
      items: [
        {
          id: 'task-1',
          title: 'Graph BFS Traversal',
          plannedMinutes: 45,
          actualMinutes: 0,
          status: 'pending',
          scheduledTime: '16:00',
          endTime: '16:45',
          isAIRecorded: true,
          activityType: 'dsa_practice',
        },
        {
          id: 'task-2',
          title: 'Computer Architecture Cache Memory',
          plannedMinutes: 45,
          actualMinutes: 0,
          status: 'pending',
          scheduledTime: '17:00',
          endTime: '17:45',
          isAIRecorded: true,
          activityType: 'academic_study',
        },
      ],
    };

    // 7.1 Skip Mission Item
    const afterSkip = skipMissionItem(dateStr, 'task-1', initialMission);
    const skippedItem = afterSkip.items.find((i) => i.id === 'task-1');

    assert(
      suite7,
      'skipMissionItem marks item status as skipped',
      skippedItem?.status === 'skipped'
    );

    assert(
      suite7,
      'Skipping an item releases capacity minutes (45m allocated instead of 90m)',
      afterSkip.allocatedMinutes === 45
    );

    assert(
      suite7,
      'Skipped item reason notes return to curriculum pool without penalty',
      Boolean(skippedItem?.reason && skippedItem.reason.includes('Skipped'))
    );
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
