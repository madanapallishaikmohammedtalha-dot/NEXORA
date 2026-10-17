import React, { useState } from 'react';
import { 
  Download, 
  Upload, 
  User, 
  Sparkles, 
  Database,
  Check,
  AlertTriangle,
  TestTube,
  CheckCircle2,
  XCircle,
  SlidersHorizontal,
  Activity,
  Brain,
  Trash2,
  Edit3,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { AppState, UserProfile, LearnerMemory, MemoryCategory, ExplanationStyle } from '../types';
import { runDataLayerTests, TestResult } from '../services/dataLayerTests';
import { runPlannerEngineTests } from '../services/plannerEngineTests';
import { runLearningEngineTests } from '../services/learningEngineTests';
import { aiService, ProviderHealthStatus } from '../services/ai';
import { dataService } from '../services/dataService';

interface SettingsModuleProps {
  state: AppState;
  onUpdateProfile: (profile: UserProfile) => void;
  onExportData: () => void;
  onImportData: (jsonStr: string) => boolean;
  onResetData: () => void;
  onTriggerOnboarding: () => void;
}

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  state,
  onUpdateProfile,
  onExportData,
  onImportData,
  onResetData,
  onTriggerOnboarding,
}) => {
  const [name, setName] = useState(state.profile.name || '');
  const [university, setUniversity] = useState(state.profile.university || '');
  const [degreeMajor, setDegreeMajor] = useState(state.profile.degreeMajor || '');
  const [dailyCapacityMaxHours, setDailyCapacityMaxHours] = useState(state.profile.dailyCapacityMaxHours || 4.5);
  const [wakeTime, setWakeTime] = useState(state.profile.wakeTime || '07:30');
  const [sleepTime, setSleepTime] = useState(state.profile.sleepTime || '23:30');
  const [travelTimeMinutes, setTravelTimeMinutes] = useState(state.profile.travelTimeMinutes || 30);
  const [currentSkills, setCurrentSkills] = useState((state.profile.currentSkills || []).join(', '));
  const [careerInterests, setCareerInterests] = useState((state.profile.careerInterests || []).join(', '));
  const [currentProjects, setCurrentProjects] = useState((state.profile.currentProjects || []).join(', '));
  const [preferredExplanationStyle, setPreferredExplanationStyle] = useState<ExplanationStyle>(
    state.profile.preferredExplanationStyle || 'intuition_first'
  );
  const [apiKey, setApiKey] = useState(state.profile.apiKey || '');
  const [aiModel, setAiModel] = useState(state.profile.aiModel || 'gemini-3.8-flash');

  // Learner Memory State
  const [memoryFilter, setMemoryFilter] = useState<MemoryCategory | 'all'>('all');
  const [editingMemory, setEditingMemory] = useState<LearnerMemory | null>(null);
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [newMemCategory, setNewMemCategory] = useState<MemoryCategory>('needs_practice');
  const [newMemTitle, setNewMemTitle] = useState('');
  const [newMemDetail, setNewMemDetail] = useState('');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // AI Health Check state
  const [isCheckingAIHealth, setIsCheckingAIHealth] = useState(false);
  const [aiHealthResult, setAiHealthResult] = useState<ProviderHealthStatus | null>(null);

  const handleTestAIHealth = async () => {
    setIsCheckingAIHealth(true);
    setAiHealthResult(null);
    try {
      const provider = aiService.getRegistry().findProviderForModel(aiModel);
      const res = await aiService.checkHealth(provider?.id, { apiKey: apiKey.trim() || undefined });
      setAiHealthResult(res);
    } catch (err: any) {
      setAiHealthResult({
        providerId: 'unknown',
        isHealthy: false,
        hasCredentials: Boolean(apiKey.trim()),
        message: err?.message || 'Connection test failed',
      });
    } finally {
      setIsCheckingAIHealth(false);
    }
  };

  // Data Layer Test Runner state
  const [testResults, setTestResults] = useState<{ total: number; passed: number; failed: number; results: TestResult[] } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleRunTests = () => {
    setIsTesting(true);
    setTimeout(() => {
      const dataLayerSummary = runDataLayerTests();
      const plannerSummary = runPlannerEngineTests();
      const learningSummary = runLearningEngineTests();

      const combinedResults = [
        ...dataLayerSummary.results,
        ...plannerSummary.results,
        ...learningSummary.results,
      ];

      setTestResults({
        total: dataLayerSummary.total + plannerSummary.total + learningSummary.total,
        passed: dataLayerSummary.passed + plannerSummary.passed + learningSummary.passed,
        failed: dataLayerSummary.failed + plannerSummary.failed + learningSummary.failed,
        results: combinedResults,
      });
      setIsTesting(false);
    }, 150);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...state.profile,
      name,
      university,
      degreeMajor,
      dailyCapacityMaxHours: Number(dailyCapacityMaxHours),
      wakeTime,
      sleepTime,
      travelTimeMinutes: Number(travelTimeMinutes) || 0,
      currentSkills: currentSkills.split(',').map((s) => s.trim()).filter(Boolean),
      careerInterests: careerInterests.split(',').map((s) => s.trim()).filter(Boolean),
      currentProjects: currentProjects.split(',').map((s) => s.trim()).filter(Boolean),
      preferredExplanationStyle,
      apiKey: apiKey.trim() || undefined,
      aiModel,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleUpdateMemory = (memory: LearnerMemory) => {
    try {
      dataService.saveLearnerMemory(memory);
      setEditingMemory(null);
    } catch (err: any) {
      alert(`Error updating memory: ${err.message}`);
    }
  };

  const handleDeleteMemory = (id: string) => {
    try {
      dataService.deleteLearnerMemory(id);
    } catch (err: any) {
      alert(`Error deleting memory: ${err.message}`);
    }
  };

  const handleAddManualMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemTitle.trim() || !newMemDetail.trim()) return;

    try {
      dataService.recordLearnerEvidence({
        category: newMemCategory,
        title: newMemTitle.trim(),
        detail: newMemDetail.trim(),
        source: 'user_input',
        confidence: 0.9,
      });
      setIsAddingMemory(false);
      setNewMemTitle('');
      setNewMemDetail('');
    } catch (err: any) {
      alert(`Error adding memory: ${err.message}`);
    }
  };

  const handleClearAllMemories = () => {
    if (window.confirm('Are you sure you want to clear all persistent learner memories? This action cannot be undone.')) {
      dataService.clearLearnerMemories();
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const ok = onImportData(content);
        if (!ok) {
          setImportError('Invalid NEXORA backup file format.');
        } else {
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 2500);
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs">
        <div className="text-xs font-semibold uppercase tracking-wider text-[#5865D8] mb-1">
          System Preferences & Local-First Storage
        </div>
        <h1 className="text-xl font-bold text-[#242938] flex items-center gap-2">
          <span>Settings & Data Sovereignty</span>
        </h1>
        <p className="text-xs text-[#667085] mt-1">
          NEXORA stores your entire academic schedule, roadmaps, and reflections locally in your browser.
        </p>
      </div>

      {/* Profile & AI Provider Settings */}
      <form onSubmit={handleSaveProfile} className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[#5865D8]" />
            <h2 className="text-base font-bold text-[#242938]">Student Profile & Capacity Limits</h2>
          </div>

          {savedSuccess && (
            <span className="flex items-center gap-1 text-xs text-[#16845B] font-semibold">
              <Check className="w-4 h-4" />
              <span>Saved!</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-[#667085] block mb-1">Your Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Mercer"
              className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
            />
          </div>

          <div>
            <label className="text-[#667085] block mb-1">College / University</label>
            <input
              type="text"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="e.g. State Polytechnic University"
              className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-[#667085] block mb-1">Degree & Major</label>
            <input
              type="text"
              value={degreeMajor}
              onChange={(e) => setDegreeMajor(e.target.value)}
              placeholder="e.g. B.S. Computer Science & Systems"
              className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
            />
          </div>

          <div className="sm:col-span-2 bg-[#F5F6FA] p-4 rounded-xl border border-[#E5E7EB] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#242938]">
                Daily Study Capacity Ceiling ({dailyCapacityMaxHours} hours/day)
              </label>
              <span className="text-[11px] font-mono text-[#5865D8] font-bold">
                {Math.round(dailyCapacityMaxHours * 60)} minutes max
              </span>
            </div>
            <p className="text-[11px] text-[#667085]">
              The scheduler uses this limit to guarantee that AI recommendations never exceed your sustainable cognitive energy.
            </p>
            <input
              type="range"
              min={2}
              max={8}
              step={0.5}
              value={dailyCapacityMaxHours}
              onChange={(e) => setDailyCapacityMaxHours(Number(e.target.value))}
              className="w-full accent-[#5865D8] cursor-pointer"
            />
          </div>

          {/* Wake, Sleep, and Travel */}
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#F5F6FA] p-4 rounded-xl border border-[#E5E7EB]">
            <div>
              <label className="text-[#667085] block mb-1">Wake Time</label>
              <input
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#242938] focus:outline-none focus:border-[#5865D8]"
              />
            </div>
            <div>
              <label className="text-[#667085] block mb-1">Sleep Time</label>
              <input
                type="time"
                value={sleepTime}
                onChange={(e) => setSleepTime(e.target.value)}
                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#242938] focus:outline-none focus:border-[#5865D8]"
              />
            </div>
            <div>
              <label className="text-[#667085] block mb-1">Travel Time (min)</label>
              <input
                type="number"
                min={0}
                max={180}
                value={travelTimeMinutes}
                onChange={(e) => setTravelTimeMinutes(Number(e.target.value))}
                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs text-[#242938] focus:outline-none focus:border-[#5865D8]"
              />
            </div>
          </div>

          {/* Current Skills, Career Interests, Current Projects */}
          <div className="sm:col-span-2 space-y-3">
            <div>
              <label className="text-[#667085] block mb-1">Current Skills (comma-separated)</label>
              <input
                type="text"
                value={currentSkills}
                onChange={(e) => setCurrentSkills(e.target.value)}
                placeholder="e.g. C / C++, Python, Data Structures, Git"
                className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
              />
            </div>

            <div>
              <label className="text-[#667085] block mb-1">Career Interests</label>
              <input
                type="text"
                value={careerInterests}
                onChange={(e) => setCareerInterests(e.target.value)}
                placeholder="e.g. Operating Systems & Kernel Engineering, Distributed Systems"
                className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
              />
            </div>

            <div>
              <label className="text-[#667085] block mb-1">Current Projects</label>
              <input
                type="text"
                value={currentProjects}
                onChange={(e) => setCurrentProjects(e.target.value)}
                placeholder="e.g. POSIX Multithreaded Job Worker, LSM-Tree Key-Value Store"
                className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
              />
            </div>

            <div>
              <label className="text-[#667085] block mb-1">Preferred Explanation Style</label>
              <select
                value={preferredExplanationStyle}
                onChange={(e) => setPreferredExplanationStyle(e.target.value as ExplanationStyle)}
                className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
              >
                <option value="intuition_first">Intuition First (Visual & Systems Analogies, then Mechanics)</option>
                <option value="practical_examples">Practical Examples First (Real Code & Architecture)</option>
                <option value="first_principles">First Principles (Derived from Computational Fundamentals)</option>
                <option value="socratic_inquiry">Socratic Inquiry (Guiding Questions & Thought Experiments)</option>
              </select>
              <p className="text-[10px] text-[#667085] mt-1">
                Persisted in your cognitive profile. Applied directly to the AI Tutor and Focus Session coaching.
              </p>
            </div>
          </div>
        </div>

        {/* AI Provider Section */}
        <div className="pt-4 border-t border-[#E5E7EB] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#5865D8]" />
              <h2 className="text-base font-bold text-[#242938]">Modular AI Provider Configuration</h2>
            </div>
            <button
              type="button"
              onClick={handleTestAIHealth}
              disabled={isCheckingAIHealth}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <Activity className="w-3.5 h-3.5 text-[#5865D8]" />
              {isCheckingAIHealth ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          <p className="text-xs text-[#667085] leading-relaxed">
            NEXORA uses an isolated provider architecture. Switch seamlessly between cloud Gemini models, local-first offline heuristics (zero network required), or self-hosted local inference proxies.
          </p>

          {aiHealthResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                aiHealthResult.isHealthy
                  ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#16845B]'
                  : 'bg-[#FEF2F2] border-[#FECACA] text-[#C43D4B]'
              }`}
            >
              {aiHealthResult.isHealthy ? (
                <CheckCircle2 className="w-4 h-4 text-[#16845B] shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-[#C43D4B] shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-semibold">
                  {aiHealthResult.isHealthy ? 'Provider Connected' : 'Provider Connection Issue'}
                  {aiHealthResult.latencyMs !== undefined && ` (${aiHealthResult.latencyMs}ms)`}
                </div>
                <div className="text-[#667085]">{aiHealthResult.message}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-[#667085] block mb-1">Active AI Model & Provider</label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] focus:outline-none focus:border-[#5865D8]"
              >
                {aiService.getAvailableModels().map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName} {model.latencyEstimate ? `(${model.latencyEstimate})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-[#667085] mt-1">
                {aiService.getAvailableModels().find((m) => m.id === aiModel)?.recommendedFor || ''}
              </p>
            </div>

            <div>
              <label className="text-[#667085] block mb-1">User-Configured API Key (Optional)</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Leave blank to use pre-configured server proxy"
                className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#242938] font-mono focus:outline-none focus:border-[#5865D8]"
              />
              <p className="text-[10px] text-[#667085] mt-1">
                Never hard-coded or committed. Stored securely in your client profile and passed via authenticated headers.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#5865D8] hover:bg-[#4854C4] text-white font-semibold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
          >
            Save Preferences
          </button>
        </div>
      </form>

      {/* Persistent Learner Memory System */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#5865D8]" />
              <h2 className="text-base font-bold text-[#242938]">Persistent Learner Memory System</h2>
            </div>
            <p className="text-xs text-[#667085] mt-1">
              Tracks your verified cognitive strengths, recurring misconceptions, and learning context across sessions and semesters.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddingMemory(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Memory</span>
            </button>
            {(state.learnerMemories || []).length > 0 && (
              <button
                onClick={handleClearAllMemories}
                className="px-2.5 py-1.5 text-xs text-[#667085] hover:text-[#C43D4B] hover:bg-[#F5F6FA] rounded-lg transition-colors cursor-pointer"
                title="Clear all recorded memories"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Records' },
            { id: 'strength', label: 'Strengths' },
            { id: 'needs_practice', label: 'Needs Practice' },
            { id: 'misconception', label: 'Misconceptions' },
            { id: 'effective_method', label: 'Effective Methods' },
            { id: 'priority', label: 'Priorities' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setMemoryFilter(cat.id as any)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                memoryFilter === cat.id
                  ? 'bg-[#EEF0FF] text-[#5865D8] border border-[#C7D2FE] font-semibold'
                  : 'text-[#667085] hover:text-[#242938] hover:bg-[#F5F6FA]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Add Memory Form Modal / Collapsible */}
        {isAddingMemory && (
          <form onSubmit={handleAddManualMemory} className="p-4 bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
              <span className="font-semibold text-[#242938]">Record Evidence-Based Memory</span>
              <button
                type="button"
                onClick={() => setIsAddingMemory(false)}
                className="text-[#667085] hover:text-[#242938] cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[#667085] block mb-1">Memory Category</label>
                <select
                  value={newMemCategory}
                  onChange={(e) => setNewMemCategory(e.target.value as MemoryCategory)}
                  className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-[#242938] focus:outline-none focus:border-[#5865D8]"
                >
                  <option value="needs_practice">Needs Practice</option>
                  <option value="strength">Verified Strength</option>
                  <option value="misconception">Repeated Misconception</option>
                  <option value="effective_method">Effective Learning Method</option>
                  <option value="learning_context">Learning Context</option>
                  <option value="priority">Current Priority</option>
                </select>
              </div>

              <div>
                <label className="text-[#667085] block mb-1">Concept / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deadlock Detection in Resource Graphs"
                  value={newMemTitle}
                  onChange={(e) => setNewMemTitle(e.target.value)}
                  className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-[#242938] focus:outline-none focus:border-[#5865D8]"
                />
              </div>
            </div>

            <div>
              <label className="text-[#667085] block mb-1">Evidence Detail / Observation</label>
              <textarea
                rows={2}
                required
                placeholder="What specific difficulty, strategy, or mastery signal was observed?"
                value={newMemDetail}
                onChange={(e) => setNewMemDetail(e.target.value)}
                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-[#242938] focus:outline-none focus:border-[#5865D8]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingMemory(false)}
                className="px-3 py-1.5 bg-white border border-[#E5E7EB] text-[#667085] hover:text-[#242938] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#5865D8] hover:bg-[#4854C4] text-white font-medium rounded-lg cursor-pointer shadow-xs"
              >
                Save Memory
              </button>
            </div>
          </form>
        )}

        {/* Memory List */}
        {(() => {
          const memories = state.learnerMemories || [];
          const filtered = memories.filter((m) => {
            if (memoryFilter === 'all') return true;
            return m.category === memoryFilter;
          });

          if (filtered.length === 0) {
            return (
              <div className="py-8 text-center text-xs text-[#667085] border border-dashed border-[#E5E7EB] rounded-xl">
                No memories recorded in this category. Complete focus reflections or add manual observations to build your profile.
              </div>
            );
          }

          return (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {filtered.map((mem) => {
                const isEditing = editingMemory?.id === mem.id;
                const relatedSubject = state.subjects.find((s) => s.id === mem.subjectId);
                const relatedTopic = state.topics.find((t) => t.id === mem.topicId);

                const getCategoryStyle = (cat: MemoryCategory) => {
                  switch (cat) {
                    case 'strength':
                      return 'bg-[#ECFDF5] text-[#16845B] border-[#A7F3D0]';
                    case 'needs_practice':
                      return 'bg-[#FFFBEB] text-[#A6630A] border-[#FDE68A]';
                    case 'misconception':
                      return 'bg-[#FEF2F2] text-[#C43D4B] border-[#FECACA]';
                    case 'effective_method':
                      return 'bg-[#EEF0FF] text-[#5865D8] border-[#C7D2FE]';
                    case 'priority':
                      return 'bg-blue-50 text-blue-700 border-blue-200';
                    default:
                      return 'bg-[#F5F6FA] text-[#667085] border-[#E5E7EB]';
                  }
                };

                if (isEditing) {
                  return (
                    <div key={mem.id} className="p-3.5 bg-white border border-[#5865D8] rounded-xl space-y-2.5 text-xs shadow-xs">
                      <div className="font-semibold text-[#5865D8]">Edit Learner Memory</div>
                      <input
                        type="text"
                        value={editingMemory.title}
                        onChange={(e) => setEditingMemory({ ...editingMemory, title: e.target.value })}
                        className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-[#242938] text-xs focus:outline-none focus:border-[#5865D8]"
                      />
                      <textarea
                        rows={2}
                        value={editingMemory.detail}
                        onChange={(e) => setEditingMemory({ ...editingMemory, detail: e.target.value })}
                        className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-[#242938] text-xs focus:outline-none focus:border-[#5865D8]"
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingMemory(null)}
                          className="px-2.5 py-1 bg-white border border-[#E5E7EB] text-[#667085] hover:text-[#242938] rounded-lg text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateMemory(editingMemory)}
                          className="px-3 py-1 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={mem.id}
                    className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#F5F6FA] flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs hover:border-[#D1D5DB] transition-colors"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${getCategoryStyle(mem.category)}`}>
                          {mem.category.replace('_', ' ')}
                        </span>
                        {relatedSubject && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white text-[#242938] border border-[#E5E7EB]">
                            {relatedSubject.code}
                          </span>
                        )}
                        {relatedTopic && (
                          <span className="text-[10px] text-[#667085] truncate max-w-[200px]">
                            {relatedTopic.title}
                          </span>
                        )}
                        <span className="text-[10px] text-[#9CA3AF] font-mono ml-auto">
                          {Math.round(mem.confidence * 100)}% conf &bull; {mem.occurrences}x observed
                        </span>
                      </div>

                      <div className="font-semibold text-[#242938]">
                        {mem.title}
                      </div>

                      <p className="text-[#667085] text-[11px] leading-relaxed">
                        {mem.detail}
                      </p>

                      <div className="flex items-center gap-2 text-[10px] text-[#9CA3AF] pt-0.5">
                        <span>Source: {mem.source.replace('_', ' ')}</span>
                        <span>&bull;</span>
                        <span>Updated: {new Date(mem.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 self-end sm:self-start shrink-0">
                      <button
                        onClick={() => setEditingMemory(mem)}
                        className="p-1.5 text-[#667085] hover:text-[#242938] hover:bg-white rounded-md transition-colors cursor-pointer border border-transparent hover:border-[#E5E7EB]"
                        title="Edit memory"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteMemory(mem.id)}
                        className="p-1.5 text-[#667085] hover:text-[#C43D4B] hover:bg-white rounded-md transition-colors cursor-pointer border border-transparent hover:border-[#E5E7EB]"
                        title="Delete memory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Local-First Data Sovereignty & Backup */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3">
          <Database className="w-4 h-4 text-[#5865D8]" />
          <h2 className="text-base font-bold text-[#242938]">Local-First Storage & Data Sovereignty</h2>
        </div>

        <p className="text-xs text-[#667085] leading-relaxed">
          NEXORA belongs to you. You can export your complete academic database at any time as an offline JSON snapshot or restore it onto another device.
        </p>

        {importError && (
          <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#C43D4B] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{importError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <button
            onClick={onExportData}
            className="flex items-center justify-center gap-2 p-3 bg-white hover:bg-[#F5F6FA] border border-[#E5E7EB] text-[#242938] rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-[#16845B]" />
            <span>Export JSON Backup</span>
          </button>

          <label className="flex items-center justify-center gap-2 p-3 bg-white hover:bg-[#F5F6FA] border border-[#E5E7EB] text-[#242938] rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs">
            <Upload className="w-4 h-4 text-[#5865D8]" />
            <span>Import JSON Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
            />
          </label>

          <button
            onClick={onTriggerOnboarding}
            className="flex items-center justify-center gap-2 p-3 bg-[#EEF0FF] hover:bg-[#E0E4FF] border border-[#C7D2FE] text-[#5865D8] rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#5865D8]" />
            <span>Edit Setup & Schedule</span>
          </button>
        </div>

        {/* Danger Zone: Reset */}
        <div className="pt-4 border-t border-[#E5E7EB] flex items-center justify-between">
          <div className="text-xs text-[#667085]">
            Reset all courses, sessions, and roadmaps to demo defaults.
          </div>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to reset all data to defaults?')) {
                onResetData();
              }
            }}
            className="text-xs text-[#C43D4B] hover:text-[#a02c39] font-medium px-3 py-1.5 rounded-lg border border-[#FECACA] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
          >
            Reset to Demo Defaults
          </button>
        </div>
      </div>

      {/* Local Data Layer Integrity & Self-Test Panel */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
          <div className="flex items-center gap-2">
            <TestTube className="w-4 h-4 text-[#16845B]" />
            <h2 className="text-base font-bold text-[#242938]">NEXORA Engine Verification & Diagnostics</h2>
          </div>
          <button
            id="run-all-tests-btn"
            onClick={handleRunTests}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#16845B] hover:bg-[#126b4a] disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
          >
            {isTesting ? (
              <span>Running Suite...</span>
            ) : (
              <>
                <TestTube className="w-3.5 h-3.5" />
                <span>Run Engine & Planner Self-Test</span>
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-[#667085] leading-relaxed">
          Executes automated test suites across the entire deterministic architecture: <strong>Learning Roadmap DAGs</strong> (prerequisite evaluation, cycle prevention, 80% canonical mastery unlocks, 4-phase pedagogical tracking), <strong>Data Layer persistence & integrity</strong>, and <strong>Planner Engine scheduling</strong> (conflicts, capacity constraints, cognitive recovery).
        </p>

        {testResults && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 p-3 bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#16845B]">
                <CheckCircle2 className="w-4 h-4" />
                <span>{testResults.passed} Passed</span>
              </div>
              {testResults.failed > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#C43D4B]">
                  <XCircle className="w-4 h-4" />
                  <span>{testResults.failed} Failed</span>
                </div>
              )}
              <span className="text-xs text-[#667085] ml-auto">
                Total: {testResults.total} Assertions
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {testResults.results.map((res, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between p-2 rounded-lg bg-white border border-[#E5E7EB] text-xs shadow-xs"
                >
                  <div className="space-y-0.5">
                    <div className="text-[#242938] font-medium">{res.name}</div>
                    <div className="text-[#667085] text-[10px]">{res.suite}</div>
                    {res.error && <div className="text-[#C43D4B] text-[11px] mt-0.5">{res.error}</div>}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      res.passed
                        ? 'bg-[#ECFDF5] text-[#16845B] border border-[#A7F3D0]'
                        : 'bg-[#FEF2F2] text-[#C43D4B] border border-[#FECACA]'
                    }`}
                  >
                    {res.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
