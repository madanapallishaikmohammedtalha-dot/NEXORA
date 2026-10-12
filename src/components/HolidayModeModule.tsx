import React, { useState } from 'react';
import {
  Calendar,
  Coffee,
  Code2,
  Terminal,
  Globe,
  Database,
  Cpu,
  GitBranch,
  Briefcase,
  MessageSquare,
  Compass,
  Repeat,
  Plus,
  ArrowRight,
  Target,
  ChevronRight,
  RefreshCw,
  Sun
} from 'lucide-react';
import {
  AppState,
  DayOfWeek,
  Goal,
  HolidayPlan,
  HolidayPlanPreferences,
  HolidayPriority,
} from '../types';
import { dataService } from '../services/dataService';
import { calculateHolidayCapacity, generateHolidayPlan } from '../services/holidayPlanner';

interface HolidayModeModuleProps {
  state: AppState;
  onNavigateToTab?: (tab: any) => void;
  showToast?: (message: string) => void;
}

const PRIORITY_OPTIONS: Array<{ id: HolidayPriority; label: string; icon: any; color: string }> = [
  { id: 'dsa', label: 'DSA', icon: Code2, color: 'text-amber-400 border-amber-500/40 bg-amber-950/20' },
  { id: 'aiml', label: 'AI/ML', icon: Cpu, color: 'text-purple-400 border-purple-500/40 bg-purple-950/20' },
  { id: 'web_dev', label: 'Web development', icon: Globe, color: 'text-blue-400 border-blue-500/40 bg-blue-950/20' },
  { id: 'backend_dev', label: 'Backend development', icon: Database, color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20' },
  { id: 'projects', label: 'Projects', icon: Terminal, color: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/20' },
  { id: 'git_github', label: 'Git/GitHub', icon: GitBranch, color: 'text-orange-400 border-orange-500/40 bg-orange-950/20' },
  { id: 'internship_prep', label: 'Internship preparation', icon: Briefcase, color: 'text-indigo-400 border-indigo-500/40 bg-indigo-950/20' },
  { id: 'communication', label: 'Communication', icon: MessageSquare, color: 'text-rose-400 border-rose-500/40 bg-rose-950/20' },
  { id: 'career_exploration', label: 'Career exploration', icon: Compass, color: 'text-yellow-400 border-yellow-500/40 bg-yellow-950/20' },
  { id: 'revision', label: 'Revision', icon: Repeat, color: 'text-teal-400 border-teal-500/40 bg-teal-950/20' },
  { id: 'rest', label: 'Rest', icon: Coffee, color: 'text-lime-400 border-lime-500/40 bg-lime-950/20' },
];

const DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const HolidayModeModule: React.FC<HolidayModeModuleProps> = ({
  state,
  onNavigateToTab,
  showToast = (msg) => console.log(msg),
}) => {
  const activeSemester = state.semesters.find((s) => s.id === state.activeSemesterId) || state.semesters[0];

  const defaultHolidayStart = activeSemester?.holidayStartDate || '2026-10-01';
  const defaultHolidayEnd = activeSemester?.holidayEndDate || '2026-10-28';
  const defaultNextStart = activeSemester?.nextSemesterStartDate || '2026-11-02';

  // Active or stored holiday plan
  const [currentPlan, setCurrentPlan] = useState<HolidayPlan | undefined>(() => {
    return dataService.getHolidayPlan();
  });

  // Preferences form state
  const holidayStart = defaultHolidayStart;
  const holidayEnd = defaultHolidayEnd;
  const nextSemesterStart = defaultNextStart;
  const [selectedPriorities, setSelectedPriorities] = useState<HolidayPriority[]>(
    currentPlan?.preferences.selectedPriorities || ['dsa', 'projects', 'git_github', 'rest']
  );
  const [weeklyHours, setWeeklyHours] = useState(currentPlan?.preferences.weeklyAvailableHours || 15);
  const [dailyCap, setDailyCap] = useState(currentPlan?.preferences.maxDailyCapacityHours || 3.0);
  const [preferredTime, setPreferredTime] = useState<'morning' | 'afternoon' | 'evening' | 'flexible'>(
    currentPlan?.preferences.preferredStudyTime || 'morning'
  );
  const [daysOff, setDaysOff] = useState<DayOfWeek[]>(
    currentPlan?.preferences.daysOff || ['saturday', 'sunday']
  );

  // New Goal State
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalTarget, setNewGoalTarget] = useState(20);
  const [newGoalUnit, setNewGoalUnit] = useState('problems');

  // Capacity projection
  const capacityPreview = calculateHolidayCapacity({
    startDate: holidayStart,
    endDate: holidayEnd,
    weeklyAvailableHours: weeklyHours,
    maxDailyCapacityHours: dailyCap,
    daysOff,
    preferredStudyTime: preferredTime,
    selectedPriorities,
  });

  const togglePriority = (p: HolidayPriority) => {
    if (selectedPriorities.includes(p)) {
      if (selectedPriorities.length > 1) {
        setSelectedPriorities(selectedPriorities.filter((item) => item !== p));
      }
    } else {
      setSelectedPriorities([...selectedPriorities, p]);
    }
  };

  const toggleDayOff = (day: DayOfWeek) => {
    if (daysOff.includes(day)) {
      setDaysOff(daysOff.filter((d) => d !== day));
    } else {
      setDaysOff([...daysOff, day]);
    }
  };

  const handleGeneratePlan = () => {
    const preferences: HolidayPlanPreferences = {
      startDate: holidayStart,
      endDate: holidayEnd,
      nextSemesterStartDate: nextSemesterStart,
      selectedPriorities,
      weeklyAvailableHours: weeklyHours,
      maxDailyCapacityHours: dailyCap,
      preferredStudyTime: preferredTime,
      daysOff,
    };

    const newPlan = generateHolidayPlan(preferences, state, activeSemester?.id || 'sem-prev');
    dataService.saveHolidayPlan(newPlan);
    setCurrentPlan(newPlan);
    showToast('Holiday focus plan generated and activated!');
  };

  const handleIncrementGoal = (goalId: string) => {
    if (!currentPlan) return;
    const updatedGoals = currentPlan.holidayGoals.map((g) => {
      if (g.id === goalId) {
        const nextVal = Math.min(g.targetValue, g.currentValue + 1);
        const status = nextVal >= g.targetValue ? ('completed' as const) : ('active' as const);
        return { ...g, currentValue: nextVal, status };
      }
      return g;
    });

    const updatedPlan: HolidayPlan = { ...currentPlan, holidayGoals: updatedGoals };
    dataService.saveHolidayPlan(updatedPlan);
    setCurrentPlan(updatedPlan);
    showToast('Goal progress updated!');
  };

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim() || !currentPlan) return;

    const newGoal: Goal = {
      id: `hgoal-${Date.now()}`,
      title: newGoalTitle.trim(),
      targetValue: newGoalTarget,
      currentValue: 0,
      unit: newGoalUnit,
      horizon: 'monthly',
      deadline: holidayEnd,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const updatedPlan: HolidayPlan = {
      ...currentPlan,
      holidayGoals: [...currentPlan.holidayGoals, newGoal],
    };
    dataService.saveHolidayPlan(updatedPlan);
    setCurrentPlan(updatedPlan);
    setNewGoalTitle('');
    setIsAddingGoal(false);
    showToast('Added holiday milestone goal!');
  };

  return (
    <div className="space-y-7 pb-12 max-w-7xl mx-auto">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-900 border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800/60 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>SEMESTER BREAK</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {holidayStart} → {holidayEnd}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Holiday Mode & Independent Learning Planner
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              No mandatory campus classes or commute bottlenecks. Set your independent focus areas, reserve rest days, and build portfolio momentum sustainably.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGeneratePlan}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/25 flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{currentPlan ? 'Regenerate Holiday Plan' : 'Generate Holiday Focus Plan'}</span>
            </button>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('semester')}
                className="px-5 py-2.5 bg-slate-900/90 hover:bg-slate-800 text-indigo-300 hover:text-indigo-200 border border-indigo-500/40 hover:border-indigo-400 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
                <span>Begin Next Semester Setup</span>
              </button>
            )}
          </div>
        </div>

        {/* Holiday Duration Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-emerald-900/40 mt-6 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-emerald-900/40">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Holiday Starts:</span>
            <span className="font-mono text-white font-bold">{holidayStart}</span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-emerald-900/40">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Holiday Ends:</span>
            <span className="font-mono text-white font-bold">{holidayEnd}</span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-emerald-900/40">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Available Days:</span>
            <span className="font-mono text-emerald-300 font-bold">{capacityPreview.availableDays} days ({capacityPreview.totalStudyDays} study, {capacityPreview.restDaysCount} rest)</span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-xl border border-emerald-900/40 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Next Semester:</span>
              <span className="font-mono text-indigo-300 font-bold">{nextSemesterStart}</span>
            </div>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('semester')}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Begin Next Semester Setup"
              >
                <span>Setup</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Priority Selection & Capacity Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Chips Selection */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Holiday Focus Priorities
              </h2>
              <p className="text-xs text-slate-400">
                Choose the domains you want to master during this break (multiple allowed).
              </p>
            </div>
            <span className="text-xs text-emerald-400 font-mono">
              {selectedPriorities.length} selected
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {PRIORITY_OPTIONS.map((opt) => {
              const isSelected = selectedPriorities.includes(opt.id);
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => togglePriority(opt.id)}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? `${opt.color} shadow-sm ring-1 ring-emerald-500/30`
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-semibold">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Schedule & Capacity Constraints */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3">
            Sustainable Capacity Settings
          </h2>

          <div className="space-y-3.5 text-xs">
            <div>
              <div className="flex justify-between text-slate-300 font-semibold mb-1">
                <span>Weekly Available Hours</span>
                <span className="text-emerald-400 font-mono">{weeklyHours}h / week</span>
              </div>
              <input
                type="range"
                min="5"
                max="35"
                step="1"
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 font-semibold mb-1">
                <span>Daily Study Ceiling</span>
                <span className="text-indigo-400 font-mono">{dailyCap}h / day</span>
              </div>
              <input
                type="range"
                min="1"
                max="6"
                step="0.5"
                value={dailyCap}
                onChange={(e) => setDailyCap(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Preferred Study Window</label>
              <select
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500"
              >
                <option value="morning">Morning (Fresh focus, zero distractions)</option>
                <option value="afternoon">Afternoon (Post-lunch build blocks)</option>
                <option value="evening">Evening (Late-night flow sessions)</option>
                <option value="flexible">Flexible (Spread throughout the day)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1.5">
                Days Completely Off (Protected Rest)
              </label>
              <div className="grid grid-cols-4 gap-1.5 font-mono text-[11px]">
                {DAYS.map((day) => {
                  const isOff = daysOff.includes(day);
                  return (
                    <button
                      key={day}
                      onClick={() => toggleDayOff(day)}
                      className={`py-1 rounded-lg border text-center uppercase font-bold transition-all cursor-pointer ${
                        isOff
                          ? 'bg-amber-950/60 border-amber-800 text-amber-300'
                          : 'bg-slate-950/40 border-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. HOLIDAY PLANNER: REALISTIC WEEKLY FOCUS AREAS */}
      {currentPlan && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-black text-white tracking-tight">
                  HOLIDAY PLANNER — WEEKLY FOCUS BLOCKS
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Paced, realistic weekly themes that leave ample room for rest and leisure without burnout.
              </p>
            </div>

            <div className="text-xs text-slate-400 font-mono bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800">
              Total Budget: ~{capacityPreview.totalAvailableHours}h across {currentPlan.weeks.length} weeks
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentPlan.weeks.map((week) => (
              <div
                key={week.weekNumber}
                className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5 space-y-3.5 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                      Week {week.weekNumber}
                    </span>
                    <span className="text-xs font-bold text-white truncate">{week.title}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    {week.plannedHours}h target
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Core Study Focus:
                  </span>
                  <div className="space-y-1.5">
                    {week.suggestedTasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-start justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="font-semibold text-slate-200 block">{t.title}</span>
                          <span className="text-[11px] text-slate-400">{t.reason}</span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40 shrink-0">
                          {t.estimatedMinutes}m
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
                  <span className="flex items-center gap-1 text-amber-400">
                    <Coffee className="w-3.5 h-3.5" />
                    <span>Rest days: {week.restDays.map((d) => d.slice(0, 3)).join(', ') || 'Flexible'}</span>
                  </span>
                  <span className="text-slate-500">Unconstrained by campus</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. HOLIDAY MILESTONE GOALS */}
      {currentPlan && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-black text-white tracking-tight">
                  HOLIDAY MILESTONE GOALS
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Track progress against concrete holiday achievements with evidence logs.
              </p>
            </div>

            <button
              onClick={() => setIsAddingGoal(!isAddingGoal)}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Holiday Goal</span>
            </button>
          </div>

          {/* New Goal Form */}
          {isAddingGoal && (
            <form onSubmit={handleAddGoal} className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Goal Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Complete 40 DSA problems or Build one Java project"
                    value={newGoalTitle}
                    onChange={(e) => setNewGoalTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Target & Unit</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={newGoalTarget}
                      onChange={(e) => setNewGoalTarget(Number(e.target.value))}
                      className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-mono"
                    />
                    <input
                      type="text"
                      value={newGoalUnit}
                      onChange={(e) => setNewGoalUnit(e.target.value)}
                      placeholder="problems"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-mono"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingGoal(false)}
                  className="px-3 py-1 text-slate-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold"
                >
                  Save Goal
                </button>
              </div>
            </form>
          )}

          {/* Goal Cards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {currentPlan.holidayGoals.map((goal) => {
              const pct = goal.targetValue > 0 ? Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100)) : 0;
              const isDone = goal.status === 'completed' || pct >= 100;
              return (
                <div
                  key={goal.id}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-white">{goal.title}</span>
                    <button
                      onClick={() => handleIncrementGoal(goal.id)}
                      disabled={isDone}
                      className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded text-[11px] font-bold cursor-pointer transition-colors disabled:opacity-40"
                    >
                      +1 Log
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">{goal.currentValue} / {goal.targetValue} {goal.unit}</span>
                      <span className={isDone ? 'text-emerald-400 font-bold' : 'text-slate-300'}>{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isDone ? 'bg-emerald-400' : 'bg-indigo-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {goal.description && (
                    <p className="text-[11px] text-slate-500">{goal.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
