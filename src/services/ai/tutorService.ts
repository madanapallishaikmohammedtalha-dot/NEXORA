import { 
  AppState, 
  AssessmentProblem, 
  ExplainItBackFeedback, 
  MissionItem, 
  PracticeProblem, 
  PracticeProblemSet, 
  RoadmapTopic, 
  SoloCodeReview, 
  SoloCodingChallenge, 
  TestAssessment, 
  TestEvaluation, 
  TutorContext, 
  TutorMode 
} from '../../types';
import { evaluatePrerequisites, MASTERY_THRESHOLD_COMPLETED } from '../learningEngine';
import { aiService } from './service';

/**
 * 1. Constructs rich, curriculum-grounded tutor context from app state.
 * Grounded in: semester, subject, roadmap domain, topic, prerequisites,
 * mastery, previous session logs, comprehension history, and active objective.
 */
export function buildTutorContext(
  state: AppState,
  topicId?: string,
  missionItem?: MissionItem
): TutorContext {
  const activeSemester = state.semesters.find((s) => s.id === state.activeSemesterId);
  const targetTopicId = topicId || missionItem?.topicId || state.topics[0]?.id;
  const currentTopic = state.topics.find((t) => t.id === targetTopicId);
  const currentSubject = currentTopic?.subjectId 
    ? state.subjects.find((s) => s.id === currentTopic.subjectId)
    : state.subjects[0];

  // Prerequisite evaluation and locked topic detection
  let prereqs: Array<{ id: string; title: string; status: any; masteryLevel: number }> = [];
  let isLocked = false;
  let missingPrerequisites: string[] = [];

  if (currentTopic) {
    const prereqEval = evaluatePrerequisites(currentTopic, state.topics);
    isLocked = !prereqEval.prerequisitesMet && !currentTopic.isUserOverride;
    missingPrerequisites = prereqEval.missingPrereqs.map((p) => p.title);

    prereqs = (currentTopic.prerequisiteTopicIds || []).map((id) => {
      const p = state.topics.find((t) => t.id === id);
      return {
        id,
        title: p?.title || id,
        status: p?.status || 'locked',
        masteryLevel: p?.masteryLevel || 0,
      };
    });
  }

  // Previous sessions for this topic or subject
  const topicSessions = state.sessions.filter((s) => {
    if (currentTopic && s.topicId === currentTopic.id) return true;
    if (!currentTopic && currentSubject && s.subjectId === currentSubject.id) return true;
    return false;
  });

  const previousSessions = topicSessions.slice(0, 5).map((s) => ({
    date: s.date,
    actualDurationMinutes: s.actualDurationMinutes,
    comprehensionRating: s.comprehensionRating,
    energyRating: s.energyRating,
    keyTakeaways: s.keyTakeaways,
    difficultyNote: s.difficultyNote,
  }));

  // Historical comprehension metrics
  const totalSessions = topicSessions.length;
  const sumComprehension = topicSessions.reduce((acc, s) => acc + s.comprehensionRating, 0);
  const avgComprehension = totalSessions > 0 ? Number((sumComprehension / totalSessions).toFixed(1)) : 3.0;
  const recentRatings = topicSessions.slice(0, 5).map((s) => s.comprehensionRating);

  return {
    semester: activeSemester ? { id: activeSemester.id, name: activeSemester.name } : undefined,
    subject: currentSubject ? { id: currentSubject.id, code: currentSubject.code, name: currentSubject.name } : undefined,
    domain: currentTopic?.domain || currentSubject?.name,
    topic: currentTopic ? {
      id: currentTopic.id,
      title: currentTopic.title,
      description: currentTopic.description,
      masteryLevel: currentTopic.masteryLevel,
      status: currentTopic.status,
      stage: currentTopic.stage,
    } : undefined,
    prerequisites: prereqs,
    topicMastery: currentTopic?.masteryLevel ?? 0,
    previousSessions,
    comprehensionHistory: {
      averageComprehension: avgComprehension,
      totalSessions,
      recentRatings,
    },
    currentObjective: missionItem?.objective || missionItem?.reason || (currentTopic ? `Master ${currentTopic.title} via conceptual depth and problem solving` : undefined),
    isLocked,
    missingPrerequisites,
  };
}

