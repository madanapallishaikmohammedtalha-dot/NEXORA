import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Sparkles, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Clock, 
  ShieldAlert, 
  CheckCircle2, 
  Circle, 
  Play, 
  AlertCircle,
  Zap,
  RotateCcw,
  MoveRight,
  Coffee,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowRight,
  SlidersHorizontal,
  BookmarkCheck,
  Sunrise,
  Edit2,
  RefreshCw,
  Compass,
  Target,
  Layers,
  HelpCircle
} from 'lucide-react';
import { 
  AppState, 
  MissionItem, 
  DailyMission, 
  MissionItemStatus,
  ActivityType,
  ActivityPriority,
  DailyCheckInInput,
  ProposedDailyMission
} from '../types';
import { 
  formatDateReadable, 
  timeToMinutes, 
  minutesToTime 
} from '../services/scheduler';
import { 
  deriveDayCapacity, 
  detectScheduleConflicts, 
  rescheduleTask,
  ConflictDetail
} from '../services/plannerEngine';
import { 
  generateAdaptiveDailyMission, 
  adaptMidDaySchedule,
  collectEligiblePlanCandidates,
  placeActivitiesIntoFlexibleWindows
} from '../services/adaptivePlanner';

interface DailyPlannerProps {
  state: AppState;
  onSaveMission: (mission: DailyMission) => void;
  onStartSessionForItem: (item: MissionItem) => void;
  onToggleItemStatus: (dateStr: string, itemId: string) => void;
}

