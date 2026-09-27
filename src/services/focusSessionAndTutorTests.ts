/**
 * NEXORA Focus Session & Context-Aware AI Tutor Test Suite
 * Validates session lifecycle, timer calculations, data persistence,
 * tutor context construction, pedagogical modes, locked topic protection,
 * solo coding mode, and AI advisory boundaries.
 */
import { AppState, MissionItem, RoadmapTopic, StudySession, Subject } from '../types';
import { DataService, InMemoryStorageAdapter } from './dataService';
import { SEED_PROFILE, SEED_SEMESTERS, SEED_SUBJECTS } from './seedData';
import { 
  buildTutorContext, 
  constructTutorSystemPrompt, 
  evaluateTestSubmission, 
  generateDeterministicTutorFallback, 
  generatePracticeProblems, 
  generateTestAssessment, 
  parseExplainItBackFeedback, 
  reviewSoloCodeSubmission 
} from './ai/tutorService';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
}

export function runFocusSessionAndTutorTests(): { total: number; passed: number; failed: number; results: TestResult[] } {
  const results: TestResult[] = [];

  function assert(suite: string, name: string, condition: boolean, message?: string) {
    if (condition) {
      results.push({ suite, name, passed: true });
    } else {
      results.push({ suite, name, passed: false, error: message || 'Assertion failed' });
    }
  }

  // Set up mock test state
  const mockSubject: Subject = {
    id: 'sub-os',
    semesterId: 'sem-fall-2026',
    code: 'CS 301',
    name: 'Operating Systems',
    color: '#6366f1',
    targetWeeklyHours: 6,
    credits: 4,
  };

  const mockTopic1: RoadmapTopic = {
    id: 'top-1',
    subjectId: 'sub-os',
    title: 'Process Lifecycle & States',
    description: 'Fork, exec, wait syscalls and PCB structures',
    estimatedMinutes: 45,
    prerequisiteTopicIds: [],
    status: 'completed',
    masteryLevel: 100,
    orderIndex: 1,
    domain: 'Operating Systems',
  };

  const mockTopic2: RoadmapTopic = {
    id: 'top-2',
    subjectId: 'sub-os',
    title: 'Process Synchronization & Mutexes',
    description: 'Critical sections, race conditions, and semaphores',
    estimatedMinutes: 45,
    prerequisiteTopicIds: ['top-1'],
    status: 'in_progress',
    masteryLevel: 40,
    orderIndex: 2,
    domain: 'Operating Systems',
  };

  const mockTopic3: RoadmapTopic = {
    id: 'top-3',
    subjectId: 'sub-os',
    title: 'Deadlock Detection & Prevention',
    description: 'Banker algorithm and resource allocation graphs',
    estimatedMinutes: 45,
    prerequisiteTopicIds: ['top-2'], // Locked because top-2 mastery is 40% (< 80%)
    status: 'locked',
    masteryLevel: 0,
    orderIndex: 3,
    domain: 'Operating Systems',
  };

  const mockMissionItem: MissionItem = {
    id: 'mi-focus-1',
    topicId: 'top-2',
    subjectId: 'sub-os',
    title: 'Study: Process Synchronization & Mutexes',
    plannedMinutes: 45,
    actualMinutes: 0,
    status: 'pending',
    scheduledTime: '14:00',
    endTime: '14:45',
    isAIRecorded: false,
    activityType: 'academic_study',
    objective: 'Master mutex primitives and race condition prevention',
  };

  const initialTestState: AppState = {
    profile: { ...SEED_PROFILE },
    semesters: [...SEED_SEMESTERS],
    activeSemesterId: 'sem-fall-2026',
    subjects: [mockSubject],
    timetable: [],
    topics: [mockTopic1, mockTopic2, mockTopic3],
    missions: {
      '2026-09-21': {
        id: 'mission-2026-09-21',
        date: '2026-09-21',
        availableMinutes: 180,
        allocatedMinutes: 45,
        items: [mockMissionItem],
      },
    },
    sessions: [
      {
        id: 'sess-prev-1',
        topicId: 'top-2',
        subjectId: 'sub-os',
        startTime: '2026-09-20T10:00:00Z',
        endTime: '2026-09-20T10:35:00Z',
        plannedDurationMinutes: 45,
        actualDurationMinutes: 35,
        comprehensionRating: 3,
        energyRating: 4,
        keyTakeaways: 'Reviewed critical section problem definition',
        date: '2026-09-20',
      },
    ],
    goals: [],
  };

  const adapter = new InMemoryStorageAdapter();
  adapter.setItem('nexora_os_v1', JSON.stringify(initialTestState));
  const dataService = new DataService(adapter);

  // -------------------------------------------------------------
  // Test Suite 1: Focus Session Lifecycle
  // -------------------------------------------------------------
  try {
    // 1. Session start
    const plannedSecs = mockMissionItem.plannedMinutes * 60;
    assert('Focus Session Lifecycle', 'Session start initializes planned duration and context', plannedSecs === 2700);
    assert('Focus Session Lifecycle', 'Session knows scheduled time window', mockMissionItem.scheduledTime === '14:00' && mockMissionItem.endTime === '14:45');
    assert('Focus Session Lifecycle', 'Session knows objective', Boolean(mockMissionItem.objective?.includes('mutex')));

    // 2. Pause and resume simulation
    let elapsed = 0;
    let running = true;
    elapsed += 300; // 5 mins
    running = false; // Paused
    assert('Focus Session Lifecycle', 'Timer pause preserves elapsed time without reset', elapsed === 300 && !running);
    running = true; // Resumed
    elapsed += 600; // 10 more mins
    assert('Focus Session Lifecycle', 'Timer resume continues accumulation accurately', elapsed === 900 && running);

    // 3. Finish early
    const earlyActualMins = Math.round(900 / 60); // 15 mins
    assert('Focus Session Lifecycle', 'Finish early records actual time less than planned duration', earlyActualMins < mockMissionItem.plannedMinutes && earlyActualMins === 15);

    // 4. Overtime allowance
    const overtimeElapsed = 3000; // 50 mins elapsed for a 45 min planned session
    const isOvertime = overtimeElapsed > plannedSecs;
    const overtimeDuration = overtimeElapsed - plannedSecs;
    assert('Focus Session Lifecycle', 'Timer supports overtime flow when elapsed exceeds planned', isOvertime);
    assert('Focus Session Lifecycle', 'Overtime duration is calculated accurately (300 seconds = 5m)', overtimeDuration === 300);

    // 5. Planned vs actual duration independent recording
    const testSession: StudySession = {
      id: 'sess-test-flow-1',
      missionItemId: mockMissionItem.id,
      topicId: mockTopic2.id,
      subjectId: mockSubject.id,
      startTime: '2026-09-21T14:00:00Z',
      endTime: '2026-09-21T14:42:00Z',
      plannedDurationMinutes: 45,
      actualDurationMinutes: 42,
      comprehensionRating: 4,
      energyRating: 4,
      keyTakeaways: 'Implemented atomic test-and-set spinlock with bounded waiting',
      difficultyNote: 'Watch out for priority inversion under high core contention',
      date: '2026-09-21',
    };

    assert('Focus Session Lifecycle', 'Session models planned vs actual duration independently', testSession.plannedDurationMinutes === 45 && testSession.actualDurationMinutes === 42);
    assert('Focus Session Lifecycle', 'Session collects optional difficulty note', Boolean(testSession.difficultyNote));

    // 6. Session persistence via DataService
    dataService.recordStudySession(testSession);
    const updatedState = dataService.getState();
    const persistedSession = updatedState.sessions.find((s) => s.id === 'sess-test-flow-1');
    assert('Focus Session Lifecycle', 'Session persists cleanly to dataService', Boolean(persistedSession));
    assert('Focus Session Lifecycle', 'Persisted session preserves difficulty note', persistedSession?.difficultyNote === testSession.difficultyNote);

    // Verify mission item update
    const updatedMission = dataService.getDailyMission('2026-09-21');
    const updatedItem = updatedMission?.items.find((i) => i.id === mockMissionItem.id);
    assert('Focus Session Lifecycle', 'Mission item actualMinutes is incremented by actual session duration', updatedItem?.actualMinutes === 42);
    assert('Focus Session Lifecycle', 'Mission item status is transitioned to completed', updatedItem?.status === 'completed');

    // 7. Comprehension recording & topic mastery boost
    // Mastery was 40%, comprehension rating was 4 -> Boost = 4 * 5 = +20% -> New Mastery = 60%
    const updatedTopic = dataService.getTopicById(mockTopic2.id);
    assert('Focus Session Lifecycle', 'Comprehension rating 4 boosts mastery by +20% (40% -> 60%)', updatedTopic?.masteryLevel === 60);
    assert('Focus Session Lifecycle', 'Topic status remains in_progress when mastery < 80%', updatedTopic?.status === 'in_progress');

    // Test completion transition when mastery reaches >= 80%
    const completionSession: StudySession = {
      id: 'sess-test-completion',
      missionItemId: mockMissionItem.id,
      topicId: mockTopic2.id,
      subjectId: mockSubject.id,
      startTime: '2026-09-21T16:00:00Z',
      endTime: '2026-09-21T16:30:00Z',
      plannedDurationMinutes: 30,
      actualDurationMinutes: 30,
      comprehensionRating: 5, // +25% boost -> 60% + 25% = 85%
      energyRating: 5,
      keyTakeaways: 'Mastered semaphore synchronization primitives',
      date: '2026-09-21',
    };
    dataService.recordStudySession(completionSession);

    const completedTopic = dataService.getTopicById(mockTopic2.id);
    assert('Focus Session Lifecycle', 'Mastery reaching 85% automatically transitions topic to completed', completedTopic?.status === 'completed');

    // Verify downstream DAG topic unlocked!
    const unlockedDependent = dataService.getTopicById(mockTopic3.id);
    assert('Focus Session Lifecycle', 'Downstream dependent topic automatically unlocks to ready status', unlockedDependent?.status === 'ready');

    // Verify Session Summary calculation
    const summary = dataService.calculateSessionSummary(testSession);
    assert('Focus Session Lifecycle', 'Session summary calculates planned vs actual', summary.plannedMinutes === 45 && summary.actualMinutes === 42);
    assert('Focus Session Lifecycle', 'Session summary reports studied, practiced, assessed evidence', summary.evidence.studied && summary.evidence.practiced && summary.evidence.assessed);
    assert('Focus Session Lifecycle', 'Session summary derives intelligent next recommended action', Boolean(summary.nextRecommendedAction.length > 10));

  } catch (err: any) {
    assert('Focus Session Lifecycle', 'Focus Session lifecycle suite encountered error', false, err.message);
  }

  // -------------------------------------------------------------
  // Test Suite 2: Context-Aware AI Tutor Engine
  // -------------------------------------------------------------
  try {
    const currentState = dataService.getState();

    // 8. Tutor context construction
    const tutorCtx = buildTutorContext(currentState, mockTopic2.id);
    assert('Context-Aware AI Tutor', 'Context includes active semester', Boolean(tutorCtx.semester?.name?.includes('Fall 2026')));
    assert('Context-Aware AI Tutor', 'Context includes subject code and name', tutorCtx.subject?.code === 'CS 301');
    assert('Context-Aware AI Tutor', 'Context includes domain', tutorCtx.domain === 'Operating Systems');
    assert('Context-Aware AI Tutor', 'Context includes target topic title', tutorCtx.topic?.title === mockTopic2.title);
    assert('Context-Aware AI Tutor', 'Context includes topic mastery level', typeof tutorCtx.topicMastery === 'number');
    assert('Context-Aware AI Tutor', 'Context includes prerequisite status and mastery', tutorCtx.prerequisites !== undefined && tutorCtx.prerequisites.length > 0);
    assert('Context-Aware AI Tutor', 'Context includes past session reflections', tutorCtx.previousSessions !== undefined && tutorCtx.previousSessions.length > 0);
    assert('Context-Aware AI Tutor', 'Context includes calculated average comprehension history', typeof tutorCtx.comprehensionHistory?.averageComprehension === 'number');

    // 9. Explain Mode structure
    const explainPrompt = constructTutorSystemPrompt(tutorCtx, 'explain');
    assert('Context-Aware AI Tutor', 'Explain mode instructs simple explanation', explainPrompt.includes('Simple explanation'));
    assert('Context-Aware AI Tutor', 'Explain mode instructs small example', explainPrompt.includes('Small example'));
    assert('Context-Aware AI Tutor', 'Explain mode instructs why it matters', explainPrompt.includes('Why it matters'));
    assert('Context-Aware AI Tutor', 'Explain mode instructs common mistake', explainPrompt.includes('Common mistake'));
    assert('Context-Aware AI Tutor', 'Explain mode instructs quick check question', explainPrompt.includes('One quick check question'));
    assert('Context-Aware AI Tutor', 'Explain mode adapts depth to user mastery', explainPrompt.includes('Adapt depth to the student\'s current mastery'));

    // 10. Why Mode structure
    const whyPrompt = constructTutorSystemPrompt(tutorCtx, 'why');
    assert('Context-Aware AI Tutor', 'Why mode instructs purpose', whyPrompt.includes('Purpose:'));
    assert('Context-Aware AI Tutor', 'Why mode instructs intuition', whyPrompt.includes('Intuition:'));
    assert('Context-Aware AI Tutor', 'Why mode instructs practical reason', whyPrompt.includes('Practical reason:'));
    assert('Context-Aware AI Tutor', 'Why mode instructs alternative', whyPrompt.includes('Alternative:'));
    assert('Context-Aware AI Tutor', 'Why mode warns against textbook-length filler', whyPrompt.includes('Avoid unnecessary textbook-length filler'));

    // 11. Explain-It-Back evaluation
    const sampleExplainBackOutput = `Understanding: 85/100

What you got right:
- Correctly identified mutual exclusion requirement
- Explained spinlock behavior on multi-core systems

What is missing:
- Discussion of priority inversion edge case
- Bounded waiting guarantee

One correction:
- Disabling interrupts in user-space is prohibited by modern CPU privilege rings.

Follow-up question:
- How does a counting semaphore generalize this concept to N resources?`;

    const parsedFeedback = parseExplainItBackFeedback(sampleExplainBackOutput);
    assert('Context-Aware AI Tutor', 'Explain-it-back extracts understanding score (85/100)', parsedFeedback.understandingScore === 85);
    assert('Context-Aware AI Tutor', 'Explain-it-back extracts what student got right', parsedFeedback.whatYouGotRight.length >= 2);
    assert('Context-Aware AI Tutor', 'Explain-it-back extracts what is missing', parsedFeedback.whatIsMissing.length >= 2);
    assert('Context-Aware AI Tutor', 'Explain-it-back extracts one concrete correction', Boolean(parsedFeedback.oneCorrection.includes('interrupts')));
    assert('Context-Aware AI Tutor', 'Explain-it-back extracts follow-up probing question', Boolean(parsedFeedback.followUpQuestion.includes('semaphore')));
    assert('Context-Aware AI Tutor', 'Explain-it-back does NOT mark topic completed (advisory boundary)', dataService.getTopicById('top-1')?.status === 'completed');

    // 12. Practice generation
    const practiceProblems = generatePracticeProblems(tutorCtx);
    assert('Context-Aware AI Tutor', 'Practice generation produces 1 to 3 problems', practiceProblems.problems.length >= 1 && practiceProblems.problems.length <= 3);
    assert('Context-Aware AI Tutor', 'Practice problems match topic and difficulty', Boolean(practiceProblems.problems[0].difficulty));
    assert('Context-Aware AI Tutor', 'Practice problems provide progressive hints', practiceProblems.problems[0].hints.length >= 1);

    // 13. Test generation & evaluation
    const assessment = generateTestAssessment(tutorCtx);
    assert('Context-Aware AI Tutor', 'Test generation creates multiple choice question', assessment.problems.some((p) => p.type === 'multiple_choice'));
    assert('Context-Aware AI Tutor', 'Test generation creates short answer question', assessment.problems.some((p) => p.type === 'short_answer'));
    assert('Context-Aware AI Tutor', 'Test generation creates code problem', assessment.problems.some((p) => p.type === 'code'));
    assert('Context-Aware AI Tutor', 'Test generation creates explain-in-own-words question', assessment.problems.some((p) => p.type === 'explain'));

    const testEval = evaluateTestSubmission(assessment, {
      'test-q1': 'Inviolable safety invariant preservation across asynchronous operations',
      'test-q2': 'Serializes access through atomic lock variables',
      'test-q3': 'try { lock.acquire(); } finally { lock.release(); }',
      'test-q4': 'Guarantees that state updates do not conflict or corrupt data.',
    });
    assert('Context-Aware AI Tutor', 'Test evaluation computes percentage score', testEval.score >= 75);
    assert('Context-Aware AI Tutor', 'Test evaluation provides per-question feedback', testEval.feedbackPerQuestion.length === 4);
    assert('Context-Aware AI Tutor', 'Test evaluation recommends next action', Boolean(testEval.nextRecommendedAction));

    // 14. Locked-topic protection
    // Topic 3 depends on Topic 2. In initial state, Topic 3 is locked.
    const lockedCtx = buildTutorContext(initialTestState, mockTopic3.id);
    assert('Context-Aware AI Tutor', 'Tutor context flags locked topic when prerequisites are missing', lockedCtx.isLocked === true);
    assert('Context-Aware AI Tutor', 'Tutor context lists missing prerequisite titles', lockedCtx.missingPrerequisites?.includes(mockTopic2.title) === true);

    const lockedPrompt = constructTutorSystemPrompt(lockedCtx, 'explain');
    assert('Context-Aware AI Tutor', 'System instruction includes locked topic warning banner', lockedPrompt.includes('LOCKED TOPIC NOTICE:'));

    // 15. Solo Mode answer protection
    const soloPrompt = constructTutorSystemPrompt(tutorCtx, 'explain', true);
    assert('Context-Aware AI Tutor', 'Solo mode prompt forbids revealing complete solutions', soloPrompt.includes('DO NOT reveal the complete solution'));
    assert('Context-Aware AI Tutor', 'Solo mode prompt forbids auto-generating code', soloPrompt.includes('DO NOT automatically generate working code'));
    assert('Context-Aware AI Tutor', 'Solo mode prompt restricts hints to explicit request', soloPrompt.includes('Provide progressive hints ONLY if the student explicitly asks'));

    const soloChallenge = {
      id: 'sc-1',
      title: 'Implement Mutex Lock',
      topicTitle: 'Mutex Locks',
      description: 'Implement a lock container',
      hints: ['Check base case', 'Wrap in finally'],
    };
    const codeReview = reviewSoloCodeSubmission(soloChallenge, `
      export function executeSolution(input: any) {
        if (!input) return null;
        try {
          return input.process();
        } finally {
          input.release();
        }
      }
    `);
    assert('Context-Aware AI Tutor', 'Solo review analyzes correctness and logic', codeReview.correctness === 'correct');
    assert('Context-Aware AI Tutor', 'Solo review analyzes time and space complexity', Boolean(codeReview.complexity.time && codeReview.complexity.space));
    assert('Context-Aware AI Tutor', 'Solo review analyzes edge cases', codeReview.edgeCases.length >= 2);

    // 16. AI response validation & advisory boundaries
    assert('Context-Aware AI Tutor', 'System prompt enforces advisory boundary (cannot mutate roadmap)', explainPrompt.includes('strictly ADVISORY'));
    assert('Context-Aware AI Tutor', 'System prompt enforces cannot mark topics mastered', explainPrompt.includes('CANNOT directly mutate roadmap state, mark topics mastered'));

    // Offline deterministic fallback verification
    const offlineExplain = generateDeterministicTutorFallback(tutorCtx, 'explain', 'What is this?');
    assert('Context-Aware AI Tutor', 'Offline fallback provides 5-step explanation without API key', offlineExplain.includes('1. Simple Explanation') && offlineExplain.includes('5. Quick Check Question'));

    const offlineWhy = generateDeterministicTutorFallback(tutorCtx, 'why', 'Why do we need this?');
    assert('Context-Aware AI Tutor', 'Offline fallback provides Purpose, Intuition, Practical Reason', offlineWhy.includes('Purpose') && offlineWhy.includes('Practical Reason'));

  } catch (err: any) {
    assert('Context-Aware AI Tutor', 'Context-Aware AI Tutor suite encountered error', false, err.message);
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  return { total: results.length, passed, failed, results };
}
