import React from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Play, 
  Clock, 
  MapPin, 
  ArrowRight, 
  Bot, 
  Sparkles, 
  CalendarDays,
  Flame,
  AlertCircle
} from 'lucide-react';
import { ActiveTab, AppState, DayOfWeek, MissionItem } from '../types';
import { computePlannedVsActual, computeWeeklySubjectHours, formatDateReadable } from '../services/scheduler';
import { deriveDayCapacity } from '../services/plannerEngine';

interface DashboardProps {
  state: AppState;
  setActiveTab: (tab: ActiveTab) => void;
  onStartSessionForItem: (item: MissionItem) => void;
  onToggleItemStatus: (dateStr: string, itemId: string) => void;
  onOpenFocusSession: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  state,
  setActiveTab,
  onStartSessionForItem,
  onToggleItemStatus,
  onOpenFocusSession,
}) => {
  const todayStr = '2026-09-21';
  const capacity = deriveDayCapacity(todayStr, state);
  const todaysMission = state.missions[todayStr];
  const items = todaysMission?.items || [];
  const plannedVsActual = computePlannedVsActual(items);
  const weeklyHours = computeWeeklySubjectHours(state);

  const availableHours = (capacity.netAvailableStudyMinutes / 60).toFixed(1);
  const fixedHours = (capacity.fixedCommitmentsMinutes / 60).toFixed(1);

  // Find next upcoming class/lab for today from timetable
  const dayNames: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeekStr = dayNames[new Date(todayStr + 'T00:00:00').getDay()];
  const todayFixedSlots = state.timetable.filter(
    (s) => s.semesterId === state.activeSemesterId && s.dayOfWeek === dayOfWeekStr && s.isFixed
  );
  const nextSlot = todayFixedSlots[0]; // e.g. next class

  return (
    <div className="space-y-6">
      {/* Top Banner: Real Daily Capacity Meter */}
      <div 
        id="dashboard-capacity-card"
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm relative overflow-hidden"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Today’s Real Daily Budget
              </span>
              <span className="text-xs text-slate-400">• {formatDateReadable(todayStr)}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Good morning, {state.profile.name || 'Scholar'}.
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Accounting for {fixedHours}h of fixed campus lectures/labs, sleep, and meal buffers, you have{' '}
              <strong className="text-emerald-300 font-semibold">{availableHours} hours</strong> of real, sustainable cognitive study capacity today.
            </p>

            {/* Student context badges (Wake/Sleep, Travel, Career) */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {state.profile.wakeTime && state.profile.sleepTime && (
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/80 text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-indigo-400" />
                  <span>Rhythm: {state.profile.wakeTime} – {state.profile.sleepTime}</span>
                </span>
              )}
              {state.profile.travelTimeMinutes !== undefined && (
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700/80 text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  <span>Transit: {state.profile.travelTimeMinutes}m</span>
                </span>
              )}
              {state.profile.careerInterests && state.profile.careerInterests.length > 0 && (
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  <span>Target: {state.profile.careerInterests[0]}</span>
                </span>
              )}
            </div>
          </div>

          {/* Metric Pills */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-center min-w-[100px]">
              <div className="text-xs text-slate-400 mb-0.5">Real Free</div>
              <div className="text-lg font-bold text-emerald-300">{availableHours}h</div>
              <div className="text-[10px] text-slate-400">Safe budget</div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-center min-w-[100px]">
              <div className="text-xs text-slate-400 mb-0.5">Fixed Class</div>
              <div className="text-lg font-bold text-amber-300">{fixedHours}h</div>
              <div className="text-[10px] text-slate-400">{todayFixedSlots.length} blocks</div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 text-center min-w-[100px]">
              <div className="text-xs text-slate-400 mb-0.5">Mission Done</div>
              <div className="text-lg font-bold text-indigo-300">{plannedVsActual.completionRate}%</div>
              <div className="text-[10px] text-slate-400">{plannedVsActual.completedItems}/{plannedVsActual.totalItems} tasks</div>
            </div>
          </div>
        </div>

        {/* Capacity utilization bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Allocated: {todaysMission?.allocatedMinutes || plannedVsActual.plannedMinutes} mins of {capacity.netAvailableStudyMinutes} mins maximum safe capacity.</span>
          </div>
          <button
            onClick={() => setActiveTab('planner')}
            className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
          >
            <span>Open Daily Planner</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Today's Daily Mission */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-400" />
              <h2 className="text-base font-bold text-white">Today's Daily Mission</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                id="dashboard-plan-day-btn"
                onClick={() => setActiveTab('planner')}
                className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 transition-colors cursor-pointer"
              >
                Modify Plan
              </button>
            </div>
          </div>

          {/* Mission Items List */}
          {items.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
              <div className="text-sm font-semibold text-slate-200">No Mission Planned Yet Today</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Calculate today's real available time and let NEXORA propose high-leverage topics matching your prerequisites.
              </p>
              <button
                onClick={() => setActiveTab('planner')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Today's Mission</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const subject = state.subjects.find((s) => s.id === item.subjectId);
                const isCompleted = item.status === 'completed';
                const isInProgress = item.status === 'in_progress';

                return (
                  <div
                    key={item.id}
                    id={`mission-item-${item.id}`}
                    className={`bg-slate-900 border rounded-xl p-4 transition-all flex items-center justify-between gap-3 ${
                      isCompleted 
                        ? 'border-slate-800/80 bg-slate-900/40 opacity-75' 
                        : isInProgress
                        ? 'border-indigo-500/60 bg-indigo-950/20'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => onToggleItemStatus(todayStr, item.id)}
                        className="mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer"
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-500" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          {subject && (
                            <span 
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                              style={{ backgroundColor: subject.color }}
                            >
                              {subject.code}
                            </span>
                          )}
                          {item.scheduledTime && (
                            <span className="text-[11px] font-mono text-slate-400">
                              {item.scheduledTime}
                            </span>
                          )}
                          {item.isAIRecorded && (
                            <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 bg-indigo-900/50 text-indigo-300 rounded border border-indigo-700/50">
                              AI Advisory
                            </span>
                          )}
                        </div>

                        <h3 className={`text-sm font-semibold truncate ${isCompleted ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                          {item.title}
                        </h3>

                        {item.reason && (
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {item.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Time & Action */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-semibold text-slate-200">
                          {item.actualMinutes > 0 ? `${item.actualMinutes}m / ` : ''}{item.plannedMinutes}m
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.actualMinutes > 0 ? 'Logged' : 'Target'}
                        </div>
                      </div>

                      {!isCompleted && (
                        <button
                          onClick={() => onStartSessionForItem(item)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
                          title="Launch Pomodoro/Timer for this task"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Focus</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* AI Advisory Rationale Card */}
          {todaysMission?.aiProposalRationale && (
            <div className="bg-indigo-950/20 border border-indigo-900/40 rounded-xl p-4 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
              <div className="text-xs text-slate-300">
                <strong className="text-indigo-300 font-semibold block mb-0.5">NEXORA Scheduling Advisory Note</strong>
                {todaysMission.aiProposalRationale}
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Fixed Campus Commitments & Weekly Subject Pacing */}
        <div className="space-y-6">
          {/* Next Fixed Block Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Campus Commitment
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Fixed Block
              </span>
            </div>

            {nextSlot ? (
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">{nextSlot.title}</span>
                  <span className="text-xs font-mono text-amber-300 font-medium">
                    {nextSlot.startTime} - {nextSlot.endTime}
                  </span>
                </div>
                {nextSlot.location && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{nextSlot.location}</span>
                  </div>
                )}
                <div className="text-[11px] text-slate-400">
                  Type: <span className="capitalize text-slate-300">{nextSlot.type}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-2">
                No further fixed lectures or labs scheduled for today.
              </div>
            )}

            <button
              onClick={() => setActiveTab('timetable')}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer text-center"
            >
              View Full Weekly Timetable
            </button>
          </div>

          {/* Weekly Subject Pacing */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Subject Pacing This Week
              </h3>
              <button
                onClick={() => setActiveTab('progress')}
                className="text-[11px] text-indigo-400 hover:underline"
              >
                Details
              </button>
            </div>

            <div className="space-y-3">
              {state.subjects.map((sub) => {
                const stat = weeklyHours[sub.id];
                const actualHours = stat ? (stat.actualMinutes / 60).toFixed(1) : '0.0';
                const targetHours = sub.targetWeeklyHours;
                const percent = Math.min(100, Math.round(((stat?.actualMinutes || 0) / (targetHours * 60)) * 100));

                return (
                  <div key={sub.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sub.color }}></span>
                        <span className="font-semibold text-slate-200 truncate">{sub.code}</span>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {actualHours} / {targetHours}h
                      </span>
                    </div>

                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ width: `${percent}%`, backgroundColor: sub.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick AI Tutor Socratic Question Trigger */}
          <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-800/40 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-indigo-300">
              <Bot className="w-4 h-4" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                Socratic AI Tutor
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Stuck on a concept or need a practice challenge before your next lab?
            </p>
            <button
              onClick={() => setActiveTab('tutor')}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              Ask Socratic Tutor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
