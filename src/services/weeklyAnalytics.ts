/**
 * NEXORA Weekly Analytics & Pattern Detection Engine
 * 
 * Computes deterministic statistics, transparent consistency score,
 * evidence-based learning patterns, deterministic insights, and next-week proposed priorities
 * strictly from real stored data (sessions, missions, topics, goals, timetable).
 */

import {
  AppState,
  ConsistencyScoreBreakdown,
  ConsistencyScoreFactor,
  DetectedLearningPattern,
  NextWeekProposedItem,
  RoadmapTopic,
  StudySession,
  WeeklyAnalyticsReport,
  WeeklyGoalProgress,
  WeeklySubjectBreakdown,
  WeeklyTopicMasteryChange,
} from '../types';

/**
 * Helper to compute the calendar Monday and Sunday (YYYY-MM-DD) for a given reference date
 */
export function getWeekBoundaries(referenceDateStr: string = '2026-09-21'): { start: string; end: string } {
  const d = new Date(referenceDateStr + 'T12:00:00Z');
  // Day: 0 = Sun, 1 = Mon, ..., 6 = Sat
  const day = d.getUTCDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const format = (date: Date) => date.toISOString().split('T')[0];
  return {
    start: format(monday),
    end: format(sunday),
  };
}

/**
 * Filter sessions strictly within a week boundary [start, end]
 */
export function getSessionsInWeek(sessions: StudySession[], start: string, end: string): StudySession[] {
  return sessions.filter((s) => {
    const sDate = s.date || (s.startTime ? s.startTime.split('T')[0] : '');
    return sDate >= start && sDate <= end;
  });
}

/**
 * Deterministically calculate the Weekly Analytics Report from real stored AppState data
 */
