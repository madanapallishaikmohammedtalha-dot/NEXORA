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
        className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-4"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-[#5865D8] bg-[#EEF0FF] px-2 py-0.5 rounded border border-[#5865D8]/20 font-mono">
                {tutorContext.semester?.name || 'Active Semester'}
              </span>
              <span className="text-xs text-[#667085]">
                • {tutorContext.subject?.code} ({tutorContext.subject?.name})
              </span>
              {tutorContext.domain && (
                <span className="text-xs text-[#9CA3AF] hidden sm:inline">
                  [{tutorContext.domain}]
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-[#242938] flex items-center gap-2.5">
              <Bot className="w-6 h-6 text-[#5865D8]" />
              <span>Context-Aware AI Tutor</span>
            </h1>

            <p className="text-xs text-[#667085] mt-1 max-w-2xl leading-relaxed">
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
                  ? 'bg-[#FFFBEB] text-[#A6630A] border-[#FDE68A] shadow-xs'
                  : 'bg-white text-[#242938] border-[#E5E7EB] hover:bg-[#F5F6FA]'
              }`}
            >
              <Code2 className="w-4 h-4 text-[#A6630A]" />
              <span>{isSoloMode ? 'Solo Mode Active' : 'Code Without AI (Solo Mode)'}</span>
            </button>

            {currentTopic && (
              <button
                onClick={() => onAddTopicToMission(currentTopic)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] rounded-xl text-xs font-medium cursor-pointer shadow-xs transition-colors"
                title="Schedule this topic into Today's Daily Mission"
              >
                <Plus className="w-3.5 h-3.5 text-[#5865D8]" />
                <span className="hidden sm:inline">Add to Mission</span>
              </button>
            )}
          </div>
        </div>

        {/* Topic Selector & Context Telemetry */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#E5E7EB]">
          {/* Topic Select */}
          <div className="md:col-span-2">
            <label className="text-[10px] uppercase font-bold text-[#667085] block mb-1">
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
              className="bg-white border border-[#E5E7EB] rounded-xl px-3 py-2 text-xs text-[#242938] w-full focus:outline-none focus:border-[#5865D8]"
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
          <div className="bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl p-2.5 flex items-center justify-between text-xs">
            <div>
              <div className="text-[10px] text-[#667085] uppercase font-semibold">Mastery & Pacing</div>
              <div className="font-bold text-[#16845B] text-sm font-mono">
                {tutorContext.topicMastery}%
                <span className="text-[11px] text-[#667085] font-normal ml-1">
                  ({tutorContext.topic?.status})
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-[#667085] uppercase font-semibold">Avg Comprehension</div>
              <div className="font-bold text-[#A6630A] text-sm font-mono">
                {tutorContext.comprehensionHistory?.averageComprehension} / 5 ★
              </div>
            </div>
          </div>
        </div>

        {/* LOCKED TOPIC PROTECTION BANNER */}
        {tutorContext.isLocked && (
          <div 
            id="tutor-locked-topic-warning"
            className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3 flex items-start gap-3 text-xs text-[#A6630A]"
          >
            <Lock className="w-4 h-4 text-[#A6630A] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-[#A6630A]">
                Prerequisites Incomplete — Topic is Locked
              </div>
              <div className="text-[#242938]">
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
          <div className="flex items-center justify-between text-xs text-[#667085] px-1">
            <span className="font-bold uppercase tracking-wider text-[10px]">Tutor Operating Modes:</span>
            <span className="text-[11px] text-[#5865D8] font-medium">
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
                  className={`p-2.5 rounded-xl border text-xs font-medium flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#5865D8] text-white border-[#5865D8] shadow-xs'
                      : 'bg-white border-[#E5E7EB] text-[#667085] hover:bg-[#F5F6FA] hover:text-[#242938]'
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
          className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-4 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-[#5865D8]" />
              <h2 className="text-base font-bold text-[#242938]">
                {soloChallenge.title}
              </h2>
            </div>
            <span className="text-xs bg-[#FFFBEB] text-[#A6630A] border border-[#FDE68A] px-2.5 py-0.5 rounded-full font-semibold">
              Solo Mode (No Auto-Code)
            </span>
          </div>

          <p className="text-xs text-[#667085] leading-relaxed bg-[#F5F6FA] p-3 rounded-xl border border-[#E5E7EB]">
            {soloChallenge.description}
          </p>

          {/* Progressive Hints Section */}
          <div className="flex items-center justify-between bg-[#F5F6FA] p-3 rounded-xl border border-[#E5E7EB] text-xs">
            <div className="text-[#242938] flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-[#A6630A]" />
              <span>
                Hints available: {soloHintLevel} / {soloChallenge.hints.length} revealed
              </span>
            </div>
            {soloHintLevel < soloChallenge.hints.length && (
              <button
                type="button"
                id="request-solo-hint-btn"
                onClick={() => setSoloHintLevel((prev) => prev + 1)}
                className="px-3 py-1 bg-[#FFFBEB] hover:bg-[#FEF3C7] text-[#A6630A] border border-[#FDE68A] rounded-lg text-xs font-semibold cursor-pointer"
              >
                Request Hint {soloHintLevel + 1}
              </button>
            )}
          </div>

          {soloHintLevel > 0 && (
            <div className="space-y-2">
              {soloChallenge.hints.slice(0, soloHintLevel).map((h, i) => (
                <div key={i} className="text-xs bg-[#FFFBEB] border border-[#FDE68A] p-2.5 rounded-lg text-[#A6630A]">
                  {h}
                </div>
              ))}
            </div>
          )}

          {/* Code Editor Area */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#242938]">
              Your Solution (Write without AI assistance):
            </label>
            <textarea
              id="solo-code-textarea"
              value={soloStudentCode}
              onChange={(e) => setSoloStudentCode(e.target.value)}
              rows={10}
              className="w-full bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl p-3 font-mono text-xs text-[#242938] focus:outline-none focus:border-[#5865D8] resize-y"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              id="submit-solo-code-btn"
              onClick={handleSubmitSoloCode}
              className="px-5 py-2.5 bg-[#5865D8] hover:bg-[#4854C4] text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Submit Code for Comprehensive Review</span>
            </button>
          </div>

          {/* Review Card */}
          {soloReview && (
            <div 
              id="solo-review-card"
              className="mt-4 bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                <span className="font-bold text-[#242938] text-xs">
                  Automated Code Review & Complexity Analysis
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                  soloReview.correctness === 'correct' ? 'bg-[#ECFDF5] text-[#16845B] border-[#A7F3D0]' : 'bg-[#FFFBEB] text-[#A6630A] border-[#FDE68A]'
                }`}>
                  Logic Score: {soloReview.logicScore}/100
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2 rounded-lg border border-[#E5E7EB]">
                  <div className="text-[10px] text-[#667085]">Time Complexity:</div>
                  <div className="font-mono text-[#242938] font-semibold">{soloReview.complexity.time}</div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-[#E5E7EB]">
                  <div className="text-[10px] text-[#667085]">Space Complexity:</div>
                  <div className="font-mono text-[#242938] font-semibold">{soloReview.complexity.space}</div>
                </div>
              </div>

              <div className="text-xs text-[#242938] leading-relaxed">
                <strong>Analysis: </strong>{soloReview.correctnessAnalysis}
              </div>

              {soloReview.mistakesExplained.length > 0 && (
                <div className="text-xs bg-[#FEF2F2] border border-[#FECACA] p-2.5 rounded-lg text-[#C43D4B]">
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
                  <div className="text-xs font-semibold text-[#667085]">Reference Clean Implementation:</div>
                  <pre className="bg-white p-3 rounded-lg text-[11px] font-mono text-[#242938] overflow-x-auto border border-[#E5E7EB]">
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
          className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-4 shadow-xs"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#5865D8]" />
            <h2 className="text-base font-bold text-[#242938]">
              Explain It Back Challenge
            </h2>
          </div>

          <p className="text-xs text-[#667085] leading-relaxed bg-[#F5F6FA] p-3 rounded-xl border border-[#E5E7EB]">
            Explain <strong>"{tutorContext.topic?.title}"</strong> in your own words. How does it work? Why is it needed? Where can it fail?
            The AI tutor will rigorously evaluate your conceptual model for misconceptions and missing ideas.
          </p>

          <textarea
            id="explain-back-textarea"
            value={explainBackInput}
            onChange={(e) => setExplainBackInput(e.target.value)}
            placeholder="Type your explanation from first principles..."
            rows={4}
            className="w-full bg-white border border-[#E5E7EB] rounded-xl p-3 text-xs text-[#242938] placeholder-[#9CA3AF] focus:outline-none focus:border-[#5865D8] resize-none"
          />

          <div className="flex justify-between items-center">
            <span className="text-[11px] text-[#667085] italic">
              *Evaluations are strictly advisory and do not automatically mark topic as mastered.
            </span>
            <button
              id="submit-explain-back-btn"
              onClick={handleSubmitExplainBack}
              disabled={isLoading || !explainBackInput.trim()}
              className="px-5 py-2 bg-[#5865D8] hover:bg-[#4854C4] disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Evaluate My Explanation</span>
            </button>
          </div>

          {/* Structured Feedback Card */}
          {explainBackFeedback && (
            <div 
              id="explain-back-feedback-card"
              className="mt-4 bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                <span className="text-xs font-bold text-[#242938]">Structured Understanding Feedback</span>
                <span className="text-xs font-extrabold text-[#16845B] bg-[#ECFDF5] px-2.5 py-0.5 rounded-full border border-[#A7F3D0]">
                  Understanding: {explainBackFeedback.understandingScore}/100
                </span>
              </div>

              <div className="text-xs space-y-1">
                <div className="font-semibold text-[#16845B]">What you got right:</div>
                <ul className="list-disc pl-4 text-[#242938] space-y-0.5">
                  {explainBackFeedback.whatYouGotRight.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              <div className="text-xs space-y-1">
                <div className="font-semibold text-[#A6630A]">What is missing:</div>
                <ul className="list-disc pl-4 text-[#242938] space-y-0.5">
                  {explainBackFeedback.whatIsMissing.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>

              <div className="text-xs bg-[#EEF0FF] border border-[#5865D8]/20 p-2.5 rounded-lg space-y-1">
                <div className="font-semibold text-[#5865D8]">One Correction:</div>
                <div className="text-[#242938]">{explainBackFeedback.oneCorrection}</div>
              </div>

              <div className="text-xs bg-white p-2.5 rounded-lg border border-[#E5E7EB] space-y-1">
                <div className="font-semibold text-[#667085]">Follow-up Probing Question:</div>
                <div className="text-[#5865D8] italic">{explainBackFeedback.followUpQuestion}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PRACTICE MODE INTERFACE */}
      {!isSoloMode && mode === 'practice' && practiceProblems && (
        <div 
          id="practice-mode-workspace"
          className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-4 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#242938] flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#5865D8]" />
              <span>Targeted Practice: {practiceProblems.topicTitle}</span>
            </h2>
            <span className="text-xs text-[#667085] bg-[#F5F6FA] border border-[#E5E7EB] px-2 py-0.5 rounded font-mono">
              {practiceProblems.problems.length} Problems
            </span>
          </div>

          <div className="space-y-3">
            {practiceProblems.problems.map((prob, idx) => (
              <div 
                key={prob.id} 
                className="bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl p-4 space-y-2 text-xs"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#242938]">Problem {idx + 1}: {prob.title}</span>
                  <span className="text-[10px] uppercase font-semibold text-[#5865D8] bg-[#EEF0FF] px-2 py-0.5 rounded border border-[#5865D8]/20 font-mono">
                    {prob.difficulty}
                  </span>
                </div>
                <p className="text-[#667085] leading-relaxed">{prob.description}</p>

                {/* Progressive Hints */}
                <div className="pt-2 border-t border-[#E5E7EB]">
                  <div className="flex items-center justify-between text-[#667085]">
                    <button
                      type="button"
                      onClick={() => setRevealedHints((prev) => ({ ...prev, [prob.id]: (prev[prob.id] || 0) + 1 }))}
                      disabled={(revealedHints[prob.id] || 0) >= prob.hints.length}
                      className="text-[11px] text-[#5865D8] hover:text-[#4854C4] font-semibold cursor-pointer disabled:text-[#9CA3AF]"
                    >
                      {(revealedHints[prob.id] || 0) >= prob.hints.length ? 'All Hints Shown' : 'Reveal Hint'}
                    </button>
                    <span className="text-[10px]">{revealedHints[prob.id] || 0} / {prob.hints.length} hints</span>
                  </div>

                  {(revealedHints[prob.id] || 0) > 0 && (
                    <div className="mt-2 space-y-1">
                      {prob.hints.slice(0, revealedHints[prob.id]).map((hint, hIdx) => (
                        <div key={hIdx} className="bg-white p-2 rounded text-[#242938] text-[11px] border border-[#E5E7EB]">
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
          className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-4 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#242938] flex items-center gap-2">
              <Award className="w-5 h-5 text-[#5865D8]" />
              <span>Assessment: {testAssessment.topicTitle}</span>
            </h2>
            <span className="text-xs uppercase bg-[#EEF0FF] text-[#5865D8] px-2 py-0.5 rounded border border-[#5865D8]/20 font-semibold font-mono">
              {testAssessment.difficulty}
            </span>
          </div>

          <div className="space-y-4">
            {testAssessment.problems.map((prob, idx) => (
              <div key={prob.id} className="bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl p-4 space-y-2 text-xs">
                <div className="font-semibold text-[#242938]">
                  Question {idx + 1} ({prob.type}): {prob.question}
                </div>

                {prob.options && (
                  <div className="space-y-1.5 pt-1">
                    {prob.options.map((opt, oIdx) => (
                      <label key={oIdx} className="flex items-center gap-2 text-[#242938] hover:text-[#5865D8] cursor-pointer">
                        <input
                          type="radio"
                          name={prob.id}
                          checked={testAnswers[prob.id] === opt}
                          onChange={() => setTestAnswers((prev) => ({ ...prev, [prob.id]: opt }))}
                          className="accent-[#5865D8]"
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
                    className="w-full bg-white border border-[#E5E7EB] rounded-lg p-2.5 text-xs text-[#242938] placeholder-[#9CA3AF] focus:outline-none focus:border-[#5865D8]"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              id="submit-test-assessment-btn"
              onClick={handleSubmitTest}
              className="px-6 py-2.5 bg-[#5865D8] hover:bg-[#4854C4] text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
            >
              Submit Assessment for Structured Scoring
            </button>
          </div>

          {testEvaluation && (
            <div 
              id="test-evaluation-card"
              className="mt-4 bg-[#F5F6FA] border border-[#E5E7EB] rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                <span className="font-bold text-[#242938] text-xs">Assessment Evaluation Result</span>
                <span className="text-sm font-extrabold text-[#16845B]">
                  {testEvaluation.score}% ({testEvaluation.correctCount}/{testEvaluation.totalQuestions} Correct)
                </span>
              </div>

              <div className="space-y-2">
                {testEvaluation.feedbackPerQuestion.map((fb, i) => (
                  <div key={i} className="text-xs bg-white p-2.5 rounded-lg border border-[#E5E7EB] space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-[#242938]">
                      <span className={fb.isCorrect ? 'text-[#16845B]' : 'text-[#C43D4B]'}>{fb.isCorrect ? '✓' : '✗'}</span>
                      <span>{fb.question}</span>
                    </div>
                    <div className="text-[#667085] pl-4">{fb.explanation}</div>
                  </div>
                ))}
              </div>

              <div className="bg-[#EEF0FF] border border-[#5865D8]/20 p-3 rounded-xl text-xs space-y-1">
                <div className="font-bold text-[#5865D8]">Next Recommended Action:</div>
                <div className="text-[#242938]">{testEvaluation.nextRecommendedAction}</div>
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
            <span className="text-[#667085] text-[11px] shrink-0 font-medium">Quick Prompts:</span>
            <button
              onClick={() => handleSend(`Ask me a Socratic probing question about the core mechanism behind "${tutorContext.topic?.title || 'this concept'}".`)}
              className="px-3 py-1 bg-white hover:bg-[#F5F6FA] text-[#5865D8] rounded-lg border border-[#E5E7EB] whitespace-nowrap cursor-pointer transition-colors shadow-xs"
            >
              💡 Socratic Probe
            </button>
            <button
              onClick={() => handleSend(`Why does "${tutorContext.topic?.title || 'this concept'}" exist in practice, and what would fail without it?`)}
              className="px-3 py-1 bg-white hover:bg-[#F5F6FA] text-[#A6630A] rounded-lg border border-[#E5E7EB] whitespace-nowrap cursor-pointer transition-colors shadow-xs"
            >
              ❓ Why is this needed?
            </button>
            <button
              onClick={() => handleSend(`Explain "${tutorContext.topic?.title || 'this concept'}" using a vivid physical real-world analogy.`)}
              className="px-3 py-1 bg-white hover:bg-[#F5F6FA] text-[#16845B] rounded-lg border border-[#E5E7EB] whitespace-nowrap cursor-pointer transition-colors shadow-xs"
            >
              🧩 Real-World Analogy
            </button>
            <button
              onClick={() => handleSend(`Give me a minimal code example illustrating "${tutorContext.topic?.title || 'this concept'}" with commentary.`)}
              className="px-3 py-1 bg-white hover:bg-[#F5F6FA] text-[#5865D8] rounded-lg border border-[#E5E7EB] whitespace-nowrap cursor-pointer transition-colors shadow-xs"
            >
              💻 Code Example
            </button>
          </div>

          {/* Chat Messages Log */}
          <div 
            id="tutor-chat-container"
            className="bg-white border border-[#E5E7EB] rounded-2xl p-6 min-h-[420px] max-h-[580px] overflow-y-auto space-y-4 shadow-xs"
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-[#5865D8] flex items-center justify-center text-white shrink-0 shadow-xs mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#5865D8] text-white rounded-tr-none'
                      : 'bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB] rounded-tl-none shadow-xs'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-xs max-w-none space-y-2 text-[#242938]">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-[#EEF0FF] border border-[#5865D8]/20 flex items-center justify-center text-[#5865D8] shrink-0 shadow-xs mt-0.5">
                    👤
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-3 text-xs text-[#5865D8] py-2">
                <div className="w-8 h-8 rounded-xl bg-[#5865D8] flex items-center justify-center text-white shrink-0 animate-pulse">
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
            className="flex items-center gap-3 bg-white border border-[#E5E7EB] rounded-2xl p-2.5 shadow-xs"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={`Ask about ${tutorContext.topic?.title || 'a concept'}, or respond to the prompt...`}
              className="flex-1 bg-transparent px-3 py-2 text-xs text-[#242938] placeholder-[#9CA3AF] focus:outline-none"
              disabled={isLoading}
            />

            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#5865D8] hover:bg-[#4854C4] disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>

          {/* AI Advisory Boundary Notice */}
          <div className="text-[11px] text-[#667085] text-center pt-1">
            NEXORA AI Tutor operates in Advisory Mode. Mastery and curriculum progression are strictly recorded through verified study sessions.
          </div>
        </div>
      )}
    </div>
  );
};
