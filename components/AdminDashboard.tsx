
import React, { useState, useEffect } from 'react';
import { User, Annotation, TaskAssignment, Task, UserRole, Project, ProjectAssignment, DecisionStatus, Language } from '../types';
import { t } from '../services/i18n';


interface AdminDashboardProps {
  activeTab: 'users' | 'tasks' | 'annotations' | 'projects';
  users: User[];
  allAnnotations: Annotation[];
  assignments: TaskAssignment[];
  projectAssignments: ProjectAssignment[];
  tasks: Task[];
  projects: Project[];
  onAddUser: (user: User) => void;
  onDeleteUser: (email: string) => void;
  onUpdateRole: (email: string, role: UserRole) => void;
  onAssignTask: (taskId: string, email: string) => void;
  onAssignProject: (projectId: string, email: string) => void;
  onRemoveProjectAssignment: (projectId: string, email: string) => void;
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  onDeleteAnnotation: (id: string) => void;
  onAddProject: (project: Project) => void;
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onDeleteProject: (id: string) => void;
  onAddTask: (task: Task) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onInspectProject: (projectId: string) => void;
  onExportProject: (projectId: string) => void;
  onImportProject: (file: File) => void;
  onClose: () => void;
  language: Language;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  activeTab,
  users,
  allAnnotations,
  assignments,
  projectAssignments,
  tasks,
  projects,
  onAddUser,
  onDeleteUser,
  onUpdateRole,
  onAssignTask,
  onAssignProject,
  onRemoveProjectAssignment,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onInspectProject,
  onExportProject,
  onImportProject,
  onClose,
  language
}) => {
  // User Management
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState<User>({ name: '', email: '', role: 'annotator', password: 'password123' });

  // Annotation Editing
  const [editingAnnoId, setEditingAnnoId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{
    comment: string;
    isImportant: boolean;
    isRelevant: DecisionStatus;
    relevantJustification: string;
    isSupported: DecisionStatus;
    supportedJustification: string;
  }>({
    comment: '',
    isImportant: false,
    isRelevant: 'na',
    relevantJustification: '',
    isSupported: 'na',
    supportedJustification: ''
  });

  // Project Management
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectForm, setProjectForm] = useState({ title: '', description: '' });
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');

  // Bulk Actions
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkProjectTarget, setBulkProjectTarget] = useState('');

  // Task Management
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState<{
    id: string;
    title: string;
    objective: string;
    description: string;
    projectId: string;
    paragraphs: string[];
    images: string[];
    audio: string[];
    question: string;
    category: string;
    gender: string;
  }>({ id: '', title: '', objective: '', description: '', projectId: '', paragraphs: [''], images: [''], audio: [''], question: '', category: '', gender: '' });

  // --- Handlers ---

  // Annotation
  const handleEditAnno = (anno: Annotation) => {
    setEditingAnnoId(anno.id);
    setEditFields({
      comment: anno.comment,
      isImportant: anno.isImportant,
      isRelevant: anno.isRelevant || 'na',
      relevantJustification: anno.relevantJustification || '',
      isSupported: anno.isSupported || 'na',
      supportedJustification: anno.supportedJustification || ''
    });
  };

  const saveAnnoEdit = () => {
    if (editingAnnoId) {
      onUpdateAnnotation(editingAnnoId, editFields);
      setEditingAnnoId(null);
    }
  };

  // User
  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUser.name && newUser.email) {
      onAddUser(newUser);
      setNewUser({ name: '', email: '', role: 'annotator', password: 'password123' });
      setIsAddingUser(false);
    }
  };

  // Project
  const openProjectModal = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setProjectForm({ title: project.title, description: project.description });
    } else {
      setEditingProject(null);
      setProjectForm({ title: '', description: '' });
    }
    setIsProjectModalOpen(true);
  };

  const saveProject = () => {
    if (!projectForm.title) return;
    if (editingProject) {
      onUpdateProject(editingProject.id, projectForm);
    } else {
      onAddProject({
        id: Math.random().toString(36).substr(2, 9),
        ...projectForm,
        createdAt: Date.now()
      });
    }
    setIsProjectModalOpen(false);
  };

  // Task
  const openTaskModal = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setTaskForm({
        id: task.id,
        title: task.title,
        objective: task.objective,
        description: task.description,
        projectId: task.projectId || '',
        paragraphs: task.text.split('\n\n'),
        images: task.images,
        audio: task.audio || [''],
        question: task.question || '',
        category: task.category || '',
        gender: task.gender || ''
      });
    } else {
      setEditingTask(null);
      setTaskForm({ id: '', title: '', objective: '', description: '', projectId: '', paragraphs: [''], images: [''], audio: [''], question: '', category: '', gender: '' });
    }
    setIsTaskModalOpen(true);
  };

  const saveTask = () => {
    const finalId = taskForm.id.trim() || `task-${Math.random().toString(36).substr(2, 6)}`;
    const finalTitle = taskForm.title || finalId;
    const finalObjective = taskForm.objective || taskForm.description.substring(0, 50);

    const compiledText = taskForm.paragraphs.join('\n\n');
    const taskData = {
      title: finalTitle,
      objective: finalObjective,
      description: taskForm.description,
      projectId: taskForm.projectId,
      text: compiledText,
      images: taskForm.images.filter(img => img.trim() !== ''),
      audio: taskForm.audio.filter(a => a.trim() !== ''),
      question: taskForm.question,
      category: taskForm.category as 'diet' | 'exercise' | undefined,
      gender: taskForm.gender as 'male' | 'female' | 'other' | undefined
    };

    if (editingTask) {
      onUpdateTask(editingTask.id, { ...taskData, id: finalId });
    } else {
      onAddTask({
        id: finalId,
        ...taskData
      });
    }
    setIsTaskModalOpen(false);
  };

  const updateParagraph = (idx: number, val: string) => {
    const newParas = [...taskForm.paragraphs];
    newParas[idx] = val;
    setTaskForm({ ...taskForm, paragraphs: newParas });
  };

  const addParagraph = () => {
    setTaskForm({ ...taskForm, paragraphs: [...taskForm.paragraphs, ''] });
  };

  const removeParagraph = (idx: number) => {
    const newParas = taskForm.paragraphs.filter((_, i) => i !== idx);
    setTaskForm({ ...taskForm, paragraphs: newParas });
  };

  const updateImage = (idx: number, val: string) => {
    const newImgs = [...taskForm.images];
    newImgs[idx] = val;
    setTaskForm({ ...taskForm, images: newImgs });
  };

  const addImage = () => {
    setTaskForm({ ...taskForm, images: [...taskForm.images, ''] });
  };

  const removeImage = (idx: number) => {
    const newImgs = taskForm.images.filter((_, i) => i !== idx);
    setTaskForm({ ...taskForm, images: newImgs });
  };

  const updateAudio = (idx: number, val: string) => {
    const newAudio = [...taskForm.audio];
    newAudio[idx] = val;
    setTaskForm({ ...taskForm, audio: newAudio });
  };

  const addAudio = () => {
    setTaskForm({ ...taskForm, audio: [...taskForm.audio, ''] });
  };

  const removeAudio = (idx: number) => {
    const newAudio = taskForm.audio.filter((_, i) => i !== idx);
    setTaskForm({ ...taskForm, audio: newAudio });
  };

  const handleBulkAssign = () => {
    if (!bulkProjectTarget || selectedTaskIds.length === 0) return;
    selectedTaskIds.forEach(taskId => {
      onUpdateTask(taskId, { projectId: bulkProjectTarget });
    });
    setSelectedTaskIds([]);
    setBulkProjectTarget('');
  };

  const handleBulkDelete = () => {
    if (selectedTaskIds.length === 0) return;
    if (confirm(`Delete ${selectedTaskIds.length} tasks?`)) {
      selectedTaskIds.forEach(id => onDeleteTask(id));
      setSelectedTaskIds([]);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-40">
      {/* Tab Sub-Header Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 italic tracking-tight">
            {activeTab === 'users' ? t('users_tab', language) :
              activeTab === 'tasks' ? t('tasks_tab', language) :
                activeTab === 'projects' ? t('projects_tab', language) : t('ground_truth', language)}
          </h2>
          <p className="text-slate-400 font-medium text-sm mt-1 uppercase tracking-widest">
            {activeTab === 'users' ? t('users_tab', language) :
              activeTab === 'tasks' ? t('tasks_tab', language) :
                activeTab === 'projects' ? t('projects_tab', language) : t('annotations_tab', language)}
          </p>
        </div>

        {activeTab === 'users' && (
          <button
            onClick={() => setIsAddingUser(!isAddingUser)}
            className="px-8 py-4 bg-slate-900 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center shadow-2xl shadow-slate-200 border-b-4 border-slate-700 active:scale-95"
          >
            <i className={`fa-solid ${isAddingUser ? 'fa-minus' : 'fa-plus'} mr-3 text-indigo-400`}></i>
            {isAddingUser ? t('discard', language) : t('add_user', language)}
          </button>
        )}

        {activeTab === 'projects' && (
          <button
            onClick={() => openProjectModal()}
            className="px-8 py-4 bg-slate-900 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center shadow-2xl shadow-slate-200 border-b-4 border-slate-700 active:scale-95"
          >
            <i className="fa-solid fa-plus mr-3 text-indigo-400"></i> {t('new_project', language)}
          </button>
        )}

        {activeTab === 'tasks' && (
          <button
            onClick={() => openTaskModal()}
            className="px-8 py-4 bg-slate-900 text-white rounded-[1.5rem] text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center shadow-2xl shadow-slate-200 border-b-4 border-slate-700 active:scale-95"
          >
            <i className="fa-solid fa-plus mr-3 text-indigo-400"></i> {t('new_task', language)}
          </button>
        )}
      </div>

      <div className="bg-white">
        {activeTab === 'users' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-4">
            {isAddingUser && (
              <form onSubmit={handleAddUserSubmit} className="bg-slate-50/50 p-10 rounded-[3rem] border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-8 animate-in slide-in-from-top-6 shadow-inner">
                <div className="md:col-span-4 border-b border-slate-100 pb-4">
                  <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest">{t('add_user', language)}</h4>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 text-indigo-600">{t('name', language)}</label>
                  <input type="text" required placeholder={t('name', language)} value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none text-sm font-bold shadow-sm focus:ring-4 focus:ring-indigo-50 transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 text-indigo-600">{t('email', language)}</label>
                  <input type="email" required placeholder={t('email', language)} value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none text-sm font-bold shadow-sm focus:ring-4 focus:ring-indigo-50 transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 text-indigo-600">{t('role', language)}</label>
                  <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })} className="w-full px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none text-sm font-black shadow-sm focus:ring-4 focus:ring-indigo-50 transition-all">
                    <option value="annotator">{t('annotator', language)}</option>
                    <option value="admin">{t('admin', language)}</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-xs font-black hover:bg-indigo-700 shadow-xl transition-all border-b-4 border-indigo-900 active:scale-95 uppercase tracking-[0.2em]">
                    {t('submit', language)}
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto rounded-[3.5rem] border border-slate-100 shadow-sm bg-white p-2">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  <tr>
                    <th className="py-6 px-12">{t('researcher_identity', language)}</th>
                    <th className="py-6 px-12">{t('authorization', language)}</th>
                    <th className="py-6 px-12 text-right">{t('security_ops', language)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map(user => (
                    <tr key={user.email} className="group hover:bg-slate-50/30 transition-all">
                      <td className="py-8 px-12">
                        <div className="flex items-center space-x-6">
                          <div className="w-16 h-16 rounded-[1.5rem] bg-slate-50 text-indigo-600 flex items-center justify-center font-black text-2xl border border-slate-100 shadow-inner group-hover:bg-white group-hover:scale-105 transition-all">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-xl italic leading-tight mb-1">{user.name}</p>
                            <p className="text-xs text-slate-400 font-bold tracking-tight">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-8 px-12">
                        <select
                          value={user.role}
                          onChange={(e) => onUpdateRole(user.email, e.target.value as UserRole)}
                          className={`text-[11px] font-black px-6 py-3 rounded-2xl border outline-none transition-all shadow-sm ${user.role === 'admin' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-white text-slate-700 border-slate-200'
                            }`}
                        >
                          <option value="annotator">{t('annotator', language)}</option>
                          <option value="admin">{t('admin', language)}</option>
                        </select>
                      </td>
                      <td className="py-8 px-12 text-right">
                        <button
                          onClick={() => onDeleteUser(user.email)}
                          className="w-14 h-14 bg-white border border-slate-100 text-red-300 hover:bg-red-500 hover:text-white rounded-[1.5rem] transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center mx-auto mr-0 shadow-sm hover:rotate-12"
                        >
                          <i className="fa-solid fa-user-slash text-lg"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-900 italic">{t('projects_tab', language)}</h3>
              <div className="flex space-x-4">
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        onImportProject(e.target.files[0]);
                        e.target.value = '';
                      }
                    }}
                  />
                  <button className="px-6 py-3 bg-white border border-slate-200 text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center shadow-sm">
                    <i className="fa-solid fa-file-import mr-2"></i>
                    {t('import_project', language)}
                  </button>
                </div>
                <button onClick={() => setIsProjectModalOpen(true)} className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200 flex items-center">
                  <i className="fa-solid fa-plus mr-2"></i>
                  {t('new_project', language)}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {projects.map(project => {
                const projectMembers = projectAssignments.filter(pa => pa.projectId === project.id).map(pa => users.find(u => u.email === pa.assignedToEmail)).filter(Boolean) as User[];
                return (
                  <div key={project.id} className="p-8 rounded-[3rem] border border-slate-100 bg-white flex flex-col md:flex-row justify-between items-start gap-8 group hover:border-indigo-200 transition-all shadow-sm hover:shadow-lg">
                    <div className="flex-1">
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 block">{t('research_id', language)}: {project.id}</span>
                      <h3 className="text-2xl font-black text-slate-900 italic mb-2">{project.title}</h3>
                      <p className="text-slate-500 font-medium text-sm mb-6">{project.description}</p>

                      {/* Project Members / Assignment */}
                      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 max-w-2xl">
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-[10px] font-black uppercase text-slate-400">{t('assigned_team', language)}</label>
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                onAssignProject(project.id, e.target.value);
                                e.target.value = ''; // reset 
                              }
                            }}
                            className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold outline-none hover:border-indigo-400 transition-colors"
                          >
                            <option value="">+ {t('add_user', language)}</option>
                            {users.filter(u => u.role === 'annotator' && !projectAssignments.some(pa => pa.projectId === project.id && pa.assignedToEmail === u.email)).map(u => (
                              <option key={u.email} value={u.email}>{u.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {projectMembers.length === 0 && <span className="text-xs text-slate-400 italic">{t('no_members', language)}</span>}
                          {projectMembers.map(member => (
                            <div key={member.email} className="flex items-center bg-white border border-slate-200 rounded-full px-3 py-1 shadow-sm">
                              <span className="text-xs font-bold text-slate-700 mr-2">{member.name}</span>
                              <button onClick={() => onRemoveProjectAssignment(project.id, member.email)} className="text-slate-300 hover:text-red-500 transition-colors">
                                <i className="fa-solid fa-times-circle"></i>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-400 mt-4 font-bold uppercase tracking-widest">
                        {t('tasks_tab', language)}: {tasks.filter(t => t.projectId === project.id).length}
                      </p>
                    </div>
                    <div className="flex space-x-4 shrink-0">
                      <button onClick={() => onInspectProject(project.id)} className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center border border-indigo-100 shadow-sm" title={t('inspect_project', language)}>
                        <i className="fa-solid fa-eye"></i>
                      </button>
                      <button onClick={() => onExportProject(project.id)} className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center border border-emerald-100 shadow-sm" title={t('export_project', language)}>
                        <i className="fa-solid fa-file-export"></i>
                      </button>
                      <button onClick={() => openProjectModal(project)} className="w-12 h-12 bg-slate-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center">
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button onClick={() => onDeleteProject(project.id)} className="w-12 h-12 bg-slate-50 text-red-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center">
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
              {projects.length === 0 && (
                <div className="text-center py-20 bg-slate-50 rounded-[3rem] border border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold">{t('no_projects', language)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4">
            {/* Project Filter */}
            <div className="flex justify-end">
              <select
                value={selectedProjectFilter}
                onChange={e => setSelectedProjectFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-2xl px-6 py-3 text-xs font-black uppercase tracking-widest shadow-sm outline-none hover:border-indigo-300 transition-all"
              >
                <option value="all">{t('all_projects', language)}</option>
                <option value="unassigned">{t('unassigned_tasks', language)}</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>

            {/* Bulk Actions Header */}
            {selectedTaskIds.length > 0 && (
              <div className="bg-indigo-600 text-white p-6 rounded-2xl flex items-center justify-between shadow-lg animate-in slide-in-from-top-2">
                <div className="flex items-center space-x-4">
                  <span className="font-black text-2xl">{selectedTaskIds.length}</span>
                  <span className="text-sm font-medium opacity-80 uppercase tracking-widest">{t('bulk_actions', language)}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <select
                    className="bg-indigo-800 text-white border-none rounded-xl px-4 py-2 font-bold outline-none cursor-pointer"
                    value={bulkProjectTarget}
                    onChange={(e) => setBulkProjectTarget(e.target.value)}
                  >
                    <option value="">{t('inspect_project', language)}...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                  <button onClick={handleBulkAssign} disabled={!bulkProjectTarget} className="px-6 py-2 bg-white text-indigo-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all disabled:opacity-50">
                    {t('assign_to_project', language)}
                  </button>
                  <div className="h-8 w-px bg-indigo-500 mx-4"></div>
                  <button onClick={handleBulkDelete} className="px-6 py-2 bg-red-500 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-600 transition-all">
                    {t('delete_selected', language)}
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-[3rem] border border-slate-100 shadow-sm bg-white p-2">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  <tr>
                    <th className="py-6 px-8 w-16 text-center">
                      <input
                        type="checkbox"
                        className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        onChange={(e) => {
                          if (e.target.checked) {
                            const allIds = tasks.filter(t => selectedProjectFilter === 'all' || (selectedProjectFilter === 'unassigned' ? !t.projectId : t.projectId === selectedProjectFilter)).map(t => t.id);
                            setSelectedTaskIds(allIds);
                          } else {
                            setSelectedTaskIds([]);
                          }
                        }}
                        checked={selectedTaskIds.length > 0 && selectedTaskIds.length === tasks.filter(t => selectedProjectFilter === 'all' || (selectedProjectFilter === 'unassigned' ? !t.projectId : t.projectId === selectedProjectFilter)).length}
                      />
                    </th>
                    <th className="py-6 px-8">{t('tasks_tab', language)}</th>
                    <th className="py-6 px-8">{t('project_title', language)}</th>
                    <th className="py-6 px-8">{t('assign_to_project', language)}</th>
                    <th className="py-6 px-8 text-right">{t('actions', language)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tasks.filter(t => {
                    if (selectedProjectFilter === 'all') return true;
                    if (selectedProjectFilter === 'unassigned') return !t.projectId;
                    return t.projectId === selectedProjectFilter;
                  }).map(task => {
                    const assignment = assignments.find(a => a.taskId === task.id);
                    const isSelected = selectedTaskIds.includes(task.id);
                    return (
                      <tr key={task.id} className={`group hover:bg-slate-50/50 transition-all ${isSelected ? 'bg-indigo-50/20' : ''}`}>
                        <td className="py-6 px-8 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedTaskIds([...selectedTaskIds, task.id]);
                              else setSelectedTaskIds(selectedTaskIds.filter(id => id !== task.id));
                            }}
                            className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="py-6 px-8 max-md">
                          <div className="flex items-center space-x-3 mb-1">
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{task.id}</span>
                          </div>
                          <p className="font-bold text-slate-900 text-lg leading-tight mb-1">{task.title}</p>
                          <p className="text-sm text-slate-400 line-clamp-1">{task.objective}</p>
                        </td>
                        <td className="py-6 px-8">
                          <span className={`inline-block text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${task.projectId ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            {task.projectId ? (projects.find(p => p.id === task.projectId)?.title || t('unknown_project', language)) : t('unassigned', language)}
                          </span>
                        </td>
                        <td className="py-6 px-8">
                          <select
                            value={assignment?.assignedToEmail || 'all'}
                            onChange={(e) => onAssignTask(task.id, e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl text-[11px] font-black px-3 py-2 outline-none hover:border-indigo-300 focus:border-indigo-500 transition-all min-w-[140px]"
                          >
                            <option value="all">{t('unassigned', language)}</option>
                            {users.filter(u => u.role === 'annotator').map(u => (
                              <option key={u.email} value={u.email}>{u.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-6 px-8 text-right">
                          <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => openTaskModal(task)} className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                              <i className="fa-solid fa-pen"></i>
                            </button>
                            <button onClick={() => onDeleteTask(task.id)} className="p-3 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'annotations' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-4">
            <div className="overflow-x-auto rounded-[4rem] border border-slate-100 shadow-sm bg-white p-2">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  <tr>
                    <th className="py-8 px-14">{t('annotations_tab', language)}</th>
                    <th className="py-8 px-14">{t('status_metrics', language)}</th>
                    <th className="py-8 px-14 text-right">{t('actions', language)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {allAnnotations.length === 0 ? (
                    <tr><td colSpan={3} className="py-60 text-center text-slate-300 text-3xl font-black italic opacity-20">{t('no_findings', language)}</td></tr>
                  ) : (
                    allAnnotations.sort((a, b) => b.timestamp - a.timestamp).map(anno => (
                      <tr key={anno.id} className="group hover:bg-slate-50/30 transition-all">
                        <td className="py-10 px-14 max-w-2xl">
                          <p className="font-black text-slate-900 text-2xl italic line-clamp-1 border-l-[12px] border-indigo-100 pl-8 mb-4 leading-none transition-all group-hover:border-indigo-600">"{anno.text}"</p>
                          <p className="text-sm text-slate-400 leading-relaxed font-bold pl-12 opacity-80">{anno.comment || 'No contextual documentation available.'}</p>
                        </td>
                        <td className="py-10 px-14">
                          <div className="space-y-4">
                            <div className="flex items-center space-x-4">
                              <span className={`w-5 h-5 rounded-full ${anno.isImportant ? 'bg-red-500 shadow-xl shadow-red-200 animate-pulse' : 'bg-slate-200'}`}></span>
                              <span className="text-[13px] font-black text-slate-800">{anno.userEmail}</span>
                            </div>
                            <div className="flex items-center space-x-3">
                              <span className="text-[11px] font-black uppercase bg-slate-50 text-indigo-600 px-4 py-1.5 rounded-full border border-slate-100">{anno.taskId}</span>
                              <span className={`text-[11px] font-black uppercase px-4 py-1.5 rounded-full border ${anno.type === 'ai' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                                }`}>
                                {anno.type}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {anno.isRelevant && (
                                <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-md border ${anno.isRelevant === 'yes' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                  anno.isRelevant === 'no' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                                  }`}>
                                  {t('is_relevant', language)}: {anno.isRelevant}
                                </span>
                              )}
                              {anno.isSupported && (
                                <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-md border ${anno.isSupported === 'yes' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                  anno.isSupported === 'no' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                                  }`}>
                                  {t('is_supported', language)}: {anno.isSupported}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-10 px-14 text-right">
                          <div className="flex justify-end space-x-4 opacity-0 group-hover:opacity-100 transition-all">
                            <button
                              onClick={() => handleEditAnno(anno)}
                              className="w-16 h-16 bg-white border border-slate-100 text-slate-700 hover:bg-indigo-600 hover:text-white rounded-[1.5rem] transition-all shadow-sm flex items-center justify-center active:scale-90"
                            >
                              <i className="fa-solid fa-pen-nib text-xl"></i>
                            </button>
                            <button
                              onClick={() => onDeleteAnnotation(anno.id)}
                              className="w-16 h-16 bg-white border border-slate-100 text-red-300 hover:bg-red-500 hover:text-white rounded-[1.5rem] transition-all shadow-sm flex items-center justify-center active:scale-90"
                            >
                              <i className="fa-solid fa-trash-can text-xl"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ANNOTATION EDIT MODAL */}
      {editingAnnoId && (
        <div className="fixed inset-0 z-[5000] bg-slate-900/60 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[4rem] shadow-[0_50px_100px_rgba(0,0,0,0.4)] p-14 space-y-12 animate-in zoom-in duration-300">
            <div className="space-y-6">
              <h3 className="text-3xl font-black text-slate-900 italic tracking-tight">{t('revised_findings', language)}</h3>

              <div className="grid grid-cols-2 gap-4">
                {(['isRelevant', 'isSupported'] as const).map(field => (
                  <div key={field} className="space-y-2">
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest">{field === 'isRelevant' ? t('is_relevant', language) : t('is_supported', language)}</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      {(['yes', 'no', 'na'] as DecisionStatus[]).map(status => (
                        <button
                          key={status}
                          onClick={() => setEditFields({ ...editFields, [field]: status })}
                          className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${editFields[field] === status ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('relevance_justification', language)}</label>
                  <textarea
                    className="w-full h-24 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-medium"
                    value={editFields.relevantJustification}
                    onChange={e => setEditFields({ ...editFields, relevantJustification: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('support_justification', language)}</label>
                  <textarea
                    className="w-full h-24 p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-medium"
                    value={editFields.supportedJustification}
                    onChange={e => setEditFields({ ...editFields, supportedJustification: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('comment_label', language)}</label>
                <textarea
                  className="w-full h-32 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm font-bold shadow-inner"
                  value={editFields.comment}
                  onChange={e => setEditFields({ ...editFields, comment: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <label className="text-xs font-black uppercase text-slate-600 tracking-widest">{t('important_escalation', language)}</label>
                <input
                  type="checkbox"
                  className="w-6 h-6 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={editFields.isImportant}
                  onChange={e => setEditFields({ ...editFields, isImportant: e.target.checked })}
                />
              </div>

              <div className="flex justify-end space-x-4">
                <button onClick={() => setEditingAnnoId(null)} className="px-8 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">{t('cancel', language)}</button>
                <button onClick={saveAnnoEdit} className="px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-2xl active:scale-95 border-b-4 border-slate-700">{t('commit_updates', language)}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PROJECT MODAL */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-[5000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl p-12 space-y-8 animate-in zoom-in duration-300">
            <h3 className="text-3xl font-black text-slate-900 italic tracking-tight">{editingProject ? t('edit_project', language) : t('new_project', language)}</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">{t('project_title', language)}</label>
                <input type="text" value={projectForm.title} onChange={e => setProjectForm({ ...projectForm, title: e.target.value })} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold shadow-inner" placeholder={t('project_title', language)} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">{t('project_description', language)}</label>
                <textarea value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-medium shadow-inner h-32" placeholder={t('project_description', language)} />
              </div>
            </div>
            <div className="flex justify-end space-x-4 pt-4">
              <button onClick={() => setIsProjectModalOpen(false)} className="px-8 py-4 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all font-bold">{t('cancel', language)}</button>
              <button onClick={saveProject} className="px-10 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl active:scale-95 border-b-4 border-indigo-900">{t('confirm_save', language)}</button>
            </div>
          </div>
        </div>
      )}

      {/* TASK MODAL */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-[5000] bg-slate-900/60 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl p-10 space-y-8 overflow-y-auto max-h-[90vh]">
            <h3 className="text-3xl font-black text-slate-900">{editingTask ? t('edit_task', language) : t('new_task', language)}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 mb-2">{t('research_id', language)}</label>
                  <input
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 font-bold font-mono text-indigo-600"
                    value={taskForm.id}
                    onChange={e => setTaskForm({ ...taskForm, id: e.target.value })}
                    placeholder="e.g. TASK-001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 mb-2">{t('category', language)}</label>
                  <select
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 font-bold"
                    value={taskForm.category}
                    onChange={e => setTaskForm({ ...taskForm, category: e.target.value })}
                  >
                    <option value="">-- {t('category', language)} --</option>
                    <option value="diet">Diet</option>
                    <option value="exercise">Exercise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 mb-2">{t('gender_label', language)}</label>
                  <select
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 font-bold"
                    value={taskForm.gender}
                    onChange={e => setTaskForm({ ...taskForm, gender: e.target.value })}
                  >
                    <option value="">-- {t('gender_label', language)} --</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 mb-2">{t('project_title', language)}</label>
                  <select className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 font-bold" value={taskForm.projectId} onChange={e => setTaskForm({ ...taskForm, projectId: e.target.value })}>
                    <option value="">-- {t('unassigned', language)} --</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 mb-2">{t('question_label', language)}</label>
                  <input
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 font-bold text-sm"
                    value={taskForm.question}
                    onChange={e => setTaskForm({ ...taskForm, question: e.target.value })}
                    placeholder={t('question_label', language)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase text-slate-400 mb-2">{t('profile_info', language)}</label>
                  <textarea className="w-full p-4 h-32 bg-slate-50 rounded-2xl border border-slate-200 font-medium" value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} />
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-black uppercase text-slate-400">{t('content_paragraphs', language)}</label>
                    <button onClick={addParagraph} className="text-xs font-black text-indigo-600">+ Add</button>
                  </div>
                  <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                    {taskForm.paragraphs.map((p, idx) => (
                      <div key={idx} className="flex gap-2">
                        <textarea className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-medium resize-none" rows={3} value={p} onChange={e => updateParagraph(idx, e.target.value)} />
                        <button onClick={() => removeParagraph(idx)} className="text-red-400 hover:text-red-600"><i className="fa-solid fa-times"></i></button>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-black uppercase text-slate-400">{t('images_urls', language)}</label>
                    <button onClick={addImage} className="text-xs font-black text-indigo-600">+ Add</button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {taskForm.images.map((img, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input className="w-full p-2 bg-slate-50 rounded-xl border border-slate-100 text-xs" value={img} onChange={e => updateImage(idx, e.target.value)} placeholder="https://..." />
                        <button onClick={() => removeImage(idx)} className="text-red-400 hover:text-red-600"><i className="fa-solid fa-times"></i></button>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-black uppercase text-slate-400">{t('audio_urls', language)}</label>
                    <button onClick={addAudio} className="text-xs font-black text-indigo-600">+ Add</button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {taskForm.audio.map((aud, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input className="w-full p-2 bg-slate-50 rounded-xl border border-slate-100 text-xs" value={aud} onChange={e => updateAudio(idx, e.target.value)} placeholder="https://..." />
                        <button onClick={() => removeAudio(idx)} className="text-red-400 hover:text-red-600"><i className="fa-solid fa-times"></i></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-4 pt-4 border-t border-slate-100">
              <button onClick={() => setIsTaskModalOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black text-slate-500">{t('cancel', language)}</button>
              <button onClick={saveTask} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black">{t('confirm_save', language)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