export function computeWeeklyAnalytics(
  state: AppState,
  referenceDateStr: string = '2026-09-21'
): WeeklyAnalyticsReport {
  const { start, end } = getWeekBoundaries(referenceDateStr);
  const weekSessions = getSessionsInWeek(state.sessions, start, end);

  // 1. Gather all mission items from missions in this week
  const weekMissionDates = Object.keys(state.missions).filter((date) => date >= start && date <= end);
  const weekMissionItems = weekMissionDates.flatMap((date) => state.missions[date]?.items || []);

  // Planned vs actual study minutes
  // Planned minutes from missions or sessions
  let plannedStudyMinutes = 0;
  let skippedSessionsCount = 0;
  let missedSessionsCount = 0;
  let rescheduledSessionsCount = 0;

  // Calculate from daily missions
  weekMissionItems.forEach((item) => {
    if (item.isBreak) return;
    plannedStudyMinutes += item.plannedMinutes || 0;
    if (item.status === 'skipped') skippedSessionsCount++;
    if (item.status === 'missed') missedSessionsCount++;
    if (item.status === 'rescheduled') rescheduledSessionsCount++;
  });

  // If there are sessions without corresponding mission items or if missions were not populated,
  // ensure planned minutes accounts for logged sessions
  let sessionPlannedMinutes = 0;
  let actualStudyMinutes = 0;
  let totalComprehension = 0;
  let totalEnergy = 0;

  weekSessions.forEach((s) => {
    sessionPlannedMinutes += s.plannedDurationMinutes || 0;
    actualStudyMinutes += s.actualDurationMinutes || 0;
    totalComprehension += s.comprehensionRating;
    totalEnergy += s.energyRating;
  });

  // If plannedStudyMinutes was 0 (e.g. sessions logged directly without mission items), fallback to session planned
  if (plannedStudyMinutes === 0 && sessionPlannedMinutes > 0) {
    plannedStudyMinutes = sessionPlannedMinutes;
  }

  const completedSessionsCount = weekSessions.length;
  const executionPercentage = plannedStudyMinutes > 0
    ? Math.round((actualStudyMinutes / plannedStudyMinutes) * 100)
    : actualStudyMinutes > 0 ? 100 : 0;

  const averageComprehension = completedSessionsCount > 0
    ? Number((totalComprehension / completedSessionsCount).toFixed(1))
    : 0;

  const averageEnergy = completedSessionsCount > 0
    ? Number((totalEnergy / completedSessionsCount).toFixed(1))
    : 0;

  // 2. Topics studied and completed
  const studiedTopicIds = new Set<string>();
  const studiedTopicRecords: Array<{ id: string; title: string; subjectCode: string }> = [];

  weekSessions.forEach((s) => {
    if (s.topicId) {
      studiedTopicIds.add(s.topicId);
    }
  });

  studiedTopicIds.forEach((tId) => {
    const topic = state.topics.find((t) => t.id === tId);
    const sub = topic ? state.subjects.find((s) => s.id === topic.subjectId) : undefined;
    if (topic) {
      studiedTopicRecords.push({
        id: topic.id,
        title: topic.title,
        subjectCode: sub?.code || 'GEN',
      });
    }
  });

  // Check how many of these studied topics are completed vs in_progress
  let topicsCompletedCount = 0;
  let topicsInProgressCount = 0;
  studiedTopicIds.forEach((tId) => {
    const topic = state.topics.find((t) => t.id === tId);
    if (topic) {
      if (topic.status === 'completed' || topic.masteryLevel >= 80) {
        topicsCompletedCount++;
      } else {
        topicsInProgressCount++;
      }
    }
  });

  // 3. Subject-level breakdown
  const subjectMap = new Map<string, WeeklySubjectBreakdown>();
  state.subjects.forEach((sub) => {
    subjectMap.set(sub.id, {
      subjectId: sub.id,
      code: sub.code,
      name: sub.name,
      color: sub.color,
      actualMinutes: 0,
      plannedMinutes: 0,
      targetWeeklyHours: sub.targetWeeklyHours,
      sessionsCount: 0,
      averageComprehension: 0,
      topicsStudied: [],
    });
  });

  // Allocate mission planned minutes to subjects
  weekMissionItems.forEach((item) => {
    if (item.subjectId && subjectMap.has(item.subjectId) && !item.isBreak) {
      subjectMap.get(item.subjectId)!.plannedMinutes += item.plannedMinutes || 0;
    }
  });

  // Allocate actual session minutes & ratings
  const subjectCompSum = new Map<string, number>();
  weekSessions.forEach((s) => {
    let breakdown = subjectMap.get(s.subjectId);
    if (!breakdown) {
      // General or unmapped subject
      breakdown = {
        subjectId: s.subjectId,
        code: 'GEN',
        name: 'General Learning',
        color: '#6366f1',
        actualMinutes: 0,
        plannedMinutes: 0,
        targetWeeklyHours: 0,
        sessionsCount: 0,
        averageComprehension: 0,
        topicsStudied: [],
      };
      subjectMap.set(s.subjectId, breakdown);
    }
    breakdown.actualMinutes += s.actualDurationMinutes;
    breakdown.sessionsCount += 1;
    subjectCompSum.set(s.subjectId, (subjectCompSum.get(s.subjectId) || 0) + s.comprehensionRating);

    if (s.topicId) {
      const top = state.topics.find((t) => t.id === s.topicId);
      if (top && !breakdown.topicsStudied.includes(top.title)) {
        breakdown.topicsStudied.push(top.title);
      }
    }
  });

  subjectMap.forEach((breakdown, subId) => {
    if (breakdown.sessionsCount > 0) {
      const sum = subjectCompSum.get(subId) || 0;
      breakdown.averageComprehension = Number((sum / breakdown.sessionsCount).toFixed(1));
    }
  });

  const subjectBreakdowns = Array.from(subjectMap.values());

  // 4. Time distribution by Category: Academic, Career, Project, Revision
  let academicMinutes = 0;
  let careerMinutes = 0;
  let projectMinutes = 0;
  let revisionMinutes = 0;

  weekSessions.forEach((s) => {
    const topic = s.topicId ? state.topics.find((t) => t.id === s.topicId) : undefined;
    const cat = topic?.category || 'academic';
    const domainLower = (topic?.domain || '').toLowerCase();
    const titleLower = (topic?.title || '').toLowerCase();

    if (cat === 'project' || domainLower.includes('project')) {
      projectMinutes += s.actualDurationMinutes;
    } else if (cat === 'career' || domainLower.includes('dsa') || domainLower.includes('career') || domainLower.includes('interview')) {
      careerMinutes += s.actualDurationMinutes;
    } else if (titleLower.includes('review') || titleLower.includes('revision')) {
      revisionMinutes += s.actualDurationMinutes;
    } else {
      academicMinutes += s.actualDurationMinutes;
    }
  });

  // Also check mission items for revision if logged that way
  weekMissionItems.forEach((m) => {
    if (m.activityType === 'revision' && m.status === 'completed' && m.actualMinutes) {
      // already counted in sessions if linked, otherwise keep as academic/revision
    }
  });

  // 5. Mastery changes for topics studied this week
  const masteryChanges: WeeklyTopicMasteryChange[] = [];
  studiedTopicIds.forEach((tId) => {
    const topic = state.topics.find((t) => t.id === tId);
    if (!topic) return;
    const sub = state.subjects.find((s) => s.id === topic.subjectId);
    // Find sessions for this topic in the week
    const topSessions = weekSessions.filter((s) => s.topicId === tId);
    const totalBoost = topSessions.reduce((acc, s) => acc + s.comprehensionRating * 5, 0);
    const currentMastery = topic.masteryLevel;
    const beforeMastery = Math.max(0, currentMastery - totalBoost);

    masteryChanges.push({
      topicId: topic.id,
      title: topic.title,
      subjectCode: sub?.code || 'GEN',
      beforeMastery,
      currentMastery,
      deltaMastery: currentMastery - beforeMastery,
      status: topic.status,
    });
  });

  // 6. Strongest vs Weakest Learning Areas
  // Based on actual minutes, target completion, and average comprehension
  const rankedSubjects = subjectBreakdowns
    .filter((sb) => sb.actualMinutes > 0 || sb.targetWeeklyHours > 0)
    .map((sb) => {
      const targetMins = sb.targetWeeklyHours * 60;
      const pacingRatio = targetMins > 0 ? Math.min(1.5, sb.actualMinutes / targetMins) : 1;
      const compScore = sb.averageComprehension > 0 ? sb.averageComprehension / 5 : 0.6;
      // Composite strength score (0 to 100)
      const compositeScore = Math.round((pacingRatio * 0.5 + compScore * 0.5) * 100);
      return {
        subjectCode: sb.code,
        name: sb.name,
        actualMinutes: sb.actualMinutes,
        score: compositeScore,
        comp: sb.averageComprehension,
      };
    })
    .sort((a, b) => b.score - a.score);

  const strongestAreas = rankedSubjects.slice(0, 2).map((s) => ({
    subjectCode: s.subjectCode,
    name: s.name,
    score: s.score,
    reason: `${Math.round(s.actualMinutes / 60 * 10) / 10}h studied with ${s.comp > 0 ? s.comp + '★ comprehension' : 'steady pace'}.`,
  }));

  const weakAreas = rankedSubjects
    .slice()
    .reverse()
    .filter((s) => s.score < 75 || s.comp < 3.5 || s.actualMinutes === 0)
    .slice(0, 2)
    .map((s) => ({
      subjectCode: s.subjectCode,
      name: s.name,
      score: s.score,
      reason: s.actualMinutes === 0
        ? `No study time logged this week against target.`
        : s.comp > 0 && s.comp < 3.5
        ? `Average comprehension was lower (${s.comp}★). Needs prerequisite reinforcement.`
        : `Behind weekly target hours pacing.`,
    }));

  // 7. Goal Progress tracking
  const goalsProgress: WeeklyGoalProgress[] = (state.goals || []).map((g) => {
    const pct = g.targetValue > 0 ? Math.min(100, Math.round((g.currentValue / g.targetValue) * 100)) : 0;
    return {
      goalId: g.id,
      title: g.title,
      horizon: g.horizon,
      currentValue: g.currentValue,
      targetValue: g.targetValue,
      unit: g.unit,
      progressPercentage: pct,
      isCompleted: g.status === 'completed' || pct >= 100,
    };
  });

  // 8. Deterministic Consistency Score Calculation
  const consistency = calculateTransparentConsistencyScore({
    completedSessionsCount,
    plannedStudyMinutes,
    actualStudyMinutes,
    weekSessions,
    goals: state.goals || [],
  });

  // 9. Deterministic Observations
  const deterministicObservations = generateDeterministicObservations({
    plannedMinutes: plannedStudyMinutes,
    actualMinutes: actualStudyMinutes,
    completedSessionsCount,
    skippedSessionsCount,
    missedSessionsCount,
    subjectBreakdowns,
    averageComprehension,
    masteryChanges,
    weekSessions,
    topics: state.topics,
  });

  // 10. Evidence-based Learning Pattern Detection
  const learningPatterns = detectLearningPatterns({
    plannedMinutes: plannedStudyMinutes,
    actualMinutes: actualStudyMinutes,
    weekSessions,
    weekMissionItems,
    subjectBreakdowns,
    topics: state.topics,
  });

  return {
    weekStartDate: start,
    weekEndDate: end,
    plannedStudyMinutes,
    actualStudyMinutes,
    executionPercentage,
    completedSessionsCount,
    skippedSessionsCount,
    missedSessionsCount,
    rescheduledSessionsCount,
    averageComprehension,
    averageEnergy,
    topicsStudiedCount: studiedTopicIds.size,
    topicsCompletedCount,
    topicsInProgressCount,
    topicsStudied: studiedTopicRecords,
    masteryChanges,
    strongestAreas,
    weakAreas,
    academicMinutes,
    careerMinutes,
    projectMinutes,
    revisionMinutes,
    subjectBreakdowns,
    goalsProgress,
    consistency,
    deterministicObservations,
    learningPatterns,
  };
}

