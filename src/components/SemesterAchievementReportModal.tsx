import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Sparkles,
  Compass,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import {
  AppState,
  SemesterAchievementReport,
  AISemesterReviewResponse,
} from '../types';
import { requestAISemesterReview } from '../services/ai/semesterReviewService';

interface SemesterAchievementReportModalProps {
  report: SemesterAchievementReport;
  state: AppState;
  onClose: () => void;
  onNavigateToHoliday?: () => void;
}

export const SemesterAchievementReportModal: React.FC<SemesterAchievementReportModalProps> = ({
  report,
  state,
  onClose,
  onNavigateToHoliday,
}) => {
  const [aiReview, setAiReview] = useState<AISemesterReviewResponse | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const formatHours = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const handleRequestAIReview = async () => {
    setIsAiLoading(true);
    try {
      const res = await requestAISemesterReview(report, state);
      setAiReview(res);
    } catch (e) {
      console.error('Failed to generate AI semester review:', e);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl space-y-6 p-6 sm:p-8 relative text-slate-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 1. Header Banner */}
        <div className="border-b border-slate-800 pb-6 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800/40">
              SEMESTER COMPLETE
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {report.startDate} → {report.endDate} ({report.durationDays} days)
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {report.semesterName} Achievement Retrospective
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Factual synthesis of your academic execution, roadmap velocity, and deliberate practice. All historical data has been preserved.
          </p>
        </div>

        {/* 2. Primary Metric Scorecards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Focused Learning</span>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {formatHours(report.totalActualStudyMinutes)}
            </div>
            <span className="text-[11px] text-slate-500 font-mono">/ {formatHours(report.totalPlannedStudyMinutes)} planned</span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Execution Ratio</span>
            <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
              {report.executionPercentage}%
            </div>
            <span className="text-[11px] text-slate-500">Curriculum adherence</span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sessions</span>
            <div className="text-xl font-bold font-mono text-white mt-1">
              {report.completedSessionsCount}
            </div>
            <span className="text-[11px] text-slate-400 font-mono">{report.skippedSessionsCount} skipped • {report.missedSessionsCount} missed</span>
          </div>

          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Consistency Score</span>
            <div className="text-xl font-bold font-mono text-indigo-400 mt-1">
              {report.consistencyScore}%
            </div>
            <span className="text-[11px] text-slate-500">Avg comp: {report.averageComprehension}★</span>
          </div>
        </div>

        {/* 3. ACADEMIC PROGRESS */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            <span>ACADEMIC PROGRESS</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-800 rounded-xl overflow-hidden">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Progress</th>
                  <th className="py-2.5 px-3">Study Time</th>
                  <th className="py-2.5 px-3">Comprehension</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40 font-mono">
                {report.subjectBreakdowns.map((subj) => (
                  <tr key={subj.subjectId} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 font-sans font-bold text-white">
                      {subj.name} <span className="text-slate-400 text-[11px]">({subj.code})</span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${subj.progressPercentage}%` }} />
                        </div>
                        <span className="text-indigo-300">{subj.progressPercentage}%</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-slate-300">
                      {formatHours(subj.actualStudyMinutes)}
                    </td>
                    <td className="py-2 px-3 text-amber-300 font-sans">
                      {subj.averageComprehension > 0 ? `${subj.averageComprehension} ★` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. CAREER PROGRESS */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Compass className="w-4 h-4 text-purple-400" />
            <span>CAREER PROGRESS</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {report.careerSkills.map((sk) => (
              <div key={sk.skill} className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-white block">{sk.skill}</span>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>{sk.startingLevel}</span>
                  <span className="text-emerald-400 font-bold">→ {sk.currentLevel}</span>
                </div>
                <div className="text-[10px] text-slate-500 bg-slate-900/80 p-1.5 rounded font-mono">
                  {sk.evidence}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. ROADMAP & GOALS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Roadmap Topics */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              ROADMAP TOPICS
            </span>
            <div className="grid grid-cols-3 gap-2 font-mono text-center pt-1">
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <div className="text-lg font-bold text-emerald-400">{report.topicsCompletedCount}</div>
                <span className="text-[10px] text-slate-400 font-sans uppercase">Completed</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <div className="text-lg font-bold text-amber-400">{report.topicsInProgressCount}</div>
                <span className="text-[10px] text-slate-400 font-sans uppercase">In Progress</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <div className="text-lg font-bold text-slate-500">{report.topicsLockedCount}</div>
                <span className="text-[10px] text-slate-400 font-sans uppercase">Locked</span>
              </div>
            </div>
          </div>

          {/* Goals */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
              MILESTONE GOALS
            </span>
            <div className="grid grid-cols-3 gap-2 font-mono text-center pt-1">
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <div className="text-lg font-bold text-emerald-400">{report.goalsCompletedCount}</div>
                <span className="text-[10px] text-slate-400 font-sans uppercase">Completed</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <div className="text-lg font-bold text-indigo-400">{report.goalsPartiallyCompletedCount}</div>
                <span className="text-[10px] text-slate-400 font-sans uppercase">Partial</span>
              </div>
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <div className="text-lg font-bold text-slate-500">{report.goalsIncompleteCount}</div>
                <span className="text-[10px] text-slate-400 font-sans uppercase">Incomplete</span>
              </div>
            </div>
          </div>
        </div>

        {/* 6. STRONGEST AREAS, NEEDS ATTENTION, KEY LEARNING PATTERN */}
        <div className="space-y-3 pt-1">
          <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
              STRONGEST AREAS
            </span>
            <div className="text-xs text-slate-300">
              {report.strongestAreas.length > 0
                ? report.strongestAreas.map((s) => `${s.name} (${s.reason})`).join('; ')
                : 'Consistent progress across enrolled modules.'}
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
              NEEDS ATTENTION
            </span>
            <div className="text-xs text-slate-300">
              {report.needsAttention.length > 0
                ? report.needsAttention.map((w) => `${w.name} (${w.reason})`).join('; ')
                : 'No critical deficits detected.'}
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 block">
              KEY LEARNING PATTERN
            </span>
            <div className="text-xs text-slate-300">
              {report.keyLearningPatterns.length > 0
                ? `${report.keyLearningPatterns[0].title}: ${report.keyLearningPatterns[0].description} (Evidence: ${report.keyLearningPatterns[0].evidence})`
                : 'Execution aligned with planned capacity.'}
            </div>
          </div>
        </div>

        {/* 7. AI ADVISORY LAYER */}
        <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-950/60 border border-indigo-500/40 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">AI Semester Retrospective</span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-700/50">
                Advisory Only
              </span>
            </div>

            <button
              onClick={handleRequestAIReview}
              disabled={isAiLoading}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {isAiLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{aiReview ? 'Regenerate Analysis' : 'Run AI Semester Analysis'}</span>
                </>
              )}
            </button>
          </div>

          {aiReview ? (
            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
              <p className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <strong className="text-indigo-300 block mb-0.5">Executive Summary:</strong>
                {aiReview.summary}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1">
                  <strong className="text-purple-300 text-[11px] block uppercase">Recommended Future Focus:</strong>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                    {aiReview.recommendedFutureFocus.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1">
                  <strong className="text-emerald-300 text-[11px] block uppercase">Standout Project Directions:</strong>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                    {aiReview.recommendedProjectDirections.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Click above to generate meta-cognitive synthesis, skills worth exploring during the upcoming break, and strategic engineering project directions.
            </p>
          )}
        </div>

        {/* 8. Footer Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <div className="text-[11px] text-slate-500 font-mono">
            Report stored permanently in historical archive.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onNavigateToHoliday && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToHoliday();
                }}
                className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
              >
                <span>Launch Holiday Mode</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
