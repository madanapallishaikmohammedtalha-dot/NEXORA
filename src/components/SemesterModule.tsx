import React, { useState } from 'react';
import { BookOpen, Calendar, Plus, Trash2, Edit2, Check, AlertCircle } from 'lucide-react';
import { AppState, Holiday, Semester, Subject } from '../types';

interface SemesterModuleProps {
  state: AppState;
  onUpdateSemester: (semester: Semester) => void;
  onSaveSubject: (subject: Subject) => void;
  onDeleteSubject: (subjectId: string) => void;
}

export const SemesterModule: React.FC<SemesterModuleProps> = ({
  state,
  onUpdateSemester,
  onSaveSubject,
  onDeleteSubject,
}) => {
  const activeSemester = state.semesters.find((s) => s.id === state.activeSemesterId) || state.semesters[0];

  // Semester Edit State
  const [semName, setSemName] = useState(activeSemester?.name || '');
  const [startDate, setStartDate] = useState(activeSemester?.startDate || '');
  const [expectedEndDate, setExpectedEndDate] = useState(activeSemester?.expectedEndDate || activeSemester?.endDate || '');
  const [actualEndDate, setActualEndDate] = useState(activeSemester?.actualEndDate || '');
  const [targetWeeklyHours, setTargetWeeklyHours] = useState(activeSemester?.targetWeeklyStudyHours || 18);

  // New Holiday State
  const [isAddingHoliday, setIsAddingHoliday] = useState(false);
  const [holName, setHolName] = useState('');
  const [holStart, setHolStart] = useState('');
  const [holEnd, setHolEnd] = useState('');
  const [holType, setHolType] = useState<'holiday' | 'break' | 'exam_prep'>('break');

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
      endDate: expectedEndDate || activeSemester.endDate,
      expectedEndDate: expectedEndDate || undefined,
      actualEndDate: actualEndDate.trim() || undefined,
      targetWeeklyStudyHours: Number(targetWeeklyHours) || 16,
    };
    onUpdateSemester(updated);
  };

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holName.trim() || !holStart || !holEnd || !activeSemester) return;

    const newHol: Holiday = {
      id: `hol-${Date.now()}`,
      name: holName.trim(),
      startDate: holStart,
      endDate: holEnd,
      type: holType,
    };

    const updated: Semester = {
      ...activeSemester,
      holidays: [...activeSemester.holidays, newHol],
    };

    onUpdateSemester(updated);
    setHolName('');
    setHolStart('');
    setHolEnd('');
    setIsAddingHoliday(false);
  };

  const handleDeleteHoliday = (holidayId: string) => {
    if (!activeSemester) return;
    const updated: Semester = {
      ...activeSemester,
      holidays: activeSemester.holidays.filter((h) => h.id !== holidayId),
    };
    onUpdateSemester(updated);
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
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">
          Academic Term Structure
        </div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          <span>Semester & Subjects Manager</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Define actual semester start/end dates, reading weeks, holidays, and credit unit subjects without relying on static assumptions.
        </p>
      </div>

      {/* Semester Configuration */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white">Active Semester Timeline</h2>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">
            Active Term
          </span>
        </div>

        <form onSubmit={handleSaveSemesterInfo} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Semester Name</label>
            <input
              type="text"
              value={semName}
              onChange={(e) => setSemName(e.target.value)}
              placeholder="e.g. Fall 2026 (Semester 5)"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">3. Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              required
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">4. Expected End</label>
            <input
              type="date"
              value={expectedEndDate}
              onChange={(e) => setExpectedEndDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              required
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">
              5. Actual End <span className="text-[10px] text-slate-500">(finished)</span>
            </label>
            <input
              type="date"
              value={actualEndDate}
              onChange={(e) => setActualEndDate(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-slate-400 block mb-1">Target Study Hrs</label>
              <input
                type="number"
                min={5}
                max={40}
                value={targetWeeklyHours}
                onChange={(e) => setTargetWeeklyHours(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs"
            >
              Update
            </button>
          </div>
        </form>

        {/* Holidays & Breaks Section */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">
              Recorded Semester Breaks & Holidays
            </span>
            <button
              onClick={() => setIsAddingHoliday(true)}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Holiday / Break</span>
            </button>
          </div>

          {/* Add Holiday Form */}
          {isAddingHoliday && (
            <form onSubmit={handleAddHoliday} className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input
                  type="text"
                  value={holName}
                  onChange={(e) => setHolName(e.target.value)}
                  placeholder="Holiday/Break Name (e.g. Reading Week)"
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                  required
                />
                <input
                  type="date"
                  value={holStart}
                  onChange={(e) => setHolStart(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                  required
                />
                <input
                  type="date"
                  value={holEnd}
                  onChange={(e) => setHolEnd(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                  required
                />
                <div className="flex gap-2">
                  <select
                    value={holType}
                    onChange={(e) => setHolType(e.target.value as any)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white flex-1"
                  >
                    <option value="break">Semester Break</option>
                    <option value="holiday">Public Holiday</option>
                    <option value="exam_prep">Reading / Prep</option>
                  </select>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg font-semibold"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingHoliday(false)}
                    className="bg-slate-700 text-slate-300 px-2 py-1.5 rounded-lg"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Holidays List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeSemester?.holidays.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-800 rounded-xl text-xs"
              >
                <div>
                  <div className="font-semibold text-white">{h.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {h.startDate} to {h.endDate} ({h.type})
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteHoliday(h.id)}
                  className="text-slate-500 hover:text-rose-400 p-1 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Subjects Registry */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-bold text-white">Enrolled Subjects</h2>
            <p className="text-xs text-slate-400">
              Each subject tracks weekly target study hours and curriculum roadmaps.
            </p>
          </div>
          <button
            onClick={() => setIsAddingSubject(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Subject</span>
          </button>
        </div>

        {/* Add Subject Modal */}
        {isAddingSubject && (
          <form onSubmit={handleAddSubjectSubmit} className="bg-slate-800/60 p-4 rounded-xl border border-slate-700 space-y-3 text-xs">
            <div className="text-xs font-bold text-indigo-300">Enroll New Subject</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Subject Code</label>
                <input
                  type="text"
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value)}
                  placeholder="e.g. CS 301"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Subject Full Name</label>
                <input
                  type="text"
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="e.g. Operating Systems & Concurrency"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Color Theme</label>
                <input
                  type="color"
                  value={subColor}
                  onChange={(e) => setSubColor(e.target.value)}
                  className="w-full h-9 bg-slate-800 border border-slate-700 rounded-lg cursor-pointer px-1 py-1"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Credits / Units</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={subCredits}
                  onChange={(e) => setSubCredits(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Target Study Hours / Week</label>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={subHours}
                  onChange={(e) => setSubHours(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="text-slate-400 block mb-1">Syllabus Overview (Optional)</label>
                <textarea
                  value={subSyllabus}
                  onChange={(e) => setSubSyllabus(e.target.value)}
                  placeholder="Paste syllabus summary or topics covered to help AI generate tailored roadmaps..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white h-16 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingSubject(false)}
                className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-sm"
              >
                Enroll Subject
              </button>
            </div>
          </form>
        )}

        {/* Subjects List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {state.subjects.map((sub) => {
            const topicCount = state.topics.filter((t) => t.subjectId === sub.id).length;

            return (
              <div
                key={sub.id}
                className="bg-slate-800/60 border border-slate-700/80 p-4 rounded-xl space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                    <div>
                      <div className="text-sm font-bold text-white">{sub.code}</div>
                      <div className="text-xs text-slate-300 font-medium">{sub.name}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteSubject(sub.id)}
                    className="text-slate-500 hover:text-rose-400 p-1 rounded"
                    title="Remove subject"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {sub.syllabusOverview && (
                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {sub.syllabusOverview}
                  </p>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-700/60">
                  <span>Target: <strong>{sub.targetWeeklyHours}h/wk</strong></span>
                  <span>Credits: <strong>{sub.credits}</strong></span>
                  <span>Roadmap: <strong>{topicCount} topics</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
