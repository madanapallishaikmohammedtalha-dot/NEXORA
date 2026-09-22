import {
  AvailableStudyPeriod,
  DayOfWeek,
  Goal,
  GoalHorizon,
  GoalStatus,
  Holiday,
  LearningProgress,
  MissionItem,
  RoadmapTopic,
  Semester,
  SlotType,
  StudySession,
  Subject,
  TimeBlock,
  TimetableSlot,
  TopicStatus,
  UserProfile,
} from '../types';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export function createValidationResult(errors: ValidationError[] = []): ValidationResult {
  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Regex helpers
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Validate a standard YYYY-MM-DD date string
 */
export function isValidDateString(dateStr: string): boolean {
  if (!dateStr || !DATE_REGEX.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/**
 * Validate a 24-hour HH:mm time string
 */
export function isValidTimeString(timeStr: string): boolean {
  return typeof timeStr === 'string' && TIME_REGEX.test(timeStr);
}

/**
 * Validate that timeB is after timeA
 */
export function isTimeAfter(timeA: string, timeB: string): boolean {
  if (!isValidTimeString(timeA) || !isValidTimeString(timeB)) return false;
  return timeB > timeA;
}

/**
 * 1. UserProfile Validation
 */
export function validateUserProfile(profile: Partial<UserProfile>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!profile.name || profile.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Student name is required' });
  }

  if (profile.dailyCapacityMaxHours !== undefined) {
    if (typeof profile.dailyCapacityMaxHours !== 'number' || profile.dailyCapacityMaxHours <= 0 || profile.dailyCapacityMaxHours > 16) {
      errors.push({ field: 'dailyCapacityMaxHours', message: 'Daily capacity max hours must be between 0.5 and 16 hours' });
    }
  }

  if (profile.defaultBufferMinutes !== undefined) {
    if (typeof profile.defaultBufferMinutes !== 'number' || profile.defaultBufferMinutes < 0 || profile.defaultBufferMinutes > 120) {
      errors.push({ field: 'defaultBufferMinutes', message: 'Default buffer minutes must be between 0 and 120 minutes' });
    }
  }

  if (profile.sleepHours !== undefined) {
    if (typeof profile.sleepHours !== 'number' || profile.sleepHours < 4 || profile.sleepHours > 14) {
      errors.push({ field: 'sleepHours', message: 'Protected sleep hours must be between 4 and 14 hours' });
    }
  }

  if (profile.aiProvider && !['gemini', 'custom', 'offline'].includes(profile.aiProvider)) {
    errors.push({ field: 'aiProvider', message: 'AI Provider must be one of: gemini, custom, offline' });
  }

  return createValidationResult(errors);
}

/**
 * 2. Semester Validation
 */
export function validateSemester(semester: Partial<Semester>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!semester.id || semester.id.trim().length === 0) {
    errors.push({ field: 'id', message: 'Semester ID is required' });
  }

  if (!semester.name || semester.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Semester name is required' });
  }

  if (!semester.startDate || !isValidDateString(semester.startDate)) {
    errors.push({ field: 'startDate', message: 'Valid startDate (YYYY-MM-DD) is required' });
  }

  if (!semester.endDate || !isValidDateString(semester.endDate)) {
    errors.push({ field: 'endDate', message: 'Valid endDate (YYYY-MM-DD) is required' });
  }

  if (semester.startDate && semester.endDate && isValidDateString(semester.startDate) && isValidDateString(semester.endDate)) {
    if (semester.startDate >= semester.endDate) {
      errors.push({ field: 'endDate', message: 'End date must be strictly after start date' });
    }
  }

  if (semester.targetWeeklyStudyHours !== undefined) {
    if (typeof semester.targetWeeklyStudyHours !== 'number' || semester.targetWeeklyStudyHours < 0 || semester.targetWeeklyStudyHours > 80) {
      errors.push({ field: 'targetWeeklyStudyHours', message: 'Target weekly study hours must be between 0 and 80' });
    }
  }

  return createValidationResult(errors);
}

/**
 * 3. Subject Validation
 */
export function validateSubject(subject: Partial<Subject>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!subject.id || subject.id.trim().length === 0) {
    errors.push({ field: 'id', message: 'Subject ID is required' });
  }

  if (!subject.semesterId || subject.semesterId.trim().length === 0) {
    errors.push({ field: 'semesterId', message: 'Subject must be attached to a semester' });
  }

  if (!subject.code || subject.code.trim().length === 0) {
    errors.push({ field: 'code', message: 'Course code is required (e.g. CS 301)' });
  }

  if (!subject.name || subject.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Subject name is required' });
  }

  if (!subject.color || subject.color.trim().length === 0) {
    errors.push({ field: 'color', message: 'Color code is required' });
  }

  if (subject.targetWeeklyHours !== undefined) {
    if (typeof subject.targetWeeklyHours !== 'number' || subject.targetWeeklyHours < 0 || subject.targetWeeklyHours > 30) {
      errors.push({ field: 'targetWeeklyHours', message: 'Target weekly hours must be between 0 and 30' });
    }
  }

  if (subject.credits !== undefined) {
    if (typeof subject.credits !== 'number' || subject.credits < 0 || subject.credits > 20) {
      errors.push({ field: 'credits', message: 'Course credits must be between 0 and 20' });
    }
  }

  return createValidationResult(errors);
}