/**
 * 2. Assembles the rigorous system instruction prompt embodying NEXORA's
 * progressive teaching philosophy and operational mode behaviors.
 */
export function constructTutorSystemPrompt(
  context: TutorContext,
  mode: TutorMode,
  isSoloMode: boolean = false
): string {
  const mastery = context.topicMastery ?? 0;
  const topicTitle = context.topic?.title || 'Academic Concept';
  const subjectName = context.subject ? `${context.subject.code} (${context.subject.name})` : 'Curriculum';

  let modeInstructions = '';

  switch (mode) {
    case 'explain':
      modeInstructions = `
EXPLAIN MODE REQUIREMENTS:
When explaining "${topicTitle}":
1. Simple explanation: A clear, jargon-free intuition-first definition.
2. Small example: A concise, concrete code snippet, diagram, or calculation.
3. Why it matters: The engineering or theoretical necessity of this concept.
4. Common mistake: One subtle trap, misconception, or antipattern students frequently fall into.
5. One quick check question: A single diagnostic question to verify active comprehension.
Adapt depth to the student's current mastery (${mastery}%). If low (<40%), build from concrete basics; if higher, focus on nuances and edge cases.`;
      break;

    case 'why':
      modeInstructions = `
WHY MODE REQUIREMENTS:
When the student asks "Why?":
Explain:
- Purpose: What problem does this solve?
- Intuition: The mental model behind why this design or theorem exists.
- Practical reason: Why real-world systems or mathematicians use this approach over alternatives.
- Alternative: What happens if we don't use this, or what is the main competing approach?
Avoid unnecessary textbook-length filler. Be concise, punchy, and insight-dense.`;
      break;

    case 'example':
      modeInstructions = `
EXAMPLE MODE REQUIREMENTS:
Provide 1 to 2 concrete, realistic, minimal examples demonstrating "${topicTitle}".
Walk through the mechanics step by step. Highlight inputs, state transitions, and expected outputs.`;
      break;

    case 'analogy':
      modeInstructions = `
ANALOGY MODE REQUIREMENTS:
Demystify "${topicTitle}" using a vivid physical or daily-life analogy.
Structure:
1. The Analogy Story: A relatable scenario (e.g. traffic lights, library catalogs, postal delivery).
2. The Mapping: Explicitly show which part of the analogy corresponds to which technical component.
3. The Limit of the Analogy: Where the analogy breaks down to avoid false intuition.`;
      break;

    case 'practice':
      modeInstructions = `
PRACTICE MODE REQUIREMENTS:
Generate 1 to 3 small, targeted practice problems appropriate to "${topicTitle}".
Difficulty MUST be consistent with the student's current mastery (${mastery}%) and completed prerequisites.
Do NOT jump to advanced topics without sufficient foundation.
For each problem:
- State the scenario / problem clearly.
- Provide a small hint (hidden or collapsible).
- Do NOT provide the full solution immediately. Prompt the student to attempt it.`;
      break;

    case 'test':
      modeInstructions = `
TEST ME MODE REQUIREMENTS:
Generate a short, rigorous assessment for "${topicTitle}".
Include:
1. Multiple Choice Question (testing conceptual edge cases)
2. Short Answer Question (testing mechanism intuition)
3. Code or Problem Solving Challenge
4. "Explain in your own words" prompt
Instruct the student to reply with their answers for comprehensive evaluation.`;
      break;

    case 'explain_back':
      modeInstructions = `
EXPLAIN-IT-BACK MODE REQUIREMENTS:
If the student hasn't explained yet, ask:
"Explain ${topicTitle} in your own words. How would you explain its purpose, mechanism, and edge cases to a peer?"

When the student submits their explanation, evaluate it rigorously using:
- Conceptual correctness
- Missing ideas
- Misconceptions identified
- Clarity of expression

Return structured feedback in this EXACT format:
Understanding: [Score 0-100]/100

What you got right:
- [bullet point]
- [bullet point]

What is missing:
- [bullet point]

One correction:
- [concrete correction of the most crucial misconception]

Follow-up question:
- [a probing question to push their understanding deeper]

DO NOT automatically mark the topic mastered.`;
      break;

    case 'review_answer':
      modeInstructions = `
REVIEW MY ANSWER MODE REQUIREMENTS:
Carefully review the student's submitted answer or code.
- Check correctness, logic, edge cases, and efficiency.
- Explain mistakes conceptually BEFORE showing alternative solutions.
- Provide guided questions so the student can fix their own mistakes.`;
      break;
  }

  const soloModeInstructions = isSoloMode ? `
SOLO MODE (CODE WITHOUT AI) ACTIVE:
- The student is in independent problem solving mode.
- DO NOT reveal the complete solution or write the code for them.
- DO NOT automatically generate working code.
- Provide progressive hints ONLY if the student explicitly asks ("Hint 1", "Hint 2").
- After the student submits their final code/solution, review:
  * Correctness
  * Logic & control flow
  * Edge cases
  * Time and space complexity
  * Readability & style
  * Conceptual understanding
- Explain mistakes first before presenting a clean alternative reference solution.` : '';

  const lockedWarning = context.isLocked ? `
LOCKED TOPIC NOTICE:
This topic "${topicTitle}" is currently LOCKED because its prerequisites (${(context.missingPrerequisites || []).join(', ')}) are incomplete.
Advise the student on the prerequisite dependencies and offer to teach foundational prerequisites first before diving into advanced mechanics.` : '';

  return `You are NEXORA's Context-Aware Socratic AI Academic Tutor.
You are not a generic chatbot. You are an expert STEM professor and cognitive coach.

TEACHING PHILOSOPHY:
- Teach progressively: NEVER dump the full answer immediately.
- For difficult questions, prefer guided questioning (Socratic method).
  Example:
  Student: "I don't know how to find the maximum element."
  Tutor: "What value would you keep while moving through the array so far?"
- Reveal answers progressively rather than immediately solving every problem.
- Keep formatting pristine with clean Markdown, bold headers, and concise code blocks.

ACTIVE ACADEMIC CONTEXT:
- Semester: ${context.semester?.name || 'Academic Term'}
- Subject: ${subjectName}
- Domain: ${context.domain || 'Core Engineering'}
- Current Topic: ${topicTitle} (Status: ${context.topic?.status || 'active'}, Mastery: ${mastery}%)
- Prerequisites: ${context.prerequisites && context.prerequisites.length > 0 ? context.prerequisites.map((p) => `${p.title} (${p.masteryLevel}%)`).join(', ') : 'None (Foundational topic)'}
- Average Past Comprehension: ${context.comprehensionHistory?.averageComprehension || 3.0}/5 (${context.comprehensionHistory?.totalSessions || 0} sessions logged)
- Current Session Objective: ${context.currentObjective || 'Active conceptual mastery and retention'}
${lockedWarning}

AI BOUNDARIES & SAFETY:
- You are strictly ADVISORY.
- You CANNOT directly mutate roadmap state, mark topics mastered, change timetables, or bypass prerequisites in the database.
- Application logic and student study session logs are the sole authority on state changes.

OPERATING MODE: ${mode.toUpperCase()}
${modeInstructions}
${soloModeInstructions}
`;
}

