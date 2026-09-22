import React, { useState } from 'react';
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
  Plus
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AppState, RoadmapTopic } from '../types';
import { askAITutor } from '../services/ai';

interface AITutorProps {
  state: AppState;
  selectedTopic?: RoadmapTopic | null;
  onAddTopicToMission: (topic: RoadmapTopic) => void;
}

type TutorMode = 'socratic' | 'explain' | 'quiz' | 'breakdown';

export const AITutorModule: React.FC<AITutorProps> = ({
  state,
  selectedTopic: initialSelectedTopic,
  onAddTopicToMission,
}) => {
  const [selectedTopicId, setSelectedTopicId] = useState<string>(
    initialSelectedTopic?.id || state.topics[0]?.id || ''
  );
  const [mode, setMode] = useState<TutorMode>('socratic');
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: `Hello! I am your Socratic AI Academic Tutor.

I help you build rigorous mental models, test your active recall, and break down challenging college coursework. Select any subject topic above, and let me know what part you'd like to explore!`,
    },
  ]);

  const currentTopic = state.topics.find((t) => t.id === selectedTopicId);
  const currentSubject = state.subjects.find((s) => s.id === currentTopic?.subjectId);

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
        {
          topicTitle: currentTopic?.title,
          subjectName: currentSubject?.name,
          currentMastery: currentTopic?.masteryLevel,
        },
        mode,
        state.profile.apiKey
      );

      setMessages([...newMessages, { role: 'assistant', content: response.reply }]);
    } catch (err: any) {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: `Sorry, an error occurred while connecting to the AI tutor: ${err.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (promptType: 'quiz' | 'socratic' | 'analogy') => {
    if (!currentTopic) return;
    if (promptType === 'quiz') {
      setMode('quiz');
      handleSend(`Give me a challenging conceptual problem or scenario question to test my understanding of "${currentTopic.title}". Don't reveal the answer yet.`);
    } else if (promptType === 'socratic') {
      setMode('socratic');
      handleSend(`Ask me a Socratic probing question about the core mechanism behind "${currentTopic.title}" to test if I truly understand how it works.`);
    } else {
      setMode('explain');
      handleSend(`Explain "${currentTopic.title}" using a concrete real-world analogy and first principles.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">
            Academic & Conceptual Coaching
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400" />
            <span>Socratic AI Tutor</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Guides through questioning rather than spoon-feeding answers. Adheres to your active syllabus.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
          {(['socratic', 'explain', 'quiz', 'breakdown'] as TutorMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                mode === m
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Topic Context Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <label className="text-[10px] uppercase font-bold text-slate-400 block">
              Active Topic Context
            </label>
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white max-w-md w-full focus:outline-none focus:ring-1 focus:ring-indigo-500 truncate"
            >
              {state.topics.map((t) => {
                const sub = state.subjects.find((s) => s.id === t.subjectId);
                return (
                  <option key={t.id} value={t.id}>
                    [{sub?.code || 'Subject'}] {t.title} ({t.masteryLevel}% mastery)
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {currentTopic && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onAddTopicToMission(currentTopic)}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add to Today's Mission</span>
            </button>
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 text-[11px] shrink-0 font-medium">Quick Prompts:</span>
        <button
          onClick={() => handleQuickPrompt('socratic')}
          className="px-3 py-1 bg-slate-800/80 hover:bg-slate-700 text-indigo-300 rounded-lg border border-indigo-900/40 whitespace-nowrap cursor-pointer"
        >
          💡 Test My Mental Model
        </button>
        <button
          onClick={() => handleQuickPrompt('quiz')}
          className="px-3 py-1 bg-slate-800/80 hover:bg-slate-700 text-amber-300 rounded-lg border border-amber-900/40 whitespace-nowrap cursor-pointer"
        >
          🎯 Challenge Question
        </button>
        <button
          onClick={() => handleQuickPrompt('analogy')}
          className="px-3 py-1 bg-slate-800/80 hover:bg-slate-700 text-emerald-300 rounded-lg border border-emerald-900/40 whitespace-nowrap cursor-pointer"
        >
          🧩 Real-World Analogy
        </button>
      </div>

      {/* Chat Messages Container */}
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
            <span className="animate-pulse font-medium">Formulating Socratic guidance...</span>
          </div>
        )}
      </div>

      {/* Input Form */}
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
          placeholder={`Ask about ${currentTopic?.title || 'a concept'}, or respond to the prompt...`}
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
    </div>
  );
};
