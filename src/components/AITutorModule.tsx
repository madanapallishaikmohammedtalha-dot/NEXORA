import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  HelpCircle, 
  BookOpen, 
  Lightbulb, 
  CheckCircle, 
  Target, 
  RefreshCw,
  Plus,
  ShieldAlert,
  Code2,
  Lock,
  Layers,
  Award,
  ChevronRight,
  Info,
  Clock,
  Zap,
  ArrowRight,
  Terminal,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { 
  AppState, 
  ExplainItBackFeedback, 
  PracticeProblemSet, 
  RoadmapTopic, 
  SoloCodeReview, 
  SoloCodingChallenge, 
  TestAssessment, 
  TestEvaluation, 
  TutorContext, 
  TutorMode 
} from '../types';
import { 
  askAITutor, 
  buildTutorContext, 
  evaluateTestSubmission, 
  generatePracticeProblems, 
  generateTestAssessment, 
  parseExplainItBackFeedback, 
  reviewSoloCodeSubmission 
} from '../services/ai';

interface AITutorProps {
  state: AppState;
  selectedTopic?: RoadmapTopic | null;
  onAddTopicToMission: (topic: RoadmapTopic) => void;
}

export const AITutorModule: React.FC<AITutorProps> = ({
  state,
  selectedTopic: initialSelectedTopic,
  onAddTopicToMission,
}) => {
  const [selectedTopicId, setSelectedTopicId] = useState<string>(
    initialSelectedTopic?.id || state.topics[0]?.id || ''
  );
  const [mode, setMode] = useState<TutorMode>('explain');
  const [isSoloMode, setIsSoloMode] = useState<boolean>(false);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Specialized interactive mode states
  const [explainBackInput, setExplainBackInput] = useState<string>('');
  const [explainBackFeedback, setExplainBackFeedback] = useState<ExplainItBackFeedback | null>(null);

  const [testAssessment, setTestAssessment] = useState<TestAssessment | null>(null);
  const [testAnswers, setTestAnswers] = useState<Record<string, string>>({});
  const [testEvaluation, setTestEvaluation] = useState<TestEvaluation | null>(null);

  const [practiceProblems, setPracticeProblems] = useState<PracticeProblemSet | null>(null);
  const [revealedHints, setRevealedHints] = useState<Record<string, number>>({});

  // Solo mode state
  const [soloChallenge, setSoloChallenge] = useState<SoloCodingChallenge | null>(null);
  const [soloStudentCode, setSoloStudentCode] = useState<string>('');
  const [soloHintLevel, setSoloHintLevel] = useState<number>(0);
  const [soloReview, setSoloReview] = useState<SoloCodeReview | null>(null);

  // Build reactive, context-grounded tutor context
  const currentTopic = state.topics.find((t) => t.id === selectedTopicId);
  const tutorContext = buildTutorContext(state, selectedTopicId);

  // Update selection if prop changes
  useEffect(() => {
    if (initialSelectedTopic) {
      setSelectedTopicId(initialSelectedTopic.id);
    }
  }, [initialSelectedTopic]);

  // Initial welcome message per topic
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: `### Welcome to NEXORA Socratic AI Tutor

I am your context-aware cognitive coach for **${tutorContext.topic?.title || 'Academic Coursework'}** (${tutorContext.subject?.code || 'STEM'}).

Unlike a generic chatbot:
- I adhere to your active curriculum and prerequisite sequence.
- I teach progressively through guided Socratic questioning.
- I never write unearned progress into your academic records.

Choose an operating mode above or ask a targeted conceptual question!`,
    },
  ]);

  // Handle changing mode
  const handleModeChange = async (newMode: TutorMode) => {
    setMode(newMode);
    setIsSoloMode(false);

    if (newMode === 'explain_back') {
      setExplainBackFeedback(null);
      setExplainBackInput('');
    } else if (newMode === 'practice') {
      const pSet = generatePracticeProblems(tutorContext);
      setPracticeProblems(pSet);
      setRevealedHints({});
    } else if (newMode === 'test') {
      const assessment = generateTestAssessment(tutorContext);
      setTestAssessment(assessment);
      setTestAnswers({});
      setTestEvaluation(null);
    }
  };

  // Launch Solo Coding Mode
  const handleToggleSoloMode = () => {
    const nextState = !isSoloMode;
    setIsSoloMode(nextState);
    if (nextState) {
      const challenge: SoloCodingChallenge = {
        id: `solo-${tutorContext.topic?.id || 'gen'}`,
        title: `Independent Challenge: ${tutorContext.topic?.title || 'System Implementation'}`,
        topicTitle: tutorContext.topic?.title || 'System Concept',
        description: `Implement a robust, production-grade module demonstrating ${tutorContext.topic?.title}. Enforce invariant safety, defensive bounds validation, and clean resource deallocation.`,
        inputSpecification: 'Structured function call or configuration object',
        outputSpecification: 'Processed result adhering to invariant safety',
        starterCode: `// Solo Coding Mode: Write your implementation independently.
// The AI will not generate code for you until you submit for review.
export function executeSolution(input: any) {
  // TODO: Add input validation
  
  // TODO: Implement core algorithm

  return null;
}`,
        hints: [
          'Hint 1: What is the primary invariant or base case that must be checked before proceeding?',
          'Hint 2: Ensure any acquired resources or locks are wrapped in a try/finally block so they are never leaked during runtime exceptions.',
          'Hint 3: Consider edge cases: what if the input is empty or null?',
        ],
      };
      setSoloChallenge(challenge);
      setSoloStudentCode(challenge.starterCode || '');
      setSoloHintLevel(0);
      setSoloReview(null);
    }
  };

  // Standard Conversational Dialogue
  const handleSend = async (customPrompt?: string) => {
    const textToSend = customPrompt || inputMessage;
    if (!textToSend.trim() || isLoading) return;

    const newMessages = [...messages, { role: 'user' as const, content: textToSend.trim() }];
    setMessages(newMessages);
    if (!customPrompt) setInputMessage('');
    setIsLoading(true);

    try {
      const response = await askAITutor(
        newMessages,
        tutorContext,
        mode,
        state.profile.apiKey,
        state.profile.aiModel,
        isSoloMode
      );

      setMessages([...newMessages, { role: 'assistant', content: response.reply }]);
    } catch (err: any) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `Error connecting to AI Tutor: ${err.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Explain-It-Back Explanation
  const handleSubmitExplainBack = async () => {
    if (!explainBackInput.trim() || isLoading) return;
    setIsLoading(true);

    try {
      const prompt = `Student Explanation of "${tutorContext.topic?.title}":\n\n"${explainBackInput}"\n\nPlease evaluate my explanation strictly against conceptual correctness, missing ideas, misconceptions, and clarity according to the EXPLAIN-IT-BACK format.`;
      const response = await askAITutor(
        [{ role: 'user', content: prompt }],
        tutorContext,
        'explain_back',
        state.profile.apiKey,
        state.profile.aiModel
      );

      const parsed = parseExplainItBackFeedback(response.reply);
      setExplainBackFeedback(parsed);
    } catch (err: any) {
      console.error('Explain back error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Test Assessment
  const handleSubmitTest = () => {
    if (!testAssessment) return;
    const evaluation = evaluateTestSubmission(testAssessment, testAnswers);
    setTestEvaluation(evaluation);
  };

  // Submit Solo Code for Review
  const handleSubmitSoloCode = () => {
    if (!soloChallenge) return;
    const review = reviewSoloCodeSubmission(soloChallenge, soloStudentCode);
    setSoloReview(review);
  };

  const modeDefinitions: Array<{ id: TutorMode; label: string; desc: string }> = [
    { id: 'explain', label: 'Explain', desc: '5-step structured explanation' },
    { id: 'why', label: 'Why?', desc: 'Purpose, intuition & alternatives' },
    { id: 'example', label: 'Example', desc: 'Concrete minimal scenarios' },
    { id: 'analogy', label: 'Analogy', desc: 'Vivid real-world physical mapping' },
    { id: 'practice', label: 'Practice', desc: '1–3 targeted problems' },
    { id: 'test', label: 'Test Me', desc: 'Short multi-part assessment' },
    { id: 'explain_back', label: 'Explain It Back', desc: 'Active recall evaluation' },
    { id: 'review_answer', label: 'Review My Answer', desc: 'Diagnostic feedback on your code' },
  ];

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. ACADEMIC CONTEXT HEADER (Grounded, Anti-Generic Chatbot)              */}
      {/* ========================================================================= */}
      <div 
        id="tutor-context-header"
        className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40">
                {tutorContext.semester?.name || 'Active Semester'}
              </span>
              <span className="text-xs text-slate-400">
                • {tutorContext.subject?.code} ({tutorContext.subject?.name})
              </span>
              {tutorContext.domain && (
                <span className="text-xs text-slate-500 hidden sm:inline">
                  [{tutorContext.domain}]
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
              <Bot className="w-6 h-6 text-indigo-400" />
              <span>Context-Aware AI Tutor</span>
            </h1>

            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Academic advisor that guides through Socratic questioning rather than immediately giving away answers.
              Grounded in prerequisites, past comprehension ratings, and syllabus pacing.
            </p>
          </div>

          {/* Solo Mode Toggle */}
          <div className="flex items-center gap-3">
            <button
              id="toggle-solo-coding-mode-btn"
              onClick={handleToggleSoloMode}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                isSoloMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Code2 className="w-4 h-4 text-amber-400" />
              <span>{isSoloMode ? 'Solo Mode Active' : 'Code Without AI (Solo Mode)'}</span>
            </button>

            {currentTopic && (
              <button
                onClick={() => onAddTopicToMission(currentTopic)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium cursor-pointer"
                title="Schedule this topic into Today's Daily Mission"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Add to Mission</span>
              </button>
            )}
          </div>
        </div>

        {/* Topic Selector & Context Telemetry */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
          {/* Topic Select */}
          <div className="md:col-span-2">
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Active Topic Context
            </label>
            <select
              value={selectedTopicId}
              onChange={(e) => {
                setSelectedTopicId(e.target.value);
                setExplainBackFeedback(null);
                setTestAssessment(null);
                setPracticeProblems(null);
                setSoloReview(null);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white w-full focus:outline-none focus:border-indigo-500"
            >
              {state.topics.map((t) => {
                const sub = state.subjects.find((s) => s.id === t.subjectId);
                return (
                  <option key={t.id} value={t.id}>
                    [{sub?.code || 'Subject'}] {t.title} — {t.masteryLevel}% Mastery ({t.status.toUpperCase()})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Pacing & Comprehension Telemetry */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Mastery & Pacing</div>
              <div className="font-bold text-emerald-400 text-sm">
                {tutorContext.topicMastery}%
                <span className="text-[11px] text-slate-400 font-normal ml-1">
                  ({tutorContext.topic?.status})
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Avg Comprehension</div>
              <div className="font-bold text-amber-300 text-sm">
                {tutorContext.comprehensionHistory?.averageComprehension} / 5 ★
              </div>
            </div>
          </div>
        </div>

        {/* LOCKED TOPIC PROTECTION BANNER */}
        {tutorContext.isLocked && (
          <div 
            id="tutor-locked-topic-warning"
            className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3 flex items-start gap-3 text-xs text-amber-200"
          >
            <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-amber-300">
                Prerequisites Incomplete — Topic is Locked
              </div>
              <div>
                "{tutorContext.topic?.title}" requires foundational understanding of:{' '}
                <strong>{(tutorContext.missingPrerequisites || []).join(', ')}</strong>.
                Attempting advanced material without prerequisite mastery can cause cognitive overload. The tutor will guide you on prerequisite building blocks first.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. OPERATIONAL MODES BAR                                                 */}
      {/* ========================================================================= */}
      {!isSoloMode && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-bold uppercase tracking-wider text-[10px]">Tutor Operating Modes:</span>
            <span className="text-[11px] text-indigo-400">
              {modeDefinitions.find((m) => m.id === mode)?.desc}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {modeDefinitions.map((m) => {
              const isSelected = mode === m.id;
              return (
                <button
                  key={m.id}
                  id={`tutor-mode-${m.id}`}
                  onClick={() => handleModeChange(m.id)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md transform scale-[1.02]'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SPECIALIZED INTERACTIVE MODES                                         */}
      {/* ========================================================================= */}

      {/* SOLO CODING PRACTICE MODE */}
      {isSoloMode && soloChallenge && (
        <div 
          id="solo-coding-workspace"
          className="bg-slate-900 border-2 border-amber-500/40 rounded-2xl p-5 space-y-4 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-white">
                {soloChallenge.title}
              </h2>
            </div>
            <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-semibold">
              Solo Mode (No Auto-Code)
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
            {soloChallenge.description}
          </p>

          {/* Progressive Hints Section */}
          <div className="flex items-center justify-between bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs">
            <div className="text-slate-300 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <span>
                Hints available: {soloHintLevel} / {soloChallenge.hints.length} revealed
              </span>
            </div>
            {soloHintLevel < soloChallenge.hints.length && (
              <button
                type="button"
                id="request-solo-hint-btn"
                onClick={() => setSoloHintLevel((prev) => prev + 1)}
                className="px-3 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-600/40 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Request Hint {soloHintLevel + 1}
              </button>
            )}
          </div>

          {soloHintLevel > 0 && (
            <div className="space-y-2">
              {soloChallenge.hints.slice(0, soloHintLevel).map((h, i) => (
                <div key={i} className="text-xs bg-amber-950/30 border border-amber-900/40 p-2.5 rounded-lg text-amber-200">
                  {h}
                </div>
              ))}
            </div>
          )}

          {/* Code Editor Area */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Your Solution (Write without AI assistance):
            </label>
            <textarea
              id="solo-code-textarea"
              value={soloStudentCode}
              onChange={(e) => setSoloStudentCode(e.target.value)}
              rows={10}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-xs text-emerald-400 focus:outline-none focus:border-amber-500 resize-y"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              id="submit-solo-code-btn"
              onClick={handleSubmitSoloCode}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Submit Code for Comprehensive Review</span>
            </button>
          </div>

          {/* Review Card */}
          {soloReview && (
            <div 
              id="solo-review-card"
              className="mt-4 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-white text-xs">
                  Automated Code Review & Complexity Analysis
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  soloReview.correctness === 'correct' ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'
                }`}>
                  Logic Score: {soloReview.logicScore}/100
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">Time Complexity:</div>
                  <div className="font-mono text-white">{soloReview.complexity.time}</div>
                </div>
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <div className="text-[10px] text-slate-400">Space Complexity:</div>
                  <div className="font-mono text-white">{soloReview.complexity.space}</div>
                </div>
              </div>

              <div className="text-xs text-slate-300 leading-relaxed">
                <strong>Analysis: </strong>{soloReview.correctnessAnalysis}
              </div>

              {soloReview.mistakesExplained.length > 0 && (
                <div className="text-xs bg-rose-950/20 border border-rose-900/30 p-2.5 rounded-lg text-rose-300">
                  <div className="font-semibold mb-1">Mistakes to Address Before Seeing Solution:</div>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {soloReview.mistakesExplained.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              {soloReview.alternativeSolution && (
                <div className="space-y-1 pt-2">
                  <div className="text-xs font-semibold text-slate-400">Reference Clean Implementation:</div>
                  <pre className="bg-slate-900 p-3 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto border border-slate-800">
                    {soloReview.alternativeSolution}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* EXPLAIN IT BACK INTERFACE */}
      {!isSoloMode && mode === 'explain_back' && (
        <div 
          id="explain-it-back-workspace"
          className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              Explain It Back Challenge
            </h2>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800">
            Explain <strong>"{tutorContext.topic?.title}"</strong> in your own words. How does it work? Why is it needed? Where can it fail?
            The AI tutor will rigorously evaluate your conceptual model for misconceptions and missing ideas.
          </p>

          <textarea
            id="explain-back-textarea"
            value={explainBackInput}
            onChange={(e) => setExplainBackInput(e.target.value)}
            placeholder="Type your explanation from first principles..."
            rows={4}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
          />

          <div className="flex justify-between items-center">
            <span className="text-[11px] text-slate-400 italic">
              *Evaluations are strictly advisory and do not automatically mark topic as mastered.
            </span>
            <button
              id="submit-explain-back-btn"
              onClick={handleSubmitExplainBack}
              disabled={isLoading || !explainBackInput.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Evaluate My Explanation</span>
            </button>
          </div>

          {/* Structured Feedback Card */}
          {explainBackFeedback && (
            <div 
              id="explain-back-feedback-card"
              className="mt-4 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-white">Structured Understanding Feedback</span>
                <span className="text-xs font-extrabold text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-800/40">
                  Understanding: {explainBackFeedback.understandingScore}/100
                </span>
              </div>

              <div className="text-xs space-y-1">
                <div className="font-semibold text-emerald-400">What you got right:</div>
                <ul className="list-disc pl-4 text-slate-300 space-y-0.5">
                  {explainBackFeedback.whatYouGotRight.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              <div className="text-xs space-y-1">
                <div className="font-semibold text-amber-400">What is missing:</div>
                <ul className="list-disc pl-4 text-slate-300 space-y-0.5">
                  {explainBackFeedback.whatIsMissing.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>

              <div className="text-xs bg-indigo-950/30 border border-indigo-900/40 p-2.5 rounded-lg space-y-1">
                <div className="font-semibold text-indigo-300">One Correction:</div>
                <div className="text-slate-200">{explainBackFeedback.oneCorrection}</div>
              </div>

              <div className="text-xs bg-slate-900 p-2.5 rounded-lg border border-slate-800 space-y-1">
                <div className="font-semibold text-slate-300">Follow-up Probing Question:</div>
                <div className="text-indigo-300 italic">{explainBackFeedback.followUpQuestion}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PRACTICE MODE INTERFACE */}
      {!isSoloMode && mode === 'practice' && practiceProblems && (
        <div 
          id="practice-mode-workspace"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <span>Targeted Practice: {practiceProblems.topicTitle}</span>
            </h2>
            <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
              {practiceProblems.problems.length} Problems
            </span>
          </div>

          <div className="space-y-3">
            {practiceProblems.problems.map((prob, idx) => (
              <div 
                key={prob.id} 
                className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 text-xs"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white">Problem {idx + 1}: {prob.title}</span>
                  <span className="text-[10px] uppercase font-semibold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40">
                    {prob.difficulty}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">{prob.description}</p>

                {/* Progressive Hints */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-slate-400">
                    <button
                      type="button"
                      onClick={() => setRevealedHints((prev) => ({ ...prev, [prob.id]: (prev[prob.id] || 0) + 1 }))}
                      disabled={(revealedHints[prob.id] || 0) >= prob.hints.length}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer disabled:text-slate-600"
                    >
                      {(revealedHints[prob.id] || 0) >= prob.hints.length ? 'All Hints Shown' : 'Reveal Hint'}
                    </button>
                    <span className="text-[10px]">{revealedHints[prob.id] || 0} / {prob.hints.length} hints</span>
                  </div>

                  {(revealedHints[prob.id] || 0) > 0 && (
                    <div className="mt-2 space-y-1">
                      {prob.hints.slice(0, revealedHints[prob.id]).map((hint, hIdx) => (
                        <div key={hIdx} className="bg-slate-900 p-2 rounded text-slate-300 text-[11px]">
                          💡 {hint}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TEST ME MODE INTERFACE */}
      {!isSoloMode && mode === 'test' && testAssessment && (
        <div 
          id="test-mode-workspace"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-400" />
              <span>Assessment: {testAssessment.topicTitle}</span>
            </h2>
            <span className="text-xs uppercase bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800">
              {testAssessment.difficulty}
            </span>
          </div>

          <div className="space-y-4">
            {testAssessment.problems.map((prob, idx) => (
              <div key={prob.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
                <div className="font-semibold text-slate-200">
                  Question {idx + 1} ({prob.type}): {prob.question}
                </div>

                {prob.options && (
                  <div className="space-y-1.5 pt-1">
                    {prob.options.map((opt, oIdx) => (
                      <label key={oIdx} className="flex items-center gap-2 text-slate-300 hover:text-white cursor-pointer">
                        <input
                          type="radio"
                          name={prob.id}
                          checked={testAnswers[prob.id] === opt}
                          onChange={() => setTestAnswers((prev) => ({ ...prev, [prob.id]: opt }))}
                          className="accent-indigo-600"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                )}

                {!prob.options && (
                  <textarea
                    value={testAnswers[prob.id] || ''}
                    onChange={(e) => setTestAnswers((prev) => ({ ...prev, [prob.id]: e.target.value }))}
                    placeholder="Type your answer here..."
                    rows={2}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              id="submit-test-assessment-btn"
              onClick={handleSubmitTest}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
            >
              Submit Assessment for Structured Scoring
            </button>
          </div>

          {testEvaluation && (
            <div 
              id="test-evaluation-card"
              className="mt-4 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-white text-xs">Assessment Evaluation Result</span>
                <span className="text-sm font-extrabold text-emerald-400">
                  {testEvaluation.score}% ({testEvaluation.correctCount}/{testEvaluation.totalQuestions} Correct)
                </span>
              </div>

              <div className="space-y-2">
                {testEvaluation.feedbackPerQuestion.map((fb, i) => (
                  <div key={i} className="text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                      <span>{fb.isCorrect ? '✓' : '✗'}</span>
                      <span>{fb.question}</span>
                    </div>
                    <div className="text-slate-400 pl-4">{fb.explanation}</div>
                  </div>
                ))}
              </div>

              <div className="bg-indigo-950/30 border border-indigo-900/40 p-3 rounded-xl text-xs space-y-1">
                <div className="font-bold text-indigo-400">Next Recommended Action:</div>
                <div className="text-slate-200">{testEvaluation.nextRecommendedAction}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CONVERSATIONAL SOCRATIC CHAT STREAM                                   */}
      {/* ========================================================================= */}
      {!isSoloMode && (
        <div className="space-y-3">
          {/* Quick Prompts Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 text-[11px] shrink-0 font-medium">Quick Prompts:</span>
            <button
              onClick={() => handleSend(`Ask me a Socratic probing question about the core mechanism behind "${tutorContext.topic?.title || 'this concept'}".`)}
              className="px-3 py-1 bg-slate-800/80 hover:bg-slate-700 text-indigo-300 rounded-lg border border-indigo-900/40 whitespace-nowrap cursor-pointer"
            >
              💡 Socratic Probe
            </button>
            <button
              onClick={() => handleSend(`Why does "${tutorContext.topic?.title || 'this concept'}" exist in practice, and what would fail without it?`)}
              className="px-3 py-1 bg-slate-800/80 hover:bg-slate-700 text-amber-300 rounded-lg border border-amber-900/40 whitespace-nowrap cursor-pointer"
            >
              ❓ Why is this needed?
            </button>
            <button
              onClick={() => handleSend(`Explain "${tutorContext.topic?.title || 'this concept'}" using a vivid physical real-world analogy.`)}
              className="px-3 py-1 bg-slate-800/80 hover:bg-slate-700 text-emerald-300 rounded-lg border border-emerald-900/40 whitespace-nowrap cursor-pointer"
            >
              🧩 Real-World Analogy
            </button>
            <button
              onClick={() => handleSend(`Give me a minimal code example illustrating "${tutorContext.topic?.title || 'this concept'}" with commentary.`)}
              className="px-3 py-1 bg-slate-800/80 hover:bg-slate-700 text-purple-300 rounded-lg border border-purple-900/40 whitespace-nowrap cursor-pointer"
            >
              💻 Code Example
            </button>
          </div>

          {/* Chat Messages Log */}
          <div 
            id="tutor-chat-container"
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[420px] max-h-[580px] overflow-y-auto space-y-4 shadow-sm"
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-800/80 text-slate-200 border border-slate-700/80 rounded-tl-none shadow-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-invert prose-xs max-w-none space-y-2">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 shrink-0 shadow-sm mt-0.5">
                    👤
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-3 text-xs text-indigo-400 py-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 animate-pulse">
                  <Bot className="w-4 h-4" />
                </div>
                <span className="animate-pulse font-medium">Formulating progressive Socratic guidance...</span>
              </div>
            )}
          </div>

          {/* User Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-2.5 shadow-sm"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={`Ask about ${tutorContext.topic?.title || 'a concept'}, or respond to the prompt...`}
              className="flex-1 bg-transparent px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
              disabled={isLoading}
            />

            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>

          {/* AI Advisory Boundary Notice */}
          <div className="text-[11px] text-slate-500 text-center pt-1">
            NEXORA AI Tutor operates in Advisory Mode. Mastery and curriculum progression are strictly recorded through verified study sessions.
          </div>
        </div>
      )}
    </div>
  );
};