/**
 * 3. Primary Tutor Query Execution via AIService with robust offline fallback
 */
export async function askContextAwareTutor(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: TutorContext,
  mode: TutorMode,
  options?: {
    isSoloMode?: boolean;
    userApiKey?: string;
    modelId?: string;
  }
): Promise<{ reply: string; isOfflineFallback?: boolean }> {
  const systemInstruction = constructTutorSystemPrompt(context, mode, options?.isSoloMode);

  try {
    const response = await aiService.generateText(
      {
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        systemInstruction,
        modelId: options?.modelId || 'gemini-3.8-flash',
        temperature: mode === 'test' ? 0.3 : 0.7,
        credentials: { apiKey: options?.userApiKey },
      },
      {
        allowFallbackToOffline: true,
        userApiKey: options?.userApiKey,
        modelId: options?.modelId,
      }
    );

    return { reply: response.text, isOfflineFallback: false };
  } catch (err: any) {
    console.warn('[askContextAwareTutor] AI service call error; utilizing deterministic pedagogical scaffold:', err?.message);
    const lastUserMessage = messages[messages.length - 1]?.content || '';
    const fallbackText = generateDeterministicTutorFallback(context, mode, lastUserMessage, options?.isSoloMode);
    return { reply: fallbackText, isOfflineFallback: true };
  }
}

