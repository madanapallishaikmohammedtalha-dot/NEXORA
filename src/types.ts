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

export type LearningCategory = 'academic' | 'career' | 'project';

export interface TopicLearningEvidence {
  studied: boolean;   // Logged >= 1 study session or focus period
  practiced: boolean; // Logged practice or >= 30m actual duration
  assessed: boolean;  // Logged comprehension rating >= 3
  mastered: boolean;  // Mastery level >= 80% with real session evidence
}

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

  // Multi-domain, pedagogical stage, and override extensions
  domain?: string; // e.g. "Operating Systems", "Java", "DSA", "Web Development", "AI", "Git/GitHub", "Career Skills"
  category?: LearningCategory; // 'academic' | 'career' | 'project'
  stage?: string; // e.g. "Foundations", "Core Architecture", "Applied Systems", "Advanced Topics"
  stageIndex?: number;
  isUserOverride?: boolean; // When true, user bypassed incomplete prereqs with explicit override
  overrideWarning?: string;
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

export interface TopicProgressDetail {
  topicId: string;
  status: TopicStatus;
  masteryLevel: number;
  totalTimeMinutes: number;
  sessionsCount: number;
  averageComprehension: number;
  evidence: TopicLearningEvidence;
  isCompleted: boolean;
  isPrerequisitesMet: boolean;
  missingPrereqTitles: string[];
}

export interface RoadmapProgressSummary {
  totalTopics: number;
  completedTopics: number;
  inProgressTopics: number;
  readyTopics: number;
  lockedTopics: number;
  completionPercentage: number;
  averageMastery: number;
  totalTimeInvestedMinutes: number;
  evidenceBreakdown: {
    studiedCount: number;
    practicedCount: number;
    assessedCount: number;
    masteredCount: number;
  };
}

export interface LearningDomainInfo {
  id: string;
  name: string;
  category: LearningCategory;
  description: string;
  subjectId?: string;
  iconName?: string;
  color?: string;
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

export type ActivityType = 
  | 'college_work' 
  | 'academic_study' 
  | 'career_learning' 
  | 'dsa_practice' 
  | 'project_work' 
  | 'revision' 
  | 'break';

export type ActivityPriority = 'high' | 'medium' | 'low';
export type ActivitySource = 'ai' | 'manual' | 'system';

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
  activityType?: ActivityType;
  priority?: ActivityPriority;
  source?: ActivitySource;
  domain?: 'academic' | 'career' | 'project';
  objective?: string;
  isBreak?: boolean;
  isUserOverride?: boolean;
  overrideWarning?: string;
  originalScheduledTime?: string;
  rescheduledTo?: string; // target date/time
}

export interface DailyCheckInInput {
  date: string;
  hasUrgentAssignment?: boolean;
  assignmentSubjectId?: string;
  assignmentDetails?: string;
  energyLevel?: 'high' | 'medium' | 'low';
  tired?: boolean;
  reachedHomeLate?: boolean;
  lateArrivalMinutes?: number;
  hasCollegeWorkToday?: boolean;
  extraMinutes?: number;
  focusTopicOrSkill?: string; // e.g. "Java", "DSA"
  customNote?: string;
}

export interface ProposedDailyMission {
  date: string;
  todayCapacityMinutes: number;
  usedCapacityMinutes: number;
  freeCapacityMinutes: number;
  rationale: string;
  items: MissionItem[];
  checkIn?: DailyCheckInInput;
}

export interface DailyMission {
  id: string;
  date: string; // YYYY-MM-DD
  availableMinutes: number; // Net free capacity calculated from timetable
  allocatedMinutes: number;
  items: MissionItem[];
  reflectionNotes?: string;
  aiProposalRationale?: string;
  checkIn?: DailyCheckInInput;
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
  difficultyNote?: string; // Optional difficulty note or tricky roadblock
}

// ==========================================
// AI Tutor Modes & Context-Aware Types
// ==========================================

export type TutorMode =
  | 'explain'
  | 'why'
  | 'example'
  | 'analogy'
  | 'practice'
  | 'test'
  | 'explain_back'
  | 'review_answer';

