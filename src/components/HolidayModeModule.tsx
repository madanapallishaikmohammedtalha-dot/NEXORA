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

const PRIORITY_OPTIONS: Array<{ id: HolidayPriority; label: string; icon: any }> = [
  { id: 'dsa', label: 'DSA', icon: Code2 },
  { id: 'aiml', label: 'AI/ML', icon: Cpu },
  { id: 'web_dev', label: 'Web development', icon: Globe },
  { id: 'backend_dev', label: 'Backend development', icon: Database },
  { id: 'projects', label: 'Projects', icon: Terminal },
  { id: 'git_github', label: 'Git/GitHub', icon: GitBranch },
  { id: 'internship_prep', label: 'Internship preparation', icon: Briefcase },
  { id: 'communication', label: 'Communication', icon: MessageSquare },
  { id: 'career_exploration', label: 'Career exploration', icon: Compass },
  { id: 'revision', label: 'Revision', icon: Repeat },
  { id: 'rest', label: 'Rest', icon: Coffee },
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
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#16845B] bg-[#ECFDF5] px-3 py-1 rounded-full border border-[#A7F3D0] flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-[#A6630A]" />
                <span>SEMESTER BREAK</span>
              </span>
              <span className="text-xs text-[#667085] font-mono">
                {holidayStart} → {holidayEnd}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-[#242938] tracking-tight">
              Holiday Mode & Independent Learning Planner
            </h1>
            <p className="text-xs sm:text-sm text-[#667085] max-w-2xl leading-relaxed">
              No mandatory campus classes or commute bottlenecks. Set your independent focus areas, reserve rest days, and build portfolio momentum sustainably.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGeneratePlan}
              className="px-5 py-2.5 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-xl text-xs font-semibold transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{currentPlan ? 'Regenerate Holiday Plan' : 'Generate Holiday Focus Plan'}</span>
            </button>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('semester')}
                className="px-5 py-2.5 bg-white hover:bg-[#F5F6FA] text-[#242938] hover:text-[#5865D8] border border-[#E5E7EB] rounded-xl text-xs font-semibold transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5 text-[#5865D8]" />
                <span>Begin Next Semester Setup</span>
              </button>
            )}
          </div>
        </div>

        {/* Holiday Duration Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-[#E5E7EB] mt-6 text-xs">
          <div className="bg-[#F5F6FA] p-3 rounded-xl border border-[#E5E7EB]">
            <span className="text-[10px] text-[#667085] uppercase font-bold block">Holiday Starts:</span>
            <span className="font-mono text-[#242938] font-bold">{holidayStart}</span>
          </div>
          <div className="bg-[#F5F6FA] p-3 rounded-xl border border-[#E5E7EB]">
            <span className="text-[10px] text-[#667085] uppercase font-bold block">Holiday Ends:</span>
            <span className="font-mono text-[#242938] font-bold">{holidayEnd}</span>
          </div>
          <div className="bg-[#F5F6FA] p-3 rounded-xl border border-[#E5E7EB]">
            <span className="text-[10px] text-[#667085] uppercase font-bold block">Available Days:</span>
            <span className="font-mono text-[#16845B] font-bold">{capacityPreview.availableDays} days ({capacityPreview.totalStudyDays} study, {capacityPreview.restDaysCount} rest)</span>
          </div>
          <div className="bg-[#F5F6FA] p-3 rounded-xl border border-[#E5E7EB] flex items-center justify-between">
            <div>
              <span className="text-[10px] text-[#667085] uppercase font-bold block">Next Semester:</span>
              <span className="font-mono text-[#5865D8] font-bold">{nextSemesterStart}</span>
            </div>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('semester')}
                className="text-[11px] text-[#5865D8] hover:text-[#4854C4] font-bold flex items-center gap-1 cursor-pointer transition-colors"
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
        <div className="lg:col-span-2 bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-bold text-[#242938] uppercase tracking-wider">
                Holiday Focus Priorities
              </h2>
              <p className="text-xs text-[#667085]">
                Choose the domains you want to master during this break (multiple allowed).
              </p>
            </div>
            <span className="text-xs text-[#5865D8] font-mono font-semibold">
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
                      ? 'bg-[#EEF0FF] border-[#5865D8]/40 text-[#5865D8] shadow-xs'
                      : 'bg-[#F5F6FA] border-[#E5E7EB] text-[#667085] hover:text-[#242938] hover:bg-[#EEF0FF]/30'
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
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-xs">
          <h2 className="text-sm font-bold text-[#242938] uppercase tracking-wider border-b border-[#E5E7EB] pb-3">
            Sustainable Capacity Settings
          </h2>

          <div className="space-y-3.5 text-xs">
            <div>
              <div className="flex justify-between text-[#242938] font-semibold mb-1">
                <span>Weekly Available Hours</span>
                <span className="text-[#5865D8] font-mono">{weeklyHours}h / week</span>
              </div>
              <input
                type="range"
                min="5"
                max="35"
                step="1"
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(Number(e.target.value))}
                className="w-full accent-[#5865D8]"
              />
            </div>

            <div>
              <div className="flex justify-between text-[#242938] font-semibold mb-1">
                <span>Daily Study Ceiling</span>
                <span className="text-[#5865D8] font-mono">{dailyCap}h / day</span>
              </div>
              <input
                type="range"
                min="1"
                max="6"
                step="0.5"
                value={dailyCap}
                onChange={(e) => setDailyCap(Number(e.target.value))}
                className="w-full accent-[#5865D8]"
              />
            </div>

            <div>
              <label className="text-[#242938] font-semibold block mb-1">Preferred Study Window</label>
              <select
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value as any)}
                className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#242938] text-xs focus:outline-none focus:border-[#5865D8]"
              >
                <option value="morning">Morning (Fresh focus, zero distractions)</option>
                <option value="afternoon">Afternoon (Post-lunch build blocks)</option>
                <option value="evening">Evening (Late-night flow sessions)</option>
                <option value="flexible">Flexible (Spread throughout the day)</option>
              </select>
            </div>

            <div>
              <label className="text-[#242938] font-semibold block mb-1.5">
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
                          ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#A6630A]'
                          : 'bg-[#F5F6FA] border-[#E5E7EB] text-[#667085] hover:text-[#242938]'
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
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-7 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#5865D8]" />
                <h2 className="text-lg font-bold text-[#242938] tracking-tight">
                  HOLIDAY PLANNER — WEEKLY FOCUS BLOCKS
                </h2>
              </div>
              <p className="text-xs text-[#667085]">
                Paced, realistic weekly themes that leave ample room for rest and leisure without burnout.
              </p>
            </div>

            <div className="text-xs text-[#667085] font-mono bg-[#F5F6FA] px-3 py-1.5 rounded-xl border border-[#E5E7EB]">
              Total Budget: ~{capacityPreview.totalAvailableHours}h across {currentPlan.weeks.length} weeks
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentPlan.weeks.map((week) => (
              <div
                key={week.weekNumber}
                className="bg-[#F5F6FA] border border-[#E5E7EB] rounded-2xl p-5 space-y-3.5 relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#EEF0FF] text-[#5865D8] border border-[#5865D8]/20">
                      Week {week.weekNumber}
                    </span>
                    <span className="text-xs font-bold text-[#242938] truncate">{week.title}</span>
                  </div>
                  <span className="text-xs font-mono text-[#667085]">
                    {week.plannedHours}h target
                  </span>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-[#667085] block">
                    Core Study Focus:
                  </span>
                  <div className="space-y-1.5">
                    {week.suggestedTasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-2.5 rounded-xl bg-white border border-[#E5E7EB] flex items-start justify-between gap-2 text-xs shadow-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="font-semibold text-[#242938] block">{t.title}</span>
                          <span className="text-[11px] text-[#667085]">{t.reason}</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#16845B] bg-[#ECFDF5] px-1.5 py-0.5 rounded border border-[#A7F3D0] shrink-0">
                          {t.estimatedMinutes}m
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-[11px] text-[#667085] flex items-center justify-between pt-1 border-t border-[#E5E7EB]">
                  <span className="flex items-center gap-1 text-[#A6630A]">
                    <Coffee className="w-3.5 h-3.5" />
                    <span>Rest days: {week.restDays.map((d) => d.slice(0, 3)).join(', ') || 'Flexible'}</span>
                  </span>
                  <span className="text-[#667085]">Unconstrained by campus</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. HOLIDAY MILESTONE GOALS */}
      {currentPlan && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-7 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-[#5865D8]" />
                <h2 className="text-lg font-bold text-[#242938] tracking-tight">
                  HOLIDAY MILESTONE GOALS
                </h2>
              </div>
              <p className="text-xs text-[#667085]">
                Track progress against concrete holiday achievements with evidence logs.
              </p>
            </div>

            <button
              onClick={() => setIsAddingGoal(!isAddingGoal)}
              className="px-3.5 py-1.5 bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Holiday Goal</span>
            </button>
          </div>

          {/* New Goal Form */}
          {isAddingGoal && (
            <form onSubmit={handleAddGoal} className="bg-[#F5F6FA] border border-[#E5E7EB] p-4 rounded-xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="text-[10px] uppercase font-bold text-[#667085] block mb-1">Goal Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Complete 40 DSA problems or Build one Java project"
                    value={newGoalTitle}
                    onChange={(e) => setNewGoalTitle(e.target.value)}
                    className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-[#242938] focus:border-[#5865D8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#667085] block mb-1">Target & Unit</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={newGoalTarget}
                      onChange={(e) => setNewGoalTarget(Number(e.target.value))}
                      className="w-20 bg-white border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-[#242938] font-mono focus:border-[#5865D8] focus:outline-none"
                    />
                    <input
                      type="text"
                      value={newGoalUnit}
                      onChange={(e) => setNewGoalUnit(e.target.value)}
                      placeholder="problems"
                      className="flex-1 bg-white border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-[#242938] font-mono focus:border-[#5865D8] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingGoal(false)}
                  className="px-3 py-1 text-[#667085] hover:text-[#242938] text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-lg text-xs font-semibold cursor-pointer"
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
                  className="p-4 rounded-xl bg-white border border-[#E5E7EB] space-y-2.5 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-[#242938]">{goal.title}</span>
                    <button
                      onClick={() => handleIncrementGoal(goal.id)}
                      disabled={isDone}
                      className="px-2.5 py-1 bg-[#EEF0FF] hover:bg-[#E0E4FC] text-[#5865D8] border border-[#5865D8]/20 rounded text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-40"
                    >
                      +1 Log
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-[#667085]">{goal.currentValue} / {goal.targetValue} {goal.unit}</span>
                      <span className={isDone ? 'text-[#16845B] font-bold' : 'text-[#242938]'}>{pct}%</span>
                    </div>
                    <div className="w-full bg-[#F5F6FA] h-1.5 rounded-full overflow-hidden border border-[#E5E7EB]">
                      <div
                        className={`h-full rounded-full ${isDone ? 'bg-[#16845B]' : 'bg-[#5865D8]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {goal.description && (
                    <p className="text-[11px] text-[#667085]">{goal.description}</p>
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
