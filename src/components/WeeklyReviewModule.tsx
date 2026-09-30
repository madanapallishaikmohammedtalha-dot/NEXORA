import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Brain,
  Zap,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Info,
  Check,
  X,
  Target,
  BookOpen,
  Award,
  Layers,
  HelpCircle,
  Lightbulb,
  AlertCircle
} from 'lucide-react';
import {
  AppState,
  NextWeekProposedItem,
  WeeklyAnalyticsReport,
  AIWeeklyReviewResponse,
} from '../types';
import { dataService } from '../services/dataService';
import { requestAIWeeklyReview, generateDeterministicAIWeeklyReview, buildWeeklyReviewAIContext } from '../services/ai/weeklyReviewService';

interface WeeklyReviewModuleProps {
  state: AppState;
  onNavigateToTab?: (tab: any) => void;
  showToast?: (message: string) => void;
}

export const WeeklyReviewModule: React.FC<WeeklyReviewModuleProps> = ({
  state,
  onNavigateToTab,
  showToast = (msg) => console.log(msg),
}) => {
  // Reference date for review (Monday of active week)
  const [referenceDate, setReferenceDate] = useState<string>('2026-09-21');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiReview, setAiReview] = useState<AIWeeklyReviewResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Compute deterministic report
  const report: WeeklyAnalyticsReport = useMemo(() => {
    return dataService.getWeeklyAnalytics(referenceDate);
  }, [state, referenceDate]);

  // Next-week proposals state (editable, manageable)
  const [nextWeekItems, setNextWeekItems] = useState<NextWeekProposedItem[]>(() => {
    return dataService.getNextWeekProposals(referenceDate);
  });

  // Re-generate proposals if reference date changes
  useEffect(() => {
    setNextWeekItems(dataService.getNextWeekProposals(referenceDate));
    setAiReview(null);
  }, [referenceDate]);

  // Handle request for AI Meta-Review
  const handleGenerateAIReview = async () => {
    setIsAiLoading(true);
    setAiError(null);
    try {
      const response = await requestAIWeeklyReview(report, state);
      setAiReview(response);
      showToast('AI Weekly Review & Meta-Cognitive Insights generated.');
    } catch (err: any) {
      console.error('Failed to generate AI weekly review:', err);
      setAiError(err.message || 'AI review generation failed. Using local engine.');
      const fallback = generateDeterministicAIWeeklyReview(buildWeeklyReviewAIContext(report, state), report);
      setAiReview(fallback);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Next-week proposal actions: Accept, Modify, Remove, Regenerate
  const handleAcceptItem = (id: string) => {
    setNextWeekItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'accepted' } : item))
    );
    showToast('Plan recommendation accepted.');
  };

  const handleModifyItem = (id: string, deltaSessions: number) => {
    setNextWeekItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newSessions = Math.max(1, Math.min(7, item.targetSessions + deltaSessions));
          return { ...item, targetSessions: newSessions, status: 'modified' };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setNextWeekItems((prev) => prev.filter((item) => item.id !== id));
    showToast('Removed recommendation from next-week plan.');
  };

  const handleRegenerateProposals = () => {
    const fresh = dataService.getNextWeekProposals(referenceDate);
    setNextWeekItems(fresh);
    showToast('Regenerated proposed study focus items from live data.');
  };

  // Commit accepted items to next week's mission (e.g. Next Monday 2026-09-28)
  const handleCommitNextWeekPlan = () => {
    const nextMonday = '2026-09-28';
    const accepted = nextWeekItems.filter((i) => i.status !== 'removed');
    if (accepted.length === 0) {
      showToast('No accepted recommendations to commit.');
      return;
    }

    try {
      accepted.forEach((item) => {
        dataService.commitNextWeekItemToMission(nextMonday, item);
      });
      showToast(`Committed ${accepted.length} focus priorities to next week (${nextMonday})!`);
    } catch (err: any) {
      showToast(`Commit error: ${err.message}`);
    }
  };

  // Format hours and minutes
  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="space-y-7 pb-12 max-w-7xl mx-auto">
      {/* 1. Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-400 bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-800/40">
                Weekly Reflection & Adaptation
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {report.weekStartDate} → {report.weekEndDate}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-indigo-400" />
              <span>WEEKLY REVIEW</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Deterministic retrospective of planned vs. actual execution, cognitive retention, and transparent consistency factors.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateAIReview}
              disabled={isAiLoading}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isAiLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing Review...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{aiReview ? 'Regenerate AI Analysis' : 'Run AI Weekly Review'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Primary Metric Scorecards (Clean Visual Hierarchy) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Focused Learning */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Focused Learning</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {formatMins(report.actualStudyMinutes)} <span className="text-slate-500 text-sm font-normal">/ {formatMins(report.plannedStudyMinutes)} planned</span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  report.executionPercentage >= 80 ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
                style={{ width: `${Math.min(100, report.executionPercentage)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Execution Ratio */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Execution</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300 font-mono">
            {report.executionPercentage}%
          </div>
          <div className="text-[11px] text-slate-400">
            {report.executionPercentage >= 80
              ? 'Target capacity honored'
              : `${100 - report.executionPercentage}% shortfall vs plan`}
          </div>
        </div>

        {/* Sessions Completed & Skipped */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Sessions</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {report.completedSessionsCount} <span className="text-xs text-slate-400 font-normal">completed</span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            <span className="text-amber-400">{report.skippedSessionsCount} skipped</span> •{' '}
            <span className="text-rose-400">{report.missedSessionsCount} missed</span>
          </div>
        </div>

        {/* Transparent Consistency Score */}
        <div className="bg-slate-900 border border-indigo-900/40 rounded-2xl p-5 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-indigo-300">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Consistency Score</span>
            <Award className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-300 font-mono">
            {report.consistency.score}%
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {report.consistency.summary}
          </div>
        </div>
      </div>

      {/* 3. Consistency Score Transparent Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Transparent Consistency Breakdown</h2>
          </div>
          <span className="text-xs text-slate-400">
            Based on real stored sessions, duration chunks & reflective ratings
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {report.consistency.factors.map((f) => (
            <div
              key={f.factor}
              className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-1.5"
            >
              <div className="text-[10px] uppercase font-bold text-slate-400 truncate">
                {f.label}
              </div>
              <div className="text-lg font-black font-mono text-white">
                {f.earnedPoints} <span className="text-xs text-slate-500 font-normal">/ {f.maxPoints} pts</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${Math.round((f.earnedPoints / f.maxPoints) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 leading-snug line-clamp-2">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Subject Pacing & Category Time Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject Learning Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              <h2 className="text-base font-bold text-white">Subject Learning Distribution</h2>
            </div>
            <span className="text-xs text-slate-400">{report.subjectBreakdowns.length} Enrolled Courses</span>
          </div>

          <div className="space-y-3">
            {report.subjectBreakdowns.map((sb) => {
              const targetMinutes = sb.targetWeeklyHours * 60;
              const pct = targetMinutes > 0 ? Math.min(100, Math.round((sb.actualMinutes / targetMinutes) * 100)) : 0;
              return (
                <div
                  key={sb.subjectId}
                  className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sb.color }} />
                      <span className="font-bold text-white">{sb.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                        {sb.code}
                      </span>
                    </div>
                    <div className="font-mono text-slate-200 text-[11px]">
                      <strong>{formatMins(sb.actualMinutes)}</strong>{' '}
                      <span className="text-slate-500">/ {sb.targetWeeklyHours}h target</span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: sb.color }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                    <span>
                      {sb.sessionsCount} session{sb.sessionsCount !== 1 ? 's' : ''} logged
                    </span>
                    {sb.averageComprehension > 0 && (
                      <span className="text-amber-400 font-semibold">
                        {sb.averageComprehension}★ average comprehension
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown & Learning Balance */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <h2 className="text-base font-bold text-white">Study Category Balance</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Total {formatMins(report.actualStudyMinutes)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold text-blue-400">Academic Study</span>
              <div className="text-xl font-black font-mono text-white">
                {formatMins(report.academicMinutes)}
              </div>
              <p className="text-[10px] text-slate-400">Coursework & curriculum modules</p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold text-indigo-400">Career & DSA</span>
              <div className="text-xl font-black font-mono text-white">
                {formatMins(report.careerMinutes)}
              </div>
              <p className="text-[10px] text-slate-400">Algorithmic practice & interview prep</p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold text-purple-400">Project Building</span>
              <div className="text-xl font-black font-mono text-white">
                {formatMins(report.projectMinutes)}
              </div>
              <p className="text-[10px] text-slate-400">Software systems & implementations</p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-400">Revision & Recall</span>
              <div className="text-xl font-black font-mono text-white">
                {formatMins(report.revisionMinutes)}
              </div>
              <p className="text-[10px] text-slate-400">Spaced retrieval & misconception review</p>
            </div>
          </div>

          {/* Goal Momentum */}
          <div className="pt-2">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Active Milestone Goals ({report.goalsProgress.length})
            </div>
            {report.goalsProgress.length === 0 ? (
              <div className="text-xs text-slate-500 py-2">No active semester goals configured.</div>
            ) : (
              <div className="space-y-2">
                {report.goalsProgress.slice(0, 3).map((g) => (
                  <div
                    key={g.goalId}
                    className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-200 truncate pr-2">{g.title}</span>
                    <span className="text-slate-400 font-mono shrink-0">
                      {g.currentValue} / {g.targetValue} {g.unit} ({g.progressPercentage}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. Strongest vs Weakest Areas & Deterministic Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strongest Areas */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" />
            <span>Strongest Learning Areas</span>
          </div>
          {report.strongestAreas.length === 0 ? (
            <div className="text-xs text-slate-500 py-2">No strong patterns logged yet this week.</div>
          ) : (
            <div className="space-y-2.5">
              {report.strongestAreas.map((sa) => (
                <div key={sa.subjectCode} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{sa.name} ({sa.subjectCode})</span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                      Score: {sa.score}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{sa.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Needs Attention */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4" />
            <span>Needs Attention & Remediation</span>
          </div>
          {report.weakAreas.length === 0 ? (
            <div className="text-xs text-slate-500 py-2">No critical deficits detected. Steady pace across all subjects.</div>
          ) : (
            <div className="space-y-2.5">
              {report.weakAreas.map((wa) => (
                <div key={wa.subjectCode} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{wa.name} ({wa.subjectCode})</span>
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
                      Deficit
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">{wa.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6. Learning Pattern Detection (Evidence-Based Observations) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-bold text-white">Detected Learning Patterns</h2>
          </div>
          <span className="text-xs text-slate-400">Algorithmic pattern detection from real telemetry</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {report.learningPatterns.map((pat) => (
            <div
              key={pat.id}
              className={`p-4 rounded-xl border space-y-1.5 ${
                pat.severity === 'warning'
                  ? 'bg-amber-950/20 border-amber-800/40'
                  : pat.severity === 'positive'
                  ? 'bg-emerald-950/20 border-emerald-800/40'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {pat.severity === 'warning' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span className="text-xs font-bold text-white">{pat.title}</span>
              </div>
              <p className="text-[11px] text-slate-300">{pat.description}</p>
              <div className="text-[10px] text-slate-400 font-mono bg-slate-900/60 p-2 rounded border border-slate-800/80">
                <strong>Evidence: </strong>{pat.evidence}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Deterministic Observations */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          <Info className="w-4 h-4 text-indigo-400" />
          <span>Factual Weekly Telemetry Insights</span>
        </div>
        <ul className="space-y-1.5 text-xs text-slate-300">
          {report.deterministicObservations.map((obs, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-indigo-400 font-bold">•</span>
              <span>{obs}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 8. AI Meta-Cognitive Review (Advisory Layer) */}
      {aiReview && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border-2 border-indigo-500/40 rounded-2xl p-6 sm:p-7 space-y-5 shadow-xl relative">
          <div className="flex items-center justify-between border-b border-indigo-900/40 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">AI Meta-Cognitive Synthesis</h2>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-300 border border-indigo-700/50">
                Advisory Only
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Human-In-The-Loop Governance</span>
          </div>

          <div className="space-y-3">
            <div className="text-xs text-slate-200 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-indigo-900/40">
              <strong className="text-indigo-300 block mb-1">Executive Interpretation:</strong>
              {aiReview.interpretation}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" />
                  <span>Meta-Learning Observations</span>
                </span>
                <ul className="space-y-1 text-xs text-slate-300">
                  {aiReview.learningObservations.map((obs, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span>{obs}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  <span>Recommended Strategic Priorities</span>
                </span>
                <ul className="space-y-1 text-xs text-slate-300">
                  {aiReview.recommendedPriorities.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-purple-400 font-bold">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {aiReview.distributionSuggestions && (
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
                <strong className="text-slate-400 block mb-0.5">Study Distribution Guidance:</strong>
                {aiReview.distributionSuggestions}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 9. NEXT WEEK PLANNING COMMAND CENTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">NEXT WEEK FOCUS PLAN</h2>
            </div>
            <p className="text-xs text-slate-400">
              Data-grounded focus proposals. You control what enters your schedule: Accept, Modify, or Remove.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerateProposals}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Regenerate</span>
            </button>
            <button
              onClick={handleCommitNextWeekPlan}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Commit Accepted to Planner</span>
            </button>
          </div>
        </div>

        {/* Proposals List */}
        <div className="space-y-3">
          {nextWeekItems.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-xl border transition-all ${
                item.status === 'accepted'
                  ? 'bg-slate-950/80 border-slate-800'
                  : item.status === 'modified'
                  ? 'bg-indigo-950/20 border-indigo-800/40'
                  : 'bg-slate-950/40 border-slate-800/50 opacity-60'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                      {item.subjectCode}
                    </span>
                    <span className="text-xs font-bold text-white truncate">{item.title}</span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {item.targetSessions} session{item.targetSessions > 1 ? 's' : ''} ({item.estimatedMinutesPerSession}m each)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    <strong className="text-slate-500">Reason: </strong>{item.reason}
                  </p>
                </div>

                {/* Human-In-The-Loop Actions: Accept, Modify, Remove */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                    <button
                      onClick={() => handleModifyItem(item.id, -1)}
                      className="px-2 py-1 text-slate-400 hover:text-white text-xs font-mono cursor-pointer"
                      title="Decrease target sessions"
                    >
                      -
                    </button>
                    <span className="px-2 text-xs font-mono font-bold text-white">
                      {item.targetSessions} sess
                    </span>
                    <button
                      onClick={() => handleModifyItem(item.id, 1)}
                      className="px-2 py-1 text-slate-400 hover:text-white text-xs font-mono cursor-pointer"
                      title="Increase target sessions"
                    >
                      +
                    </button>
                  </div>

                  {item.status !== 'accepted' ? (
                    <button
                      onClick={() => handleAcceptItem(item.id)}
                      className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-400 font-semibold px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-800/40 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Accepted</span>
                    </span>
                  )}

                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                    title="Remove from next week plan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
