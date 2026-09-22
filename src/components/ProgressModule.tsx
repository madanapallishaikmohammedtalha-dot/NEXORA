import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Star, 
  Zap, 
  BookOpen, 
  Calendar,
  CheckCircle2,
  Target,
  Flag
} from 'lucide-react';
import { AppState } from '../types';
import { computeWeeklySubjectHours } from '../services/scheduler';

interface ProgressModuleProps {
  state: AppState;
}

export const ProgressModule: React.FC<ProgressModuleProps> = ({ state }) => {
  const weeklyStats = computeWeeklySubjectHours(state);

  // Calculate planned vs actual across all sessions
  const totalActualMinutes = state.sessions.reduce((acc, s) => acc + s.actualDurationMinutes, 0);
  const totalPlannedMinutes = state.sessions.reduce((acc, s) => acc + s.plannedDurationMinutes, 0);

  // Average comprehension & energy
  const avgComprehension = state.sessions.length > 0
    ? (state.sessions.reduce((acc, s) => acc + s.comprehensionRating, 0) / state.sessions.length).toFixed(1)
    : '0.0';

  const avgEnergy = state.sessions.length > 0
    ? (state.sessions.reduce((acc, s) => acc + s.energyRating, 0) / state.sessions.length).toFixed(1)
    : '0.0';

  // Overall topic mastery
  const totalMastery = state.topics.length > 0
    ? Math.round(state.topics.reduce((acc, t) => acc + t.masteryLevel, 0) / state.topics.length)
    : 0;

  const completedTopicsCount = state.topics.filter((t) => t.status === 'completed').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">
          Performance, Pacing & Historical Review
        </div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-400" />
          <span>Learning Analytics & Session Logs</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Tracking planned vs. actual execution and cognitive energy to keep your learning pace sustainable.
        </p>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Planned vs Actual</span>
          </div>
          <div className="text-xl font-mono font-bold text-white">
            {(totalActualMinutes / 60).toFixed(1)}h / {(totalPlannedMinutes / 60).toFixed(1)}h
          </div>
          <div className="text-[10px] text-slate-400">
            {totalActualMinutes >= totalPlannedMinutes ? 'Met planned target' : 'Within budget range'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Curriculum Mastery</span>
          </div>
          <div className="text-xl font-mono font-bold text-emerald-300">
            {totalMastery}%
          </div>
          <div className="text-[10px] text-slate-400">
            {completedTopicsCount} of {state.topics.length} topics mastered
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Star className="w-3.5 h-3.5 text-amber-400" />
            <span>Avg Comprehension</span>
          </div>
          <div className="text-xl font-mono font-bold text-amber-300">
            {avgComprehension} / 5.0
          </div>
          <div className="text-[10px] text-slate-400">From post-session reviews</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span>Avg Flow / Energy</span>
          </div>
          <div className="text-xl font-mono font-bold text-indigo-300">
            {avgEnergy} / 5.0
          </div>
          <div className="text-[10px] text-slate-400">Burnout prevention metric</div>
        </div>
      </div>

      {/* Subject Study Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-base font-bold text-white">Subject Weekly Hours & Target Pacing</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {state.subjects.map((sub) => {
            const stat = weeklyStats[sub.id];
            const actual = stat ? (stat.actualMinutes / 60).toFixed(1) : '0.0';
            const target = sub.targetWeeklyHours;
            const percent = Math.min(100, Math.round(((stat?.actualMinutes || 0) / (target * 60)) * 100));

            return (
              <div key={sub.id} className="bg-slate-800/60 border border-slate-700/60 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sub.color }} />
                    <span className="text-xs font-bold text-white">{sub.code}: {sub.name}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-300">
                    {actual} / {target} hrs
                  </span>
                </div>

                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{ width: `${percent}%`, backgroundColor: sub.color }}
                  />
                </div>

                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>{percent}% of weekly target met</span>
                  <span>Credits: {sub.credits}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Academic & Career Goals Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Academic & Career Goals</h2>
          </div>
          <span className="text-xs text-slate-400">
            {state.goals ? state.goals.filter((g) => g.status === 'completed').length : 0} / {state.goals?.length || 0} Achieved
          </span>
        </div>

        {(!state.goals || state.goals.length === 0) ? (
          <div className="text-center py-6 text-xs text-slate-500">
            No goals configured yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {state.goals.map((goal) => {
              const sub = state.subjects.find((s) => s.id === goal.subjectId);
              const progressPct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
              const isDone = goal.status === 'completed' || progressPct >= 100;

              return (
                <div
                  key={goal.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isDone
                      ? 'bg-emerald-950/20 border-emerald-800/40'
                      : 'bg-slate-800/70 border-slate-700/80'
                  } space-y-2`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                          goal.horizon === 'career'
                            ? 'bg-purple-950 text-purple-300 border border-purple-800/60'
                            : goal.horizon === 'semester'
                            ? 'bg-blue-950 text-blue-300 border border-blue-800/60'
                            : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                        }`}
                      >
                        {goal.horizon}
                      </span>
                      {sub && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                          style={{ backgroundColor: sub.color }}
                        >
                          {sub.code}
                        </span>
                      )}
                    </div>
                    {isDone ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Completed</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-slate-400">
                        {goal.currentValue} / {goal.targetValue} {goal.unit}
                      </span>
                    )}
                  </div>

                  <h3 className="text-xs font-bold text-white leading-snug">{goal.title}</h3>
                  {goal.description && (
                    <p className="text-[11px] text-slate-300 line-clamp-2">{goal.description}</p>
                  )}

                  <div className="pt-1">
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isDone ? 'bg-emerald-400' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historical Session Logs & Reflections */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Session History & Takeaways</h2>
          </div>
          <span className="text-xs text-slate-400">{state.sessions.length} Recorded Sessions</span>
        </div>

        {state.sessions.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-500">
            No focus sessions logged yet. Start a session from the Dashboard or Daily Planner to log your reflections!
          </div>
        ) : (
          <div className="space-y-3">
            {state.sessions.map((sess) => {
              const sub = state.subjects.find((s) => s.id === sess.subjectId);
              const top = state.topics.find((t) => t.id === sess.topicId);

              return (
                <div
                  key={sess.id}
                  className="bg-slate-800/70 border border-slate-700/80 rounded-xl p-4 space-y-2 text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {sub && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white"
                          style={{ backgroundColor: sub.color }}
                        >
                          {sub.code}
                        </span>
                      )}
                      <span className="font-semibold text-white">
                        {top?.title || 'Academic Deep Work Session'}
                      </span>
                      <span className="text-slate-400 text-[11px] font-mono">
                        ({sess.date})
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] font-mono text-slate-300">
                        Planned: {sess.plannedDurationMinutes}m • Actual: <strong>{sess.actualDurationMinutes}m</strong>
                      </span>
                      <div className="flex items-center gap-1 text-amber-400 font-bold">
                        <span>{sess.comprehensionRating}★</span>
                      </div>
                      <div className="flex items-center gap-1 text-indigo-400 font-bold">
                        <span>{sess.energyRating}⚡</span>
                      </div>
                    </div>
                  </div>

                  {sess.keyTakeaways && (
                    <div className="bg-slate-900/80 p-3 rounded-lg text-slate-300 text-[11px] leading-relaxed border border-slate-800">
                      <strong className="text-slate-400">Takeaway: </strong>
                      {sess.keyTakeaways}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
