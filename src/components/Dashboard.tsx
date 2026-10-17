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
  ShieldCheck,
} from 'lucide-react';
import { ActiveTab, AppState, DayOfWeek, MissionItem, ActivityType } from '../types';
import { computePlannedVsActual, computeWeeklySubjectHours, formatDateReadable, getTodayDateString } from '../services/scheduler';
import { deriveDayCapacity } from '../services/plannerEngine';
import { deriveSemesterState } from '../services/semesterAnalytics';

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
  const todayStr = getTodayDateString();
  const capacity = deriveDayCapacity(todayStr, state);
  const todaysMission = state.missions[todayStr];
  const items = todaysMission?.items || [];
  const plannedVsActual = computePlannedVsActual(items);
  const weeklyHours = computeWeeklySubjectHours(state);

  const remainingStudyMinutes = Math.max(0, capacity.netAvailableStudyMinutes - plannedVsActual.actualMinutes);
  const remainingStudyHours = (remainingStudyMinutes / 60).toFixed(1);

  // Active / Upcoming study items (excluding breaks)
  const pendingStudyItems = items.filter((i) => !i.isBreak && i.status !== 'completed' && i.status !== 'skipped');
  const currentActivity = pendingStudyItems[0];
  const nextActivity = pendingStudyItems[1];

  // Derive semester state & transitions
  const activeSemester = state.semesters.find((s) => s.id === state.activeSemesterId) || state.semesters[0];
  const previousSemester = state.semesters.find((s) => s.id !== state.activeSemesterId && (s.status === 'completed' || s.actualEndDate));
  const semesterState = activeSemester ? deriveSemesterState(activeSemester, todayStr) : 'active';
  const isBreakMode = semesterState === 'break' || Boolean(state.activeHolidayPlan);
  const isNewSemester = Boolean(previousSemester && state.semesters.length > 1 && semesterState === 'active');

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
      {/* PRIMARY ACTION HERO: TODAY'S MISSION COMMAND CENTER */}
      <div 
        id="dashboard-primary-mission-hero"
        className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-7 shadow-xs relative overflow-hidden"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {isBreakMode ? (
                <span className="text-xs font-bold uppercase tracking-wider text-[#16845B] bg-[#ECFDF5] px-2.5 py-0.5 rounded-full border border-[#A7F3D0]">
                  SEMESTER BREAK • Holiday Mission
                </span>
              ) : isNewSemester ? (
                <span className="text-xs font-bold uppercase tracking-wider text-[#5865D8] bg-[#EEF0FF] px-2.5 py-0.5 rounded-full border border-[#5865D8]/20">
                  NEW SEMESTER • Today's Mission
                </span>
              ) : (
                <span className="text-xs font-bold uppercase tracking-wider text-[#5865D8] bg-[#EEF0FF] px-2.5 py-0.5 rounded-full border border-[#5865D8]/20">
                  CURRENT SEMESTER • Today's Mission
                </span>
              )}

              {isNewSemester && previousSemester ? (
                <span className="text-xs text-[#667085] font-mono">
                  Current: <strong className="text-[#242938]">{activeSemester?.name}</strong> • Previous: <strong className="text-[#16845B]">{previousSemester.name} ✓ Completed</strong>
                </span>
              ) : (
                <span className="text-xs text-[#667085] font-mono">{activeSemester?.name} • {formatDateReadable(todayStr)}</span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-[#242938] tracking-tight">
              {isBreakMode ? (
                currentActivity ? (
                  <span>Holiday Mission: <span className="text-[#16845B]">{currentActivity.title}</span></span>
                ) : (
                  <span>SEMESTER BREAK • Holiday Mission</span>
                )
              ) : isNewSemester ? (
                currentActivity ? (
                  <span>Next Focus: <span className="text-[#5865D8]">{currentActivity.title}</span></span>
                ) : (
                  <span>NEW SEMESTER • Today's Mission</span>
                )
              ) : (
                currentActivity ? (
                  <span>Next Focus: <span className="text-[#5865D8]">{currentActivity.title}</span></span>
                ) : items.length > 0 ? (
                  <span>All Mission Tasks Completed!</span>
                ) : (
                  <span>CURRENT SEMESTER • Today's Mission</span>
                )
              )}
            </h1>

            <p className="text-xs sm:text-sm text-[#667085] max-w-2xl leading-relaxed">
              {currentActivity ? (
                <span>
                  Targeting <strong className="text-[#242938]">{currentActivity.plannedMinutes} mins</strong> of deliberate focus. {currentActivity.reason || 'Prerequisites validated and aligned with your daily capacity.'}
                </span>
              ) : items.length > 0 ? (
                <span>You’ve completed all scheduled study blocks today. Outstanding discipline!</span>
              ) : (
                <span>No daily mission active yet. Run the morning check-in to generate today’s adaptive plan matching your real cognitive budget.</span>
              )}
            </p>

            {/* Quick Context Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-[#F5F6FA] border border-[#E5E7EB] text-[#242938] flex items-center gap-1.5 shadow-xs">
                <Clock className="w-3.5 h-3.5 text-[#5865D8]" />
                <span className="text-[#667085]">Remaining Capacity: <strong className="text-[#16845B]">{remainingStudyHours}h</strong> ({remainingStudyMinutes}m)</span>
              </span>
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-[#F5F6FA] border border-[#E5E7EB] text-[#242938] flex items-center gap-1.5 shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16845B]" />
                <span className="text-[#667085]">Completed Tasks: <strong className="text-[#242938]">{plannedVsActual.completedItems} / {plannedVsActual.totalItems}</strong></span>
              </span>
              {nextSlot && (
                <span className="text-[11px] px-2.5 py-1 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-[#A6630A] flex items-center gap-1.5 shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#A6630A]" />
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
              className="px-6 py-3.5 bg-[#5865D8] hover:bg-[#4854C4] text-white font-bold text-sm rounded-xl shadow-xs flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>START TODAY'S SESSION</span>
            </button>

            <button
              onClick={() => setActiveTab('planner')}
              className="text-xs text-[#5865D8] hover:text-[#4854C4] flex items-center gap-1 font-semibold"
            >
              <span>Open Planner / Modify Day</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Progress Bar & Current vs Next Activity Breakdown */}
        <div className="mt-6 pt-5 border-t border-[#E5E7EB] space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-[#667085]">
              <span className="font-semibold text-[#242938]">Daily Mission Progress</span>
              <span className="font-mono text-[#16845B] font-bold">{plannedVsActual.completionRate}% Done</span>
            </div>
            <div className="w-full bg-[#F5F6FA] h-2 rounded-full overflow-hidden border border-[#E5E7EB]">
              <div 
                className="bg-[#5865D8] h-full rounded-full transition-all duration-500"
                style={{ width: `${plannedVsActual.completionRate}%` }}
              />
            </div>
          </div>

          {/* Current & Next Activity Bento Strip */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl p-3.5 flex items-center justify-between">
              <div className="space-y-1 min-w-0 pr-2">
                <div className="text-[10px] uppercase font-bold text-[#5865D8] flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  <span>Current Activity</span>
                </div>
                <div className="text-xs font-semibold text-[#242938] truncate">
                  {currentActivity?.title || 'None active'}
                </div>
                {currentActivity && (
                  <div className="flex items-center gap-2">
                    {getActivityBadge(currentActivity.activityType)}
                    <span className="text-[10px] text-[#667085] font-mono">
                      {currentActivity.scheduledTime} – {currentActivity.endTime}
                    </span>
                  </div>
                )}
              </div>
              {currentActivity && (
                <button
                  onClick={() => onStartSessionForItem(currentActivity)}
                  className="px-3 py-1.5 bg-[#5865D8] hover:bg-[#4854C4] text-white text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Focus</span>
                </button>
              )}
            </div>

            <div className="bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl p-3.5 flex items-center justify-between">
              <div className="space-y-1 min-w-0">
                <div className="text-[10px] uppercase font-bold text-[#667085] flex items-center gap-1">
                  <ArrowRight className="w-3 h-3" />
                  <span>Next Activity</span>
                </div>
                <div className="text-xs font-semibold text-[#242938] truncate">
                  {nextActivity?.title || (items.length > 0 ? 'No more tasks remaining' : 'Plan your day in Planner')}
                </div>
                {nextActivity && (
                  <div className="flex items-center gap-2">
                    {getActivityBadge(nextActivity.activityType)}
                    <span className="text-[10px] text-[#667085] font-mono">
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
              <CalendarDays className="w-4 h-4 text-[#5865D8]" />
              <h2 className="text-base font-bold text-[#242938]">Full Daily Schedule</h2>
            </div>
            <button
              onClick={() => setActiveTab('planner')}
              className="text-xs text-[#5865D8] hover:text-[#4854C4] font-semibold"
            >
              Open Daily Planner & Check-In →
            </button>
          </div>

          {items.length === 0 ? (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8 text-center space-y-3 shadow-xs">
              <AlertCircle className="w-8 h-8 text-[#667085] mx-auto opacity-50" />
              <div className="text-sm font-semibold text-[#242938]">No Mission Planned Yet Today</div>
              <p className="text-xs text-[#667085] max-w-sm mx-auto">
                Calculate today's real available time and let NEXORA propose high-leverage topics matching your prerequisites.
              </p>
              <button
                onClick={() => setActiveTab('planner')}
                className="px-4 py-2 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
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
                        ? 'border-[#E5E7EB] bg-[#F5F6FA] text-[#667085]' 
                        : isCurrent
                        ? 'border-[#5865D8] bg-[#EEF0FF]/40 shadow-xs'
                        : item.isBreak
                        ? 'border-[#E5E7EB] bg-[#F5F6FA] text-[#667085]'
                        : 'border-[#E5E7EB] bg-white hover:border-[#5865D8]/50 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {!item.isBreak ? (
                        <button
                          onClick={() => onToggleItemStatus(todayStr, item.id)}
                          className="mt-0.5 text-[#667085] hover:text-[#16845B] transition-colors cursor-pointer"
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-[#16845B]" />
                          ) : (
                            <Circle className="w-5 h-5 text-[#667085]" />
                          )}
                        </button>
                      ) : (
                        <Coffee className="w-5 h-5 text-[#667085] shrink-0 mt-0.5" />
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
                            <span className="text-[11px] font-mono text-[#667085]">
                              {item.scheduledTime} – {item.endTime}
                            </span>
                          )}
                          {getActivityBadge(item.activityType)}
                        </div>

                        <h3 className={`text-sm font-semibold truncate ${isCompleted ? 'line-through text-[#667085]' : 'text-[#242938]'}`}>
                          {item.title}
                        </h3>

                        {item.reason && (
                          <p className="text-xs text-[#667085] truncate mt-0.5">
                            {item.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Time & Action */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right font-mono">
                        <div className="text-xs font-semibold text-[#242938]">
                          {item.actualMinutes > 0 ? `${item.actualMinutes}m / ` : ''}{item.plannedMinutes}m
                        </div>
                        <div className="text-[10px] text-[#667085]">
                          {item.actualMinutes > 0 ? 'Logged' : 'Target'}
                        </div>
                      </div>

                      {!isCompleted && !item.isBreak && (
                        <button
                          onClick={() => onStartSessionForItem(item)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
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
            <div className="bg-[#EEF0FF] border border-[#5865D8]/20 rounded-xl p-4 flex items-start gap-3 shadow-xs">
              <Sparkles className="w-4 h-4 text-[#5865D8] mt-0.5 shrink-0" />
              <div className="text-xs text-[#242938]">
                <strong className="text-[#5865D8] font-semibold block mb-0.5">NEXORA Scheduling Advisory Strategy</strong>
                {todaysMission.aiProposalRationale}
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Fixed Campus Commitments & Weekly Subject Pacing */}
        <div className="space-y-6">
          {/* Upcoming Fixed Campus Commitment */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#667085]">
                Campus Commitment
              </h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#FFFBEB] text-[#A6630A] border border-[#FDE68A]">
                Fixed Block
              </span>
            </div>

            {nextSlot ? (
              <div className="bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#242938]">{nextSlot.title}</span>
                  <span className="text-xs font-mono text-[#A6630A] font-medium">
                    {nextSlot.startTime} - {nextSlot.endTime}
                  </span>
                </div>
                {nextSlot.location && (
                  <div className="flex items-center gap-1.5 text-xs text-[#667085]">
                    <MapPin className="w-3.5 h-3.5 text-[#667085]" />
                    <span>{nextSlot.location}</span>
                  </div>
                )}
                <div className="text-[11px] text-[#667085]">
                  Type: <span className="capitalize text-[#242938]">{nextSlot.type}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-[#667085] py-2">
                No further fixed lectures or labs scheduled for today.
              </div>
            )}

            <button
              onClick={() => setActiveTab('timetable')}
              className="w-full py-2 bg-[#F5F6FA] hover:bg-[#E5E7EB] text-[#242938] rounded-lg text-xs font-medium transition-colors cursor-pointer text-center border border-[#E5E7EB]"
            >
              View Full Weekly Timetable
            </button>
          </div>

          {/* Weekly Subject Pacing */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#667085]">
                Subject Pacing This Week
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('weekly_review')}
                  className="text-[11px] text-[#16845B] hover:underline font-semibold"
                >
                  Weekly Review
                </button>
                <span className="text-[#E5E7EB]">•</span>
                <button
                  onClick={() => setActiveTab('progress')}
                  className="text-[11px] text-[#5865D8] hover:underline"
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
                        <span className="font-semibold text-[#242938] truncate">{sub.code}</span>
                      </div>
                      <span className="text-[#667085] font-mono text-[11px]">
                        {actualHours} / {targetHours}h
                      </span>
                    </div>

                    <div className="w-full bg-[#F5F6FA] h-1.5 rounded-full overflow-hidden border border-[#E5E7EB]">
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
