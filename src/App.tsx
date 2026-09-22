import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Clock, 
  GitBranch, 
  Bot, 
  BarChart3, 
  BookOpen, 
  Settings, 
  Play, 
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  SlidersHorizontal
} from 'lucide-react';
import { 
  ActiveTab, 
  AppState, 
  DailyMission, 
  MissionItem, 
  RoadmapTopic, 
  Semester, 
  StudySession, 
  Subject, 
  TimetableSlot, 
  TopicStatus, 
  UserProfile 
} from './types';
import { loadAppState, resetToDemoState, exportStateAsJSON, importStateFromJSON } from './services/storage';
import { dataService } from './services/dataService';
import { Dashboard } from './components/Dashboard';
import { DailyPlannerModule } from './components/DailyPlannerModule';
import { TimetableModule } from './components/TimetableModule';
import { RoadmapModule } from './components/RoadmapModule';
import { AITutorModule } from './components/AITutorModule';
import { ProgressModule } from './components/ProgressModule';
import { SemesterModule } from './components/SemesterModule';
import { SettingsModule } from './components/SettingsModule';
import { SessionTrackerModal } from './components/SessionTrackerModal';
import { OnboardingModal } from './components/OnboardingModal';

export default function App() {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Modal states
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [activeFocusItem, setActiveFocusItem] = useState<MissionItem | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(
    !state.profile.hasCompletedOnboarding
  );

  // Selected topic context for AI Tutor
  const [tutorTopic, setTutorTopic] = useState<RoadmapTopic | null>(null);

  // Toast message state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Subscribe to DataService external mutations and single-source-of-truth state
  useEffect(() => {
    const unsubscribe = dataService.subscribe((updated) => {
      setState(updated);
    });
    return unsubscribe;
  }, []);

  // Handler: Toggle Mission Item status
  const handleToggleItemStatus = (dateStr: string, itemId: string) => {
    const mission = dataService.getDailyMission(dateStr);
    if (!mission) return;

    const item = mission.items.find((i: MissionItem) => i.id === itemId);
    if (!item) return;

    const nextStatus = item.status === 'completed' ? 'pending' : 'completed';
    const updatedItem: MissionItem = {
      ...item,
      status: nextStatus as any,
      actualMinutes: nextStatus === 'completed' && item.actualMinutes === 0 ? item.plannedMinutes : item.actualMinutes,
    };

    try {
      dataService.saveMissionItem(dateStr, updatedItem);
    } catch (err: any) {
      showToast(`Failed to update item: ${err.message}`);
    }
  };

  // Handler: Save Daily Mission
  const handleSaveMission = (updatedMission: DailyMission) => {
    try {
      dataService.saveDailyMission(updatedMission);
      showToast(`Mission saved for ${updatedMission.date}`);
    } catch (err: any) {
      showToast(`Failed to save mission: ${err.message}`);
    }
  };

  // Handler: Start Focus Session
  const handleStartSessionForItem = (item: MissionItem) => {
    setActiveFocusItem(item);
    setIsFocusModalOpen(true);
  };

  // Handler: Finish and Log Focus Session
  const handleCompleteFocusSession = (
    sessionData: Omit<StudySession, 'id'>,
    missionItemId?: string
  ) => {
    const fullSession: StudySession = {
      ...sessionData,
      id: `sess-${Date.now()}`,
      missionItemId: missionItemId || sessionData.missionItemId,
    };

    try {
      dataService.recordStudySession(fullSession);
      showToast(`Logged ${fullSession.actualDurationMinutes}m study session.`);
    } catch (err: any) {
      showToast(`Failed to log study session: ${err.message}`);
    }
  };

  // Timetable Handlers
  const handleSaveSlot = (slot: TimetableSlot) => {
    try {
      dataService.saveTimetableSlot(slot);
      showToast(`Timetable block saved`);
    } catch (err: any) {
      showToast(`Failed to save timetable block: ${err.message}`);
    }
  };

  const handleDeleteSlot = (slotId: string) => {
    try {
      dataService.deleteTimetableSlot(slotId);
      showToast(`Timetable block removed`);
    } catch (err: any) {
      showToast(`Failed to remove timetable block: ${err.message}`);
    }
  };

  // Roadmap & Topic Handlers
  const handleSaveTopic = (topic: RoadmapTopic) => {
    try {
      dataService.saveTopic(topic);
      showToast(`Topic "${topic.title}" saved`);
    } catch (err: any) {
      showToast(`Topic error: ${err.message}`);
    }
  };

  const handleSaveTopics = (topics: RoadmapTopic[]) => {
    try {
      dataService.saveTopics(topics);
      showToast(`Imported ${topics.length} topics into curriculum`);
    } catch (err: any) {
      showToast(`Roadmap batch error: ${err.message}`);
    }
  };

  const handleOverrideTopicPrerequisites = (topicId: string, override: boolean) => {
    try {
      dataService.overrideTopicPrerequisites(topicId, override);
      showToast(override ? 'Prerequisite requirement bypassed' : 'Prerequisite lock restored');
    } catch (err: any) {
      showToast(`Override error: ${err.message}`);
    }
  };

  const handleUpdateTopicMastery = (topicId: string, mastery: number, status?: TopicStatus) => {
    try {
      dataService.updateTopicMastery(topicId, mastery, status);
    } catch (err: any) {
      showToast(`Mastery error: ${err.message}`);
    }
  };

  const handleAddTopicToDailyMission = (topic: RoadmapTopic) => {
    const todayStr = '2026-09-21';
    const newItem: MissionItem = {
      id: `mi-${Date.now()}`,
      topicId: topic.id,
      subjectId: topic.subjectId,
      title: `Study: ${topic.title}`,
      plannedMinutes: topic.estimatedMinutes || 45,
      actualMinutes: 0,
      status: 'pending',
      isAIRecorded: false,
    };

    try {
      dataService.saveMissionItem(todayStr, newItem);
      showToast(`Added "${topic.title}" to today's mission`);
    } catch (err: any) {
      showToast(`Failed to add topic to mission: ${err.message}`);
    }
  };

  // Semester Handlers
  const handleUpdateSemester = (semester: Semester) => {
    try {
      dataService.saveSemester(semester);
      showToast(`Semester "${semester.name}" updated`);
    } catch (err: any) {
      showToast(`Failed to update semester: ${err.message}`);
    }
  };

  const handleSaveSubject = (subject: Subject) => {
    try {
      dataService.saveSubject(subject);
      showToast(`Subject "${subject.code}" enrolled`);
    } catch (err: any) {
      showToast(`Failed to enroll subject: ${err.message}`);
    }
  };

  const handleDeleteSubject = (subjectId: string) => {
    try {
      dataService.deleteSubject(subjectId);
      showToast(`Subject and related topics removed`);
    } catch (err: any) {
      showToast(`Failed to remove subject: ${err.message}`);
    }
  };

  // Settings & Profile Handlers
  const handleUpdateProfile = (profile: UserProfile) => {
    try {
      dataService.updateProfile(profile);
      showToast('Profile & AI settings saved');
    } catch (err: any) {
      showToast(`Failed to update profile: ${err.message}`);
    }
  };

  const handleExportData = () => {
    exportStateAsJSON(dataService.getState());
    showToast('NEXORA backup exported to JSON');
  };

  const handleImportData = (jsonStr: string): boolean => {
    try {
      importStateFromJSON(jsonStr);
      showToast('NEXORA database restored from backup');
      return true;
    } catch (err: any) {
      showToast(`Restore error: ${err.message || 'Invalid format'}`);
      return false;
    }
  };

  const handleResetData = () => {
    resetToDemoState();
    showToast('Reset to demo defaults');
  };

  const handleOnboardingComplete = (updatedState: Partial<AppState>) => {
    const current = dataService.getState();
    const merged: AppState = {
      ...current,
      ...updatedState,
      profile: {
        ...current.profile,
        ...updatedState.profile,
        hasCompletedOnboarding: true,
      },
    };
    dataService.saveState(merged);
    setIsOnboardingOpen(false);
    showToast('Welcome to NEXORA! Your academic operating system is live.');
  };

  const navTabs: Array<{ id: ActiveTab; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'planner', label: 'Daily Planner', icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'timetable', label: 'Timetable', icon: <Clock className="w-4 h-4" /> },
    { id: 'roadmap', label: 'Roadmaps', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'tutor', label: 'AI Tutor', icon: <Bot className="w-4 h-4" /> },
    { id: 'progress', label: 'Progress', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'semester', label: 'Curriculum', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white border border-indigo-500/60 shadow-2xl px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Main Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Logo & Tagline */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center font-extrabold text-white text-sm shadow-md shadow-indigo-500/20">
              NX
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-white">NEXORA</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50">
                  OS v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Personal Learning & Career Operating System
              </p>
            </div>
          </div>

          {/* Center / Right Controls: Quick Focus Trigger & Student Badge */}
          <div className="flex items-center gap-2.5">
            <button
              id="open-setup-wizard-btn"
              onClick={() => setIsOnboardingOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-medium transition-all cursor-pointer"
              title="Edit your academic routine, timetable, and preferences"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Setup & Routine</span>
            </button>

            <button
              id="global-focus-btn"
              onClick={() => {
                setActiveFocusItem(null);
                setIsFocusModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
              title="Launch Pomodoro Focus Session"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Focus</span>
            </button>

            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-medium truncate max-w-[120px]">{state.profile.name || 'Alex Mercer'}</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="max-w-7xl mx-auto mt-2.5 overflow-x-auto scrollbar-none pb-0.5">
          <nav className="flex items-center gap-1">
            {navTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && (
          <Dashboard
            state={state}
            setActiveTab={setActiveTab}
            onStartSessionForItem={handleStartSessionForItem}
            onToggleItemStatus={handleToggleItemStatus}
            onOpenFocusSession={() => {
              setActiveFocusItem(null);
              setIsFocusModalOpen(true);
            }}
          />
        )}

        {activeTab === 'planner' && (
          <DailyPlannerModule
            state={state}
            onSaveMission={handleSaveMission}
            onStartSessionForItem={handleStartSessionForItem}
            onToggleItemStatus={handleToggleItemStatus}
          />
        )}

        {activeTab === 'timetable' && (
          <TimetableModule
            state={state}
            onSaveSlot={handleSaveSlot}
            onDeleteSlot={handleDeleteSlot}
          />
        )}

        {activeTab === 'roadmap' && (
          <RoadmapModule
            state={state}
            setActiveTab={setActiveTab}
            onSaveTopic={handleSaveTopic}
            onSaveTopics={handleSaveTopics}
            onUpdateTopicMastery={handleUpdateTopicMastery}
            onOverrideTopicPrerequisites={handleOverrideTopicPrerequisites}
            onSelectTopicForTutor={(topic) => setTutorTopic(topic)}
            onAddTopicToDailyMission={handleAddTopicToDailyMission}
          />
        )}

        {activeTab === 'tutor' && (
          <AITutorModule
            state={state}
            selectedTopic={tutorTopic}
            onAddTopicToMission={handleAddTopicToDailyMission}
          />
        )}

        {activeTab === 'progress' && (
          <ProgressModule state={state} />
        )}

        {activeTab === 'semester' && (
          <SemesterModule
            state={state}
            onUpdateSemester={handleUpdateSemester}
            onSaveSubject={handleSaveSubject}
            onDeleteSubject={handleDeleteSubject}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsModule
            state={state}
            onUpdateProfile={handleUpdateProfile}
            onExportData={handleExportData}
            onImportData={handleImportData}
            onResetData={handleResetData}
            onTriggerOnboarding={() => setIsOnboardingOpen(true)}
          />
        )}
      </main>

      {/* Focus Session Modal */}
      <SessionTrackerModal
        isOpen={isFocusModalOpen}
        onClose={() => setIsFocusModalOpen(false)}
        state={state}
        activeMissionItem={activeFocusItem}
        onCompleteSession={handleCompleteFocusSession}
      />

      {/* Onboarding Wizard Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        initialState={state}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={handleOnboardingComplete}
      />
    </div>
  );
}
