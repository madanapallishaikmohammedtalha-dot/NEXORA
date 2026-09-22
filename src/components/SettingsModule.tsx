import React, { useState } from 'react';
import { 
  Key, 
  Download, 
  Upload, 
  RotateCcw, 
  User, 
  ShieldCheck, 
  Sparkles, 
  Database,
  Check,
  AlertTriangle,
  TestTube,
  CheckCircle2,
  XCircle,
  SlidersHorizontal,
  Activity,
  Zap
} from 'lucide-react';
import { AppState, UserProfile } from '../types';
import { runDataLayerTests, TestResult } from '../services/dataLayerTests';
import { aiService, ProviderHealthStatus } from '../services/ai';

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
  const [apiKey, setApiKey] = useState(state.profile.apiKey || '');
  const [aiModel, setAiModel] = useState(state.profile.aiModel || 'gemini-3.8-flash');

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
      const summary = runDataLayerTests();
      setTestResults(summary);
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
      apiKey: apiKey.trim() || undefined,
      aiModel,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">
          System Preferences & Local-First Storage
        </div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <span>Settings & Data Sovereignty</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          NEXORA stores your entire academic schedule, roadmaps, and reflections locally in your browser.
        </p>
      </div>

      {/* Profile & AI Provider Settings */}
      <form onSubmit={handleSaveProfile} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-400" />
            <h2 className="text-base font-bold text-white">Student Profile & Capacity Limits</h2>
          </div>

          {savedSuccess && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
              <Check className="w-4 h-4" />
              <span>Saved!</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Your Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Mercer"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">College / University</label>
            <input
              type="text"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              placeholder="e.g. State Polytechnic University"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-slate-400 block mb-1">Degree & Major</label>
            <input
              type="text"
              value={degreeMajor}
              onChange={(e) => setDegreeMajor(e.target.value)}
              placeholder="e.g. B.S. Computer Science & Systems"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div className="sm:col-span-2 bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200">
                Daily Study Capacity Ceiling ({dailyCapacityMaxHours} hours/day)
              </label>
              <span className="text-[11px] font-mono text-indigo-400">
                {Math.round(dailyCapacityMaxHours * 60)} minutes max
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              The scheduler uses this limit to guarantee that AI recommendations never exceed your sustainable cognitive energy.
            </p>
            <input
              type="range"
              min={2}
              max={8}
              step={0.5}
              value={dailyCapacityMaxHours}
              onChange={(e) => setDailyCapacityMaxHours(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          {/* Wake, Sleep, and Travel */}
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="text-slate-400 block mb-1">8. Wake Time</label>
              <input
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">9. Sleep Time</label>
              <input
                type="time"
                value={sleepTime}
                onChange={(e) => setSleepTime(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">7. Travel Time (min)</label>
              <input
                type="number"
                min={0}
                max={180}
                value={travelTimeMinutes}
                onChange={(e) => setTravelTimeMinutes(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          {/* Current Skills, Career Interests, Current Projects */}
          <div className="sm:col-span-2 space-y-3">
            <div>
              <label className="text-slate-400 block mb-1">12. Current Skills (comma-separated)</label>
              <input
                type="text"
                value={currentSkills}
                onChange={(e) => setCurrentSkills(e.target.value)}
                placeholder="e.g. C / C++, Python, Data Structures, Git"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">13. Career Interests</label>
              <input
                type="text"
                value={careerInterests}
                onChange={(e) => setCareerInterests(e.target.value)}
                placeholder="e.g. Operating Systems & Kernel Engineering, Distributed Systems"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">14. Current Projects</label>
              <input
                type="text"
                value={currentProjects}
                onChange={(e) => setCurrentProjects(e.target.value)}
                placeholder="e.g. POSIX Multithreaded Job Worker, LSM-Tree Key-Value Store"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* AI Provider Section */}
        <div className="pt-4 border-t border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h2 className="text-base font-bold text-white">Modular AI Provider Configuration</h2>
            </div>
            <button
              type="button"
              onClick={handleTestAIHealth}
              disabled={isCheckingAIHealth}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              {isCheckingAIHealth ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            NEXORA uses an isolated provider architecture. Switch seamlessly between cloud Gemini models, local-first offline heuristics (zero network required), or self-hosted local inference proxies.
          </p>

          {aiHealthResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                aiHealthResult.isHealthy
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
              }`}
            >
              {aiHealthResult.isHealthy ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-semibold">
                  {aiHealthResult.isHealthy ? 'Provider Connected' : 'Provider Connection Issue'}
                  {aiHealthResult.latencyMs !== undefined && ` (${aiHealthResult.latencyMs}ms)`}
                </div>
                <div className="text-slate-300">{aiHealthResult.message}</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Active AI Model & Provider</label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                {aiService.getAvailableModels().map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName} {model.latencyEstimate ? `(${model.latencyEstimate})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                {aiService.getAvailableModels().find((m) => m.id === aiModel)?.recommendedFor || ''}
              </p>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">User-Configured API Key (Optional)</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Leave blank to use pre-configured server proxy"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Never hard-coded or committed. Stored securely in your client profile and passed via authenticated headers.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs shadow-sm transition-colors cursor-pointer"
          >
            Save Preferences
          </button>
        </div>
      </form>

      {/* Local-First Data Sovereignty & Backup */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Database className="w-4 h-4 text-indigo-400" />
          <h2 className="text-base font-bold text-white">Local-First Storage & Data Sovereignty</h2>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          NEXORA belongs to you. You can export your complete academic database at any time as an offline JSON snapshot or restore it onto another device.
        </p>

        {importError && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{importError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <button
            onClick={onExportData}
            className="flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export JSON Backup</span>
          </button>

          <label className="flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer">
            <Upload className="w-4 h-4 text-indigo-400" />
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
            className="flex items-center justify-center gap-2 p-3 bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-800/60 text-indigo-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
            <span>Edit Setup & Schedule</span>
          </button>
        </div>

        {/* Danger Zone: Reset */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Reset all courses, sessions, and roadmaps to demo defaults.
          </div>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to reset all data to defaults?')) {
                onResetData();
              }
            }}
            className="text-xs text-rose-400 hover:text-rose-300 font-medium px-3 py-1.5 rounded-lg border border-rose-900/40 hover:bg-rose-950/30 transition-colors cursor-pointer"
          >
            Reset to Demo Defaults
          </button>
        </div>
      </div>

      {/* Local Data Layer Integrity & Self-Test Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <TestTube className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-bold text-white">NEXORA Engine Verification & Diagnostics</h2>
          </div>
          <button
            id="run-all-tests-btn"
            onClick={handleRunTests}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
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

        <p className="text-xs text-slate-300 leading-relaxed">
          Executes automated tests validating domain models and the deterministic Planner Engine: <strong>overlapping events</strong>, <strong>insufficient time</strong>, <strong>fixed events</strong>, <strong>flexible focus windows</strong>, <strong>cognitive breaks</strong>, <strong>rescheduling</strong>, and <strong>missed sessions recovery</strong>.
        </p>

        {testResults && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>{testResults.passed} Passed</span>
              </div>
              {testResults.failed > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                  <XCircle className="w-4 h-4" />
                  <span>{testResults.failed} Failed</span>
                </div>
              )}
              <span className="text-xs text-slate-400 ml-auto">
                Total: {testResults.total} Assertions
              </span>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {testResults.results.map((res, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="text-slate-200 font-medium">{res.name}</div>
                    <div className="text-slate-300 text-[10px]">{res.suite}</div>
                    {res.error && <div className="text-rose-400 text-[11px] mt-0.5">{res.error}</div>}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      res.passed
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                        : 'bg-rose-950 text-rose-400 border border-rose-800/50'
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
