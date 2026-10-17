import React, { useState, useEffect } from 'react';
import { 
  CalendarDays, 
  Clock, 
  GitBranch, 
  Bot, 
  BarChart3, 
  BookOpen, 
  Settings, 
  Play, 
  CheckCircle2, 
  SlidersHorizontal, 
  Compass, 
  Sun, 
  FolderGit2, 
  Menu, 
  X,
  HardDrive
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
import { getTodayDateString } from './services/scheduler';
import { TodayModule } from './components/TodayModule';
import { Dashboard } from './components/Dashboard';
import { DailyPlannerModule } from './components/DailyPlannerModule';
import { TimetableModule } from './components/TimetableModule';
import { RoadmapModule } from './components/RoadmapModule';
import { AITutorModule } from './components/AITutorModule';
import { ProgressModule } from './components/ProgressModule';
import { WeeklyReviewModule } from './components/WeeklyReviewModule';
import { SemesterModule } from './components/SemesterModule';
import { HolidayModeModule } from './components/HolidayModeModule';
import { ProjectsModule } from './components/ProjectsModule';
import { SettingsModule } from './components/SettingsModule';
import { SessionTrackerModal } from './components/SessionTrackerModal';
import { OnboardingModal } from './components/OnboardingModal';

export default function App() {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');

  // Sub-view selectors for bundled destinations
  const [plannerSubView, setPlannerSubView] = useState<'daily' | 'timetable'>('daily');
  const [semesterSubView, setSemesterSubView] = useState<'semester' | 'holiday'>('semester');
  const [reviewsSubView, setReviewsSubView] = useState<'weekly' | 'progress'>('weekly');
  const [todaySubView, setTodaySubView] = useState<'today' | 'legacy_dashboard'>('today');

  // Mobile sidebar menu toggle
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  // Backwards-compatible navigation adapter
  const handleNavigate = (tab: ActiveTab) => {
    setIsMobileMenuOpen(false);
    if (tab === 'dashboard') {
      setActiveTab('today');
      setTodaySubView('legacy_dashboard');
    } else if (tab === 'today') {
      setActiveTab('today');
      setTodaySubView('today');
    } else if (tab === 'timetable') {
      setActiveTab('planner');
      setPlannerSubView('timetable');
    } else if (tab === 'planner') {
      setActiveTab('planner');
      setPlannerSubView('daily');
    } else if (tab === 'roadmap') {
      setActiveTab('learn');
    } else if (tab === 'tutor') {
      setActiveTab('practice');
    } else if (tab === 'holiday') {
      setActiveTab('semester');
      setSemesterSubView('holiday');
    } else if (tab === 'semester') {
      setActiveTab('semester');
      setSemesterSubView('semester');
    } else if (tab === 'progress') {
      setActiveTab('reviews');
      setReviewsSubView('progress');
    } else if (tab === 'weekly_review') {
      setActiveTab('reviews');
      setReviewsSubView('weekly');
    } else {
      setActiveTab(tab);
    }
  };

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
    missionItemId?: string,
    completionState?: 'completed' | 'partial'
  ) => {
    const fullSession: StudySession = {
      ...sessionData,
      id: `sess-${Date.now()}`,
      missionItemId: missionItemId || sessionData.missionItemId,
    };

    try {
      dataService.recordStudySession(fullSession);
      showToast(`Logged ${fullSession.actualDurationMinutes}m focus session.`);
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
    const todayStr = getTodayDateString();
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
      semesterReviews: current.semesterReviews || {},
      sessions: current.sessions || [],
      topics: current.topics || [],
      missions: current.missions || {},
      timeBlocks: current.timeBlocks || {},
    };
    dataService.saveState(merged);
    setIsOnboardingOpen(false);
    showToast('Setup & Routine saved successfully');
  };

  // 8 Canonical Destinations
  const canonicalTabs: Array<{ id: ActiveTab; label: string; icon: React.ReactNode }> = [
    { id: 'today', label: 'Today', icon: <Sun className="w-4 h-4" /> },
    { id: 'planner', label: 'Planner', icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'learn', label: 'Learn', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'practice', label: 'Practice', icon: <Bot className="w-4 h-4" /> },
    { id: 'semester', label: 'Semester', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'projects', label: 'Projects', icon: <FolderGit2 className="w-4 h-4" /> },
    { id: 'reviews', label: 'Reviews', icon: <Compass className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  // Resolve current primary tab identifier
  const resolvedTab: ActiveTab = 
    activeTab === 'dashboard' ? 'today' :
    activeTab === 'timetable' ? 'planner' :
    activeTab === 'roadmap' ? 'learn' :
    activeTab === 'tutor' ? 'practice' :
    activeTab === 'holiday' ? 'semester' :
    activeTab === 'progress' || activeTab === 'weekly_review' ? 'reviews' :
    activeTab;

  const activeSemester = state.semesters.find((s) => s.id === state.activeSemesterId) || state.semesters[0];

  return (
    <div className="min-h-screen bg-[#F5F6FA] text-[#242938] flex flex-col md:flex-row selection:bg-[#5865D8] selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-white text-[#242938] border border-[#5865D8]/40 shadow-lg px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-[#16845B]" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DESKTOP SIDEBAR NAVIGATION                                                */}
      {/* ========================================================================= */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-[#E5E7EB] p-3.5 shrink-0 justify-between sticky top-0 h-screen select-none">
        <div className="space-y-4">
          {/* Brand header */}
          <div className="px-2.5 py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#5865D8] flex items-center justify-center font-black text-white text-xs shadow-xs">
                NX
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight text-[#242938] flex items-center gap-1.5">
                  <span>NEXORA</span>
                  <span className="text-[10px] font-mono text-[#667085] bg-[#F5F6FA] px-1.5 py-0.5 rounded border border-[#E5E7EB]">v1.0</span>
                </div>
                <div className="text-[10px] text-[#667085] truncate max-w-[140px]">
                  {activeSemester?.name || 'Academic OS'}
                </div>
              </div>
            </div>
          </div>

          {/* Start Focus Quick Action Button */}
          <div className="px-1">
            <button
              id="global-focus-btn"
              onClick={() => {
                setActiveFocusItem(null);
                setIsFocusModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-lg text-xs font-medium shadow-xs transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Focus Session</span>
            </button>
          </div>

          {/* 8 Canonical Navigation Links */}
          <nav className="space-y-0.5 pt-1">
            {canonicalTabs.map((tab) => {
              const isActive = resolvedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => handleNavigate(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#EEF0FF] text-[#5865D8] font-semibold border border-[#5865D8]/20'
                      : 'text-[#667085] hover:text-[#242938] hover:bg-[#F5F6FA]'
                  }`}
                >
                  <span className={isActive ? 'text-[#5865D8]' : 'text-[#667085]'}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Profile, Routine, Local Data indicator */}
        <div className="space-y-2 pt-3 border-t border-[#E5E7EB] px-1">
          <div className="flex items-center justify-between text-[11px] text-[#667085] px-2">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-3 h-3 text-[#5865D8]" />
              <span>Local Database</span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-[#16845B]" />
          </div>

          <div className="p-2.5 rounded-lg bg-[#F5F6FA] border border-[#E5E7EB] text-xs flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <div className="font-semibold text-[#242938] truncate">
                {state.profile.name || 'Alex Mercer'}
              </div>
              <div className="text-[10px] text-[#667085] truncate">
                {state.profile.degreeMajor || 'CS Student'}
              </div>
            </div>
            <button
              onClick={() => setIsOnboardingOpen(true)}
              className="p-1 text-[#667085] hover:text-[#242938] hover:bg-white rounded transition-colors cursor-pointer"
              title="Edit Routine & Setup"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MOBILE TOP BAR & DRAWER                                                   */}
      {/* ========================================================================= */}
      <div className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#E5E7EB] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-1.5 rounded-lg text-[#667085] hover:text-[#242938] hover:bg-[#F5F6FA]"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#5865D8] flex items-center justify-center font-bold text-white text-xs">
              NX
            </div>
            <span className="font-semibold text-xs text-[#242938] uppercase tracking-wider">
              {canonicalTabs.find((t) => t.id === resolvedTab)?.label || 'NEXORA'}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            setActiveFocusItem(null);
            setIsFocusModalOpen(true);
          }}
          className="flex items-center gap-1 px-3 py-1.5 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-lg text-xs font-medium cursor-pointer shadow-xs"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Focus</span>
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex">
          <div className="w-64 bg-white border-r border-[#E5E7EB] p-4 space-y-4 flex flex-col justify-between shadow-xl">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[#5865D8] flex items-center justify-center font-bold text-white text-xs">
                    NX
                  </div>
                  <span className="font-bold text-sm text-[#242938]">NEXORA</span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 text-[#667085] hover:text-[#242938]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="space-y-1">
                {canonicalTabs.map((tab) => {
                  const isActive = resolvedTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleNavigate(tab.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-[#EEF0FF] text-[#5865D8] font-semibold'
                          : 'text-[#667085] hover:text-[#242938] hover:bg-[#F5F6FA]'
                      }`}
                    >
                      <span className={isActive ? 'text-[#5865D8]' : 'text-[#667085]'}>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-3 border-t border-[#E5E7EB]">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsOnboardingOpen(true);
                }}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg text-xs text-[#242938] font-medium"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#5865D8]" />
                <span>Routine & Setup</span>
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN WORKSPACE CONTENT BODY                                               */}
      {/* ========================================================================= */}
      <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 min-h-screen">
        {/* 1. TODAY DESTINATION */}
        {resolvedTab === 'today' && (
          <div className="space-y-4">
            {todaySubView === 'today' ? (
              <TodayModule
                state={state}
                setActiveTab={handleNavigate}
                onStartSessionForItem={handleStartSessionForItem}
                onToggleItemStatus={handleToggleItemStatus}
                onOpenFocusSession={() => {
                  setActiveFocusItem(null);
                  setIsFocusModalOpen(true);
                }}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={() => setTodaySubView('today')}
                    className="text-xs text-[#5865D8] hover:underline font-medium cursor-pointer"
                  >
                    &larr; Switch to Today Focus Workspace
                  </button>
                </div>
                <Dashboard
                  state={state}
                  setActiveTab={handleNavigate}
                  onStartSessionForItem={handleStartSessionForItem}
                  onToggleItemStatus={handleToggleItemStatus}
                  onOpenFocusSession={() => {
                    setActiveFocusItem(null);
                    setIsFocusModalOpen(true);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* 2. PLANNER DESTINATION (Daily Schedule + Weekly Timetable sub-tabs) */}
        {resolvedTab === 'planner' && (
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 p-1 bg-[#EEF0FF]/70 border border-[#E5E7EB] rounded-xl w-fit">
              <button
                onClick={() => setPlannerSubView('daily')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  plannerSubView === 'daily'
                    ? 'bg-white text-[#5865D8] font-semibold shadow-xs border border-[#E5E7EB]'
                    : 'text-[#667085] hover:text-[#242938]'
                }`}
              >
                Daily Mission & Schedule
              </button>
              <button
                onClick={() => setPlannerSubView('timetable')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  plannerSubView === 'timetable'
                    ? 'bg-white text-[#5865D8] font-semibold shadow-xs border border-[#E5E7EB]'
                    : 'text-[#667085] hover:text-[#242938]'
                }`}
              >
                Weekly College Timetable
              </button>
            </div>

            {plannerSubView === 'daily' ? (
              <DailyPlannerModule
                state={state}
                onSaveMission={handleSaveMission}
                onStartSessionForItem={handleStartSessionForItem}
                onToggleItemStatus={handleToggleItemStatus}
              />
            ) : (
              <TimetableModule
                state={state}
                onSaveSlot={handleSaveSlot}
                onDeleteSlot={handleDeleteSlot}
              />
            )}
          </div>
        )}

        {/* 3. LEARN DESTINATION (Roadmap Module) */}
        {resolvedTab === 'learn' && (
          <RoadmapModule
            state={state}
            setActiveTab={handleNavigate}
            onSaveTopic={handleSaveTopic}
            onSaveTopics={handleSaveTopics}
            onUpdateTopicMastery={handleUpdateTopicMastery}
            onOverrideTopicPrerequisites={handleOverrideTopicPrerequisites}
            onSelectTopicForTutor={(topic) => {
              setTutorTopic(topic);
              handleNavigate('practice');
            }}
            onAddTopicToDailyMission={handleAddTopicToDailyMission}
          />
        )}

        {/* 4. PRACTICE DESTINATION (AI Tutor & Socratic Practice) */}
        {resolvedTab === 'practice' && (
          <AITutorModule
            state={state}
            selectedTopic={tutorTopic}
            onAddTopicToMission={handleAddTopicToDailyMission}
          />
        )}

        {/* 5. SEMESTER DESTINATION (Semester & Holiday Mode sub-tabs) */}
        {resolvedTab === 'semester' && (
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 p-1 bg-[#EEF0FF]/70 border border-[#E5E7EB] rounded-xl w-fit">
              <button
                onClick={() => setSemesterSubView('semester')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  semesterSubView === 'semester'
                    ? 'bg-white text-[#5865D8] font-semibold shadow-xs border border-[#E5E7EB]'
                    : 'text-[#667085] hover:text-[#242938]'
                }`}
              >
                Curriculum & Semester Setup
              </button>
              <button
                onClick={() => setSemesterSubView('holiday')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  semesterSubView === 'holiday'
                    ? 'bg-white text-[#5865D8] font-semibold shadow-xs border border-[#E5E7EB]'
                    : 'text-[#667085] hover:text-[#242938]'
                }`}
              >
                Holiday & Break Mode
              </button>
            </div>

            {semesterSubView === 'semester' ? (
              <SemesterModule
                state={state}
                onUpdateSemester={handleUpdateSemester}
                onSaveSubject={handleSaveSubject}
                onDeleteSubject={handleDeleteSubject}
                onNavigateToTab={handleNavigate}
                showToast={showToast}
              />
            ) : (
              <HolidayModeModule
                state={state}
                onNavigateToTab={handleNavigate}
                showToast={showToast}
              />
            )}
          </div>
        )}

        {/* 6. PROJECTS DESTINATION (Systems Engineering Portfolio) */}
        {resolvedTab === 'projects' && (
          <ProjectsModule
            state={state}
            showToast={showToast}
          />
        )}

        {/* 7. REVIEWS DESTINATION (Weekly AI Review & Progress Analytics sub-tabs) */}
        {resolvedTab === 'reviews' && (
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 p-1 bg-[#EEF0FF]/70 border border-[#E5E7EB] rounded-xl w-fit">
              <button
                onClick={() => setReviewsSubView('weekly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  reviewsSubView === 'weekly'
                    ? 'bg-white text-[#5865D8] font-semibold shadow-xs border border-[#E5E7EB]'
                    : 'text-[#667085] hover:text-[#242938]'
                }`}
              >
                Weekly AI Review & Pacing
              </button>
              <button
                onClick={() => setReviewsSubView('progress')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  reviewsSubView === 'progress'
                    ? 'bg-white text-[#5865D8] font-semibold shadow-xs border border-[#E5E7EB]'
                    : 'text-[#667085] hover:text-[#242938]'
                }`}
              >
                Long-Term Progress & Mastery
              </button>
            </div>

            {reviewsSubView === 'weekly' ? (
              <WeeklyReviewModule
                state={state}
                onNavigateToTab={handleNavigate}
                showToast={showToast}
              />
            ) : (
              <ProgressModule
                state={state}
                onNavigateToTab={handleNavigate}
              />
            )}
          </div>
        )}

        {/* 8. SETTINGS DESTINATION */}
        {resolvedTab === 'settings' && (
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
