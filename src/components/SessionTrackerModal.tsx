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
  Award,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { ActivityType, AppState, MissionItem, RoadmapTopic, StudySession, Subject } from '../types';
import { dataService } from '../services/dataService';

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
  // Context state
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [sessionTitle, setSessionTitle] = useState<string>('');
  const [plannedDuration, setPlannedDuration] = useState<number>(45);
  const [objective, setObjective] = useState<string>('');
  const [scheduledStartTime, setScheduledStartTime] = useState<string>('');
  const [scheduledEndTime, setScheduledEndTime] = useState<string>('');
  const [activityType, setActivityType] = useState<ActivityType>('academic_study');

  // Timer state
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);

  // Modal Flow Step: 'timer' | 'reflection' | 'summary'
  const [modalStep, setModalStep] = useState<'timer' | 'reflection' | 'summary'>('timer');

  // Reflection data
  const [actualMinutesInput, setActualMinutesInput] = useState<number>(45);
  const [comprehension, setComprehension] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [energy, setEnergy] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [takeaways, setTakeaways] = useState<string>('');
  const [difficultyNote, setDifficultyNote] = useState<string>('');
  const [completionState, setCompletionState] = useState<'completed' | 'partial'>('completed');

  // Session complete summary calculation cache
  const [summaryData, setSummaryData] = useState<any>(null);

  // Synchronize when activeMissionItem or modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (activeMissionItem) {
      setSessionTitle(activeMissionItem.title);
      const planned = activeMissionItem.plannedMinutes || 30;
      setPlannedDuration(planned);
      setActualMinutesInput(planned);
      if (activeMissionItem.subjectId) setSelectedSubjectId(activeMissionItem.subjectId);
      if (activeMissionItem.topicId) setSelectedTopicId(activeMissionItem.topicId);
      setObjective(activeMissionItem.objective || activeMissionItem.reason || 'Active learning and conceptual mastery');
      setScheduledStartTime(activeMissionItem.scheduledTime || '');
      setScheduledEndTime(activeMissionItem.endTime || '');
      setActivityType(activeMissionItem.activityType || 'academic_study');
    } else if (state.subjects.length > 0) {
      setSelectedSubjectId(state.subjects[0].id);
      setSessionTitle('Deep Work Session');
      setPlannedDuration(45);
      setActualMinutesInput(45);
      setObjective('Sustained cognitive focus and problem solving');
      setScheduledStartTime('');
      setScheduledEndTime('');
      setActivityType('academic_study');
    }
    setModalStep('timer');
  }, [isOpen, activeMissionItem, state.subjects]);

  // Active timer tick
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

  // Keep actualMinutesInput in sync with elapsed when advancing to reflection
  const handleTransitionToReflection = () => {
    setIsActive(false);
    const measuredMins = Math.max(1, Math.round(secondsElapsed / 60));
    setActualMinutesInput(measuredMins);
    setModalStep('reflection');
  };

  if (!isOpen) return null;

  const totalPlannedSeconds = Math.max(60, plannedDuration * 60);
  const isOvertime = secondsElapsed > totalPlannedSeconds;
  const secondsRemaining = Math.max(0, totalPlannedSeconds - secondsElapsed);
  const overtimeSeconds = secondsElapsed - totalPlannedSeconds;

  // Formatted countdown strings
  const remMinutes = Math.floor(secondsRemaining / 60);
  const remSecs = secondsRemaining % 60;
  const formattedCountdown = `${String(remMinutes).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;

  const overMinutes = Math.floor(overtimeSeconds / 60);
  const overSecs = overtimeSeconds % 60;
  const formattedOvertime = `+${String(overMinutes).padStart(2, '0')}:${String(overSecs).padStart(2, '0')}`;

  const elapsedMinutes = Math.floor(secondsElapsed / 60);
  const elapsedSecs = secondsElapsed % 60;
  const formattedElapsed = `${String(elapsedMinutes).padStart(2, '0')}:${String(elapsedSecs).padStart(2, '0')}`;

  const progressPercent = Math.min(100, Math.round((secondsElapsed / totalPlannedSeconds) * 100));

  // Explicit non-blocking warnings per specification
  // 5 minutes remaining warning:
  const is5MinWarning = secondsRemaining <= 300 && secondsRemaining > 60 && !isOvertime && isActive;
  // 1 minute remaining warning:
  const is1MinWarning = secondsRemaining <= 60 && secondsRemaining > 0 && !isOvertime && isActive;

  const selectedSubject = state.subjects.find((s) => s.id === selectedSubjectId);
  const currentTopic = state.topics.find((t) => t.id === selectedTopicId);
  const availableTopics = state.topics.filter((t) => !selectedSubjectId || t.subjectId === selectedSubjectId);

  // Transition from Reflection -> Summary View
  const handleProceedToSummary = () => {
    const summary = dataService.calculateSessionSummary({
      topicId: selectedTopicId || undefined,
      subjectId: selectedSubjectId || state.subjects[0]?.id || 'general',
      plannedDurationMinutes: plannedDuration,
      actualDurationMinutes: actualMinutesInput,
      comprehensionRating: comprehension,
      energyRating: energy,
    });
    setSummaryData(summary);
    setModalStep('summary');
  };

  // Final Save & Commit via DataService
  const handleSaveAndCommit = () => {
    const todayStr = '2026-09-21';
    const newSession: Omit<StudySession, 'id'> = {
      missionItemId: activeMissionItem?.id,
      topicId: selectedTopicId || undefined,
      subjectId: selectedSubjectId || state.subjects[0]?.id || 'general',
      startTime: new Date(Date.now() - secondsElapsed * 1000).toISOString(),
      endTime: new Date().toISOString(),
      plannedDurationMinutes: plannedDuration,
      actualDurationMinutes: actualMinutesInput,
      comprehensionRating: comprehension,
      energyRating: energy,
      keyTakeaways: takeaways || 'Completed focus session with active practice and notes review.',
      difficultyNote: difficultyNote.trim() || undefined,
      date: todayStr,
    };

    onCompleteSession(newSession, activeMissionItem?.id, completionState);

    // Reset internal state
    setIsActive(false);
    setSecondsElapsed(0);
    setModalStep('timer');
    setTakeaways('');
    setDifficultyNote('');
    onClose();
  };

  const getActivityTypeBadge = (type?: ActivityType) => {
    switch (type) {
      case 'college_work':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30">College Work</span>;
      case 'dsa_practice':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">DSA Practice</span>;
      case 'career_learning':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">Career Skill</span>;
      case 'project_work':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/30">Project Work</span>;
      case 'revision':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">Revision</span>;
      case 'academic_study':
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/30">Academic Study</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div 
        id="session-tracker-container"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <h3 className="font-semibold text-white tracking-tight">
              {modalStep === 'timer' && 'Active Focus Session'}
              {modalStep === 'reflection' && 'Cognitive Reflection & Telemetry'}
              {modalStep === 'summary' && 'SESSION COMPLETE'}
            </h3>
          </div>
          <button
            id="close-session-modal-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ========================================================================= */}
        {/* STEP 1: ACTIVE FOCUS TIMER                                               */}
        {/* ========================================================================= */}
        {modalStep === 'timer' && (
          <div className="p-6 space-y-6">
            {/* Task Banner */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span className="flex items-center gap-1.5 font-medium text-indigo-400">
                  <BookOpen className="w-3.5 h-3.5" />
                  {selectedSubject?.code || 'Academic'} • {selectedSubject?.name || 'Curriculum Course'}
                </span>
                <div className="flex items-center gap-2">
                  {getActivityTypeBadge(activityType)}
                  <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                    Planned: {plannedDuration}m
                  </span>
                </div>
              </div>

              {/* Topic Title */}
              <h4 className="text-base font-bold text-white leading-snug">
                {currentTopic?.title || sessionTitle || 'Deep Work Session'}
              </h4>

              {/* Scheduled Start/End & Domain */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-0.5">
                {(scheduledStartTime || scheduledEndTime) && (
                  <span className="flex items-center gap-1 text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Scheduled: {scheduledStartTime || '--:--'} – {scheduledEndTime || '--:--'}</span>
                  </span>
                )}
                {currentTopic?.domain && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span>Domain: {currentTopic.domain}</span>
                  </span>
                )}
              </div>

              {/* Objective */}
              <div className="text-xs text-slate-300 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/80 flex items-start gap-2">
                <Target className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-200">Objective: </span>
                  <span className="text-slate-300">{objective || 'Engage deeply with core concepts, solve exercises, and test mental models.'}</span>
                </div>
              </div>
            </div>

            {/* Countdown / Overtime Clock */}
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
                <span>Planned: {plannedDuration}:00</span>
                <span>•</span>
                <span className={isActive ? 'text-emerald-400' : 'text-slate-500'}>
                  {isActive ? 'Timer Active' : secondsElapsed > 0 ? 'Paused' : 'Ready to Start'}
                </span>
              </div>

              {/* Non-blocking warnings per exact requirements */}
              {is5MinWarning && (
                <div 
                  id="session-5min-warning"
                  className="mt-3 mx-4 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-lg flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>You have 5 minutes left. Finish your current thought or example.</span>
                </div>
              )}

              {is1MinWarning && (
                <div 
                  id="session-1min-warning"
                  className="mt-3 mx-4 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>Wrap up your current work. Your progress will be saved.</span>
                </div>
              )}

              {isOvertime && (
                <div className="mt-3 mx-4 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs rounded-lg flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Deep Flow: continuing past planned target without interruption.</span>
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
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {!isActive ? (
                <button
                  id="start-timer-btn"
                  onClick={() => setIsActive(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{secondsElapsed === 0 ? 'Start Focus Session' : 'Resume'}</span>
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

              {/* Finish Early Button */}
              {secondsElapsed > 0 && secondsRemaining > 0 && !isOvertime && (
                <button
                  id="finish-early-btn"
                  onClick={handleTransitionToReflection}
                  className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium rounded-xl transition-all cursor-pointer"
                >
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Finish Early</span>
                </button>
              )}

              {/* Finish Session Button (available whenever work has elapsed or planned time reached) */}
              {secondsElapsed > 0 && (
                <button
                  id="finish-session-btn"
                  onClick={handleTransitionToReflection}
                  className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{isOvertime ? 'Finish Overtime Session' : 'Finish Session'}</span>
                </button>
              )}

              {secondsElapsed > 0 && (
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
              )}
            </div>

            {/* Quick Context Selector if opened without mission item */}
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
        )}

        {/* ========================================================================= */}
        {/* STEP 2: POST-SESSION REFLECTION COLLECTION                                */}
        {/* ========================================================================= */}
        {modalStep === 'reflection' && (
          <div className="p-6 space-y-5">
            {/* Duration Overview */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">Actual Duration Logged</div>
                <div className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={360}
                    value={actualMinutesInput}
                    onChange={(e) => setActualMinutesInput(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-lg font-bold text-white text-center focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-sm font-medium text-slate-400">minutes</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">Planned Duration</div>
                <div className="text-base font-semibold text-slate-200">
                  {plannedDuration} min
                </div>
              </div>
            </div>

            {/* Comprehension Rating (1 to 5) */}
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
                  {comprehension === 5 && '5 • Mastered / Could Teach It'}
                </span>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setComprehension(lvl as any)}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
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

            {/* Energy Rating (1 to 5) */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Energy Rating (1 to 5)</span>
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
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
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

            {/* Key Takeaway */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Key Takeaway
              </label>
              <textarea
                value={takeaways}
                onChange={(e) => setTakeaways(e.target.value)}
                placeholder="What was the core breakthrough, mental model, or mechanism learned?"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none h-18"
              />
            </div>

            {/* Optional Difficulty Note */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-400 flex items-center justify-between">
                <span>Optional Difficulty Note</span>
                <span className="text-[10px] text-slate-500">Roadblocks, tricky edge cases</span>
              </label>
              <input
                type="text"
                value={difficultyNote}
                onChange={(e) => setDifficultyNote(e.target.value)}
                placeholder="e.g., Struggled with race conditions in edge cases; need more practice on semaphores"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Action buttons */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setModalStep('timer')}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors cursor-pointer"
              >
                Back to Timer
              </button>
              <button
                type="button"
                id="review-session-summary-btn"
                onClick={handleProceedToSummary}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Review Summary</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: SESSION COMPLETE SUMMARY CARD                                     */}
        {/* ========================================================================= */}
        {modalStep === 'summary' && summaryData && (
          <div className="p-6 space-y-5">
            <div className="text-center pb-2 border-b border-slate-800">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-black text-white tracking-wide uppercase">
                SESSION COMPLETE
              </h2>
            </div>

            {/* Core Metrics Grid */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Topic:</span>
                <span className="font-bold text-white max-w-[240px] truncate text-right">
                  {summaryData.topicTitle}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                  <div className="text-slate-400 text-[11px]">Planned:</div>
                  <div className="text-base font-bold text-slate-200">
                    {summaryData.plannedMinutes} min
                  </div>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                  <div className="text-slate-400 text-[11px]">Actual:</div>
                  <div className="text-base font-bold text-emerald-400">
                    {summaryData.actualMinutes} min
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                  <div className="text-slate-400 text-[11px]">Comprehension:</div>
                  <div className="text-base font-bold text-amber-300">
                    {summaryData.comprehensionRating}/5 ★
                  </div>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                  <div className="text-slate-400 text-[11px]">Energy:</div>
                  <div className="text-base font-bold text-indigo-300">
                    {summaryData.energyRating}/5 ⚡
                  </div>
                </div>
              </div>
            </div>

            {/* Evidence Checklist & Mastery Status */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-300">Evidence:</div>
              <div className="flex items-center gap-4 text-xs">
                <span className={`flex items-center gap-1 font-medium ${summaryData.evidence.studied ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <span>Studied</span>
                  <span>{summaryData.evidence.studied ? '✓' : '✗'}</span>
                </span>
                <span className={`flex items-center gap-1 font-medium ${summaryData.evidence.practiced ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <span>Practiced</span>
                  <span>{summaryData.evidence.practiced ? '✓' : '✗'}</span>
                </span>
                <span className={`flex items-center gap-1 font-medium ${summaryData.evidence.assessed ? 'text-emerald-400' : 'text-slate-500'}`}>
                  <span>Assessed</span>
                  <span>{summaryData.evidence.assessed ? '✓' : '✗'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/60">
                <span className="text-slate-400">Mastery:</span>
                <span className={`font-semibold ${summaryData.masteryStatus === 'increased' ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {summaryData.masteryStatus === 'increased' 
                    ? `increased (${summaryData.masteryBefore}% → ${summaryData.masteryAfter}%)` 
                    : 'unchanged'}
                </span>
              </div>
            </div>

            {/* Next Recommended Action */}
            <div className="bg-indigo-950/30 border border-indigo-900/40 rounded-xl p-3.5 space-y-1">
              <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wide">
                Next Recommended Action:
              </div>
              <div className="text-xs text-slate-200 leading-relaxed">
                {summaryData.nextRecommendedAction}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setModalStep('reflection')}
                className="py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-medium transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                id="save-session-final-btn"
                onClick={handleSaveAndCommit}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Save Session & Update Progress</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
