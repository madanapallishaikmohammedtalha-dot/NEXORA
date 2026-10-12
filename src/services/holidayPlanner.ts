/**
 * NEXORA Holiday Mode & Vacation Planner Engine
 * 
 * Provides a dedicated planning mode for academic breaks and vacations:
 * - Free from mandatory college lectures, labs, and transit buffers
 * - Respects student's days off and maximum daily study capacity
 * - Generates sustainable weekly focus areas matching chosen priorities
 * - Incorporates restorative rest and unfinished goals
 * - Establishes evidence-tracked holiday milestones
 */

import {
  AppState,
  DayOfWeek,
  Goal,
  HolidayPlan,
  HolidayPlanPreferences,
  HolidayPriority,
  HolidayWeekFocus,
} from '../types';

/**
 * Calculates net available holiday days and realistic sustainable hours.
 */
export function calculateHolidayCapacity(preferences: HolidayPlanPreferences): {
  availableDays: number;
  totalStudyDays: number;
  restDaysCount: number;
  totalAvailableHours: number;
  dailyCapMinutes: number;
} {
  const startMs = new Date(preferences.startDate).getTime();
  const endMs = new Date(preferences.endDate).getTime();
  const diffDays = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));

  const daysOffSet = new Set(preferences.daysOff);
  let totalStudyDays = 0;
  let restDaysCount = 0;

  const dayNames: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  for (let i = 0; i < diffDays; i++) {
    const curDate = new Date(startMs + i * 24 * 60 * 60 * 1000);
    const dayName = dayNames[curDate.getDay()];
    if (daysOffSet.has(dayName)) {
      restDaysCount++;
    } else {
      totalStudyDays++;
    }
  }

  const weeksCount = Math.max(1, Math.ceil(diffDays / 7));
  const maxWeeklyHours = preferences.weeklyAvailableHours;
  const totalAvailableHours = Math.round(weeksCount * maxWeeklyHours);
  const dailyCapMinutes = Math.round(preferences.maxDailyCapacityHours * 60);

  return {
    availableDays: diffDays,
    totalStudyDays,
    restDaysCount,
    totalAvailableHours,
    dailyCapMinutes,
  };
}

/**
 * Maps holiday priorities to realistic curriculum focus titles.
 */
const PRIORITY_META: Record<HolidayPriority, { label: string; tasks: string[]; defaultHours: number }> = {
  dsa: {
    label: 'Data Structures & Algorithms',
    tasks: ['Array & Two-Pointer Patterns', 'Binary Search & Trees', 'Graph Traversal (BFS/DFS)', 'Dynamic Programming Fundamentals'],
    defaultHours: 6,
  },
  aiml: {
    label: 'AI & Machine Learning Foundations',
    tasks: ['Linear Algebra & NumPy Intuition', 'Model Training with Scikit-Learn', 'Neural Network Backpropagation', 'LLM Prompt Engineering & Agents'],
    defaultHours: 5,
  },
  web_dev: {
    label: 'Modern Web Development',
    tasks: ['React State & Component Architecture', 'Tailwind & Responsive Layouts', 'REST API Client Integration', 'Frontend Performance & Bundle Optimization'],
    defaultHours: 5,
  },
  backend_dev: {
    label: 'Backend & Systems Engineering',
    tasks: ['Express/Node.js REST Services', 'PostgreSQL Schema & Query Optimization', 'Authentication & JWT Middleware', 'Docker Containerization Basics'],
    defaultHours: 6,
  },
  projects: {
    label: 'Portfolio Project Construction',
    tasks: ['Project Architecture & Scope Definition', 'Core Domain Logic Implementation', 'Interactive User Interface', 'Production Deployment & Demo Video'],
    defaultHours: 8,
  },
  git_github: {
    label: 'Git & GitHub Mastery',
    tasks: ['Interactive Rebase & Commit Hygiene', 'Branching Strategies & Pull Requests', 'GitHub Actions CI Workflows', 'Open-Source Contribution Walkthrough'],
    defaultHours: 3,
  },
  internship_prep: {
    label: 'Internship & Technical Interview Prep',
    tasks: ['Resume Project Narrative Refinement', 'Behavioral STAR Method Practice', 'Timed Mock Problem Solving', 'System Architecture Whiteboard Drill'],
    defaultHours: 4,
  },
  communication: {
    label: 'Technical Communication & Writing',
    tasks: ['Writing Clean Technical Documentation', 'Explaining Complex Algorithms Simply', 'Drafting Project Readmes', 'Engineering Presentation Slides'],
    defaultHours: 3,
  },
  career_exploration: {
    label: 'Career Exploration & Industry Research',
    tasks: ['Exploring Software Engineering Roles', 'Mapping Dream Companies & Requirements', 'Informational Interview Outreach', 'Skill Gap Roadmapping'],
    defaultHours: 3,
  },
  revision: {
    label: 'Spaced Retrieval & Previous Semester Revision',
    tasks: ['Operating Systems Concepts Review', 'Database Normalization & SQL Queries', 'Algorithm Complexity & Proofs', 'Computer Networks Protocol Stack'],
    defaultHours: 4,
  },
  rest: {
    label: 'Cognitive Recovery & Rest',
    tasks: ['Unstructured Reading & Leisure', 'Outdoor Exercise & Mental Reset', 'Sleep Schedule Stabilization', 'Zero-Screen Time Blocks'],
    defaultHours: 0,
  },
};

/**
 * Generates sustainable, realistic weekly holiday plans.
 * Never fills every available hour with study. Incorporates rest days.
 */
