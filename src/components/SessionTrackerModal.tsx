import React, { useState, useEffect } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle, 
  Star, 
  Zap, 
  BookOpen, 
  Clock, 
  Target, 
  AlertTriangle,
  Flame,
  Award
} from 'lucide-react';
import { AppState, MissionItem, StudySession } from '../types';

interface SessionTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  activeMissionItem?: MissionItem | null;
  onCompleteSession: (
    session: Omit<StudySession, 'id'>, 
    missionItemId?: string,
    completionState?: 'completed' | 'partial'
  ) => void;
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
  const [objective, setObjective] = useState<string>('');

  // Timer state (seconds elapsed)
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);

  // Reflection Modal Phase
  const [showReflection, setShowReflection] = useState<boolean>(false);
  const [comprehension, setComprehension] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [energy, setEnergy] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [takeaways, setTakeaways] = useState<string>('');
  const [completionState, setCompletionState] = useState<'completed' | 'partial'>('completed');

  useEffect(() => {
    if (activeMissionItem) {
      setSessionTitle(activeMissionItem.title);
      setPlannedDuration(activeMissionItem.plannedMinutes || 45);
      if (activeMissionItem.subjectId) setSelectedSubjectId(activeMissionItem.subjectId);
      if (activeMissionItem.topicId) setSelectedTopicId(activeMissionItem.topicId);
      setObjective(activeMissionItem.objective || activeMissionItem.reason || 'Active learning and conceptual mastery');
    } else if (state.subjects.length > 0) {
      setSelectedSubjectId(state.subjects[0].id);
      setSessionTitle('Deep Work Session');
      setObjective('Sustained cognitive focus and problem solving');
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

  const totalPlannedSeconds = Math.max(60, plannedDuration * 60);
  const isOvertime = secondsElapsed > totalPlannedSeconds;
  const secondsRemaining = Math.max(0, totalPlannedSeconds - secondsElapsed);
  const overtimeSeconds = secondsElapsed - totalPlannedSeconds;

  // Countdown display
  const remMinutes = Math.floor(secondsRemaining / 60);
  const remSecs = secondsRemaining % 60;
  const formattedCountdown = `${String(remMinutes).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;

  // Overtime display
  const overMinutes = Math.floor(overtimeSeconds / 60);
  const overSecs = overtimeSeconds % 60;
  const formattedOvertime = `+${String(overMinutes).padStart(2, '0')}:${String(overSecs).padStart(2, '0')}`;

  // Elapsed display
  const elapsedMinutes = Math.floor(secondsElapsed / 60);
  const elapsedSecs = secondsElapsed % 60;
  const formattedElapsed = `${String(elapsedMinutes).padStart(2, '0')}:${String(elapsedSecs).padStart(2, '0')}`;

  // Progress percentage
  const progressPercent = Math.min(100, Math.round((secondsElapsed / totalPlannedSeconds) * 100));

  // Warnings
  const is5MinWarning = secondsRemaining <= 300 && secondsRemaining > 60 && !isOvertime && isActive;
  const is1MinWarning = secondsRemaining <= 60 && secondsRemaining > 0 && !isOvertime && isActive;

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
      keyTakeaways: takeaways || 'Completed study session with active practice and notes review.',
      date: '2026-09-21',
    };

    onCompleteSession(newSession, activeMissionItem?.id, completionState);
    // Reset
    setIsActive(false);
    setSecondsElapsed(0);
    setShowReflection(false);
    setTakeaways('');
    onClose();
  };

  const selectedSubject = state.subjects.find((s) => s.id === selectedSubjectId);
  const currentTopic = state.topics.find((t) => t.id === selectedTopicId);
  const availableTopics = state.topics.filter((t) => !selectedSubjectId || t.subjectId === selectedSubjectId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div 
        id="session-tracker-container"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <h3 className="font-semibold text-white tracking-tight">
              {showReflection ? 'Cognitive Reflection & Review' : 'Active Focus Session'}
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
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5 font-medium text-indigo-400">
                  <BookOpen className="w-3.5 h-3.5" />
                  {selectedSubject?.code || 'Subject'} • {selectedSubject?.name || 'Academic Study'}
                </span>
                <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                  Target: {plannedDuration} mins
                </span>
              </div>

              <h4 className="text-base font-bold text-white leading-snug">
                {sessionTitle || currentTopic?.title || 'Deep Work Session'}
              </h4>

              {/* Current Topic & Objective */}
              <div className="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 flex items-start gap-2">
                <Target className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-200">Objective: </span>
                  <span className="text-slate-300">{objective || 'Engage deeply with core concepts, solve exercises, and test mental models.'}</span>
                </div>
              </div>
            </div>

            {/* Countdown / Overtime Timer Display */}
            <div className="flex flex-col items-center justify-center py-7 bg-slate-950 rounded-2xl border border-slate-800 relative overflow-hidden">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                {isOvertime ? 'Overtime Flow' : 'Countdown Remaining'}
              </div>

              <div className={`text-6xl font-mono font-extrabold tracking-tight ${isOvertime ? 'text-amber-300' : 'text-white'}`}>
                {isOvertime ? formattedOvertime : formattedCountdown}
              </div>

              <div className="text-xs text-slate-400 mt-2 flex items-center gap-2">
                <span>Elapsed: {formattedElapsed}</span>
                <span>•</span>
                <span>{isActive ? 'Timer Active' : secondsElapsed > 0 ? 'Paused' : 'Ready'}</span>
              </div>

              {/* Warnings */}
              {is5MinWarning && (
                <div className="mt-3 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-full flex items-center gap-1.5 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>5 minutes remaining — wrap up active practice</span>
                </div>
              )}

              {is1MinWarning && (
                <div className="mt-3 px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-full flex items-center gap-1.5 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>1 minute remaining — prepare key takeaways</span>
                </div>
              )}

              {isOvertime && (
                <div className="mt-3 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs rounded-full flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Deep Flow: continuing past planned target without interruption</span>
                </div>
              )}
            </div>

            {/* Session Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Session Progress</span>
                <span className="font-semibold text-slate-200">{progressPercent}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${isOvertime ? 'bg-amber-400' : 'bg-emerald-500'}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Timer Controls */}
            <div className="flex items-center justify-center gap-3 pt-2">
              {!isActive ? (
                <button
                  id="start-timer-btn"
                  onClick={() => setIsActive(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{secondsElapsed === 0 ? 'Start Learning Activity' : 'Resume'}</span>
                </button>
              ) : (
                <button
                  id="pause-timer-btn"
                  onClick={() => setIsActive(false)}
                  className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause Timer</span>
                </button>
              )}

              {secondsElapsed > 0 && (
                <>
                  <button
                    id="finish-session-btn"
                    onClick={handleFinishTimer}
                    className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg transition-all cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{secondsRemaining > 0 ? 'Finish Early & Log' : 'Complete Session'}</span>
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

            {/* Quick Context Selectors if opened independently without mission item */}
            {!activeMissionItem && (
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Select Subject
                  </label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => {
                      setSelectedSubjectId(e.target.value);
                      setSelectedTopicId('');
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    {state.subjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.code} — {sub.name}
                      </option>
                    ))}
                  </select>
                </div>

                {availableTopics.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Curriculum Topic (Optional)
                    </label>
                    <select
                      value={selectedTopicId}
                      onChange={(e) => setSelectedTopicId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    >
                      <option value="">-- General Practice / Problem Solving --</option>
                      {availableTopics.map((top) => (
                        <option key={top.id} value={top.id}>
                          {top.title} ({top.masteryLevel}% mastery)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Post-Session Reflection Phase */
          <div className="p-6 space-y-5">
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">Total Actual Duration</div>
                <div className="text-2xl font-bold text-emerald-400">
                  {Math.max(1, Math.round(secondsElapsed / 60))} minutes
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Planned Target</div>
                <div className="text-base font-semibold text-slate-200">
                  {plannedDuration} minutes
                </div>
              </div>
            </div>

            {/* Completion State */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Activity Completion Status
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCompletionState('completed')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                    completionState === 'completed'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Objective Completed</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCompletionState('partial')}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                    completionState === 'partial'
                      ? 'bg-amber-950 text-amber-300 border-amber-600'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Partial Progress</span>
                </button>
              </div>
            </div>

            {/* Comprehension Rating */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-400" />
                  <span>Comprehension Rating (1 to 5)</span>
                </label>
                <span className="text-xs text-amber-300 font-medium">
                  {comprehension === 1 && '1 • Lost / High Confusion'}
                  {comprehension === 2 && '2 • Shaky / Needed Guidance'}
                  {comprehension === 3 && '3 • Competent / Grasped Core'}
                  {comprehension === 4 && '4 • Proficient / Solved Independently'}
                  {comprehension === 5 && '5 • Mastered / Could Teach Concept'}
                </span>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setComprehension(lvl as any)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                      comprehension >= lvl
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-950 text-slate-500 border-slate-800'
                    }`}
                  >
                    ★ {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Energy Rating */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Cognitive Energy Level</span>
                </label>
                <span className="text-xs text-indigo-300 font-medium">
                  {energy === 1 && '1 • Exhausted'}
                  {energy === 2 && '2 • Fatigued'}
                  {energy === 3 && '3 • Steady'}
                  {energy === 4 && '4 • Alert'}
                  {energy === 5 && '5 • Peak Flow'}
                </span>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setEnergy(lvl as any)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                      energy >= lvl
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        : 'bg-slate-950 text-slate-500 border-slate-800'
                    }`}
                  >
                    ⚡ {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Qualitative Takeaways */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Key Takeaways, Formulas & Core Insights
              </label>
              <textarea
                value={takeaways}
                onChange={(e) => setTakeaways(e.target.value)}
                placeholder="What was the main breakthrough, tricky edge case, or concept mastered in this session?"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none h-20"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setShowReflection(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors"
              >
                Back to Timer
              </button>
              <button
                type="button"
                id="save-session-reflection-btn"
                onClick={handleSaveReflection}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md"
              >
                Save & Update Topic Mastery
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
