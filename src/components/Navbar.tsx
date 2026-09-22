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
  HardDrive
} from 'lucide-react';
import { ActiveTab, AppState } from '../types';
import { calculateDailyCapacity } from '../services/scheduler';

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
  const todayStr = '2026-09-21';
  const capacity = calculateDailyCapacity(todayStr, state);
  const activeSemester = state.semesters.find((s) => s.id === state.activeSemesterId);

  const navItems: Array<{ id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'planner', label: 'Daily Planner', icon: CalendarDays },
    { id: 'timetable', label: 'Timetable', icon: Clock },
    { id: 'roadmap', label: 'Roadmap', icon: GitBranch },
    { id: 'tutor', label: 'AI Tutor', icon: Bot },
    { id: 'progress', label: 'Progress', icon: BarChart3 },
    { id: 'semester', label: 'Semester & Subjects', icon: BookOpen },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const availableHours = (capacity.netAvailableMinutes / 60).toFixed(1);

  return (
    <header id="nexora-header" className="bg-slate-900 text-slate-100 border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Semester Badge */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center font-black tracking-wider text-white shadow-sm shadow-indigo-500/20">
              NX
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">NEXORA</span>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                  Local-First OS
                </span>
              </div>
              <div className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-xs">
                {activeSemester?.name || 'No Active Semester'}
              </div>
            </div>
          </div>

          {/* Center/Right Status Indicators */}
          <div className="hidden md:flex items-center gap-4">
            {/* Real capacity badge */}
            <div 
              id="capacity-status-pill"
              className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-full text-xs"
              title="Calculated from your 24h day minus classes, commute, and rest"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-300">Today's Real Capacity:</span>
              <span className="font-semibold text-emerald-300">{availableHours}h</span>
            </div>

            {/* Local Storage Indicator */}
            <div 
              id="local-storage-indicator"
              className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/50 px-2.5 py-1 rounded-md border border-slate-800"
            >
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
              <span>Local Data</span>
            </div>

            {/* Quick Session Start Button */}
            <button
              id="quick-start-session-btn"
              onClick={onOpenFocusSession}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Session</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center space-x-1 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/60">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
