import {
  ActivityPriority,
  ActivitySource,
  ActivityType,
  AppState,
  DailyCheckInInput,
  DailyMission,
  MissionItem,
  MissionItemStatus,
  ProposedDailyMission,
  RoadmapTopic,
  StudySession,
  Subject,
} from '../types';
import {
  deriveDayCapacity,
  detectScheduleConflicts,
  subtractIntervals,
  TimeInterval,
} from './plannerEngine';
import { evaluatePrerequisites, MASTERY_THRESHOLD_COMPLETED } from './learningEngine';
import { computeWeeklySubjectHours, minutesToTime, timeToMinutes } from './scheduler';
import { aiService } from './ai/service';

export interface PlanCandidate {
  id: string;
  topicId?: string;
  subjectId?: string;
  title: string;
  domain: 'academic' | 'career' | 'project';
  activityType: ActivityType;
  priority: ActivityPriority;
  priorityScore: number;
  recommendedMinutes: number;
  reason: string;
  objective?: string;
  prerequisitesMet: boolean;
  masteryLevel: number;
}

export interface ValidationReport {
  isValid: boolean;
  sanitizedProposals: PlanCandidate[];
  rejections: string[];
  warnings: string[];
}

/**
 * 1. Collects and ranks eligible candidates across all academic subjects,
 * career skill paths, and projects. Strictly enforces prerequisite readiness.
 */