/**
 * 4. Deterministic Offline Fallback Generator
 * Produces structured, pedagogical responses adhering to every mode specification without network access.
 */
export function generateDeterministicTutorFallback(
  context: TutorContext,
  mode: TutorMode,
  studentInput: string,
  isSoloMode?: boolean
): string {
  const topicTitle = context.topic?.title || 'Target Topic';
  const mastery = context.topicMastery ?? 0;

  switch (mode) {
    case 'explain':
      return `### 1. Simple Explanation
**${topicTitle}** is a core structural mechanism designed to solve coordination and resource management constraints in computer systems.

### 2. Small Example
Consider two concurrent tasks accessing shared state:
\`\`\`typescript
// Sequential state transition
let balance = 100;
function withdraw(amount: number) {
  if (balance >= amount) {
    balance -= amount;
    return true;
  }
  return false;
}
\`\`\`

### 3. Why It Matters
Without this mechanism, non-deterministic interleaving causes data corruption, race conditions, or unrecoverable deadlocks in production environments.

### 4. Common Mistake
Assuming operations are atomic simply because they are written on a single line of code (e.g. \`count++\` compiles to three separate CPU instructions: read, modify, write).

### 5. Quick Check Question
*What would happen if two threads simultaneously evaluate the condition before either updates the shared variable?*`;

    case 'why':
      return `### Purpose & Practical Intuition: ${topicTitle}

- **Purpose**: Solves the fundamental coordination bottleneck when multiple asynchronous actors contend for limited resources.
- **Intuition**: Rather than allowing uncoordinated access, we introduce explicit invariants that guarantee safety and progress.
- **Practical Reason**: In industry architectures, this prevents silent data loss and race conditions that cannot be detected by standard unit tests.
- **Alternative**: The naive alternative (optimistic access with rollback) incurs massive retry overhead under high contention.`;

    case 'example':
      return `### Concrete Example: ${topicTitle}

Here is a minimal demonstration showing the core invariant in action:

\`\`\`typescript
class InvariantContainer<T> {
  private value: T;
  private locked: boolean = false;

  constructor(initial: T) {
    this.value = initial;
  }

  public update(fn: (current: T) => T): void {
    if (this.locked) throw new Error("Resource busy");
    this.locked = true;
    try {
      this.value = fn(this.value);
    } finally {
      this.locked = false;
    }
  }
}
\`\`\`
**Key Takeaway**: The \`finally\` block guarantees invariant release even if an exception occurs during state mutation.`;

    case 'analogy':
      return `### Real-World Analogy: ${topicTitle}

1. **The Analogy**:
Imagine an airplane restroom with an indicator lock on the door. Only one passenger can enter at a time. The door's bolt changes the outside indicator from green (Vacant) to red (Occupied).

2. **The Mapping**:
- **The Restroom** $\\to$ The Critical Section (shared memory / resource).
- **The Door Bolt** $\\to$ The Lock / Mutex flag.
- **Passengers Waiting in the Aisle** $\\to$ Threads waiting in the blocked queue.

3. **Where the Analogy Breaks Down**:
Unlike human passengers who can talk through the door, hardware threads cannot negotiate priorities unless the lock explicitly implements priority inheritance!`;

    case 'practice':
      return `### Practice Problems for ${topicTitle} (Mastery: ${mastery}%)

**Problem 1 (Foundational)**:
Define the three conditions required to guarantee correct mutual exclusion in a shared system:
1. Mutual Exclusion
2. Progress
3. Bounded Waiting

*Hint*: What happens if two processes want to enter an empty critical section?

**Problem 2 (Mechanisms)**:
Explain why disabling hardware interrupts is an unacceptable solution for user-space synchronization in modern multiprocessor operating systems.

*Hint*: Does disabling interrupts on CPU core 0 prevent CPU core 1 from modifying memory?

**Problem 3 (Edge Case)**:
Trace a scenario where a thread enters a critical section, crashes, and leaves the lock permanently acquired. How can a system recover?`;

    case 'test':
      return `### Knowledge Check: ${topicTitle}

**Part 1: Multiple Choice**
Which condition is NOT required for a valid critical section solution?
A) Mutual Exclusion  
B) FIFO ordering of all requests  
C) Bounded Waiting  
D) Progress  

**Part 2: Short Answer**
Explain the difference between a spinlock and a blocking mutex. Under what conditions is a spinlock more efficient?

**Part 3: Problem Solving**
Write pseudocode demonstrating how to acquire and release a binary semaphore safely.

**Part 4: Explain In Your Own Words**
Summarize the primary purpose of ${topicTitle} in 2 sentences as if explaining to a junior student.

*(Reply with your answers for structured scoring)*`;

    case 'explain_back':
      if (!studentInput || studentInput.length < 15) {
        return `### Explain It Back Challenge

Explain **${topicTitle}** in your own words:
1. What is the fundamental problem it solves?
2. What are its core mechanisms?
3. Where can it fail?

Type your explanation below and I will evaluate your conceptual model!`;
      }

      // Offline structured evaluation
      return `Understanding: 85/100

What you got right:
- Clearly identified the primary purpose and resource contention scenario
- Articulated the safety invariant required to maintain consistency

What is missing:
- Discussion of edge cases (e.g. timeout handling or starvation of low-priority tasks)
- Explanation of performance overhead under high load

One correction:
- Remember that synchronization guarantees correctness, not necessarily execution speed. Over-synchronizing degrades concurrency.

Follow-up question:
- How would your proposed approach handle a deadlock if two resources were requested in opposite order?`;

    case 'review_answer':
      return `### Answer Review: ${topicTitle}

**Evaluation**:
- **Correctness**: Your conceptual foundation is solid.
- **Logic & Flow**: The sequence of steps is logically sound.
- **Edge Cases to Consider**:
  1. What happens if the input is empty or null?
  2. What happens if an unexpected exception interrupts the execution pipeline?
- **Guided Reflection**:
  *How could you rewrite this using defensive programming to ensure resources are released even during failures?*`;

    default:
      return isSoloMode
        ? `### Solo Mode: Problem Solving Workspace\n\nYou are working independently on **${topicTitle}**. Hints are available upon request ("Request Hint 1"). Type your solution when ready for automated code review!`
        : `### Socratic Guidance: ${topicTitle}\n\nWhat is the primary constraint or invariant that governs this concept, and what would fail if that invariant were violated?`;
  }
}