/**
 * 4. TimetableSlot Validation
 */
const VALID_DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const VALID_SLOT_TYPES: SlotType[] = ['lecture', 'lab', 'tutorial', 'commute', 'personal', 'study_window'];

export function validateTimetableSlot(slot: Partial<TimetableSlot>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!slot.id || slot.id.trim().length === 0) {
    errors.push({ field: 'id', message: 'Timetable slot ID is required' });
  }

  if (!slot.semesterId || slot.semesterId.trim().length === 0) {
    errors.push({ field: 'semesterId', message: 'Slot must belong to a semester' });
  }

  if (!slot.title || slot.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Slot title is required' });
  }

  if (!slot.dayOfWeek || !VALID_DAYS.includes(slot.dayOfWeek)) {
    errors.push({ field: 'dayOfWeek', message: `Invalid day of week: ${slot.dayOfWeek}` });
  }

  if (!slot.startTime || !isValidTimeString(slot.startTime)) {
    errors.push({ field: 'startTime', message: 'Valid startTime (HH:mm) is required' });
  }

  if (!slot.endTime || !isValidTimeString(slot.endTime)) {
    errors.push({ field: 'endTime', message: 'Valid endTime (HH:mm) is required' });
  }

  if (slot.startTime && slot.endTime && isValidTimeString(slot.startTime) && isValidTimeString(slot.endTime)) {
    if (!isTimeAfter(slot.startTime, slot.endTime)) {
      errors.push({ field: 'endTime', message: 'End time must be after start time' });
    }
  }

  if (!slot.type || !VALID_SLOT_TYPES.includes(slot.type)) {
    errors.push({ field: 'type', message: `Invalid slot type: ${slot.type}` });
  }

  return createValidationResult(errors);
}

/**
 * 5. TimeBlock Validation
 */
export function validateTimeBlock(block: Partial<TimeBlock>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!block.id || block.id.trim().length === 0) {
    errors.push({ field: 'id', message: 'TimeBlock ID is required' });
  }

  if (!block.date || !isValidDateString(block.date)) {
    errors.push({ field: 'date', message: 'Valid date (YYYY-MM-DD) is required' });
  }

  if (!block.title || block.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'TimeBlock title is required' });
  }

  if (!block.startTime || !isValidTimeString(block.startTime)) {
    errors.push({ field: 'startTime', message: 'Valid startTime (HH:mm) is required' });
  }

  if (!block.endTime || !isValidTimeString(block.endTime)) {
    errors.push({ field: 'endTime', message: 'Valid endTime (HH:mm) is required' });
  }

  if (block.startTime && block.endTime && isValidTimeString(block.startTime) && isValidTimeString(block.endTime)) {
    if (!isTimeAfter(block.startTime, block.endTime)) {
      errors.push({ field: 'endTime', message: 'End time must be after start time' });
    }
  }

  if (block.durationMinutes !== undefined && block.durationMinutes <= 0) {
    errors.push({ field: 'durationMinutes', message: 'Duration must be greater than 0 minutes' });
  }

  return createValidationResult(errors);
}

