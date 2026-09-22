import React, { useState } from 'react';
import { 
  GitBranch, 
  Lock, 
  Unlock,
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Plus, 
  Bot, 
  BookOpen, 
  AlertCircle,
  Play,
  Check,
  Award,
  Terminal,
  Filter,
  AlertTriangle,
  X,
  Code2,
  Cpu,
  Database,
  BarChart2,
  Globe,
  Briefcase
} from 'lucide-react';
import { 
  ActiveTab, 
  AppState, 
  LearningCategory, 
  LearningDomainInfo,
  RoadmapTopic, 
  TopicStatus 
} from '../types';
import { 
  DEFAULT_LEARNING_DOMAINS,
  evaluatePrerequisites, 
  getDependents, 
  getPrerequisites,
  getReadyTopics,
  calculateTopicProgress,
  calculateRoadmapProgress,
  groupTopicsByStage,
  MASTERY_THRESHOLD_COMPLETED,
  MASTERY_THRESHOLD_PREREQ
} from '../services/learningEngine';
import { generateSubjectRoadmap } from '../services/ai';

interface RoadmapModuleProps {
  state: AppState;
  setActiveTab: (tab: ActiveTab) => void;
  onSaveTopic: (topic: RoadmapTopic) => void;
  onSaveTopics?: (topics: RoadmapTopic[]) => void;
  onUpdateTopicMastery: (topicId: string, mastery: number, status?: TopicStatus) => void;
  onOverrideTopicPrerequisites?: (topicId: string, override: boolean) => void;
  onSelectTopicForTutor: (topic: RoadmapTopic) => void;
  onAddTopicToDailyMission: (topic: RoadmapTopic) => void;
}

interface AIProposalTopic {
  title: string;
  description: string;
  estimatedMinutes: number;
  prerequisiteIndices: number[];
  selected: boolean;
}