export interface TutorContext {
  semester?: {
    id: string;
    name: string;
  };
  subject?: {
    id: string;
    code: string;
    name: string;
  };
  domain?: string;
  topic?: {
    id: string;
    title: string;
    description: string;
    masteryLevel: number;
    status: TopicStatus;
    stage?: string;
  };
  prerequisites?: Array<{
    id: string;
    title: string;
    status: TopicStatus;
    masteryLevel: number;
  }>;
  topicMastery?: number;
  previousSessions?: Array<{
    date: string;
    actualDurationMinutes: number;
    comprehensionRating: number;
    energyRating: number;
    keyTakeaways: string;
    difficultyNote?: string;
  }>;
  comprehensionHistory?: {
    averageComprehension: number;
    totalSessions: number;
    recentRatings: number[];
  };
  currentObjective?: string;
  isLocked?: boolean;
  missingPrerequisites?: string[];
}

export interface ExplainItBackFeedback {
  understandingScore: number; // 0 - 100
  whatYouGotRight: string[];
  whatIsMissing: string[];
  oneCorrection: string;
  followUpQuestion: string;
}

export type AssessmentProblemType = 'multiple_choice' | 'short_answer' | 'code' | 'explain';

export interface AssessmentProblem {
  id: string;
  type: AssessmentProblemType;
  question: string;
  options?: string[]; // For multiple choice
  correctAnswer?: string;
  rubricHint?: string;
}

export interface TestAssessment {
  topicId: string;
  topicTitle: string;
  difficulty: 'foundational' | 'intermediate' | 'advanced';
  problems: AssessmentProblem[];
}

export interface TestEvaluation {
  score: number; // 0 - 100
  totalQuestions: number;
  correctCount: number;
  feedbackPerQuestion: Array<{
    problemId: string;
    question: string;
    studentAnswer: string;
    isCorrect: boolean;
    explanation: string;
  }>;
  overallFeedback: string;
  nextRecommendedAction: string;
}

export interface PracticeProblem {
  id: string;
  title: string;
  description: string;
  difficulty: 'foundational' | 'intermediate' | 'advanced';
  hints: string[];
  sampleInputOutput?: string;
}

export interface PracticeProblemSet {
  topicId: string;
  topicTitle: string;
  problems: PracticeProblem[];
}

export interface SoloCodingChallenge {
  id: string;
  title: string;
  topicTitle: string;
  description: string;
  inputSpecification?: string;
  outputSpecification?: string;
  starterCode?: string;
  hints: string[]; // Revealed only upon explicit request
  solutionReference?: string; // Revealed only after submission
}

