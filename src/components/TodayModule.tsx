import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Clock, 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Sparkles, 
  CalendarDays, 
  AlertTriangle, 
  Coffee, 
  Check, 
  SkipForward, 
  Plus, 
  RotateCcw,
  BookOpen,
  Calendar,
  Layers,
  ChevronRight,
  Sun,
  Moon,
  Compass,
  GraduationCap
} from 'lucide-react';
import { 
  ActiveTab, 
  AppState, 
  DayOfWeek, 
  MissionItem, 
  ActiveFocusSessionState 
} from '../types';
import { 
  computePlannedVsActual, 
  formatDateReadable, 
  getTodayDateString,
  timeToMinutes 
} from '../services/scheduler';
import { deriveDayCapacity } from '../services/plannerEngine';
import { deriveSemesterState } from '../services/semesterAnalytics';
import { dataService } from '../services/dataService';

interface TodayModuleProps {
  state: AppState;
  setActiveTab: (tab: ActiveTab) => void;
  onStartSessionForItem: (item: MissionItem) => void;
  onToggleItemStatus: (dateStr: string, itemId: string) => void;
  onOpenFocusSession: () => void;
}

export const TodayModule: React.FC<TodayModuleProps> = ({
  state,
  setActiveTab,
  onStartSessionForItem,
  onToggleItemStatus,
  onOpenFocusSession,
}) => {
  const todayStr = getTodayDateString();
  const capacity = deriveDayCapacity(todayStr, state);
  const todaysMission = state.missions[todayStr];
  const items = todaysMission?.items || [];
  const plannedVsActual = computePlannedVsActual(items);

  // Active focus session (persisted timestamp-driven)
  const [activeSession, setActiveSession] = useState<ActiveFocusSessionState | null>(() => {
    return dataService.getActiveFocusSession();
  });
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Re-read active focus session on mount & storage events
  useEffect(() => {
    const syncActiveSession = () => {
      const current = dataService.getActiveFocusSession();
      setActiveSession(current);
      if (current) {
        const now = Date.now();
        const effectiveEnd = current.targetEndTimeMs + (current.totalPausedMs || 0);
        const rem = Math.max(0, Math.floor((effectiveEnd - now) / 1000));
        setRemainingSeconds(rem);
      }
    };

    syncActiveSession();
    const interval = setInterval(syncActiveSession, 1000);
    return () => clearInterval(interval);
  }, []);

  // Time-of-day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Active semester context
  const activeSemester = state.semesters.find((s) => s.id === state.activeSemesterId) || state.semesters[0];
  const semesterState = activeSemester ? deriveSemesterState(activeSemester, todayStr) : 'active';

  // Primary Next Study Task determination
  const pendingStudyItems = items.filter(
    (i) => !i.isBreak && i.status !== 'completed' && i.status !== 'skipped'
  );
  const nextStudyItem = pendingStudyItems[0];
  const completedItems = items.filter((i) => i.status === 'completed' && !i.isBreak);

  // Derive associated subject and topic metadata for the next item
  const nextSubject = nextStudyItem?.subjectId 
    ? state.subjects.find((s) => s.id === nextStudyItem.subjectId)
    : undefined;
  const nextTopic = nextStudyItem?.topicId 
    ? state.topics.find((t) => t.id === nextStudyItem.topicId)
    : undefined;

  // Real capacity and remaining time
  const remainingStudyMinutes = Math.max(0, capacity.netAvailableStudyMinutes - plannedVsActual.actualMinutes);
  const remainingStudyHours = (remainingStudyMinutes / 60).toFixed(1);

  // Format seconds to mm:ss
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Day of week calculation for timetable
  const dayNames: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeekStr = dayNames[new Date(todayStr + 'T00:00:00').getDay()];

  // Today's classes from timetable
  const todayClasses = state.timetable.filter(
    (s) => s.semesterId === state.activeSemesterId && s.dayOfWeek === dayOfWeekStr && s.isFixed
  );

  // Build unified chronological timeline of student's day
  interface TimelineEntry {
    id: string;
    time: string;
    title: string;
    subtitle?: string;
    type: 'wake' | 'lecture' | 'lab' | 'commute' | 'study' | 'break' | 'sleep';
    isCompleted?: boolean;
    durationMinutes?: number;
    missionItem?: MissionItem;
  }

  const timelineEntries: TimelineEntry[] = [];

  // Wake time
  if (state.profile.wakeTime) {
    timelineEntries.push({
      id: 'wake',
      time: state.profile.wakeTime,
      title: 'Wake & Morning Routine',
      subtitle: 'Healthy start & daily prep',
      type: 'wake',
    });
  }

  // College classes
  todayClasses.forEach((slot) => {
    timelineEntries.push({
      id: slot.id,
      time: slot.startTime,
      title: slot.title,
      subtitle: slot.location ? `Room ${slot.location}` : 'College lecture/lab',
      type: slot.type === 'lab' ? 'lab' : 'lecture',
      durationMinutes: timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime),
    });
  });

  // Scheduled study items
  items.forEach((item) => {
    timelineEntries.push({
      id: item.id,
      time: item.scheduledTime || 'Evening',
      title: item.title,
      subtitle: item.objective || item.reason || (item.isBreak ? 'Rest break' : 'Focused study'),
      type: item.isBreak ? 'break' : 'study',
      isCompleted: item.status === 'completed',
      durationMinutes: item.plannedMinutes,
      missionItem: item,
    });
  });

  // Bedtime
  if (state.profile.sleepTime) {
    timelineEntries.push({
      id: 'sleep',
      time: state.profile.sleepTime,
      title: 'Protected Bedtime',
      subtitle: `${state.profile.sleepHours || 8}h rest budget`,
      type: 'sleep',
    });
  }

  // Sort timeline chronologically
  timelineEntries.sort((a, b) => {
    const parseTimeSafe = (t: string) => {
      if (t === 'Evening') return 18 * 60;
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    return parseTimeSafe(a.time) - parseTimeSafe(b.time);
  });

  const handleSkipNext = () => {
    if (!nextStudyItem) return;
    try {
      dataService.skipDailyMissionItem(todayStr, nextStudyItem.id);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleExtendActiveSession = (extraMins: number) => {
    if (!activeSession) return;
    const addedMs = extraMins * 60 * 1000;
    dataService.updateActiveFocusSession({
      targetDurationMinutes: activeSession.targetDurationMinutes + extraMins,
      targetEndTimeMs: activeSession.targetEndTimeMs + addedMs,
    });
  };

  const handleStopActiveSession = () => {
    dataService.clearActiveFocusSession();
    setActiveSession(null);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1. Header Greeting & Date Anchor */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E7EB]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#242938]">
            {getGreeting()}, {state.profile.name || 'Alex'}
          </h1>
          <p className="text-xs sm:text-sm text-[#667085] mt-0.5">
            {formatDateReadable(todayStr)} •{' '}
            <span className="text-[#242938] font-medium">
              {activeSemester?.name || 'Semester Term'}
            </span>{' '}
            {semesterState === 'break' ? '(Holiday Break Mode)' : '(Active Term)'}
          </p>
        </div>

        {/* Compact Capacity & Status Indicators */}
        <div className="flex items-center gap-2.5">
          <div className="px-3 py-1.5 rounded-lg bg-white border border-[#E5E7EB] text-xs shadow-xs">
            <span className="text-[#667085]">Available Study: </span>
            <span className="font-semibold text-[#242938]">
              {(capacity.netAvailableStudyMinutes / 60).toFixed(1)}h
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white border border-[#E5E7EB] text-xs shadow-xs">
            <span className="text-[#667085]">Completed: </span>
            <span className="font-semibold text-[#5865D8] font-mono">
              {completedItems.length}/{items.filter((i) => !i.isBreak).length}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Active Session In-Progress Banner (If timer is running) */}
      {activeSession && (
        <div className="p-4 rounded-xl bg-[#EEF0FF] border border-[#5865D8]/30 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-white border border-[#5865D8]/30 flex items-center justify-center shrink-0 text-[#5865D8] shadow-xs">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-white text-[#5865D8] border border-[#5865D8]/30 font-mono">
                  Focus Session Active
                </span>
                <span className="text-xs font-mono font-bold text-[#242938]">
                  {formatTimer(remainingSeconds)} remaining
                </span>
                {remainingSeconds <= 300 && remainingSeconds > 0 && (
                  <span className="text-[10px] text-[#A6630A] flex items-center gap-1 font-medium bg-[#FFFBEB] px-1.5 py-0.5 rounded border border-[#FDE68A]">
                    <AlertTriangle className="w-3 h-3" />
                    Wrapping up soon
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-[#242938] mt-1">
                {activeSession.title}
              </h3>
              <p className="text-xs text-[#667085]">
                Current step: <span className="text-[#242938] font-medium">{activeSession.steps[activeSession.currentStepIndex] || 'Active Practice'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenFocusSession()}
              className="px-3.5 py-1.5 rounded-lg bg-[#5865D8] hover:bg-[#4854C4] text-white text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            >
              Resume Workspace
            </button>
            <button
              onClick={() => handleExtendActiveSession(15)}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F5F6FA] text-[#242938] text-xs font-medium border border-[#E5E7EB] transition-colors cursor-pointer shadow-xs"
            >
              +15m
            </button>
            <button
              onClick={handleStopActiveSession}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#FEF2F2] text-[#C43D4B] text-xs font-medium border border-[#E5E7EB] transition-colors cursor-pointer shadow-xs"
            >
              End
            </button>
          </div>
        </div>
      )}

      {/* 3. Primary Section: NEXT STUDY SESSION */}
      {nextStudyItem ? (
        <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E5E7EB] shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#5865D8]" />
              <h2 className="text-xs font-semibold tracking-wider uppercase text-[#667085]">
                Next Recommended Session
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#667085]">
              <Clock className="w-3.5 h-3.5" />
              <span>{nextStudyItem.plannedMinutes} mins planned</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {nextSubject && (
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-[#EEF0FF] text-[#5865D8] border border-[#5865D8]/20">
                  {nextSubject.code} • {nextSubject.name}
                </span>
              )}
              {nextStudyItem.scheduledTime && (
                <span className="text-xs text-[#667085] font-mono">
                  Scheduled at {nextStudyItem.scheduledTime}
                </span>
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-[#242938]">
              {nextStudyItem.title}
            </h3>

            <div className="p-3.5 rounded-xl bg-[#F5F6FA] border border-[#E5E7EB] text-xs text-[#242938] space-y-1">
              <div className="font-medium text-[#242938]">
                <span className="text-[#5865D8] font-semibold">Learning Objective: </span>
                {nextStudyItem.objective || nextTopic?.description || 'Build concrete conceptual depth and complete practice problems.'}
              </div>
              {nextStudyItem.reason && (
                <div className="text-[#667085] text-[11px] pt-1 border-t border-[#E5E7EB]">
                  <span className="text-[#242938] font-medium">Why this was selected: </span>
                  {nextStudyItem.reason}
                </div>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              id="today-start-session-btn"
              onClick={() => onStartSessionForItem(nextStudyItem)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#5865D8] hover:bg-[#4854C4] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Focus Session ({nextStudyItem.plannedMinutes}m)</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSkipNext}
                className="px-3 py-2 rounded-xl text-xs text-[#667085] hover:text-[#242938] hover:bg-[#F5F6FA] border border-[#E5E7EB] transition-colors cursor-pointer"
                title="Postpone or skip for today"
              >
                Skip / Postpone
              </button>
              <button
                onClick={() => setActiveTab('planner')}
                className="px-3 py-2 rounded-xl text-xs text-[#667085] hover:text-[#242938] hover:bg-[#F5F6FA] border border-[#E5E7EB] transition-colors cursor-pointer"
              >
                Change Task
              </button>
            </div>
          </div>
        </div>
      ) : items.length > 0 ? (
        /* All tasks completed state */
        <div className="p-6 rounded-2xl bg-white border border-[#E5E7EB] text-center space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[#16845B] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-[#242938]">
            All planned study tasks for today are completed!
          </h3>
          <p className="text-xs text-[#667085] max-w-md mx-auto">
            You reached your study target for today. Take time to rest or explore optional practice in Socratic Practice.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => setActiveTab('practice')}
              className="px-4 py-2 rounded-xl bg-[#5865D8] hover:bg-[#4854C4] text-white text-xs font-medium transition-colors cursor-pointer shadow-xs"
            >
              Practice with AI Tutor
            </button>
            <button
              onClick={() => setActiveTab('planner')}
              className="px-4 py-2 rounded-xl bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] text-xs font-medium transition-colors cursor-pointer shadow-xs"
            >
              Review Daily Planner
            </button>
          </div>
        </div>
      ) : (
        /* Empty mission state */
        <div className="p-6 sm:p-8 rounded-2xl bg-white border border-[#E5E7EB] text-center space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-full bg-[#EEF0FF] border border-[#D5D9FB] text-[#5865D8] flex items-center justify-center mx-auto">
            <CalendarDays className="w-5 h-5" />
          </div>
          <h3 className="text-base font-semibold text-[#242938]">
            No study mission created for today yet
          </h3>
          <p className="text-xs text-[#667085] max-w-md mx-auto">
            You have <span className="text-[#242938] font-medium">{(capacity.netAvailableStudyMinutes / 60).toFixed(1)} hours</span> of uncommitted study capacity outside classes and rest.
          </p>
          <div className="pt-2">
            <button
              id="today-create-plan-btn"
              onClick={() => setActiveTab('planner')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5865D8] hover:bg-[#4854C4] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Generate Today's Study Plan</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Three Questions Summary (How Much Time, What Happens When I Start) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-[#E5E7EB] space-y-1.5 shadow-xs">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-[#667085]">
            1. What to do next
          </span>
          <p className="text-xs font-semibold text-[#242938] truncate">
            {nextStudyItem ? nextStudyItem.title : 'Day targets fulfilled'}
          </p>
          <p className="text-[11px] text-[#667085]">
            {nextStudyItem?.plannedMinutes ? `${nextStudyItem.plannedMinutes}m focused block` : 'Rest or optional coding'}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#E5E7EB] space-y-1.5 shadow-xs">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-[#667085]">
            2. How much time do I have?
          </span>
          <p className="text-xs font-semibold text-[#242938]">
            {remainingStudyHours}h remaining focus time
          </p>
          <p className="text-[11px] text-[#667085]">
            {todayClasses.length} campus commitments scheduled
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#E5E7EB] space-y-1.5 shadow-xs">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-[#667085]">
            3. What happens when I start?
          </span>
          <p className="text-xs font-semibold text-[#242938]">
            Timer & Socratic reflection
          </p>
          <p className="text-[11px] text-[#667085]">
            Tracks mastery & builds persistent memory
          </p>
        </div>
      </div>

      {/* 5. Daily Plan Timeline (College, Commute, Meals, Study, Sleep) */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white border border-[#E5E7EB] space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#5865D8]" />
            <h3 className="text-sm font-semibold text-[#242938]">
              Today's Daily Schedule Timeline
            </h3>
          </div>
          <button
            onClick={() => setActiveTab('planner')}
            className="text-xs text-[#5865D8] hover:text-[#4854C4] font-medium inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Open Planner</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {timelineEntries.length === 0 ? (
          <p className="text-xs text-[#667085] py-4 text-center">
            No commitments or study blocks recorded for today.
          </p>
        ) : (
          <div className="space-y-2.5">
            {timelineEntries.map((entry) => {
              const isClass = entry.type === 'lecture' || entry.type === 'lab';
              const isStudy = entry.type === 'study';

              return (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-colors ${
                    entry.isCompleted
                      ? 'bg-[#F9FAFB] border-[#E5E7EB] opacity-60'
                      : isStudy
                      ? 'bg-[#EEF0FF]/40 border-[#5865D8]/20'
                      : isClass
                      ? 'bg-[#F9FAFB] border-[#E5E7EB]'
                      : 'bg-white border-[#E5E7EB]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-[#667085] w-12 shrink-0">
                      {entry.time}
                    </span>

                    <div className="flex items-center gap-2">
                      {isStudy && entry.missionItem && (
                        <button
                          onClick={() => onToggleItemStatus(todayStr, entry.missionItem!.id)}
                          className="text-[#667085] hover:text-[#16845B] transition-colors cursor-pointer"
                        >
                          {entry.isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-[#16845B]" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${entry.isCompleted ? 'line-through text-[#667085]' : 'text-[#242938]'}`}>
                            {entry.title}
                          </span>
                          {isClass && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#667085] font-mono border border-[#E5E7EB]">
                              {entry.type === 'lab' ? 'Campus Lab' : 'Lecture'}
                            </span>
                          )}
                          {isStudy && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EEF0FF] text-[#5865D8] border border-[#5865D8]/30 font-mono">
                              Focus Study
                            </span>
                          )}
                        </div>
                        {entry.subtitle && (
                          <p className="text-[11px] text-[#667085] mt-0.5">
                            {entry.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {entry.durationMinutes && (
                      <span className="text-[11px] text-[#667085] font-mono">
                        {entry.durationMinutes}m
                      </span>
                    )}
                    {isStudy && !entry.isCompleted && entry.missionItem && (
                      <button
                        onClick={() => onStartSessionForItem(entry.missionItem!)}
                        className="p-1.5 rounded-lg bg-white hover:bg-[#5865D8] text-[#5865D8] hover:text-white border border-[#E5E7EB] transition-colors cursor-pointer shadow-xs"
                        title="Start focus on this task"
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
