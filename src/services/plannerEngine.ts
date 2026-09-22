import { 
  AppState, 
  DayOfWeek, 
  DailyMission, 
  MissionItem, 
  MissionItemStatus,
  RoadmapTopic, 
  TimetableSlot, 
  UserProfile,
  Goal
} from '../types';
import { 
  DAYS_OF_WEEK, 
  DAY_NAMES, 
  timeToMinutes, 
  minutesToTime, 
  getDayOfWeekFromDate, 
  formatDateReadable, 
  getHolidayForDate,
  evaluatePrerequisites,
  computeWeeklySubjectHours
} from './scheduler';

// -------------------------------------------------------------
// Types for Deterministic Interval Math & Scheduling
// -------------------------------------------------------------

export interface TimeInterval {
  start: number; // minutes from midnight [0..1439]
  end: number;   // minutes from midnight [0..1439]
  label?: string;
  type?: 'sleep' | 'fixed' | 'commute' | 'maintenance' | 'buffer' | 'study_window' | 'task' | 'break';
  isFixed?: boolean;
}

export interface ConflictDetail {
  type: 'overlap_fixed' | 'overlap_sleep' | 'overlap_task' | 'exceeds_capacity' | 'prerequisite_unmet' | 'unrealistic_duration';
  message: string;
  conflictingEventTitle?: string;
  conflictStart?: string;
  conflictEnd?: string;
  severity: 'error' | 'warning';
}

export interface CapacityCalculus {
  date: string;
  dayOfWeek: DayOfWeek;
  isHoliday: boolean;
  holidayName?: string;
  wakeTimeMinutes: number;
  sleepTimeMinutes: number;
  sleepMinutes: number;
  maintenanceMinutes: number;
  fixedCommitmentsMinutes: number;
  fixedBlocksCount: number;
  transitionBufferMinutes: number;
  travelMinutes: number;
  rawUncommittedMinutes: number;
  sustainableStudyMinutes: number;
  dailyCapacityMaxMinutes: number;
  netAvailableStudyMinutes: number; // T_net
  safeBudgetMinutes: number;       // 85% of T_net
  fixedIntervals: TimeInterval[];
  flexibleIntervals: TimeInterval[];
}

export interface CandidateTopicWithScore {
  topic: RoadmapTopic;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  prerequisitesMet: boolean;
  missingPrereqTitles: string[];
  masteryLevel: number;
  subjectNeedMinutes: number;
  goalAlignmentBonus: number;
  recencyFactor: number;
  priorityScore: number;
  recommendedChunkMinutes: number;
  reason: string;
}

export interface ScheduleResult {
  mission: DailyMission;
  capacity: CapacityCalculus;
  scheduledItems: MissionItem[];
  overflowTopics: RoadmapTopic[];
  conflicts: ConflictDetail[];
  totalStudyMinutes: number;
  totalBreakMinutes: number;
}

// -------------------------------------------------------------
// 1. Time Interval Mathematics (Deterministic & Pure)
// -------------------------------------------------------------

/**
 * Checks if two intervals [startA, endA) and [startB, endB) overlap.
 * Zero-length intervals touching at borders do NOT overlap.
 */
export function intervalsOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return Math.max(startA, startB) < Math.min(endA, endB);
}

/**
 * Calculates the overlap duration in minutes between two intervals.
 */
export function getOverlapMinutes(startA: number, endA: number, startB: number, endB: number): number {
  const overlap = Math.min(endA, endB) - Math.max(startA, startB);
  return Math.max(0, overlap);
}

/**
 * Merges overlapping or adjacent intervals into a minimal sorted set of intervals.
 */