export interface SoloCodeReview {
  correctness: 'correct' | 'partially_correct' | 'incorrect';
  logicScore: number; // 0 - 100
  correctnessAnalysis: string;
  logicAnalysis: string;
  edgeCases: string[];
  complexity: {
    time: string;
    space: string;
    analysis: string;
  };
  readability: string;
  conceptualUnderstanding: string;
  mistakesExplained: string[];
  alternativeSolution?: string;
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

// ==========================================
// Weekly Review & Next-Week Planning Types
// ==========================================

export interface WeeklySubjectBreakdown {
  subjectId: string;
  code: string;
  name: string;
  color: string;
  actualMinutes: number;
  plannedMinutes: number;
  targetWeeklyHours: number;
  sessionsCount: number;
  averageComprehension: number;
  topicsStudied: string[];
}

export interface WeeklyTopicMasteryChange {
  topicId: string;
  title: string;
  subjectCode: string;
  beforeMastery: number;
  currentMastery: number;
  deltaMastery: number;
  status: TopicStatus;
}

export interface WeeklyGoalProgress {
  goalId: string;
  title: string;
  horizon: GoalHorizon;
  currentValue: number;
  targetValue: number;
  unit: string;
  progressPercentage: number;
  isCompleted: boolean;
}

export interface ConsistencyScoreFactor {
  factor: 'sessions_completed' | 'execution_ratio' | 'practice_completion' | 'assessment_participation' | 'goal_progress';
  label: string;
  earnedPoints: number;
  maxPoints: number;
  description: string;
}

export interface ConsistencyScoreBreakdown {
  score: number; // 0 - 100
  factors: ConsistencyScoreFactor[];
  summary: string;
}

export interface DetectedLearningPattern {
  id: string;
  type: 
    | 'planned_exceeds_actual'
    | 'high_study_low_assessment'
    | 'repeated_low_comprehension'
    | 'frequent_category_skipping'
    | 'strong_subject_consistency'
    | 'topic_revisited_no_mastery'
    | 'excessive_tutorial_vs_practice'
    | 'balanced_sustainable_pace';
  severity: 'positive' | 'warning' | 'info';
  title: string;
  description: string;
  evidence: string;
}

export interface WeeklyAnalyticsReport {
  weekStartDate: string; // YYYY-MM-DD (Monday)
  weekEndDate: string;   // YYYY-MM-DD (Sunday)
  plannedStudyMinutes: number;
  actualStudyMinutes: number;
  executionPercentage: number; // actual / planned * 100 clamped or formatted
  completedSessionsCount: number;
  skippedSessionsCount: number;
  missedSessionsCount: number;
  rescheduledSessionsCount: number;
  averageComprehension: number; // 1.0 - 5.0
  averageEnergy: number;         // 1.0 - 5.0
  topicsStudiedCount: number;
  topicsCompletedCount: number;
  topicsInProgressCount: number;
  topicsStudied: Array<{ id: string; title: string; subjectCode: string }>;
  masteryChanges: WeeklyTopicMasteryChange[];
  strongestAreas: Array<{ subjectCode: string; name: string; score: number; reason: string }>;
  weakAreas: Array<{ subjectCode: string; name: string; score: number; reason: string }>;
  // Category time distributions (minutes)
  academicMinutes: number;
  careerMinutes: number;
  projectMinutes: number;
  revisionMinutes: number;
  // Subject level breakdowns
  subjectBreakdowns: WeeklySubjectBreakdown[];
  // Goal progress
  goalsProgress: WeeklyGoalProgress[];
  // Consistency score
  consistency: ConsistencyScoreBreakdown;
  // Deterministic observations
  deterministicObservations: string[];
  // Detected behavioral/learning patterns
  learningPatterns: DetectedLearningPattern[];
}

export interface NextWeekProposedItem {
  id: string;
  subjectId?: string;
  topicId?: string;
  subjectCode: string;
  title: string;
  targetSessions: number; // e.g. 2 or 3 sessions
  estimatedMinutesPerSession: number;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  category: 'academic' | 'career' | 'project' | 'revision';
  status: 'accepted' | 'modified' | 'removed';
}

export interface AIWeeklyReviewContext {
  studentName: string;
  degreeMajor: string;
  semesterName: string;
  weekRange: { start: string; end: string };
  metrics: {
    plannedMinutes: number;
    actualMinutes: number;
    executionPercentage: number;
    sessionsCompleted: number;
    sessionsSkipped: number;
    sessionsMissed: number;
    averageComprehension: number;
    averageEnergy: number;
    consistencyScore: number;
  };
  timeDistribution: {
    academicHours: number;
    careerHours: number;
    projectHours: number;
    revisionHours: number;
  };
  subjectPacing: Array<{
    code: string;
    actualHours: number;
    targetHours: number;
    avgComprehension: number;
  }>;
  masteryChanges: Array<{
    title: string;
    subjectCode: string;
    delta: number;
  }>;
  detectedPatterns: string[];
  strongestAreas: string[];
  weakAreas: string[];
}

export interface AIWeeklyReviewResponse {
  interpretation: string;
  learningObservations: string[];
  explanations: string;
  recommendedPriorities: string[];
  distributionSuggestions: string;
  revisionRecommendations: string[];
  potentialBottlenecks: string[];
  proposedNextWeekPlan: Array<{
    subjectCode: string;
    title: string;
    recommendedSessions: number;
    estimatedMinutesPerSession?: number;
    reason: string;
    category?: 'academic' | 'career' | 'project' | 'revision';
  }>;
}

export type ActiveTab = 
  | 'dashboard'
  | 'planner'
  | 'timetable'
  | 'roadmap'
  | 'tutor'
  | 'progress'
  | 'weekly_review'
  | 'semester'
  | 'settings';
