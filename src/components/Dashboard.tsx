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
  AlertCircle,
  Target,
  ChevronRight,
  Coffee,
  Sunrise,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { ActiveTab, AppState, DayOfWeek, MissionItem, ActivityType } from '../types';
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
  const remainingStudyMinutes = Math.max(0, capacity.netAvailableStudyMinutes - plannedVsActual.actualMinutes);
  const remainingStudyHours = (remainingStudyMinutes / 60).toFixed(1);

  // Active / Upcoming study items (excluding breaks)
  const pendingStudyItems = items.filter((i) => !i.isBreak && i.status !== 'completed' && i.status !== 'skipped');
  const currentActivity = pendingStudyItems[0];
  const nextActivity = pendingStudyItems[1];

  // Find next upcoming class/lab for today from timetable
  const dayNames: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeekStr = dayNames[new Date(todayStr + 'T00:00:00').getDay()];
  const todayFixedSlots = state.timetable.filter(
    (s) => s.semesterId === state.activeSemesterId && s.dayOfWeek === dayOfWeekStr && s.isFixed
  );
  const nextSlot = todayFixedSlots[0];

  const handleStartTodaySession = () => {
    if (currentActivity) {
      onStartSessionForItem(currentActivity);
    } else {
      setActiveTab('planner');
    }
  };

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
      {/* PRIMARY ACTION HERO: TODAY'S MISSION COMMAND CENTER */}
      <div 
        id="dashboard-primary-mission-hero"
        className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-2 border-indigo-500/50 rounded-2xl p-6 sm:p-7 shadow-lg relative overflow-hidden"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-800/40">
                Primary Mission • {formatDateReadable(todayStr)}
              </span>
              <span className="text-xs text-slate-400">Semester {state.activeSemesterId}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {currentActivity ? (
                <span>Next Focus: <span className="text-indigo-300">{currentActivity.title}</span></span>
              ) : items.length > 0 ? (
                <span>All Mission Tasks Completed!</span>
              ) : (
                <span>Today's Mission Awaiting Activation</span>
              )}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {currentActivity ? (
                <span>
                  Targeting <strong>{currentActivity.plannedMinutes} mins</strong> of deliberate focus. {currentActivity.reason || 'Prerequisites validated and aligned with your daily capacity.'}
                </span>
              ) : items.length > 0 ? (
                <span>You’ve completed all scheduled study blocks today. Outstanding discipline!</span>
              ) : (
                <span>No daily mission active yet. Run the morning check-in to generate today’s adaptive plan matching your real cognitive budget.</span>
              )}
            </p>

            {/* Quick Context Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Remaining Study Capacity: <strong className="text-emerald-300">{remainingStudyHours}h</strong> ({remainingStudyMinutes}m)</span>
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Completed Tasks: <strong className="text-white">{plannedVsActual.completedItems} / {plannedVsActual.totalItems}</strong></span>
              </span>
              {nextSlot && (
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Next Campus: {nextSlot.title} ({nextSlot.startTime})</span>
                </span>
              )}
            </div>
          </div>

          {/* Primary Action Button: START TODAY'S SESSION */}
          <div className="shrink-0 flex flex-col items-start lg:items-end gap-3">
            <button
              id="start-today-session-btn"
              onClick={handleStartTodaySession}
              className="px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-sm rounded-xl shadow-xl flex items-center gap-2.5 transition-all transform hover:scale-[1.02] cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>START TODAY'S SESSION</span>
            </button>

            <button
              onClick={() => setActiveTab('planner')}
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
            >
              <span>Open Planner / Modify Day</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Progress Bar & Current vs Next Activity Breakdown */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Daily Mission Progress</span>
              <span className="font-mono text-emerald-400 font-bold">{plannedVsActual.completionRate}% Done</span>
            </div>
            <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${plannedVsActual.completionRate}%` }}
              />
            </div>
          </div>

          {/* Current & Next Activity Bento Strip */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
              <div className="space-y-1 min-w-0 pr-2">
                <div className="text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  <span>Current Activity</span>
                </div>
                <div className="text-xs font-semibold text-white truncate">
                  {currentActivity?.title || 'None active'}
                </div>
                {currentActivity && (
                  <div className="flex items-center gap-2">
                    {getActivityBadge(currentActivity.activityType)}
                    <span className="text-[10px] text-slate-400 font-mono">
                      {currentActivity.scheduledTime} – {currentActivity.endTime}
                    </span>
                  </div>
                )}
              </div>
              {currentActivity && (
                <button
                  onClick={() => onStartSessionForItem(currentActivity)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Focus</span>
                </button>
              )}
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
              <div className="space-y-1 min-w-0">
                <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  <span>Next Activity</span>
                </div>
                <div className="text-xs font-semibold text-slate-300 truncate">
                  {nextActivity?.title || (items.length > 0 ? 'No more tasks remaining' : 'Plan your day in Planner')}
                </div>
                {nextActivity && (
                  <div className="flex items-center gap-2">
                    {getActivityBadge(nextActivity.activityType)}
                    <span className="text-[10px] text-slate-400 font-mono">
                      {nextActivity.scheduledTime} ({nextActivity.plannedMinutes}m)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2-COLUMN MAIN CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Mission Items List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-indigo-400" />
              <h2 className="text-base font-bold text-white">Full Daily Schedule</h2>
            </div>
            <button
              onClick={() => setActiveTab('planner')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              Open Daily Planner & Check-In →
            </button>
          </div>

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
                <span>Open Planner & Begin Check-In</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {items.map((item) => {
                const subject = state.subjects.find((s) => s.id === item.subjectId);
                const isCompleted = item.status === 'completed';
                const isCurrent = currentActivity?.id === item.id;

                return (
                  <div
                    key={item.id}
                    id={`mission-item-${item.id}`}
                    className={`border rounded-xl p-3.5 transition-all flex items-center justify-between gap-3 ${
                      isCompleted 
                        ? 'border-slate-800/80 bg-slate-900/40 opacity-75' 
                        : isCurrent
                        ? 'border-indigo-500 bg-indigo-950/20 shadow-md'
                        : item.isBreak
                        ? 'border-slate-800/60 bg-slate-950/40 text-slate-400'
                        : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {!item.isBreak ? (
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
                      ) : (
                        <Coffee className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
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
                              {item.scheduledTime} – {item.endTime}
                            </span>
                          )}
                          {getActivityBadge(item.activityType)}
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
                      <div className="text-right font-mono">
                        <div className="text-xs font-semibold text-slate-200">
                          {item.actualMinutes > 0 ? `${item.actualMinutes}m / ` : ''}{item.plannedMinutes}m
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.actualMinutes > 0 ? 'Logged' : 'Target'}
                        </div>
                      </div>

                      {!isCompleted && !item.isBreak && (
                        <button
                          onClick={() => onStartSessionForItem(item)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
                          title="Start focus session"
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
                <strong className="text-indigo-300 font-semibold block mb-0.5">NEXORA Scheduling Advisory Strategy</strong>
                {todaysMission.aiProposalRationale}
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Fixed Campus Commitments & Weekly Subject Pacing */}
        <div className="space-y-6">
          {/* Upcoming Fixed Campus Commitment */}
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('weekly_review')}
                  className="text-[11px] text-emerald-400 hover:underline font-semibold"
                >
                  Weekly Review
                </button>
                <span className="text-slate-600">•</span>
                <button
                  onClick={() => setActiveTab('progress')}
                  className="text-[11px] text-indigo-400 hover:underline"
                >
                  Details
                </button>
              </div>
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
        </div>
      </div>
    </div>
  );
};
