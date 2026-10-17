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
  Trash2,
  RefreshCw,
  Info,
  Check,
  Target,
  BookOpen,
  Award,
  Layers,
  Lightbulb,
} from 'lucide-react';
import {
  AppState,
  NextWeekProposedItem,
  WeeklyAnalyticsReport,
  AIWeeklyReviewResponse,
} from '../types';
import { dataService } from '../services/dataService';
import { getTodayDateString } from '../services/scheduler';
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
  const referenceDate = useMemo(() => getTodayDateString(), []);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiReview, setAiReview] = useState<AIWeeklyReviewResponse | null>(null);

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
    try {
      const response = await requestAIWeeklyReview(report, state);
      setAiReview(response);
      showToast('AI Weekly Review & Meta-Cognitive Insights generated.');
    } catch (err: any) {
      console.error('Failed to generate AI weekly review:', err);
      showToast('Remote AI review unavailable. Generated deterministic local review.');
      const fallback = generateDeterministicAIWeeklyReview(buildWeeklyReviewAIContext(report, state), report);
      setAiReview(fallback);
    } finally {
      setIsAiLoading(false);
    }
  };

  // State for inline modification
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editSessions, setEditSessions] = useState<number>(2);
  const [editMinutes, setEditMinutes] = useState<number>(45);

  // Next-week proposal actions: Accept, Modify, Skip, Remove, Regenerate
  const handleAcceptItem = (id: string) => {
    setNextWeekItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'accepted' } : item))
    );
    showToast('Plan recommendation accepted.');
  };

  const handleSkipItem = (id: string) => {
    setNextWeekItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'skipped' } : item))
    );
    showToast('Recommendation skipped.');
  };

  const startModifying = (item: NextWeekProposedItem) => {
    setEditingItemId(item.id);
    setEditTitle(item.title);
    setEditSessions(item.targetSessions);
    setEditMinutes(item.estimatedMinutesPerSession);
  };

  const saveModification = (id: string) => {
    setNextWeekItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              title: editTitle.trim() || item.title,
              targetSessions: Math.max(1, Math.min(7, editSessions)),
              estimatedMinutesPerSession: Math.max(15, Math.min(180, editMinutes)),
              status: 'modified',
            }
          : item
      )
    );
    setEditingItemId(null);
    showToast('Plan recommendation modified.');
  };

  const handleModifySessionsQuick = (id: string, deltaSessions: number) => {
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

  // Commit accepted/modified items to next week's mission dynamically
  const handleCommitNextWeekPlan = () => {
    const [y, m, d] = referenceDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const day = date.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const nextMonDate = new Date(y, m - 1, d + diffToMonday + 7);
    const yr = nextMonDate.getFullYear();
    const mo = String(nextMonDate.getMonth() + 1).padStart(2, '0');
    const da = String(nextMonDate.getDate()).padStart(2, '0');
    const nextMonday = `${yr}-${mo}-${da}`;

    const accepted = nextWeekItems.filter((i) => i.status === 'accepted' || i.status === 'modified');
    if (accepted.length === 0) {
      showToast('No accepted recommendations to commit. Accept or modify items first.');
      return;
    }

    try {
      accepted.forEach((item) => {
        dataService.commitNextWeekItemToMission(nextMonday, item);
      });
      showToast(`Committed ${accepted.length} focus priorities to next week (${nextMonday})!`);
      if (onNavigateToTab) {
        onNavigateToTab('planner');
      }
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
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-7 relative overflow-hidden shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5865D8] bg-[#EEF0FF] px-2.5 py-0.5 rounded-full border border-[#5865D8]/20 font-mono">
                Weekly Reflection & Adaptation
              </span>
              <span className="text-xs text-[#667085] font-mono">
                {report.weekStartDate} → {report.weekEndDate}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#242938] tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-[#5865D8]" />
              <span>WEEKLY REVIEW</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#667085] max-w-2xl">
              Deterministic retrospective of planned vs. actual execution, cognitive retention, and transparent consistency factors.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateAIReview}
              disabled={isAiLoading}
              className="px-4 py-2 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#667085]">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Focused Learning</span>
            <Clock className="w-4 h-4 text-[#5865D8]" />
          </div>
          <div className="text-2xl font-bold text-[#242938] font-mono">
            {formatMins(report.actualStudyMinutes)} <span className="text-[#667085] text-sm font-normal">/ {formatMins(report.plannedStudyMinutes)} planned</span>
          </div>
          <div className="text-[11px] text-[#667085] flex items-center gap-1.5">
            <div className="w-full bg-[#F3F4F6] h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  report.executionPercentage >= 80 ? 'bg-[#16845B]' : 'bg-[#A6630A]'
                }`}
                style={{ width: `${Math.min(100, report.executionPercentage)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Execution Ratio */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#667085]">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Execution</span>
            <TrendingUp className="w-4 h-4 text-[#16845B]" />
          </div>
          <div className="text-2xl font-bold text-[#16845B] font-mono">
            {report.executionPercentage}%
          </div>
          <div className="text-[11px] text-[#667085]">
            {report.executionPercentage >= 80
              ? 'Target capacity honored'
              : `${100 - report.executionPercentage}% shortfall vs plan`}
          </div>
        </div>

        {/* Sessions Completed & Skipped */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#667085]">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Sessions</span>
            <CheckCircle2 className="w-4 h-4 text-[#5865D8]" />
          </div>
          <div className="text-2xl font-bold text-[#242938] font-mono">
            {report.completedSessionsCount} <span className="text-xs text-[#667085] font-normal">completed</span>
          </div>
          <div className="text-[11px] text-[#667085] font-mono">
            <span className="text-[#A6630A]">{report.skippedSessionsCount} skipped</span> •{' '}
            <span className="text-[#C43D4B]">{report.missedSessionsCount} missed</span>
          </div>
        </div>

        {/* Transparent Consistency Score */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-2 relative overflow-hidden shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#5865D8]">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Consistency Score</span>
            <Award className="w-4 h-4 text-[#5865D8]" />
          </div>
          <div className="text-2xl font-bold text-[#5865D8] font-mono">
            {report.consistency.score}%
          </div>
          <div className="text-[11px] text-[#667085] truncate">
            {report.consistency.summary}
          </div>
        </div>
      </div>

      {/* 3. Consistency Score Transparent Breakdown */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-[#5865D8]" />
            <h2 className="text-base font-bold text-[#242938]">Transparent Consistency Breakdown</h2>
          </div>
          <span className="text-xs text-[#667085]">
            Based on real stored sessions, duration chunks & reflective ratings
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {report.consistency.factors.map((f) => (
            <div
              key={f.factor}
              className="bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl p-3.5 space-y-1.5"
            >
              <div className="text-[10px] uppercase font-bold text-[#667085] truncate">
                {f.label}
              </div>
              <div className="text-lg font-bold font-mono text-[#242938]">
                {f.earnedPoints} <span className="text-xs text-[#667085] font-normal">/ {f.maxPoints} pts</span>
              </div>
              <div className="w-full bg-[#E5E7EB] h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#5865D8] rounded-full"
                  style={{ width: `${Math.round((f.earnedPoints / f.maxPoints) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-[#667085] leading-snug line-clamp-2">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Subject Pacing & Category Time Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject Learning Breakdown */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#5865D8]" />
              <h2 className="text-base font-bold text-[#242938]">Subject Learning Distribution</h2>
            </div>
            <span className="text-xs text-[#667085]">{report.subjectBreakdowns.length} Enrolled Courses</span>
          </div>

          <div className="space-y-3">
            {report.subjectBreakdowns.map((sb) => {
              const targetMinutes = sb.targetWeeklyHours * 60;
              const pct = targetMinutes > 0 ? Math.min(100, Math.round((sb.actualMinutes / targetMinutes) * 100)) : 0;
              return (
                <div
                  key={sb.subjectId}
                  className="bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sb.color }} />
                      <span className="font-bold text-[#242938]">{sb.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-[#667085] font-mono border border-[#E5E7EB]">
                        {sb.code}
                      </span>
                    </div>
                    <div className="font-mono text-[#242938] text-[11px]">
                      <strong>{formatMins(sb.actualMinutes)}</strong>{' '}
                      <span className="text-[#667085]">/ {sb.targetWeeklyHours}h target</span>
                    </div>
                  </div>

                  <div className="w-full bg-[#E5E7EB] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: sb.color }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#667085] pt-0.5">
                    <span>
                      {sb.sessionsCount} session{sb.sessionsCount !== 1 ? 's' : ''} logged
                    </span>
                    {sb.averageComprehension > 0 && (
                      <span className="text-[#A6630A] font-semibold">
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
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#5865D8]" />
              <h2 className="text-base font-bold text-[#242938]">Study Category Balance</h2>
            </div>
            <span className="text-xs text-[#667085] font-mono">
              Total {formatMins(report.actualStudyMinutes)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#5865D8]">Academic Study</span>
              <div className="text-xl font-bold font-mono text-[#242938]">
                {formatMins(report.academicMinutes)}
              </div>
              <p className="text-[10px] text-[#667085]">Coursework & curriculum modules</p>
            </div>

            <div className="bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#5865D8]">Career & DSA</span>
              <div className="text-xl font-bold font-mono text-[#242938]">
                {formatMins(report.careerMinutes)}
              </div>
              <p className="text-[10px] text-[#667085]">Algorithmic practice & interview prep</p>
            </div>

            <div className="bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#5865D8]">Project Building</span>
              <div className="text-xl font-bold font-mono text-[#242938]">
                {formatMins(report.projectMinutes)}
              </div>
              <p className="text-[10px] text-[#667085]">Software systems & implementations</p>
            </div>

            <div className="bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl p-4 space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#16845B]">Revision & Recall</span>
              <div className="text-xl font-bold font-mono text-[#242938]">
                {formatMins(report.revisionMinutes)}
              </div>
              <p className="text-[10px] text-[#667085]">Spaced retrieval & misconception review</p>
            </div>
          </div>

          {/* Goal Momentum */}
          <div className="pt-2">
            <div className="text-xs font-bold text-[#242938] uppercase tracking-wider mb-2">
              Active Milestone Goals ({report.goalsProgress.length})
            </div>
            {report.goalsProgress.length === 0 ? (
              <div className="text-xs text-[#667085] py-2">No active semester goals configured.</div>
            ) : (
              <div className="space-y-2">
                {report.goalsProgress.slice(0, 3).map((g) => (
                  <div
                    key={g.goalId}
                    className="p-2.5 rounded-lg bg-[#F5F6FA] border border-[#E5E7EB] flex items-center justify-between text-xs"
                  >
                    <span className="text-[#242938] truncate pr-2">{g.title}</span>
                    <span className="text-[#667085] font-mono shrink-0">
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
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-[#16845B] text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" />
            <span>Strongest Learning Areas</span>
          </div>
          {report.strongestAreas.length === 0 ? (
            <div className="text-xs text-[#667085] py-2">No strong patterns logged yet this week.</div>
          ) : (
            <div className="space-y-2.5">
              {report.strongestAreas.map((sa) => (
                <div key={sa.subjectCode} className="p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#242938]">{sa.name} ({sa.subjectCode})</span>
                    <span className="text-[10px] font-mono text-[#16845B] bg-white px-1.5 py-0.5 rounded border border-[#A7F3D0] font-semibold">
                      Score: {sa.score}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#667085]">{sa.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Needs Attention */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-[#A6630A] text-xs font-bold uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4" />
            <span>Needs Attention & Remediation</span>
          </div>
          {report.weakAreas.length === 0 ? (
            <div className="text-xs text-[#667085] py-2">No critical deficits detected. Steady pace across all subjects.</div>
          ) : (
            <div className="space-y-2.5">
              {report.weakAreas.map((wa) => (
                <div key={wa.subjectCode} className="p-3 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#242938]">{wa.name} ({wa.subjectCode})</span>
                    <span className="text-[10px] font-mono text-[#A6630A] bg-white px-1.5 py-0.5 rounded border border-[#FDE68A] font-semibold">
                      Deficit
                    </span>
                  </div>
                  <p className="text-[11px] text-[#667085]">{wa.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6. Learning Pattern Detection (Evidence-Based Observations) */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[#A6630A]" />
            <h2 className="text-base font-bold text-[#242938]">Detected Learning Patterns</h2>
          </div>
          <span className="text-xs text-[#667085]">Algorithmic pattern detection from real telemetry</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {report.learningPatterns.map((pat) => (
            <div
              key={pat.id}
              className={`p-4 rounded-xl border space-y-1.5 ${
                pat.severity === 'warning'
                  ? 'bg-[#FFFBEB] border-[#FDE68A]'
                  : pat.severity === 'positive'
                  ? 'bg-[#ECFDF5] border-[#A7F3D0]'
                  : 'bg-[#F5F6FA] border-[#E5E7EB]'
              }`}
            >
              <div className="flex items-center gap-2">
                {pat.severity === 'warning' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-[#A6630A] shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#16845B] shrink-0" />
                )}
                <span className="text-xs font-bold text-[#242938]">{pat.title}</span>
              </div>
              <p className="text-[11px] text-[#667085]">{pat.description}</p>
              <div className="text-[10px] text-[#667085] font-mono bg-white p-2 rounded border border-[#E5E7EB]">
                <strong>Evidence: </strong>{pat.evidence}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Deterministic Observations */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-3 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#667085]">
          <Info className="w-4 h-4 text-[#5865D8]" />
          <span>Factual Weekly Telemetry Insights</span>
        </div>
        <ul className="space-y-1.5 text-xs text-[#242938]">
          {report.deterministicObservations.map((obs, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-[#5865D8] font-bold">•</span>
              <span>{obs}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 8. AI Meta-Cognitive Review (Advisory Layer) */}
      {aiReview && (
        <div className="bg-white border border-[#5865D8]/30 rounded-2xl p-6 sm:p-7 space-y-5 shadow-xs relative">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#5865D8]" />
              <h2 className="text-lg font-bold text-[#242938]">AI Meta-Cognitive Synthesis</h2>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#EEF0FF] text-[#5865D8] border border-[#5865D8]/20 font-mono">
                Advisory Only
              </span>
            </div>
            <span className="text-[11px] text-[#667085]">Human-In-The-Loop Governance</span>
          </div>

          <div className="space-y-3">
            <div className="text-xs text-[#242938] leading-relaxed bg-[#EEF0FF] p-4 rounded-xl border border-[#5865D8]/20">
              <strong className="text-[#5865D8] block mb-1">Executive Interpretation:</strong>
              {aiReview.interpretation}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#F5F6FA] border border-[#E5E7EB] space-y-2">
                <span className="text-xs font-bold text-[#5865D8] uppercase tracking-wider flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" />
                  <span>Meta-Learning Observations</span>
                </span>
                <ul className="space-y-1 text-xs text-[#242938]">
                  {aiReview.learningObservations.map((obs, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-[#5865D8] font-bold">•</span>
                      <span>{obs}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-[#F5F6FA] border border-[#E5E7EB] space-y-2">
                <span className="text-xs font-bold text-[#5865D8] uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  <span>Recommended Strategic Priorities</span>
                </span>
                <ul className="space-y-1 text-xs text-[#242938]">
                  {aiReview.recommendedPriorities.map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-[#5865D8] font-bold">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {aiReview.distributionSuggestions && (
              <div className="p-3.5 rounded-xl bg-[#F5F6FA] border border-[#E5E7EB] text-xs text-[#242938]">
                <strong className="text-[#667085] block mb-0.5">Study Distribution Guidance:</strong>
                {aiReview.distributionSuggestions}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 9. NEXT WEEK PLANNING COMMAND CENTER */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-7 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#5865D8]" />
              <h2 className="text-xl font-bold text-[#242938] tracking-tight">NEXT WEEK</h2>
            </div>
            <p className="text-xs text-[#667085]">
              <span className="text-[#242938] font-semibold">Recommended focus:</span> Prioritized study targets derived from real learning telemetry.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerateProposals}
              className="px-3.5 py-1.5 rounded-lg bg-[#F5F6FA] hover:bg-[#E5E7EB] text-[#242938] text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors border border-[#E5E7EB]"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#5865D8]" />
              <span>Regenerate</span>
            </button>
            <button
              onClick={handleCommitNextWeekPlan}
              className="px-4 py-1.5 rounded-lg bg-[#16845B] hover:bg-[#126b4a] text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
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
                  ? 'bg-[#F5F6FA] border-[#E5E7EB]'
                  : item.status === 'modified'
                  ? 'bg-[#EEF0FF] border-[#5865D8]/30'
                  : item.status === 'skipped'
                  ? 'bg-[#FFFBEB] border-[#FDE68A] opacity-75'
                  : 'bg-white border-[#E5E7EB]'
              }`}
            >
              {editingItemId === item.id ? (
                /* Inline Modification Drawer */
                <div className="space-y-3">
                  <div className="text-xs font-bold text-[#5865D8] uppercase tracking-wider">
                    Modify Recommendation: {item.subjectCode}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] uppercase font-bold text-[#667085] block mb-1">
                        Title / Focus
                      </label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-xs text-[#242938] focus:outline-none focus:border-[#5865D8] font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-[#667085] block mb-1">
                        Sessions Count
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="7"
                        value={editSessions}
                        onChange={(e) => setEditSessions(parseInt(e.target.value) || 1)}
                        className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-xs text-[#242938] focus:outline-none focus:border-[#5865D8] font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setEditingItemId(null)}
                      className="px-3 py-1 text-[#667085] hover:text-[#242938] text-xs rounded font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveModification(item.id)}
                      className="px-3.5 py-1 bg-[#5865D8] hover:bg-[#4854C4] text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-xs"
                    >
                      Save Modification
                    </button>
                  </div>
                </div>
              ) : (
                /* Standard Recommendation View */
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#EEF0FF] text-[#5865D8] border border-[#5865D8]/20 font-mono">
                        {item.subjectCode}
                      </span>
                      <span className="text-sm font-bold text-[#242938] truncate">{item.title}</span>
                      <span className="text-xs font-mono text-[#5865D8] font-semibold bg-white px-2 py-0.5 rounded border border-[#E5E7EB]">
                        {item.targetSessions} session{item.targetSessions > 1 ? 's' : ''} ({item.estimatedMinutesPerSession}m each)
                      </span>
                      {item.status === 'accepted' && (
                        <span className="text-[10px] font-bold text-[#16845B] bg-[#ECFDF5] border border-[#A7F3D0] px-2 py-0.5 rounded">
                          ACCEPTED
                        </span>
                      )}
                      {item.status === 'modified' && (
                        <span className="text-[10px] font-bold text-[#5865D8] bg-[#EEF0FF] border border-[#5865D8]/20 px-2 py-0.5 rounded">
                          MODIFIED
                        </span>
                      )}
                      {item.status === 'skipped' && (
                        <span className="text-[10px] font-bold text-[#A6630A] bg-[#FFFBEB] border border-[#FDE68A] px-2 py-0.5 rounded">
                          SKIPPED
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#667085] leading-relaxed">
                      <strong className="text-[#242938]">Reason: </strong>{item.reason}
                    </p>
                  </div>

                  {/* Actions: [ ACCEPT ] [ MODIFY ] [ SKIP ] [ REMOVE ] */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {/* Session Count Adjuster */}
                    <div className="flex items-center bg-white border border-[#E5E7EB] rounded-lg p-0.5 mr-1 shadow-xs">
                      <button
                        onClick={() => handleModifySessionsQuick(item.id, -1)}
                        className="px-2 py-1 text-[#667085] hover:text-[#242938] text-xs font-mono cursor-pointer"
                        title="Decrease sessions"
                      >
                        -
                      </button>
                      <span className="px-1.5 text-xs font-mono font-bold text-[#242938]">
                        {item.targetSessions}
                      </span>
                      <button
                        onClick={() => handleModifySessionsQuick(item.id, 1)}
                        className="px-2 py-1 text-[#667085] hover:text-[#242938] text-xs font-mono cursor-pointer"
                        title="Increase sessions"
                      >
                        +
                      </button>
                    </div>

                    {/* [ ACCEPT ] */}
                    <button
                      onClick={() => handleAcceptItem(item.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        item.status === 'accepted'
                          ? 'bg-[#ECFDF5] text-[#16845B] border border-[#A7F3D0]'
                          : 'bg-white hover:bg-[#ECFDF5] text-[#16845B] border border-[#E5E7EB]'
                      }`}
                    >
                      [ ACCEPT ]
                    </button>

                    {/* [ MODIFY ] */}
                    <button
                      onClick={() => startModifying(item)}
                      className="px-2.5 py-1 bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                    >
                      [ MODIFY ]
                    </button>

                    {/* [ SKIP ] */}
                    <button
                      onClick={() => handleSkipItem(item.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        item.status === 'skipped'
                          ? 'bg-[#FFFBEB] text-[#A6630A] border border-[#FDE68A]'
                          : 'bg-white hover:bg-[#FFFBEB] text-[#A6630A] border border-[#E5E7EB]'
                      }`}
                    >
                      [ SKIP ]
                    </button>

                    {/* [ REMOVE ] */}
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1.5 text-[#667085] hover:text-[#C43D4B] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer"
                      title="[ REMOVE ]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
