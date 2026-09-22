import React, { useState } from 'react';
import { 
  GitBranch, 
  Lock, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Plus, 
  Bot, 
  BookOpen, 
  AlertCircle,
  Play,
  Check
} from 'lucide-react';
import { ActiveTab, AppState, RoadmapTopic, TopicStatus } from '../types';
import { evaluatePrerequisites } from '../services/scheduler';
import { generateSubjectRoadmap } from '../services/ai';

interface RoadmapModuleProps {
  state: AppState;
  setActiveTab: (tab: ActiveTab) => void;
  onSaveTopic: (topic: RoadmapTopic) => void;
  onUpdateTopicMastery: (topicId: string, mastery: number, status?: TopicStatus) => void;
  onSelectTopicForTutor: (topic: RoadmapTopic) => void;
  onAddTopicToDailyMission: (topic: RoadmapTopic) => void;
}

export const RoadmapModule: React.FC<RoadmapModuleProps> = ({
  state,
  setActiveTab,
  onSaveTopic,
  onUpdateTopicMastery,
  onSelectTopicForTutor,
  onAddTopicToDailyMission,
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    state.subjects[0]?.id || ''
  );
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [isAddingTopic, setIsAddingTopic] = useState<boolean>(false);

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newMinutes, setNewMinutes] = useState(60);
  const [selectedPrereqIds, setSelectedPrereqIds] = useState<string[]>([]);

  const selectedSubject = state.subjects.find((s) => s.id === selectedSubjectId);
  const subjectTopics = state.topics
    .filter((t) => t.subjectId === selectedSubjectId)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const handleCreateTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !selectedSubjectId) return;

    const newTopic: RoadmapTopic = {
      id: `top-${Date.now()}`,
      subjectId: selectedSubjectId,
      title: newTitle.trim(),
      description: newDescription.trim() || 'Core module subject topic.',
      estimatedMinutes: Number(newMinutes) || 45,
      prerequisiteTopicIds: selectedPrereqIds,
      status: selectedPrereqIds.length === 0 ? 'ready' : 'locked',
      masteryLevel: 0,
      orderIndex: subjectTopics.length + 1,
    };

    onSaveTopic(newTopic);
    setNewTitle('');
    setNewDescription('');
    setSelectedPrereqIds([]);
    setIsAddingTopic(false);
  };

  const handleAIGenerateRoadmap = async () => {
    if (!selectedSubject) return;
    setIsGeneratingAI(true);

    try {
      const res = await generateSubjectRoadmap(
        selectedSubject.name,
        selectedSubject.code,
        selectedSubject.syllabusOverview,
        state.profile.apiKey
      );

      const createdTopics: RoadmapTopic[] = [];
      const idMap: string[] = [];

      res.topics.forEach((t, idx) => {
        const topicId = `top-ai-${Date.now()}-${idx}`;
        idMap[idx] = topicId;

        // map prerequisiteIndices to IDs
        const prereqIds = (t.prerequisiteIndices || [])
          .map((i) => idMap[i])
          .filter(Boolean);

        const topicObj: RoadmapTopic = {
          id: topicId,
          subjectId: selectedSubject.id,
          title: t.title,
          description: t.description,
          estimatedMinutes: t.estimatedMinutes || 45,
          prerequisiteTopicIds: prereqIds,
          status: prereqIds.length === 0 ? 'ready' : 'locked',
          masteryLevel: 0,
          orderIndex: subjectTopics.length + idx + 1,
        };

        onSaveTopic(topicObj);
      });
    } catch (err) {
      console.error('Roadmap AI generation error:', err);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1">
            Learning Roadmaps & Directed Dependency Graph
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Subject Learning Roadmaps</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Topic modules are interconnected with prerequisite DAG dependencies. Topics unlock when foundational concepts are mastered.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAIGenerateRoadmap}
            disabled={isGeneratingAI || !selectedSubject}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/50 rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isGeneratingAI ? 'Generating Syllabus...' : 'AI Syllabus Generator'}</span>
          </button>

          <button
            onClick={() => setIsAddingTopic(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Topic</span>
          </button>
        </div>
      </div>

      {/* Subject Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {state.subjects.map((sub) => {
          const isSelected = sub.id === selectedSubjectId;
          const count = state.topics.filter((t) => t.subjectId === sub.id).length;

          return (
            <button
              key={sub.id}
              onClick={() => setSelectedSubjectId(sub.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-slate-800 text-white border-indigo-500 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sub.color }}></span>
              <span>{sub.code}: {sub.name}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Add Topic Form Modal */}
      {isAddingTopic && (
        <form onSubmit={handleCreateTopic} className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white">
              Add Topic to {selectedSubject?.code || 'Subject'}
            </h3>
            <button type="button" onClick={() => setIsAddingTopic(false)} className="text-xs text-slate-400 hover:text-white">
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Topic Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Memory Management & Paging"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
                required
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Estimated Focus Study Time (Minutes)</label>
              <input
                type="number"
                min={15}
                max={180}
                step={5}
                value={newMinutes}
                onChange={(e) => setNewMinutes(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-slate-400 block mb-1">Learning Outcomes & Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What core mechanisms or problem sets will be mastered?"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-slate-100 h-20 resize-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-slate-400 block mb-1">
                Prerequisites in this Subject (DAG Dependencies)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-800/40 rounded-xl border border-slate-800">
                {subjectTopics.map((top) => (
                  <label key={top.id} className="flex items-center gap-2 text-slate-300 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPrereqIds.includes(top.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPrereqIds([...selectedPrereqIds, top.id]);
                        } else {
                          setSelectedPrereqIds(selectedPrereqIds.filter((id) => id !== top.id));
                        }
                      }}
                      className="accent-indigo-500"
                    />
                    <span className="truncate">{top.title}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddingTopic(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs"
            >
              Save Topic
            </button>
          </div>
        </form>
      )}

      {/* Topics List & DAG Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              {selectedSubject?.name || 'Curriculum'} Roadmap
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            {subjectTopics.filter((t) => t.status === 'completed').length}/{subjectTopics.length} Completed
          </span>
        </div>

        {subjectTopics.length === 0 ? (
          <div className="text-center py-12 space-y-3 text-slate-400 text-xs">
            <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
            <div>No roadmap topics configured for this subject yet.</div>
            <p className="max-w-sm mx-auto text-[11px]">
              Click <strong>"AI Syllabus Generator"</strong> to automatically generate standard modular prerequisite topics, or create your own.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {subjectTopics.map((topic, index) => {
              const evalPrereqs = evaluatePrerequisites(topic, state.topics);
              const isReady = evalPrereqs.prerequisitesMet;
              const isCompleted = topic.status === 'completed';

              return (
                <div
                  key={topic.id}
                  id={`roadmap-topic-${topic.id}`}
                  className={`border rounded-2xl p-5 transition-all ${
                    isCompleted
                      ? 'bg-slate-900/60 border-emerald-900/40'
                      : !isReady
                      ? 'bg-slate-900/40 border-slate-800/80 opacity-75'
                      : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Topic Left Content */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-slate-400">
                          #{index + 1}
                        </span>

                        {isCompleted ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Mastered ({topic.masteryLevel}%)</span>
                          </span>
                        ) : !isReady ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
                            <Lock className="w-3 h-3" />
                            <span>Prerequisites Pending</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                            Ready to Study
                          </span>
                        )}

                        <span className="text-xs text-slate-400 font-mono">
                          ~{topic.estimatedMinutes}m est.
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white">
                        {topic.title}
                      </h3>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {topic.description}
                      </p>

                      {/* Missing Prereq Warnings */}
                      {!isReady && evalPrereqs.missingPrereqs.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-950/30 px-3 py-1.5 rounded-lg border border-amber-900/40">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Complete prerequisites first: {evalPrereqs.missingPrereqs.map((p) => p.title).join(', ')}</span>
                        </div>
                      )}
                    </div>

                    {/* Topic Actions & Mastery Slider */}
                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            onSelectTopicForTutor(topic);
                            setActiveTab('tutor');
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          <Bot className="w-3.5 h-3.5" />
                          <span>AI Tutor</span>
                        </button>

                        <button
                          onClick={() => onAddTopicToDailyMission(topic)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium cursor-pointer"
                          title="Add to today's mission"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Mission</span>
                        </button>
                      </div>

                      {/* Mastery Adjustment Slider */}
                      <div className="w-48 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Mastery</span>
                          <span className="font-mono font-bold text-slate-200">{topic.masteryLevel}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={topic.masteryLevel}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const newStatus: TopicStatus = val >= 80 ? 'completed' : val > 0 ? 'in_progress' : isReady ? 'ready' : 'locked';
                            onUpdateTopicMastery(topic.id, val, newStatus);
                          }}
                          className="w-full accent-indigo-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
