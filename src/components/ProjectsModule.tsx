import React, { useState } from 'react';
import { 
  FolderGit2, 
  Plus, 
  ExternalLink, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  Calendar, 
  Layers, 
  Code2, 
  Terminal, 
  Cpu, 
  Database,
  ArrowRight
} from 'lucide-react';
import { AppState, ProjectItem } from '../types';
import { dataService } from '../services/dataService';

interface ProjectsModuleProps {
  state: AppState;
  showToast: (msg: string) => void;
}

export const ProjectsModule: React.FC<ProjectsModuleProps> = ({
  state,
  showToast,
}) => {
  const projects = state.projects || [];
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New project form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'systems' | 'web' | 'ai' | 'tool' | 'academic'>('systems');
  const [techStackInput, setTechStackInput] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [relatedSubjectId, setRelatedSubjectId] = useState<string>(state.subjects[0]?.id || '');
  const [milestonesInput, setMilestonesInput] = useState('');

  const filteredProjects = projects.filter((p) => {
    if (filterCategory === 'all') return true;
    return p.category === filterCategory;
  });

  const handleToggleMilestone = (projectId: string, milestoneId: string) => {
    try {
      dataService.toggleProjectMilestone(projectId, milestoneId);
      showToast('Milestone updated');
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleDeleteProject = (projectId: string) => {
    try {
      dataService.deleteProject(projectId);
      showToast('Project removed');
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('Project title is required');
      return;
    }

    const techStack = techStackInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const milestones = milestonesInput
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((mTitle, idx) => ({
        id: `m-${Date.now()}-${idx}`,
        title: mTitle,
        completed: false,
      }));

    const newProject: ProjectItem = {
      id: `proj-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      category,
      status: 'planned',
      techStack,
      githubUrl: githubUrl.trim() || undefined,
      milestones,
      relatedSubjectId: relatedSubjectId || undefined,
      createdAt: new Date().toISOString(),
    };

    try {
      dataService.saveProject(newProject);
      showToast(`Created project "${newProject.title}"`);
      setIsAddModalOpen(false);
      // Reset form
      setTitle('');
      setDescription('');
      setTechStackInput('');
      setGithubUrl('');
      setMilestonesInput('');
    } catch (err: any) {
      showToast(`Error saving project: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E7EB]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#5865D8] font-semibold">
              Engineering Portfolio
            </span>
          </div>
          <h1 className="text-xl font-bold text-[#242938] tracking-tight">
            Systems & Applied Projects
          </h1>
          <p className="text-xs text-[#667085] mt-1">
            Track substantial engineering builds connected directly to your academic coursework and distributed systems goals.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Project</span>
        </button>
      </div>

      {/* Category Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'all', label: 'All Projects' },
          { id: 'systems', label: 'Systems & OS' },
          { id: 'ai', label: 'AI & Data' },
          { id: 'web', label: 'Full-Stack' },
          { id: 'academic', label: 'Coursework Lab' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterCategory(f.id)}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer text-xs ${
              filterCategory === f.id
                ? 'bg-[#EEF0FF] text-[#5865D8] font-semibold border border-[#5865D8]/30 shadow-xs'
                : 'text-[#667085] hover:text-[#242938] hover:bg-white border border-transparent'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="p-12 text-center border border-[#E5E7EB] rounded-xl bg-white space-y-3 shadow-xs">
          <FolderGit2 className="w-8 h-8 text-[#667085] mx-auto" />
          <h3 className="text-sm font-semibold text-[#242938]">No projects in this category</h3>
          <p className="text-xs text-[#667085] max-w-sm mx-auto">
            Add a systems or applied engineering project to bridge theoretical coursework with real code.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-1.5 bg-[#5865D8] hover:bg-[#4854C4] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add First Project</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredProjects.map((project) => {
            const completedCount = project.milestones.filter((m) => m.completed).length;
            const totalMilestones = project.milestones.length;
            const progressPercent = totalMilestones > 0 ? Math.round((completedCount / totalMilestones) * 100) : 0;
            const relatedSubject = state.subjects.find((s) => s.id === project.relatedSubjectId);

            return (
              <div
                key={project.id}
                className="p-5 rounded-xl border border-[#E5E7EB] bg-white flex flex-col justify-between space-y-4 hover:border-[#5865D8]/40 transition-colors shadow-xs"
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                          project.status === 'completed'
                            ? 'bg-[#ECFDF5] text-[#16845B] border-[#A7F3D0]'
                            : project.status === 'in_progress'
                            ? 'bg-[#EEF0FF] text-[#5865D8] border-[#5865D8]/30 font-semibold'
                            : 'bg-[#F5F6FA] text-[#667085] border-[#E5E7EB]'
                        }`}>
                          {project.status === 'in_progress' ? 'In Progress' : project.status}
                        </span>
                        {relatedSubject && (
                          <span 
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB]"
                            style={{ borderLeftColor: relatedSubject.color, borderLeftWidth: '3px' }}
                          >
                            {relatedSubject.code}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-[#242938]">
                        {project.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1">
                      {project.githubUrl && (
                        <a
                          href={project.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 text-[#667085] hover:text-[#242938] hover:bg-[#F5F6FA] rounded-md transition-colors"
                          title="Open Repository"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteProject(project.id)}
                        className="p-1.5 text-[#667085] hover:text-[#C43D4B] hover:bg-[#FEF2F2] rounded-md transition-colors cursor-pointer"
                        title="Delete Project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-[#667085] leading-relaxed">
                    {project.description}
                  </p>

                  {/* Tech stack */}
                  {project.techStack.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {project.techStack.map((tech, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F5F6FA] text-[#242938] border border-[#E5E7EB]"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Milestones checklist */}
                  {project.milestones.length > 0 && (
                    <div className="pt-2 border-t border-[#E5E7EB] space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-[#667085]">
                        <span className="font-medium text-[#242938]">Milestones</span>
                        <span className="font-mono">{completedCount}/{totalMilestones} ({progressPercent}%)</span>
                      </div>
                      <div className="space-y-1.5">
                        {project.milestones.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => handleToggleMilestone(project.id, m.id)}
                            className="w-full flex items-start gap-2 text-left p-1.5 rounded hover:bg-[#F5F6FA] transition-colors cursor-pointer group text-xs"
                          >
                            {m.completed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#16845B] shrink-0 mt-0.5" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-[#9CA3AF] group-hover:text-[#667085] shrink-0 mt-0.5" />
                            )}
                            <span className={`text-xs ${m.completed ? 'line-through text-[#9CA3AF]' : 'text-[#242938]'}`}>
                              {m.title}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {project.targetCompletionDate && (
                  <div className="text-[11px] text-[#667085] flex items-center gap-1 font-mono pt-1 border-t border-[#E5E7EB]/60">
                    <Calendar className="w-3 h-3 text-[#5865D8]" />
                    <span>Target: {project.targetCompletionDate}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Project Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
              <h2 className="text-sm font-bold text-[#242938]">
                Create Engineering Project
              </h2>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#667085] hover:text-[#242938] text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#242938] mb-1 font-medium">Project Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Consensus Engine (Raft)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-lg text-[#242938] placeholder-[#9CA3AF] focus:outline-none focus:border-[#5865D8] focus:ring-1 focus:ring-[#5865D8]"
                />
              </div>

              <div>
                <label className="block text-[#242938] mb-1 font-medium">Description</label>
                <textarea
                  rows={2}
                  placeholder="What systems concepts does this implement?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-lg text-[#242938] placeholder-[#9CA3AF] focus:outline-none focus:border-[#5865D8] focus:ring-1 focus:ring-[#5865D8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#242938] mb-1 font-medium">Domain</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-lg text-[#242938] focus:outline-none focus:border-[#5865D8]"
                  >
                    <option value="systems">Systems & OS</option>
                    <option value="ai">AI & Data</option>
                    <option value="web">Full-Stack</option>
                    <option value="academic">Academic Lab</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#242938] mb-1 font-medium">Related Subject</label>
                  <select
                    value={relatedSubjectId}
                    onChange={(e) => setRelatedSubjectId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-lg text-[#242938] focus:outline-none focus:border-[#5865D8]"
                  >
                    <option value="">None</option>
                    {state.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code}: {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#242938] mb-1 font-medium">
                  Tech Stack (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. C++20, POSIX, CMake, Docker"
                  value={techStackInput}
                  onChange={(e) => setTechStackInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-lg text-[#242938] placeholder-[#9CA3AF] focus:outline-none focus:border-[#5865D8] focus:ring-1 focus:ring-[#5865D8]"
                />
              </div>

              <div>
                <label className="block text-[#242938] mb-1 font-medium">
                  GitHub Repository URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/username/repo"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-lg text-[#242938] placeholder-[#9CA3AF] focus:outline-none focus:border-[#5865D8] focus:ring-1 focus:ring-[#5865D8]"
                />
              </div>

              <div>
                <label className="block text-[#242938] mb-1 font-medium">
                  Milestones (one per line)
                </label>
                <textarea
                  rows={3}
                  placeholder={"Implement log replication RPC\nHandle leader election heartbeat\nWrite chaos network test"}
                  value={milestonesInput}
                  onChange={(e) => setMilestonesInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-lg text-[#242938] placeholder-[#9CA3AF] focus:outline-none focus:border-[#5865D8] font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 bg-[#F5F6FA] hover:bg-[#E5E7EB] text-[#242938] rounded-lg font-medium cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#5865D8] hover:bg-[#4854C4] text-white font-semibold rounded-lg cursor-pointer transition-colors shadow-xs"
                >
                  Save Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
