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
  minutesToTime,
  getTodayDateString
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
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(false);
  const [showTimelineDetails, setShowTimelineDetails] = useState<boolean>(false);

  // Check-In Modal State
  const [showCheckInModal, setShowCheckInModal] = useState<boolean>(false);
  const [checkInInput, setCheckInInput] = useState<DailyCheckInInput>({
    date: getTodayDateString(),
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
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FFFBEB] text-[#A6630A] border border-[#FDE68A]">College Work</span>;
      case 'dsa_practice':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EEF0FF] text-[#5865D8] border border-[#5865D8]/20">DSA Practice</span>;
      case 'career_learning':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EEF0FF] text-[#5865D8] border border-[#5865D8]/20">Career Skill</span>;
      case 'project_work':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB]">Project</span>;
      case 'revision':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#ECFDF5] text-[#16845B] border border-[#A7F3D0]">Revision</span>;
      case 'break':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F5F6FA] text-[#667085] border border-[#E5E7EB]">Rest Break</span>;
      case 'academic_study':
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EEF0FF] text-[#5865D8] border border-[#5865D8]/20">Academic Study</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* TOP HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#5865D8]">
              Daily Planner & Mission Control
            </span>
            <span className="text-xs text-[#667085]">• {formatDateReadable(selectedDate)}</span>
          </div>
          <h2 className="text-2xl font-bold text-[#242938] tracking-tight">
            Today’s Mission
          </h2>
          <p className="text-xs text-[#667085] mt-1 max-w-xl">
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
            className="bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-[#242938] focus:outline-none focus:border-[#5865D8]"
          />

          {/* Morning Check-In Button */}
          <button
            id="open-check-in-btn"
            onClick={handleOpenCheckIn}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#5865D8] hover:bg-[#4854C4] text-white font-semibold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Sunrise className="w-4 h-4" />
            <span>Plan My Day</span>
          </button>

          {/* Mid-day Rebalance Button */}
          <button
            id="open-rebalance-btn"
            onClick={handleOpenRebalance}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
            title="Adapt schedule for remaining day"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#5865D8]" />
            <span>Replan Remaining</span>
          </button>
        </div>
      </div>

      {/* CONFLICT WARNING BANNER */}
      {conflicts.length > 0 && (
        <div 
          id="planner-conflict-banner"
          className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-4 space-y-2 text-[#C43D4B]"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-[#C43D4B]">
            <ShieldAlert className="w-4 h-4 text-[#C43D4B] shrink-0" />
            <span>Detected {conflicts.length} Deterministic Schedule Conflict{conflicts.length > 1 ? 's' : ''}:</span>
          </div>
          <div className="space-y-1.5 pl-6 text-xs text-[#C43D4B]/90">
            {conflicts.map((c, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-[#C43D4B] font-bold">•</span>
                <span>{c.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CAPACITY & TIMELINE SUMMARY BAR */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#F5F6FA] p-3 rounded-xl border border-[#E5E7EB]">
              <div className="text-[11px] text-[#667085] uppercase font-semibold">Net Study Capacity</div>
              <div className="text-xl font-bold text-[#16845B]">
                {(capacity.netAvailableStudyMinutes / 60).toFixed(1)}h
                <span className="text-xs font-normal text-[#667085] ml-1">({capacity.netAvailableStudyMinutes}m)</span>
              </div>
              <div className="text-[10px] text-[#667085]">Fixed + sleep deducted</div>
            </div>

            <div className="bg-[#F5F6FA] p-3 rounded-xl border border-[#E5E7EB]">
              <div className="text-[11px] text-[#667085] uppercase font-semibold">Planned Study</div>
              <div className="text-xl font-bold text-[#5865D8]">
                {(plannedVsActual.plannedMinutes / 60).toFixed(1)}h
                <span className="text-xs font-normal text-[#667085] ml-1">({plannedVsActual.plannedMinutes}m)</span>
              </div>
              <div className="text-[10px] text-[#667085]">
                {capacity.netAvailableStudyMinutes >= plannedVsActual.plannedMinutes ? (
                  <span className="text-[#16845B]">Within safe limit</span>
                ) : (
                  <span className="text-[#C43D4B] font-semibold">Exceeds limit</span>
                )}
              </div>
            </div>

            <div className="bg-[#F5F6FA] p-3 rounded-xl border border-[#E5E7EB]">
              <div className="text-[11px] text-[#667085] uppercase font-semibold">Completed Actual</div>
              <div className="text-xl font-bold text-[#242938]">
                {(plannedVsActual.actualMinutes / 60).toFixed(1)}h
                <span className="text-xs font-normal text-[#667085] ml-1">({plannedVsActual.actualMinutes}m)</span>
              </div>
              <div className="text-[10px] text-[#667085]">{plannedVsActual.completionRate}% completion rate</div>
            </div>

            <div className="bg-[#F5F6FA] p-3 rounded-xl border border-[#E5E7EB]">
              <div className="text-[11px] text-[#667085] uppercase font-semibold">Fixed Campus Time</div>
              <div className="text-xl font-bold text-[#A6630A]">
                {(capacity.fixedCommitmentsMinutes / 60).toFixed(1)}h
              </div>
              <div className="text-[10px] text-[#667085]">{capacity.fixedIntervals.length} protected blocks</div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => setShowTimelineDetails(!showTimelineDetails)}
              className="text-xs text-[#667085] hover:text-[#242938] flex items-center gap-1 px-3 py-2 rounded-lg bg-[#F5F6FA] hover:bg-[#E5E7EB] transition-colors border border-[#E5E7EB]"
            >
              <span>{showTimelineDetails ? 'Hide Timeline Windows' : 'View Capacity Windows'}</span>
              {showTimelineDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expandable Flexible Intervals & Fixed Commitments Timeline */}
        {showTimelineDetails && (
          <div className="pt-4 border-t border-[#E5E7EB] space-y-3">
            <div className="text-xs font-semibold text-[#242938]">
              Deterministic Schedule Segments for {selectedDate}:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-[#F5F6FA] p-3.5 rounded-xl border border-[#E5E7EB] space-y-2">
                <div className="text-xs font-bold text-[#16845B] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Available Flexible Study Windows ({capacity.flexibleIntervals.length})</span>
                </div>
                <div className="space-y-1 text-xs text-[#242938]">
                  {capacity.flexibleIntervals.map((iv, idx) => (
                    <div key={idx} className="flex justify-between py-1 border-b border-[#E5E7EB] last:border-0">
                      <span className="font-mono text-[#16845B]">{minutesToTime(iv.start)} – {minutesToTime(iv.end)}</span>
                      <span className="text-[#667085]">{iv.end - iv.start} mins free</span>
                    </div>
                  ))}
                  {capacity.flexibleIntervals.length === 0 && (
                    <div className="text-[#667085] py-1">No flexible windows available today.</div>
                  )}
                </div>
              </div>

              <div className="bg-[#F5F6FA] p-3.5 rounded-xl border border-[#E5E7EB] space-y-2">
                <div className="text-xs font-bold text-[#A6630A] flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Protected Fixed Commitments & Transit</span>
                </div>
                <div className="space-y-1 text-xs text-[#242938]">
                  {capacity.fixedIntervals.map((iv, idx) => (
                    <div key={idx} className="flex justify-between py-1 border-b border-[#E5E7EB] last:border-0">
                      <span>{iv.label || 'Commitment'}</span>
                      <span className="font-mono text-[#A6630A]">{minutesToTime(iv.start)} – {minutesToTime(iv.end)}</span>
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
          className="bg-white border-2 border-[#5865D8]/40 rounded-2xl p-6 shadow-sm space-y-5 animate-in fade-in duration-200"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#5865D8]" />
                <h3 className="text-lg font-bold text-[#242938]">Daily Mission Review Card</h3>
                <span className="text-xs bg-[#EEF0FF] text-[#5865D8] px-2.5 py-0.5 rounded-full font-semibold border border-[#5865D8]/20">
                  Staged for Review
                </span>
              </div>
              <p className="text-xs text-[#667085] mt-1 max-w-2xl">
                {stagedProposal.rationale}
              </p>
            </div>

            {/* Capacity Stats */}
            <div className="flex items-center gap-4 bg-[#F5F6FA] p-2.5 rounded-xl border border-[#E5E7EB]">
              <div className="text-center">
                <div className="text-[10px] text-[#667085] uppercase font-semibold">Today's Capacity</div>
                <div className="text-sm font-bold text-[#242938]">{stagedProposal.todayCapacityMinutes}m</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-[#667085] uppercase font-semibold">Used</div>
                <div className="text-sm font-bold text-[#5865D8]">{stagedProposal.usedCapacityMinutes}m</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-[#667085] uppercase font-semibold">Free Buffer</div>
                <div className="text-sm font-bold text-[#16845B]">{stagedProposal.freeCapacityMinutes}m</div>
              </div>
            </div>
          </div>

          {/* Staged Items List */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-[#242938] uppercase tracking-wider flex items-center justify-between">
              <span>Recommended Learning Activities ({stagedProposal.items.filter((i) => !i.isBreak).length}):</span>
              <span className="text-[11px] text-[#667085] font-normal">Accept, edit, replace, remove, or skip any recommendation</span>
            </div>

            <div className="space-y-2.5">
              {stagedProposal.items.map((item, idx) => {
                const isEditing = editingItemId === item.id;
                const studyIdx = stagedProposal.items.slice(0, idx + 1).filter((i) => !i.isBreak).length;

                if (isEditing) {
                  return (
                    <div key={item.id} className="bg-[#F5F6FA] p-4 rounded-xl border border-[#5865D8] space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-[#667085] block mb-1">Title</label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-xs text-[#242938] focus:border-[#5865D8] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#667085] block mb-1">Minutes</label>
                          <input
                            type="number"
                            value={editMinutes}
                            onChange={(e) => setEditMinutes(Number(e.target.value))}
                            className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-xs text-[#242938] focus:border-[#5865D8] focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingItemId(null)}
                          className="px-3 py-1 text-xs text-[#667085] hover:text-[#242938] cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEditItem(item.id)}
                          className="px-3 py-1 bg-[#5865D8] hover:bg-[#4854C4] text-white text-xs font-semibold rounded-lg cursor-pointer"
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
                        ? 'bg-[#F5F6FA] border-[#E5E7EB] text-[#667085]'
                        : 'bg-white border-[#E5E7EB] text-[#242938] shadow-xs'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      {!item.isBreak && (
                        <div className="w-6 h-6 rounded-full bg-[#EEF0FF] border border-[#5865D8]/20 text-[#5865D8] font-bold text-xs flex items-center justify-center shrink-0">
                          {studyIdx}
                        </div>
                      )}
                      <div className="font-mono text-xs text-[#5865D8] font-semibold shrink-0 bg-[#F5F6FA] px-2.5 py-1 rounded-md border border-[#E5E7EB]">
                        {item.scheduledTime || 'TBD'} – {item.endTime || 'TBD'}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#242938] text-sm">
                            {!item.isBreak ? `${studyIdx}. ${item.title}` : item.title}
                          </span>
                          {getActivityBadge(item.activityType)}
                          {item.priority === 'high' && (
                            <span className="text-[10px] font-bold text-[#A6630A] bg-[#FFFBEB] px-2 py-0.2 rounded border border-[#FDE68A]">
                              HIGH
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#667085] flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[#242938]">Duration: {item.plannedMinutes}m</span>
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
                    <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-[#E5E7EB]">
                      <span className="text-xs font-bold text-[#242938] mr-1.5">
                        {item.plannedMinutes}m
                      </span>

                      {!item.isBreak && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStartEditItem(item)}
                            className="px-2 py-1 text-[#667085] hover:text-[#242938] hover:bg-[#F5F6FA] rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            title="Edit activity"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setReplacingItemId(item.id)}
                            className="px-2 py-1 text-[#667085] hover:text-[#5865D8] hover:bg-[#F5F6FA] rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            title="Replace topic with candidate"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Replace</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSkipStagedItem(item.id)}
                            className="px-2 py-1 text-[#A6630A] hover:bg-[#FFFBEB] rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
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
                        className="p-1.5 text-[#667085] hover:text-[#C43D4B] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer"
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
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E5E7EB]">
            <button
              id="cancel-proposal-btn"
              type="button"
              onClick={() => setStagedProposal(null)}
              className="px-4 py-2 bg-white hover:bg-[#F5F6FA] text-[#667085] hover:text-[#242938] border border-[#E5E7EB] text-xs font-bold rounded-xl transition-colors cursor-pointer uppercase tracking-wider"
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
                className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] text-xs font-bold rounded-xl transition-colors cursor-pointer uppercase tracking-wider"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>[ EDIT ]</span>
              </button>

              <button
                id="regenerate-proposal-btn"
                type="button"
                onClick={() => handleGenerateAdaptivePlan()}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#EEF0FF] hover:bg-[#E0E4FC] text-[#5865D8] border border-[#5865D8]/30 text-xs font-bold rounded-xl transition-colors cursor-pointer uppercase tracking-wider"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>[ REGENERATE ]</span>
              </button>

              <button
                id="accept-mission-btn"
                type="button"
                onClick={handleAcceptStagedProposal}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#5865D8] hover:bg-[#4854C4] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer uppercase tracking-wider"
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
        className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-base text-[#242938] flex items-center gap-2">
              <Target className="w-4 h-4 text-[#5865D8]" />
              <span>Active Scheduled Mission</span>
            </h3>
            <p className="text-xs text-[#667085] mt-0.5">
              {currentMission.items.length === 0
                ? 'No activities scheduled for this day yet.'
                : `${currentMission.items.length} items configured (${currentMission.allocatedMinutes}m total allocated study time).`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddingManual(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
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
            className="bg-[#F5F6FA] p-4 rounded-xl border border-[#E5E7EB] space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] text-[#667085] block mb-1">Task Title *</label>
                <input
                  type="text"
                  placeholder="e.g., Assignment Draft or DSA Practice"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-xs text-[#242938] focus:border-[#5865D8] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] text-[#667085] block mb-1">Activity Type</label>
                <select
                  value={newActivityType}
                  onChange={(e) => setNewActivityType(e.target.value as ActivityType)}
                  className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-xs text-[#242938] focus:border-[#5865D8] focus:outline-none"
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
                <label className="text-[10px] text-[#667085] block mb-1">Duration & Start</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={newMinutes}
                    onChange={(e) => setNewMinutes(Number(e.target.value))}
                    className="w-16 bg-white border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs text-[#242938] focus:border-[#5865D8] focus:outline-none"
                    placeholder="Mins"
                  />
                  <input
                    type="time"
                    value={newScheduledTime}
                    onChange={(e) => setNewScheduledTime(e.target.value)}
                    className="flex-1 bg-white border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs text-[#242938] focus:border-[#5865D8] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddingManual(false)}
                className="px-3 py-1 text-xs text-[#667085] hover:text-[#242938] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Add Task
              </button>
            </div>
          </form>
        )}

        {/* Empty State */}
        {currentMission.items.length === 0 && !stagedProposal && (
          <div className="text-center py-12 bg-[#F5F6FA] rounded-xl border border-dashed border-[#E5E7EB] space-y-3">
            <Compass className="w-10 h-10 text-[#667085] mx-auto opacity-50" />
            <h4 className="text-sm font-semibold text-[#242938]">No Mission Active Today</h4>
            <p className="text-xs text-[#667085] max-w-sm mx-auto">
              Click "Plan My Day" to run the morning check-in and generate an adaptive study mission based on your real energy and capacity.
            </p>
            <button
              onClick={handleOpenCheckIn}
              className="px-4 py-2 bg-[#5865D8] hover:bg-[#4854C4] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
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
                      ? 'bg-[#F5F6FA] border-[#E5E7EB] text-[#667085]'
                      : isMissed
                      ? 'bg-[#FEF2F2] border-[#FECACA] text-[#C43D4B]'
                      : isRescheduled
                      ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#A6630A]'
                      : item.isBreak
                      ? 'bg-[#F5F6FA] border-[#E5E7EB] text-[#667085]'
                      : 'bg-white border-[#E5E7EB] text-[#242938] shadow-xs'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3">
                    {/* Status Checkbox */}
                    {!item.isBreak ? (
                      <button
                        onClick={() => onToggleItemStatus(selectedDate, item.id)}
                        className={`mt-0.5 sm:mt-0 p-1 rounded-lg transition-colors cursor-pointer ${
                          isDone ? 'text-[#16845B]' : 'text-[#667085] hover:text-[#242938]'
                        }`}
                        title={isDone ? 'Mark as pending' : 'Mark as completed'}
                      >
                        {isDone ? <CheckCircle2 className="w-5 h-5 text-[#16845B]" /> : <Circle className="w-5 h-5 text-[#667085]" />}
                      </button>
                    ) : (
                      <Coffee className="w-5 h-5 text-[#667085] shrink-0 mt-0.5 sm:mt-0" />
                    )}

                    <div className="font-mono text-xs text-[#5865D8] shrink-0 bg-[#F5F6FA] px-2.5 py-1 rounded-md border border-[#E5E7EB]">
                      {item.scheduledTime || 'TBD'} – {item.endTime || 'TBD'}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold text-sm ${isDone ? 'line-through text-[#667085]' : 'text-[#242938]'}`}>
                          {item.title}
                        </span>
                        {getActivityBadge(item.activityType)}
                        {item.priority === 'high' && (
                          <span className="text-[10px] font-bold text-[#A6630A] bg-[#FFFBEB] px-2 py-0.2 rounded border border-[#FDE68A]">
                            HIGH
                          </span>
                        )}
                        {isMissed && (
                          <span className="text-[10px] font-bold text-[#C43D4B] bg-[#FEF2F2] px-2 py-0.2 rounded border border-[#FECACA]">
                            MISSED / IN POOL
                          </span>
                        )}
                        {item.status === 'skipped' && (
                          <span className="text-[10px] font-bold text-[#A6630A] bg-[#FFFBEB] px-2 py-0.2 rounded border border-[#FDE68A]">
                            SKIPPED
                          </span>
                        )}
                        {isRescheduled && (
                          <span className="text-[10px] font-bold text-[#A6630A] bg-[#FFFBEB] px-2 py-0.2 rounded border border-[#FDE68A]">
                            RESCHEDULED
                          </span>
                        )}
                      </div>

                      {item.reason && (
                        <div className="text-xs text-[#667085] leading-relaxed">
                          {item.reason}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-[#E5E7EB]">
                    <div className="text-right text-xs pr-2 font-mono">
                      {item.actualMinutes > 0 ? (
                        <span className="text-[#16845B] font-bold">{item.actualMinutes}m / </span>
                      ) : null}
                      <span className="text-[#667085] font-semibold">{item.plannedMinutes}m</span>
                    </div>

                    {!isDone && !isRescheduled && !item.isBreak && item.status !== 'skipped' && (
                      <button
                        onClick={() => onStartSessionForItem(item)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                        title="Start active session timer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Focus</span>
                      </button>
                    )}

                    {!isDone && !isRescheduled && !item.isBreak && item.status !== 'skipped' && (
                      <button
                        onClick={() => handleSkipActiveItem(item.id)}
                        className="p-1.5 text-[#667085] hover:text-[#A6630A] rounded hover:bg-[#FFFBEB] transition-colors cursor-pointer"
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
                      className="p-1.5 text-[#667085] hover:text-[#5865D8] rounded hover:bg-[#EEF0FF] transition-colors cursor-pointer"
                      title="Move or Reschedule"
                    >
                      <MoveRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-[#667085] hover:text-[#C43D4B] rounded hover:bg-[#FEF2F2] transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl text-[#242938] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <div className="flex items-center gap-2">
                <Sunrise className="w-5 h-5 text-[#5865D8]" />
                <h3 className="font-bold text-base text-[#242938]">Morning Check-In: Plan My Day</h3>
              </div>
              <button
                onClick={() => setShowCheckInModal(false)}
                className="text-[#667085] hover:text-[#242938]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#667085]">
              Tell NEXORA about today’s reality. Your constraints will adjust recommendation priorities while preserving sleep and capacity limits.
            </p>

            {/* Quick Reality Preset Chips */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#667085]">
                Quick Reality Presets
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setCheckInInput((prev) => ({ ...prev, hasUrgentAssignment: !prev.hasUrgentAssignment }))}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    checkInInput.hasUrgentAssignment
                      ? 'bg-[#FFFBEB] text-[#A6630A] border-[#FDE68A]'
                      : 'bg-white text-[#667085] border-[#E5E7EB] hover:border-[#5865D8]'
                  }`}
                >
                  📝 Assignment due tomorrow
                </button>

                <button
                  type="button"
                  onClick={() => setCheckInInput((prev) => ({ ...prev, reachedHomeLate: !prev.reachedHomeLate, lateArrivalMinutes: 45 }))}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    checkInInput.reachedHomeLate
                      ? 'bg-[#FFFBEB] text-[#A6630A] border-[#FDE68A]'
                      : 'bg-white text-[#667085] border-[#E5E7EB] hover:border-[#5865D8]'
                  }`}
                >
                  🚌 Reached home late
                </button>

                <button
                  type="button"
                  onClick={() => setCheckInInput((prev) => ({ ...prev, hasCollegeWorkToday: prev.hasCollegeWorkToday === false ? true : false }))}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    checkInInput.hasCollegeWorkToday === false
                      ? 'bg-[#EEF0FF] text-[#5865D8] border-[#5865D8]/30'
                      : 'bg-white text-[#667085] border-[#E5E7EB] hover:border-[#5865D8]'
                  }`}
                >
                  🎓 No college work today
                </button>

                <button
                  type="button"
                  onClick={() => setCheckInInput((prev) => ({ ...prev, tired: !prev.tired, energyLevel: !prev.tired ? 'low' : 'medium' }))}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    checkInInput.tired
                      ? 'bg-[#FEF2F2] text-[#C43D4B] border-[#FECACA]'
                      : 'bg-white text-[#667085] border-[#E5E7EB] hover:border-[#5865D8]'
                  }`}
                >
                  😴 I feel tired
                </button>

                <button
                  type="button"
                  onClick={() => setCheckInInput((prev) => ({ ...prev, extraMinutes: prev.extraMinutes === 30 ? 0 : 30 }))}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    checkInInput.extraMinutes === 30
                      ? 'bg-[#ECFDF5] text-[#16845B] border-[#A7F3D0]'
                      : 'bg-white text-[#667085] border-[#E5E7EB] hover:border-[#5865D8]'
                  }`}
                >
                  ⏱️ 30 extra minutes
                </button>

                <button
                  type="button"
                  onClick={() => setCheckInInput((prev) => ({ ...prev, focusTopicOrSkill: prev.focusTopicOrSkill === 'Java' ? '' : 'Java' }))}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    checkInInput.focusTopicOrSkill === 'Java'
                      ? 'bg-[#EEF0FF] text-[#5865D8] border-[#5865D8]/30'
                      : 'bg-white text-[#667085] border-[#E5E7EB] hover:border-[#5865D8]'
                  }`}
                >
                  ☕ Focus on Java
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {/* Energy Level & Tiredness */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#242938]">Today's Cognitive Energy</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['high', 'medium', 'low'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setCheckInInput((prev) => ({ ...prev, energyLevel: lvl, tired: lvl === 'low' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border capitalize transition-all cursor-pointer ${
                        checkInInput.energyLevel === lvl
                          ? 'bg-[#5865D8] text-white border-[#5865D8] shadow-xs'
                          : 'bg-white text-[#667085] border-[#E5E7EB] hover:border-[#5865D8]'
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
                <label className="block text-xs font-semibold text-[#242938]">Day Circumstances</label>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 p-2.5 bg-[#F5F6FA] rounded-xl border border-[#E5E7EB] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkInInput.hasUrgentAssignment}
                      onChange={(e) => setCheckInInput((prev) => ({ ...prev, hasUrgentAssignment: e.target.checked }))}
                      className="rounded text-[#5865D8] focus:ring-0"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-[#242938]">I have an assignment due tomorrow</span>
                      <div className="text-[#667085] text-[11px]">Prioritizes college submission draft first</div>
                    </div>
                  </label>

                  {checkInInput.hasUrgentAssignment && (
                    <div className="pl-6 space-y-2 pt-1">
                      <input
                        type="text"
                        placeholder="Assignment title or subject..."
                        value={checkInInput.assignmentDetails || ''}
                        onChange={(e) => setCheckInInput((prev) => ({ ...prev, assignmentDetails: e.target.value }))}
                        className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-xs text-[#242938] focus:border-[#5865D8] focus:outline-none"
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-2.5 p-2.5 bg-[#F5F6FA] rounded-xl border border-[#E5E7EB] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkInInput.reachedHomeLate}
                      onChange={(e) => setCheckInInput((prev) => ({ ...prev, reachedHomeLate: e.target.checked }))}
                      className="rounded text-[#5865D8] focus:ring-0"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-[#242938]">I reached home late today</span>
                      <div className="text-[#667085] text-[11px]">Offsets available study window start by 45 minutes</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 bg-[#F5F6FA] rounded-xl border border-[#E5E7EB] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checkInInput.hasCollegeWorkToday === false}
                      onChange={(e) => setCheckInInput((prev) => ({ ...prev, hasCollegeWorkToday: e.target.checked ? false : true }))}
                      className="rounded text-[#5865D8] focus:ring-0"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-[#242938]">I have no college work today</span>
                      <div className="text-[#667085] text-[11px]">Shifts all cognitive energy to career skills and projects</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Extra Time Buffer */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#242938]">
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
                          ? 'bg-[#16845B] text-white border-[#16845B]'
                          : 'bg-white text-[#667085] border-[#E5E7EB] hover:border-[#5865D8]'
                      }`}
                    >
                      {mins === 0 ? 'Standard' : `+${mins}m`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus Skill / Topic */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#242938]">
                  Specific Focus Today (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Java, Dynamic Programming, DBMS"
                  value={checkInInput.focusTopicOrSkill || ''}
                  onChange={(e) => setCheckInInput((prev) => ({ ...prev, focusTopicOrSkill: e.target.value }))}
                  className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-[#242938] placeholder-[#667085] focus:border-[#5865D8] focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="flex-1 py-2.5 bg-white hover:bg-[#F5F6FA] text-[#667085] hover:text-[#242938] border border-[#E5E7EB] rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="generate-adaptive-plan-btn"
                  onClick={() => handleGenerateAdaptivePlan()}
                  disabled={isLoadingPlan}
                  className="flex-1 py-2.5 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-2 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl text-[#242938]">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-[#5865D8]" />
                <h3 className="font-bold text-base text-[#242938]">Replan Remaining Day</h3>
              </div>
              <button
                onClick={() => setShowRebalanceModal(false)}
                className="text-[#667085] hover:text-[#242938]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#667085]">
              Adapts your schedule to current clock time. Completed tasks are preserved. Unfeasible tasks return to the curriculum pool without creating late-night schedule debt.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#242938] block mb-1">Current Clock Time</label>
                <input
                  type="time"
                  value={rebalanceClockTime}
                  onChange={(e) => handleUpdateRebalanceTime(e.target.value)}
                  className="w-full bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-[#242938] focus:border-[#5865D8] focus:outline-none"
                />
              </div>

              {rebalancePreview && (
                <div className="bg-[#F5F6FA] p-4 rounded-xl border border-[#E5E7EB] space-y-2 text-xs">
                  <div className="flex justify-between font-semibold text-[#242938]">
                    <span>Remaining Feasible Tasks:</span>
                    <span className="text-[#16845B]">{rebalancePreview.rebalancedItems.length} items</span>
                  </div>
                  {rebalancePreview.droppedItems.length > 0 && (
                    <div className="bg-[#FEF2F2] p-2.5 rounded-lg border border-[#FECACA] text-[#C43D4B] space-y-1">
                      <div className="font-bold">Returned to Planning Pool ({rebalancePreview.droppedItems.length}):</div>
                      {rebalancePreview.droppedItems.map((d, i) => (
                        <div key={i} className="text-[11px] text-[#C43D4B]">
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
                  className="flex-1 py-2.5 bg-white hover:bg-[#F5F6FA] text-[#667085] border border-[#E5E7EB] rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="confirm-replan-btn"
                  onClick={handleConfirmRebalance}
                  className="flex-1 py-2.5 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl text-[#242938] max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-[#5865D8]" />
                <h3 className="font-bold text-base text-[#242938]">Substitute Candidate Topic</h3>
              </div>
              <button
                onClick={() => setReplacingItemId(null)}
                className="text-[#667085] hover:text-[#242938]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#667085]">
              Select an alternative candidate whose prerequisites are completed.
            </p>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {eligibleReplacementTopics.map((cand) => (
                <div
                  key={cand.id}
                  onClick={() => cand.topicId && handleReplaceStagedItem(replacingItemId, cand.topicId)}
                  className="p-3 bg-[#F5F6FA] hover:bg-[#EEF0FF] rounded-xl border border-[#E5E7EB] hover:border-[#5865D8]/40 cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#242938] text-xs">{cand.title}</span>
                    <span className="text-[10px] text-[#667085]">{cand.recommendedMinutes}m</span>
                  </div>
                  <div className="text-[11px] text-[#667085]">{cand.reason}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {reschedulingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MoveRight className="w-4 h-4 text-[#A6630A]" />
                <h3 className="font-bold text-sm text-[#242938]">Move / Reschedule Task</h3>
              </div>
              <button
                onClick={() => setReschedulingItem(null)}
                className="text-[#667085] hover:text-[#242938]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#667085] bg-[#F5F6FA] p-3 rounded-xl border border-[#E5E7EB]">
              Rescheduling: <strong className="text-[#242938]">{reschedulingItem.title}</strong> ({reschedulingItem.plannedMinutes}m)
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-[#667085] block mb-1">Destination Date</label>
                <input
                  type="date"
                  value={targetRescheduleDate}
                  onChange={(e) => setTargetRescheduleDate(e.target.value)}
                  className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-xs text-[#242938] focus:border-[#5865D8] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#667085] block mb-1">New Start Time</label>
                <input
                  type="time"
                  value={targetRescheduleTime}
                  onChange={(e) => setTargetRescheduleTime(e.target.value)}
                  className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-xs text-[#242938] focus:border-[#5865D8] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleMarkAsMissed(reschedulingItem.id);
                    setReschedulingItem(null);
                  }}
                  className="px-3 py-2 bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#C43D4B] border border-[#FECACA] rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Mark as Missed
                </button>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setReschedulingItem(null)}
                  className="px-3 py-2 bg-white hover:bg-[#F5F6FA] text-[#667085] border border-[#E5E7EB] rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReschedule}
                  className="px-4 py-2 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
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
