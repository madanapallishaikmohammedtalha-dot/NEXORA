export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface Holiday {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  type: 'holiday' | 'break' | 'exam_prep';
}

export interface AvailableStudyPeriod {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // HH:mm e.g. "14:00"
  endTime: string;   // HH:mm e.g. "17:00"
  label?: string;    // e.g. "Afternoon Library Focus"
}

export interface Semester {
  id: string;
  name: string; // e.g., "Fall 2026 - Year 3 Semester 1"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  expectedEndDate?: string; // YYYY-MM-DD
  actualEndDate?: string;   // YYYY-MM-DD (filled when semester finishes)
  holidays: Holiday[];
  targetWeeklyStudyHours: number;
  isActive: boolean;
}

export interface Subject {
  id: string;
  semesterId: string;
  code: string; // e.g., "CS 301"
  name: string; // e.g., "Operating Systems"
  color: string; // Tailwind color hex or class
  targetWeeklyHours: number;
  credits: number;
  syllabusOverview?: string;
}

export type SlotType = 'lecture' | 'lab' | 'tutorial' | 'commute' | 'personal' | 'study_window' | 'break';

export interface TimetableSlot {
  id: string;
  semesterId: string;
  subjectId?: string; // Optional if commute or personal
  title: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // HH:mm 24-hr format e.g. "09:00"
  endTime: string; // HH:mm 24-hr format e.g. "10:30"
  location?: string;
  isFixed: boolean; // Fixed = mandatory lecture/lab/commute; Flexible = potential study window
  type: SlotType;
}

// Concrete TimeBlock (instantiated for a specific calendar date)
export interface TimeBlock {
  id: string;
  date: string; // YYYY-MM-DD
  slotId?: string; // Reference to recurring timetable slot if generated from it
  subjectId?: string;
  title: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  type: SlotType;
  isFixed: boolean;
}

export type TopicStatus = 'locked' | 'ready' | 'in_progress' | 'completed';

export interface RoadmapTopic {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  prerequisiteTopicIds: string[]; // Directed Acyclic Graph edges
  status: TopicStatus;
  masteryLevel: number; // 0 - 100%
  notes?: string;
  orderIndex: number;
  lastStudiedAt?: string;
}

// Learning Progress record per topic (longitudinal metric tracking)
export interface LearningProgress {
  topicId: string;
  subjectId: string;
  masteryLevel: number; // 0 - 100%
  status: TopicStatus;
  totalTimeMinutes: number;
  sessionsCount: number;
  averageComprehension: number; // 1 - 5 scale
  lastStudiedAt?: string;
}

// Academic & Career Goals
export type GoalHorizon = 'semester' | 'monthly' | 'weekly' | 'career';
export type GoalStatus = 'active' | 'completed' | 'abandoned';

export interface Goal {
  id: string;
  semesterId?: string;
  subjectId?: string;
  title: string;
  description?: string;
  targetValue: number; // e.g. 100 (percentage), 50 (hours), 10 (topics)
  currentValue: number;
  unit: string; // e.g. "%", "hours", "topics", "grade"
  horizon: GoalHorizon;
  deadline?: string; // YYYY-MM-DD
  status: GoalStatus;
  createdAt: string; // ISO date string
}

export type MissionItemStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'missed' | 'rescheduled';

export interface MissionItem {
  id: string;
  topicId?: string;
  subjectId?: string;
  title: string;
  plannedMinutes: number;
  actualMinutes: number;
  status: MissionItemStatus;
  scheduledTime?: string; // e.g. "16:00"
  endTime?: string;       // e.g. "16:45"
  isAIRecorded: boolean;
  priorityScore?: number;
  reason?: string;
  isBreak?: boolean;
  isUserOverride?: boolean;
  overrideWarning?: string;
  originalScheduledTime?: string;
  rescheduledTo?: string; // target date/time
}

export interface DailyMission {
  id: string;
  date: string; // YYYY-MM-DD
  availableMinutes: number; // Net free capacity calculated from timetable
  allocatedMinutes: number;
  items: MissionItem[];
  reflectionNotes?: string;
  aiProposalRationale?: string;
}

export interface StudySession {
  id: string;
  missionItemId?: string;
  topicId?: string;
  subjectId: string;
  startTime: string; // ISO timestamp
  endTime?: string; // ISO timestamp
  plannedDurationMinutes: number;
  actualDurationMinutes: number;
  comprehensionRating: 1 | 2 | 3 | 4 | 5; // 1 = Lost, 5 = Mastered
  energyRating: 1 | 2 | 3 | 4 | 5; // 1 = Exhausted, 5 = Peak Flow
  keyTakeaways: string;
  date: string; // YYYY-MM-DD
}

export type SkillProficiency = 'beginner' | 'intermediate' | 'advanced' | 'proficient';

export interface SkillWithLevel {
  name: string;
  level: SkillProficiency;
}

export interface UserProfile {
  name: string;
  university: string;
  degreeMajor: string;
  currentYear: string;
  dailyCapacityMaxHours: number; // Safety threshold e.g. 4.5 hours
  defaultBufferMinutes: number; // Transition buffer between blocks e.g. 15m
  sleepHours: number; // Default 8 hours
  travelTimeMinutes?: number; // One-way or total daily commute e.g. 30m
  wakeTime?: string; // HH:mm e.g. "07:00"
  sleepTime?: string; // HH:mm e.g. "23:00"
  currentSkills?: string[]; // e.g. ["Python", "Data Structures", "SQL"]
  skillsWithLevels?: SkillWithLevel[]; // skills with structured proficiency
  careerInterests?: string[]; // e.g. ["Systems Engineering", "Distributed Systems"]
  currentProjects?: string[]; // e.g. ["POSIX Shell Interpreter", "Key-Value Store"]
  aiProvider: 'gemini' | 'custom' | 'offline';
  apiKey?: string;
  customEndpoint?: string;
  aiModel?: string;
  hasCompletedOnboarding: boolean;
}

export interface AppState {
  profile: UserProfile;
  semesters: Semester[];
  activeSemesterId: string;
  subjects: Subject[];
  timetable: TimetableSlot[];
  studyPeriods?: AvailableStudyPeriod[];
  topics: RoadmapTopic[];
  missions: Record<string, DailyMission>; // Keyed by YYYY-MM-DD
  sessions: StudySession[];
  goals: Goal[];
  timeBlocks?: Record<string, TimeBlock[]>; // Keyed by YYYY-MM-DD
}

export type ActiveTab = 
  | 'dashboard'
  | 'planner'
  | 'timetable'
  | 'roadmap'
  | 'tutor'
  | 'progress'
  | 'semester'
  | 'settings';
