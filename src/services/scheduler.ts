import { AppState, DayOfWeek, MissionItem, RoadmapTopic, TimetableSlot } from '../types';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const DAY_NAMES: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

// Convert "HH:mm" to minutes since midnight
export function timeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Convert minutes since midnight back to "HH:mm"
export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.floor(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Get DayOfWeek from YYYY-MM-DD
export function getDayOfWeekFromDate(dateStr: string): DayOfWeek {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayIndex = date.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const mapping: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return mapping[dayIndex];
}

// Format date to readable string
export function formatDateReadable(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// Check if a date falls in a semester holiday or break
export function getHolidayForDate(dateStr: string, state: AppState) {
  const activeSemester = state.semesters.find((s) => s.id === state.activeSemesterId);
  if (!activeSemester) return null;
  return activeSemester.holidays.find((h) => dateStr >= h.startDate && dateStr <= h.endDate);
}

/**
 * CORE PRINCIPLE: Calculate REAL available study capacity
 * 24 Hours (1440m)
 * - Sleep hours (default 8h = 480m)
 * - Fixed campus commitments (lectures, labs, commute)
 * - Commute & meal buffers (approx 120m)
 * - Inter-class transition buffers (e.g., 15m each)
 * = True gross free time
 * Net capacity = bounded by student's configured max daily threshold (e.g., 4 hours)
 */
export function calculateDailyCapacity(dateStr: string, state: AppState) {
  const dayOfWeek = getDayOfWeekFromDate(dateStr);
  const profile = state.profile;
  const activeSemester = state.semesters.find((s) => s.id === state.activeSemesterId);

  // Check if semester break
  const holiday = getHolidayForDate(dateStr, state);
  const isWeekend = dayOfWeek === 'saturday' || dayOfWeek === 'sunday';

  // Fixed timetable slots for this day
  const slotsForDay = state.timetable.filter(
    (slot) => slot.semesterId === state.activeSemesterId && slot.dayOfWeek === dayOfWeek
  );

  let fixedMinutes = 0;
  let fixedCount = 0;

  slotsForDay.forEach((slot) => {
    if (slot.isFixed) {
      const start = timeToMinutes(slot.startTime);
      const end = timeToMinutes(slot.endTime);
      if (end > start) {
        fixedMinutes += end - start;
        fixedCount++;
      }
    }
  });

  const sleepMinutes = (profile.sleepHours || 8) * 60;
  const basicMaintenanceMinutes = 120; // eating, hygiene, chores
  const transitionBuffer = fixedCount * (profile.defaultBufferMinutes || 15);

  let remainingUncommitted = 1440 - sleepMinutes - basicMaintenanceMinutes - fixedMinutes - transitionBuffer;
  if (remainingUncommitted < 0) remainingUncommitted = 0;

  // If holiday or weekend, student has more open slots
  if (holiday) {
    remainingUncommitted = Math.max(remainingUncommitted, 360);
  }

  // Sustainable cognitive capacity: 75% of uncommitted time to prevent burnout
  const sustainableAvailableMinutes = Math.floor(remainingUncommitted * 0.75);

  // Respect user hard cap (e.g. 4.5 hours = 270m)
  const maxCapMinutes = (profile.dailyCapacityMaxHours || 4) * 60;
  const netAvailableMinutes = Math.min(sustainableAvailableMinutes, maxCapMinutes);

  return {
    date: dateStr,
    dayOfWeek,
    holidayName: holiday?.name,
    fixedCommitmentsMinutes: fixedMinutes,
    fixedBlocksCount: fixedCount,
    sleepMinutes,
    netAvailableMinutes: Math.max(30, netAvailableMinutes), // ensure at least 30m slot if day is busy
    rawUncommittedMinutes: remainingUncommitted,
    maxCapMinutes,
    slotsForDay,
  };
}

/**
 * Prerequisite DAG (Directed Acyclic Graph) Checker
 * Evaluates whether all prerequisite topic IDs for a given topic are 'completed'
 */
export function evaluatePrerequisites(
  topic: RoadmapTopic,
  allTopics: RoadmapTopic[]
): { prerequisitesMet: boolean; missingPrereqs: RoadmapTopic[] } {
  if (!topic.prerequisiteTopicIds || topic.prerequisiteTopicIds.length === 0) {
    return { prerequisitesMet: true, missingPrereqs: [] };
  }

  const topicMap = new Map(allTopics.map((t) => [t.id, t]));
  const missingPrereqs: RoadmapTopic[] = [];

  for (const prereqId of topic.prerequisiteTopicIds) {
    const prereq = topicMap.get(prereqId);
    if (!prereq || prereq.status !== 'completed') {
      if (prereq) missingPrereqs.push(prereq);
    }
  }

  return {
    prerequisitesMet: missingPrereqs.length === 0,
    missingPrereqs,
  };
}

// Compute total planned vs actual study time for a date
export function computePlannedVsActual(items: MissionItem[]) {
  const planned = items.reduce((acc, curr) => acc + (curr.plannedMinutes || 0), 0);
  const actual = items.reduce((acc, curr) => acc + (curr.actualMinutes || 0), 0);
  const completedCount = items.filter((i) => i.status === 'completed').length;
  return {
    plannedMinutes: planned,
    actualMinutes: actual,
    totalItems: items.length,
    completedItems: completedCount,
    completionRate: items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0,
  };
}

// Compute study hours completed this week per subject
export function computeWeeklySubjectHours(state: AppState) {
  const now = new Date();
  // Get Monday of current week
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);

  const stats: Record<string, { subjectId: string; actualMinutes: number; targetWeeklyHours: number }> = {};

  state.subjects.forEach((sub) => {
    stats[sub.id] = {
      subjectId: sub.id,
      actualMinutes: 0,
      targetWeeklyHours: sub.targetWeeklyHours,
    };
  });

  state.sessions.forEach((session) => {
    const sessionDate = new Date(session.startTime);
    if (sessionDate >= monday && stats[session.subjectId]) {
      stats[session.subjectId].actualMinutes += session.actualDurationMinutes;
    }
  });

  return stats;
}
