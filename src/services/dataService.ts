import {
  AppState,
  DailyMission,
  DayOfWeek,
  Goal,
  LearningProgress,
  MissionItem,
  RoadmapProgressSummary,
  RoadmapTopic,
  Semester,
  StudySession,
  Subject,
  TimeBlock,
  TimetableSlot,
  TopicProgressDetail,
  TopicStatus,
  UserProfile,
} from '../types';
import { INITIAL_SEEDED_STATE } from './seedData';
import {
  validateGoal,
  validateRoadmapTopic,
  validateSemester,
  validateStudySession,
  validateSubject,
  validateTimeBlock,
  validateTimetableSlot,
  validateUserProfile,
} from './validation';
import {
  calculateRoadmapProgress as computeRoadmapProgress,
  calculateTopicProgress as computeTopicProgress,
  DEFAULT_LEARNING_DOMAINS,
  detectCycleInTopics,
  evaluatePrerequisites,
  getDependents as getDependentsHelper,
  getLockedTopics as getLockedTopicsHelper,
  getPrerequisites as getPrerequisitesHelper,
  getReadyTopics as getReadyTopicsHelper,
  MASTERY_THRESHOLD_COMPLETED,
  MASTERY_THRESHOLD_PREREQ,
  recalculateRoadmapStatus,
  TopicFilterOptions,
  validateTopicPrerequisites,
} from './learningEngine';

export { MASTERY_THRESHOLD_COMPLETED, MASTERY_THRESHOLD_PREREQ };

export const STORAGE_KEY = 'nexora_os_v1';

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class LocalStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.error('LocalStorage read error:', e);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('LocalStorage write error:', e);
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('LocalStorage remove error:', e);
    }
  }
}

export class InMemoryStorageAdapter implements StorageAdapter {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * DataService provides a clean, robust abstraction layer over the NEXORA local database.
 * UI components interact ONLY with DataService methods, never directly touching localStorage.
 */
export class DataService {
  private adapter: StorageAdapter;
  private stateCache: AppState | null = null;
  private listeners: Array<(state: AppState) => void> = [];

  constructor(adapter: StorageAdapter = new LocalStorageAdapter()) {
    this.adapter = adapter;
  }

