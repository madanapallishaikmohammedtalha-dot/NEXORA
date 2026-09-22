import React, { useState, useEffect } from 'react';
import { X, Play, Pause, RotateCcw, CheckCircle, Star, Zap, BookOpen } from 'lucide-react';
import { AppState, MissionItem, StudySession } from '../types';

interface SessionTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  activeMissionItem?: MissionItem | null;
  onCompleteSession: (session: Omit<StudySession, 'id'>, missionItemId?: string) => void;
}

export const SessionTrackerModal: React.FC<SessionTrackerModalProps> = ({
  isOpen,
  onClose,
  state,
  activeMissionItem,
  onCompleteSession,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [sessionTitle, setSessionTitle] = useState<string>('');
  const [plannedDuration, setPlannedDuration] = useState<number>(45);

  // Timer state (seconds)
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);

  // Reflection Modal Phase
  const [showReflection, setShowReflection] = useState<boolean>(false);
  const [comprehension, setComprehension] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [energy, setEnergy] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [takeaways, setTakeaways] = useState<string>('');

  useEffect(() => {
    if (activeMissionItem) {
      setSessionTitle(activeMissionItem.title);
      setPlannedDuration(activeMissionItem.plannedMinutes || 45);
      if (activeMissionItem.subjectId) setSelectedSubjectId(activeMissionItem.subjectId);
      if (activeMissionItem.topicId) setSelectedTopicId(activeMissionItem.topicId);
    } else if (state.subjects.length > 0) {
      setSelectedSubjectId(state.subjects[0].id);
      setSessionTitle('Deep Work Session');
    }
  }, [activeMissionItem, state.subjects]);

  // Timer interval
  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  if (!isOpen) return null;

  const minutes = Math.floor(secondsElapsed / 60);
  const seconds = secondsElapsed % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleFinishTimer = () => {
    setIsActive(false);
    setShowReflection(true);
  };

  const handleSaveReflection = () => {
    const actualMins = Math.max(1, Math.round(secondsElapsed / 60));
    const newSession: Omit<StudySession, 'id'> = {
      missionItemId: activeMissionItem?.id,
      topicId: selectedTopicId || undefined,
      subjectId: selectedSubjectId || state.subjects[0]?.id || 'general',
      startTime: new Date(Date.now() - secondsElapsed * 1000).toISOString(),
      endTime: new Date().toISOString(),
      plannedDurationMinutes: plannedDuration,
      actualDurationMinutes: actualMins,
      comprehensionRating: comprehension,
      energyRating: energy,
      keyTakeaways: takeaways || 'Completed study session with active practice.',
      date: '2026-09-21',
    };

    onCompleteSession(newSession, activeMissionItem?.id);
    // Reset
    setIsActive(false);
    setSecondsElapsed(0);
    setShowReflection(false);
    setTakeaways('');
    onClose();
  };

  const selectedSubject = state.subjects.find((s) => s.id === selectedSubjectId);
  const availableTopics = state.topics.filter((t) => !selectedSubjectId || t.subjectId === selectedSubjectId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div 
        id="session-tracker-container"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
            <h3 className="font-semibold text-white">
              {showReflection ? 'Session Reflection & Review' : 'Active Focus Session'}
            </h3>
          </div>
          <button
            id="close-session-modal-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!showReflection ? (
          /* Live Focus Timer View */
          <div className="p-6 space-y-6">
            {/* Task Banner */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                <span>{selectedSubject?.code || 'Subject'} • {selectedSubject?.name || 'Academic Study'}</span>
              </div>
              <h4 className="text-base font-semibold text-white">
                {sessionTitle || 'Deep Focus Block'}
              </h4>
              <div className="text-xs text-slate-400 mt-1">
                Planned Target: <span className="font-medium text-slate-200">{plannedDuration} mins</span>
              </div>
            </div>

            {/* Timer Display */}
            <div className="flex flex-col items-center justify-center py-6 bg-slate-950/40 rounded-2xl border border-slate-800">
              <div className="text-6xl font-mono font-bold tracking-tight text-white mb-2">
                {formattedTime}
              </div>
              <div className="text-xs text-slate-400">
                {isActive ? 'Tracking in progress...' : secondsElapsed > 0 ? 'Paused' : 'Ready to start'}
              </div>
            </div>

            {/* Timer Controls */}
            <div className="flex items-center justify-center gap-3">
              {!isActive ? (
                <button
                  id="start-timer-btn"
                  onClick={() => setIsActive(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{secondsElapsed === 0 ? 'Begin Session' : 'Resume'}</span>
                </button>
              ) : (
                <button
                  id="pause-timer-btn"
                  onClick={() => setIsActive(false)}
                  className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause</span>
                </button>
              )}

              {secondsElapsed > 0 && (
                <>
                  <button
                    id="finish-session-btn"
                    onClick={handleFinishTimer}
                    className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Complete Session</span>
                  </button>

                  <button
                    id="reset-timer-btn"
                    onClick={() => {
                      setIsActive(false);
                      setSecondsElapsed(0);
                    }}
                    className="p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                    title="Reset Timer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* Quick Context Selectors if not from a specific mission item */}
            {!activeMissionItem && (
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Subject</label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {state.subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code} - {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Roadmap Topic (Optional)</label>
                  <select
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">-- General Topic / Problem Set --</option>
                    {availableTopics.map((top) => (
                      <option key={top.id} value={top.id}>
                        {top.title} ({top.masteryLevel}% mastery)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Post-Session Reflection Phase */
          <div className="p-6 space-y-5">
            <div className="bg-slate-800/60 p-3 rounded-xl text-xs text-slate-300">
              Session completed: <span className="font-semibold text-emerald-300">{Math.max(1, Math.round(secondsElapsed / 60))} mins actual</span> (vs {plannedDuration} mins planned).
            </div>

            {/* Comprehension Rating */}
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
                <Star className="w-3.5 h-3.5 text-amber-400" />
                <span>Comprehension Rating</span>
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setComprehension(lvl as any)}
                    className={`py-2 px-1 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                      comprehension === lvl
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div>{lvl}★</div>
                    <div className="text-[10px] text-slate-400">
                      {lvl === 1 ? 'Lost' : lvl === 3 ? 'Fair' : lvl === 5 ? 'Mastered' : ''}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Energy Rating */}
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                <span>Energy & Flow Level</span>
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setEnergy(lvl as any)}
                    className={`py-2 px-1 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer ${
                      energy === lvl
                        ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div>{lvl} ⚡</div>
                    <div className="text-[10px] text-slate-400">
                      {lvl === 1 ? 'Drained' : lvl === 3 ? 'Medium' : lvl === 5 ? 'Peak' : ''}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Key Takeaways */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Key Takeaways & What Stuck
              </label>
              <textarea
                value={takeaways}
                onChange={(e) => setTakeaways(e.target.value)}
                placeholder="E.g. Understood Peterson algorithm solution for 2 processes; need more practice on deadlock banker matrix."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 h-24 resize-none"
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowReflection(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-medium cursor-pointer"
              >
                Back to Timer
              </button>
              <button
                id="save-session-reflection-btn"
                type="button"
                onClick={handleSaveReflection}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm cursor-pointer"
              >
                Log Session & Update Mastery
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
