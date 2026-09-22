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
  HelpCircle,
  Zap,
  RotateCcw,
  MoveRight,
  Coffee,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowRight,
  SlidersHorizontal,
  BookmarkCheck
} from 'lucide-react';
import { AppState, MissionItem, DailyMission, MissionItemStatus } from '../types';
import { 
  formatDateReadable, 
  timeToMinutes, 
  minutesToTime 
} from '../services/scheduler';
import { 
  deriveDayCapacity, 
  detectScheduleConflicts, 
  generateDeterministicSchedule, 
  rebalanceDaySchedule, 
  rescheduleTask,
  ConflictDetail
} from '../services/plannerEngine';
import { requestAIPlanProposal } from '../services/ai';

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
  const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false);
  const [showTimelineDetails, setShowTimelineDetails] = useState<boolean>(false);
  const [includeBreaks, setIncludeBreaks] = useState<boolean>(true);
  const [preserveManual, setPreserveManual] = useState<boolean>(true);

  // Reschedule Modal / Popover State
  const [reschedulingItem, setReschedulingItem] = useState<MissionItem | null>(null);
  const [targetRescheduleDate, setTargetRescheduleDate] = useState<string>('2026-09-22');
  const [targetRescheduleTime, setTargetRescheduleTime] = useState<string>('10:00');

  // Rebalance Clock State
  const [isRebalancing, setIsRebalancing] = useState<boolean>(false);
  const [rebalanceClockTime, setRebalanceClockTime] = useState<string>('15:30');

  // AI Proposal Diff Staging
  const [aiProposal, setAiProposal] = useState<{
    rationale: string;
    proposals: Array<{
      topicId?: string;
      subjectId?: string;
      title: string;
      plannedMinutes: number;
      reason: string;
      priorityScore: number;
      selected?: boolean;
    }>;
  } | null>(null);

  // Manual Item Form
  const [isAddingManual, setIsAddingManual] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubjectId, setNewSubjectId] = useState(state.subjects[0]?.id || '');
  const [newTopicId, setNewTopicId] = useState('');
  const [newMinutes, setNewMinutes] = useState(45);
  const [newScheduledTime, setNewScheduledTime] = useState('14:00');
  const [isUserOverride, setIsUserOverride] = useState(false);

  // Derive capacity calculus deterministically
  const capacity = useMemo(() => deriveDayCapacity(selectedDate, state), [selectedDate, state]);

  // Current Daily Mission
  const currentMission: DailyMission = useMemo(() => {
    return state.missions[selectedDate] || {
      id: `m-${selectedDate}`,
      date: selectedDate,
      availableMinutes: capacity.netAvailableStudyMinutes,
      allocatedMinutes: 0,
      items: [],
    };
  }, [state.missions, selectedDate, capacity.netAvailableStudyMinutes]);

  // Run deterministic conflict detection whenever items change
  const conflicts: ConflictDetail[] = useMemo(() => {
    return detectScheduleConflicts(selectedDate, currentMission.items, state);
  }, [selectedDate, currentMission.items, state]);

  // Compute planned vs actual metrics
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
  // Deterministic Auto-Schedule Handler (No AI needed)
  // -------------------------------------------------------------
  const handleDeterministicAutoSchedule = () => {
    const result = generateDeterministicSchedule(selectedDate, state, {
      includeBreaks,
      breakMinutes: 10,
      preserveManualItems: preserveManual,
    });
    onSaveMission(result.mission);
  };

  // -------------------------------------------------------------
  // Mid-Day Rebalance Handler
  // -------------------------------------------------------------
  const handleRebalance = () => {
    const result = rebalanceDaySchedule(selectedDate, state, rebalanceClockTime);
    onSaveMission(result.rebalancedMission);
    setIsRebalancing(false);
  };

  // -------------------------------------------------------------
  // Reschedule Task Handler
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

    // Save source mission
    onSaveMission(result.sourceMission);

    // If target is different day, save target mission too
    if (targetRescheduleDate !== selectedDate) {
      onSaveMission(result.targetMission);
    }

    setReschedulingItem(null);
  };

  // -------------------------------------------------------------
  // AI Proposal Advisory Generation (Advisory only)
  // -------------------------------------------------------------
  const handleGenerateAIProposal = async () => {
    setIsLoadingAI(true);
    setAiProposal(null);

    const fixedBlocks = capacity.fixedIntervals.map((s) => ({
      title: s.label || 'Fixed Block',
      startTime: minutesToTime(s.start),
      endTime: minutesToTime(s.end),
      type: s.type || 'fixed',
    }));

    try {
      const result = await requestAIPlanProposal(
        selectedDate,
        state,
        capacity.netAvailableStudyMinutes,
        fixedBlocks,
        state.topics
      );

      setAiProposal({
        rationale: result.rationale,
        proposals: result.proposals.map((p) => ({ ...p, selected: true })),
      });
    } catch (err) {
      console.error('Failed to get plan proposal:', err);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const handleAcceptAIProposals = (onlySelected: boolean) => {
    if (!aiProposal) return;
    const toAdd = aiProposal.proposals.filter((p) => (onlySelected ? p.selected : true));

    const newItems: MissionItem[] = toAdd.map((p, idx) => ({
      id: `mi-${Date.now()}-${idx}`,
      topicId: p.topicId,
      subjectId: p.subjectId,
      title: p.title,
      plannedMinutes: p.plannedMinutes,
      actualMinutes: 0,
      status: 'pending',
      isAIRecorded: true,
      priorityScore: p.priorityScore,
      reason: p.reason,
    }));

    const updatedItems = [...currentMission.items, ...newItems];
    const updatedMission: DailyMission = {
      ...currentMission,
      availableMinutes: capacity.netAvailableStudyMinutes,
      allocatedMinutes: updatedItems
        .filter((i) => !i.isBreak && i.status !== 'skipped')
        .reduce((acc, curr) => acc + curr.plannedMinutes, 0),
      items: updatedItems,
      aiProposalRationale: aiProposal.rationale,
    };

    onSaveMission(updatedMission);
    setAiProposal(null);
  };

  // -------------------------------------------------------------
  // Manual Task Creation
  // -------------------------------------------------------------
  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const taskMinutes = Number(newMinutes) || 45;
    const startMin = timeToMinutes(newScheduledTime);
    const endMin = startMin + taskMinutes;

    const newItem: MissionItem = {
      id: `mi-man-${Date.now()}`,
      subjectId: newSubjectId,
      topicId: newTopicId || undefined,
      title: newTitle.trim(),
      plannedMinutes: taskMinutes,
      actualMinutes: 0,
      scheduledTime: newScheduledTime || undefined,
      endTime: minutesToTime(endMin),
      status: 'pending',
      isAIRecorded: false,
      isUserOverride: isUserOverride,
      reason: isUserOverride ? 'Explicit user override' : undefined,
    };

    const updatedItems = [...currentMission.items, newItem];
    const updatedMission: DailyMission = {
      ...currentMission,
      availableMinutes: capacity.netAvailableStudyMinutes,
      allocatedMinutes: updatedItems
        .filter((i) => !i.isBreak && i.status !== 'skipped')
        .reduce((acc, curr) => acc + curr.plannedMinutes, 0),
      items: updatedItems,
    };

    onSaveMission(updatedMission);
    setNewTitle('');
    setIsAddingManual(false);
  };

  const handleDeleteItem = (itemId: string) => {
    const updatedItems = currentMission.items.filter((i) => i.id !== itemId);
    const updatedMission: DailyMission = {
      ...currentMission,
      allocatedMinutes: updatedItems
        .filter((i) => !i.isBreak && i.status !== 'skipped')
        .reduce((acc, curr) => acc + curr.plannedMinutes, 0),
      items: updatedItems,
    };
    onSaveMission(updatedMission);
  };

  const handleMarkAsMissed = (itemId: string) => {
    const updatedItems = currentMission.items.map((i) =>
      i.id === itemId ? { ...i, status: 'missed' as MissionItemStatus } : i
    );
    onSaveMission({ ...currentMission, items: updatedItems });
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span>Deterministic Planner Engine</span>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Daily Schedule & Capacity</span>
            <span className="text-xs font-normal text-slate-400">
              ({formatDateReadable(selectedDate)})
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="planner-date-picker"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          />
          <button
            id="planner-today-btn"
            onClick={() => setSelectedDate('2026-09-21')}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
          >
            Today
          </button>
        </div>
      </div>

      {/* Real Available Time & Capacity Calculus Card */}
      <div 
        id="real-capacity-breakdown"
        className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Daily Cognitive Capacity Calculus</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {capacity.isHoliday ? `Holiday: ${capacity.holidayName}` : `${capacity.dayOfWeek.toUpperCase()}`}
            </span>
            <button
              onClick={() => setShowTimelineDetails(!showTimelineDetails)}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer ml-2"
            >
              <span>{showTimelineDetails ? 'Hide Timeline' : 'View Windows'}</span>
              {showTimelineDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-800/60 border border-slate-700/60 p-3 rounded-xl">
            <div className="text-slate-400 mb-1 flex items-center justify-between">
              <span>Fixed Commitments</span>
              <span className="text-[10px] text-amber-400 font-bold">{capacity.fixedBlocksCount} slots</span>
            </div>
            <div className="text-base font-bold text-amber-300">
              {(capacity.fixedCommitmentsMinutes / 60).toFixed(1)}h
            </div>
            <div className="text-[10px] text-slate-400">
              + {capacity.transitionBufferMinutes}m buffers & commute
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 p-3 rounded-xl">
            <div className="text-slate-400 mb-1">Protected Sleep & Rest</div>
            <div className="text-base font-bold text-slate-300">
              {(capacity.sleepMinutes / 60).toFixed(1)}h
            </div>
            <div className="text-[10px] text-slate-400">
              {minutesToTime(capacity.sleepTimeMinutes)} → {minutesToTime(capacity.wakeTimeMinutes)}
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 p-3 rounded-xl">
            <div className="text-slate-400 mb-1">Net Cognitive Budget</div>
            <div className="text-base font-bold text-emerald-300">
              {(capacity.netAvailableStudyMinutes / 60).toFixed(1)}h
            </div>
            <div className="text-[10px] text-emerald-400/80 font-medium">
              Safe cap: {capacity.safeBudgetMinutes}m
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/60 p-3 rounded-xl">
            <div className="text-slate-400 mb-1">Currently Allocated</div>
            <div className={`text-base font-bold ${plannedVsActual.plannedMinutes > capacity.safeBudgetMinutes ? 'text-rose-400' : 'text-indigo-300'}`}>
              {plannedVsActual.plannedMinutes}m
            </div>
            <div className="text-[10px] text-slate-400">
              {plannedVsActual.plannedMinutes > capacity.safeBudgetMinutes ? '⚠️ Over safe budget' : '✓ Sustainable'}
            </div>
          </div>
        </div>

        {/* Expandable Identified Flexible & Fixed Windows Timeline */}
        {showTimelineDetails && (
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3 animate-in fade-in duration-200">
            <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Identified Discrete Day Windows & Constraints</span>
              <span className="text-[11px] text-slate-400 font-normal">
                Active waking: {minutesToTime(capacity.wakeTimeMinutes)} to {minutesToTime(capacity.sleepTimeMinutes)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Fixed & Blocked List */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  Fixed Commitments & Buffers ({capacity.fixedIntervals.length})
                </div>
                {capacity.fixedIntervals.map((iv, idx) => (
                  <div key={idx} className="bg-slate-900/80 border border-slate-800 rounded-lg p-2 flex items-center justify-between">
                    <span className="text-slate-300 truncate">{iv.label || 'Fixed Block'}</span>
                    <span className="font-mono text-amber-300 text-[11px] shrink-0 ml-2">
                      {minutesToTime(iv.start)} - {minutesToTime(iv.end)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Flexible Focus Windows List */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  Available Flexible Focus Windows ({capacity.flexibleIntervals.length})
                </div>
                {capacity.flexibleIntervals.length === 0 ? (
                  <div className="text-slate-500 text-xs italic">No free intervals available today. Day is fully booked.</div>
                ) : (
                  capacity.flexibleIntervals.map((iv, idx) => (
                    <div key={idx} className="bg-slate-900/80 border border-emerald-900/40 rounded-lg p-2 flex items-center justify-between">
                      <span className="text-emerald-300 truncate">Flexible Focus Block</span>
                      <span className="font-mono text-emerald-400 text-[11px] shrink-0 ml-2">
                        {minutesToTime(iv.start)} - {minutesToTime(iv.end)} ({iv.end - iv.start}m)
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* DETERMINISTIC SCHEDULING ACTION BAR */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-2 border-t border-slate-800/80 gap-3">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200">
              <input
                type="checkbox"
                checked={includeBreaks}
                onChange={(e) => setIncludeBreaks(e.target.checked)}
                className="w-3.5 h-3.5 accent-indigo-500 rounded"
              />
              <span>10m Cognitive Breaks</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200">
              <input
                type="checkbox"
                checked={preserveManual}
                onChange={(e) => setPreserveManual(e.target.checked)}
                className="w-3.5 h-3.5 accent-indigo-500 rounded"
              />
              <span>Preserve User Tasks</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="rebalance-schedule-btn"
              onClick={() => setIsRebalancing(!isRebalancing)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              title="Reschedule pending tasks when circumstances change mid-day"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Rebalance Day</span>
            </button>

            <button
              id="deterministic-auto-schedule-btn"
              onClick={handleDeterministicAutoSchedule}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
              title="Mathematically pack prioritized candidate topics into free windows without overlapping"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Auto-Schedule Day</span>
            </button>

            <button
              id="ai-plan-propose-btn"
              onClick={handleGenerateAIProposal}
              disabled={isLoadingAI}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800/60 rounded-xl text-xs font-medium transition-all cursor-pointer"
              title="Optional AI advisory candidate proposal"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>{isLoadingAI ? 'Analyzing...' : 'AI Advice'}</span>
            </button>
          </div>
        </div>

        {/* MID-DAY REBALANCE PANEL */}
        {isRebalancing && (
          <div className="bg-amber-950/20 border border-amber-800/40 rounded-xl p-4 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-amber-300">Mid-Day Circumstance Change & Rebalance</h4>
              </div>
              <button
                onClick={() => setIsRebalancing(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              If class ran late or you missed a session, choose your current clock time. The engine will shift pending tasks forward into remaining afternoon/evening focus windows without conflicting with upcoming commitments.
            </p>
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-400">Current Time:</label>
              <input
                type="time"
                value={rebalanceClockTime}
                onChange={(e) => setRebalanceClockTime(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5"
              />
              <button
                onClick={handleRebalance}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Shift Pending Tasks Forward
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETERMINISTIC CONFLICT DIAGNOSTICS BANNER */}
      {conflicts.length > 0 && (
        <div 
          id="planner-conflict-banner"
          className="bg-rose-950/30 border-2 border-rose-600/40 rounded-2xl p-4 space-y-2.5 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Schedule Conflict & Constraint Audit ({conflicts.length})
              </h3>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-900/60 text-rose-200 font-semibold">
              Deterministic Validator
            </span>
          </div>

          <div className="space-y-1.5">
            {conflicts.map((c, idx) => (
              <div 
                key={idx} 
                className="text-xs bg-slate-900/90 border border-rose-900/50 rounded-xl p-2.5 flex items-start gap-2.5"
              >
                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${c.severity === 'error' ? 'text-rose-400' : 'text-amber-400'}`} />
                <div className="flex-1 text-slate-300">
                  <span className="font-semibold text-white">[{c.type.toUpperCase()}]: </span>
                  {c.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI PROPOSAL DIFF CARD (Optional heuristic suggestions) */}
      {aiProposal && (
        <div 
          id="ai-proposal-diff-card"
          className="bg-indigo-950/30 border-2 border-indigo-500/40 rounded-2xl p-5 space-y-4 shadow-lg animate-in fade-in duration-300"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h3 className="font-bold text-sm text-white">AI Advisory Recommendations (Proposal Diff)</h3>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-900 text-indigo-200">
              Review Needed
            </span>
          </div>

          <p className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-xl border border-indigo-900/40">
            <strong>Rationale: </strong>{aiProposal.rationale}
          </p>

          <div className="space-y-2">
            {aiProposal.proposals.map((prop, idx) => {
              const sub = state.subjects.find((s) => s.id === prop.subjectId);
              return (
                <div
                  key={idx}
                  className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={prop.selected !== false}
                      onChange={() => {
                        const updated = [...aiProposal.proposals];
                        updated[idx].selected = !updated[idx].selected;
                        setAiProposal({ ...aiProposal, proposals: updated });
                      }}
                      className="w-4 h-4 accent-indigo-500 cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        {sub && (
                          <span 
                            className="text-[9px] font-bold px-1.5 py-0.2 rounded text-white"
                            style={{ backgroundColor: sub.color }}
                          >
                            {sub.code}
                          </span>
                        )}
                        <span className="font-semibold text-white truncate">{prop.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{prop.reason}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-slate-300 font-medium">{prop.plannedMinutes} mins</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setAiProposal(null)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject All</span>
            </button>
            <button
              onClick={() => handleAcceptAIProposals(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept Selected into Mission</span>
            </button>
          </div>
        </div>
      )}

      {/* Active Daily Mission Item List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Scheduled Daily Mission</h2>
            <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>{plannedVsActual.totalItems} study blocks</span>
              <span>•</span>
              <span>Planned: <strong className="text-slate-200">{plannedVsActual.plannedMinutes}m</strong></span>
              <span>•</span>
              <span>Actual: <strong className="text-emerald-300">{plannedVsActual.actualMinutes}m</strong></span>
              {plannedVsActual.actualMinutes > 0 && (
                <span className="text-[11px] font-mono text-indigo-300">
                  ({plannedVsActual.varianceMinutes >= 0 ? `+${plannedVsActual.varianceMinutes}m` : `${plannedVsActual.varianceMinutes}m`} variance)
                </span>
              )}
            </div>
          </div>

          <button
            id="planner-add-task-btn"
            onClick={() => setIsAddingManual(!isAddingManual)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Custom Task</span>
          </button>
        </div>

        {/* Manual Add Form */}
        {isAddingManual && (
          <form onSubmit={handleAddManualItem} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold text-indigo-300">Add Task to {formatDateReadable(selectedDate)}</div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] text-slate-400 block mb-1">Task Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Read Operating Systems Chapter 8 Paging"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Subject</label>
                <select
                  value={newSubjectId}
                  onChange={(e) => setNewSubjectId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  {state.subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Duration (Mins)</label>
                <input
                  type="number"
                  min={15}
                  max={240}
                  step={5}
                  value={newMinutes}
                  onChange={(e) => setNewMinutes(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Scheduled Start Time</label>
                <input
                  type="time"
                  value={newScheduledTime}
                  onChange={(e) => setNewScheduledTime(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-2 pt-6">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isUserOverride}
                    onChange={(e) => setIsUserOverride(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                  <span>Force User Override (bypass conflict warnings)</span>
                </label>
              </div>

              <div className="sm:col-span-1 flex items-end gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-lg text-xs cursor-pointer"
                >
                  Save Task
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingManual(false)}
                  className="bg-slate-700 text-slate-300 py-2 px-3 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Task Items List */}
        {currentMission.items.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            No mission items planned for this date. Click <strong>"Auto-Schedule Day"</strong> to mathematically fit study tasks into your free windows, or <strong>"Add Custom Task"</strong>.
          </div>
        ) : (
          <div className="space-y-2.5">
            {currentMission.items.map((item) => {
              const subject = state.subjects.find((s) => s.id === item.subjectId);
              const isDone = item.status === 'completed';
              const isMissed = item.status === 'missed';
              const isRescheduled = item.status === 'rescheduled';

              // If it's a cognitive break card
              if (item.isBreak) {
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-4 py-2 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl text-xs text-slate-400"
                  >
                    <div className="flex items-center gap-2">
                      <Coffee className="w-3.5 h-3.5 text-amber-400/80" />
                      <span className="font-medium text-slate-300">{item.title}</span>
                      {item.scheduledTime && (
                        <span className="font-mono text-slate-500 text-[11px]">
                          ({item.scheduledTime} - {item.endTime})
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-slate-600 hover:text-rose-400 p-1 rounded"
                      title="Remove break"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={item.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-800/70 border rounded-xl gap-3 transition-all ${
                    isDone 
                      ? 'border-slate-800 bg-slate-800/30 opacity-70' 
                      : isMissed 
                      ? 'border-rose-900/60 bg-rose-950/10' 
                      : isRescheduled
                      ? 'border-slate-800 bg-slate-900/40 opacity-50'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => onToggleItemStatus(selectedDate, item.id)}
                      className="text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer shrink-0"
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-500" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        {subject && (
                          <span 
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                            style={{ backgroundColor: subject.color }}
                          >
                            {subject.code}
                          </span>
                        )}

                        {item.scheduledTime && (
                          <span className="text-[11px] font-mono font-medium text-slate-300">
                            {item.scheduledTime} {item.endTime ? `- ${item.endTime}` : ''}
                          </span>
                        )}

                        {item.isUserOverride && (
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-amber-900/60 text-amber-300 font-semibold border border-amber-700/60">
                            User Override
                          </span>
                        )}

                        {isMissed && (
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-rose-900/60 text-rose-300 font-semibold">
                            Missed Session
                          </span>
                        )}

                        {isRescheduled && (
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-semibold">
                            Moved to {item.rescheduledTo}
                          </span>
                        )}

                        {item.isAIRecorded && (
                          <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-indigo-900/60 text-indigo-300 font-semibold">
                            AI Proposed
                          </span>
                        )}
                      </div>

                      <h4 className={`text-xs font-semibold truncate ${isDone ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                        {item.title}
                      </h4>

                      {item.reason && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.reason}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                    <div className="text-right text-xs pr-2">
                      <span className="font-mono text-slate-200">
                        {item.actualMinutes > 0 ? (
                          <strong className="text-emerald-400">{item.actualMinutes}m / </strong>
                        ) : null}
                        {item.plannedMinutes}m
                      </span>
                    </div>

                    {!isDone && !isRescheduled && (
                      <button
                        onClick={() => onStartSessionForItem(item)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                        title="Start focus timer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Focus</span>
                      </button>
                    )}

                    {/* Reschedule Button */}
                    <button
                      onClick={() => {
                        setReschedulingItem(item);
                        setTargetRescheduleDate(selectedDate);
                        setTargetRescheduleTime(item.scheduledTime || '15:00');
                      }}
                      className="p-1 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Move or Reschedule Task"
                    >
                      <MoveRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                      title="Delete task"
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