  /**
   * Subscribe to state mutation events
   */
  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(state: AppState): void {
    this.stateCache = state;
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('DataService listener notification error:', err);
      }
    }
  }

  /**
   * Loads the complete application state from storage.
   * If storage is empty or invalid, automatically seeds and saves initial state.
   */
  getState(): AppState {
    if (this.stateCache) {
      return this.stateCache;
    }

    try {
      const raw = this.adapter.getItem(STORAGE_KEY);
      if (!raw) {
        this.saveState(INITIAL_SEEDED_STATE);
        return INITIAL_SEEDED_STATE;
      }
      const parsed = JSON.parse(raw);

      // Defensively ensure schema keys exist
      const state: AppState = {
        ...INITIAL_SEEDED_STATE,
        ...parsed,
        profile: { ...INITIAL_SEEDED_STATE.profile, ...(parsed.profile || {}) },
        semesters: Array.isArray(parsed.semesters) ? parsed.semesters : INITIAL_SEEDED_STATE.semesters,
        subjects: Array.isArray(parsed.subjects) ? parsed.subjects : INITIAL_SEEDED_STATE.subjects,
        timetable: Array.isArray(parsed.timetable) ? parsed.timetable : INITIAL_SEEDED_STATE.timetable,
        topics: Array.isArray(parsed.topics) ? parsed.topics : INITIAL_SEEDED_STATE.topics,
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : INITIAL_SEEDED_STATE.sessions,
        goals: Array.isArray(parsed.goals) ? parsed.goals : INITIAL_SEEDED_STATE.goals,
        timeBlocks: parsed.timeBlocks || INITIAL_SEEDED_STATE.timeBlocks || {},
        missions: parsed.missions || INITIAL_SEEDED_STATE.missions || {},
      };

      this.stateCache = state;
      return state;
    } catch (err) {
      console.error('DataService: Failed to parse state from storage, falling back to seed data:', err);
      this.saveState(INITIAL_SEEDED_STATE);
      return INITIAL_SEEDED_STATE;
    }
  }

  /**
   * Commits full state to storage adapter and notifies subscribers.
   */
  saveState(state: AppState): void {
    try {
      this.adapter.setItem(STORAGE_KEY, JSON.stringify(state));
      this.notify(state);
    } catch (err) {
      console.error('DataService: Failed to save state:', err);
      throw new Error('Database write operation failed');
    }
  }

  /**
   * Resets entire database to the initial seed state.
   */
  resetToSeedData(): AppState {
    this.saveState(INITIAL_SEEDED_STATE);
    return INITIAL_SEEDED_STATE;
  }

  // ==========================================
  // 1. User Profile Operations
  // ==========================================

  getProfile(): UserProfile {
    return this.getState().profile;
  }

  updateProfile(updates: Partial<UserProfile>): UserProfile {
    const current = this.getProfile();
    const merged: UserProfile = { ...current, ...updates };

    const validation = validateUserProfile(merged);
    if (!validation.isValid) {
      throw new Error(`Profile validation failed: ${validation.errors.map((e) => e.message).join('; ')}`);
    }

    const state = this.getState();
    const updatedState: AppState = { ...state, profile: merged };
    this.saveState(updatedState);
    return merged;
  }

  // ==========================================
  // 2. Semester Operations
  // ==========================================

  getSemesters(): Semester[] {
    return this.getState().semesters;
  }

  getActiveSemester(): Semester | undefined {
    const state = this.getState();
    return state.semesters.find((s) => s.id === state.activeSemesterId) || state.semesters[0];
  }

  setActiveSemester(semesterId: string): void {
    const state = this.getState();
    const exists = state.semesters.some((s) => s.id === semesterId);
    if (!exists) {
      throw new Error(`Semester with ID ${semesterId} does not exist`);
    }
    const updatedSemesters = state.semesters.map((s) => ({
      ...s,
      isActive: s.id === semesterId,
    }));
    this.saveState({
      ...state,
      activeSemesterId: semesterId,
      semesters: updatedSemesters,
    });
  }

  saveSemester(semester: Semester): Semester {
    const validation = validateSemester(semester);
    if (!validation.isValid) {
      throw new Error(`Semester validation failed: ${validation.errors.map((e) => e.message).join('; ')}`);
    }

    const state = this.getState();
    const existingIndex = state.semesters.findIndex((s) => s.id === semester.id);
    let updatedSemesters: Semester[];

    if (existingIndex >= 0) {
      updatedSemesters = [...state.semesters];
      updatedSemesters[existingIndex] = semester;
    } else {
      updatedSemesters = [...state.semesters, semester];
    }

    this.saveState({ ...state, semesters: updatedSemesters });
    return semester;
  }

  deleteSemester(semesterId: string): void {
    const state = this.getState();
    if (state.semesters.length <= 1) {
      throw new Error('Cannot delete the only semester in the system');
    }

    const updatedSemesters = state.semesters.filter((s) => s.id !== semesterId);
    const updatedSubjects = state.subjects.filter((s) => s.semesterId !== semesterId);
    const updatedTimetable = state.timetable.filter((t) => t.semesterId !== semesterId);

    let activeId = state.activeSemesterId;
    if (activeId === semesterId) {
      activeId = updatedSemesters[0].id;
      updatedSemesters[0].isActive = true;
    }

    this.saveState({
      ...state,
      activeSemesterId: activeId,
      semesters: updatedSemesters,
      subjects: updatedSubjects,
      timetable: updatedTimetable,
    });
  }

  // ==========================================
  // 3. Subject Operations
  // ==========================================

  getSubjects(semesterId?: string): Subject[] {
    const state = this.getState();
    const targetSemesterId = semesterId || state.activeSemesterId;
    return state.subjects.filter((s) => s.semesterId === targetSemesterId);
  }

  getSubjectById(subjectId: string): Subject | undefined {
    return this.getState().subjects.find((s) => s.id === subjectId);
  }

  saveSubject(subject: Subject): Subject {
    const validation = validateSubject(subject);
    if (!validation.isValid) {
      throw new Error(`Subject validation failed: ${validation.errors.map((e) => e.message).join('; ')}`);
    }

    const state = this.getState();
    const existingIndex = state.subjects.findIndex((s) => s.id === subject.id);
    let updatedSubjects: Subject[];

    if (existingIndex >= 0) {
      updatedSubjects = [...state.subjects];
      updatedSubjects[existingIndex] = subject;
    } else {
      updatedSubjects = [...state.subjects, subject];
    }

    this.saveState({ ...state, subjects: updatedSubjects });
    return subject;
  }

  deleteSubject(subjectId: string): void {
    const state = this.getState();
    const updatedSubjects = state.subjects.filter((s) => s.id !== subjectId);
    const updatedTimetable = state.timetable.filter((t) => t.subjectId !== subjectId);
    const updatedTopics = state.topics.filter((t) => t.subjectId !== subjectId);
    const updatedSessions = state.sessions.filter((s) => s.subjectId !== subjectId);
    const updatedGoals = state.goals.filter((g) => g.subjectId !== subjectId);

    this.saveState({
      ...state,
      subjects: updatedSubjects,
      timetable: updatedTimetable,
      topics: updatedTopics,
      sessions: updatedSessions,
      goals: updatedGoals,
    });
  }

  // ==========================================
  // 4. Timetable Operations
  // ==========================================

  getTimetable(semesterId?: string, dayOfWeek?: DayOfWeek): TimetableSlot[] {
    const state = this.getState();
    const targetSemesterId = semesterId || state.activeSemesterId;
    let slots = state.timetable.filter((s) => s.semesterId === targetSemesterId);
    if (dayOfWeek) {
      slots = slots.filter((s) => s.dayOfWeek === dayOfWeek);
    }
    return slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  saveTimetableSlot(slot: TimetableSlot): TimetableSlot {
    const validation = validateTimetableSlot(slot);
    if (!validation.isValid) {
      throw new Error(`TimetableSlot validation failed: ${validation.errors.map((e) => e.message).join('; ')}`);
    }

    const state = this.getState();
    const existingIndex = state.timetable.findIndex((t) => t.id === slot.id);
    let updatedSlots: TimetableSlot[];

    if (existingIndex >= 0) {
      updatedSlots = [...state.timetable];
      updatedSlots[existingIndex] = slot;
    } else {
      updatedSlots = [...state.timetable, slot];
    }

    this.saveState({ ...state, timetable: updatedSlots });
    return slot;
  }

  deleteTimetableSlot(slotId: string): void {
    const state = this.getState();
    const updatedSlots = state.timetable.filter((t) => t.id !== slotId);
    this.saveState({ ...state, timetable: updatedSlots });
  }

  // ==========================================
  // 5. Time Blocks Operations (Daily instances)
  // ==========================================

  getTimeBlocksForDate(date: string): TimeBlock[] {
    const state = this.getState();
    const blocks = state.timeBlocks?.[date] || [];
    return [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  saveTimeBlock(block: TimeBlock): TimeBlock {
    const validation = validateTimeBlock(block);
    if (!validation.isValid) {
      throw new Error(`TimeBlock validation failed: ${validation.errors.map((e) => e.message).join('; ')}`);
    }

    const state = this.getState();
    const currentBlocks = state.timeBlocks?.[block.date] || [];
    const existingIndex = currentBlocks.findIndex((b) => b.id === block.id);
    let updatedBlocks: TimeBlock[];

    if (existingIndex >= 0) {
      updatedBlocks = [...currentBlocks];
      updatedBlocks[existingIndex] = block;
    } else {
      updatedBlocks = [...currentBlocks, block];
    }

    const timeBlocks = {
      ...(state.timeBlocks || {}),
      [block.date]: updatedBlocks,
    };

    this.saveState({ ...state, timeBlocks });
    return block;
  }

  deleteTimeBlock(date: string, blockId: string): void {
    const state = this.getState();
    const currentBlocks = state.timeBlocks?.[date] || [];
    const updatedBlocks = currentBlocks.filter((b) => b.id !== blockId);

    const timeBlocks = {
      ...(state.timeBlocks || {}),
      [date]: updatedBlocks,
    };

    this.saveState({ ...state, timeBlocks });
  }

  // ==========================================
  // 6. Curriculum Topics & Prerequisites (DAG)
  // ==========================================

  getTopics(subjectId?: string): RoadmapTopic[] {
    const state = this.getState();
    if (!subjectId) {
      return [...state.topics].sort((a, b) => a.orderIndex - b.orderIndex);
    }
    return state.topics
      .filter((t) => t.subjectId === subjectId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  getTopicById(topicId: string): RoadmapTopic | undefined {
    return this.getState().topics.find((t) => t.id === topicId);
  }

  /**
   * Save a topic with prerequisite validation & cycle check
   */
  saveTopic(topic: RoadmapTopic): RoadmapTopic {
    const validation = validateRoadmapTopic(topic);
    if (!validation.isValid) {
      throw new Error(`Topic validation failed: ${validation.errors.map((e) => e.message).join('; ')}`);
    }

    const state = this.getState();
    const existingIndex = state.topics.findIndex((t) => t.id === topic.id);
    let updatedTopics: RoadmapTopic[];

    if (existingIndex >= 0) {
      updatedTopics = [...state.topics];
      updatedTopics[existingIndex] = topic;
    } else {
      updatedTopics = [...state.topics, topic];
    }

    // Graph Verification: validate prerequisites and detect dependency cycles
    const prereqValidation = validateTopicPrerequisites(topic, updatedTopics);
    if (!prereqValidation.isValid) {
      throw new Error(`Topic prerequisite error: ${prereqValidation.errors.map((e) => e.message).join('; ')}`);
    }

    // Automatically recalculate DAG status for all topics across the entire graph
    const syncedTopics = recalculateRoadmapStatus(updatedTopics);
    this.saveState({ ...state, topics: syncedTopics });
    return syncedTopics.find((t) => t.id === topic.id) || topic;
  }

  /**
   * Save multiple topics in a single transaction (e.g. after reviewing AI roadmap proposal)
   */
  saveTopics(topicsToSave: RoadmapTopic[]): RoadmapTopic[] {
    const state = this.getState();
    const currentTopicsMap = new Map<string, RoadmapTopic>(state.topics.map((t) => [t.id, t]));

    for (const t of topicsToSave) {
      const validation = validateRoadmapTopic(t);
      if (!validation.isValid) {
        throw new Error(`Topic validation failed for "${t.title}": ${validation.errors.map((e) => e.message).join('; ')}`);
      }
      currentTopicsMap.set(t.id, t);
    }

    const mergedTopics = Array.from(currentTopicsMap.values());
    const cycle = detectCycleInTopics(mergedTopics);
    if (cycle) {
      throw new Error(`Prerequisite cycle detected in topic batch: ${cycle.join(' -> ')}`);
    }

    const syncedTopics = recalculateRoadmapStatus(mergedTopics);
    this.saveState({ ...state, topics: syncedTopics });
    return syncedTopics;
  }

  deleteTopic(topicId: string): void {
    const state = this.getState();
    // Remove topic and strip it from any other topic's prerequisite list
    const filteredTopics = state.topics
      .filter((t) => t.id !== topicId)
      .map((t) => ({
        ...t,
        prerequisiteTopicIds: (t.prerequisiteTopicIds || []).filter((id) => id !== topicId),
      }));

    // Recalculate status for dependent topics now that prerequisite was removed
    const syncedTopics = recalculateRoadmapStatus(filteredTopics);
    this.saveState({ ...state, topics: syncedTopics });
  }

  /**
   * Updates topic mastery level and automatically recalculates dependent topic readiness.
   * If mastery reaches >= 80%, topic is completed and dependent topics automatically unlock!
   */
  updateTopicMastery(topicId: string, mastery: number, status?: TopicStatus): RoadmapTopic {
    const state = this.getState();
    const topic = state.topics.find((t) => t.id === topicId);
    if (!topic) {
      throw new Error(`Topic with id "${topicId}" not found`);
    }

    const clampedMastery = Math.max(0, Math.min(100, Math.round(mastery)));
    const updatedTopic: RoadmapTopic = {
      ...topic,
      masteryLevel: clampedMastery,
      status: status || (clampedMastery >= MASTERY_THRESHOLD_COMPLETED ? 'completed' : clampedMastery > 0 ? 'in_progress' : topic.status),
      lastStudiedAt: new Date().toISOString(),
    };

    const tempTopics = state.topics.map((t) => (t.id === topicId ? updatedTopic : t));
    const syncedTopics = recalculateRoadmapStatus(tempTopics);
    this.saveState({ ...state, topics: syncedTopics });
    return syncedTopics.find((t) => t.id === topicId) || updatedTopic;
  }

  /**
   * Allows manual user override for locked topics (prerequisites incomplete)
   * The user is never hard-locked from learning.
   */
  overrideTopicPrerequisites(topicId: string, isUserOverride: boolean): RoadmapTopic {
    const state = this.getState();
    const topic = state.topics.find((t) => t.id === topicId);
    if (!topic) {
      throw new Error(`Topic with id "${topicId}" not found`);
    }

    const updatedTopic: RoadmapTopic = {
      ...topic,
      isUserOverride,
      overrideWarning: isUserOverride ? 'Prerequisites incomplete (overridden by student)' : undefined,
    };

    const tempTopics = state.topics.map((t) => (t.id === topicId ? updatedTopic : t));
    const syncedTopics = recalculateRoadmapStatus(tempTopics);
    this.saveState({ ...state, topics: syncedTopics });
    return syncedTopics.find((t) => t.id === topicId) || updatedTopic;
  }

  /**
   * Returns all topics ready to study (uncompleted, with prereqs satisfied or overridden)
   */
  getReadyTopics(filter?: TopicFilterOptions): RoadmapTopic[] {
    return getReadyTopicsHelper(this.getState().topics, filter);
  }

  /**
   * Returns all topics currently locked by incomplete prerequisites
   */
  getLockedTopics(filter?: TopicFilterOptions): RoadmapTopic[] {
    return getLockedTopicsHelper(this.getState().topics, filter);
  }

  /**
   * Returns immediate prerequisites for a topic
   */
  getPrerequisites(topicId: string): RoadmapTopic[] {
    return getPrerequisitesHelper(topicId, this.getState().topics);
  }

  /**
   * Returns immediate downstream dependents for a topic
   */
  getDependents(topicId: string): RoadmapTopic[] {
    return getDependentsHelper(topicId, this.getState().topics);
  }

  /**
   * Calculates topic progress and 4-phase pedagogical evidence from stored session data
   */
  calculateTopicProgress(topicId: string): TopicProgressDetail | null {
    const state = this.getState();
    const topic = state.topics.find((t) => t.id === topicId);
    if (!topic) return null;
    return computeTopicProgress(topic, state.sessions);
  }

  /**
   * Aggregates roadmap-level progress (completion %, counts, evidence breakdown)
   */
  calculateRoadmapProgress(filter?: TopicFilterOptions): RoadmapProgressSummary {
    const state = this.getState();
    let topics = state.topics;
    if (filter?.subjectId) {
      topics = topics.filter((t) => t.subjectId === filter.subjectId);
    }
    if (filter?.domain) {
      topics = topics.filter((t) => t.domain === filter.domain);
    }
    if (filter?.category) {
      topics = topics.filter((t) => t.category === filter.category);
    }
    return computeRoadmapProgress(topics, state.sessions);
  }

  // ==========================================
  // 7. Learning Progress Analytics
  // ==========================================

  getLearningProgress(subjectId?: string): LearningProgress[] {
    const state = this.getState();
    const topics = this.getTopics(subjectId);
    const sessions = state.sessions;

    return topics.map((topic) => {
      const topicSessions = sessions.filter((s) => s.topicId === topic.id);
      const totalTimeMinutes = topicSessions.reduce((acc, s) => acc + s.actualDurationMinutes, 0);
      const comprehensionTotal = topicSessions.reduce((acc, s) => acc + s.comprehensionRating, 0);
      const avgComprehension = topicSessions.length > 0 ? Number((comprehensionTotal / topicSessions.length).toFixed(1)) : 0;

      return {
        topicId: topic.id,
        subjectId: topic.subjectId,
        masteryLevel: topic.masteryLevel,
        status: topic.status,
        totalTimeMinutes,
        sessionsCount: topicSessions.length,
        averageComprehension: avgComprehension,
        lastStudiedAt: topic.lastStudiedAt,
      };
    });
  }

  // ==========================================
  // 8. Study Sessions
  // ==========================================

  getStudySessions(subjectId?: string): StudySession[] {
    const state = this.getState();
    let sessions = [...state.sessions];
    if (subjectId) {
      sessions = sessions.filter((s) => s.subjectId === subjectId);
    }
    return sessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  recordStudySession(session: StudySession): StudySession {
    const validation = validateStudySession(session);
    if (!validation.isValid) {
      throw new Error(`StudySession validation failed: ${validation.errors.map((e) => e.message).join('; ')}`);
    }

    const state = this.getState();
    const updatedSessions = [session, ...state.sessions];

    // If session is tied to a topic, automatically update topic mastery and lastStudiedAt
    let updatedTopics = state.topics;
    if (session.topicId) {
      const topic = state.topics.find((t) => t.id === session.topicId);
      if (topic) {
        // Delta mastery boost = comprehensionRating * 5 (from Learning Engine specs)
        const boost = session.comprehensionRating * 5;
        const newMastery = Math.min(100, Math.max(0, topic.masteryLevel + boost));
        const updatedTopic: RoadmapTopic = {
          ...topic,
          masteryLevel: newMastery,
          status: newMastery >= MASTERY_THRESHOLD_COMPLETED ? 'completed' : 'in_progress',
          lastStudiedAt: session.startTime,
        };

        const existingIndex = state.topics.findIndex((t) => t.id === topic.id);
        const tempTopics = [...state.topics];
        tempTopics[existingIndex] = updatedTopic;
        updatedTopics = recalculateRoadmapStatus(tempTopics);
      }
    }

    // Update mission items if tied to today's mission
    let updatedMissions = state.missions;
    const sessionDate = session.date;
    if (sessionDate && updatedMissions[sessionDate]) {
      const m = updatedMissions[sessionDate];
      const updatedItems = m.items.map((item) => {
        if (item.id === session.missionItemId || (session.topicId && item.topicId === session.topicId)) {
          return {
            ...item,
            actualMinutes: (item.actualMinutes || 0) + session.actualDurationMinutes,
            status: 'completed' as const,
          };
        }
        return item;
      });
      updatedMissions = {
        ...updatedMissions,
        [sessionDate]: { ...m, items: updatedItems },
      };
    }

    this.saveState({
      ...state,
      sessions: updatedSessions,
      topics: updatedTopics,
      missions: updatedMissions,
    });

    return session;
  }

  deleteStudySession(sessionId: string): void {
    const state = this.getState();
    const updatedSessions = state.sessions.filter((s) => s.id !== sessionId);
    this.saveState({ ...state, sessions: updatedSessions });
  }

  // ==========================================
  // 9. Goals
  // ==========================================

  getGoals(horizon?: string): Goal[] {
    const state = this.getState();
    if (!horizon) {
      return [...state.goals];
    }
    return state.goals.filter((g) => g.horizon === horizon);
  }

  getGoalById(goalId: string): Goal | undefined {
    return this.getState().goals.find((g) => g.id === goalId);
  }

  saveGoal(goal: Goal): Goal {
    const validation = validateGoal(goal);
    if (!validation.isValid) {
      throw new Error(`Goal validation failed: ${validation.errors.map((e) => e.message).join('; ')}`);
    }

    const state = this.getState();
    const existingIndex = state.goals.findIndex((g) => g.id === goal.id);
    let updatedGoals: Goal[];

    if (existingIndex >= 0) {
      updatedGoals = [...state.goals];
      updatedGoals[existingIndex] = goal;
    } else {
      updatedGoals = [...state.goals, goal];
    }

    this.saveState({ ...state, goals: updatedGoals });
    return goal;
  }

  deleteGoal(goalId: string): void {
    const state = this.getState();
    const updatedGoals = state.goals.filter((g) => g.id !== goalId);
    this.saveState({ ...state, goals: updatedGoals });
  }

  updateGoalProgress(goalId: string, deltaOrCurrent: number, isAbsolute = false): Goal {
    const state = this.getState();
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) {
      throw new Error(`Goal with ID ${goalId} not found`);
    }

    const newValue = isAbsolute ? deltaOrCurrent : goal.currentValue + deltaOrCurrent;
    const isCompleted = newValue >= goal.targetValue;
    const updatedGoal: Goal = {
      ...goal,
      currentValue: Math.max(0, newValue),
      status: isCompleted ? 'completed' : goal.status,
    };

    return this.saveGoal(updatedGoal);
  }

  // ==========================================
  // 10. Daily Missions & Mission Items
  // ==========================================

  getDailyMission(date: string): DailyMission | undefined {
    return this.getState().missions[date];
  }

  saveDailyMission(mission: DailyMission): DailyMission {
    const state = this.getState();
    const missions = {
      ...state.missions,
      [mission.date]: mission,
    };
    this.saveState({ ...state, missions });
    return mission;
  }

  saveMissionItem(date: string, item: MissionItem): MissionItem {
    const state = this.getState();
    const mission = state.missions[date] || {
      id: `m-${date}`,
      date,
      availableMinutes: 270,
      allocatedMinutes: 0,
      items: [],
    };

    const existingIndex = mission.items.findIndex((i) => i.id === item.id);
    let updatedItems: MissionItem[];
    if (existingIndex >= 0) {
      updatedItems = [...mission.items];
      updatedItems[existingIndex] = item;
    } else {
      updatedItems = [...mission.items, item];
    }

    const allocatedMinutes = updatedItems.reduce((acc, curr) => acc + (curr.plannedMinutes || 0), 0);
    const updatedMission: DailyMission = {
      ...mission,
      allocatedMinutes,
      items: updatedItems,
    };

    this.saveDailyMission(updatedMission);
    return item;
  }
}

// Global Singleton Instance for application-wide access
export const dataService = new DataService();