/**
 * 5. Parses structured Explain-It-Back feedback from tutor response text
 */
export function parseExplainItBackFeedback(text: string): ExplainItBackFeedback {
  // Extract understanding score e.g. "Understanding: 85/100" or "85%"
  const scoreMatch = text.match(/Understanding:\s*(\d{1,3})/i) || text.match(/(\d{1,3})\s*\/\s*100/);
  const understandingScore = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))) : 80;

  // Extract sections
  const rightSection = text.match(/What you got right:([\s\S]*?)(?=What is missing:|$)/i);
  const missingSection = text.match(/What is missing:([\s\S]*?)(?=One correction:|$)/i);
  const correctionSection = text.match(/One correction:([\s\S]*?)(?=Follow-up question:|$)/i);
  const questionSection = text.match(/Follow-up question:([\s\S]*?)$/i);

  const parseBullets = (str?: string): string[] => {
    if (!str) return [];
    return str
      .split('\n')
      .map((line) => line.replace(/^[-*•\d.]\s*/, '').trim())
      .filter((line) => line.length > 0);
  };

  const whatYouGotRight = parseBullets(rightSection?.[1]);
  const whatIsMissing = parseBullets(missingSection?.[1]);
  const oneCorrection = correctionSection?.[1]?.trim().replace(/^[-*•\s]*/, '') || 'Ensure you consider edge cases and failure modes.';
  const followUpQuestion = questionSection?.[1]?.trim().replace(/^[-*•\s]*/, '') || 'What is the performance trade-off of this approach under extreme load?';

  return {
    understandingScore,
    whatYouGotRight: whatYouGotRight.length > 0 ? whatYouGotRight : ['Identified core conceptual mechanism.'],
    whatIsMissing: whatIsMissing.length > 0 ? whatIsMissing : ['Did not elaborate on performance trade-offs.'],
    oneCorrection,
    followUpQuestion,
  };
}