export function generateHolidayPlan(
  preferences: HolidayPlanPreferences,
  _state: AppState,
  semesterId: string
): HolidayPlan {
  const capacity = calculateHolidayCapacity(preferences);
  const totalWeeks = Math.max(1, Math.min(8, Math.ceil(capacity.availableDays / 7)));

  const priorities = preferences.selectedPriorities.length > 0
    ? preferences.selectedPriorities
    : (['dsa', 'projects', 'rest'] as HolidayPriority[]);

  const weeks: HolidayWeekFocus[] = [];

  for (let w = 1; w <= totalWeeks; w++) {
    // Pick 1-2 priorities for this week to maintain depth without context switching
    const p1 = priorities[(w - 1) % priorities.length];
    const p2 = priorities[w % priorities.length];

    const meta1 = PRIORITY_META[p1] || PRIORITY_META.dsa;
    const meta2 = p1 !== p2 ? (PRIORITY_META[p2] || PRIORITY_META.projects) : null;

    const task1 = meta1.tasks[(w - 1) % meta1.tasks.length] || meta1.label;
    const task2 = meta2 ? (meta2.tasks[(w - 1) % meta2.tasks.length] || meta2.label) : 'Dedicated Project Build';

    const focusAreas = [meta1.label];
    if (meta2 && meta2 !== meta1) focusAreas.push(meta2.label);

    // Sustainable planned hours (respects student weekly threshold with safe margin)
    const sustainableWeeklyHours = Math.min(
      preferences.weeklyAvailableHours,
      Math.round(preferences.maxDailyCapacityHours * (7 - preferences.daysOff.length) * 0.7)
    );

    const suggestedTasks = [
      {
        id: `htask-${w}-1`,
        title: task1,
        priority: p1,
        estimatedMinutes: Math.min(90, Math.round((sustainableWeeklyHours * 60 * 0.6) / 3)),
        reason: `Builds deliberate competency in ${meta1.label}`,
      },
      {
        id: `htask-${w}-2`,
        title: task2,
        priority: p2,
        estimatedMinutes: Math.min(60, Math.round((sustainableWeeklyHours * 60 * 0.4) / 2)),
        reason: `Practical progress towards holiday milestones`,
      },
    ];

    weeks.push({
      weekNumber: w,
      title: `Week ${w}: ${focusAreas.join(' & ')}`,
      focusAreas,
      plannedHours: sustainableWeeklyHours,
      restDays: preferences.daysOff,
      suggestedTasks,
    });
  }

  // Create default holiday goals matching selected priorities
  const holidayGoals = createDefaultHolidayGoals(priorities, preferences.endDate);

  return {
    id: `holplan-${Date.now()}`,
    semesterId,
    preferences,
    availableDays: capacity.availableDays,
    weeks,
    holidayGoals,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Creates suggested evidence-tracked holiday goals based on priorities.
 */
export function createDefaultHolidayGoals(
  priorities: HolidayPriority[],
  deadlineStr: string
): Goal[] {
  const goals: Goal[] = [];

  if (priorities.includes('dsa')) {
    goals.push({
      id: `hgoal-dsa-${Date.now()}`,
      title: 'Complete 40 LeetCode / DSA Problems',
      targetValue: 40,
      currentValue: 0,
      unit: 'problems',
      horizon: 'monthly',
      deadline: deadlineStr,
      status: 'active',
      createdAt: new Date().toISOString(),
      description: 'Solidify array, hash map, two pointer, and tree traversal algorithms.',
    });
  }

  if (priorities.includes('projects') || priorities.includes('web_dev') || priorities.includes('backend_dev')) {
    goals.push({
      id: `hgoal-proj-${Date.now()}`,
      title: 'Build & Deploy One Standout Portfolio Project',
      targetValue: 1,
      currentValue: 0,
      unit: 'project',
      horizon: 'monthly',
      deadline: deadlineStr,
      status: 'active',
      createdAt: new Date().toISOString(),
      description: 'Design, code, test, and ship a full-stack or systems software project.',
    });
  }

  if (priorities.includes('git_github')) {
    goals.push({
      id: `hgoal-git-${Date.now()}`,
      title: 'Master Git Workflow & Polish GitHub Profile',
      targetValue: 10,
      currentValue: 2,
      unit: 'commits/PRs',
      horizon: 'monthly',
      deadline: deadlineStr,
      status: 'active',
      createdAt: new Date().toISOString(),
      description: 'Create clean commit histories, pull requests, and descriptive READMEs.',
    });
  }

  if (priorities.includes('aiml')) {
    goals.push({
      id: `hgoal-aiml-${Date.now()}`,
      title: 'Complete Python & ML Fundamentals Notebooks',
      targetValue: 5,
      currentValue: 0,
      unit: 'notebooks',
      horizon: 'monthly',
      deadline: deadlineStr,
      status: 'active',
      createdAt: new Date().toISOString(),
      description: 'Implement key algorithms from scratch using NumPy and Scikit-learn.',
    });
  }

  if (goals.length === 0) {
    goals.push({
      id: `hgoal-rest-${Date.now()}`,
      title: 'Maintain Consistent Sleep Schedule & Rest Days',
      targetValue: 14,
      currentValue: 0,
      unit: 'rest days',
      horizon: 'monthly',
      deadline: deadlineStr,
      status: 'active',
      createdAt: new Date().toISOString(),
      description: 'Prioritize physical recovery, reading, and mental wellness before next semester.',
    });
  }

  return goals;
}
