import {
  LearningCategory,
  LearningDomainInfo,
  RoadmapProgressSummary,
  RoadmapTopic,
  StudySession,
  TopicLearningEvidence,
  TopicProgressDetail,
  TopicStatus,
} from '../types';

/**
 * Canonical Mastery Thresholds
 * A topic is considered fully completed and eligible to unlock downstream
 * prerequisites when mastery level is >= 80%.
 */
export const MASTERY_THRESHOLD_COMPLETED = 80;
export const MASTERY_THRESHOLD_PREREQ = 80;

/**
 * Standard Learning Domains (Covering Academic, Career, and Project Learning)
 */
export const DEFAULT_LEARNING_DOMAINS: LearningDomainInfo[] = [
  // Academic
  {
    id: 'sub-os',
    name: 'Operating Systems',
    category: 'academic',
    description: 'Processes, concurrency, virtual memory, paging, and file system architecture.',
    color: '#6366f1',
    iconName: 'Cpu',
  },
  {
    id: 'sub-algo',
    name: 'Algorithms & Complexity',
    category: 'academic',
    description: 'Asymptotic analysis, divide & conquer, greedy, dynamic programming, graph traversal.',
    color: '#3b82f6',
    iconName: 'Network',
  },
  {
    id: 'sub-db',
    name: 'Database Systems',
    category: 'academic',
    description: 'Relational algebra, SQL, index structures (B+ trees), query optimization, ACID transactions.',
    color: '#10b981',
    iconName: 'Database',
  },
  {
    id: 'sub-stats',
    name: 'Probability & Statistics',
    category: 'academic',
    description: 'Random variables, discrete/continuous distributions, expectation, hypothesis testing.',
    color: '#8b5cf6',
    iconName: 'BarChart2',
  },
  // Career Learning
  {
    id: 'dom-dsa',
    name: 'DSA & Coding Interviews',
    category: 'career',
    description: 'LeetCode patterns, two pointers, sliding window, tree traversals, graphs, and DP.',
    color: '#ec4899',
    iconName: 'Code2',
  },
  {
    id: 'dom-java',
    name: 'Java & Backend Engineering',
    category: 'career',
    description: 'Core Java, JVM internals, memory model, multithreading, Spring Boot, microservices.',
    color: '#f97316',
    iconName: 'Layers',
  },
  {
    id: 'dom-python',
    name: 'Python for Systems & Data',
    category: 'career',
    description: 'Pythonic idioms, generators, asyncio, data processing with NumPy/Pandas, CLI tooling.',
    color: '#14b8a6',
    iconName: 'Terminal',
  },
  {
    id: 'dom-git',
    name: 'Git & GitHub Collaboration',
    category: 'career',
    description: 'Branching strategies, interactive rebase, pull requests, resolving merge conflicts, CI/CD.',
    color: '#f43f5e',
    iconName: 'GitBranch',
  },
  {
    id: 'dom-ai',
    name: 'AI & Machine Learning Foundations',
    category: 'career',
    description: 'Mathematics of ML, neural networks, PyTorch, embeddings, LLM orchestration, and RAG.',
    color: '#a855f7',
    iconName: 'Sparkles',
  },
  {
    id: 'dom-career',
    name: 'Career & System Design',
    category: 'career',
    description: 'Scalable distributed system design, latency/throughput tradeoffs, behavioral leadership.',
    color: '#eab308',
    iconName: 'Briefcase',
  },
  // Project-related
  {
    id: 'dom-webdev',
    name: 'Full-Stack Web Development',
    category: 'project',
    description: 'Modern TypeScript, React 19 architecture, Tailwind CSS, REST/GraphQL APIs, deployment.',
    color: '#06b6d4',
    iconName: 'Globe',
  },
];

// ============================================================================
// 1. Prerequisite DAG Evaluation & Traversal
// ============================================================================

export interface PrerequisiteEvaluationResult {
  prerequisitesMet: boolean;
  missingPrereqs: RoadmapTopic[];
  missingPrereqIds: string[];
  isOverridden: boolean;
  uncompletedPrereqCount: number;
}

/**
 * Evaluates whether all prerequisites for a topic are satisfied.
 * Prerequisite is satisfied if:
 * 1. Prereq topic exists
 * 2. Prereq topic status is 'completed' OR masteryLevel >= 80%
 */
