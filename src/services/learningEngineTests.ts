import { AppState, RoadmapTopic, StudySession } from '../types';
import {
  calculateRoadmapProgress,
  calculateTopicProgress,
  detectCycleInTopics,
  evaluatePrerequisites,
  getDependents,
  getLockedTopics,
  getPrerequisites,
  getReadyTopics,
  MASTERY_THRESHOLD_COMPLETED,
  MASTERY_THRESHOLD_PREREQ,
  recalculateRoadmapStatus,
  topologicalSortTopics,
  validateTopicPrerequisites,
} from './learningEngine';
import { SEED_PROFILE, SEED_SEMESTERS, SEED_SUBJECTS, SEED_TIMETABLE, SEED_TOPICS } from './seedData';

export interface LearningTestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

export function runLearningEngineTests(): {
  total: number;
  passed: number;
  failed: number;
  results: LearningTestResult[];
} {
  const results: LearningTestResult[] = [];

  function assert(suite: string, name: string, condition: boolean, message?: string, details?: string) {
    if (condition) {
      results.push({ suite, name, passed: true, details });
    } else {
      results.push({ suite, name, passed: false, error: message || 'Assertion failed', details });
    }
  }

  // ==========================================
  // Suite 1: DAG Representation & Prerequisites
  // ==========================================
  const suite1 = 'DAG & Prerequisite Evaluation';

  const baseTopics: RoadmapTopic[] = [
    {
      id: 't-1',
      subjectId: 'sub-test',
      title: 'Foundations',
      description: 'First module',
      estimatedMinutes: 45,
      prerequisiteTopicIds: [],
      status: 'completed',
      masteryLevel: 100,
      orderIndex: 1,
    },
    {
      id: 't-2',
      subjectId: 'sub-test',
      title: 'Intermediate Concepts',
      description: 'Second module',
      estimatedMinutes: 50,
      prerequisiteTopicIds: ['t-1'],
      status: 'ready',
      masteryLevel: 30,
      orderIndex: 2,
    },
    {
      id: 't-3',
      subjectId: 'sub-test',
      title: 'Advanced Applications',
      description: 'Third module',
      estimatedMinutes: 60,
      prerequisiteTopicIds: ['t-2'],
      status: 'locked',
      masteryLevel: 0,
      orderIndex: 3,
    },
  ];

  const evalT1 = evaluatePrerequisites(baseTopics[0], baseTopics);
  assert(suite1, 'Topic without prerequisites is satisfied', evalT1.prerequisitesMet && evalT1.missingPrereqs.length === 0);

  const evalT2 = evaluatePrerequisites(baseTopics[1], baseTopics);
  assert(suite1, 'Topic with completed prerequisite (mastery 100%) is satisfied', evalT2.prerequisitesMet);

  const evalT3 = evaluatePrerequisites(baseTopics[2], baseTopics);
  assert(suite1, 'Topic with incomplete prerequisite (mastery 30%) is NOT satisfied', !evalT3.prerequisitesMet && evalT3.missingPrereqs.length === 1);

  // Downstream & Upstream graph relationships
  const prereqsOfT3 = getPrerequisites('t-3', baseTopics);
  assert(suite1, 'getPrerequisites retrieves upstream topic', prereqsOfT3.length === 1 && prereqsOfT3[0].id === 't-2');

  const dependentsOfT1 = getDependents('t-1', baseTopics);
  assert(suite1, 'getDependents retrieves downstream topic', dependentsOfT1.length === 1 && dependentsOfT1[0].id === 't-2');

  // ==========================================
  // Suite 2: Canonical 80% Mastery Thresholds
  // ==========================================
  const suite2 = 'Canonical Mastery Thresholds';

  assert(suite2, 'Mastery threshold completed constant is 80', MASTERY_THRESHOLD_COMPLETED === 80);
  assert(suite2, 'Mastery threshold prerequisite constant is 80', MASTERY_THRESHOLD_PREREQ === 80);

  // Borderline test: 79% does NOT unlock dependent topic
  const borderlineTopics: RoadmapTopic[] = [
    {
      id: 'b-1',
      subjectId: 'sub-b',
      title: 'Borderline Topic',
      description: 'At 79% mastery',
      estimatedMinutes: 45,
      prerequisiteTopicIds: [],
      status: 'in_progress',
      masteryLevel: 79,
      orderIndex: 1,
    },
    {
      id: 'b-2',
      subjectId: 'sub-b',
      title: 'Dependent Topic',
      description: 'Requires b-1',
      estimatedMinutes: 45,
      prerequisiteTopicIds: ['b-1'],
      status: 'locked',
      masteryLevel: 0,
      orderIndex: 2,
    },
  ];

  const evalB2_79 = evaluatePrerequisites(borderlineTopics[1], borderlineTopics);
  assert(suite2, '79% mastery does NOT meet prerequisite requirement', !evalB2_79.prerequisitesMet);

  // 80% unlocks dependent topic
  borderlineTopics[0].masteryLevel = 80;
  const evalB2_80 = evaluatePrerequisites(borderlineTopics[1], borderlineTopics);
  assert(suite2, '80% mastery meets prerequisite requirement', evalB2_80.prerequisitesMet);

  // ==========================================
  // Suite 3: Cycle Detection & Graph Integrity
  // ==========================================
  const suite3 = 'Cycle Detection & Graph Validation';

  // Self loop: A -> A
  const selfLoop: RoadmapTopic[] = [
    {
      id: 'cycle-1',
      subjectId: 'sub-c',
      title: 'Self Loop',
      description: 'Loops back to self',
      estimatedMinutes: 45,
      prerequisiteTopicIds: ['cycle-1'],
      status: 'locked',
      masteryLevel: 0,
      orderIndex: 1,
    },
  ];
  const detectedSelfLoop = detectCycleInTopics(selfLoop);
  assert(suite3, 'Detects self-referencing prerequisite cycle', detectedSelfLoop !== null);

  // 2-node cycle: A -> B and B -> A
  const twoNodeCycle: RoadmapTopic[] = [
    {
      id: 'c-a',
      subjectId: 'sub-c',
      title: 'A',
      description: 'A',
      estimatedMinutes: 45,
      prerequisiteTopicIds: ['c-b'],
      status: 'locked',
      masteryLevel: 0,
      orderIndex: 1,
    },
    {
      id: 'c-b',
      subjectId: 'sub-c',
      title: 'B',
      description: 'B',
      estimatedMinutes: 45,
      prerequisiteTopicIds: ['c-a'],
      status: 'locked',
      masteryLevel: 0,
      orderIndex: 2,
    },
  ];
  const detected2Cycle = detectCycleInTopics(twoNodeCycle);
  assert(suite3, 'Detects 2-node mutual prerequisite cycle', detected2Cycle !== null);

  // Diamond DAG (A -> B, A -> C, B -> D, C -> D): Valid, no cycle!
  const diamondDag: RoadmapTopic[] = [
    {
      id: 'd-a',
      subjectId: 'sub-d',
      title: 'Root A',
      description: 'Root',
      estimatedMinutes: 45,
      prerequisiteTopicIds: [],
      status: 'completed',
      masteryLevel: 100,
      orderIndex: 1,
    },
    {
      id: 'd-b',
      subjectId: 'sub-d',
      title: 'Branch B',
      description: 'Branch',
      estimatedMinutes: 45,
      prerequisiteTopicIds: ['d-a'],
      status: 'ready',
      masteryLevel: 0,
      orderIndex: 2,
    },
    {
      id: 'd-c',
      subjectId: 'sub-d',
      title: 'Branch C',
      description: 'Branch',
      estimatedMinutes: 45,
      prerequisiteTopicIds: ['d-a'],
      status: 'ready',
      masteryLevel: 0,
      orderIndex: 3,
    },
    {
      id: 'd-d',
      subjectId: 'sub-d',
      title: 'Converged D',
      description: 'Converged',
      estimatedMinutes: 45,
      prerequisiteTopicIds: ['d-b', 'd-c'],
      status: 'locked',
      masteryLevel: 0,
      orderIndex: 4,
    },
  ];
  const detectedDiamond = detectCycleInTopics(diamondDag);
  assert(suite3, 'Valid diamond DAG passes without cycles', detectedDiamond === null);

  const topoOrder = topologicalSortTopics(diamondDag);
  assert(suite3, 'Topological sort orders diamond DAG topologically', topoOrder[0].id === 'd-a' && topoOrder[3].id === 'd-d');

  // ==========================================
  // Suite 4: Deterministic Roadmap Recalculation
  // ==========================================
  const suite4 = 'Status Recalculation Cascades';

  const cascadeTopics: RoadmapTopic[] = [
    {
      id: 'casc-1',
      subjectId: 'sub-casc',
      title: 'Topic 1',
      description: '',
      estimatedMinutes: 45,
      prerequisiteTopicIds: [],
      status: 'in_progress',
      masteryLevel: 50,
      orderIndex: 1,
    },
    {
      id: 'casc-2',
      subjectId: 'sub-casc',
      title: 'Topic 2',
      description: '',
      estimatedMinutes: 45,
      prerequisiteTopicIds: ['casc-1'],
      status: 'locked',
      masteryLevel: 0,
      orderIndex: 2,
    },
  ];

  let synced = recalculateRoadmapStatus(cascadeTopics);
  assert(suite4, 'Topic 2 remains locked when Topic 1 is at 50%', synced.find((t) => t.id === 'casc-2')?.status === 'locked');

  // Simulate Topic 1 reaching 85% mastery
  cascadeTopics[0].masteryLevel = 85;
  synced = recalculateRoadmapStatus(cascadeTopics);
  assert(suite4, 'Topic 1 automatically transitions to completed', synced.find((t) => t.id === 'casc-1')?.status === 'completed');
  assert(suite4, 'Topic 2 automatically transitions to ready', synced.find((t) => t.id === 'casc-2')?.status === 'ready');

  // ==========================================
  // Suite 5: Manual User Override
  // ==========================================
  const suite5 = 'Manual Student Override';

  const overrideTopic: RoadmapTopic = {
    id: 'ov-1',
    subjectId: 'sub-ov',
    title: 'Locked Topic with Override',
    description: '',
    estimatedMinutes: 45,
    prerequisiteTopicIds: ['missing-prereq'],
    status: 'locked',
    masteryLevel: 0,
    orderIndex: 1,
    isUserOverride: true,
  };

  const syncedOverride = recalculateRoadmapStatus([overrideTopic]);
  assert(suite5, 'User override unlocks topic to ready state despite missing prereq', syncedOverride[0].status === 'ready');

  // ==========================================
  // Suite 6: 4-Phase Pedagogical Evidence Tracking
  // ==========================================
  const suite6 = 'Pedagogical Evidence Tracking';

  const testTopic: RoadmapTopic = {
    id: 'top-ped-1',
    subjectId: 'sub-ped',
    title: 'Pedagogical Test Topic',
    description: 'Evidence verification',
    estimatedMinutes: 45,
    prerequisiteTopicIds: [],
    status: 'in_progress',
    masteryLevel: 75,
    orderIndex: 1,
  };

  const testSessions: StudySession[] = [
    {
      id: 's-1',
      subjectId: 'sub-ped',
      topicId: 'top-ped-1',
      startTime: '2026-09-20T10:00:00Z',
      endTime: '2026-09-20T10:45:00Z',
      plannedDurationMinutes: 45,
      actualDurationMinutes: 45,
      comprehensionRating: 4,
      energyRating: 4,
      keyTakeaways: 'Initial study pass',
      date: '2026-09-20',
    },
  ];

  const progressDetail = calculateTopicProgress(testTopic, testSessions);
  assert(suite6, 'Calculates total minutes and session count from real data', progressDetail.totalTimeMinutes === 45 && progressDetail.sessionsCount === 1);
  assert(suite6, 'Evidence shows studied = true', progressDetail.evidence.studied === true);
  assert(suite6, 'Evidence shows practiced = true (duration >= 30m)', progressDetail.evidence.practiced === true);
  assert(suite6, 'Evidence shows assessed = true (comprehension rating >= 3)', progressDetail.evidence.assessed === true);
  assert(suite6, 'Evidence shows mastered = false (mastery 75% < 80%)', progressDetail.evidence.mastered === false);

  // Now set mastery to 80%
  testTopic.masteryLevel = 80;
  const progressMastered = calculateTopicProgress(testTopic, testSessions);
  assert(suite6, 'Evidence shows mastered = true when mastery reaches 80%', progressMastered.evidence.mastered === true);

  // ==========================================
  // Suite 7: Seed Data Curriculum Graph Integrity
  // ==========================================
  const suite7 = 'Seed Curriculum Graph Integrity';

  const seedCycle = detectCycleInTopics(SEED_TOPICS);
  assert(suite7, 'All seed topics across Academic, Career & Project paths form a cycle-free DAG', seedCycle === null);

  const readySeedTopics = getReadyTopics(SEED_TOPICS);
  assert(suite7, 'Curriculum provides immediate feasible ready topics for students', readySeedTopics.length > 0);

  const lockedSeedTopics = getLockedTopics(SEED_TOPICS);
  assert(suite7, 'Curriculum provides locked topics properly dependent on upstream concepts', lockedSeedTopics.length > 0);

  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    results,
  };
}