export function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length <= 1) return [...intervals];

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: TimeInterval[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      // Overlapping or touching
      last.end = Math.max(last.end, current.end);
      if (current.isFixed || last.isFixed) last.isFixed = true;
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/**
 * Subtracts blocked intervals from an available window [dayStart, dayEnd].
 * Returns remaining available flexible intervals.
 */
export function subtractIntervals(
  baseWindow: { start: number; end: number },
  blockedIntervals: TimeInterval[]
): TimeInterval[] {
  const mergedBlocked = mergeIntervals(
    blockedIntervals
      .filter((b) => intervalsOverlap(baseWindow.start, baseWindow.end, b.start, b.end))
      .map((b) => ({
        start: Math.max(baseWindow.start, b.start),
        end: Math.min(baseWindow.end, b.end),
      }))
  );

  const freeIntervals: TimeInterval[] = [];
  let currentStart = baseWindow.start;

  for (const block of mergedBlocked) {
    if (block.start > currentStart) {
      freeIntervals.push({
        start: currentStart,
        end: block.start,
        type: 'study_window',
      });
    }
    currentStart = Math.max(currentStart, block.end);
  }

  if (currentStart < baseWindow.end) {
    freeIntervals.push({
      start: currentStart,
      end: baseWindow.end,
      type: 'study_window',
    });
  }

  return freeIntervals;
}

// -------------------------------------------------------------
// 2. Capacity & Interval Derivation Pipeline
// -------------------------------------------------------------

/**
 * Derives the mathematical capacity and discrete flexible intervals
 * strictly adhering to PLANNER_ENGINE.md specification.
 */
export function deriveDayCapacity(dateStr: string, state: AppState): CapacityCalculus {
  const dayOfWeek = getDayOfWeekFromDate(dateStr);
  const profile = state.profile;
  const holiday = getHolidayForDate(dateStr, state);

  // 1. Sleep Schedule Derivation
  // Parse wakeTime and sleepTime or fallback to sleepHours (default 8 hrs: 23:00 to 07:00)
  const wakeMin = profile.wakeTime ? timeToMinutes(profile.wakeTime) : 420; // 07:00
  const sleepMin = profile.sleepTime ? timeToMinutes(profile.sleepTime) : 1380; // 23:00
  const sleepDurationHours = profile.sleepHours || 8;
  const sleepMinutes = sleepDurationHours * 60;

  // Active waking day boundary [wakeMin, sleepMin]
  const activeWakingWindow = {
    start: Math.min(wakeMin, sleepMin),
    end: Math.max(wakeMin, sleepMin),
  };

  // 2. Fixed Commitments (Lectures, Labs, Tutorials, Commutes, Fixed Personal)
  const slotsForDay = state.timetable.filter(
    (slot) => slot.semesterId === state.activeSemesterId && slot.dayOfWeek === dayOfWeek
  );

  const fixedSlots = slotsForDay.filter((s) => s.isFixed);
  let fixedCommitmentsMinutes = 0;
  const fixedIntervals: TimeInterval[] = [];

  const bufferMinutes = profile.defaultBufferMinutes !== undefined ? profile.defaultBufferMinutes : 15;
  const transitionBufferIntervals: TimeInterval[] = [];

  fixedSlots.forEach((slot) => {
    const start = timeToMinutes(slot.startTime);
    const end = timeToMinutes(slot.endTime);
    if (end > start) {
      fixedCommitmentsMinutes += (end - start);
      fixedIntervals.push({
        start,
        end,
        label: slot.title,
        type: slot.type === 'commute' ? 'commute' : 'fixed',
        isFixed: true,
      });

      // Inter-slot transition buffer
      if (bufferMinutes > 0) {
        transitionBufferIntervals.push({
          start: Math.max(activeWakingWindow.start, start - bufferMinutes),
          end: start,
          label: `Transition buffer (${slot.title})`,
          type: 'buffer',
          isFixed: true,
        });
        transitionBufferIntervals.push({
          start: end,
          end: Math.min(activeWakingWindow.end, end + bufferMinutes),
          label: `Buffer (${slot.title})`,
          type: 'buffer',
          isFixed: true,
        });
      }
    }
  });

  // 3. Travel Time Consideration
  // If user has travelTimeMinutes configured and campus slots exist, ensure transit is blocked
  const travelMinutes = profile.travelTimeMinutes || 0;
  const campusSlots = fixedSlots.filter((s) => s.type === 'lecture' || s.type === 'lab' || s.type === 'tutorial');
  const commuteIntervals: TimeInterval[] = [];

  if (travelMinutes > 0 && campusSlots.length > 0) {
    // Earliest campus slot
    const earliestCampusStart = Math.min(...campusSlots.map((s) => timeToMinutes(s.startTime)));
    const latestCampusEnd = Math.max(...campusSlots.map((s) => timeToMinutes(s.endTime)));

    // Check if there is already an explicit commute slot before campus
    const hasPreCommute = fixedSlots.some(
      (s) => s.type === 'commute' && timeToMinutes(s.endTime) <= earliestCampusStart
    );
    if (!hasPreCommute) {
      commuteIntervals.push({
        start: Math.max(activeWakingWindow.start, earliestCampusStart - travelMinutes),
        end: earliestCampusStart,
        label: 'Campus Commute (Morning)',
        type: 'commute',
        isFixed: true,
      });
    }

    // Check if there is already an explicit commute slot after campus
    const hasPostCommute = fixedSlots.some(
      (s) => s.type === 'commute' && timeToMinutes(s.startTime) >= latestCampusEnd
    );
    if (!hasPostCommute) {
      commuteIntervals.push({
        start: latestCampusEnd,
        end: Math.min(activeWakingWindow.end, latestCampusEnd + travelMinutes),
        label: 'Campus Commute (Return)',
        type: 'commute',
        isFixed: true,
      });
    }
  }

  // 4. Maintenance / Meal Baselines (120 min: Lunch 12:30-13:15, Dinner 19:00-19:45)
  const maintenanceIntervals: TimeInterval[] = [
    { start: 750, end: 795, label: 'Midday Meal & Recharge', type: 'maintenance', isFixed: true },  // 12:30 - 13:15
    { start: 1140, end: 1185, label: 'Evening Dinner & Break', type: 'maintenance', isFixed: true }, // 19:00 - 19:45
  ];
  const maintenanceMinutes = 120; // 90 min meals + 30 min morning/evening hygiene

  // Total Transition Buffers
  const transitionBufferMinutes = fixedSlots.length * bufferMinutes;

  // 5. Raw Uncommitted Time Formula (docs/PLANNER_ENGINE.md Section 3.2)
  let rawUncommitted = 1440 - sleepMinutes - maintenanceMinutes - fixedCommitmentsMinutes - transitionBufferMinutes;
  if (rawUncommitted < 0) rawUncommitted = 0;

  if (holiday) {
    rawUncommitted = Math.max(rawUncommitted, 360);
  }

  // 6. Sustainable Study Capacity (75% to prevent burnout)
  const sustainableStudyMinutes = Math.floor(rawUncommitted * 0.75);

  // 7. Hard Capacity Ceiling (max personal threshold)
  const maxCapMinutes = Math.round((profile.dailyCapacityMaxHours || 4.5) * 60);
  const netAvailableStudyMinutes = Math.max(30, Math.min(sustainableStudyMinutes, maxCapMinutes));
  const safeBudgetMinutes = Math.floor(netAvailableStudyMinutes * 0.85);

  // 8. Subtract all blocked intervals from the waking day to identify discrete Flexible Intervals
  const allBlockedIntervals: TimeInterval[] = [
    ...fixedIntervals,
    ...transitionBufferIntervals,
    ...commuteIntervals,
    ...maintenanceIntervals,
  ];

  const rawFlexibleIntervals = subtractIntervals(activeWakingWindow, allBlockedIntervals);

  // Filter out tiny slivers under 20 minutes (unusable for deep cognitive work)
  const flexibleIntervals = rawFlexibleIntervals
    .filter((iv) => iv.end - iv.start >= 20)
    .map((iv) => ({
      ...iv,
      label: `Flexible Focus Window (${minutesToTime(iv.start)} - ${minutesToTime(iv.end)})`,
    }));

  return {
    date: dateStr,
    dayOfWeek,
    isHoliday: !!holiday,
    holidayName: holiday?.name,
    wakeTimeMinutes: wakeMin,
    sleepTimeMinutes: sleepMin,
    sleepMinutes,
    maintenanceMinutes,
    fixedCommitmentsMinutes,
    fixedBlocksCount: fixedSlots.length,
    transitionBufferMinutes,
    travelMinutes,
    rawUncommittedMinutes: rawUncommitted,
    sustainableStudyMinutes,
    dailyCapacityMaxMinutes: maxCapMinutes,
    netAvailableStudyMinutes,
    safeBudgetMinutes,
    fixedIntervals,
    flexibleIntervals,
  };
}

// -------------------------------------------------------------
// 3. Conflict Detection Engine (Deterministic Logic)
// -------------------------------------------------------------

/**
 * Deterministically checks for conflicts in a scheduled day:
 * - Overlapping events (fixed, tasks, sleep)
 * - Tasks scheduled during protected sleep hours
 * - Tasks scheduled during fixed lecture/lab commitments or travel
 * - Unrealistic task durations (< 15 min or > 180 min without break)
 * - Exceeding daily safe capacity cap
 */
export function detectScheduleConflicts(
  dateStr: string,
  missionItems: MissionItem[],
  state: AppState
): ConflictDetail[] {
  const conflicts: ConflictDetail[] = [];
  const capacity = deriveDayCapacity(dateStr, state);
  const profile = state.profile;

  const wakeMin = capacity.wakeTimeMinutes;
  const sleepMin = capacity.sleepTimeMinutes;

  // 1. Check Capacity Overload
  const totalPlannedMinutes = missionItems
    .filter((i) => i.status !== 'skipped' && i.status !== 'missed')
    .reduce((acc, curr) => acc + (curr.plannedMinutes || 0), 0);

  if (totalPlannedMinutes > capacity.netAvailableStudyMinutes) {
    conflicts.push({
      type: 'exceeds_capacity',
      message: `Total planned study time (${totalPlannedMinutes}m) exceeds daily net capacity (${capacity.netAvailableStudyMinutes}m). Risk of cognitive fatigue.`,
      severity: 'warning',
    });
  }

  // 2. Check each mission item for duration realism
  missionItems.forEach((item) => {
    if (item.plannedMinutes < 15) {
      conflicts.push({
        type: 'unrealistic_duration',
        message: `Task "${item.title}" duration (${item.plannedMinutes}m) is under the 15-minute minimum threshold.`,
        conflictingEventTitle: item.title,
        severity: 'warning',
      });
    } else if (item.plannedMinutes > 180) {
      conflicts.push({
        type: 'unrealistic_duration',
        message: `Task "${item.title}" duration (${item.plannedMinutes}m) exceeds 3 hours without a break. Unrealistic cognitive block.`,
        conflictingEventTitle: item.title,
        severity: 'warning',
      });
    }

    // Check prerequisites if topicId is linked
    if (item.topicId) {
      const topic = state.topics.find((t) => t.id === item.topicId);
      if (topic) {
        const prereqCheck = evaluatePrerequisites(topic, state.topics);
        if (!prereqCheck.prerequisitesMet) {
          const missingTitles = prereqCheck.missingPrereqs.map((p) => p.title).join(', ');
          conflicts.push({
            type: 'prerequisite_unmet',
            message: `Topic "${topic.title}" has unmet prerequisites: [${missingTitles}].`,
            conflictingEventTitle: item.title,
            severity: 'error',
          });
        }
      }
    }
  });

  // 3. Check time-placed items for Overlaps with Sleep, Fixed Commitments, and Each Other
  const timedItems = missionItems.filter((i) => !!i.scheduledTime);

  timedItems.forEach((item, idx) => {
    const itemStart = timeToMinutes(item.scheduledTime!);
    const itemEnd = item.endTime ? timeToMinutes(item.endTime) : itemStart + item.plannedMinutes;

    // Check Sleep Encroachment
    // If sleep spans overnight e.g. 23:30 to 07:30
    const inSleep = (itemStart < wakeMin && itemEnd > 0) || (itemEnd > sleepMin) || (itemStart >= sleepMin);
    if (inSleep) {
      conflicts.push({
        type: 'overlap_sleep',
        message: `Task "${item.title}" (${item.scheduledTime} - ${minutesToTime(itemEnd)}) encroaches on protected sleep schedule (${minutesToTime(sleepMin)} - ${minutesToTime(wakeMin)}).`,
        conflictingEventTitle: item.title,
        conflictStart: item.scheduledTime,
        conflictEnd: minutesToTime(itemEnd),
        severity: 'error',
      });
    }

    // Check Overlap with Fixed Commitments (lectures, labs, commute)
    capacity.fixedIntervals.forEach((fixed) => {
      if (intervalsOverlap(itemStart, itemEnd, fixed.start, fixed.end)) {
        conflicts.push({
          type: 'overlap_fixed',
          message: `Task "${item.title}" (${item.scheduledTime} - ${minutesToTime(itemEnd)}) clashes with fixed commitment "${fixed.label}" (${minutesToTime(fixed.start)} - ${minutesToTime(fixed.end)}).`,
          conflictingEventTitle: item.title,
          conflictStart: minutesToTime(Math.max(itemStart, fixed.start)),
          conflictEnd: minutesToTime(Math.min(itemEnd, fixed.end)),
          severity: 'error',
        });
      }
    });

    // Check Overlap with other timed mission items
    for (let j = idx + 1; j < timedItems.length; j++) {
      const other = timedItems[j];
      const otherStart = timeToMinutes(other.scheduledTime!);
      const otherEnd = other.endTime ? timeToMinutes(other.endTime) : otherStart + other.plannedMinutes;

      if (intervalsOverlap(itemStart, itemEnd, otherStart, otherEnd)) {
        conflicts.push({
          type: 'overlap_task',
          message: `Task "${item.title}" (${item.scheduledTime} - ${minutesToTime(itemEnd)}) overlaps with task "${other.title}" (${other.scheduledTime} - ${minutesToTime(otherEnd)}).`,
          conflictingEventTitle: item.title,
          conflictStart: minutesToTime(Math.max(itemStart, otherStart)),
          conflictEnd: minutesToTime(Math.min(itemEnd, otherEnd)),
          severity: 'error',
        });
      }
    }
  });

  return conflicts;
}

// -------------------------------------------------------------
// 4. Candidate Topic Scoring & Ranking Pipeline
// -------------------------------------------------------------

/**
 * Ranks candidate roadmap topics according to PLANNER_ENGINE.md Section 5:
 * PriorityScore(t) = 0.4 * (100 - Mastery) + 0.4 * SubjectNeed + 0.2 * RecencyFactor + GoalBonus
 */
export function rankCandidateTopics(state: AppState): CandidateTopicWithScore[] {
  const weeklyHours = computeWeeklySubjectHours(state);
  const subjectsMap = new Map(state.subjects.map((s) => [s.id, s]));
  const activeGoals = state.goals.filter((g) => g.status === 'active');

  const candidates: CandidateTopicWithScore[] = [];

  state.topics.forEach((topic) => {
    // 1. Prerequisite verification
    const prereqEval = evaluatePrerequisites(topic, state.topics);
    const subject = subjectsMap.get(topic.subjectId);
    if (!subject) return;

    // Filter: exclude completed topics unless user specifically requests review
    if (topic.status === 'completed' && topic.masteryLevel >= 90) return;

    // 2. Subject Deficit
    const subjectStats = weeklyHours[topic.subjectId];
    const targetHours = subject.targetWeeklyHours || 4;
    const actualHours = subjectStats ? subjectStats.actualMinutes / 60 : 0;
    const subjectNeedHours = Math.max(0, targetHours - actualHours);
    const subjectNeedScore = Math.min(100, Math.round((subjectNeedHours / targetHours) * 100));

    // 3. Mastery Need
    const mastery = topic.masteryLevel || 0;
    const masteryNeed = 100 - mastery;

    // 4. Recency Factor
    // Topics not studied recently get higher priority
    let recencyScore = 50;
    if (topic.lastStudiedAt) {
      const daysSince = Math.floor((Date.now() - new Date(topic.lastStudiedAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 5) recencyScore = 90;
      else if (daysSince >= 2) recencyScore = 70;
      else recencyScore = 30;
    } else {
      recencyScore = 80; // Never studied
    }

    // 5. Goal Alignment Bonus
    let goalBonus = 0;
    const matchingGoal = activeGoals.find((g) => g.subjectId === topic.subjectId || (g.title.toLowerCase().includes(topic.title.toLowerCase())));
    if (matchingGoal) {
      goalBonus = matchingGoal.horizon === 'weekly' ? 25 : 15;
    }

    // 6. Final Priority Score
    // Formula: 0.4 * MasteryNeed + 0.4 * SubjectNeed + 0.2 * Recency + GoalBonus
    let score = Math.round(0.4 * masteryNeed + 0.4 * subjectNeedScore + 0.2 * recencyScore + goalBonus);

    // If prerequisites are NOT met, drastically penalize and mark not ready
    if (!prereqEval.prerequisitesMet) {
      score = 0;
    }

    // Chunk size: slice into 30 to 60 minute realistic blocks
    const baseEstimated = topic.estimatedMinutes || 45;
    const chunkMinutes = Math.min(60, Math.max(30, Math.round(baseEstimated / 15) * 15));

    candidates.push({
      topic,
      subjectId: topic.subjectId,
      subjectCode: subject.code,
      subjectName: subject.name,
      prerequisitesMet: prereqEval.prerequisitesMet,
      missingPrereqTitles: prereqEval.missingPrereqs.map((p) => p.title),
      masteryLevel: mastery,
      subjectNeedMinutes: Math.round(subjectNeedHours * 60),
      goalAlignmentBonus: goalBonus,
      recencyFactor: recencyScore,
      priorityScore: score,
      recommendedChunkMinutes: chunkMinutes,
      reason: prereqEval.prerequisitesMet
        ? `${subject.code} needs ${(subjectNeedHours).toFixed(1)}h this week • Mastery: ${mastery}% • ${matchingGoal ? 'Aligned with goal' : 'Core syllabus'}`
        : `Locked: requires [${prereqEval.missingPrereqs.map((p) => p.title).join(', ')}]`,
    });
  });

  // Sort descending by priority score; topics with prerequisites met first
  return candidates.sort((a, b) => {
    if (a.prerequisitesMet !== b.prerequisitesMet) {
      return a.prerequisitesMet ? -1 : 1;
    }
    return b.priorityScore - a.priorityScore;
  });
}

// -------------------------------------------------------------
// 5. Deterministic Auto-Scheduling Engine
// -------------------------------------------------------------

/**
 * Packs candidate tasks and cognitive breaks into available flexible intervals
 * strictly obeying:
 * 1. Fixed commitments & transit buffers
 * 2. User sleep schedule
 * 3. Daily net study capacity cap
 * 4. Realistic task durations (30-60m)
 * 5. Mandatory 10-15m breaks between focus blocks
 * 6. User overrides (pinned/manual tasks)
 */
export function generateDeterministicSchedule(
  dateStr: string,
  state: AppState,
  options: {
    includeBreaks?: boolean;
    breakMinutes?: number;
    preserveManualItems?: boolean;
  } = {}
): ScheduleResult {
  const includeBreaks = options.includeBreaks !== false;
  const breakMinutes = options.breakMinutes || 10;
  const preserveManual = options.preserveManualItems !== false;

  const capacity = deriveDayCapacity(dateStr, state);
  const existingMission = state.missions[dateStr];
  const candidates = rankCandidateTopics(state).filter((c) => c.prerequisitesMet && c.priorityScore > 0);

  // Retain manual user overrides if requested
  const preservedItems: MissionItem[] = [];
  const blockedByPreserved: TimeInterval[] = [];

  if (preserveManual && existingMission) {
    existingMission.items.forEach((item) => {
      if (item.isUserOverride || !item.isAIRecorded) {
        preservedItems.push(item);
        if (item.scheduledTime) {
          const start = timeToMinutes(item.scheduledTime);
          const end = item.endTime ? timeToMinutes(item.endTime) : start + item.plannedMinutes;
          blockedByPreserved.push({ start, end, label: item.title, isFixed: true });
        }
      }
    });
  }

  // Calculate available flexible slots after taking preserved manual items into account
  const usableIntervals: TimeInterval[] = [];
  for (const flex of capacity.flexibleIntervals) {
    const freeInWindow = subtractIntervals(
      { start: flex.start, end: flex.end },
      blockedByPreserved
    );
    usableIntervals.push(...freeInWindow.filter((iv) => iv.end - iv.start >= 20));
  }

  let totalScheduledStudyMinutes = preservedItems.reduce((acc, curr) => acc + (curr.plannedMinutes || 0), 0);
  let totalScheduledBreakMinutes = 0;
  const scheduledItems: MissionItem[] = [...preservedItems];
  const overflowTopics: RoadmapTopic[] = [];

  // Cognitive cap threshold: do not exceed safeBudgetMinutes (85% of net capacity)
  const capacityBudget = capacity.safeBudgetMinutes;

  let candidateIdx = 0;

  // Place candidate tasks into usable intervals sequentially
  for (const interval of usableIntervals) {
    let currentPointer = interval.start;

    while (currentPointer < interval.end && candidateIdx < candidates.length) {
      // Check if we reached daily safe study budget
      if (totalScheduledStudyMinutes >= capacityBudget) {
        break;
      }

      const candidate = candidates[candidateIdx];
      let taskDuration = candidate.recommendedChunkMinutes;

      // Ensure task duration fits in remaining interval time
      const remainingIntervalTime = interval.end - currentPointer;
      if (remainingIntervalTime < 20) {
        // Less than 20 minutes left in this window; advance to next window
        break;
      }

      // If available space is smaller than recommended chunk, clamp to remaining space (min 20m)
      if (taskDuration > remainingIntervalTime) {
        taskDuration = remainingIntervalTime >= 30 ? Math.floor(remainingIntervalTime / 15) * 15 : remainingIntervalTime;
      }

      // Also ensure it does not overshoot remaining daily budget
      const remainingBudget = capacityBudget - totalScheduledStudyMinutes;
      if (remainingBudget < 20) {
        // Less than minimum viable task duration remaining in safe budget
        break;
      }

      if (taskDuration > remainingBudget) {
        taskDuration = Math.floor(remainingBudget / 15) * 15;
        if (taskDuration < 20) {
          if (remainingBudget >= 20) {
            taskDuration = remainingBudget;
          } else {
            break;
          }
        }
      }

      const taskStartMin = currentPointer;
      const taskEndMin = currentPointer + taskDuration;

      // Create Mission Item
      const missionItem: MissionItem = {
        id: `mi-${dateStr}-${Date.now()}-${candidateIdx}`,
        topicId: candidate.topic.id,
        subjectId: candidate.subjectId,
        title: `${candidate.subjectCode}: ${candidate.topic.title}`,
        plannedMinutes: taskDuration,
        actualMinutes: 0,
        status: 'pending',
        scheduledTime: minutesToTime(taskStartMin),
        endTime: minutesToTime(taskEndMin),
        isAIRecorded: false,
        priorityScore: candidate.priorityScore,
        reason: candidate.reason,
      };

      scheduledItems.push(missionItem);
      totalScheduledStudyMinutes += taskDuration;
      currentPointer = taskEndMin;
      candidateIdx++;

      // Insert Break if enabled and space remains
      if (includeBreaks && currentPointer + breakMinutes <= interval.end) {
        // Insert explicit break
        const breakEnd = currentPointer + breakMinutes;
        scheduledItems.push({
          id: `break-${dateStr}-${Date.now()}-${candidateIdx}`,
          title: `☕ Cognitive Rest & Hydration (${breakMinutes}m)`,
          plannedMinutes: breakMinutes,
          actualMinutes: 0,
          status: 'pending',
          scheduledTime: minutesToTime(currentPointer),
          endTime: minutesToTime(breakEnd),
          isAIRecorded: false,
          isBreak: true,
          reason: 'Protects mental stamina and prevents cognitive saturation.',
        });
        totalScheduledBreakMinutes += breakMinutes;
        currentPointer = breakEnd;
      }
    }

    if (totalScheduledStudyMinutes >= capacityBudget) {
      break;
    }
  }

  // Any remaining unplaced candidates become overflow
  while (candidateIdx < candidates.length) {
    overflowTopics.push(candidates[candidateIdx].topic);
    candidateIdx++;
  }

  // Sort all scheduled items chronologically
  scheduledItems.sort((a, b) => {
    const aTime = a.scheduledTime ? timeToMinutes(a.scheduledTime) : 9999;
    const bTime = b.scheduledTime ? timeToMinutes(b.scheduledTime) : 9999;
    return aTime - bTime;
  });

  // Verify conflicts
  const conflicts = detectScheduleConflicts(dateStr, scheduledItems, state);

  const updatedMission: DailyMission = {
    id: existingMission?.id || `m-${dateStr}`,
    date: dateStr,
    availableMinutes: capacity.netAvailableStudyMinutes,
    allocatedMinutes: totalScheduledStudyMinutes,
    items: scheduledItems,
    reflectionNotes: existingMission?.reflectionNotes,
  };

  return {
    mission: updatedMission,
    capacity,
    scheduledItems,
    overflowTopics,
    conflicts,
    totalStudyMinutes: totalScheduledStudyMinutes,
    totalBreakMinutes: totalScheduledBreakMinutes,
  };
}

// -------------------------------------------------------------
// 6. Rescheduling & Missed Session Recovery
// -------------------------------------------------------------

/**
 * Reschedules a specific task to a new time or moves it to another date.
 * Validates against conflicts.
 */
export function rescheduleTask(
  currentDateStr: string,
  itemId: string,
  destination: {
    targetDateStr: string;
    newScheduledTime?: string;
  },
  state: AppState
): {
  sourceMission: DailyMission;
  targetMission: DailyMission;
  conflicts: ConflictDetail[];
} {
  const sourceMission = state.missions[currentDateStr];
  if (!sourceMission) {
    throw new Error(`Mission for date ${currentDateStr} not found`);
  }

  const targetDateStr = destination.targetDateStr;
  const isSameDay = currentDateStr === targetDateStr;

  const targetMission = state.missions[targetDateStr] || {
    id: `m-${targetDateStr}`,
    date: targetDateStr,
    availableMinutes: deriveDayCapacity(targetDateStr, state).netAvailableStudyMinutes,
    allocatedMinutes: 0,
    items: [],
  };

  const itemToMove = sourceMission.items.find((i) => i.id === itemId);
  if (!itemToMove) {
    throw new Error(`Item ${itemId} not found in mission for ${currentDateStr}`);
  }

  // Update Item
  const updatedItem: MissionItem = {
    ...itemToMove,
    originalScheduledTime: itemToMove.scheduledTime,
    rescheduledTo: destination.newScheduledTime ? `${targetDateStr} ${destination.newScheduledTime}` : targetDateStr,
    scheduledTime: destination.newScheduledTime || itemToMove.scheduledTime,
    endTime: destination.newScheduledTime
      ? minutesToTime(timeToMinutes(destination.newScheduledTime) + itemToMove.plannedMinutes)
      : itemToMove.endTime,
    status: isSameDay ? 'pending' : 'rescheduled',
  };

  if (isSameDay) {
    const updatedSourceItems = sourceMission.items.map((i) => (i.id === itemId ? updatedItem : i));
    const conflicts = detectScheduleConflicts(currentDateStr, updatedSourceItems, state);

    const updatedSourceMission: DailyMission = {
      ...sourceMission,
      items: updatedSourceItems,
      allocatedMinutes: updatedSourceItems
        .filter((i) => !i.isBreak && i.status !== 'skipped' && i.status !== 'missed')
        .reduce((acc, curr) => acc + curr.plannedMinutes, 0),
    };

    return {
      sourceMission: updatedSourceMission,
      targetMission: updatedSourceMission,
      conflicts,
    };
  } else {
    // Cross-day move: mark original as rescheduled in source mission, add new active copy to target
    const updatedSourceItems = sourceMission.items.map((i) =>
      i.id === itemId ? { ...i, status: 'rescheduled' as MissionItemStatus, rescheduledTo: targetDateStr } : i
    );

    const newTargetItem: MissionItem = {
      ...updatedItem,
      id: `mi-${targetDateStr}-${Date.now()}`,
      status: 'pending',
    };

    const updatedTargetItems = [...targetMission.items, newTargetItem];
    const conflicts = detectScheduleConflicts(targetDateStr, updatedTargetItems, state);

    const updatedSourceMission: DailyMission = {
      ...sourceMission,
      items: updatedSourceItems,
      allocatedMinutes: updatedSourceItems
        .filter((i) => !i.isBreak && i.status !== 'skipped' && i.status !== 'rescheduled')
        .reduce((acc, curr) => acc + curr.plannedMinutes, 0),
    };

    const updatedTargetMission: DailyMission = {
      ...targetMission,
      items: updatedTargetItems,
      allocatedMinutes: updatedTargetItems
        .filter((i) => !i.isBreak && i.status !== 'skipped' && i.status !== 'rescheduled')
        .reduce((acc, curr) => acc + curr.plannedMinutes, 0),
    };

    return {
      sourceMission: updatedSourceMission,
      targetMission: updatedTargetMission,
      conflicts,
    };
  }
}

/**
 * Rebalances a day's schedule when circumstances change:
 * - Shifts pending tasks forward into remaining available flexible intervals
 * - Moves uncompleted tasks that can't fit into tomorrow's candidate pool
 */
export function rebalanceDaySchedule(
  dateStr: string,
  state: AppState,
  currentClockTimeStr: string
): {
  rebalancedMission: DailyMission;
  deferredItems: MissionItem[];
  conflicts: ConflictDetail[];
} {
  const currentMission = state.missions[dateStr];
  if (!currentMission || currentMission.items.length === 0) {
    return {
      rebalancedMission: currentMission || {
        id: `m-${dateStr}`,
        date: dateStr,
        availableMinutes: 0,
        allocatedMinutes: 0,
        items: [],
      },
      deferredItems: [],
      conflicts: [],
    };
  }

  const currentMin = timeToMinutes(currentClockTimeStr);
  const capacity = deriveDayCapacity(dateStr, state);

  // Completed or in-progress items remain as-is
  const completedOrDoneItems = currentMission.items.filter(
    (i) => i.status === 'completed' || i.actualMinutes > 0
  );

  // Pending items that need rebalancing
  const pendingItems = currentMission.items.filter(
    (i) => i.status === 'pending' && i.actualMinutes === 0 && !i.isBreak
  );

  // Find remaining flexible intervals strictly AFTER currentMin
  const remainingIntervals = capacity.flexibleIntervals
    .map((iv) => ({
      start: Math.max(iv.start, currentMin),
      end: iv.end,
      type: iv.type,
      label: iv.label,
    }))
    .filter((iv) => iv.end - iv.start >= 20);

  const rebalancedItems: MissionItem[] = [...completedOrDoneItems];
  const deferredItems: MissionItem[] = [];

  let intervalIdx = 0;
  let currentPointer = remainingIntervals[0] ? remainingIntervals[0].start : 1440;

  for (const item of pendingItems) {
    let placed = false;

    while (intervalIdx < remainingIntervals.length) {
      const currentInterval = remainingIntervals[intervalIdx];
      currentPointer = Math.max(currentPointer, currentInterval.start);

      if (currentPointer + item.plannedMinutes <= currentInterval.end) {
        const itemEnd = currentPointer + item.plannedMinutes;
        rebalancedItems.push({
          ...item,
          scheduledTime: minutesToTime(currentPointer),
          endTime: minutesToTime(itemEnd),
        });
        currentPointer = itemEnd + 10; // 10 min break buffer
        placed = true;
        break;
      } else {
        // Move to next interval
        intervalIdx++;
        if (intervalIdx < remainingIntervals.length) {
          currentPointer = remainingIntervals[intervalIdx].start;
        }
      }
    }

    if (!placed) {
      // Could not fit in remaining day intervals
      deferredItems.push({
        ...item,
        status: 'missed',
        reason: `Deferred during schedule rebalance at ${currentClockTimeStr} (insufficient remaining capacity).`,
      });
      rebalancedItems.push({
        ...item,
        status: 'missed',
        reason: `Missed / deferred: Insufficient time remaining after ${currentClockTimeStr}.`,
      });
    }
  }

  // Sort rebalanced items
  rebalancedItems.sort((a, b) => {
    const aTime = a.scheduledTime ? timeToMinutes(a.scheduledTime) : 9999;
    const bTime = b.scheduledTime ? timeToMinutes(b.scheduledTime) : 9999;
    return aTime - bTime;
  });

  const conflicts = detectScheduleConflicts(dateStr, rebalancedItems, state);

  const rebalancedMission: DailyMission = {
    ...currentMission,
    items: rebalancedItems,
    allocatedMinutes: rebalancedItems
      .filter((i) => !i.isBreak && i.status !== 'skipped' && i.status !== 'missed')
      .reduce((acc, curr) => acc + curr.plannedMinutes, 0),
  };

  return {
    rebalancedMission,
    deferredItems,
    conflicts,
  };
}