export function evaluatePrerequisites(
  topic: RoadmapTopic,
  allTopics: RoadmapTopic[]
): PrerequisiteEvaluationResult {
  const prereqIds = topic.prerequisiteTopicIds || [];
  if (prereqIds.length === 0) {
    return {
      prerequisitesMet: true,
      missingPrereqs: [],
      missingPrereqIds: [],
      isOverridden: Boolean(topic.isUserOverride),
      uncompletedPrereqCount: 0,
    };
  }

  const topicMap = new Map<string, RoadmapTopic>(allTopics.map((t) => [t.id, t]));
  const missingPrereqs: RoadmapTopic[] = [];
  const missingPrereqIds: string[] = [];

  for (const prereqId of prereqIds) {
    const prereq = topicMap.get(prereqId);
    if (!prereq) {
      // Non-existent or invalid prerequisite reference
      missingPrereqIds.push(prereqId);
    } else if (prereq.status !== 'completed' && (prereq.masteryLevel || 0) < MASTERY_THRESHOLD_PREREQ) {
      missingPrereqs.push(prereq);
      missingPrereqIds.push(prereq.id);
    }
  }

  const prerequisitesMet = missingPrereqs.length === 0 && missingPrereqIds.length === 0;

  return {
    prerequisitesMet,
    missingPrereqs,
    missingPrereqIds,
    isOverridden: Boolean(topic.isUserOverride),
    uncompletedPrereqCount: missingPrereqs.length + (missingPrereqIds.length - missingPrereqs.length),
  };
}

/**
 * Returns immediate prerequisite topics for a given topic ID
 */
export function getPrerequisites(topicId: string, topics: RoadmapTopic[]): RoadmapTopic[] {
  const target = topics.find((t) => t.id === topicId);
  if (!target || !target.prerequisiteTopicIds || target.prerequisiteTopicIds.length === 0) {
    return [];
  }
  const map = new Map<string, RoadmapTopic>(topics.map((t) => [t.id, t]));
  return target.prerequisiteTopicIds
    .map((id) => map.get(id))
    .filter((t): t is RoadmapTopic => Boolean(t));
}

/**
 * Returns all transitive ancestor prerequisites up the DAG
 */
export function getAllAncestors(topicId: string, topics: RoadmapTopic[]): RoadmapTopic[] {
  const map = new Map<string, RoadmapTopic>(topics.map((t) => [t.id, t]));
  const ancestors = new Set<string>();
  const queue: string[] = [topicId];

  while (queue.length > 0) {
    const currId = queue.shift()!;
    const curr = map.get(currId);
    if (!curr || !curr.prerequisiteTopicIds) continue;

    for (const pid of curr.prerequisiteTopicIds) {
      if (!ancestors.has(pid)) {
        ancestors.add(pid);
        queue.push(pid);
      }
    }
  }

  return Array.from(ancestors)
    .map((id) => map.get(id))
    .filter((t): t is RoadmapTopic => Boolean(t));
}

/**
 * Returns immediate dependent topics that require this topic as a prerequisite
 */
export function getDependents(topicId: string, topics: RoadmapTopic[]): RoadmapTopic[] {
  return topics.filter((t) => (t.prerequisiteTopicIds || []).includes(topicId));
}

/**
 * Returns all transitive descendant topics down the DAG
 */
export function getAllDescendants(topicId: string, topics: RoadmapTopic[]): RoadmapTopic[] {
  const descendants = new Set<string>();
  const queue: string[] = [topicId];

  while (queue.length > 0) {
    const currId = queue.shift()!;
    const directChildren = topics.filter((t) => (t.prerequisiteTopicIds || []).includes(currId));

    for (const child of directChildren) {
      if (!descendants.has(child.id)) {
        descendants.add(child.id);
        queue.push(child.id);
      }
    }
  }

  const map = new Map<string, RoadmapTopic>(topics.map((t) => [t.id, t]));
  return Array.from(descendants)
    .map((id) => map.get(id))
    .filter((t): t is RoadmapTopic => Boolean(t));
}

// ============================================================================
// 2. Query Ready & Locked Topics (For Planner & UI)
// ============================================================================

export interface TopicFilterOptions {
  domain?: string;
  category?: LearningCategory;
  subjectId?: string;
}

function matchesFilter(topic: RoadmapTopic, filter?: TopicFilterOptions): boolean {
  if (!filter) return true;
  if (filter.subjectId && topic.subjectId !== filter.subjectId) return false;
  if (filter.domain && topic.domain && topic.domain !== filter.domain) return false;
  if (filter.category && topic.category && topic.category !== filter.category) return false;
  return true;
}

/**
 * Returns all topics that are ready to be studied (uncompleted, with all prereqs satisfied or overridden).
 * Deterministic selection for Daily Mission Planner and "Next Up" queue.
 */