/**
 * Transparent Consistency Score Engine
 * Components:
 * 1. Sessions Completed (max 30 pts)
 * 2. Planned vs Actual Execution Ratio (max 25 pts)
 * 3. Practice Completion (duration >= 30m) (max 20 pts)
 * 4. Assessment Participation (comprehension recorded >= 3★) (max 15 pts)
 * 5. Goal Progress (active goals moving forward) (max 10 pts)
 */
export function calculateTransparentConsistencyScore(params: {
  completedSessionsCount: number;
  plannedStudyMinutes: number;
  actualStudyMinutes: number;
  weekSessions: StudySession[];
  goals: AppState['goals'];
}): ConsistencyScoreBreakdown {
  const { completedSessionsCount, plannedStudyMinutes, actualStudyMinutes, weekSessions, goals } = params;

  // Factor 1: Sessions completed (up to 6 sessions for full 30 pts; 5 pts per session)
  const sessionPoints = Math.min(30, completedSessionsCount * 5);
  const factor1: ConsistencyScoreFactor = {
    factor: 'sessions_completed',
    label: 'Sessions Completed',
    earnedPoints: sessionPoints,
    maxPoints: 30,
    description: `${completedSessionsCount} focus sessions completed this week (5 pts each, max 30).`,
  };

  // Factor 2: Planned vs Actual execution ratio (max 25 pts)
  let executionPoints = 0;
  if (plannedStudyMinutes > 0) {
    const ratio = actualStudyMinutes / plannedStudyMinutes;
    if (ratio >= 0.8 && ratio <= 1.25) {
      executionPoints = 25; // In the sweet spot
    } else if (ratio >= 0.6) {
      executionPoints = 18;
    } else if (ratio >= 0.4) {
      executionPoints = 12;
    } else {
      executionPoints = Math.min(25, Math.round(ratio * 25));
    }
  } else if (actualStudyMinutes > 0) {
    executionPoints = 20;
  }
  const factor2: ConsistencyScoreFactor = {
    factor: 'execution_ratio',
    label: 'Planned vs Actual Execution',
    earnedPoints: executionPoints,
    maxPoints: 25,
    description: plannedStudyMinutes > 0
      ? `${Math.round((actualStudyMinutes / plannedStudyMinutes) * 100)}% execution of planned study budget.`
      : `${actualStudyMinutes} minutes of unbudgeted focus recorded.`,
  };

  // Factor 3: Practice Completion (sessions >= 30m deliberate practice) (max 20 pts)
  const practiceSessionsCount = weekSessions.filter((s) => s.actualDurationMinutes >= 30).length;
  const practicePoints = Math.min(20, practiceSessionsCount * 5);
  const factor3: ConsistencyScoreFactor = {
    factor: 'practice_completion',
    label: 'Deliberate Practice Blocks (≥30m)',
    earnedPoints: practicePoints,
    maxPoints: 20,
    description: `${practiceSessionsCount} sessions met or exceeded the 30-minute deliberate practice threshold.`,
  };

  // Factor 4: Assessment Participation (comprehension feedback >= 3★) (max 15 pts)
  const assessedSessionsCount = weekSessions.filter((s) => s.comprehensionRating >= 3).length;
  const assessmentPoints = completedSessionsCount > 0
    ? Math.min(15, Math.round((assessedSessionsCount / completedSessionsCount) * 15))
    : 0;
  const factor4: ConsistencyScoreFactor = {
    factor: 'assessment_participation',
    label: 'Reflective Assessment & Retention',
    earnedPoints: assessmentPoints,
    maxPoints: 15,
    description: `${assessedSessionsCount} of ${completedSessionsCount} sessions achieved comprehension ≥ 3★.`,
  };

  // Factor 5: Goal Progress (max 10 pts)
  const activeGoals = goals.filter((g) => g.status === 'active');
  const progressingGoals = activeGoals.filter((g) => g.currentValue > 0).length;
  const goalPoints = activeGoals.length > 0
    ? Math.min(10, Math.round((progressingGoals / activeGoals.length) * 10))
    : 8; // Neutral if no goals configured
  const factor5: ConsistencyScoreFactor = {
    factor: 'goal_progress',
    label: 'Milestone & Goal Momentum',
    earnedPoints: goalPoints,
    maxPoints: 10,
    description: activeGoals.length > 0
      ? `${progressingGoals} of ${activeGoals.length} active goals demonstrating forward progress.`
      : 'Baseline goal progress point allocation.',
  };

  const totalScore = Math.min(100, Math.max(0, sessionPoints + executionPoints + practicePoints + assessmentPoints + goalPoints));

  let summary = 'Steady baseline pacing with room for deliberate practice expansion.';
  if (totalScore >= 85) {
    summary = 'Outstanding weekly consistency! Superb execution across focus, practice, and cognitive reflection.';
  } else if (totalScore >= 70) {
    summary = 'Solid discipline and regular execution. Keep protecting your deep work windows.';
  } else if (totalScore < 50) {
    summary = 'Inconsistent schedule execution this week. Recommend reducing session sizes and protecting sleep buffers.';
  }

  return {
    score: totalScore,
    factors: [factor1, factor2, factor3, factor4, factor5],
    summary,
  };
}