/**
 * 6. RoadmapTopic Validation & Prerequisite Cycle Detection
 */
const VALID_TOPIC_STATUSES: TopicStatus[] = ['locked', 'ready', 'in_progress', 'completed'];

export function validateRoadmapTopic(topic: Partial<RoadmapTopic>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!topic.id || topic.id.trim().length === 0) {
    errors.push({ field: 'id', message: 'Topic ID is required' });
  }

  if (!topic.subjectId || topic.subjectId.trim().length === 0) {
    errors.push({ field: 'subjectId', message: 'Topic must belong to a subject' });
  }

  if (!topic.title || topic.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Topic title is required' });
  }

  if (topic.estimatedMinutes !== undefined && (topic.estimatedMinutes <= 0 || topic.estimatedMinutes > 480)) {
    errors.push({ field: 'estimatedMinutes', message: 'Estimated minutes must be between 1 and 480' });
  }

  if (topic.masteryLevel !== undefined && (topic.masteryLevel < 0 || topic.masteryLevel > 100)) {
    errors.push({ field: 'masteryLevel', message: 'Mastery level must be between 0 and 100%' });
  }

  if (topic.status && !VALID_TOPIC_STATUSES.includes(topic.status)) {
    errors.push({ field: 'status', message: `Invalid status: ${topic.status}` });
  }

  // Prevent self-prerequisite
  if (topic.id && topic.prerequisiteTopicIds?.includes(topic.id)) {
    errors.push({ field: 'prerequisiteTopicIds', message: 'A topic cannot list itself as a prerequisite' });
  }

  return createValidationResult(errors);
}

/**
 * Detect cycles in topic prerequisite graph (DAG verification)
 * Returns null if acyclic, or returns array of topic IDs forming the cycle.
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
        // Cycle detected
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
 * 7. StudySession Validation
 */
export function validateStudySession(session: Partial<StudySession>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!session.id || session.id.trim().length === 0) {
    errors.push({ field: 'id', message: 'Session ID is required' });
  }

  if (!session.subjectId || session.subjectId.trim().length === 0) {
    errors.push({ field: 'subjectId', message: 'Session must link to a subject' });
  }

  if (!session.date || !isValidDateString(session.date)) {
    errors.push({ field: 'date', message: 'Valid date (YYYY-MM-DD) is required' });
  }

  if (!session.startTime) {
    errors.push({ field: 'startTime', message: 'Session start timestamp is required' });
  }

  if (session.plannedDurationMinutes !== undefined && session.plannedDurationMinutes <= 0) {
    errors.push({ field: 'plannedDurationMinutes', message: 'Planned duration must be positive' });
  }

  if (session.actualDurationMinutes !== undefined && session.actualDurationMinutes < 0) {
    errors.push({ field: 'actualDurationMinutes', message: 'Actual duration cannot be negative' });
  }

  if (session.comprehensionRating !== undefined && (![1, 2, 3, 4, 5].includes(session.comprehensionRating))) {
    errors.push({ field: 'comprehensionRating', message: 'Comprehension rating must be an integer between 1 and 5' });
  }

  if (session.energyRating !== undefined && (![1, 2, 3, 4, 5].includes(session.energyRating))) {
    errors.push({ field: 'energyRating', message: 'Energy rating must be an integer between 1 and 5' });
  }

  return createValidationResult(errors);
}

/**
 * 8. Goal Validation
 */