export function getReadyTopics(
  topics: RoadmapTopic[],
  filter?: TopicFilterOptions
): RoadmapTopic[] {
  return topics.filter((topic) => {
    if (topic.status === 'completed' || topic.masteryLevel >= MASTERY_THRESHOLD_COMPLETED) {
      return false;
    }
    if (!matchesFilter(topic, filter)) {
      return false;
    }

    const prereqs = evaluatePrerequisites(topic, topics);
    return prereqs.prerequisitesMet || topic.isUserOverride;
  });
}

/**
 * Returns all topics currently locked by unmet prerequisites and not overridden
 */
export function getLockedTopics(
  topics: RoadmapTopic[],
  filter?: TopicFilterOptions
): RoadmapTopic[] {
  return topics.filter((topic) => {
    if (topic.status === 'completed' || topic.masteryLevel >= MASTERY_THRESHOLD_COMPLETED) {
      return false;
    }
    if (topic.isUserOverride) {
      return false;
    }
    if (!matchesFilter(topic, filter)) {
      return false;
    }

    const prereqs = evaluatePrerequisites(topic, topics);
    return !prereqs.prerequisitesMet;
  });
}

// ============================================================================
// 3. Cycle Detection & Graph Integrity
// ============================================================================

/**
 * Detects cycles in a collection of topics.
 * Returns null if acyclic, or an array of topic IDs forming the cycle.
 */
export function detectCycleInTopics(topics: RoadmapTopic[]): string[] | null {
  const graph = new Map<string, string[]>();
  for (const t of topics) {
    graph.set(t.id, t.prerequisiteTopicIds || []);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string): string[] | null {
    visited.add(nodeId);
    inStack.add(nodeId);
    path.push(nodeId);

    const neighbors = graph.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const cycle = dfs(neighbor);
        if (cycle) return cycle;
      } else if (inStack.has(neighbor)) {
        const cycleStartIndex = path.indexOf(neighbor);
        return path.slice(cycleStartIndex).concat(neighbor);
      }
    }

    inStack.delete(nodeId);
    path.pop();
    return null;
  }

  for (const topic of topics) {
    if (!visited.has(topic.id)) {
      const cycle = dfs(topic.id);
      if (cycle) return cycle;
    }
  }

  return null;
}

/**
 * Validates a topic's prerequisites before insertion or update:
 * - Checks for non-existent prerequisite IDs
 * - Checks for self-prerequisite
 * - Verifies no cycle is introduced
 */