export const RoadmapModule: React.FC<RoadmapModuleProps> = ({
  state,
  setActiveTab,
  onSaveTopic,
  onSaveTopics,
  onUpdateTopicMastery,
  onOverrideTopicPrerequisites,
  onSelectTopicForTutor,
  onAddTopicToDailyMission,
}) => {
  // Navigation & Filtering state
  const [selectedCategory, setSelectedCategory] = useState<LearningCategory | 'all'>('all');
  const [selectedDomainId, setSelectedDomainId] = useState<string>('sub-os');
  
  // Modals & Panels
  const [isAddingTopic, setIsAddingTopic] = useState<boolean>(false);
  const [inspectedTopic, setInspectedTopic] = useState<RoadmapTopic | null>(null);
  
  // AI Proposal state (strict proposal pattern: AI cannot directly alter roadmap)
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiProposal, setAiProposal] = useState<{
    subjectName: string;
    subjectCode: string;
    subjectId: string;
    topics: AIProposalTopic[];
  } | null>(null);

  // Form state for custom topic creation
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newMinutes, setNewMinutes] = useState(45);
  const [newStage, setNewStage] = useState('Foundations');
  const [newCategory, setNewCategory] = useState<LearningCategory>('academic');
  const [newDomain, setNewDomain] = useState('Operating Systems');
  const [selectedPrereqIds, setSelectedPrereqIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Derive domain list from state topics and default catalog
  const domainCatalog = DEFAULT_LEARNING_DOMAINS;

  // Filter domains by active category
  const filteredDomains = selectedCategory === 'all'
    ? domainCatalog
    : domainCatalog.filter((d) => d.category === selectedCategory);

  // Active domain info
  const activeDomain = domainCatalog.find((d) => d.id === selectedDomainId) || domainCatalog[0];

  // Topics belonging to active domain/subject
  const activeTopics = state.topics
    .filter((t) => {
      if (t.domain && activeDomain?.name) {
        return t.domain === activeDomain.name || t.subjectId === activeDomain.id;
      }
      return t.subjectId === selectedDomainId;
    })
    .sort((a, b) => a.orderIndex - b.orderIndex);

  // Group active topics by stages (e.g. Foundations, Core Architecture, Applied Systems, Advanced Topics)
  const stageGroups = groupTopicsByStage(activeTopics);

  // Aggregate roadmap progress for active domain
  const roadmapProgress = calculateRoadmapProgress(activeTopics, state.sessions);

  // Next up ready topics for active domain
  const nextReadyTopics = getReadyTopics(activeTopics);

  // Handle AI Syllabus Generation -> Opens Review Proposal Modal (does NOT directly mutate state)
  const handleAIGenerateRoadmap = async () => {
    const subject = state.subjects.find((s) => s.id === selectedDomainId) || {
      id: activeDomain.id,
      name: activeDomain.name,
      code: activeDomain.id.toUpperCase(),
      syllabusOverview: activeDomain.description,
    };

    setIsGeneratingAI(true);
    try {
      const res = await generateSubjectRoadmap(
        subject.name,
        subject.code,
        subject.syllabusOverview,
        state.profile.apiKey
      );

      setAiProposal({
        subjectName: subject.name,
        subjectCode: subject.code,
        subjectId: subject.id,
        topics: (res.topics || []).map((t) => ({
          title: t.title,
          description: t.description,
          estimatedMinutes: t.estimatedMinutes || 45,
          prerequisiteIndices: t.prerequisiteIndices || [],
          selected: true,
        })),
      });
    } catch (err) {
      console.error('AI Syllabus proposal error:', err);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Accept and commit AI Proposal after explicit student review
  const handleAcceptAIProposal = () => {
    if (!aiProposal) return;
    const selectedTopics = aiProposal.topics.filter((t) => t.selected);
    if (selectedTopics.length === 0) {
      setAiProposal(null);
      return;
    }

    const idMap: string[] = [];
    const timestamp = Date.now();
    const createdTopics: RoadmapTopic[] = selectedTopics.map((t, idx) => {
      const topicId = `top-ai-${timestamp}-${idx}`;
      idMap[idx] = topicId;

      const prereqIds = (t.prerequisiteIndices || [])
        .map((i) => idMap[i])
        .filter(Boolean);

      return {
        id: topicId,
        subjectId: aiProposal.subjectId,
        domain: aiProposal.subjectName,
        category: 'academic',
        stage: idx < 2 ? 'Foundations' : idx < 4 ? 'Core Architecture' : 'Applied Systems',
        title: t.title,
        description: t.description,
        estimatedMinutes: t.estimatedMinutes || 45,
        prerequisiteTopicIds: prereqIds,
        status: prereqIds.length === 0 ? 'ready' : 'locked',
        masteryLevel: 0,
        orderIndex: activeTopics.length + idx + 1,
      };
    });

    if (onSaveTopics) {
      onSaveTopics(createdTopics);
    } else {
      createdTopics.forEach((t) => onSaveTopic(t));
    }

    setAiProposal(null);
  };

  // Create custom topic
  const handleCreateTopic = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!newTitle.trim()) {
      setFormError('Topic title is required.');
      return;
    }

    const newTopic: RoadmapTopic = {
      id: `top-${Date.now()}`,
      subjectId: activeDomain.id,
      domain: activeDomain.name,
      category: newCategory,
      stage: newStage,
      title: newTitle.trim(),
      description: newDescription.trim() || 'Custom learning module topic.',
      estimatedMinutes: Number(newMinutes) || 45,
      prerequisiteTopicIds: selectedPrereqIds,
      status: selectedPrereqIds.length === 0 ? 'ready' : 'locked',
      masteryLevel: 0,
      orderIndex: activeTopics.length + 1,
    };

    try {
      onSaveTopic(newTopic);
      setNewTitle('');
      setNewDescription('');
      setSelectedPrereqIds([]);
      setIsAddingTopic(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save topic');
    }
  };

  // User override toggle
  const handleToggleOverride = (topic: RoadmapTopic) => {
    const newOverride = !topic.isUserOverride;
    if (onOverrideTopicPrerequisites) {
      onOverrideTopicPrerequisites(topic.id, newOverride);
    } else {
      onSaveTopic({
        ...topic,
        isUserOverride: newOverride,
        status: newOverride ? 'ready' : 'locked',
      });
    }

    if (inspectedTopic && inspectedTopic.id === topic.id) {
      setInspectedTopic({
        ...inspectedTopic,
        isUserOverride: newOverride,
        status: newOverride ? 'ready' : 'locked',
      });
    }
  };

  const getDomainIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Cpu': return <Cpu className="w-3.5 h-3.5" />;
      case 'Network': return <GitBranch className="w-3.5 h-3.5" />;
      case 'Database': return <Database className="w-3.5 h-3.5" />;
      case 'BarChart2': return <BarChart2 className="w-3.5 h-3.5" />;
      case 'Code2': return <Code2 className="w-3.5 h-3.5" />;
      case 'Terminal': return <Terminal className="w-3.5 h-3.5" />;
      case 'Globe': return <Globe className="w-3.5 h-3.5" />;
      case 'Briefcase': return <Briefcase className="w-3.5 h-3.5" />;
      default: return <BookOpen className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 mb-1 flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5" />
            <span>Deterministic Learning Roadmap Engine</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Prerequisite-Aware Curriculum & Skill Graphs
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Multi-domain learning paths governed by directed dependency graphs. Topics require 80% mastery of foundational concepts to automatically unlock.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            id="ai-generate-roadmap-btn"
            onClick={handleAIGenerateRoadmap}
            disabled={isGeneratingAI}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isGeneratingAI ? 'Generating Syllabus...' : 'AI Syllabus Proposal'}</span>
          </button>

          <button
            id="add-topic-btn"
            onClick={() => setIsAddingTopic(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Module</span>
          </button>
        </div>
      </div>

      {/* Category Tabs (Academic, Career, Project) */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <span className="text-xs font-medium text-slate-400 flex items-center gap-1 mr-2">
          <Filter className="w-3 h-3" />
          <span>Category:</span>
        </span>

        {[
          { id: 'all', label: 'All Curriculums' },
          { id: 'academic', label: 'Academic Curriculum' },
          { id: 'career', label: 'Career & Industry Skills' },
          { id: 'project', label: 'Project Learning' },
        ].map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              id={`cat-filter-${cat.id}`}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isSelected
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Learning Domain Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filteredDomains.map((dom) => {
          const isSelected = dom.id === selectedDomainId;
          const count = state.topics.filter(
            (t) => t.subjectId === dom.id || (t.domain && t.domain === dom.name)
          ).length;

          return (
            <button
              key={dom.id}
              id={`domain-pill-${dom.id}`}
              onClick={() => setSelectedDomainId(dom.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-slate-800 text-white border-indigo-500 shadow-sm ring-1 ring-indigo-500/30'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <span 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: dom.color || '#6366f1' }} 
              />
              <span className="flex items-center gap-1.5">
                {getDomainIcon(dom.iconName)}
                <span>{dom.name}</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Roadmap Metrics & Evidence Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Curriculum Completion
          </div>
          <div className="text-xl font-bold text-white flex items-baseline gap-1">
            <span>{roadmapProgress.completionPercentage}%</span>
            <span className="text-[10px] text-slate-400 font-normal">
              ({roadmapProgress.completedTopics}/{roadmapProgress.totalTopics})
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${roadmapProgress.completionPercentage}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
            <Play className="w-3 h-3" />
            <span>Ready to Study</span>
          </div>
          <div className="text-xl font-bold text-indigo-300">
            {roadmapProgress.readyTopics}
          </div>
          <div className="text-[10px] text-slate-400">
            Prerequisites cleared
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
            In Progress
          </div>
          <div className="text-xl font-bold text-amber-300">
            {roadmapProgress.inProgressTopics}
          </div>
          <div className="text-[10px] text-slate-400">
            Currently being studied
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span>Locked Modules</span>
          </div>
          <div className="text-xl font-bold text-slate-300">
            {roadmapProgress.lockedTopics}
          </div>
          <div className="text-[10px] text-slate-400">
            Require prerequisites
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <Award className="w-3 h-3" />
            <span>Mastered (&ge;80%)</span>
          </div>
          <div className="text-xl font-bold text-emerald-300">
            {roadmapProgress.completedTopics}
          </div>
          <div className="text-[10px] text-slate-400">
            Canonical mastery met
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[10px] font-semibold text-sky-400 uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Study Logged</span>
          </div>
          <div className="text-xl font-bold text-sky-300">
            {Math.round(roadmapProgress.totalTimeInvestedMinutes / 60)}h {roadmapProgress.totalTimeInvestedMinutes % 60}m
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
            <span title="Studied">📖 {roadmapProgress.evidenceBreakdown.studiedCount}</span>
            <span title="Practiced">⚡ {roadmapProgress.evidenceBreakdown.practicedCount}</span>
            <span title="Assessed">📝 {roadmapProgress.evidenceBreakdown.assessedCount}</span>
          </div>
        </div>
      </div>

      {/* Actionable "Next Up: Ready Topics" Highlight Section */}
      {nextReadyTopics.length > 0 && (
        <div className="bg-indigo-950/30 border border-indigo-800/40 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <h2 className="text-xs font-bold text-indigo-200 uppercase tracking-wider">
                Next Up: Feasible Modules Ready to Learn
              </h2>
            </div>
            <span className="text-[11px] text-indigo-300/80">
              {nextReadyTopics.length} unlocked for study
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {nextReadyTopics.slice(0, 3).map((topic) => (
              <div 
                key={topic.id}
                className="bg-slate-900/90 border border-indigo-900/40 hover:border-indigo-600/60 rounded-xl p-3.5 space-y-2.5 transition-all shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-indigo-400 font-bold">
                      {topic.stage || 'Foundations'}
                    </span>
                    <h3 className="text-sm font-bold text-white line-clamp-1">
                      {topic.title}
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                    ~{topic.estimatedMinutes}m
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {topic.description}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                  <div className="text-[10px] text-slate-400">
                    Mastery: <span className="font-mono text-slate-200 font-bold">{topic.masteryLevel}%</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onAddTopicToDailyMission(topic)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                      title="Add to today's mission"
                    >
                      + Mission
                    </button>
                    <button
                      onClick={() => {
                        onSelectTopicForTutor(topic);
                        setActiveTab('tutor');
                      }}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      AI Tutor
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Topics List by Stages */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-indigo-400" />
            <h2 className="text-base font-bold text-white">
              {activeDomain.name} Curriculum Graph
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
              {activeDomain.category}
            </span>
          </div>

          <span className="text-xs text-slate-400">
            {roadmapProgress.completedTopics}/{roadmapProgress.totalTopics} Mastered (&ge;80%)
          </span>
        </div>

        {activeTopics.length === 0 ? (
          <div className="text-center py-12 space-y-3 text-slate-400 text-xs">
            <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
            <div>No roadmap modules configured for this curriculum yet.</div>
            <p className="max-w-sm mx-auto text-[11px] text-slate-500">
              Click <strong>"AI Syllabus Proposal"</strong> to draft structured learning modules with prerequisite DAG dependencies, or add topics manually.
            </p>
          </div>
        ) : (
          Object.entries(stageGroups).map(([stageName, stageTopics]) => (
            <div key={stageName} className="space-y-3">
              {/* Stage Header */}
              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {stageName}
                </span>
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[10px] text-slate-500 font-mono">
                  {stageTopics.filter((t) => t.status === 'completed').length}/{stageTopics.length} Done
                </span>
              </div>

              {/* Stage Topic Cards */}
              <div className="space-y-3">
                {stageTopics.map((topic, index) => {
                  const evalPrereqs = evaluatePrerequisites(topic, state.topics);
                  const isReady = evalPrereqs.prerequisitesMet || topic.isUserOverride;
                  const isCompleted = topic.status === 'completed' || topic.masteryLevel >= MASTERY_THRESHOLD_COMPLETED;
                  const topicProgress = calculateTopicProgress(topic, state.sessions);
                  const prerequisites = getPrerequisites(topic.id, state.topics);
                  const dependents = getDependents(topic.id, state.topics);

                  return (
                    <div
                      key={topic.id}
                      id={`roadmap-topic-${topic.id}`}
                      className={`border rounded-2xl p-4 sm:p-5 transition-all ${
                        isCompleted
                          ? 'bg-slate-900/60 border-emerald-900/40 hover:border-emerald-800/60'
                          : !isReady
                          ? 'bg-slate-900/40 border-slate-800/80 opacity-80 hover:opacity-100 hover:border-slate-700'
                          : 'bg-slate-800/50 border-slate-700/80 hover:border-indigo-500/50'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        {/* Topic Info */}
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold text-slate-400">
                              #{topic.orderIndex || index + 1}
                            </span>

                            {/* Status Badges */}
                            {isCompleted ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Mastered ({topic.masteryLevel}%)</span>
                              </span>
                            ) : !isReady ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
                                <Lock className="w-3 h-3" />
                                <span>Locked: Prerequisites Incomplete</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                                <Play className="w-3 h-3 fill-current" />
                                <span>Ready to Learn</span>
                              </span>
                            )}

                            {topic.isUserOverride && !evalPrereqs.prerequisitesMet && (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-orange-950/80 text-orange-300 border border-orange-800/60">
                                <Unlock className="w-3 h-3" />
                                <span>Student Override Active</span>
                              </span>
                            )}

                            <span className="text-xs text-slate-400 font-mono">
                              ~{topic.estimatedMinutes}m est.
                            </span>

                            {/* Evidence Micro-Pills */}
                            <div className="flex items-center gap-1 ml-auto text-[10px] text-slate-400">
                              <span 
                                className={`px-1.5 py-0.5 rounded ${topicProgress.evidence.studied ? 'bg-indigo-950 text-indigo-300' : 'bg-slate-800 text-slate-500'}`}
                                title={topicProgress.evidence.studied ? 'Studied: focus session logged' : 'Not studied yet'}
                              >
                                Studied
                              </span>
                              <span 
                                className={`px-1.5 py-0.5 rounded ${topicProgress.evidence.practiced ? 'bg-blue-950 text-blue-300' : 'bg-slate-800 text-slate-500'}`}
                                title={topicProgress.evidence.practiced ? 'Practiced: applied problem sets or >= 30m duration' : 'Not practiced yet'}
                              >
                                Practiced
                              </span>
                              <span 
                                className={`px-1.5 py-0.5 rounded ${topicProgress.evidence.assessed ? 'bg-purple-950 text-purple-300' : 'bg-slate-800 text-slate-500'}`}
                                title={topicProgress.evidence.assessed ? 'Assessed: comprehension rating >= 3 logged' : 'Not assessed yet'}
                              >
                                Assessed
                              </span>
                            </div>
                          </div>

                          <h3 
                            onClick={() => setInspectedTopic(topic)}
                            className="text-base font-bold text-white hover:text-indigo-300 cursor-pointer transition-colors"
                          >
                            {topic.title}
                          </h3>

                          <p className="text-xs text-slate-300 leading-relaxed">
                            {topic.description}
                          </p>

                          {/* Prerequisites List & Missing Warnings */}
                          {prerequisites.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                              <span className="text-slate-400 font-medium">Prerequisites:</span>
                              {prerequisites.map((p) => {
                                const pDone = p.status === 'completed' || p.masteryLevel >= MASTERY_THRESHOLD_PREREQ;
                                return (
                                  <span
                                    key={p.id}
                                    className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] ${
                                      pDone
                                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                                        : 'bg-amber-950/40 text-amber-300 border-amber-800/40'
                                    }`}
                                  >
                                    {pDone ? <Check className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                                    <span>{p.title} ({p.masteryLevel}%)</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Missing Prereq Warning & Override Action */}
                          {!evalPrereqs.prerequisitesMet && (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-950/30 border border-amber-900/40 text-[11px] text-amber-300">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                                <span>
                                  Prerequisites incomplete: {evalPrereqs.missingPrereqs.map((p) => p.title).join(', ')}
                                </span>
                              </div>

                              <button
                                onClick={() => handleToggleOverride(topic)}
                                className="px-2.5 py-1 bg-amber-900/60 hover:bg-amber-800 text-amber-200 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap self-start sm:self-auto"
                              >
                                {topic.isUserOverride ? 'Restore Prereq Lock' : 'Start Learning Anyway (Override)'}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Topic Actions & Mastery Adjustment */}
                        <div className="flex flex-row lg:flex-col items-end justify-between lg:justify-start gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setInspectedTopic(topic)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                            >
                              Inspect
                            </button>

                            <button
                              onClick={() => {
                                onSelectTopicForTutor(topic);
                                setActiveTab('tutor');
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                            >
                              <Bot className="w-3.5 h-3.5" />
                              <span>AI Tutor</span>
                            </button>

                            <button
                              onClick={() => onAddTopicToDailyMission(topic)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                              title="Add to today's mission"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Mission</span>
                            </button>
                          </div>

                          {/* Mastery Slider */}
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
                                const newStatus: TopicStatus = val >= MASTERY_THRESHOLD_COMPLETED
                                  ? 'completed'
                                  : val > 0
                                  ? 'in_progress'
                                  : isReady
                                  ? 'ready'
                                  : 'locked';
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
            </div>
          ))
        )}
      </div>

      {/* AI Roadmap Proposal Review Modal */}
      {aiProposal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="text-[10px] uppercase font-bold text-indigo-400">
                  AI Proposal Review (Safe Import)
                </div>
                <h2 className="text-base font-bold text-white">
                  Proposed Curriculum for {aiProposal.subjectName} ({aiProposal.subjectCode})
                </h2>
              </div>
              <button 
                onClick={() => setAiProposal(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Review the proposed prerequisite modules below. Deselect any modules you do not wish to import. No changes are committed until you accept.
            </p>

            <div className="space-y-2.5 max-h-80 overflow-y-auto p-1 scrollbar-none">
              {aiProposal.topics.map((t, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border transition-all ${
                    t.selected
                      ? 'bg-slate-800/80 border-indigo-700/60'
                      : 'bg-slate-900/40 border-slate-800 opacity-60'
                  }`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={t.selected}
                      onChange={(e) => {
                        const updated = [...aiProposal.topics];
                        updated[idx].selected = e.target.checked;
                        setAiProposal({ ...aiProposal, topics: updated });
                      }}
                      className="mt-1 accent-indigo-500"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">
                          #{idx + 1} {t.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ~{t.estimatedMinutes}m
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        {t.description}
                      </p>
                      {t.prerequisiteIndices.length > 0 && (
                        <div className="text-[10px] text-indigo-400 font-medium">
                          Requires earlier modules: {t.prerequisiteIndices.map((i) => `#${i + 1}`).join(', ')}
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setAiProposal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium cursor-pointer"
              >
                Discard Proposal
              </button>
              <button
                onClick={handleAcceptAIProposal}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm cursor-pointer"
              >
                Accept & Commit Curriculum ({aiProposal.topics.filter((t) => t.selected).length} Modules)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topic Detail Inspection Modal */}
      {inspectedTopic && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-400">
                  {inspectedTopic.domain || 'Curriculum Module'} • {inspectedTopic.stage || 'Foundations'}
                </span>
                <h2 className="text-lg font-bold text-white">
                  {inspectedTopic.title}
                </h2>
              </div>
              <button 
                onClick={() => setInspectedTopic(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Description & Learning Outcomes</label>
                <p className="text-slate-200 leading-relaxed bg-slate-800/50 p-3 rounded-xl border border-slate-800">
                  {inspectedTopic.description}
                </p>
              </div>

              {inspectedTopic.notes && (
                <div>
                  <label className="text-slate-400 block mb-1 font-semibold">Student Notes & Reflection</label>
                  <p className="text-slate-300 leading-relaxed bg-slate-800/30 p-3 rounded-xl border border-slate-800/80">
                    {inspectedTopic.notes}
                  </p>
                </div>
              )}

              {/* Prerequisites & Downstream Dependents */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-300 block">
                    Prerequisites Required
                  </span>
                  {getPrerequisites(inspectedTopic.id, state.topics).length === 0 ? (
                    <span className="text-[11px] text-slate-500">None (Foundational topic)</span>
                  ) : (
                    <ul className="space-y-1 text-[11px]">
                      {getPrerequisites(inspectedTopic.id, state.topics).map((p) => (
                        <li key={p.id} className="flex items-center gap-1.5 text-slate-300">
                          {p.status === 'completed' || p.masteryLevel >= MASTERY_THRESHOLD_PREREQ ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Lock className="w-3 h-3 text-amber-400" />
                          )}
                          <span className="truncate">{p.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-300 block">
                    Unlocks Downstream
                  </span>
                  {getDependents(inspectedTopic.id, state.topics).length === 0 ? (
                    <span className="text-[11px] text-slate-500">No dependent topics</span>
                  ) : (
                    <ul className="space-y-1 text-[11px]">
                      {getDependents(inspectedTopic.id, state.topics).map((d) => (
                        <li key={d.id} className="flex items-center gap-1.5 text-slate-300">
                          <GitBranch className="w-3 h-3 text-indigo-400" />
                          <span className="truncate">{d.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Progress Detail */}
              {(() => {
                const detail = calculateTopicProgress(inspectedTopic, state.sessions);
                return (
                  <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Total Study Time Logged:</span>
                      <span className="font-mono text-white font-bold">{detail.totalTimeMinutes} minutes ({detail.sessionsCount} sessions)</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Avg Comprehension Rating:</span>
                      <span className="font-mono text-white font-bold">{detail.averageComprehension}/5.0</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Mastery Level:</span>
                      <span className="font-mono text-indigo-300 font-bold">{detail.masteryLevel}%</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <button
                onClick={() => handleToggleOverride(inspectedTopic)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 hover:bg-amber-950/40 border border-amber-800/40 cursor-pointer"
              >
                {inspectedTopic.isUserOverride ? 'Revoke Override' : 'Override Prerequisites'}
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onAddTopicToDailyMission(inspectedTopic);
                    setInspectedTopic(null);
                  }}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium cursor-pointer"
                >
                  Add to Mission
                </button>
                <button
                  onClick={() => {
                    onSelectTopicForTutor(inspectedTopic);
                    setActiveTab('tutor');
                    setInspectedTopic(null);
                  }}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Start Socratic Tutor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Topic Form Modal */}
      {isAddingTopic && (
        <form onSubmit={handleCreateTopic} className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white">
              Add Module to {activeDomain.name}
            </h3>
            <button type="button" onClick={() => setIsAddingTopic(false)} className="text-xs text-slate-400 hover:text-white cursor-pointer">
              Cancel
            </button>
          </div>

          {formError && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

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

            <div>
              <label className="text-slate-400 block mb-1">Curriculum Stage</label>
              <select
                value={newStage}
                onChange={(e) => setNewStage(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
              >
                <option value="Foundations">Foundations</option>
                <option value="Core Architecture">Core Architecture</option>
                <option value="Applied Systems">Applied Systems</option>
                <option value="Advanced Topics">Advanced Topics</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as LearningCategory)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100"
              >
                <option value="academic">Academic Curriculum</option>
                <option value="career">Career Skills</option>
                <option value="project">Project Learning</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-slate-400 block mb-1">Learning Outcomes & Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What core mechanisms, theorems, or problem sets will be mastered?"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-slate-100 h-20 resize-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-slate-400 block mb-1">
                Prerequisites in this Curriculum (DAG Dependencies)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-800/40 rounded-xl border border-slate-800">
                {activeTopics.map((top) => (
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
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs cursor-pointer"
            >
              Save Module
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