export function collectEligiblePlanCandidates(
  state: AppState,
  checkIn?: DailyCheckInInput
): PlanCandidate[] {
  const weeklyHours = computeWeeklySubjectHours(state);
  const candidates: PlanCandidate[] = [];

  // Map subjects for easy lookup
  const subjectMap = new Map<string, Subject>();
  state.subjects.forEach((s) => subjectMap.set(s.id, s));

  // Active user goals for alignment bonus (Factor 15)
  const activeGoals = (state.goals || []).filter((g) => g.status !== 'completed');

  // Identify weak topics from recent sessions (comprehension <= 2) (Factor 10 & 14)
  const weakTopicIds = new Set<string>();
  const recentSessions = state.sessions.slice(-10);
  recentSessions.forEach((s) => {
    if (s.topicId && s.comprehensionRating <= 2) {
      weakTopicIds.add(s.topicId);
    }
  });

  // 1. If check-in mentions urgent college work or assignment, create a candidate (Factor 13)
  if (checkIn?.hasUrgentAssignment && checkIn?.hasCollegeWorkToday !== false) {
    const sub = checkIn.assignmentSubjectId ? subjectMap.get(checkIn.assignmentSubjectId) : undefined;
    candidates.push({
      id: 'urgent-assignment-candidate',
      subjectId: sub?.id,
      title: checkIn.assignmentDetails || `Urgent: ${sub ? sub.code + ' ' : ''}Assignment & College Submission`,
      domain: 'academic',
      activityType: 'college_work',
      priority: 'high',
      priorityScore: 160, // Tops the list above all topic candidates
      recommendedMinutes: 45,
      reason: 'Urgent college assignment deadline indicated in today\'s check-in.',
      objective: 'Complete submission draft, review rubric requirements, and submit on portal.',
      prerequisitesMet: true,
      masteryLevel: 50,
    });
  }

  // 2. Iterate roadmap topics to generate learning candidates (Factors 7-15)
  state.topics.forEach((topic) => {
    const prereqEval = evaluatePrerequisites(topic, state.topics);
    const subject = topic.subjectId ? subjectMap.get(topic.subjectId) : undefined;

    // Prerequisite filtering: Locked topics cannot be scheduled unless explicitly overridden
    const isEligible = Boolean(prereqEval.prerequisitesMet || topic.isUserOverride);
    const mastery = topic.masteryLevel || 0;

    // Skip fully mastered topics (>90%) unless flagged as weak in recent sessions (due for revision)
    const isMastered = topic.status === 'completed' && mastery >= 90;
    if (isMastered && !weakTopicIds.has(topic.id)) {
      return;
    }

    // Determine domain & activity type
    let domain: 'academic' | 'career' | 'project' = 'academic';
    if (topic.domain === 'career' || topic.domain === 'project' || topic.domain === 'academic') {
      domain = topic.domain;
    } else if (topic.category?.toLowerCase().includes('career') || topic.category?.toLowerCase().includes('dsa')) {
      domain = 'career';
    }
    let activityType: ActivityType = 'academic_study';

    if (domain === 'career') {
      activityType = topic.category?.toLowerCase().includes('dsa') || topic.title.toLowerCase().includes('algorithm') || topic.title.toLowerCase().includes('data structures')
        ? 'dsa_practice'
        : 'career_learning';
    } else if (domain === 'project') {
      activityType = 'project_work';
    } else if (weakTopicIds.has(topic.id) || (mastery >= 50 && mastery < 80)) {
      activityType = 'revision';
    }

    // Pacing need for academic subjects (Factor 11)
    let subjectNeedHours = 0;
    if (subject) {
      const actualHours = (weeklyHours[subject.id]?.actualMinutes || 0) / 60;
      const targetHours = subject.targetWeeklyHours || 4;
      subjectNeedHours = Math.max(0, targetHours - actualHours);
    }

    // Recency factor (Factor 10 & 14)
    let recencyFactor = 50;
    let isOverdueSpacedRepetition = false;
    if (topic.lastStudiedAt) {
      const daysSince = Math.floor((Date.now() - new Date(topic.lastStudiedAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= 5) {
        recencyFactor = 85;
        if (mastery >= 40 && mastery < 90) {
          isOverdueSpacedRepetition = true;
        }
      } else if (daysSince >= 2) {
        recencyFactor = 65;
      } else {
        recencyFactor = 30;
      }
    } else {
      recencyFactor = 80; // Fresh unstudied topic ready for initial mastery
    }

    // Base Priority Score
    // Formula: 0.35 * (100 - mastery) + 0.35 * subjectDeficit + 0.20 * recency + 0.10 * weaknessBonus
    const masteryNeed = 100 - mastery;
    const subjectNeedScore = Math.min(100, Math.round(subjectNeedHours * 25));
    const weaknessBonus = weakTopicIds.has(topic.id) ? 30 : 0;

    let score = Math.round(0.35 * masteryNeed + 0.35 * subjectNeedScore + 0.20 * recencyFactor + weaknessBonus);

    // Factor 1: Current Semester State Bonus
    if (subject && state.activeSemesterId && subject.semesterId === state.activeSemesterId) {
      score += 15;
    }

    // Factor 9: In-Progress Topics Continuity Bonus
    const isInProgress = topic.status === 'in_progress' || (mastery > 0 && mastery < MASTERY_THRESHOLD_COMPLETED);
    if (isInProgress) {
      score += 15;
    }

    // Factor 10: Overdue Spaced Repetition Bonus
    if (isOverdueSpacedRepetition) {
      score += 20;
    }

    // Factor 12: Career-Learning Priorities Bonus
    if (domain === 'career' || activityType === 'career_learning' || activityType === 'dsa_practice') {
      if (state.profile?.careerInterests && state.profile.careerInterests.length > 0) {
        const matchesInterest = state.profile.careerInterests.some((interest) => {
          const interestLower = interest.toLowerCase();
          return (
            topic.title.toLowerCase().includes(interestLower) ||
            (topic.category && topic.category.toLowerCase().includes(interestLower)) ||
            (topic.domain && topic.domain.toLowerCase().includes(interestLower))
          );
        });
        if (matchesInterest) {
          score += 20;
        }
      }
      // If user indicated "no college work today", heavily prioritize career & coding
      if (checkIn?.hasCollegeWorkToday === false) {
        score += 25;
      }
    }

    // Factor 15: User Goals Alignment Bonus
    let alignedGoalTitle: string | undefined;
    const matchingGoal = activeGoals.find((g) => {
      if (topic.subjectId && g.subjectId === topic.subjectId) return true;
      const topicTitleLower = topic.title.toLowerCase();
      const goalTitleLower = g.title.toLowerCase();
      return goalTitleLower.includes(topicTitleLower) || topicTitleLower.includes(goalTitleLower);
    });
    if (matchingGoal) {
      score += 25;
      alignedGoalTitle = matchingGoal.title;
    }

    // Apply Check-in Modifiers
    if (checkIn?.focusTopicOrSkill) {
      const term = checkIn.focusTopicOrSkill.toLowerCase().trim();
      if (
        topic.title.toLowerCase().includes(term) ||
        (topic.category && topic.category.toLowerCase().includes(term)) ||
        (subject && subject.name.toLowerCase().includes(term)) ||
        (subject && subject.code.toLowerCase().includes(term))
      ) {
        score += 35; // Significant boost matching user's expressed intention
      }
    }

    if (checkIn?.tired && (activityType === 'project_work' || activityType === 'dsa_practice')) {
      score -= 15; // De-prioritize heavy coding when tired
    }

    // Realistic Session Sizing based on topic complexity & user energy
    let recommendedMins = 45;
    if (checkIn?.tired || checkIn?.energyLevel === 'low') {
      recommendedMins = 30; // Shorter cognitive bite when exhausted
    } else if (activityType === 'project_work') {
      recommendedMins = 60; // Deep work
    } else if (activityType === 'revision' || (topic.estimatedMinutes && topic.estimatedMinutes <= 30)) {
      recommendedMins = 30; // Focused recall
    } else if (topic.estimatedMinutes && topic.estimatedMinutes >= 60) {
      recommendedMins = 45; // Split large topics into 45m blocks
    }

    // Priority Tier
    let priority: ActivityPriority = 'medium';
    if (score >= 75) priority = 'high';
    else if (score <= 45) priority = 'low';

    // Rationale description
    const reasonParts: string[] = [];
    if (alignedGoalTitle) reasonParts.push(`Aligned with goal "${alignedGoalTitle}"`);
    if (weakTopicIds.has(topic.id)) reasonParts.push('Needs reinforcement after low recall rating');
    if (isOverdueSpacedRepetition) reasonParts.push('Overdue for spaced repetition');
    if (isInProgress) reasonParts.push('In-progress topic continuity');
    if (subject && subjectNeedHours > 0) reasonParts.push(`${subject.code} has ${subjectNeedHours.toFixed(1)}h weekly deficit`);
    if (mastery < MASTERY_THRESHOLD_COMPLETED) reasonParts.push(`Current mastery: ${mastery}%`);
    if (recencyFactor >= 80 && !isOverdueSpacedRepetition) reasonParts.push('Optimal for spaced repetition');

    const reason = reasonParts.join(' • ') || 'Foundational topic ready in curriculum';

    candidates.push({
      id: `cand-${topic.id}`,
      topicId: topic.id,
      subjectId: topic.subjectId,
      title: `${subject ? subject.code + ': ' : ''}${topic.title}`,
      domain,
      activityType,
      priority,
      priorityScore: score,
      recommendedMinutes: recommendedMins,
      reason,
      objective: `Master ${topic.title} through active recall, concept verification, and practice.`,
      prerequisitesMet: isEligible,
      masteryLevel: mastery,
    });
  });

  // Sort candidates: eligible first, then by priority score descending
  return candidates.sort((a, b) => {
    if (a.prerequisitesMet !== b.prerequisitesMet) {
      return a.prerequisitesMet ? -1 : 1;
    }
    return b.priorityScore - a.priorityScore;
  });
}

/**
 * Helper to skip an active mission item or return it to the planning pool.
 * Does not penalize user or stack schedule debt.
 */
export function skipMissionItem(
  dateStr: string,
  itemId: string,
  currentMission: DailyMission
): DailyMission {
  const updatedItems = currentMission.items.map((i) => {
    if (i.id === itemId) {
      return {
        ...i,
        status: 'skipped' as MissionItemStatus,
        reason: i.reason ? `${i.reason} • Skipped by student` : 'Skipped by student; returned to curriculum pool.',
      };
    }
    return i;
  });

  const allocatedMinutes = updatedItems
    .filter((i) => !i.isBreak && i.status !== 'skipped' && i.status !== 'missed')
    .reduce((acc, curr) => acc + (curr.plannedMinutes || 0), 0);

  return {
    ...currentMission,
    items: updatedItems,
    allocatedMinutes,
  };
}

/**
 * 2. Strictly validates AI or heuristic recommendations against deterministic constraints:
 * - Eliminates locked topics
 * - Enforces realistic session durations (20 to 90 mins)
 * - Guards against total capacity overshoots
 */
export function validateAIPlanRecommendations(
  rawProposals: any[],
  candidates: PlanCandidate[],
  maxSafeCapacityMinutes: number
): ValidationReport {
  const rejections: string[] = [];
  const warnings: string[] = [];
  const sanitizedProposals: PlanCandidate[] = [];

  const candidateMap = new Map<string, PlanCandidate>();
  candidates.forEach((c) => {
    if (c.topicId) candidateMap.set(c.topicId, c);
    candidateMap.set(c.id, c);
  });

  let cumulativeMinutes = 0;

  for (const raw of rawProposals) {
    let matchedCandidate: PlanCandidate | undefined;

    if (raw.topicId) {
      matchedCandidate = candidateMap.get(raw.topicId);
    }

    // If candidate found but has locked prerequisites, reject!
    if (matchedCandidate && !matchedCandidate.prerequisitesMet) {
      rejections.push(`Rejected "${raw.title || matchedCandidate.title}": Prerequisites are not completed.`);
      continue;
    }

    // Determine realistic session duration
    let plannedMinutes = Number(raw.plannedMinutes);
    if (isNaN(plannedMinutes) || plannedMinutes <= 0) {
      plannedMinutes = matchedCandidate?.recommendedMinutes || 45;
      warnings.push(`Fixed invalid duration for "${raw.title}": defaulted to ${plannedMinutes}m.`);
    }

    // Realistic session sizing clamp (20m minimum, 90m maximum)
    if (plannedMinutes < 20) {
      plannedMinutes = 20;
      warnings.push(`Clamped duration for "${raw.title}" to minimum viable focus window (20m).`);
    } else if (plannedMinutes > 90) {
      plannedMinutes = 90;
      warnings.push(`Capped duration for "${raw.title}" to max focus chunk (90m).`);
    }

    // Check capacity limit
    if (cumulativeMinutes + plannedMinutes > maxSafeCapacityMinutes) {
      const remainingSpace = maxSafeCapacityMinutes - cumulativeMinutes;
      if (remainingSpace >= 20) {
        plannedMinutes = remainingSpace;
        warnings.push(`Adjusted duration of "${raw.title}" to ${plannedMinutes}m to respect daily safe capacity.`);
      } else {
        rejections.push(`Omitted "${raw.title}": Would exceed safe daily cognitive budget.`);
        continue;
      }
    }

    cumulativeMinutes += plannedMinutes;

    const validated: PlanCandidate = {
      id: matchedCandidate?.id || `prop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      topicId: matchedCandidate?.topicId || raw.topicId,
      subjectId: matchedCandidate?.subjectId || raw.subjectId,
      title: raw.title || matchedCandidate?.title || 'Academic Study Session',
      domain: matchedCandidate?.domain || 'academic',
      activityType: (raw.activityType as ActivityType) || matchedCandidate?.activityType || 'academic_study',
      priority: (raw.priority as ActivityPriority) || matchedCandidate?.priority || 'medium',
      priorityScore: Number(raw.priorityScore) || matchedCandidate?.priorityScore || 80,
      recommendedMinutes: plannedMinutes,
      reason: raw.reason || matchedCandidate?.reason || 'Recommended learning activity for today',
      objective: raw.objective || matchedCandidate?.objective || 'Active learning and problem solving',
      prerequisitesMet: true,
      masteryLevel: matchedCandidate?.masteryLevel || 0,
    };

    sanitizedProposals.push(validated);
  }

  // If AI rejected everything or returned empty, pick top eligible candidates automatically
  if (sanitizedProposals.length === 0) {
    const readyCandidates = candidates.filter((c) => c.prerequisitesMet);
    let fallbackMinutes = 0;
    for (const c of readyCandidates) {
      if (fallbackMinutes + c.recommendedMinutes <= maxSafeCapacityMinutes) {
        sanitizedProposals.push(c);
        fallbackMinutes += c.recommendedMinutes;
      }
    }
  }

  return {
    isValid: sanitizedProposals.length > 0,
    sanitizedProposals,
    rejections,
    warnings,
  };
}

/**
 * 3. Places validated candidate tasks into deterministic available flexible windows,
 * adding cognitive breaks and calculating exact clock times.
 */
export function placeActivitiesIntoFlexibleWindows(
  dateStr: string,
  candidates: PlanCandidate[],
  flexibleIntervals: TimeInterval[],
  options: {
    includeBreaks?: boolean;
    breakMinutes?: number;
    source?: ActivitySource;
  } = {}
): {
  items: MissionItem[];
  totalStudyMinutes: number;
  totalBreakMinutes: number;
} {
  const includeBreaks = options.includeBreaks !== false;
  const breakMinutes = options.breakMinutes || 10;
  const source = options.source || 'ai';

  const scheduledItems: MissionItem[] = [];
  let totalStudyMinutes = 0;
  let totalBreakMinutes = 0;

  let candIdx = 0;

  for (const interval of flexibleIntervals) {
    let currentPointer = interval.start;

    while (currentPointer < interval.end && candIdx < candidates.length) {
      const remainingInterval = interval.end - currentPointer;
      if (remainingInterval < 20) {
        break; // Less than 20 min in this window, jump to next window
      }

      const cand = candidates[candIdx];
      let taskMinutes = cand.recommendedMinutes;

      // Realistic sizing clamp for this specific window
      if (taskMinutes > remainingInterval) {
        taskMinutes = remainingInterval >= 30 ? Math.floor(remainingInterval / 15) * 15 : remainingInterval;
      }

      const taskStart = currentPointer;
      const taskEnd = taskStart + taskMinutes;

      const missionItem: MissionItem = {
        id: `mi-${dateStr}-${cand.id}-${candIdx}`,
        topicId: cand.topicId,
        subjectId: cand.subjectId,
        title: cand.title,
        plannedMinutes: taskMinutes,
        actualMinutes: 0,
        status: 'pending',
        scheduledTime: minutesToTime(taskStart),
        endTime: minutesToTime(taskEnd),
        isAIRecorded: source === 'ai',
        source,
        activityType: cand.activityType,
        priority: cand.priority,
        priorityScore: cand.priorityScore,
        domain: cand.domain,
        reason: cand.reason,
        objective: cand.objective,
      };

      scheduledItems.push(missionItem);
      totalStudyMinutes += taskMinutes;
      currentPointer = taskEnd;
      candIdx++;

      // Insert break if window allows
      if (includeBreaks && currentPointer + breakMinutes <= interval.end && candIdx < candidates.length) {
        const breakStart = currentPointer;
        const breakEnd = currentPointer + breakMinutes;

        scheduledItems.push({
          id: `brk-${dateStr}-${breakStart}`,
          title: `☕ Cognitive Rest & Hydration (${breakMinutes}m)`,
          plannedMinutes: breakMinutes,
          actualMinutes: 0,
          status: 'pending',
          scheduledTime: minutesToTime(breakStart),
          endTime: minutesToTime(breakEnd),
          isAIRecorded: false,
          isBreak: true,
          source: 'system',
          activityType: 'break',
          priority: 'low',
          reason: 'Protects focus stamina and prevents cognitive burnout.',
        });

        totalBreakMinutes += breakMinutes;
        currentPointer = breakEnd;
      }
    }
  }

  // Sort chronologically
  scheduledItems.sort((a, b) => {
    const aTime = a.scheduledTime ? timeToMinutes(a.scheduledTime) : 9999;
    const bTime = b.scheduledTime ? timeToMinutes(b.scheduledTime) : 9999;
    return aTime - bTime;
  });

  return {
    items: scheduledItems,
    totalStudyMinutes,
    totalBreakMinutes,
  };
}

/**
 * 4. The Complete Mission Generation Pipeline:
 * - Calculates deterministic capacity
 * - Collects eligible candidates
 * - Requests structured AI proposals
 * - Validates AI recommendations
 * - Deterministically places tasks in valid windows with breaks
 * - Returns staged ProposedDailyMission for user review
 */
export async function generateAdaptiveDailyMission(
  dateStr: string,
  state: AppState,
  checkIn?: DailyCheckInInput
): Promise<ProposedDailyMission> {
  // Step 1: Calculate deterministic capacity
  const capacity = deriveDayCapacity(dateStr, state);

  // Apply check-in adjustments (e.g., late arrival)
  let adjustedFlexibleIntervals = [...capacity.flexibleIntervals];
  if (checkIn?.reachedHomeLate && checkIn.lateArrivalMinutes) {
    const lateOffset = checkIn.lateArrivalMinutes;
    adjustedFlexibleIntervals = adjustedFlexibleIntervals
      .map((iv) => ({
        ...iv,
        start: iv.start + lateOffset,
      }))
      .filter((iv) => iv.end - iv.start >= 20);
  }

  // Safe cognitive study budget (85% of net capacity)
  let safeCapacity = capacity.safeBudgetMinutes;
  if (checkIn?.extraMinutes) {
    safeCapacity = Math.min(capacity.dailyCapacityMaxMinutes, safeCapacity + checkIn.extraMinutes);
  }
  if (checkIn?.tired || checkIn?.energyLevel === 'low') {
    safeCapacity = Math.max(30, Math.floor(safeCapacity * 0.75)); // Gentle pacing
  }

  // Step 2: Collect eligible candidates
  const candidates = collectEligiblePlanCandidates(state, checkIn);
  const readyCandidates = candidates.filter((c) => c.prerequisitesMet);

  // Step 3: Construct structured AI prompt
  const fixedCommitmentsSummary = capacity.fixedIntervals.map((iv) => ({
    label: iv.label,
    start: minutesToTime(iv.start),
    end: minutesToTime(iv.end),
  }));

  const candidateSummary = readyCandidates.slice(0, 10).map((c) => ({
    topicId: c.topicId,
    title: c.title,
    domain: c.domain,
    activityType: c.activityType,
    masteryLevel: c.masteryLevel,
    recommendedMinutes: c.recommendedMinutes,
    priorityScore: c.priorityScore,
    reason: c.reason,
  }));

  const prompt = `You are the NEXORA Adaptive Daily Planning Engine.
You must recommend an optimal daily study mission respecting strict student constraints.

STUDENT CONSTRAINTS & CONTEXT:
- Target Date: ${dateStr}
- Safe Study Capacity: ${safeCapacity} minutes (DO NOT exceed this budget)
- Fixed commitments: ${JSON.stringify(fixedCommitmentsSummary)}
- Flexible study windows: ${JSON.stringify(adjustedFlexibleIntervals.map((iv) => `${minutesToTime(iv.start)} - ${minutesToTime(iv.end)}`))}
- Today's Check-in / Reality: ${JSON.stringify(checkIn || 'Standard productive day')}
- Eligible Ready Topics (prerequisites strictly verified):
${JSON.stringify(candidateSummary, null, 2)}

RULES:
1. Select 2 to 4 highest-leverage activities that sum to <= ${safeCapacity} minutes.
2. Only select from the provided Eligible Ready Topics or essential college assignments.
3. Realistic durations: 20-30m for quick recall/review, 45m for standard concepts, 60-90m for projects.
4. DO NOT assign clock times; the deterministic planner will calculate schedules.
5. Provide actionable rationale explaining why these activities form the best sequence today.`;

  const schemaDescription = `{
  "rationale": "Clear 1-2 sentence explanation of today's study strategy",
  "proposals": [
    {
      "topicId": "string (optional)",
      "title": "Actionable task title",
      "activityType": "academic_study | career_learning | dsa_practice | project_work | revision | college_work",
      "plannedMinutes": 45,
      "priority": "high | medium | low",
      "reason": "Why this is prioritized today",
      "objective": "Specific measurable study objective"
    }
  ]
}`;

  let rawAIResponse: { rationale: string; proposals: any[] } | null = null;

  try {
    const res = await aiService.generateStructuredJson<{ rationale: string; proposals: any[] }>(
      {
        prompt,
        schemaDescription,
        modelId: state.profile.aiModel || 'gemini-3.8-flash',
        credentials: { apiKey: state.profile.apiKey },
      },
      {
        allowFallbackToOffline: true,
        userApiKey: state.profile.apiKey,
        modelId: state.profile.aiModel,
      }
    );
    rawAIResponse = res.data;
  } catch (err: any) {
    console.warn('[AdaptivePlanner] AI generation failed or offline, falling back to deterministic heuristics:', err?.message);
  }

  // Step 4: Validate AI proposals (or fallback to top candidates)
  let validatedReport: ValidationReport;

  if (rawAIResponse && Array.isArray(rawAIResponse.proposals) && rawAIResponse.proposals.length > 0) {
    validatedReport = validateAIPlanRecommendations(rawAIResponse.proposals, candidates, safeCapacity);
  } else {
    // Pure deterministic fallback
    validatedReport = validateAIPlanRecommendations(
      readyCandidates.slice(0, 4).map((c) => ({
        topicId: c.topicId,
        title: c.title,
        activityType: c.activityType,
        plannedMinutes: c.recommendedMinutes,
        priority: c.priority,
        reason: c.reason,
        objective: c.objective,
      })),
      candidates,
      safeCapacity
    );
  }

  // Step 5: Deterministically place activities in flexible windows
  const placement = placeActivitiesIntoFlexibleWindows(
    dateStr,
    validatedReport.sanitizedProposals,
    adjustedFlexibleIntervals,
    {
      includeBreaks: true,
      breakMinutes: 10,
      source: rawAIResponse ? 'ai' : 'system',
    }
  );

  const rationale = rawAIResponse?.rationale ||
    `Deterministic planner scheduled ${placement.totalStudyMinutes}m of focused study across ${validatedReport.sanitizedProposals.length} high-leverage activities, respecting your ${capacity.netAvailableStudyMinutes}m daily capacity limit.`;

  return {
    date: dateStr,
    todayCapacityMinutes: capacity.netAvailableStudyMinutes,
    usedCapacityMinutes: placement.totalStudyMinutes,
    freeCapacityMinutes: Math.max(0, capacity.netAvailableStudyMinutes - placement.totalStudyMinutes),
    rationale,
    items: placement.items,
    checkIn,
  };
}

/**
 * 5. Mid-Day Adaptation ("Replan Remaining Day"):
 * Re-evaluates schedule at current clock time:
 * - Preserves completed/in-progress items
 * - Avoids schedule debt (does not blindly push unfinished items into the night)
 * - Returns unfinished past items to candidate pool
 * - Re-ranks remaining items into remaining available windows
 */
export function adaptMidDaySchedule(
  dateStr: string,
  state: AppState,
  currentClockTimeStr: string
): {
  revisedMission: DailyMission;
  droppedItems: MissionItem[];
  rebalancedItems: MissionItem[];
  conflicts: any[];
} {
  const currentMission = state.missions[dateStr];
  if (!currentMission || currentMission.items.length === 0) {
    return {
      revisedMission: {
        id: `m-${dateStr}`,
        date: dateStr,
        availableMinutes: 0,
        allocatedMinutes: 0,
        items: [],
      },
      droppedItems: [],
      rebalancedItems: [],
      conflicts: [],
    };
  }

  const currentMin = timeToMinutes(currentClockTimeStr);
  const capacity = deriveDayCapacity(dateStr, state);

  // 1. Separate completed/in-progress items (untouchable historical facts)
  const completedOrActive = currentMission.items.filter(
    (i) => i.status === 'completed' || i.status === 'in_progress' || (i.actualMinutes && i.actualMinutes > 0)
  );

  // 2. Identify unfinished items
  const unfinishedItems = currentMission.items.filter(
    (i) => (i.status === 'pending' || i.status === 'missed') && !i.isBreak && (!i.actualMinutes || i.actualMinutes === 0)
  );

  // 3. Find remaining flexible windows strictly AFTER currentMin
  const remainingWindows = capacity.flexibleIntervals
    .map((iv) => ({
      start: Math.max(iv.start, currentMin + 5), // 5 min transition buffer
      end: iv.end,
      type: iv.type,
      label: iv.label,
    }))
    .filter((iv) => iv.end - iv.start >= 20);

  // Remaining capacity calculation
  const remainingStudyCapacity = remainingWindows.reduce((acc, curr) => acc + (curr.end - curr.start), 0);
  const safeRemainingStudyBudget = Math.floor(remainingStudyCapacity * 0.85);

  const rebalancedScheduled: MissionItem[] = [...completedOrActive];
  const droppedItems: MissionItem[] = [];

  // Sort unfinished by priority score descending
  const sortedUnfinished = [...unfinishedItems].sort((a, b) => (b.priorityScore || 50) - (a.priorityScore || 50));

  let windowIdx = 0;
  let currentPointer = remainingWindows[0] ? remainingWindows[0].start : 1440;
  let allocatedRemainingMinutes = 0;

  for (const item of sortedUnfinished) {
    let placed = false;

    while (windowIdx < remainingWindows.length) {
      const win = remainingWindows[windowIdx];
      currentPointer = Math.max(currentPointer, win.start);

      // Check if we still have budget and space
      const availableInWindow = win.end - currentPointer;
      if (availableInWindow < 20 || allocatedRemainingMinutes + 20 > safeRemainingStudyBudget) {
        windowIdx++;
        if (windowIdx < remainingWindows.length) {
          currentPointer = remainingWindows[windowIdx].start;
        }
        continue;
      }

      let taskDuration = item.plannedMinutes;
      if (taskDuration > availableInWindow) {
        taskDuration = availableInWindow >= 30 ? Math.floor(availableInWindow / 15) * 15 : availableInWindow;
      }

      if (allocatedRemainingMinutes + taskDuration > safeRemainingStudyBudget) {
        taskDuration = safeRemainingStudyBudget - allocatedRemainingMinutes;
      }

      if (taskDuration >= 20) {
        const itemEnd = currentPointer + taskDuration;
        rebalancedScheduled.push({
          ...item,
          status: 'pending',
          scheduledTime: minutesToTime(currentPointer),
          endTime: minutesToTime(itemEnd),
          plannedMinutes: taskDuration,
          reason: item.reason ? `${item.reason} • Rescheduled at ${currentClockTimeStr}` : `Adapted at ${currentClockTimeStr}`,
        });

        allocatedRemainingMinutes += taskDuration;
        currentPointer = itemEnd + 10; // 10 min break buffer
        placed = true;
        break;
      } else {
        windowIdx++;
      }
    }

    if (!placed) {
      // Returned to planning pool without creating toxic schedule debt
      droppedItems.push({
        ...item,
        status: 'missed',
        reason: `Returned to curriculum planning pool during ${currentClockTimeStr} adaptation (insufficient evening capacity).`,
      });
      rebalancedScheduled.push({
        ...item,
        status: 'missed',
        reason: `Missed / returned to pool: no feasible window remaining before sleep.`,
      });
    }
  }

  // Sort rebalanced list chronologically
  rebalancedScheduled.sort((a, b) => {
    const aTime = a.scheduledTime ? timeToMinutes(a.scheduledTime) : 9999;
    const bTime = b.scheduledTime ? timeToMinutes(b.scheduledTime) : 9999;
    return aTime - bTime;
  });

  const conflicts = detectScheduleConflicts(dateStr, rebalancedScheduled, state);

  const revisedMission: DailyMission = {
    ...currentMission,
    items: rebalancedScheduled,
    allocatedMinutes: rebalancedScheduled
      .filter((i) => !i.isBreak && i.status !== 'skipped' && i.status !== 'missed')
      .reduce((acc, curr) => acc + curr.plannedMinutes, 0),
  };

  return {
    revisedMission,
    droppedItems,
    rebalancedItems: rebalancedScheduled.filter((i) => i.status === 'pending'),
    conflicts,
  };
}
