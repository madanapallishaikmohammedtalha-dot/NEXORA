import React from 'react';
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
  HardDrive,
  Compass,
  Sun
} from 'lucide-react';
import { ActiveTab, AppState } from '../types';
import { calculateDailyCapacity, getTodayDateString } from '../services/scheduler';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  state: AppState;
  onOpenFocusSession: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  state,
  onOpenFocusSession,
}) => {
  const todayStr = getTodayDateString();
  const capacity = calculateDailyCapacity(todayStr, state);
  const activeSemester = state.semesters.find((s) => s.id === state.activeSemesterId);

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'planner', label: 'Daily Planner', icon: CalendarDays },
    { id: 'timetable', label: 'Timetable', icon: Clock },
    { id: 'roadmap', label: 'Roadmap', icon: GitBranch },
    { id: 'tutor', label: 'AI Tutor', icon: Bot },
    { id: 'progress', label: 'Progress', icon: BarChart3 },
    { id: 'weekly_review', label: 'Weekly Review', icon: Compass },
    { id: 'holiday', label: 'Holiday Mode', icon: Sun },
    { id: 'semester', label: 'Semester & Subjects', icon: BookOpen },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const availableHours = (capacity.netAvailableMinutes / 60).toFixed(1);

  return (
    <header id="nexora-header" className="bg-white text-[#242938] border-b border-[#E5E7EB] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Semester Badge */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#5865D8] flex items-center justify-center font-black tracking-wider text-white shadow-xs">
              NX
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-[#242938]">NEXORA</span>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-[#EEF0FF] text-[#5865D8] border border-[#5865D8]/20 font-mono">
                  Local-First OS
                </span>
              </div>
              <div className="text-xs text-[#667085] truncate max-w-[200px] sm:max-w-xs">
                {activeSemester?.name || 'No Active Semester'}
              </div>
            </div>
          </div>

          {/* Center/Right Status Indicators */}
          <div className="hidden md:flex items-center gap-4">
            {/* Real capacity badge */}
            <div 
              id="capacity-status-pill"
              className="flex items-center gap-2 bg-[#F5F6FA] border border-[#E5E7EB] px-3 py-1.5 rounded-full text-xs shadow-xs"
              title="Calculated from your 24h day minus classes, commute, and rest"
            >
              <span className="w-2 h-2 rounded-full bg-[#16845B] animate-pulse"></span>
              <span className="text-[#667085]">Today's Real Capacity:</span>
              <span className="font-semibold text-[#16845B] font-mono">{availableHours}h</span>
            </div>

            {/* Local Storage Indicator */}
            <div 
              id="local-storage-indicator"
              className="flex items-center gap-1.5 text-xs text-[#667085] bg-[#F5F6FA] px-2.5 py-1 rounded-md border border-[#E5E7EB]"
            >
              <HardDrive className="w-3.5 h-3.5 text-[#5865D8]" />
              <span>Local Data</span>
            </div>

            {/* Quick Session Start Button */}
            <button
              id="quick-start-session-btn"
              onClick={onOpenFocusSession}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Session</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-[#E5E7EB]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#EEF0FF] text-[#5865D8] border border-[#5865D8]/30 font-semibold shadow-xs'
                    : 'text-[#667085] hover:text-[#242938] hover:bg-[#F5F6FA]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#5865D8]' : 'text-[#667085]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
