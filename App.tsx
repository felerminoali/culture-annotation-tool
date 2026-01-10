
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Annotation, SelectionState, ImageAnnotation, ShapeType, DecisionStatus, User, TaskAssignment, UserRole, Project, Task, ProjectAssignment, Language } from './types';
import TextDisplay from './components/TextDisplay';
import AnnotationModal from './components/AnnotationModal';
import ImageAnnotationModal from './components/ImageAnnotationModal';
import ImageWithPinpoints from './components/ImageWithPinpoints';
import GuidelinesModal from './components/GuidelinesModal';
import ProfileModal from './components/ProfileModal';
import AdminDashboard from './components/AdminDashboard';
import { getSmartSuggestions, getTextToSpeech, decodeBase64, decodeAudioData } from './services/geminiService';
import { t, TranslationKey } from './services/i18n';



const App: React.FC = () => {
  // Auth & Navigation State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [viewMode, setViewMode] = useState<'workspace' | 'admin'>('workspace');
  const [adminTab, setAdminTab] = useState<'users' | 'tasks' | 'annotations' | 'projects'>('users');
  const [language, setLanguage] = useState<Language>('en');

  // Platform Resources
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [globalLog, setGlobalLog] = useState<Annotation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectAssignments, setProjectAssignments] = useState<ProjectAssignment[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'annotator' as UserRole
  });
  const [error, setError] = useState('');

  // Pagination & Completion State
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [showResubmitSuccess, setShowResubmitSuccess] = useState(false);

  // App Data State (Task Specific)
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [imageAnnotations, setImageAnnotations] = useState<Record<string, ImageAnnotation[]>>({});

  // UI Modal State
  const [currentSelection, setCurrentSelection] = useState<SelectionState | null>(null);
  const [isReviewingCompleted, setIsReviewingCompleted] = useState(false);
  const [editingTextAnnotation, setEditingTextAnnotation] = useState<Annotation | null>(null);
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState<number | null>(null);
  const [pendingPin, setPendingPin] = useState<{ x: number, y: number, width: number, height: number, shapeType: ShapeType } | null>(null);
  const [editingImageAnno, setEditingImageAnno] = useState<ImageAnnotation | null>(null);
  const [isGuidelinesModalOpen, setIsGuidelinesModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [adminProjectFilter, setAdminProjectFilter] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Audio State
  const [playingParaIdx, setPlayingParaIdx] = useState<number | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Filter TASKS based on assignment if not admin
  const visibleTasks = useMemo(() => {
    if (!currentUser) return [];

    // Admin Logic
    if (currentUser.role === 'admin') {
      if (adminProjectFilter) {
        return tasks.filter(t => t.projectId === adminProjectFilter);
      }
      return tasks;
    }

    // Normal User Logic
    return tasks.filter(task => {
      // 1. Direct task assignment (Overrides project)
      const assignment = assignments.find(a => a.taskId === task.id);
      if (assignment) {
        return assignment.assignedToEmail === 'all' || assignment.assignedToEmail === currentUser.email;
      }

      // 2. Project Assignment
      if (task.projectId) {
        return projectAssignments.some(pa => pa.projectId === task.projectId && pa.assignedToEmail === currentUser.email);
      }

      // 3. Fallback: Unassigned tasks are hidden for non-admins to ensure strict project mode
      return false;
    });
  }, [currentUser, assignments, tasks, projectAssignments, adminProjectFilter]);

  const allFilteredTasksCompleted = visibleTasks.length > 0 && visibleTasks.every(t => completedTaskIds.includes(t.id));

  const currentTask = visibleTasks[currentTaskIndex] || tasks[0];
  const isTaskSubmitted = currentTask ? completedTaskIds.includes(currentTask.id) : false;

  const paragraphs = useMemo(() => {
    if (!currentTask) return [];
    const result: { text: string; offset: number }[] = [];
    const splitRegex = /\n\s*\n/;
    let currentOffset = 0;

    // We split but keep track of where each piece starts
    const rawParts = currentTask.text.split(splitRegex);
    let searchStartIndex = 0;

    rawParts.forEach(part => {
      if (part.trim() !== "") {
        // Find actual index in original text to be precise (handles any whitespace variations)
        const index = currentTask.text.indexOf(part, searchStartIndex);
        if (index !== -1) {
          result.push({ text: part, offset: index });
          searchStartIndex = index + part.length;
        }
      }
    });

    return result;
  }, [currentTask]);

  const progressPercentage = useMemo(() => {
    if (visibleTasks.length === 0) return 0;
    return (completedTaskIds.length / visibleTasks.length) * 100;
  }, [completedTaskIds, visibleTasks]);

  // Flatten image annotations for sidebar list
  const flatImageAnnotations = useMemo(() => {
    return (Object.entries(imageAnnotations) as [string, ImageAnnotation[]][]).flatMap(([paraIdx, annos]) =>
      annos.map(a => ({ ...a, paraIdx: parseInt(paraIdx) }))
    );
  }, [imageAnnotations]);

  // Sync Global Resources
  useEffect(() => {
    const savedUsers = localStorage.getItem('annotate_users');
    if (savedUsers) setUsers(JSON.parse(savedUsers) as User[]);

    const savedAssignments = localStorage.getItem('annotate_assignments');
    if (savedAssignments) setAssignments(JSON.parse(savedAssignments) as TaskAssignment[]);

    const savedLog = localStorage.getItem('annotate_global_log');
    if (savedLog) setGlobalLog(JSON.parse(savedLog) as Annotation[]);

    const savedProjects = localStorage.getItem('annotate_projects');
    if (savedProjects) setProjects(JSON.parse(savedProjects) as Project[]);

    const savedTasks = localStorage.getItem('annotate_tasks');
    setTasks(savedTasks ? JSON.parse(savedTasks) as Task[] : []);

    const savedProjectAssignments = localStorage.getItem('annotate_project_assignments');
    if (savedProjectAssignments) setProjectAssignments(JSON.parse(savedProjectAssignments) as ProjectAssignment[]);

    const savedLang = localStorage.getItem('annotate_language') as Language;
    if (savedLang) setLanguage(savedLang);
  }, []);

  // Sync Task-specific Data
  useEffect(() => {
    if (isAuthenticated && currentUser && currentTask) {
      const storageKey = `annotate_data_${currentUser.email}`;
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData) as Record<string, any>;
          setCompletedTaskIds(parsed.completedTaskIds || []);

          const taskData = parsed[currentTask.id] || { annotations: [], imageAnnotations: {} };
          setAnnotations(taskData.annotations || []);
          setImageAnnotations(taskData.imageAnnotations || {});
        } catch (e) {
          console.error("Failed to parse user data", e);
        }
      } else {
        setCompletedTaskIds([]);
        setAnnotations([]);
        setImageAnnotations({});
      }
    }
  }, [isAuthenticated, currentUser, currentTaskIndex, currentTask?.id]);

  // Global Log Persistence
  useEffect(() => {
    if (isAuthenticated && currentUser && currentTask) {
      const storageKey = `annotate_data_${currentUser.email}`;
      const savedDataStr = localStorage.getItem(storageKey);
      let allUserData = savedDataStr ? JSON.parse(savedDataStr) as Record<string, any> : {};

      allUserData.completedTaskIds = completedTaskIds;
      allUserData[currentTask.id] = { annotations, imageAnnotations };
      localStorage.setItem(storageKey, JSON.stringify(allUserData));

      const taggedAnnos = annotations.map(a => ({ ...a, userEmail: currentUser.email, taskId: currentTask.id }));
      syncGlobalLog(currentUser.email, currentTask.id, taggedAnnos);
    }
  }, [annotations, imageAnnotations, completedTaskIds, isAuthenticated, currentUser, currentTaskIndex, currentTask?.id]);

  useEffect(() => {
    localStorage.setItem('annotate_language', language);
  }, [language]);

  const syncGlobalLog = (email: string, taskId: string, taskAnnos: Annotation[]) => {
    const key = 'annotate_global_log';
    let currentLog = JSON.parse(localStorage.getItem(key) || '[]') as any[];
    currentLog = currentLog.filter((a: any) => !(a.userEmail === email && a.taskId === taskId));
    const newLog = [...currentLog, ...taskAnnos];
    localStorage.setItem(key, JSON.stringify(newLog));
    setGlobalLog(newLog);
  };

  const addProject = (project: Project) => {
    const updated = [...projects, project];
    setProjects(updated);
    localStorage.setItem('annotate_projects', JSON.stringify(updated));
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    const updated = projects.map(p => p.id === id ? { ...p, ...updates } : p);
    setProjects(updated);
    localStorage.setItem('annotate_projects', JSON.stringify(updated));
  };

  const deleteProject = (id: string) => {
    // 1. Delete the Project
    const updatedProjects = projects.filter(p => p.id !== id);
    setProjects(updatedProjects);
    localStorage.setItem('annotate_projects', JSON.stringify(updatedProjects));

    // 2. Identify Tasks to Delete
    const tasksToDelete = tasks.filter(t => t.projectId === id);
    const taskIdsToDelete = tasksToDelete.map(t => t.id);

    if (taskIdsToDelete.length === 0) return;

    // 3. Delete Tasks
    const updatedTasks = tasks.filter(t => t.projectId !== id);
    setTasks(updatedTasks);
    localStorage.setItem('annotate_tasks', JSON.stringify(updatedTasks));

    // 4. Delete Project Assignments
    const updatedProjectAssignments = projectAssignments.filter(pa => pa.projectId !== id);
    setProjectAssignments(updatedProjectAssignments);
    localStorage.setItem('annotate_project_assignments', JSON.stringify(updatedProjectAssignments));

    // 5. Delete Task Assignments
    const updatedAssignments = assignments.filter(a => !taskIdsToDelete.includes(a.taskId));
    setAssignments(updatedAssignments);
    localStorage.setItem('annotate_assignments', JSON.stringify(updatedAssignments));

    // 6. Delete Global Log Annotations
    const updatedGlobalLog = globalLog.filter(a => !taskIdsToDelete.includes(a.taskId));
    setGlobalLog(updatedGlobalLog);
    localStorage.setItem('annotate_global_log', JSON.stringify(updatedGlobalLog));

    // 7. Cleanup User Data (Local Annotations)
    // We need to iterate over all users to clean up their specific data stores
    const allUsers = JSON.parse(localStorage.getItem('annotate_users') || '[]') as User[];
    allUsers.forEach(user => {
      const key = `annotate_data_${user.email}`;
      const userDataStr = localStorage.getItem(key);
      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          let changed = false;

          // Remove task data
          taskIdsToDelete.forEach(tid => {
            if (userData[tid]) {
              delete userData[tid];
              changed = true;
            }
          });

          // Remove from completed IDs
          if (userData.completedTaskIds) {
            const originalLen = userData.completedTaskIds.length;
            userData.completedTaskIds = userData.completedTaskIds.filter((tid: string) => !taskIdsToDelete.includes(tid));
            if (userData.completedTaskIds.length !== originalLen) changed = true;
          }

          if (changed) {
            localStorage.setItem(key, JSON.stringify(userData));
          }
        } catch (e) {
          console.error(`Failed to cleanup data for user ${user.email}`, e);
        }
      }
    });

    // Refresh current user data if needed
    if (currentUser) {
      const key = `annotate_data_${currentUser.email}`;
      const userData = JSON.parse(localStorage.getItem(key) || '{}');
      setCompletedTaskIds(userData.completedTaskIds || []);
      setAnnotations([]);
      setImageAnnotations({});
    }
  };

  const addTask = (task: Task) => {
    const updated = [...tasks, task];
    setTasks(updated);
    localStorage.setItem('annotate_tasks', JSON.stringify(updated));
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    const updated = tasks.map(t => t.id === id ? { ...t, ...updates } : t);
    setTasks(updated);
    localStorage.setItem('annotate_tasks', JSON.stringify(updated));
  };

  const deleteTask = (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    setTasks(updated);
    localStorage.setItem('annotate_tasks', JSON.stringify(updated));
    const newAssignments = assignments.filter(a => a.taskId !== id);
    setAssignments(newAssignments);
    localStorage.setItem('annotate_assignments', JSON.stringify(newAssignments));
  };

  const assignProject = (projectId: string, email: string) => {
    // Remove existing assignment for this user on this project
    const updated = projectAssignments.filter(pa => !(pa.projectId === projectId && pa.assignedToEmail === email));

    // If not unassigning (which we might support later, but for now assuming 'add' logic or 'toggle')
    // Let's implement simpler: Add if not exists, Remove if exists? Or just explicit assign.
    // The previous pattern for assignTask used "email !== 'all'" to push.
    // Let's assume we want to support multiple users per project.

    // Note: The UI for projects is likely "Add User to Project".
    // Let's support: assign mean "ensure this tuple exists"

    if (!updated.some(pa => pa.projectId === projectId && pa.assignedToEmail === email)) {
      updated.push({ projectId, assignedToEmail: email });
    }

    setProjectAssignments(updated);
    localStorage.setItem('annotate_project_assignments', JSON.stringify(updated));
  };

  const removeProjectAssignment = (projectId: string, email: string) => {
    const updated = projectAssignments.filter(pa => !(pa.projectId === projectId && pa.assignedToEmail === email));
    setProjectAssignments(updated);
    localStorage.setItem('annotate_project_assignments', JSON.stringify(updated));
  };

  // --- PROJECT EXPORT / IMPORT ---

  const handleExportProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const projectTasks = tasks.filter(t => t.projectId === projectId);

    // Format tasks to include paragraphs list and audio placeholder
    const formattedTasks = projectTasks.map(t => ({
      ...t,
      // Split by double newline or similar to robustly detect paragraphs. The app uses \n\s*\n usually.
      paragraphs: t.text.split(/\n\s*\n/).filter(p => p.trim() !== ""),
      // Use actual audio or empty list
      audio: t.audio || []
    }));

    const annotatorUsers = users.filter(u => u.role === 'annotator');

    const allUserAnnotations: any[] = [];

    annotatorUsers.forEach(user => {
      const key = `annotate_data_${user.email}`;
      const userDataStr = localStorage.getItem(key);
      if (userDataStr) {
        try {
          const userData = JSON.parse(userDataStr);
          const userExportData = {
            userEmail: user.email,
            completedTaskIds: userData.completedTaskIds?.filter((tid: string) => projectTasks.some(pt => pt.id === tid)) || [],
            taskData: {} as Record<string, any>
          };

          projectTasks.forEach(task => {
            if (userData[task.id]) {
              (userExportData.taskData as any)[task.id] = userData[task.id];
            }
          });

          // Only add if they have any data for this project
          if (Object.keys(userExportData.taskData).length > 0 || userExportData.completedTaskIds.length > 0) {
            allUserAnnotations.push(userExportData);
          }
        } catch (e) {
          console.error(`Failed to export data for user ${user.email}`, e);
        }
      }
    });

    const exportData = {
      version: "1.1",
      project,
      tasks: formattedTasks,
      annotations: allUserAnnotations
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-${project.title.replace(/\s+/g, '-').toLowerCase()}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProject = async (file: File) => {
    try {
      const text_content = await file.text();
      const data = JSON.parse(text_content);

      if (!data.project || !data.tasks || !data.annotations) {
        alert("Invalid project file format");
        return;
      }

      // 1. Create or Update Project
      const importedProject = data.project;
      const existingProjectIndex = projects.findIndex(p => p.id === importedProject.id);

      let updatedProjects = [...projects];
      if (existingProjectIndex >= 0) {
        // Update
        updatedProjects[existingProjectIndex] = { ...updatedProjects[existingProjectIndex], ...importedProject };
      } else {
        // Create
        updatedProjects.push(importedProject);
      }
      setProjects(updatedProjects);
      localStorage.setItem('annotate_projects', JSON.stringify(updatedProjects));


      // 2. Create or Update Tasks
      const currentTasks = JSON.parse(localStorage.getItem('annotate_tasks') || '[]') as Task[];
      let updatedTasks = [...currentTasks];

      data.tasks.forEach((t: any) => {
        // Ensure structure matches internal model (handle paragraphs vs text)
        const taskContent: Task = {
          id: t.id,
          title: t.title,
          objective: t.objective,
          description: t.description,
          projectId: t.projectId, // Should match data.project.id
          text: t.text || (t.paragraphs && Array.isArray(t.paragraphs) ? t.paragraphs.join('\n\n') : ''),
          images: t.images || [],
          audio: t.audio || [],
          question: t.question,
          category: t.category,
          gender: t.gender
        };

        const existingTaskIndex = updatedTasks.findIndex(ExistingT => ExistingT.id === taskContent.id);
        if (existingTaskIndex >= 0) {
          updatedTasks[existingTaskIndex] = { ...updatedTasks[existingTaskIndex], ...taskContent };
        } else {
          updatedTasks.push(taskContent);
        }
      });
      setTasks(updatedTasks);
      localStorage.setItem('annotate_tasks', JSON.stringify(updatedTasks));


      // 3. Create or Update Annotations (Ground Truth)
      // data.annotations is array of { userEmail, completedTaskIds, taskData }
      data.annotations.forEach((userImport: any) => {
        const { userEmail, completedTaskIds, taskData } = userImport;
        if (!userEmail) return;

        const key = `annotate_data_${userEmail}`;
        let userData = JSON.parse(localStorage.getItem(key) || '{}');

        // Merge Completed IDs (Set logic)
        const combinedCompleted = new Set([...(userData.completedTaskIds || []), ...(completedTaskIds || [])]);
        userData.completedTaskIds = Array.from(combinedCompleted);

        // Merge Task Data (Upsert per task)
        // We overwrite the specific task's annotations with the imported ones, assuming import is "latest/source of truth"
        // or we merge? Request says "create/update". 
        // For annotations list, it's safer to overwrite the list for that task to avoid duplication of same annotations with same IDs.
        Object.entries(taskData).forEach(([tid, tData]: [string, any]) => {
          // tData has { annotations: [], imageAnnotations: {} }
          // If the user already has data for this task, we merge/overwrite
          const existingTaskData = userData[tid] || { annotations: [], imageAnnotations: {} };

          // For text annotations: using ID to upsert could work, but simply replacing or appending is coarser.
          // Let's try to be smart: if ID exists, update. If not, add.
          const incomingAnnos = tData.annotations || [];
          const currentAnnos = existingTaskData.annotations || [];

          const mergedAnnos = [...currentAnnos];
          incomingAnnos.forEach((incA: Annotation) => {
            const idx = mergedAnnos.findIndex(a => a.id === incA.id);
            if (idx >= 0) {
              mergedAnnos[idx] = incA;
            } else {
              mergedAnnos.push(incA);
            }
          });

          // For image annotations: key is string (paraIdx) -> value is array
          // We need to merge at the object key level
          const incomingImgAnnos = tData.imageAnnotations || {};
          const currentImgAnnos = existingTaskData.imageAnnotations || {};
          const mergedImgAnnos = { ...currentImgAnnos };

          Object.keys(incomingImgAnnos).forEach(paraIdx => {
            const incList = incomingImgAnnos[paraIdx];
            const curList = mergedImgAnnos[paraIdx] || [];

            const mergedList = [...curList];
            incList.forEach((incIA: ImageAnnotation) => {
              const idx = mergedList.findIndex(a => a.id === incIA.id);
              if (idx >= 0) {
                mergedList[idx] = incIA;
              } else {
                mergedList.push(incIA);
              }
            });
            mergedImgAnnos[paraIdx] = mergedList;
          });


          userData[tid] = {
            annotations: mergedAnnos,
            imageAnnotations: mergedImgAnnos
          };
        });

        localStorage.setItem(key, JSON.stringify(userData));
      });

      // Update runtime state if relevant to current user
      if (currentUser) {
        // Refresh global log if needed
        const myKey = `annotate_data_${currentUser.email}`;
        const myData = JSON.parse(localStorage.getItem(myKey) || '{}');
        setCompletedTaskIds(myData.completedTaskIds || []);
        // We only update the ACTIVE task annotations in state if we have a current task
        if (currentTask && myData[currentTask.id]) {
          setAnnotations(myData[currentTask.id].annotations || []);
          setImageAnnotations(myData[currentTask.id].imageAnnotations || {});
        }
      }

      alert("Project, Tasks, and Annotations imported successfully!");

    } catch (e) {
      console.error("Import failed", e);
      alert("Failed to import project. Check console for details.");
    }
  };

  // Auth Handling
  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const currentUsers = JSON.parse(localStorage.getItem('annotate_users') || '[]') as any[];

    if (isRegistering) {
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (currentUsers.find((u: any) => u.email === formData.email)) {
        setError('Email already registered');
        return;
      }
      const newUser: User = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role
      };
      const updatedUsers = [...currentUsers, newUser];
      setUsers(updatedUsers);
      localStorage.setItem('annotate_users', JSON.stringify(updatedUsers));
      setCurrentUser(newUser);
      setIsAuthenticated(true);
      setViewMode(newUser.role === 'admin' ? 'admin' : 'workspace');
    } else {
      const user = currentUsers.find((u: any) => u.email === formData.email && u.password === formData.password);
      if (user) {
        setCurrentUser(user);
        setIsAuthenticated(true);
        setViewMode(user.role === 'admin' ? 'admin' : 'workspace');
      } else {
        setError('Invalid email or password');
      }
    }
  };

  const handleLogout = () => {
    stopAudio();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setAnnotations([]);
    setImageAnnotations({});
    setCompletedTaskIds([]);
    setCurrentTaskIndex(0);
    setFormData({ name: '', email: '', password: '', confirmPassword: '', role: 'annotator' });
    setViewMode('workspace');
  };

  // ADMIN OPERATIONS
  const addUser = (newUser: User) => {
    const updated = [...users, newUser];
    setUsers(updated);
    localStorage.setItem('annotate_users', JSON.stringify(updated));
  };

  const deleteUser = (email: string) => {
    const updated = users.filter(u => u.email !== email);
    setUsers(updated);
    localStorage.setItem('annotate_users', JSON.stringify(updated));
    localStorage.removeItem(`annotate_data_${email}`);
  };

  const updateRole = (email: string, role: UserRole) => {
    const updated = users.map(u => u.email === email ? { ...u, role } : u);
    setUsers(updated);
    localStorage.setItem('annotate_users', JSON.stringify(updated));
    if (email === currentUser?.email) {
      setCurrentUser(prev => prev ? { ...prev, role } : null);
    }
  };

  const assignTask = (taskId: string, email: string) => {
    const updated = assignments.filter(a => a.taskId !== taskId);
    if (email !== 'all') {
      updated.push({ taskId, assignedToEmail: email });
    }
    setAssignments(updated);
    localStorage.setItem('annotate_assignments', JSON.stringify(updated));
  };

  const updateAnnotationGlobally = (id: string, updates: Partial<Annotation>) => {
    const key = 'annotate_global_log';
    const updatedLog = globalLog.map(a => a.id === id ? { ...a, ...updates, timestamp: Date.now() } : a);
    setGlobalLog(updatedLog);
    localStorage.setItem(key, JSON.stringify(updatedLog));
    if (annotations.some(a => a.id === id)) {
      setAnnotations(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    }
  };

  const deleteAnnotationGlobally = (id: string) => {
    const key = 'annotate_global_log';
    const updatedLog = globalLog.filter(a => a.id !== id);
    setGlobalLog(updatedLog);
    localStorage.setItem(key, JSON.stringify(updatedLog));
    setAnnotations(prev => prev.filter(a => a.id !== id));
  };

  // Audio Playback
  const stopAudio = () => {
    if (currentSourceRef.current) {
      // Stop TTS source if any
      try { currentSourceRef.current.stop(); } catch (e) { }
      currentSourceRef.current = null;
    }
    // Also stop HTML audio elements if we were tracking them, but for this simple implementation
    // leveraging the native <audio> logic or just toggle state is enough.
    // However, to "replace" the TTS button with a play button for the URL, we can just use the HTML Audio element's API or
    // simply render the Audio element IN PLACE of the button.
    // For now, let's reset state.
    setPlayingParaIdx(null);
  };

  const handlePlayParagraph = (idx: number) => {
    // If the user wants to Play URL on click, we can programmatically play an audio element.
    // But simpler is to TOGGLE the display of a native audio player, OR simply play it.
    // Given "replace option", let's make the button toggle the audio for that section.
    // Actually, standard <audio> tag is best for controls (seek, volume).
    // The user asked to REPLACE the TTS option.
    // So I will make the button toggle the visibility of the native player?
    // OR, just replacing the button with the <audio> tag directly in the render loop is cleaner.
    // But I will stick to the plan: Remove TTS logic here.
    // I'll leave this empty or remove it.
    // Wait, I need to remove the button from JSX too.
    // So I'll remove this function entirely in the next step or just empty it now to be safe.
    setPlayingParaIdx(idx === playingParaIdx ? null : idx);
  };

  const nextTask = () => {
    stopAudio();
    if (currentTaskIndex < visibleTasks.length - 1) {
      setCurrentTaskIndex(currentTaskIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevTask = () => {
    stopAudio();
    if (currentTaskIndex > 0) {
      setCurrentTaskIndex(currentTaskIndex - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelect = (s: SelectionState) => {
    const overlaps = annotations.some(a => (s.start >= a.start && s.start < a.end) || (s.end > a.start && s.end <= a.end));
    if (!overlaps) { setEditingTextAnnotation(null); setCurrentSelection(s); setIsTextModalOpen(true); }
  };

  const handleEditHighlight = (anno: Annotation) => {
    setEditingTextAnnotation(anno);
    setCurrentSelection(null);
    setIsTextModalOpen(true);
  };

  const saveTextAnnotation = (
    comment: string,
    isImportant: boolean,
    isRelevant: DecisionStatus,
    relevantJustification: string,
    isSupported: DecisionStatus,
    supportedJustification: string
  ) => {
    if (!currentTask) return;
    if (editingTextAnnotation) {
      setAnnotations(prev => prev.map(a => a.id === editingTextAnnotation.id ? {
        ...a,
        comment,
        isImportant,
        isRelevant,
        relevantJustification,
        isSupported,
        supportedJustification,
        timestamp: Date.now()
      } : a));
    } else if (currentSelection) {
      const newAnnotation: Annotation = {
        id: Math.random().toString(36).substr(2, 9),
        ...currentSelection,
        comment,
        isImportant,
        isRelevant,
        relevantJustification,
        isSupported,
        supportedJustification,
        type: 'manual',
        timestamp: Date.now(),
        userEmail: currentUser?.email,
        taskId: currentTask.id
      };
      setAnnotations(prev => [...prev, newAnnotation]);
    }
    setIsTextModalOpen(false);
    setCurrentSelection(null);
    setEditingTextAnnotation(null);
  };

  const handleAddPin = (paraIdx: number, x: number, y: number, width: number, height: number, shapeType: ShapeType) => {
    setActiveImageIdx(paraIdx);
    setPendingPin({ x, y, width, height, shapeType });
    setEditingImageAnno(null);
    setIsTextModalOpen(false);
    setIsImageModalOpen(true);
  };

  const handleEditPin = (paraIdx: number, anno: ImageAnnotation) => {
    setActiveImageIdx(paraIdx);
    setEditingImageAnno(anno);
    setPendingPin(null);
    setIsImageModalOpen(true);
  };

  const saveImageAnnotation = (data: Omit<ImageAnnotation, 'id' | 'x' | 'y' | 'width' | 'height' | 'timestamp'>) => {
    if (activeImageIdx === null || !currentTask) return;
    const paraIdxKey = activeImageIdx.toString();
    if (editingImageAnno) {
      setImageAnnotations(prev => ({ ...prev, [paraIdxKey]: (prev[paraIdxKey] || []).map(a => a.id === editingImageAnno.id ? { ...a, ...data } : a) }));
    } else if (pendingPin) {
      const newAnno: ImageAnnotation = {
        id: Math.random().toString(36).substr(2, 9),
        x: pendingPin.x,
        y: pendingPin.y,
        width: pendingPin.width,
        height: pendingPin.height,
        timestamp: Date.now(),
        userEmail: currentUser?.email,
        taskId: currentTask.id,
        ...data
      };
      setImageAnnotations(prev => ({ ...prev, [paraIdxKey]: [...(prev[paraIdxKey] || []), newAnno] }));
    }
    setIsImageModalOpen(false);
    setEditingImageAnno(null);
    setPendingPin(null);
  };

  const handleCommitTask = () => {
    if (!isTaskSubmitted) {
      setCompletedTaskIds(prev => [...prev, currentTask.id]);
    }
    setShowResubmitSuccess(true);
    setTimeout(() => {
      setShowResubmitSuccess(false);
      if (currentTaskIndex < visibleTasks.length - 1) {
        nextTask();
      }
    }, 1200);
  };

  const handleDeleteSubmission = () => {
    setCompletedTaskIds(prev => prev.filter(id => id !== currentTask.id));
  };

  const getAiSuggestions = async () => {
    setIsAiLoading(true);
    const suggestions = await getSmartSuggestions(currentTask.text);
    const newAnnos: Annotation[] = (suggestions || []).map((s: any) => ({
      id: Math.random().toString(36).substr(2, 9),
      start: s.start,
      end: s.end,
      text: s.text,
      comment: `AI Suggestion: ${s.label}`,
      isImportant: false,
      type: 'ai',
      timestamp: Date.now(),
      userEmail: 'system',
      taskId: currentTask.id
    }));
    setAnnotations(prev => {
      const filtered = newAnnos.filter(na => !prev.some(pa => (na.start < pa.end && na.end > pa.start)));
      return [...prev, ...filtered];
    });
    setIsAiLoading(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 animate-in fade-in zoom-in duration-300">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 text-white rounded-2xl shadow-lg mb-6 transform rotate-3 hover:rotate-0 transition-transform">
              <span className="text-3xl font-black">A</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight italic">AnnotatePro AI</h1>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            {isRegistering && (
              <>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">{t('name', language)}</label>
                  <input type="text" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800" placeholder="John Doe" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">{t('role', language)}</label>
                  <select
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800 font-bold"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  >
                    <option value="annotator">{t('annotator', language)}</option>
                    <option value="admin">{t('admin', language)}</option>
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">{t('email', language)}</label>
              <input type="email" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800" placeholder="name@company.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">{t('password', language)}</label>
              <input type="password" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800" placeholder="••••••••" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
            </div>
            {isRegistering && (
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">{t('confirm_password', language)}</label>
                <input type="password" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-800" placeholder="••••••••" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} />
              </div>
            )}
            {error && <div className="bg-red-50 text-red-500 text-xs font-bold p-3 rounded-xl border border-red-100">{error}</div>}
            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 shadow-xl active:scale-[0.98] transition-all">
              {isRegistering ? t('register', language) : t('login', language)}
            </button>
          </form>
          <div className="mt-6 text-center">
            <button onClick={() => { setIsRegistering(!isRegistering); setError(''); }} className="text-sm font-bold text-indigo-600 hover:text-indigo-800">
              {isRegistering ? t('have_account', language) : t('no_account', language)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 overflow-hidden">
      {/* GLOBAL FLOATING CHARACTER BUTTON - INFORMATION ICON */}
      <button
        onClick={() => setIsProfileModalOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-indigo-600 text-white rounded-full shadow-[0_20px_50px_-10px_rgba(79,70,229,0.5)] z-[9999] flex items-center justify-center hover:scale-110 hover:bg-indigo-700 active:scale-95 transition-all group"
        title="Researcher Profile"
      >
        <i className="fa-solid fa-info-circle text-2xl group-hover:rotate-12 transition-transform"></i>
      </button>

      {/* SIDEBAR */}
      {/* SIDEBAR */}
      <aside className={`w-full ${isSidebarCollapsed ? 'md:w-20' : 'md:w-80'} bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-hidden shadow-sm z-20 transition-all duration-300 ease-in-out`}>
        <div className={`p-6 border-b border-gray-100 bg-slate-50/30 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isSidebarCollapsed && (
            <div>
              <h1 className="text-xl font-black text-slate-900 flex items-center italic">
                <span className="bg-indigo-600 text-white w-6 h-6 rounded-lg flex items-center justify-center mr-2 not-italic shadow-indigo-200 shadow-lg text-xs">A</span>
                AnnotatePro
              </h1>
              <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-widest font-black">
                {viewMode === 'admin' ? 'Command Center' : 'Annotator Portal'}
              </p>
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-100 shadow-sm transition-all"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <i className={`fa-solid ${isSidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-8 no-scrollbar">
          {!isSidebarCollapsed ? (
            <div className="px-3 py-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center mb-2">
              <div className="w-10 h-10 bg-white shadow-sm border border-slate-100 text-indigo-600 rounded-xl flex items-center justify-center font-black text-sm mr-4">{currentUser?.name.charAt(0)}</div>
              <div className="overflow-hidden">
                <p className="text-xs font-black text-slate-900 truncate">{currentUser?.name}</p>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${currentUser?.role === 'admin' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>{currentUser?.role}</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center mb-6">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black text-xs shadow-inner" title={currentUser?.name}>
                {currentUser?.name.charAt(0)}
              </div>
            </div>
          )}

          {isSidebarCollapsed ? (
            <div className="flex flex-col items-center space-y-8">
              {viewMode === 'admin' && (
                <>
                  <button onClick={() => setAdminTab('users')} title="Users" className={`p-3 rounded-xl transition-all ${adminTab === 'users' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><i className="fa-solid fa-users"></i></button>
                  <button onClick={() => setAdminTab('tasks')} title="Tasks" className={`p-3 rounded-xl transition-all ${adminTab === 'tasks' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><i className="fa-solid fa-list-check"></i></button>
                  <button onClick={() => setAdminTab('annotations')} title="Ground Truth" className={`p-3 rounded-xl transition-all ${adminTab === 'annotations' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><i className="fa-solid fa-database"></i></button>
                  <button onClick={() => setAdminTab('projects')} title="Projects" className={`p-3 rounded-xl transition-all ${adminTab === 'projects' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><i className="fa-solid fa-folder-open"></i></button>
                </>
              )}
              {viewMode === 'workspace' && (
                <>
                  <div className="relative group cursor-pointer" title="Text Highlights">
                    <i className="fa-solid fa-align-left text-slate-400"></i>
                    <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{annotations.length}</span>
                  </div>
                  <div className="relative group cursor-pointer" title="Visual Highlights">
                    <i className="fa-solid fa-image text-slate-400"></i>
                    <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{flatImageAnnotations.length}</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {viewMode === 'admin' ? (
                <div className="space-y-1">
                  <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 mb-4">{t('admin_nav', language)}</h2>
                  <button onClick={() => setAdminTab('users')} className={`w-full flex items-center px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${adminTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <i className="fa-solid fa-users mr-3 text-sm"></i> {t('users_tab', language)}
                  </button>
                  <button onClick={() => setAdminTab('tasks')} className={`w-full flex items-center px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${adminTab === 'tasks' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <i className="fa-solid fa-list-check mr-3 text-sm"></i> {t('tasks_tab', language)}
                  </button>
                  <button onClick={() => setAdminTab('annotations')} className={`w-full flex items-center px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${adminTab === 'annotations' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <i className="fa-solid fa-database mr-3 text-sm"></i> {t('annotations_tab', language)}
                  </button>
                  <button onClick={() => setAdminTab('projects')} className={`w-full flex items-center px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${adminTab === 'projects' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <i className="fa-solid fa-folder-open mr-3 text-sm"></i> {t('projects_tab', language)}
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center px-3">
                      <i className="fa-solid fa-align-left mr-2"></i> {t('document_highlights', language)} ({annotations.length})
                    </h2>
                    <div className="space-y-2">
                      {/* Keep existing render logic */}
                      {annotations.map(anno => (
                        <div key={anno.id} className="p-3.5 rounded-2xl border bg-white border-slate-100 text-[11px] hover:bg-slate-50 cursor-pointer group transition-all shadow-sm hover:shadow-md" onClick={() => handleEditHighlight(anno)}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-800 italic truncate mr-2">"{anno.text}"</span>
                            <button onClick={(e) => { e.stopPropagation(); setAnnotations(prev => prev.filter(a => a.id !== anno.id)); }} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate opacity-80 leading-relaxed font-medium">{anno.comment || 'No note.'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Visual Highlights */}
                  <div className="space-y-4">
                    <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center px-3">
                      <i className="fa-solid fa-image mr-2"></i> {t('visual_highlights', language)} ({flatImageAnnotations.length})
                    </h2>
                    <div className="space-y-2">
                      {flatImageAnnotations.map(anno => (
                        <div key={anno.id} className="p-3.5 rounded-2xl border bg-white border-slate-100 text-[11px] hover:bg-slate-50 cursor-pointer group transition-all shadow-sm hover:shadow-md" onClick={() => handleEditPin(anno.paraIdx, anno)}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-800 capitalize truncate mr-2">
                              {anno.shapeType} #{anno.id.slice(0, 4)}
                            </span>
                            <button onClick={(e) => {
                              e.stopPropagation();
                              setImageAnnotations(prev => {
                                const paraKey = anno.paraIdx.toString();
                                return {
                                  ...prev,
                                  [paraKey]: (prev[paraKey] || []).filter(a => a.id !== anno.id)
                                };
                              });
                            }} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                              <i className="fa-solid fa-trash-can text-[10px]"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-gray-100 space-y-2">
          <button
            onClick={() => setViewMode('workspace')}
            className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center active:scale-95 ${viewMode === 'workspace' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}
          >
            <i className={`fa-solid fa-code-branch ${isSidebarCollapsed ? '' : 'mr-3'}`}></i>
            {!isSidebarCollapsed && t('workspace_nav', language)}
          </button>

          {currentUser.role === 'admin' && (
            <button
              onClick={() => setViewMode('admin')}
              className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center active:scale-95 ${viewMode === 'admin' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}
            >
              <i className={`fa-solid fa-gauge-high ${isSidebarCollapsed ? '' : 'mr-3'}`}></i>
              {!isSidebarCollapsed && t('admin_nav', language)}
            </button>
          )}

          {/* Language Switcher */}
          <div className={`flex ${isSidebarCollapsed ? 'flex-col space-y-2' : 'space-x-2'} p-1 bg-slate-50 rounded-2xl border border-slate-100`}>
            <button
              onClick={() => setLanguage('en')}
              className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${language === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('pt')}
              className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${language === 'pt' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              PT
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-4 bg-white border border-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center active:scale-95 hover:bg-red-50"
          >
            <i className={`fa-solid fa-arrow-right-from-bracket ${isSidebarCollapsed ? '' : 'mr-3'}`}></i>
            {!isSidebarCollapsed && t('logout', language)}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-24 bg-white border-b border-slate-100 flex items-center justify-between px-10 shrink-0 z-40 shadow-sm">
          <div className="flex items-center space-x-8">
            {viewMode === 'workspace' ? (
              <div className="flex items-center space-x-6">
                {currentUser?.role === 'admin' && (
                  <div className="flex items-center bg-white border border-slate-200 rounded-xl px-4 py-2 animate-in slide-in-from-top-2 shadow-sm min-w-[200px]">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-3 shrink-0">{t('project_filter', language)}</span>
                    <select
                      value={adminProjectFilter || ''}
                      onChange={(e) => setAdminProjectFilter(e.target.value || null)}
                      className="bg-transparent text-xs font-bold text-slate-900 outline-none w-full"
                    >
                      <option value="">{t('all_projects', language)}</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  </div>
                )}
                {currentTask?.category && (
                  <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${currentTask.category === 'diet'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : 'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>
                    {currentTask.category}
                  </span>
                )}
                <button onClick={() => setIsGuidelinesModalOpen(true)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 whitespace-nowrap">
                  <i className="fa-solid fa-book-open mr-2"></i>
                  {t('guidelines_btn', language)}
                </button>

                {/* IN-LINE PROGRESS BAR */}
                <div className="hidden sm:flex items-center space-x-4 border-l border-slate-100 pl-6">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('batch_progress', language)}</span>
                    <span className="text-[11px] font-black text-slate-800 leading-none">{completedTaskIds.length} / {visibleTasks.length} {t('submitted_label', language)}</span>
                  </div>
                  <div className="w-40 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-50 p-0.5">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-black text-indigo-600 min-w-[30px]">{Math.round(progressPercentage)}%</span>
                </div>
              </div>
            ) : (
              <h2 className="text-xl font-black text-slate-900 italic tracking-tight truncate max-w-md">
                {adminTab === 'users' ? t('user_registry', language) :
                  adminTab === 'tasks' ? t('workload_distribution', language) :
                    adminTab === 'projects' ? t('project_management', language) : t('ground_truth_logs', language)}
              </h2>
            )}
          </div>

          <div className="flex items-center space-x-8">
            {viewMode === 'workspace' && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={prevTask}
                  disabled={currentTaskIndex === 0}
                  className="w-10 h-10 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-20 flex items-center justify-center text-slate-600"
                >
                  <i className="fa-solid fa-chevron-left text-sm"></i>
                </button>
                <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 font-black text-xs text-slate-800">
                  {currentTaskIndex + 1} / {visibleTasks.length}
                </div>
                <button
                  onClick={nextTask}
                  disabled={currentTaskIndex === visibleTasks.length - 1}
                  className="w-10 h-10 bg-white border border-slate-100 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-20 flex items-center justify-center text-slate-600"
                >
                  <i className="fa-solid fa-chevron-right text-sm"></i>
                </button>
              </div>
            )}

            {viewMode === 'admin' && (
              <button onClick={() => setViewMode('workspace')} className="px-6 py-2.5 bg-slate-50 text-slate-900 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white transition-all">
                {t('close', language)}
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-50/50 no-scrollbar relative">
          {viewMode === 'admin' ? (
            <div className="p-10 max-w-7xl mx-auto">
              <AdminDashboard
                activeTab={adminTab}
                users={users}
                allAnnotations={globalLog}
                assignments={assignments}
                projectAssignments={projectAssignments}
                tasks={visibleTasks.length > 0 ? tasks : []}
                onAddUser={addUser}
                onDeleteUser={deleteUser}
                onUpdateRole={updateRole}
                onAssignTask={assignTask}
                onAssignProject={assignProject}
                onRemoveProjectAssignment={removeProjectAssignment}
                onUpdateAnnotation={updateAnnotationGlobally}
                onDeleteAnnotation={deleteAnnotationGlobally}
                projects={projects}
                onAddProject={addProject}
                onUpdateProject={updateProject}
                onDeleteProject={deleteProject}
                onAddTask={addTask}
                onUpdateTask={updateTask}
                onDeleteTask={deleteTask}
                onExportProject={handleExportProject}
                onImportProject={handleImportProject}
                onInspectProject={(projectId) => {
                  setAdminProjectFilter(projectId);
                  setViewMode('workspace');
                }}
                onClose={() => setViewMode('workspace')}
                language={language}
              />
            </div>
          ) : (
            <div className="p-10 max-w-7xl mx-auto space-y-20 pb-40">
              {visibleTasks.length === 0 ? (
                <div className="py-40 text-center bg-white rounded-[4rem] border border-dashed border-slate-200 shadow-sm animate-in fade-in">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="fa-solid fa-folder-open text-3xl text-slate-300"></i>
                  </div>
                  <p className="text-slate-400 font-black text-sm uppercase tracking-widest">{t('no_task', language)}</p>
                  <p className="text-slate-300 text-xs font-bold mt-2">{t('no_project_assigned', language)}</p>
                </div>
              ) : (allFilteredTasksCompleted && !isReviewingCompleted) ? (
                <div className="py-40 text-center bg-white rounded-[4rem] border border-dashed border-slate-200 shadow-sm animate-in fade-in">
                  <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="fa-solid fa-check-double text-4xl text-emerald-400"></i>
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 italic mb-2">{t('tasks_completed_title', language)}</h3>
                  <p className="text-slate-400 font-black text-sm uppercase tracking-widest mb-8">{t('tasks_completed_subtitle', language)}</p>
                  <button onClick={() => setIsReviewingCompleted(true)} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-700 transition-all shadow-xl active:scale-95">
                    {t('review_work', language)}
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-32">
                    {paragraphs.map((para, idx) => (
                      <div key={idx} className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase text-indigo-600 tracking-[0.3em] bg-indigo-50 px-4 py-1.5 rounded-2xl border border-indigo-100">{t('paragraph_label', language)} #{idx + 1}</span>

                            {/* Audio Player Replacement */}
                            {currentTask.audio && currentTask.audio.length > 0 && (
                              <div className="flex items-center bg-white rounded-full border border-slate-100 shadow-sm px-2 py-1">
                                <audio
                                  controls
                                  src={currentTask.audio[idx % currentTask.audio.length]}
                                  className="h-8 w-60"
                                  onPlay={() => {
                                    setPlayingParaIdx(idx);
                                  }}
                                />
                              </div>
                            )}
                          </div>
                          <TextDisplay
                            content={para.text}
                            annotations={annotations
                              .filter(a => a.start >= para.offset && a.end <= para.offset + para.text.length)
                              .map(a => ({ ...a, start: a.start - para.offset, end: a.end - para.offset }))
                            }
                            onSelect={s => {
                              const globalStart = para.offset + s.start;
                              handleSelect({ ...s, start: globalStart, end: globalStart + s.text.length });
                            }}
                            onEditAnnotation={a => handleEditHighlight({ ...a, start: a.start + para.offset, end: a.end + para.offset })}
                          />
                        </div>

                        <div className="lg:sticky lg:top-10">
                          <ImageWithPinpoints
                            imageUrl={currentTask.images[idx % currentTask.images.length]}
                            annotations={imageAnnotations[idx.toString()] || []}
                            onAddPin={(x, y, w, h, t) => handleAddPin(idx, x, y, w, h, t)}
                            onEditPin={a => handleEditPin(idx, a)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Submission Footer Actions */}
                  <div className="pt-24 flex flex-col items-center">


                    {isTaskSubmitted ? (
                      <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-6 py-2.5 rounded-full flex items-center mb-6 shadow-sm">
                          <i className="fa-solid fa-circle-check text-sm mr-2"></i>
                          <span className="font-black text-[10px] uppercase tracking-[0.2em]">{t('task_submitted_badge', language)}</span>
                        </div>
                        <div className="flex flex-wrap justify-center gap-3">
                          <button
                            onClick={handleCommitTask}
                            className="px-8 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-700 shadow-lg transition-all active:scale-95 border-b-2 border-indigo-900"
                          >
                            <i className="fa-solid fa-rotate-right mr-2 opacity-70"></i> {t('update_resubmit', language)}
                          </button>
                          <button
                            onClick={handleDeleteSubmission}
                            className="px-8 py-3.5 bg-white text-red-600 border border-red-100 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-red-50 transition-all active:scale-95 shadow-sm"
                          >
                            <i className="fa-solid fa-trash-can mr-2 opacity-70"></i> {t('delete_entry', language)}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleCommitTask}
                        className="px-10 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-700 shadow-xl transition-all active:scale-95 flex items-center border-b-2 border-indigo-900"
                      >
                        <i className="fa-solid fa-paper-plane mr-2 opacity-70"></i>
                        {t('submit_task', language)}
                      </button>
                    )}

                    {showResubmitSuccess && <p className="mt-8 text-emerald-600 font-black text-xl animate-in slide-in-from-top-4">{t('success_msg', language)}</p>}
                  </div>
                </>
              )
              }
            </div >
          )}
        </main >
      </div >

      <AnnotationModal isOpen={isTextModalOpen} onClose={() => setIsTextModalOpen(false)} onSave={saveTextAnnotation} selection={currentSelection} editingAnnotation={editingTextAnnotation} language={language} />
      <ImageAnnotationModal isOpen={isImageModalOpen} onClose={() => setIsImageModalOpen(false)} onSave={saveImageAnnotation} existingAnnotation={editingImageAnno} language={language} />
      <GuidelinesModal isOpen={isGuidelinesModalOpen} onClose={() => setIsGuidelinesModalOpen(false)} language={language} />
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        taskProfile={currentTask?.description}
        taskTitle={currentTask?.title}
        language={language}
      />
    </div >
  );
};

export default App;