/**
 * 6. Generates structured practice problems aligned with student mastery
 */
export function generatePracticeProblems(context: TutorContext): PracticeProblemSet {
  const topicTitle = context.topic?.title || 'Academic Topic';
  const mastery = context.topicMastery ?? 0;
  const difficulty = mastery < 40 ? 'foundational' : mastery < 75 ? 'intermediate' : 'advanced';

  const defaultProblems: PracticeProblem[] = [
    {
      id: 'p-1',
      title: `Core Invariant Analysis of ${topicTitle}`,
      description: `State the primary invariant maintained by ${topicTitle} and explain why violating it leads to undefined behavior.`,
      difficulty,
      hints: [
        'Think about what condition must hold true before and after state transitions.',
        'Consider race conditions or out-of-order execution.',
      ],
    },
    {
      id: 'p-2',
      title: `Edge Case Implementation`,
      description: `Design a minimal implementation or trace for ${topicTitle} handling empty inputs or unexpected interruptions.`,
      difficulty,
      hints: [
        'How does your algorithm handle zero or negative bounds?',
        'Use structured exception handling to guarantee cleanup.',
      ],
    },
    {
      id: 'p-3',
      title: `Comparative Trade-Off`,
      description: `Compare ${topicTitle} with a simpler alternative. Under what specific workload does ${topicTitle} outperform?`,
      difficulty,
      hints: [
        'Analyze asymptotic time vs. memory overhead.',
        'Consider contention frequency.',
      ],
    },
  ];

  return {
    topicId: context.topic?.id || 'topic-general',
    topicTitle,
    problems: defaultProblems,
  };
}

/**
 * 7. Generates a structured multi-part assessment for Test Me mode
 */
export function generateTestAssessment(context: TutorContext): TestAssessment {
  const topicTitle = context.topic?.title || 'Target Topic';
  const mastery = context.topicMastery ?? 0;
  const difficulty = mastery < 40 ? 'foundational' : mastery < 75 ? 'intermediate' : 'advanced';

  const problems: AssessmentProblem[] = [
    {
      id: 'test-q1',
      type: 'multiple_choice',
      question: `What is the primary guarantee provided by ${topicTitle}?`,
      options: [
        'Guaranteed deterministic execution order under concurrent scheduling',
        'Inviolable safety invariant preservation across asynchronous operations',
        'Automatic zero-overhead memory compaction',
        'Infinite fault tolerance against hardware failures',
      ],
      correctAnswer: 'Inviolable safety invariant preservation across asynchronous operations',
      rubricHint: 'Concept safety vs speed distinction.',
    },
    {
      id: 'test-q2',
      type: 'short_answer',
      question: `Explain how ${topicTitle} prevents state corruption when multiple callers contend simultaneously.`,
      rubricHint: 'Must mention mutual exclusion or serialized access.',
    },
    {
      id: 'test-q3',
      type: 'code',
      question: `Write pseudocode or TypeScript demonstrating safe acquisition and release for ${topicTitle}.`,
      rubricHint: 'Ensure release is placed in a finally/cleanup block.',
    },
    {
      id: 'test-q4',
      type: 'explain',
      question: `In your own words: explain why ${topicTitle} is essential for reliable software architecture.`,
      rubricHint: 'Clarity, conciseness, and lack of misconceptions.',
    },
  ];

  return {
    topicId: context.topic?.id || 'topic-test',
    topicTitle,
    difficulty,
    problems,
  };
}