/**
 * Deterministic Observations Generator
 * Produces factual, evidence-based sentences strictly from real metrics.
 */
export function generateDeterministicObservations(params: {
  plannedMinutes: number;
  actualMinutes: number;
  completedSessionsCount: number;
  skippedSessionsCount: number;
  missedSessionsCount: number;
  subjectBreakdowns: WeeklySubjectBreakdown[];
  averageComprehension: number;
  masteryChanges: WeeklyTopicMasteryChange[];
  weekSessions: StudySession[];
  topics: RoadmapTopic[];
}): string[] {
  const obs: string[] = [];

  // Observation 1: Planned vs Actual execution
  const plannedH = Math.floor(params.plannedMinutes / 60);
  const plannedM = params.plannedMinutes % 60;
  const actualH = Math.floor(params.actualMinutes / 60);
  const actualM = params.actualMinutes % 60;

  if (params.plannedMinutes > 0) {
    obs.push(`You planned ${plannedH}h ${plannedM > 0 ? plannedM + 'm' : ''} and completed ${actualH}h ${actualM > 0 ? actualM + 'm' : ''} of focused learning.`);
  } else if (params.actualMinutes > 0) {
    obs.push(`You completed ${actualH}h ${actualM > 0 ? actualM + 'm' : ''} of focused study sessions.`);
  }

  // Observation 2: Subject practice highlights
  params.subjectBreakdowns.forEach((sb) => {
    if (sb.actualMinutes >= 60) {
      const h = Math.floor(sb.actualMinutes / 60);
      const m = sb.actualMinutes % 60;
      obs.push(`${sb.name} (${sb.code}) received ${h}h ${m > 0 ? m + 'm' : ''} of dedicated focus.`);
    }
  });

  // Observation 3: Skipped / Missed sessions
  if (params.skippedSessionsCount > 0) {
    obs.push(`${params.skippedSessionsCount} planned session${params.skippedSessionsCount > 1 ? 's were' : ' was'} skipped this week.`);
  }
  if (params.missedSessionsCount > 0) {
    obs.push(`${params.missedSessionsCount} planned mission item${params.missedSessionsCount > 1 ? 's were' : ' was'} missed.`);
  }

  // Observation 4: Comprehension variances across subjects
  const subjectsWithComp = params.subjectBreakdowns.filter((sb) => sb.sessionsCount > 0 && sb.averageComprehension > 0);
  if (subjectsWithComp.length >= 2) {
    subjectsWithComp.sort((a, b) => a.averageComprehension - b.averageComprehension);
    const lowest = subjectsWithComp[0];
    const highest = subjectsWithComp[subjectsWithComp.length - 1];
    if (lowest.averageComprehension < 3.5 && highest.averageComprehension - lowest.averageComprehension >= 1.0) {
      obs.push(`Average comprehension was lower for ${lowest.name} (${lowest.averageComprehension}★ vs. ${highest.averageComprehension}★ for ${highest.name}).`);
    }
  }

  // Observation 5: Topics studied without completing assessment
  const lowCompTopics = params.weekSessions.filter((s) => s.comprehensionRating <= 2 && s.topicId);
  if (lowCompTopics.length > 0) {
    const firstLow = lowCompTopics[0];
    const top = params.topics.find((t) => t.id === firstLow.topicId);
    if (top) {
      obs.push(`You studied "${top.title}" with low comprehension (${firstLow.comprehensionRating}★); assessment has not yet been solidified.`);
    }
  }

  // Observation 6: Mastery advancements
  const completedThisWeek = params.masteryChanges.filter((m) => m.deltaMastery > 0 && m.currentMastery >= 80);
  if (completedThisWeek.length > 0) {
    obs.push(`Reached full mastery (≥80%) on ${completedThisWeek.length} topic${completedThisWeek.length > 1 ? 's' : ''}: ${completedThisWeek.map((t) => t.title).join(', ')}.`);
  }

  return obs;
}

