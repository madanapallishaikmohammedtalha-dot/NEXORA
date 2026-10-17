import React, { useState } from 'react';
import {
  BookOpen,
  Calendar,
  Plus,
  Trash2,
  Award,
  History,
} from 'lucide-react';
import { AppState, Semester, Subject, SemesterAchievementReport, SemesterStatus } from '../types';
import { dataService } from '../services/dataService';
import { deriveSemesterState } from '../services/semesterAnalytics';
import { SemesterAchievementReportModal } from './SemesterAchievementReportModal';

interface SemesterModuleProps {
  state: AppState;
  onUpdateSemester: (semester: Semester) => void;
  onSaveSubject: (subject: Subject) => void;
  onDeleteSubject: (subjectId: string) => void;
  onNavigateToTab?: (tab: any) => void;
  showToast?: (message: string) => void;
}

export const SemesterModule: React.FC<SemesterModuleProps> = ({
  state,
  onUpdateSemester,
  onSaveSubject,
  onDeleteSubject,
  onNavigateToTab,
  showToast = (msg) => console.log(msg),
}) => {
  const activeSemester = state.semesters.find((s) => s.id === state.activeSemesterId) || state.semesters[0];
  const activeStatus = activeSemester ? deriveSemesterState(activeSemester) : 'active';

  // Semester Edit State
  const [semName, setSemName] = useState(activeSemester?.name || '');
  const [startDate, setStartDate] = useState(activeSemester?.startDate || '');
  const [expectedEndDate, setExpectedEndDate] = useState(activeSemester?.expectedEndDate || activeSemester?.endDate || '');
  const [actualEndDate, setActualEndDate] = useState(activeSemester?.actualEndDate || '');
  const [targetWeeklyHours, setTargetWeeklyHours] = useState(activeSemester?.targetWeeklyStudyHours || 18);
  const [holidayStart, setHolidayStart] = useState(activeSemester?.holidayStartDate || '');
  const [holidayEnd, setHolidayEnd] = useState(activeSemester?.holidayEndDate || '');
  const [nextSemStart, setNextSemStart] = useState(activeSemester?.nextSemesterStartDate || '');
  const [examStart, setExamStart] = useState(activeSemester?.examPeriod?.startDate || '');
  const [examEnd, setExamEnd] = useState(activeSemester?.examPeriod?.endDate || '');
  const [revStart, setRevStart] = useState(activeSemester?.revisionPeriod?.startDate || '');
  const [revEnd, setRevEnd] = useState(activeSemester?.revisionPeriod?.endDate || '');

  // End Semester Modal State
  const [isEndingSemester, setIsEndingSemester] = useState(false);
  const [endSemDate, setEndSemDate] = useState(actualEndDate || new Date().toISOString().split('T')[0]);
  const [endHolidayStart, setEndHolidayStart] = useState(holidayStart || '2026-10-01');
  const [endHolidayEnd, setEndHolidayEnd] = useState(holidayEnd || '2026-10-28');
  const [endNextSemStart, setEndNextSemStart] = useState(nextSemStart || '2026-11-02');

  // Next Semester Modal State
  const [isStartingNextSem, setIsStartingNextSem] = useState(false);
  const [nextSemName, setNextSemName] = useState('');
  const [nextSemStartDate, setNextSemStartDate] = useState('');
  const [nextSemExpEndDate, setNextSemExpEndDate] = useState('');
  const [nextSemHours, setNextSemHours] = useState(18);

  // Active Report Modal
  const [viewingReport, setViewingReport] = useState<SemesterAchievementReport | null>(null);

  // New Subject State
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [subColor, setSubColor] = useState('#3B82F6');
  const [subHours, setSubHours] = useState(5);
  const [subCredits, setSubCredits] = useState(3);
  const [subSyllabus, setSubSyllabus] = useState('');

  const handleSaveSemesterInfo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSemester) return;

    const updated: Semester = {
      ...activeSemester,
      name: semName,
      startDate,
      endDate: actualEndDate || expectedEndDate || activeSemester.endDate,
      expectedEndDate: expectedEndDate || undefined,
      actualEndDate: actualEndDate.trim() || undefined,
      targetWeeklyStudyHours: Number(targetWeeklyHours) || 16,
      holidayStartDate: holidayStart.trim() || undefined,
      holidayEndDate: holidayEnd.trim() || undefined,
      nextSemesterStartDate: nextSemStart.trim() || undefined,
      examPeriod: examStart && examEnd ? { startDate: examStart, endDate: examEnd } : undefined,
      revisionPeriod: revStart && revEnd ? { startDate: revStart, endDate: revEnd } : undefined,
    };
    onUpdateSemester(updated);
    showToast('Semester dates and timeline saved.');
  };

  const handleConfirmEndSemester = () => {
    if (!activeSemester || !endSemDate) return;

    try {
      const { report, isBreakMode } = dataService.endSemester(
        activeSemester.id,
        endSemDate,
        {
          holidayStartDate: endHolidayStart,
          holidayEndDate: endHolidayEnd,
          nextSemesterStartDate: endNextSemStart,
        }
      );

      setIsEndingSemester(false);
      setViewingReport(report);
      showToast(`${activeSemester.name} marked completed! Historical review generated.`);

      if (isBreakMode && onNavigateToTab) {
        // Will also allow viewing report first
      }
    } catch (err: any) {
      showToast(`Error ending semester: ${err.message}`);
    }
  };

  const handleCreateNextSemester = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nextSemName.trim() || !nextSemStartDate || !nextSemExpEndDate) return;

    try {
      const created = dataService.createNextSemester({
        name: nextSemName.trim(),
        startDate: nextSemStartDate,
        expectedEndDate: nextSemExpEndDate,
        targetWeeklyStudyHours: nextSemHours,
        subjects: [],
      });

      setIsStartingNextSem(false);
      setNextSemName('');
      setNextSemStartDate('');
      setNextSemExpEndDate('');
      showToast(`Welcome to ${created.name}! Previous semester archived cleanly.`);
    } catch (err: any) {
      showToast(`Error starting next semester: ${err.message}`);
    }
  };

  const handleAddSubjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subCode.trim() || !subName.trim() || !activeSemester) return;

    const newSubject: Subject = {
      id: `sub-${Date.now()}`,
      semesterId: activeSemester.id,
      code: subCode.trim().toUpperCase(),
      name: subName.trim(),
      color: subColor,
      targetWeeklyHours: Number(subHours) || 4,
      credits: Number(subCredits) || 3,
      syllabusOverview: subSyllabus.trim() || undefined,
    };

    onSaveSubject(newSubject);
    setSubCode('');
    setSubName('');
    setSubSyllabus('');
    setIsAddingSubject(false);
    showToast(`Enrolled subject ${newSubject.code}.`);
  };

  const getStatusBadge = (status: SemesterStatus) => {
    switch (status) {
      case 'active':
        return <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#16845B] border border-[#A7F3D0] uppercase">Active Term</span>;
      case 'completed':
        return <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#F5F6FA] text-[#667085] border border-[#E5E7EB] uppercase">Completed ✓</span>;
      case 'break':
        return <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#FFFBEB] text-[#A6630A] border border-[#FDE68A] uppercase">Holiday / Break</span>;
      case 'upcoming':
      default:
        return <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#EEF0FF] text-[#5865D8] border border-[#C7D2FE] uppercase">Upcoming</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Banner with End Semester & Next Semester Actions */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-7 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#5865D8]">
                Academic Term Lifecycle
              </span>
              {getStatusBadge(activeStatus)}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#242938] tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-[#5865D8]" />
              <span>{activeSemester?.name || 'Semester Management'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#667085] max-w-2xl">
              Deterministic date bounds, exam & revision periods, historical preservation, and holiday transitions.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {activeStatus !== 'completed' ? (
              <button
                onClick={() => setIsEndingSemester(true)}
                className="px-4 py-2 bg-[#C43D4B] hover:bg-[#b03440] text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Award className="w-4 h-4" />
                <span>End Semester</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  const rep = dataService.getSemesterReview(activeSemester.id);
                  if (rep) setViewingReport(rep);
                }}
                className="px-4 py-2 bg-[#F5F6FA] hover:bg-[#E5E7EB] text-[#242938] border border-[#E5E7EB] rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Award className="w-4 h-4 text-[#16845B]" />
                <span>View Semester Report</span>
              </button>
            )}

            <button
              onClick={() => setIsStartingNextSem(true)}
              className="px-4 py-2 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Start Next Semester</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Active Semester Dates & Periods Configuration */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#5865D8]" />
            <h2 className="text-sm font-bold text-[#242938] uppercase tracking-wider">
              Semester Schedule & Examination Periods
            </h2>
          </div>
          <span className="text-xs text-[#667085]">Actual dates override predictions</span>
        </div>

        <form onSubmit={handleSaveSemesterInfo} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-[#667085] block mb-1">Semester Name</label>
              <input
                type="text"
                value={semName}
                onChange={(e) => setSemName(e.target.value)}
                placeholder="e.g. 3rd Semester (Fall 2026)"
                className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#242938] font-semibold focus:outline-none focus:border-[#5865D8]"
                required
              />
            </div>

            <div>
              <label className="text-[#667085] block mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#242938] font-mono focus:outline-none focus:border-[#5865D8]"
                required
              />
            </div>

            <div>
              <label className="text-[#667085] block mb-1">Expected End Date (Prediction)</label>
              <input
                type="date"
                value={expectedEndDate}
                onChange={(e) => setExpectedEndDate(e.target.value)}
                className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#242938] font-mono focus:outline-none focus:border-[#5865D8]"
                required
              />
            </div>

            <div>
              <label className="text-[#667085] block mb-1">
                Actual End Date <span className="text-[#16845B] font-semibold">(Authoritative)</span>
              </label>
              <input
                type="date"
                value={actualEndDate}
                onChange={(e) => setActualEndDate(e.target.value)}
                className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#242938] font-mono focus:outline-none focus:border-[#5865D8]"
              />
            </div>
          </div>

          {/* Academic Periods: Exam, Revision, Holiday & Next Term */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            <div>
              <label className="text-[#667085] block mb-1">Exam Period (Start → End)</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={examStart}
                  onChange={(e) => setExamStart(e.target.value)}
                  className="w-1/2 bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-2 py-1.5 text-[#242938] font-mono text-[11px] focus:outline-none focus:border-[#5865D8]"
                />
                <input
                  type="date"
                  value={examEnd}
                  onChange={(e) => setExamEnd(e.target.value)}
                  className="w-1/2 bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-2 py-1.5 text-[#242938] font-mono text-[11px] focus:outline-none focus:border-[#5865D8]"
                />
              </div>
            </div>

            <div>
              <label className="text-[#667085] block mb-1">Revision / Reading Week</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={revStart}
                  onChange={(e) => setRevStart(e.target.value)}
                  className="w-1/2 bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-2 py-1.5 text-[#242938] font-mono text-[11px] focus:outline-none focus:border-[#5865D8]"
                />
                <input
                  type="date"
                  value={revEnd}
                  onChange={(e) => setRevEnd(e.target.value)}
                  className="w-1/2 bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-2 py-1.5 text-[#242938] font-mono text-[11px] focus:outline-none focus:border-[#5865D8]"
                />
              </div>
            </div>

            <div>
              <label className="text-[#667085] block mb-1">Semester Break (Holiday Mode)</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={holidayStart}
                  onChange={(e) => setHolidayStart(e.target.value)}
                  className="w-1/2 bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-2 py-1.5 text-[#242938] font-mono text-[11px] focus:outline-none focus:border-[#5865D8]"
                />
                <input
                  type="date"
                  value={holidayEnd}
                  onChange={(e) => setHolidayEnd(e.target.value)}
                  className="w-1/2 bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-2 py-1.5 text-[#242938] font-mono text-[11px] focus:outline-none focus:border-[#5865D8]"
                />
              </div>
            </div>

            <div>
              <label className="text-[#667085] block mb-1">Next Semester Start Date</label>
              <input
                type="date"
                value={nextSemStart}
                onChange={(e) => setNextSemStart(e.target.value)}
                className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-[#242938] font-mono text-[11px] focus:outline-none focus:border-[#5865D8]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <span className="text-[#667085]">Weekly Target Study Hours:</span>
              <input
                type="number"
                min={5}
                max={40}
                value={targetWeeklyHours}
                onChange={(e) => setTargetWeeklyHours(Number(e.target.value))}
                className="w-20 bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-2.5 py-1 text-[#242938] font-mono text-center font-bold focus:outline-none focus:border-[#5865D8]"
              />
              <span className="text-[#667085]">hours / week</span>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-[#5865D8] hover:bg-[#4854C4] text-white font-semibold rounded-xl text-xs cursor-pointer shadow-xs"
            >
              Save Timeline Settings
            </button>
          </div>
        </form>
      </div>

      {/* 3. Historical Semesters Archive */}
      {state.semesters.length > 1 && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3">
            <History className="w-4 h-4 text-[#5865D8]" />
            <h2 className="text-sm font-bold text-[#242938] uppercase tracking-wider">
              Semester History & Archive ({state.semesters.length} Terms)
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {state.semesters.map((sem) => {
              const status = deriveSemesterState(sem);
              const hasReport = state.semesterReviews && state.semesterReviews[sem.id];
              const isCurrent = sem.id === state.activeSemesterId;

              return (
                <div
                  key={sem.id}
                  className={`p-4 rounded-xl border space-y-2 transition-all ${
                    isCurrent
                      ? 'bg-[#EEF0FF] border-[#C7D2FE]'
                      : 'bg-[#F5F6FA] border-[#E5E7EB]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#242938] truncate">{sem.name}</span>
                    {getStatusBadge(status)}
                  </div>
                  <div className="text-[11px] text-[#667085] font-mono">
                    {sem.startDate} → {sem.actualEndDate || sem.endDate}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-[#667085]">
                      {state.subjects.filter((s) => s.semesterId === sem.id).length} subjects
                    </span>

                    <button
                      onClick={() => {
                        const rep = dataService.getSemesterReview(sem.id);
                        if (rep) setViewingReport(rep);
                      }}
                      className="text-[11px] text-[#16845B] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Award className="w-3 h-3" />
                      <span>{hasReport ? 'View Report' : 'Generate Review'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Enrolled Subjects Management */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[#242938] uppercase tracking-wider">
              Enrolled Subjects ({state.subjects.filter((s) => s.semesterId === activeSemester?.id).length})
            </h2>
            <p className="text-xs text-[#667085]">
              Credit courses and weekly study pacing for {activeSemester?.name}.
            </p>
          </div>
          <button
            onClick={() => setIsAddingSubject(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Subject</span>
          </button>
        </div>

        {/* Add Subject Modal */}
        {isAddingSubject && (
          <form onSubmit={handleAddSubjectSubmit} className="bg-[#F5F6FA] p-4 rounded-xl border border-[#E5E7EB] space-y-3 text-xs">
            <div className="text-xs font-bold text-[#5865D8]">Enroll New Subject</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[#667085] block mb-1">Subject Code</label>
                <input
                  type="text"
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  placeholder="e.g. CS 301"
                  className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
                  required
                />
              </div>

              <div>
                <label className="text-[#667085] block mb-1">Subject Full Name</label>
                <input
                  type="text"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="e.g. Operating Systems & Concurrency"
                  className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
                  required
                />
              </div>

              <div>
                <label className="text-[#667085] block mb-1">Color Theme</label>
                <input
                  type="color"
                  value={subColor}
                  onChange={(e) => setSubColor(e.target.value)}
                  className="w-full h-9 bg-white border border-[#E5E7EB] rounded-lg cursor-pointer px-1 py-1"
                />
              </div>

              <div>
                <label className="text-[#667085] block mb-1">Credits / Units</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={subCredits}
                  onChange={(e) => setSubCredits(Number(e.target.value))}
                  className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
                />
              </div>

              <div>
                <label className="text-[#667085] block mb-1">Target Study Hours / Week</label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={subHours}
                  onChange={(e) => setSubHours(Number(e.target.value))}
                  className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="text-[#667085] block mb-1">Syllabus Overview (Optional)</label>
                <textarea
                  value={subSyllabus}
                  onChange={(e) => setSubSyllabus(e.target.value)}
                  placeholder="Paste syllabus summary to help AI generate tailored roadmaps..."
                  className="w-full bg-white border border-[#E5E7EB] rounded-lg p-2.5 text-[#242938] h-16 resize-none focus:outline-none focus:border-[#5865D8]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingSubject(false)}
                className="px-3 py-1.5 bg-white border border-[#E5E7EB] text-[#667085] hover:text-[#242938] rounded-lg font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#5865D8] hover:bg-[#4854C4] text-white font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                Enroll Subject
              </button>
            </div>
          </form>
        )}

        {/* Subjects List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {state.subjects.filter((s) => s.semesterId === activeSemester?.id).map((sub) => {
            const topicCount = state.topics.filter((t) => t.subjectId === sub.id).length;

            return (
              <div
                key={sub.id}
                className="bg-[#F5F6FA] border border-[#E5E7EB] p-4 rounded-xl space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                    <div>
                      <div className="text-sm font-bold text-[#242938]">{sub.code}</div>
                      <div className="text-xs text-[#667085] font-medium">{sub.name}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteSubject(sub.id)}
                    className="text-[#667085] hover:text-[#C43D4B] p-1 rounded cursor-pointer"
                    title="Remove subject"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {sub.syllabusOverview && (
                  <p className="text-[11px] text-[#667085] line-clamp-2">
                    {sub.syllabusOverview}
                  </p>
                )}

                <div className="flex items-center justify-between text-[11px] text-[#667085] pt-2 border-t border-[#E5E7EB]">
                  <span>Target: <strong className="text-[#242938]">{sub.targetWeeklyHours}h/wk</strong></span>
                  <span>Credits: <strong className="text-[#242938]">{sub.credits}</strong></span>
                  <span>Roadmap: <strong className="text-[#242938]">{topicCount} topics</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: END SEMESTER CONFIRMATION & TRANSITION */}
      {isEndingSemester && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E7EB] rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-xl text-[#242938]">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-[#C43D4B]" />
                <h3 className="text-base font-bold text-[#242938]">END SEMESTER CONFIRMATION</h3>
              </div>
              <button
                onClick={() => setIsEndingSemester(false)}
                className="text-[#667085] hover:text-[#242938]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[#667085] leading-relaxed">
                You are ending <strong className="text-[#242938]">{activeSemester?.name}</strong>.
                NEXORA will calculate your complete semester achievement report and archive your curriculum history safely.
              </p>

              <div>
                <label className="text-[#667085] block mb-1 font-bold uppercase text-[10px]">
                  Actual Completion Date <span className="text-[#C43D4B]">*Required</span>
                </label>
                <input
                  type="date"
                  required
                  value={endSemDate}
                  onChange={(e) => setEndSemDate(e.target.value)}
                  className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#242938] font-mono focus:outline-none focus:border-[#5865D8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[#667085] block mb-1 text-[10px] uppercase font-bold">Holiday Start</label>
                  <input
                    type="date"
                    value={endHolidayStart}
                    onChange={(e) => setEndHolidayStart(e.target.value)}
                    className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-2 py-1.5 text-[#242938] font-mono text-[11px] focus:outline-none focus:border-[#5865D8]"
                  />
                </div>
                <div>
                  <label className="text-[#667085] block mb-1 text-[10px] uppercase font-bold">Holiday End</label>
                  <input
                    type="date"
                    value={endHolidayEnd}
                    onChange={(e) => setEndHolidayEnd(e.target.value)}
                    className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-2 py-1.5 text-[#242938] font-mono text-[11px] focus:outline-none focus:border-[#5865D8]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#667085] block mb-1 text-[10px] uppercase font-bold">Next Semester Start Date</label>
                <input
                  type="date"
                  value={endNextSemStart}
                  onChange={(e) => setEndNextSemStart(e.target.value)}
                  className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-3 py-1.5 text-[#242938] font-mono text-[11px] focus:outline-none focus:border-[#5865D8]"
                />
              </div>

              <div className="p-3 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[11px] text-[#242938]">
                <strong className="text-[#16845B] block mb-0.5">Historical Invariant:</strong>
                Zero data will be deleted. All study sessions, timetables, goals, and topic mastery remain preserved.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsEndingSemester(false)}
                className="px-4 py-2 text-[#667085] hover:text-[#242938] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEndSemester}
                className="px-5 py-2 bg-[#C43D4B] hover:bg-[#b03440] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                Confirm & End Semester
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: START NEXT SEMESTER */}
      {isStartingNextSem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateNextSemester}
            className="bg-white border border-[#E5E7EB] rounded-3xl max-w-lg w-full p-6 sm:p-7 space-y-5 shadow-xl text-[#242938]"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#5865D8]" />
                <h3 className="text-base font-bold text-[#242938]">START NEXT SEMESTER</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsStartingNextSem(false)}
                className="text-[#667085] hover:text-[#242938]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[#667085] block mb-1">Semester Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 4th Semester (Spring 2027)"
                  value={nextSemName}
                  onChange={(e) => setNextSemName(e.target.value)}
                  className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#667085] block mb-1">Actual Start Date</label>
                  <input
                    type="date"
                    required
                    value={nextSemStartDate}
                    onChange={(e) => setNextSemStartDate(e.target.value)}
                    className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#242938] font-mono focus:outline-none focus:border-[#5865D8]"
                  />
                </div>
                <div>
                  <label className="text-[#667085] block mb-1">Expected End Date</label>
                  <input
                    type="date"
                    required
                    value={nextSemExpEndDate}
                    onChange={(e) => setNextSemExpEndDate(e.target.value)}
                    className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#242938] font-mono focus:outline-none focus:border-[#5865D8]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#667085] block mb-1">Target Weekly Study Hours</label>
                <input
                  type="number"
                  min={5}
                  max={40}
                  value={nextSemHours}
                  onChange={(e) => setNextSemHours(Number(e.target.value))}
                  className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#242938] font-mono focus:outline-none focus:border-[#5865D8]"
                />
              </div>

              <p className="text-[11px] text-[#667085] bg-[#F5F6FA] p-3 rounded-xl border border-[#E5E7EB]">
                All previous semester analytics, timetables, and session records will be retained cleanly under their respective semester IDs.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsStartingNextSem(false)}
                className="px-4 py-2 text-[#667085] hover:text-[#242938] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
              >
                Activate New Semester
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SEMESTER ACHIEVEMENT REPORT MODAL */}
      {viewingReport && (
        <SemesterAchievementReportModal
          report={viewingReport}
          state={state}
          onClose={() => setViewingReport(null)}
          onNavigateToHoliday={() => {
            setViewingReport(null);
            if (onNavigateToTab) onNavigateToTab('holiday');
          }}
        />
      )}
    </div>
  );
};
