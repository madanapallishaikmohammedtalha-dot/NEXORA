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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-[#E5E7EB] rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-xl space-y-6 p-6 sm:p-8 relative text-[#242938]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl text-[#667085] hover:text-[#242938] hover:bg-[#F5F6FA] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 1. Header Banner */}
        <div className="border-b border-[#E5E7EB] pb-6 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#16845B] bg-[#ECFDF5] px-3 py-1 rounded-full border border-[#A7F3D0]">
              SEMESTER COMPLETE
            </span>
            <span className="text-xs text-[#667085] font-mono">
              {report.startDate} → {report.endDate} ({report.durationDays} days)
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-[#242938] tracking-tight">
            {report.semesterName} Achievement Retrospective
          </h1>
          <p className="text-xs sm:text-sm text-[#667085]">
            Factual synthesis of your academic execution, roadmap velocity, and deliberate practice. All historical data has been preserved.
          </p>
        </div>

        {/* 2. Primary Metric Scorecards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#F5F6FA] p-4 rounded-2xl border border-[#E5E7EB]">
            <span className="text-[10px] uppercase font-bold text-[#667085] tracking-wider">Focused Learning</span>
            <div className="text-xl font-bold font-mono text-[#242938] mt-1">
              {formatHours(report.totalActualStudyMinutes)}
            </div>
            <span className="text-[11px] text-[#667085] font-mono">/ {formatHours(report.totalPlannedStudyMinutes)} planned</span>
          </div>

          <div className="bg-[#F5F6FA] p-4 rounded-2xl border border-[#E5E7EB]">
            <span className="text-[10px] uppercase font-bold text-[#667085] tracking-wider">Execution Ratio</span>
            <div className="text-xl font-bold font-mono text-[#16845B] mt-1">
              {report.executionPercentage}%
            </div>
            <span className="text-[11px] text-[#667085]">Curriculum adherence</span>
          </div>

          <div className="bg-[#F5F6FA] p-4 rounded-2xl border border-[#E5E7EB]">
            <span className="text-[10px] uppercase font-bold text-[#667085] tracking-wider">Sessions</span>
            <div className="text-xl font-bold font-mono text-[#242938] mt-1">
              {report.completedSessionsCount}
            </div>
            <span className="text-[11px] text-[#667085] font-mono">{report.skippedSessionsCount} skipped • {report.missedSessionsCount} missed</span>
          </div>

          <div className="bg-[#F5F6FA] p-4 rounded-2xl border border-[#E5E7EB]">
            <span className="text-[10px] uppercase font-bold text-[#667085] tracking-wider">Consistency Score</span>
            <div className="text-xl font-bold font-mono text-[#5865D8] mt-1">
              {report.consistencyScore}%
            </div>
            <span className="text-[11px] text-[#667085]">Avg comp: {report.averageComprehension}★</span>
          </div>
        </div>

        {/* 3. ACADEMIC PROGRESS */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#667085]">
            <BookOpen className="w-4 h-4 text-[#5865D8]" />
            <span>ACADEMIC PROGRESS</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-[#E5E7EB] rounded-xl overflow-hidden">
              <thead className="bg-[#F5F6FA] text-[#667085] font-semibold border-b border-[#E5E7EB]">
                <tr>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Progress</th>
                  <th className="py-2.5 px-3">Study Time</th>
                  <th className="py-2.5 px-3">Comprehension</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] bg-white font-mono">
                {report.subjectBreakdowns.map((subj) => (
                  <tr key={subj.subjectId} className="hover:bg-[#F5F6FA] transition-colors">
                    <td className="py-2 px-3 font-sans font-bold text-[#242938]">
                      {subj.name} <span className="text-[#667085] text-[11px]">({subj.code})</span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-[#E5E7EB] h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-[#5865D8]" style={{ width: `${subj.progressPercentage}%` }} />
                        </div>
                        <span className="text-[#5865D8] font-semibold">{subj.progressPercentage}%</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-[#667085]">
                      {formatHours(subj.actualStudyMinutes)}
                    </td>
                    <td className="py-2 px-3 text-[#A6630A] font-sans font-semibold">
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
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#667085]">
            <Compass className="w-4 h-4 text-[#5865D8]" />
            <span>CAREER PROGRESS</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {report.careerSkills.map((sk) => (
              <div key={sk.skill} className="bg-[#F5F6FA] border border-[#E5E7EB] p-3.5 rounded-xl space-y-1.5">
                <span className="text-xs font-bold text-[#242938] block">{sk.skill}</span>
                <div className="text-[11px] text-[#667085] flex items-center justify-between">
                  <span>{sk.startingLevel}</span>
                  <span className="text-[#16845B] font-bold">→ {sk.currentLevel}</span>
                </div>
                <div className="text-[10px] text-[#667085] bg-white p-1.5 rounded font-mono border border-[#E5E7EB]">
                  {sk.evidence}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. ROADMAP & GOALS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Roadmap Topics */}
          <div className="bg-[#F5F6FA] border border-[#E5E7EB] p-4 rounded-xl space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#667085] block">
              ROADMAP TOPICS
            </span>
            <div className="grid grid-cols-3 gap-2 font-mono text-center pt-1">
              <div className="bg-white p-2 rounded-lg border border-[#E5E7EB]">
                <div className="text-lg font-bold text-[#16845B]">{report.topicsCompletedCount}</div>
                <span className="text-[10px] text-[#667085] font-sans uppercase">Completed</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-[#E5E7EB]">
                <div className="text-lg font-bold text-[#A6630A]">{report.topicsInProgressCount}</div>
                <span className="text-[10px] text-[#667085] font-sans uppercase">In Progress</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-[#E5E7EB]">
                <div className="text-lg font-bold text-[#667085]">{report.topicsLockedCount}</div>
                <span className="text-[10px] text-[#667085] font-sans uppercase">Locked</span>
              </div>
            </div>
          </div>

          {/* Goals */}
          <div className="bg-[#F5F6FA] border border-[#E5E7EB] p-4 rounded-xl space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#667085] block">
              MILESTONE GOALS
            </span>
            <div className="grid grid-cols-3 gap-2 font-mono text-center pt-1">
              <div className="bg-white p-2 rounded-lg border border-[#E5E7EB]">
                <div className="text-lg font-bold text-[#16845B]">{report.goalsCompletedCount}</div>
                <span className="text-[10px] text-[#667085] font-sans uppercase">Completed</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-[#E5E7EB]">
                <div className="text-lg font-bold text-[#5865D8]">{report.goalsPartiallyCompletedCount}</div>
                <span className="text-[10px] text-[#667085] font-sans uppercase">Partial</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-[#E5E7EB]">
                <div className="text-lg font-bold text-[#667085]">{report.goalsIncompleteCount}</div>
                <span className="text-[10px] text-[#667085] font-sans uppercase">Incomplete</span>
              </div>
            </div>
          </div>
        </div>

        {/* 6. STRONGEST AREAS, NEEDS ATTENTION, KEY LEARNING PATTERN */}
        <div className="space-y-3 pt-1">
          <div className="bg-[#ECFDF5] border border-[#A7F3D0] p-4 rounded-xl space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#16845B] block">
              STRONGEST AREAS
            </span>
            <div className="text-xs text-[#242938]">
              {report.strongestAreas.length > 0
                ? report.strongestAreas.map((s) => `${s.name} (${s.reason})`).join('; ')
                : 'Consistent progress across enrolled modules.'}
            </div>
          </div>

          <div className="bg-[#FFFBEB] border border-[#FDE68A] p-4 rounded-xl space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#A6630A] block">
              NEEDS ATTENTION
            </span>
            <div className="text-xs text-[#242938]">
              {report.needsAttention.length > 0
                ? report.needsAttention.map((w) => `${w.name} (${w.reason})`).join('; ')
                : 'No critical deficits detected.'}
            </div>
          </div>

          <div className="bg-[#EEF0FF] border border-[#C7D2FE] p-4 rounded-xl space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5865D8] block">
              KEY LEARNING PATTERN
            </span>
            <div className="text-xs text-[#242938]">
              {report.keyLearningPatterns.length > 0
                ? `${report.keyLearningPatterns[0].title}: ${report.keyLearningPatterns[0].description} (Evidence: ${report.keyLearningPatterns[0].evidence})`
                : 'Execution aligned with planned capacity.'}
            </div>
          </div>
        </div>

        {/* 7. AI ADVISORY LAYER */}
        <div className="bg-[#F5F6FA] border border-[#E5E7EB] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#5865D8]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#242938]">AI Semester Retrospective</span>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-[#EEF0FF] text-[#5865D8] border border-[#C7D2FE]">
                Advisory Only
              </span>
            </div>

            <button
              onClick={handleRequestAIReview}
              disabled={isAiLoading}
              className="px-3 py-1.5 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
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
            <div className="space-y-3 text-xs leading-relaxed text-[#242938]">
              <p className="bg-white p-3 rounded-xl border border-[#E5E7EB]">
                <strong className="text-[#5865D8] block mb-0.5">Executive Summary:</strong>
                {aiReview.summary}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-xl border border-[#E5E7EB] space-y-1">
                  <strong className="text-[#5865D8] text-[11px] block uppercase">Recommended Future Focus:</strong>
                  <ul className="list-disc list-inside space-y-0.5 text-[#667085]">
                    {aiReview.recommendedFutureFocus.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white p-3 rounded-xl border border-[#E5E7EB] space-y-1">
                  <strong className="text-[#16845B] text-[11px] block uppercase">Standout Project Directions:</strong>
                  <ul className="list-disc list-inside space-y-0.5 text-[#667085]">
                    {aiReview.recommendedProjectDirections.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#667085]">
              Click above to generate meta-cognitive synthesis, skills worth exploring during the upcoming break, and strategic engineering project directions.
            </p>
          )}
        </div>

        {/* 8. Footer Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#E5E7EB]">
          <div className="text-[11px] text-[#667085] font-mono">
            Report stored permanently in historical archive.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onNavigateToHoliday && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToHoliday();
                }}
                className="flex-1 sm:flex-none px-4 py-2 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <span>Launch Holiday Mode</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