/**
 * Learning Pattern Detection Engine
 * Evidence-based pattern detection with zero psycho-babble.
 */
export function detectLearningPatterns(params: {
  plannedMinutes: number;
  actualMinutes: number;
  weekSessions: StudySession[];
  weekMissionItems: any[];
  subjectBreakdowns: WeeklySubjectBreakdown[];
  topics: RoadmapTopic[];
}): DetectedLearningPattern[] {
  const patterns: DetectedLearningPattern[] = [];
  const { plannedMinutes, actualMinutes, weekSessions, weekMissionItems, subjectBreakdowns, topics } = params;

  // Pattern 1: Planned time consistently exceeds actual time
  if (plannedMinutes >= 120 && actualMinutes < plannedMinutes * 0.7) {
    patterns.push({
      id: 'pat-overplanning',
      type: 'planned_exceeds_actual',
      severity: 'warning',
      title: 'Planning Optimism Bias',
      description: 'Your planned study schedule exceeded actual logged execution by more than 30%.',
      evidence: `Planned ${Math.round(plannedMinutes / 60 * 10) / 10}h vs actual ${Math.round(actualMinutes / 60 * 10) / 10}h (execution ratio: ${Math.round((actualMinutes / plannedMinutes) * 100)}%).`,
    });
  }

  // Pattern 2: High study time but low comprehension / assessment performance
  const lowCompHighTime = weekSessions.filter((s) => s.actualDurationMinutes >= 45 && s.comprehensionRating <= 2);
  if (lowCompHighTime.length >= 1) {
    patterns.push({
      id: 'pat-high-time-low-comp',
      type: 'high_study_low_assessment',
      severity: 'warning',
      title: 'High Time Investment with Low Retention',
      description: 'Long study blocks recorded with low self-reported comprehension rating (≤2★).',
      evidence: `${lowCompHighTime.length} session(s) over 45 minutes ended with comprehension rating ≤ 2★. May indicate cognitive fatigue or missing foundational prerequisites.`,
    });
  }

  // Pattern 3: Repeated low comprehension
  const lowCompSessions = weekSessions.filter((s) => s.comprehensionRating <= 2);
  if (lowCompSessions.length >= 2) {
    patterns.push({
      id: 'pat-repeated-low-comp',
      type: 'repeated_low_comprehension',
      severity: 'warning',
      title: 'Repeated Conceptual Bottlenecks',
      description: 'Multiple sessions logged comprehension ratings at or below 2★.',
      evidence: `${lowCompSessions.length} sessions recorded low comprehension ratings. Foundational prerequisite review recommended.`,
    });
  }

  // Pattern 4: Frequent skipping of a category
  const skippedItems = weekMissionItems.filter((i) => i.status === 'skipped');
  if (skippedItems.length >= 2) {
    const skippedByType: Record<string, number> = {};
    skippedItems.forEach((i) => {
      const type = i.activityType || 'academic_study';
      skippedByType[type] = (skippedByType[type] || 0) + 1;
    });
    for (const [type, count] of Object.entries(skippedByType)) {
      if (count >= 2) {
        patterns.push({
          id: `pat-frequent-skip-${type}`,
          type: 'frequent_category_skipping',
          severity: 'warning',
          title: `Frequent Deferral of ${type.replace('_', ' ').toUpperCase()}`,
          description: `You skipped multiple scheduled items under ${type.replace('_', ' ')}.`,
          evidence: `${count} items in category "${type}" were marked as skipped in daily missions.`,
        });
      }
    }
  }

  // Pattern 5: Strong consistency in one subject
  const highConsistencySubject = subjectBreakdowns.find(
    (sb) => sb.targetWeeklyHours > 0 && sb.actualMinutes >= sb.targetWeeklyHours * 60 && sb.averageComprehension >= 4.0
  );
  if (highConsistencySubject) {
    patterns.push({
      id: `pat-strong-${highConsistencySubject.subjectId}`,
      type: 'strong_subject_consistency',
      severity: 'positive',
      title: `High Velocity in ${highConsistencySubject.name}`,
      description: `Target hours exceeded with high comprehension (≥4★).`,
      evidence: `Logged ${Math.round(highConsistencySubject.actualMinutes / 60 * 10) / 10}h (target: ${highConsistencySubject.targetWeeklyHours}h) with ${highConsistencySubject.averageComprehension}★ average comprehension.`,
    });
  }

  // Pattern 6: Topic repeatedly revisited without mastery
  const topicVisitCount: Record<string, number> = {};
  weekSessions.forEach((s) => {
    if (s.topicId) {
      topicVisitCount[s.topicId] = (topicVisitCount[s.topicId] || 0) + 1;
    }
  });

  for (const [tId, count] of Object.entries(topicVisitCount)) {
    if (count >= 2) {
      const top = topics.find((t) => t.id === tId);
      if (top && top.masteryLevel < 70) {
        patterns.push({
          id: `pat-stalled-${tId}`,
          type: 'topic_revisited_no_mastery',
          severity: 'info',
          title: `Plateau on "${top.title}"`,
          description: `Topic revisited multiple times (${count} sessions) but mastery remains below 70%.`,
          evidence: `Mastery currently at ${top.masteryLevel}%. Socratic breakdown or prerequisite inspection advised.`,
        });
      }
    }
  }

  // Pattern 7: Excessive tutorial time relative to practice
  const shortSessions = weekSessions.filter((s) => s.actualDurationMinutes < 25);
  if (weekSessions.length >= 4 && shortSessions.length >= weekSessions.length * 0.6) {
    patterns.push({
      id: 'pat-excessive-tutorial',
      type: 'excessive_tutorial_vs_practice',
      severity: 'info',
      title: 'Shallow Session Chunking',
      description: 'More than 60% of focus sessions were under 25 minutes.',
      evidence: `${shortSessions.length} of ${weekSessions.length} sessions were shorter than 25 minutes, which may limit deep deliberate problem-solving.`,
    });
  }

  // If no negative patterns detected and consistency is solid
  if (patterns.length === 0 && weekSessions.length > 0) {
    patterns.push({
      id: 'pat-balanced-pace',
      type: 'balanced_sustainable_pace',
      severity: 'positive',
      title: 'Balanced & Sustainable Rhythm',
      description: 'Study sessions and cognitive energy ratings indicate sustainable learning without severe bottlenecks.',
      evidence: `${weekSessions.length} focus sessions logged with steady progression.`,
    });
  }

  return patterns;
}