const VALID_HORIZONS: GoalHorizon[] = ['semester', 'monthly', 'weekly', 'career'];
const VALID_GOAL_STATUSES: GoalStatus[] = ['active', 'completed', 'abandoned'];

export function validateGoal(goal: Partial<Goal>): ValidationResult {
  const errors: ValidationError[] = [];

  if (!goal.id || goal.id.trim().length === 0) {
    errors.push({ field: 'id', message: 'Goal ID is required' });
  }

  if (!goal.title || goal.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Goal title is required' });
  }

  if (goal.targetValue === undefined || typeof goal.targetValue !== 'number' || goal.targetValue <= 0) {
    errors.push({ field: 'targetValue', message: 'Target value must be a positive number' });
  }

  if (goal.currentValue !== undefined && (typeof goal.currentValue !== 'number' || goal.currentValue < 0)) {
    errors.push({ field: 'currentValue', message: 'Current value cannot be negative' });
  }

  if (!goal.unit || goal.unit.trim().length === 0) {
    errors.push({ field: 'unit', message: 'Goal measurement unit is required (e.g. %, hours)' });
  }

  if (!goal.horizon || !VALID_HORIZONS.includes(goal.horizon)) {
    errors.push({ field: 'horizon', message: `Invalid horizon: ${goal.horizon}` });
  }

  if (goal.status && !VALID_GOAL_STATUSES.includes(goal.status)) {
    errors.push({ field: 'status', message: `Invalid goal status: ${goal.status}` });
  }

  if (goal.deadline && !isValidDateString(goal.deadline)) {
    errors.push({ field: 'deadline', message: 'Goal deadline must be YYYY-MM-DD' });
  }

  return createValidationResult(errors);
}

/**
 * 9. Schedule Conflict Detection & Time Validation
 */

export interface ScheduleConflict {
  id: string;
  type: 'sleep_conflict' | 'fixed_overlap' | 'flexible_overlap_with_fixed' | 'invalid_time_range';
  severity: 'error' | 'warning';
  dayOfWeek?: DayOfWeek;
  message: string;
  itemATitle?: string;
  itemBTitle?: string;
  startTime?: string;
  endTime?: string;
}

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function areIntervalsOverlapping(startA: string, endA: string, startB: string, endB: string): boolean {
  const sA = parseTimeToMinutes(startA);
  const eA = parseTimeToMinutes(endA);
  const sB = parseTimeToMinutes(startB);
  const eB = parseTimeToMinutes(endB);
  return sA < eB && sB < eA;
}

export function isSlotConflictingWithSleep(
  startTime: string,
  endTime: string,
  wakeTime?: string,
  sleepTime?: string
): boolean {
  if (!wakeTime || !sleepTime) return false;
  const s = parseTimeToMinutes(startTime);
  const e = parseTimeToMinutes(endTime);
  const wake = parseTimeToMinutes(wakeTime);
  const sleep = parseTimeToMinutes(sleepTime);

  if (sleep > wake) {
    // Standard overnight sleep window, e.g. 23:00 to 07:00
    // Sleep is [sleep, 1440) U [0, wake)
    // Overlap occurs if slot starts before wake or ends after sleep, or starts during sleep
    return s < wake || e > sleep || s >= sleep;
  } else if (wake > sleep) {
    // Daytime/morning sleep window, e.g. 02:00 to 10:00
    // Sleep is [sleep, wake)
    return s < wake && e > sleep;
  }
  return false;
}

/**
 * Validates a single proposed slot or study period against existing commitments
 */