export function validateTopicPrerequisites(
  topic: RoadmapTopic,
  allTopics: RoadmapTopic[]
): { isValid: boolean; errors: { field: string; message: string }[] } {
  const errors: { field: string; message: string }[] = [];
  const existingMap = new Map(allTopics.map((t) => [t.id, t]));

  // Check self-prerequisite
  if (topic.id && topic.prerequisiteTopicIds?.includes(topic.id)) {
    errors.push({
      field: 'prerequisiteTopicIds',
      message: `Topic "${topic.title}" cannot list itself as a prerequisite.`,
    });
  }

  // Check for non-existent prerequisite references
  for (const prereqId of topic.prerequisiteTopicIds || []) {
    if (!existingMap.has(prereqId) && prereqId !== topic.id) {
      errors.push({
        field: 'prerequisiteTopicIds',
        message: `Prerequisite topic ID "${prereqId}" does not exist in the curriculum.`,
      });
    }
  }

  // Check cycle introduction
  const simulatedTopics = allTopics.filter((t) => t.id !== topic.id).concat(topic);
  const cycle = detectCycleInTopics(simulatedTopics);
  if (cycle) {
    const cycleNames = cycle.map((id) => simulatedTopics.find((t) => t.id === id)?.title || id);
    errors.push({
      field: 'prerequisiteTopicIds',
      message: `Adding topic introduces a circular dependency: ${cycleNames.join(' -> ')}`,
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Topologically sorts topics so every topic appears after all its prerequisites.
 * If graph has disconnected components, preserves orderIndex.
 */
export function topologicalSortTopics(topics: RoadmapTopic[]): RoadmapTopic[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  const topicMap = new Map<string, RoadmapTopic>();

  for (const t of topics) {
    inDegree.set(t.id, 0);
    adj.set(t.id, []);
    topicMap.set(t.id, t);
  }

  for (const t of topics) {
    for (const p of t.prerequisiteTopicIds || []) {
      if (adj.has(p)) {
        adj.get(p)!.push(t.id);
        inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  // Sort queue initially by orderIndex
  queue.sort((a, b) => (topicMap.get(a)?.orderIndex || 0) - (topicMap.get(b)?.orderIndex || 0));

  const sorted: RoadmapTopic[] = [];
  while (queue.length > 0) {
    const currId = queue.shift()!;
    const topic = topicMap.get(currId);
    if (topic) sorted.push(topic);

    const neighbors = adj.get(currId) || [];
    for (const nextId of neighbors) {
      const newDeg = (inDegree.get(nextId) || 1) - 1;
      inDegree.set(nextId, newDeg);
      if (newDeg === 0) {
        queue.push(nextId);
      }
    }
  }

  // If any nodes were missed (e.g. In case of cycles), append them to maintain data
  if (sorted.length < topics.length) {
    const included = new Set(sorted.map((t) => t.id));
    for (const t of topics) {
      if (!included.has(t.id)) sorted.push(t);
    }
  }

  return sorted;
}

// ============================================================================
// 4. Real Learning Progress & Pedagogical Distinctions
// ============================================================================

/**
 * Calculates deterministic topic progress and 4-phase pedagogical evidence:
 * 1. Studied: Logged >= 1 study session or real focus period
 * 2. Practiced: Logged >= 2 sessions or >= 30m actual duration
 * 3. Assessed: Comprehension rating >= 3 logged in session reflections
 * 4. Mastered: Mastery level >= 80%
 *
 * CRITICAL: A topic is NEVER marked completed merely because the user opened or started it.
 * Completion strictly requires mastery >= 80%.
 */
export function calculateTopicProgress(
  topic: RoadmapTopic,
  sessions: StudySession[] = []
): TopicProgressDetail {
  const topicSessions = sessions.filter((s) => s.topicId === topic.id);
  const totalTimeMinutes = topicSessions.reduce((acc, s) => acc + (s.actualDurationMinutes || 0), 0);
  const totalComprehension = topicSessions.reduce((acc, s) => acc + (s.comprehensionRating || 0), 0);
  const avgComprehension = topicSessions.length > 0
    ? Number((totalComprehension / topicSessions.length).toFixed(1))
    : 0;

  const hasStudied = topicSessions.length > 0 || totalTimeMinutes > 0 || Boolean(topic.lastStudiedAt);
  const hasPracticed = topicSessions.length >= 2 || totalTimeMinutes >= 30;
  const hasAssessed = topicSessions.some((s) => s.comprehensionRating >= 3);
  const isMastered = (topic.masteryLevel || 0) >= MASTERY_THRESHOLD_COMPLETED;

  const evidence: TopicLearningEvidence = {
    studied: hasStudied,
    practiced: hasPracticed,
    assessed: hasAssessed,
    mastered: isMastered,
  };

  const prereqs = evaluatePrerequisites(topic, [topic]); // local check or pass allTopics if available

  return {
    topicId: topic.id,
    status: topic.status,
    masteryLevel: topic.masteryLevel || 0,
    totalTimeMinutes,
    sessionsCount: topicSessions.length,
    averageComprehension: avgComprehension,
    evidence,
    isCompleted: isMastered,
    isPrerequisitesMet: prereqs.prerequisitesMet,
    missingPrereqTitles: prereqs.missingPrereqs.map((p) => p.title),
  };
}

/**
 * Automatically recalculates dependent topic readiness across all topics in the graph.
 * Called whenever:
 * - A topic is completed
 * - Mastery changes
 * - A prerequisite changes
 * - A topic is added or removed
 */
export function recalculateRoadmapStatus(topics: RoadmapTopic[]): RoadmapTopic[] {
  const topicMap = new Map<string, RoadmapTopic>(topics.map((t) => [t.id, t]));

  return topics.map((topic) => {
    // 1. Mastery >= 80% is ALWAYS completed
    if ((topic.masteryLevel || 0) >= MASTERY_THRESHOLD_COMPLETED) {
      if (topic.status !== 'completed') {
        return { ...topic, status: 'completed' as TopicStatus };
      }
      return topic;
    }

    // 2. Evaluate prerequisites
    const prereqIds = topic.prerequisiteTopicIds || [];
    const allPrereqsMet = prereqIds.every((pid) => {
      const p = topicMap.get(pid);
      return p && (p.status === 'completed' || (p.masteryLevel || 0) >= MASTERY_THRESHOLD_PREREQ);
    });

    // 3. Status determination
    if (allPrereqsMet || topic.isUserOverride) {
      if ((topic.masteryLevel || 0) > 0 || topic.status === 'in_progress') {
        return { ...topic, status: 'in_progress' as TopicStatus };
      }
      return { ...topic, status: 'ready' as TopicStatus };
    }

    // If prerequisites incomplete and not user overridden -> locked
    return { ...topic, status: 'locked' as TopicStatus };
  });
}

/**
 * Computes aggregate roadmap metrics for a collection of topics
 */
export function calculateRoadmapProgress(
  topics: RoadmapTopic[],
  sessions: StudySession[] = []
): RoadmapProgressSummary {
  const totalTopics = topics.length;
  if (totalTopics === 0) {
    return {
      totalTopics: 0,
      completedTopics: 0,
      inProgressTopics: 0,
      readyTopics: 0,
      lockedTopics: 0,
      completionPercentage: 0,
      averageMastery: 0,
      totalTimeInvestedMinutes: 0,
      evidenceBreakdown: {
        studiedCount: 0,
        practicedCount: 0,
        assessedCount: 0,
        masteredCount: 0,
      },
    };
  }

  let completedCount = 0;
  let inProgressCount = 0;
  let readyCount = 0;
  let lockedCount = 0;
  let totalMastery = 0;
  let studiedCount = 0;
  let practicedCount = 0;
  let assessedCount = 0;
  let masteredCount = 0;

  const sessionTopicMap = new Map<string, StudySession[]>();
  for (const s of sessions) {
    if (s.topicId) {
      if (!sessionTopicMap.has(s.topicId)) {
        sessionTopicMap.set(s.topicId, []);
      }
      sessionTopicMap.get(s.topicId)!.push(s);
    }
  }

  for (const topic of topics) {
    const mastery = topic.masteryLevel || 0;
    totalMastery += mastery;

    if (topic.status === 'completed' || mastery >= MASTERY_THRESHOLD_COMPLETED) {
      completedCount++;
    } else if (topic.status === 'in_progress') {
      inProgressCount++;
    } else if (topic.status === 'ready') {
      readyCount++;
    } else {
      lockedCount++;
    }

    const tSessions = sessionTopicMap.get(topic.id) || [];
    const tDuration = tSessions.reduce((acc, s) => acc + (s.actualDurationMinutes || 0), 0);

    if (tSessions.length > 0 || tDuration > 0 || Boolean(topic.lastStudiedAt)) {
      studiedCount++;
    }
    if (tSessions.length >= 2 || tDuration >= 30) {
      practicedCount++;
    }
    if (tSessions.some((s) => s.comprehensionRating >= 3)) {
      assessedCount++;
    }
    if (mastery >= MASTERY_THRESHOLD_COMPLETED) {
      masteredCount++;
    }
  }

  const totalTimeInvestedMinutes = sessions.reduce(
    (acc, s) => acc + (s.actualDurationMinutes || 0),
    0
  );

  const completionPercentage = Math.round((completedCount / totalTopics) * 100);
  const averageMastery = Math.round(totalMastery / totalTopics);

  return {
    totalTopics,
    completedTopics: completedCount,
    inProgressTopics: inProgressCount,
    readyTopics: readyCount,
    lockedTopics: lockedCount,
    completionPercentage,
    averageMastery,
    totalTimeInvestedMinutes,
    evidenceBreakdown: {
      studiedCount,
      practicedCount,
      assessedCount,
      masteredCount,
    },
  };
}

// ============================================================================
// 5. Multi-Domain & Stage Grouping Helpers
// ============================================================================

/**
 * Resolves all distinct learning domains from topics plus default domain catalog
 */
export function getAvailableLearningDomains(
  topics: RoadmapTopic[],
  customDomains: LearningDomainInfo[] = DEFAULT_LEARNING_DOMAINS
): LearningDomainInfo[] {
  const domainMap = new Map<string, LearningDomainInfo>();
  for (const d of customDomains) {
    domainMap.set(d.id, d);
  }

  // Scan topics for custom domains
  for (const t of topics) {
    if (t.domain && !domainMap.has(t.domain)) {
      domainMap.set(t.domain, {
        id: t.subjectId || t.domain.toLowerCase().replace(/\s+/g, '-'),
        name: t.domain,
        category: t.category || 'career',
        description: `Learning path for ${t.domain}.`,
        color: '#6366f1',
      });
    }
  }

  return Array.from(domainMap.values());
}

/**
 * Groups topics by their assigned learning stage
 */
export function groupTopicsByStage(topics: RoadmapTopic[]): Record<string, RoadmapTopic[]> {
  const groups: Record<string, RoadmapTopic[]> = {};
  for (const topic of topics) {
    const stage = topic.stage || 'Foundations';
    if (!groups[stage]) {
      groups[stage] = [];
    }
    groups[stage].push(topic);
  }

  // Sort each stage by orderIndex
  for (const stage of Object.keys(groups)) {
    groups[stage].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  return groups;
}