/**
 * Deterministically generate Proposed Next-Week Focus Items based on real data
 */
export function generateDeterministicNextWeekProposals(
  report: WeeklyAnalyticsReport,
  state: AppState
): NextWeekProposedItem[] {
  const items: NextWeekProposedItem[] = [];

  // 1. Weak learning areas or subjects lagging behind target
  report.weakAreas.forEach((w) => {
    const sub = state.subjects.find((s) => s.code === w.subjectCode || s.name === w.name);
    // Find ready or in-progress topic for this subject
    const subjectTopics = state.topics.filter((t) => t.subjectId === sub?.id && t.status !== 'completed' && t.status !== 'locked');
    const targetTopic = subjectTopics[0];

    items.push({
      id: `prop-weak-${w.subjectCode.toLowerCase()}`,
      subjectId: sub?.id,
      topicId: targetTopic?.id,
      subjectCode: w.subjectCode,
      title: targetTopic ? `${w.subjectCode}: ${targetTopic.title}` : `${w.name} Core Focus`,
      targetSessions: 3,
      estimatedMinutesPerSession: 45,
      reason: `Prioritized because ${w.name} fell behind weekly target hours (${w.reason}).`,
      priority: 'high',
      category: 'academic',
      status: 'accepted',
    });
  });

  // 2. High comprehension subjects needing advancement
  report.strongestAreas.forEach((s) => {
    const sub = state.subjects.find((item) => item.code === s.subjectCode);
    const readyTopics = state.topics.filter((t) => t.subjectId === sub?.id && t.status === 'ready');
    const targetTopic = readyTopics[0];

    if (items.length < 4 && sub) {
      items.push({
        id: `prop-strong-${s.subjectCode.toLowerCase()}`,
        subjectId: sub.id,
        topicId: targetTopic?.id,
        subjectCode: s.subjectCode,
        title: targetTopic ? `${s.subjectCode}: ${targetTopic.title}` : `${s.name} Advanced Progression`,
        targetSessions: 2,
        estimatedMinutesPerSession: 45,
        reason: `Build momentum from high comprehension (${s.score} composite score) to unlock downstream roadmap nodes.`,
        priority: 'medium',
        category: 'academic',
        status: 'accepted',
      });
    }
  });

  // 3. Career / DSA Practice if low this week
  if (report.careerMinutes < 90) {
    const dsaTopic = state.topics.find((t) => t.domain === 'DSA' || t.category === 'career');
    items.push({
      id: 'prop-dsa-career',
      topicId: dsaTopic?.id,
      subjectCode: 'DSA',
      title: 'Data Structures & Algorithmic Problem Solving',
      targetSessions: 2,
      estimatedMinutesPerSession: 45,
      reason: `Career/DSA received only ${Math.round(report.careerMinutes / 60 * 10) / 10}h this week. Maintain interview preparedness.`,
      priority: 'medium',
      category: 'career',
      status: 'accepted',
    });
  }

  // 4. Revision & Spaced Retrieval if topics were studied with low comprehension
  const { start, end } = getWeekBoundaries('2026-09-21');
  const weekSessions = getSessionsInWeek(state.sessions, start, end);
  const lowCompTopics = weekSessions.filter((s) => s.comprehensionRating <= 3 && s.topicId);
  if (lowCompTopics.length > 0 || report.revisionMinutes < 45) {
    items.push({
      id: 'prop-revision-consolidation',
      subjectCode: 'REV',
      title: 'Spaced Retrieval & Misconception Review',
      targetSessions: 2,
      estimatedMinutesPerSession: 30,
      reason: 'Solidify retention on topics explored this week before progressing to dependent nodes.',
      priority: 'medium',
      category: 'revision',
      status: 'accepted',
    });
  }

  // 5. Ensure at least 3 items
  if (items.length < 3) {
    const firstSubject = state.subjects[0];
    items.push({
      id: 'prop-academic-core',
      subjectId: firstSubject?.id,
      subjectCode: firstSubject?.code || 'CORE',
      title: `${firstSubject?.name || 'Core Curriculum'} Deep Work`,
      targetSessions: 2,
      estimatedMinutesPerSession: 45,
      reason: 'Scheduled foundation work for upcoming semester syllabus topics.',
      priority: 'low',
      category: 'academic',
      status: 'accepted',
    });
  }

  return items;
}