export const DailyPlannerModule: React.FC<DailyPlannerProps> = ({
  state,
  onSaveMission,
  onStartSessionForItem,
  onToggleItemStatus,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('2026-09-21');
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(false);
  const [showTimelineDetails, setShowTimelineDetails] = useState<boolean>(false);

  // Check-In Modal State
  const [showCheckInModal, setShowCheckInModal] = useState<boolean>(false);
  const [checkInInput, setCheckInInput] = useState<DailyCheckInInput>({
    date: '2026-09-21',
    energyLevel: 'medium',
    tired: false,
    reachedHomeLate: false,
    lateArrivalMinutes: 45,
    hasUrgentAssignment: false,
    assignmentSubjectId: state.subjects[0]?.id || '',
    assignmentDetails: '',
    extraMinutes: 0,
    focusTopicOrSkill: '',
    customNote: '',
  });

  // Staged Proposed Mission (The Daily Mission Review Card state)
  const [stagedProposal, setStagedProposal] = useState<ProposedDailyMission | null>(null);

  // Inline Editing in Staged Proposal
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editMinutes, setEditMinutes] = useState<number>(45);
  const [editActivityType, setEditActivityType] = useState<ActivityType>('academic_study');

  // Replace Item Modal State
  const [replacingItemId, setReplacingItemId] = useState<string | null>(null);

  // Mid-Day Adaptation Modal State
  const [showRebalanceModal, setShowRebalanceModal] = useState<boolean>(false);
  const [rebalanceClockTime, setRebalanceClockTime] = useState<string>('16:30');
  const [rebalancePreview, setRebalancePreview] = useState<{
    revisedMission: DailyMission;
    droppedItems: MissionItem[];
    rebalancedItems: MissionItem[];
  } | null>(null);

  // Reschedule Modal
  const [reschedulingItem, setReschedulingItem] = useState<MissionItem | null>(null);
  const [targetRescheduleDate, setTargetRescheduleDate] = useState<string>('2026-09-22');
  const [targetRescheduleTime, setTargetRescheduleTime] = useState<string>('10:00');

  // Manual Item Form
  const [isAddingManual, setIsAddingManual] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubjectId, setNewSubjectId] = useState(state.subjects[0]?.id || '');
  const [newTopicId, setNewTopicId] = useState('');
  const [newMinutes, setNewMinutes] = useState(45);
  const [newScheduledTime, setNewScheduledTime] = useState('16:00');
  const [newActivityType, setNewActivityType] = useState<ActivityType>('academic_study');

  // Deterministic capacity calculations
  const capacity = useMemo(() => deriveDayCapacity(selectedDate, state), [selectedDate, state]);

  // Current active Daily Mission
  const currentMission: DailyMission = useMemo(() => {
    return state.missions[selectedDate] || {
      id: `m-${selectedDate}`,
      date: selectedDate,
      availableMinutes: capacity.netAvailableStudyMinutes,
      allocatedMinutes: 0,
      items: [],
    };
  }, [state.missions, selectedDate, capacity.netAvailableStudyMinutes]);

  // Conflict detection
  const conflicts: ConflictDetail[] = useMemo(() => {
    return detectScheduleConflicts(selectedDate, currentMission.items, state);
  }, [selectedDate, currentMission.items, state]);

  // Metrics
  const plannedVsActual = useMemo(() => {
    const studyItems = currentMission.items.filter((i) => !i.isBreak && i.status !== 'skipped' && i.status !== 'rescheduled');
    const planned = studyItems.reduce((acc, curr) => acc + (curr.plannedMinutes || 0), 0);
    const actual = studyItems.reduce((acc, curr) => acc + (curr.actualMinutes || 0), 0);
    const completedCount = studyItems.filter((i) => i.status === 'completed').length;
    const missedCount = studyItems.filter((i) => i.status === 'missed').length;

    return {
      plannedMinutes: planned,
      actualMinutes: actual,
      totalItems: studyItems.length,
      completedItems: completedCount,
      missedItems: missedCount,
      completionRate: studyItems.length > 0 ? Math.round((completedCount / studyItems.length) * 100) : 0,
      varianceMinutes: actual - planned,
    };
  }, [currentMission.items]);

  // -------------------------------------------------------------
  // Check-In & Adaptive Mission Generation
  // -------------------------------------------------------------
  const handleOpenCheckIn = () => {
    setCheckInInput((prev) => ({ ...prev, date: selectedDate }));
    setShowCheckInModal(true);
  };

  const handleGenerateAdaptivePlan = async (customCheckIn?: DailyCheckInInput) => {
    setIsLoadingPlan(true);
    setShowCheckInModal(false);

    try {
      const proposal = await generateAdaptiveDailyMission(
        selectedDate,
        state,
        customCheckIn || checkInInput
      );
      setStagedProposal(proposal);
    } catch (err) {
      console.error('Failed to generate adaptive daily mission:', err);
    } finally {
      setIsLoadingPlan(false);
    }
  };

  // -------------------------------------------------------------
  // Staged Proposal Actions (Review Card)
  // -------------------------------------------------------------
  const handleAcceptStagedProposal = () => {
    if (!stagedProposal) return;

    const mission: DailyMission = {
      id: currentMission.id || `m-${selectedDate}`,
      date: selectedDate,
      availableMinutes: stagedProposal.todayCapacityMinutes,
      allocatedMinutes: stagedProposal.usedCapacityMinutes,
      items: stagedProposal.items,
      aiProposalRationale: stagedProposal.rationale,
      checkIn: stagedProposal.checkIn,
      reflectionNotes: currentMission.reflectionNotes,
    };

    onSaveMission(mission);
    setStagedProposal(null);
  };

  const handleSkipStagedItem = (itemId: string) => {
    if (!stagedProposal) return;
    const remainingItems = stagedProposal.items.filter((i) => i.id !== itemId);
    const newUsedMinutes = remainingItems
      .filter((i) => !i.isBreak && i.status !== 'skipped' && i.status !== 'missed')
      .reduce((acc, curr) => acc + curr.plannedMinutes, 0);

    setStagedProposal({
      ...stagedProposal,
      items: remainingItems,
      usedCapacityMinutes: newUsedMinutes,
      freeCapacityMinutes: Math.max(0, stagedProposal.todayCapacityMinutes - newUsedMinutes),
    });
  };

  const handleSkipActiveItem = (itemId: string) => {
    const updated = currentMission.items.map((i) =>
      i.id === itemId
        ? {
            ...i,
            status: 'skipped' as MissionItemStatus,
            reason: i.reason ? `${i.reason} • Skipped by student` : 'Skipped by student; returned to curriculum pool.',
          }
        : i
    );
    const updatedMission: DailyMission = {
      ...currentMission,
      items: updated,
      allocatedMinutes: updated
        .filter((i) => !i.isBreak && i.status !== 'skipped' && i.status !== 'missed')
        .reduce((acc, curr) => acc + curr.plannedMinutes, 0),
    };
    onSaveMission(updatedMission);
  };

  const handleRemoveStagedItem = (itemId: string) => {
    if (!stagedProposal) return;
    const remainingItems = stagedProposal.items.filter((i) => i.id !== itemId);
    const newUsedMinutes = remainingItems
      .filter((i) => !i.isBreak && i.status !== 'skipped' && i.status !== 'missed')
      .reduce((acc, curr) => acc + curr.plannedMinutes, 0);

    setStagedProposal({
      ...stagedProposal,
      items: remainingItems,
      usedCapacityMinutes: newUsedMinutes,
      freeCapacityMinutes: Math.max(0, stagedProposal.todayCapacityMinutes - newUsedMinutes),
    });
  };

  const handleStartEditItem = (item: MissionItem) => {
    setEditingItemId(item.id);
    setEditTitle(item.title);
    setEditMinutes(item.plannedMinutes);
    setEditActivityType(item.activityType || 'academic_study');
  };

  const handleSaveEditItem = (itemId: string) => {
    if (!stagedProposal) return;
    const updated = stagedProposal.items.map((i) => {
      if (i.id === itemId) {
        const startMin = i.scheduledTime ? timeToMinutes(i.scheduledTime) : 960;
        return {
          ...i,
          title: editTitle,
          plannedMinutes: editMinutes,
          activityType: editActivityType,
          endTime: minutesToTime(startMin + editMinutes),
        };
      }
      return i;
    });

    const newUsedMinutes = updated
      .filter((i) => !i.isBreak && i.status !== 'skipped' && i.status !== 'missed')
      .reduce((acc, curr) => acc + curr.plannedMinutes, 0);

    setStagedProposal({
      ...stagedProposal,
      items: updated,
      usedCapacityMinutes: newUsedMinutes,
      freeCapacityMinutes: Math.max(0, stagedProposal.todayCapacityMinutes - newUsedMinutes),
    });
    setEditingItemId(null);
  };

  const handleReplaceStagedItem = (targetItemId: string, newCandidateTopicId: string) => {
    if (!stagedProposal) return;
    const replacementTopic = state.topics.find((t) => t.id === newCandidateTopicId);
    if (!replacementTopic) return;
    const sub = replacementTopic.subjectId ? state.subjects.find((s) => s.id === replacementTopic.subjectId) : undefined;

    const updated = stagedProposal.items.map((i) => {
      if (i.id === targetItemId) {
        return {
          ...i,
          topicId: replacementTopic.id,
          subjectId: replacementTopic.subjectId,
          title: `${sub ? sub.code + ': ' : ''}${replacementTopic.title}`,
          reason: `Replaced by student with ready topic: ${replacementTopic.title}`,
          objective: `Active recall and mastery of ${replacementTopic.title}.`,
        };
      }
      return i;
    });

    setStagedProposal({
      ...stagedProposal,
      items: updated,
    });
    setReplacingItemId(null);
  };

  // -------------------------------------------------------------
  // Mid-Day Adaptation ("Replan Remaining Day")
  // -------------------------------------------------------------
  const handleOpenRebalance = () => {
    const preview = adaptMidDaySchedule(selectedDate, state, rebalanceClockTime);
    setRebalancePreview(preview);
    setShowRebalanceModal(true);
  };

  const handleUpdateRebalanceTime = (time: string) => {
    setRebalanceClockTime(time);
    const preview = adaptMidDaySchedule(selectedDate, state, time);
    setRebalancePreview(preview);
  };

  const handleConfirmRebalance = () => {
    if (!rebalancePreview) return;
    onSaveMission(rebalancePreview.revisedMission);
    setShowRebalanceModal(false);
    setRebalancePreview(null);
  };

  // -------------------------------------------------------------
  // Reschedule & Missed Handlers
  // -------------------------------------------------------------
  const handleConfirmReschedule = () => {
    if (!reschedulingItem) return;

    const result = rescheduleTask(
      selectedDate,
      reschedulingItem.id,
      {
        targetDateStr: targetRescheduleDate,
        newScheduledTime: targetRescheduleTime || undefined,
      },
      state
    );

    onSaveMission(result.sourceMission);
    if (targetRescheduleDate !== selectedDate) {
      onSaveMission(result.targetMission);
    }
    setReschedulingItem(null);
  };

  const handleMarkAsMissed = (itemId: string) => {
    const updated = currentMission.items.map((i) =>
      i.id === itemId ? { ...i, status: 'missed' as MissionItemStatus, reason: 'Marked missed by student; returned to curriculum pool.' } : i
    );
    const updatedMission: DailyMission = {
      ...currentMission,
      items: updated,
      allocatedMinutes: updated
        .filter((i) => !i.isBreak && i.status !== 'skipped' && i.status !== 'missed')
        .reduce((acc, curr) => acc + curr.plannedMinutes, 0),
    };
    onSaveMission(updatedMission);
  };

  const handleDeleteItem = (itemId: string) => {
    const updated = currentMission.items.filter((i) => i.id !== itemId);
    const updatedMission: DailyMission = {
      ...currentMission,
      items: updated,
      allocatedMinutes: updated
        .filter((i) => !i.isBreak && i.status !== 'skipped' && i.status !== 'missed')
        .reduce((acc, curr) => acc + curr.plannedMinutes, 0),
    };
    onSaveMission(updatedMission);
  };

  // -------------------------------------------------------------
  // Manual Task Creation
  // -------------------------------------------------------------
  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const startMin = timeToMinutes(newScheduledTime);
    const endMin = startMin + newMinutes;

    const newItem: MissionItem = {
      id: `manual-${Date.now()}`,
      subjectId: newSubjectId || undefined,
      topicId: newTopicId || undefined,
      title: newTitle.trim(),
      plannedMinutes: newMinutes,
      actualMinutes: 0,
      status: 'pending',
      scheduledTime: newScheduledTime,
      endTime: minutesToTime(endMin),
      isAIRecorded: false,
      source: 'manual',
      activityType: newActivityType,
      priority: 'medium',
      reason: 'Manually scheduled by student.',
    };

    const updatedItems = [...currentMission.items, newItem].sort((a, b) => {
      const aTime = a.scheduledTime ? timeToMinutes(a.scheduledTime) : 9999;
      const bTime = b.scheduledTime ? timeToMinutes(b.scheduledTime) : 9999;
      return aTime - bTime;
    });

    const updatedMission: DailyMission = {
      ...currentMission,
      items: updatedItems,
      allocatedMinutes: updatedItems
        .filter((i) => !i.isBreak && i.status !== 'skipped' && i.status !== 'missed')
        .reduce((acc, curr) => acc + curr.plannedMinutes, 0),
    };

    onSaveMission(updatedMission);
    setNewTitle('');
    setIsAddingManual(false);
  };

  // Eligible topics for replacement modal
  const eligibleReplacementTopics = useMemo(() => {
    return collectEligiblePlanCandidates(state).filter((c) => c.prerequisitesMet);
  }, [state]);

  // Helper for activity badges
  const getActivityBadge = (type?: ActivityType) => {
    switch (type) {
      case 'college_work':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">College Work</span>;
      case 'dsa_practice':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">DSA Practice</span>;
      case 'career_learning':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">Career Skill</span>;
      case 'project_work':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">Project</span>;
      case 'revision':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">Revision</span>;
      case 'break':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">Rest Break</span>;
      case 'academic_study':
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/30">Academic Study</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* TOP HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Daily Planner & Mission Control
            </span>
            <span className="text-xs text-slate-400">• {formatDateReadable(selectedDate)}</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Today’s Mission
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Deterministic capacity modeling, sleep protection, and adaptive AI planning loop.
          </p>
        </div>

        {/* Date Selector & Primary Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            id="planner-date-picker"
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setStagedProposal(null);
            }}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
          />

          {/* Morning Check-In Button */}
          <button
            id="open-check-in-btn"
            onClick={handleOpenCheckIn}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-semibold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Sunrise className="w-4 h-4" />
            <span>Plan My Day</span>
          </button>

          {/* Mid-day Rebalance Button */}
          <button
            id="open-rebalance-btn"
            onClick={handleOpenRebalance}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
            title="Adapt schedule for remaining day"
          >
            <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
            <span>Replan Remaining</span>
          </button>
        </div>
      </div>

      {/* CONFLICT WARNING BANNER */}
      {conflicts.length > 0 && (
        <div 
          id="planner-conflict-banner"
          className="bg-rose-950/40 border border-rose-800/80 rounded-2xl p-4 space-y-2 text-rose-200"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Detected {conflicts.length} Deterministic Schedule Conflict{conflicts.length > 1 ? 's' : ''}:</span>
          </div>
          <div className="space-y-1.5 pl-6 text-xs text-rose-300/90">
            {conflicts.map((c, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-rose-400 font-bold">•</span>
                <span>{c.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CAPACITY & TIMELINE SUMMARY BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Net Study Capacity</div>
              <div className="text-xl font-black text-emerald-400">
                {(capacity.netAvailableStudyMinutes / 60).toFixed(1)}h
                <span className="text-xs font-normal text-slate-500 ml-1">({capacity.netAvailableStudyMinutes}m)</span>
              </div>
              <div className="text-[10px] text-slate-400">Fixed + sleep deducted</div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Planned Study</div>
              <div className="text-xl font-black text-indigo-400">
                {(plannedVsActual.plannedMinutes / 60).toFixed(1)}h
                <span className="text-xs font-normal text-slate-500 ml-1">({plannedVsActual.plannedMinutes}m)</span>
              </div>
              <div className="text-[10px] text-slate-400">
                {capacity.netAvailableStudyMinutes >= plannedVsActual.plannedMinutes ? (
                  <span className="text-emerald-400">Within safe limit</span>
                ) : (
                  <span className="text-rose-400 font-semibold">Exceeds limit</span>
                )}
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Completed Actual</div>
              <div className="text-xl font-black text-cyan-400">
                {(plannedVsActual.actualMinutes / 60).toFixed(1)}h
                <span className="text-xs font-normal text-slate-500 ml-1">({plannedVsActual.actualMinutes}m)</span>
              </div>
              <div className="text-[10px] text-slate-400">{plannedVsActual.completionRate}% completion rate</div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Fixed Campus Time</div>
              <div className="text-xl font-black text-amber-400">
                {(capacity.fixedCommitmentsMinutes / 60).toFixed(1)}h
              </div>
              <div className="text-[10px] text-slate-400">{capacity.fixedIntervals.length} protected blocks</div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => setShowTimelineDetails(!showTimelineDetails)}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700/80 transition-colors"
            >
              <span>{showTimelineDetails ? 'Hide Timeline Windows' : 'View Capacity Windows'}</span>
              {showTimelineDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expandable Flexible Intervals & Fixed Commitments Timeline */}
        {showTimelineDetails && (
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="text-xs font-semibold text-slate-300">
              Deterministic Schedule Segments for {selectedDate}:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Available Flexible Study Windows ({capacity.flexibleIntervals.length})</span>
                </div>
                <div className="space-y-1 text-xs text-slate-300">
                  {capacity.flexibleIntervals.map((iv, idx) => (
                    <div key={idx} className="flex justify-between py-1 border-b border-slate-900 last:border-0">
                      <span className="font-mono text-emerald-300">{minutesToTime(iv.start)} – {minutesToTime(iv.end)}</span>
                      <span className="text-slate-400">{iv.end - iv.start} mins free</span>
                    </div>
                  ))}
                  {capacity.flexibleIntervals.length === 0 && (
                    <div className="text-slate-500 py-1">No flexible windows available today.</div>
                  )}
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Protected Fixed Commitments & Transit</span>
                </div>
                <div className="space-y-1 text-xs text-slate-300">
                  {capacity.fixedIntervals.map((iv, idx) => (
                    <div key={idx} className="flex justify-between py-1 border-b border-slate-900 last:border-0">
                      <span>{iv.label || 'Commitment'}</span>
                      <span className="font-mono text-amber-300">{minutesToTime(iv.start)} – {minutesToTime(iv.end)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DAILY MISSION REVIEW CARD (When stagedProposal exists) */}
      {stagedProposal && (
        <div 
          id="daily-mission-review-card"
          className="bg-gradient-to-b from-indigo-950/60 to-slate-900 border-2 border-indigo-500/60 rounded-2xl p-6 shadow-xl space-y-5 animate-in fade-in duration-200"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-900/60 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-lg font-black text-white">Daily Mission Review Card</h3>
                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full font-semibold border border-indigo-500/30">
                  Staged for Review
                </span>
              </div>
              <p className="text-xs text-indigo-200/90 mt-1 max-w-2xl">
                {stagedProposal.rationale}
              </p>
            </div>

            {/* Capacity Stats */}
            <div className="flex items-center gap-4 bg-slate-900/80 p-2.5 rounded-xl border border-indigo-800/50">
              <div className="text-center">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Today's Capacity</div>
                <div className="text-sm font-bold text-white">{stagedProposal.todayCapacityMinutes}m</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Used</div>
                <div className="text-sm font-bold text-indigo-300">{stagedProposal.usedCapacityMinutes}m</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Free Buffer</div>
                <div className="text-sm font-bold text-emerald-400">{stagedProposal.freeCapacityMinutes}m</div>
              </div>
            </div>
          </div>

          {/* Staged Items List */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Recommended Learning Activities ({stagedProposal.items.filter((i) => !i.isBreak).length}):</span>
              <span className="text-[11px] text-slate-400 font-normal">Accept, edit, replace, remove, or skip any recommendation</span>
            </div>

            <div className="space-y-2.5">
              {stagedProposal.items.map((item, idx) => {
                const isEditing = editingItemId === item.id;
                // Calculate display number for non-break learning items
                const studyIdx = stagedProposal.items.slice(0, idx + 1).filter((i) => !i.isBreak).length;

                if (isEditing) {
                  return (
                    <div key={item.id} className="bg-slate-950 p-4 rounded-xl border border-indigo-500 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-slate-400 block mb-1">Title</label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Minutes</label>
                          <input
                            type="number"
                            value={editMinutes}
                            onChange={(e) => setEditMinutes(Number(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingItemId(null)}
                          className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditItem(item.id)}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border gap-3 ${
                      item.isBreak
                        ? 'bg-slate-950/40 border-slate-800/50 text-slate-400'
                        : 'bg-slate-950/80 border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      {!item.isBreak && (
                        <div className="w-6 h-6 rounded-full bg-indigo-900/60 border border-indigo-700/60 text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                          {studyIdx}
                        </div>
                      )}
                      <div className="font-mono text-xs text-indigo-400 font-semibold shrink-0 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
                        {item.scheduledTime || 'TBD'} – {item.endTime || 'TBD'}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">
                            {!item.isBreak ? `${studyIdx}. ${item.title}` : item.title}
                          </span>
                          {getActivityBadge(item.activityType)}
                          {item.priority === 'high' && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.2 rounded border border-amber-800/40">
                              HIGH
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-300">Duration: {item.plannedMinutes}m</span>
                          {item.reason && (
                            <>
                              <span>•</span>
                              <span>Reason: {item.reason}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Item controls: Edit, Replace, Skip, Remove */}
                    <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                      <span className="text-xs font-bold text-slate-300 mr-1.5">
                        {item.plannedMinutes}m
                      </span>

                      {!item.isBreak && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEditItem(item)}
                            className="px-2 py-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            title="Edit activity"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setReplacingItemId(item.id)}
                            className="px-2 py-1 text-slate-300 hover:text-cyan-300 hover:bg-slate-800 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            title="Replace topic with candidate"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Replace</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSkipStagedItem(item.id)}
                            className="px-2 py-1 text-amber-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            title="Skip this activity for today"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Skip</span>
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => handleRemoveStagedItem(item.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Remove from plan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Bar with Exact Prompt Buttons: ACCEPT PLAN, EDIT, REGENERATE, CANCEL */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-indigo-900/60">
            <button
              id="cancel-proposal-btn"
              type="button"
              onClick={() => setStagedProposal(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer uppercase tracking-wider"
            >
              [ CANCEL ]
            </button>

            <div className="flex items-center gap-2">
              <button
                id="edit-proposal-btn"
                type="button"
                onClick={() => {
                  const firstStudy = stagedProposal.items.find((i) => !i.isBreak);
                  if (firstStudy) handleStartEditItem(firstStudy);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer uppercase tracking-wider"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>[ EDIT ]</span>
              </button>

              <button
                id="regenerate-proposal-btn"
                type="button"
                onClick={() => handleGenerateAdaptivePlan()}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-700/60 text-xs font-bold rounded-xl transition-colors cursor-pointer uppercase tracking-wider"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>[ REGENERATE ]</span>
              </button>

              <button
                id="accept-mission-btn"
                type="button"
                onClick={handleAcceptStagedProposal}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl shadow-lg transition-all cursor-pointer uppercase tracking-wider"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>[ ACCEPT PLAN ]</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE DAILY MISSION LIST */}
      <div 
        id="active-mission-container"
        className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" />
              <span>Active Scheduled Mission</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentMission.items.length === 0
                ? 'No activities scheduled for this day yet.'
                : `${currentMission.items.length} items configured (${currentMission.allocatedMinutes}m total allocated study time).`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddingManual(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Task</span>
            </button>
          </div>
        </div>

        {/* Manual Add Form */}
        {isAddingManual && (
          <form
            onSubmit={handleAddManualItem}
            className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] text-slate-400 block mb-1">Task Title *</label>
                <input
                  type="text"
                  placeholder="e.g., Assignment Draft or DSA Practice"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Activity Type</label>
                <select
                  value={newActivityType}
                  onChange={(e) => setNewActivityType(e.target.value as ActivityType)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                >
                  <option value="academic_study">Academic Study</option>
                  <option value="college_work">College Work</option>
                  <option value="career_learning">Career Skill</option>
                  <option value="dsa_practice">DSA Practice</option>
                  <option value="project_work">Project Work</option>
                  <option value="revision">Revision</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Duration & Start</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={newMinutes}
                    onChange={(e) => setNewMinutes(Number(e.target.value))}
                    className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                    placeholder="Mins"
                  />
                  <input
                    type="time"
                    value={newScheduledTime}
                    onChange={(e) => setNewScheduledTime(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddingManual(false)}
                className="px-3 py-1 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
              >
                Add Task
              </button>
            </div>
          </form>
        )}

        {/* Empty State */}
        {currentMission.items.length === 0 && !stagedProposal && (
          <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 space-y-3">
            <Compass className="w-10 h-10 text-slate-600 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-300">No Mission Active Today</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Click "Plan My Day" to run the morning check-in and generate an adaptive study mission based on your real energy and capacity.
            </p>
            <button
              onClick={handleOpenCheckIn}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow"
            >
              <Sunrise className="w-3.5 h-3.5" />
              <span>Begin Morning Check-In</span>
            </button>
          </div>
        )}

        {/* Items List */}
        {currentMission.items.length > 0 && (
          <div className="space-y-2">
            {currentMission.items.map((item) => {
              const isDone = item.status === 'completed';
              const isMissed = item.status === 'missed';
              const isRescheduled = item.status === 'rescheduled';

              return (
                <div
                  key={item.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border gap-3 transition-colors ${
                    isDone
                      ? 'bg-emerald-950/20 border-emerald-900/40 text-slate-300'
                      : isMissed
                      ? 'bg-rose-950/20 border-rose-900/40 text-slate-400'
                      : isRescheduled
                      ? 'bg-amber-950/10 border-amber-900/30 text-slate-400'
                      : item.isBreak
                      ? 'bg-slate-950/40 border-slate-800/60 text-slate-400'
                      : 'bg-slate-950/70 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3">
                    {/* Status Checkbox */}
                    {!item.isBreak ? (
                      <button
                        onClick={() => onToggleItemStatus(selectedDate, item.id)}
                        className={`mt-0.5 sm:mt-0 p-1 rounded-lg transition-colors cursor-pointer ${
                          isDone ? 'text-emerald-400 bg-emerald-950' : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title={isDone ? 'Mark as pending' : 'Mark as completed'}
                      >
                        {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                      </button>
                    ) : (
                      <Coffee className="w-5 h-5 text-slate-500 shrink-0 mt-0.5 sm:mt-0" />
                    )}

                    <div className="font-mono text-xs text-indigo-400 shrink-0 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
                      {item.scheduledTime || 'TBD'} – {item.endTime || 'TBD'}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold text-sm ${isDone ? 'line-through text-slate-400' : 'text-white'}`}>
                          {item.title}
                        </span>
                        {getActivityBadge(item.activityType)}
                        {item.priority === 'high' && (
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.2 rounded border border-amber-800/40">
                            HIGH
                          </span>
                        )}
                        {isMissed && (
                          <span className="text-[10px] font-bold text-rose-400 bg-rose-950 px-2 py-0.2 rounded">
                            MISSED / IN POOL
                          </span>
                        )}
                        {item.status === 'skipped' && (
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-950 px-2 py-0.2 rounded border border-amber-800/40">
                            SKIPPED
                          </span>
                        )}
                        {isRescheduled && (
                          <span className="text-[10px] font-bold text-amber-400 bg-amber-950 px-2 py-0.2 rounded">
                            RESCHEDULED
                          </span>
                        )}
                      </div>

                      {item.reason && (
                        <div className="text-xs text-slate-400 leading-relaxed">
                          {item.reason}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                    <div className="text-right text-xs pr-2 font-mono">
                      {item.actualMinutes > 0 ? (
                        <span className="text-emerald-400 font-bold">{item.actualMinutes}m / </span>
                      ) : null}
                      <span className="text-slate-300 font-semibold">{item.plannedMinutes}m</span>
                    </div>

                    {!isDone && !isRescheduled && !item.isBreak && item.status !== 'skipped' && (
                      <button
                        onClick={() => onStartSessionForItem(item)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow"
                        title="Start active session timer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Focus</span>
                      </button>
                    )}

                    {!isDone && !isRescheduled && !item.isBreak && item.status !== 'skipped' && (
                      <button
                        onClick={() => handleSkipActiveItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Skip activity for today (returns to curriculum pool)"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setReschedulingItem(item);
                        setTargetRescheduleDate(selectedDate);
                        setTargetRescheduleTime(item.scheduledTime || '16:00');
                      }}
                      className="p-1.5 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Move or Reschedule"
                    >
                      <MoveRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Delete activity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CHECK-IN MODAL ("PLAN MY DAY") */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sunrise className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">Morning Check-In: Plan My Day</h3>
              </div>
              <button
                onClick={() => setShowCheckInModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Tell NEXORA about today’s reality. Your constraints will adjust recommendation priorities while preserving sleep and capacity limits.
            </p>

            {/* Quick Reality Preset Chips */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Quick Reality Presets
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCheckInInput((prev) => ({ ...prev, hasUrgentAssignment: !prev.hasUrgentAssignment }))}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    checkInInput.hasUrgentAssignment
                      ? 'bg-amber-600/30 text-amber-300 border-amber-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  📝 Assignment due tomorrow
                </button>

                <button
                  type="button"
                  onClick={() => setCheckInInput((prev) => ({ ...prev, reachedHomeLate: !prev.reachedHomeLate, lateArrivalMinutes: 45 }))}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    checkInInput.reachedHomeLate
                      ? 'bg-amber-600/30 text-amber-300 border-amber-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  🚌 Reached home late
                </button>

                <button
                  type="button"
                  onClick={() => setCheckInInput((prev) => ({ ...prev, hasCollegeWorkToday: prev.hasCollegeWorkToday === false ? true : false }))}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    checkInInput.hasCollegeWorkToday === false
                      ? 'bg-cyan-600/30 text-cyan-300 border-cyan-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  🎓 No college work today
                </button>

                <button
                  type="button"
                  onClick={() => setCheckInInput((prev) => ({ ...prev, tired: !prev.tired, energyLevel: !prev.tired ? 'low' : 'medium' }))}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    checkInInput.tired
                      ? 'bg-rose-600/30 text-rose-300 border-rose-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  😴 I feel tired
                </button>

                <button
                  type="button"
                  onClick={() => setCheckInInput((prev) => ({ ...prev, extraMinutes: prev.extraMinutes === 30 ? 0 : 30 }))}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    checkInInput.extraMinutes === 30
                      ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  ⏱️ 30 extra minutes
                </button>

                <button
                  type="button"
                  onClick={() => setCheckInInput((prev) => ({ ...prev, focusTopicOrSkill: prev.focusTopicOrSkill === 'Java' ? '' : 'Java' }))}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    checkInInput.focusTopicOrSkill === 'Java'
                      ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  ☕ Focus on Java
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {/* Energy Level & Tiredness */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">Today's Cognitive Energy</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['high', 'medium', 'low'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setCheckInInput((prev) => ({ ...prev, energyLevel: lvl, tired: lvl === 'low' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border capitalize transition-all cursor-pointer ${
                        checkInInput.energyLevel === lvl
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {lvl === 'high' && '⚡ High Flow'}
                      {lvl === 'medium' && '✨ Steady'}
                      {lvl === 'low' && '😴 Tired / Fatigued'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day Circumstances */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">Day Circumstances</label>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 p-2.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkInInput.hasUrgentAssignment}
                      onChange={(e) => setCheckInInput((prev) => ({ ...prev, hasUrgentAssignment: e.target.checked }))}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-white">I have an assignment due tomorrow</span>
                      <div className="text-slate-400 text-[11px]">Prioritizes college submission draft first</div>
                    </div>
                  </label>

                  {checkInInput.hasUrgentAssignment && (
                    <div className="pl-6 space-y-2 pt-1">
                      <input
                        type="text"
                        placeholder="Assignment title or subject..."
                        value={checkInInput.assignmentDetails || ''}
                        onChange={(e) => setCheckInInput((prev) => ({ ...prev, assignmentDetails: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-2.5 p-2.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkInInput.reachedHomeLate}
                      onChange={(e) => setCheckInInput((prev) => ({ ...prev, reachedHomeLate: e.target.checked }))}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-white">I reached home late today</span>
                      <div className="text-slate-400 text-[11px]">Offsets available study window start by 45 minutes</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkInInput.hasCollegeWorkToday === false}
                      onChange={(e) => setCheckInInput((prev) => ({ ...prev, hasCollegeWorkToday: e.target.checked ? false : true }))}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-white">I have no college work today</span>
                      <div className="text-slate-400 text-[11px]">Shifts all cognitive energy to career skills and projects</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Extra Time Buffer */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Extra Available Study Buffer (Minutes)
                </label>
                <div className="flex gap-2">
                  {[0, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setCheckInInput((prev) => ({ ...prev, extraMinutes: mins }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                        (checkInInput.extraMinutes || 0) === mins
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      {mins === 0 ? 'Standard' : `+${mins}m`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus Skill / Topic */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Specific Focus Today (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Java, Dynamic Programming, DBMS"
                  value={checkInInput.focusTopicOrSkill || ''}
                  onChange={(e) => setCheckInInput((prev) => ({ ...prev, focusTopicOrSkill: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="generate-adaptive-plan-btn"
                  onClick={() => handleGenerateAdaptivePlan()}
                  disabled={isLoadingPlan}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isLoadingPlan ? 'Analyzing...' : 'Generate Today’s Mission'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MID-DAY REBALANCE MODAL */}
      {showRebalanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white">Replan Remaining Day</h3>
              </div>
              <button
                onClick={() => setShowRebalanceModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Adapts your schedule to current clock time. Completed tasks are preserved. Unfeasible tasks return to the curriculum pool without creating late-night schedule debt.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Current Clock Time</label>
                <input
                  type="time"
                  value={rebalanceClockTime}
                  onChange={(e) => handleUpdateRebalanceTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              {rebalancePreview && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between font-semibold text-slate-300">
                    <span>Remaining Feasible Tasks:</span>
                    <span className="text-emerald-400">{rebalancePreview.rebalancedItems.length} items</span>
                  </div>
                  {rebalancePreview.droppedItems.length > 0 && (
                    <div className="bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40 text-rose-300 space-y-1">
                      <div className="font-bold">Returned to Planning Pool ({rebalancePreview.droppedItems.length}):</div>
                      {rebalancePreview.droppedItems.map((d, i) => (
                        <div key={i} className="text-[11px] text-rose-200">
                          • {d.title} (no feasible window before protected bedtime)
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRebalanceModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="confirm-replan-btn"
                  onClick={handleConfirmRebalance}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg cursor-pointer"
                >
                  Apply Adapted Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPLACE TOPIC CANDIDATE MODAL */}
      {replacingItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl text-slate-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-base text-white">Substitute Candidate Topic</h3>
              </div>
              <button
                onClick={() => setReplacingItemId(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Select an alternative candidate whose prerequisites are completed.
            </p>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {eligibleReplacementTopics.map((cand) => (
                <div
                  key={cand.id}
                  onClick={() => cand.topicId && handleReplaceStagedItem(replacingItemId, cand.topicId)}
                  className="p-3 bg-slate-950 hover:bg-slate-800/80 rounded-xl border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white text-xs">{cand.title}</span>
                    <span className="text-[10px] text-slate-400">{cand.recommendedMinutes}m</span>
                  </div>
                  <div className="text-[11px] text-slate-400">{cand.reason}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {reschedulingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MoveRight className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-white">Move / Reschedule Task</h3>
              </div>
              <button
                onClick={() => setReschedulingItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 bg-slate-800/60 p-3 rounded-xl">
              Rescheduling: <strong className="text-white">{reschedulingItem.title}</strong> ({reschedulingItem.plannedMinutes}m)
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Destination Date</label>
                <input
                  type="date"
                  value={targetRescheduleDate}
                  onChange={(e) => setTargetRescheduleDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">New Start Time</label>
                <input
                  type="time"
                  value={targetRescheduleTime}
                  onChange={(e) => setTargetRescheduleTime(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleMarkAsMissed(reschedulingItem.id);
                    setReschedulingItem(null);
                  }}
                  className="px-3 py-2 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Mark as Missed
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setReschedulingItem(null)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReschedule}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Confirm Move
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