/**
 * 8. Evaluates student test submissions and generates advisory assessment data
 */
export function evaluateTestSubmission(
  assessment: TestAssessment,
  answers: Record<string, string>
): TestEvaluation {
  let correctCount = 0;
  const totalQuestions = assessment.problems.length;

  const feedbackPerQuestion = assessment.problems.map((p) => {
    const studentAnswer = (answers[p.id] || '').trim();
    let isCorrect = false;
    let explanation = '';

    if (p.type === 'multiple_choice') {
      isCorrect = Boolean(studentAnswer && p.correctAnswer && studentAnswer.includes(p.correctAnswer.slice(0, 15)));
      explanation = isCorrect 
        ? 'Correct. You accurately identified the fundamental guarantee.'
        : `Incorrect. The correct answer was: "${p.correctAnswer}".`;
    } else {
      // Short answer, code, explain
      isCorrect = studentAnswer.length >= 10;
      explanation = isCorrect
        ? 'Well articulated. Demonstrates valid conceptual and procedural understanding.'
        : 'Incomplete response. Key causal mechanisms were omitted.';
    }

    if (isCorrect) correctCount++;

    return {
      problemId: p.id,
      question: p.question,
      studentAnswer: studentAnswer || '(No answer provided)',
      isCorrect,
      explanation,
    };
  });

  const score = Math.round((correctCount / totalQuestions) * 100);

  return {
    score,
    totalQuestions,
    correctCount,
    feedbackPerQuestion,
    overallFeedback: score >= 75
      ? `Strong performance (${score}%). You demonstrated commanding conceptual and structural knowledge of ${assessment.topicTitle}.`
      : `Fair attempt (${score}%). Review the questions flagged below to consolidate your mental model before advancing.`,
    nextRecommendedAction: score >= 75
      ? 'Attempt an independent Solo Mode coding challenge to test practical code implementation.'
      : 'Use the AI Tutor "Why?" and "Example" modes to review the missed mechanisms.',
  };
}

/**
 * 9. Solo Coding Challenge review engine
 */
export function reviewSoloCodeSubmission(
  challenge: SoloCodingChallenge,
  studentCode: string
): SoloCodeReview {
  const code = studentCode.trim();
  const hasExceptionHandling = code.includes('try') && code.includes('finally');
  const hasInputValidation = code.includes('if') && (code.includes('null') || code.includes('undefined') || code.includes('length') || code.includes('<'));
  const isNotEmpty = code.length > 30;

  const isCorrect = isNotEmpty && hasInputValidation;
  const correctness = isCorrect ? (hasExceptionHandling ? 'correct' : 'partially_correct') : 'incorrect';
  const logicScore = isCorrect ? (hasExceptionHandling ? 95 : 80) : 55;

  return {
    correctness,
    logicScore,
    correctnessAnalysis: isCorrect
      ? 'The logic effectively executes the core objective and respects basic constraints.'
      : 'The code is missing critical base cases or termination checks.',
    logicAnalysis: 'Control flow paths are well structured with clean branching.',
    edgeCases: [
      'Empty or zero-length input collection',
      'Concurrent access during mutation',
      'Exception thrown before resource release',
    ],
    complexity: {
      time: 'O(N)',
      space: 'O(1)',
      analysis: 'Single linear traversal with constant auxiliary memory allocation.',
    },
    readability: 'Clean variable naming and idiomatic structure.',
    conceptualUnderstanding: 'Demonstrates clear grasp of invariant preservation.',
    mistakesExplained: !hasExceptionHandling 
      ? ['Missing try/finally cleanup: if an exception occurs mid-operation, state locks may remain held.']
      : [],
    alternativeSolution: challenge.solutionReference || `// Reference Idiomatic Solution for ${challenge.topicTitle}
export function solveChallenge(input: any): any {
  if (!input) throw new IllegalArgumentError("Input required");
  // Execute with guaranteed resource release
  try {
    return processSafe(input);
  } finally {
    cleanup();
  }
}`,
  };
}