export function checkSlotConflict(
  proposed: {
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    isFixed: boolean;
    title?: string;
    excludeId?: string;
  },
  existingSlots: TimetableSlot[],
  existingStudyPeriods: AvailableStudyPeriod[],
  wakeTime?: string,
  sleepTime?: string
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // 1. Invalid time range
  if (parseTimeToMinutes(proposed.endTime) <= parseTimeToMinutes(proposed.startTime)) {
    conflicts.push({
      id: `err-range-${Date.now()}`,
      type: 'invalid_time_range',
      severity: 'error',
      dayOfWeek: proposed.dayOfWeek,
      message: `End time (${proposed.endTime}) must be strictly after start time (${proposed.startTime}).`,
      startTime: proposed.startTime,
      endTime: proposed.endTime,
    });
    return conflicts;
  }

  // 2. Sleep conflict
  if (wakeTime && sleepTime && isSlotConflictingWithSleep(proposed.startTime, proposed.endTime, wakeTime, sleepTime)) {
    conflicts.push({
      id: `sleep-conflict-${Date.now()}`,
      type: 'sleep_conflict',
      severity: 'warning',
      dayOfWeek: proposed.dayOfWeek,
      message: `Time window (${proposed.startTime} – ${proposed.endTime}) encroaches on your protected sleep schedule (${sleepTime} – ${wakeTime}).`,
      itemATitle: proposed.title || 'Scheduled block',
      startTime: proposed.startTime,
      endTime: proposed.endTime,
    });
  }

  // 3. Overlap with fixed commitments on the same day
  const sameDayFixedSlots = existingSlots.filter(
    (s) => s.dayOfWeek === proposed.dayOfWeek && s.isFixed && s.id !== proposed.excludeId
  );

  for (const fixedSlot of sameDayFixedSlots) {
    if (areIntervalsOverlapping(proposed.startTime, proposed.endTime, fixedSlot.startTime, fixedSlot.endTime)) {
      if (proposed.isFixed) {
        conflicts.push({
          id: `fixed-overlap-${fixedSlot.id}-${Date.now()}`,
          type: 'fixed_overlap',
          severity: 'error',
          dayOfWeek: proposed.dayOfWeek,
          message: `Conflicts with fixed class "${fixedSlot.title}" (${fixedSlot.startTime} – ${fixedSlot.endTime}).`,
          itemATitle: proposed.title || 'New block',
          itemBTitle: fixedSlot.title,
          startTime: fixedSlot.startTime,
          endTime: fixedSlot.endTime,
        });
      } else {
        conflicts.push({
          id: `flex-fixed-overlap-${fixedSlot.id}-${Date.now()}`,
          type: 'flexible_overlap_with_fixed',
          severity: 'error',
          dayOfWeek: proposed.dayOfWeek,
          message: `Flexible study window overlaps with mandatory campus commitment "${fixedSlot.title}" (${fixedSlot.startTime} – ${fixedSlot.endTime}).`,
          itemATitle: proposed.title || 'Study Window',
          itemBTitle: fixedSlot.title,
          startTime: fixedSlot.startTime,
          endTime: fixedSlot.endTime,
        });
      }
    }
  }

  // 4. If proposed is a fixed slot, check if it overlaps with any flexible study period
  if (proposed.isFixed) {
    const sameDayPeriods = existingStudyPeriods.filter(
      (p) => p.dayOfWeek === proposed.dayOfWeek && p.id !== proposed.excludeId
    );
    for (const period of sameDayPeriods) {
      if (areIntervalsOverlapping(proposed.startTime, proposed.endTime, period.startTime, period.endTime)) {
        conflicts.push({
          id: `fixed-flex-overlap-${period.id}-${Date.now()}`,
          type: 'flexible_overlap_with_fixed',
          severity: 'warning',
          dayOfWeek: proposed.dayOfWeek,
          message: `This fixed block overlaps with your configured study window "${period.label || 'Study Period'}" (${period.startTime} – ${period.endTime}).`,
          itemATitle: proposed.title || 'Fixed Block',
          itemBTitle: period.label || 'Study Window',
          startTime: period.startTime,
          endTime: period.endTime,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Detects all existing conflicts across a full timetable and study periods
 */
export function detectAllScheduleConflicts(
  timetableSlots: TimetableSlot[],
  studyPeriods: AvailableStudyPeriod[],
  wakeTime?: string,
  sleepTime?: string
): ScheduleConflict[] {
  const allConflicts: ScheduleConflict[] = [];

  // Check all fixed slots against each other
  const fixedSlots = timetableSlots.filter((s) => s.isFixed);
  for (let i = 0; i < fixedSlots.length; i++) {
    const slotA = fixedSlots[i];
    // Check range
    if (parseTimeToMinutes(slotA.endTime) <= parseTimeToMinutes(slotA.startTime)) {
      allConflicts.push({
        id: `range-${slotA.id}`,
        type: 'invalid_time_range',
        severity: 'error',
        dayOfWeek: slotA.dayOfWeek,
        message: `"${slotA.title}" has an invalid time range (${slotA.startTime} to ${slotA.endTime}).`,
        itemATitle: slotA.title,
      });
    }
    // Check sleep
    if (wakeTime && sleepTime && isSlotConflictingWithSleep(slotA.startTime, slotA.endTime, wakeTime, sleepTime)) {
      allConflicts.push({
        id: `sleep-${slotA.id}`,
        type: 'sleep_conflict',
        severity: 'warning',
        dayOfWeek: slotA.dayOfWeek,
        message: `"${slotA.title}" (${slotA.startTime} – ${slotA.endTime}) falls inside sleep hours (${sleepTime} – ${wakeTime}).`,
        itemATitle: slotA.title,
      });
    }
    // Check overlap with other fixed slots on same day
    for (let j = i + 1; j < fixedSlots.length; j++) {
      const slotB = fixedSlots[j];
      if (slotA.dayOfWeek === slotB.dayOfWeek && areIntervalsOverlapping(slotA.startTime, slotA.endTime, slotB.startTime, slotB.endTime)) {
        allConflicts.push({
          id: `fixed-fixed-${slotA.id}-${slotB.id}`,
          type: 'fixed_overlap',
          severity: 'error',
          dayOfWeek: slotA.dayOfWeek,
          message: `Direct clash: "${slotA.title}" (${slotA.startTime} – ${slotA.endTime}) overlaps with "${slotB.title}" (${slotB.startTime} – ${slotB.endTime}).`,
          itemATitle: slotA.title,
          itemBTitle: slotB.title,
        });
      }
    }
  }

  // Check flexible study periods
  for (const period of studyPeriods) {
    if (parseTimeToMinutes(period.endTime) <= parseTimeToMinutes(period.startTime)) {
      allConflicts.push({
        id: `range-${period.id}`,
        type: 'invalid_time_range',
        severity: 'error',
        dayOfWeek: period.dayOfWeek,
        message: `Study window "${period.label}" has an invalid time range.`,
        itemATitle: period.label,
      });
    }

    if (wakeTime && sleepTime && isSlotConflictingWithSleep(period.startTime, period.endTime, wakeTime, sleepTime)) {
      allConflicts.push({
        id: `sleep-${period.id}`,
        type: 'sleep_conflict',
        severity: 'warning',
        dayOfWeek: period.dayOfWeek,
        message: `Study window "${period.label}" (${period.startTime} – ${period.endTime}) encroaches on sleep hours.`,
        itemATitle: period.label,
      });
    }

    // Check overlap with fixed slots on same day
    const dayFixed = fixedSlots.filter((f) => f.dayOfWeek === period.dayOfWeek);
    for (const fixed of dayFixed) {
      if (areIntervalsOverlapping(period.startTime, period.endTime, fixed.startTime, fixed.endTime)) {
        allConflicts.push({
          id: `flex-fixed-${period.id}-${fixed.id}`,
          type: 'flexible_overlap_with_fixed',
          severity: 'error',
          dayOfWeek: period.dayOfWeek,
          message: `Study window "${period.label || 'Study Period'}" (${period.startTime} – ${period.endTime}) clashes with campus lecture "${fixed.title}" (${fixed.startTime} – ${fixed.endTime}).`,
          itemATitle: period.label || 'Study Window',
          itemBTitle: fixed.title,
        });
      }
    }
  }

  return allConflicts;
}
