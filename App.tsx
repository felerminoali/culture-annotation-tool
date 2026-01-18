
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Annotation, SelectionState, ImageAnnotation, ShapeType, DecisionStatus, User, TaskAssignment, UserRole, Project, Task, ProjectAssignment, Language, UserTaskSubmission } from './types';
import TextDisplay from './components/TextDisplay';
import AnnotationModal from './components/AnnotationModal';
import TextIssueModal from './components/TextIssueModal';
import ImageAnnotationModal from './components/ImageAnnotationModal';
import ImageIssueModal from './components/ImageIssueModal';
import ImageWithPinpoints from './components/ImageWithPinpoints';
import GuidelinesModal from './components/GuidelinesModal';
import ProfileModal from './components/ProfileModal';
import AdminDashboard from './components/AdminDashboard';
import { getSmartSuggestions } from './services/geminiService'; // Removed getTextToSpeech as per requirement to replace it with native audio
import { t, TranslationKey } from './services/i18n';
import * as supabaseService from './services/supabaseService';
import { generateUuid, isValidUuid, onAuthStateChange } from './services/supabaseService';


const App: React.FC = () => {
  // Auth & Navigation State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [viewMode, setViewMode] = useState<'workspace' | 'admin'>('workspace');
  const [adminTab, setAdminTab] = useState<'users' | 'tasks' | 'annotations' | 'projects' | 'agreement'>('users');
  const [language, setLanguage] = useState<Language>('en');

  // Platform Resources
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [globalLog, setGlobalLog] = useState<Annotation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectAssignments, setProjectAssignments] = useState<ProjectAssignment[]>([]);
  const [allTaskSubmissions, setAllTaskSubmissions] = useState<UserTaskSubmission[]>([]); // For Admin Dashboard agreement
  const [submissionUpdateKey, setSubmissionUpdateKey] = useState(0); // Key to force AdminDashboard refresh

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
  const [culturalScore, setCulturalScore] = useState<number>(0);
  const [languageSimilarity, setLanguageSimilarity] = useState<DecisionStatus>('na');
  const [languageSimilarityJustification, setLanguageSimilarityJustification] = useState<string>('');

  // UI Modal State
  const [currentSelection, setCurrentSelection] = useState<SelectionState | null>(null);
  const [isReviewingCompleted, setIsReviewingCompleted] = useState(false);
  const [editingTextAnnotation, setEditingTextAnnotation] = useState<Annotation | null>(null);
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isImageIssueModalOpen, setIsImageIssueModalOpen] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState<number | null>(null);
  const [pendingPin, setPendingPin] = useState<{ x: number, y: number, width: number, height: number, shapeType: ShapeType } | null>(null);
  const [editingImageAnno, setEditingImageAnno] = useState<ImageAnnotation | null>(null);
  const [isGuidelinesModalOpen, setIsGuidelinesModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [adminProjectFilter, setAdminProjectFilter] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Audio State (Refactored to native HTML audio element, no more complex decoding)
  const [playingParaIdx, setPlayingParaIdx] = useState<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null); // Still keeping ref but not actively using for TTS.
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null); // Still keeping ref but not actively using for TTS.

  // Ref to track if the component is mounted to prevent state updates on unmounted components
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);


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

  const currentTask = visibleTasks[currentTaskIndex];
  const isTaskSubmitted = currentTask ? completedTaskIds.includes(currentTask.id) : false;

  const paragraphs = useMemo(() => {
    if (!currentTask) return [];
    const result: { text: string; offset: number }[] = [];
    const splitRegex = /\n\s*\n/;
    let searchStartIndex = 0;

    currentTask.text.split(splitRegex).forEach(part => {
      if (part.trim() !== "") {
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
      annos.map(a => ({ ...a, paragraph_index: parseInt(paraIdx) }))
    );
  }, [imageAnnotations]);

  // --- Auth Effect ---
    // --- REPLACED AUTH EFFECT IN APP.TSX ---
    useEffect(() => {
      const checkUser = async () => {
        if (!supabaseService.supabase) {
          setError('Supabase is not configured. Please check your environment variables.');
          return;
        }
  
        try {
          const user = await supabaseService.getCurrentUser();
          if (!isMounted.current) return;
  
          if (user) {
            setCurrentUser(user);
            setIsAuthenticated(true);
            setViewMode(user.role === 'admin' ? 'admin' : 'workspace');
            setError('');
          } else {
            setIsAuthenticated(false);
            setCurrentUser(null);
          }
        } catch (err) {
          console.error('Error during checkUser:', err);
        }
      };
  
      // Initial check on mount
      checkUser();
  
      // Use the standard listener directly (as in File Two) to avoid wrapper bugs
      const { data: authListener } = supabaseService.supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!isMounted.current) return;
  
          // Logic from version that handles sessions correctly
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
            checkUser();
          } else if (event === 'SIGNED_OUT') {
            setIsAuthenticated(false);
            setCurrentUser(null);
            setAnnotations([]);
            setImageAnnotations({});
            setCompletedTaskIds([]);
            setCurrentTaskIndex(0);
            setFormData({ name: '', email: '', password: '', confirmPassword: '', role: 'annotator' });
          }
        }
      );
  
      return () => {
        authListener?.subscription.unsubscribe();
      };
    }, []);
  
  
  
    // --- REPLACED AUTH EFFECT IN APP.TSX ---
  // Sync Global Resources from Supabase
  useEffect(() => {
    if (!isAuthenticated || !currentUser || !supabaseService.supabase) return;

    const loadGlobalResources = async () => {
      try {
        const [usersData, projectsData, tasksData, projectAssignmentsData, taskAssignmentsData, globalAnnotationsData, allSubmissionsData] = await Promise.all([
          supabaseService.fetchUsers(),
          supabaseService.fetchProjects(),
          supabaseService.fetchTasks(),
          supabaseService.fetchProjectAssignments(),
          supabaseService.fetchTaskAssignments(),
          supabaseService.fetchAllAnnotations(),
          supabaseService.fetchAllUserTaskSubmissions()
        ]);

        if (!isMounted.current) return; // Prevent state updates if component unmounted

        setUsers(usersData);
        setProjects(projectsData);
        setTasks(tasksData);
        setProjectAssignments(projectAssignmentsData);
        setAssignments(taskAssignmentsData);
        setGlobalLog(globalAnnotationsData);
        setAllTaskSubmissions(allSubmissionsData);
        setSubmissionUpdateKey(prev => prev + 1); // Increment key after updating global submissions

        const savedLang = localStorage.getItem('annotate_language') as Language;
        if (savedLang) setLanguage(savedLang);

        // --- NEW LOGIC TO SET INITIAL CURRENT TASK INDEX TO THE LAST COMPLETED TASK ---
        if (currentUser) {
          // Fetch completed task IDs for the current user
          const userCompletedTaskIds = await supabaseService.fetchCompletedTaskIds(currentUser.id!);
          if (!isMounted.current) return; // Prevent state updates if component unmounted
          setCompletedTaskIds(userCompletedTaskIds); // Update the state

          // Determine visible tasks based on newly fetched data for initial index calculation
          let currentUsersVisibleTasks: Task[] = [];
          if (currentUser.role === 'admin') {
            currentUsersVisibleTasks = tasksData; // Admin sees all tasks initially
          } else {
            currentUsersVisibleTasks = tasksData.filter(task => {
              const assignment = taskAssignmentsData.find(a => a.taskId === task.id);
              if (assignment) {
                return assignment.assignedToEmail === 'all' || assignment.assignedToEmail === currentUser.email;
              }
              if (task.projectId) {
                return projectAssignmentsData.some(pa => pa.projectId === task.projectId && pa.assignedToEmail === currentUser.email);
              }
              return false;
            });
          }

          let lastCompletedIndex = 0;
          // Find the index of the last completed task within the visible tasks
          for (let i = currentUsersVisibleTasks.length - 1; i >= 0; i--) {
            if (userCompletedTaskIds.includes(currentUsersVisibleTasks[i].id)) {
              lastCompletedIndex = i;
              break;
            }
          }
          setCurrentTaskIndex(lastCompletedIndex);
        } else {
          setCurrentTaskIndex(0); // Default to first task if no user or no completed tasks
        }
        // --- END NEW LOGIC ---

      } catch (error) {
        if (isMounted.current) console.error('Error loading global resources:', error); // Only log if still mounted
      }
    };

    loadGlobalResources();
  }, [isAuthenticated, currentUser?.id]); // Rerun if auth status or user changes

  // Sync Task-specific Data from Supabase
  useEffect(() => {
    if (!isAuthenticated || !currentUser || !currentTask || !supabaseService.supabase) return;

    const loadTaskData = async () => {
      try {
        const [completedIds, annotationsData, imageAnnotationsData, submission] = await Promise.all([
          supabaseService.fetchCompletedTaskIds(currentUser.id!), // Fetch for current user
          supabaseService.fetchAnnotations(currentTask.id, currentUser.id!),
          supabaseService.fetchImageAnnotations(currentTask.id, currentUser.id!),
          supabaseService.fetchTaskSubmission(currentTask.id, currentUser.id!)
        ]);

        if (!isMounted.current) return; // Prevent state updates if component unmounted

        // Note: completedTaskIds are already set by loadGlobalResources for initial load.
        // This line ensures it's up-to-date for individual task changes too.
        setCompletedTaskIds(completedIds);
        setAnnotations(annotationsData);
        setImageAnnotations(imageAnnotationsData);

        if (submission) {
          setCulturalScore(submission.cultural_score || 0);
          setLanguageSimilarity(submission.language_similarity || 'na');
          setLanguageSimilarityJustification(submission.language_similarity_justification || '');
        } else {
          setCulturalScore(0);
          setLanguageSimilarity('na');
          setLanguageSimilarityJustification('');
        }
      } catch (error) {
        if (!isMounted.current) return; // Only log if still mounted
        console.error('Error loading task data:', error);
        // Reset current task data on error to prevent displaying stale info
        setAnnotations([]);
        setImageAnnotations({});
        setCulturalScore(0);
        setLanguageSimilarity('na');
        setLanguageSimilarityJustification('');
      }
    };

    loadTaskData();
  }, [isAuthenticated, currentUser, currentTask?.id]); // Rerun when currentTask changes

  // Save current task data to Supabase (debounced or on explicit actions)
  // This useEffect will be triggered when annotations, imageAnnotations etc. change
  // For a real-time app, you might debounce this or save on explicit user actions.
  // For now, we'll let it save on state changes, which might be too frequent.
  // A better approach would be to only call `saveTaskSubmission` and `saveAnnotations`/`saveImageAnnotations`
  // when the user explicitly commits a change or completes the task.
  useEffect(() => {
    if (!isAuthenticated || !currentUser || !currentTask || !supabaseService.supabase) return;

    const timer = setTimeout(async () => {
      if (!isMounted.current) return; // Check if mounted before running debounced save logic

      try {
        await supabaseService.saveTaskSubmission(
          currentTask.id,
          currentUser.id!,
          culturalScore,
          languageSimilarity,
          languageSimilarityJustification,
          isTaskSubmitted // Pass the current submission status
        );
        await supabaseService.saveAnnotations(currentTask.id, currentUser.id!, annotations);
        await supabaseService.saveImageAnnotations(currentTask.id, currentUser.id!, imageAnnotations);

        const updatedSubmissions = await supabaseService.fetchAllUserTaskSubmissions();
        if (!isMounted.current) return;
        setAllTaskSubmissions(updatedSubmissions);
        setSubmissionUpdateKey(prev => prev + 1);

      } catch (error) {
        if (isMounted.current) console.error('Error saving task data:', error);
      }
    }, 1000); // Debounce saves by 1 second

    return () => clearTimeout(timer);
  }, [annotations, imageAnnotations, culturalScore, languageSimilarity, languageSimilarityJustification,
    isAuthenticated, currentUser, currentTask?.id, isTaskSubmitted]); // Add isTaskSubmitted to dependencies

  useEffect(() => {
    localStorage.setItem('annotate_language', language);
  }, [language]);

  // --- Admin Operations (moved to App.tsx to centralize Supabase calls) ---

  const addUser = useCallback(async (newUser: User) => {
    if (!supabaseService.supabase) return;
    try {
      const { data, error: signUpError } = await supabaseService.signUp(newUser.email, newUser.password!, newUser.name, newUser.role);
      if (signUpError) throw signUpError;
      // After successful signup, fetch users again to get the new user with their ID
      const updatedUsers = await supabaseService.fetchUsers();
      if (!isMounted.current) return; // Check again after async fetch
      setUsers(updatedUsers);
    } catch (error: any) {
      if (isMounted.current) {
        console.error('Error adding user:', error.message);
        setError(error.message);
      }
    }
  }, []);

  const deleteUser = useCallback(async (email: string) => {
    if (!supabaseService.supabase) return;
    try {
      const { error } = await supabaseService.deleteUser(email);
      if (error) throw error;
      if (!isMounted.current) return;
      setUsers(prev => prev.filter(u => u.email !== email));
      setAssignments(prev => prev.filter(a => a.assignedToEmail !== email)); // Clean up assignments
      setProjectAssignments(prev => prev.filter(pa => pa.assignedToEmail !== email)); // Clean up project assignments
      // Also need to delete all annotations/submissions by this user.
      // Supabase RLS or cascade deletes should handle this.
    } catch (error: any) {
      if (isMounted.current) {
        console.error('Error deleting user:', error.message);
        setError(error.message);
      }
    }
  }, []);

  const updateRole = useCallback(async (email: string, role: UserRole) => {
    if (!supabaseService.supabase) return;
    try {
      const { error } = await supabaseService.updateUserRole(email, role);
      if (error) throw error;
      if (!isMounted.current) return;
      setUsers(prev => prev.map(u => u.email === email ? { ...u, role } : u));
      if (email === currentUser?.email) {
        setCurrentUser(prev => prev ? { ...prev, role } : null);
      }
    } catch (error: any) {
      if (isMounted.current) {
        console.error('Error updating role:', error.message);
        setError(error.message);
      }
    }
  }, [currentUser]);

  const assignTask = useCallback(async (taskId: string, email: string) => {
    if (!supabaseService.supabase) return;
    try {
      const { error } = await supabaseService.upsertTaskAssignment(taskId, email);
      if (error) throw error;
      const updatedAssignments = await supabaseService.fetchTaskAssignments();
      if (!isMounted.current) return; // Check again after async fetch
      setAssignments(updatedAssignments);
    } catch (error: any) {
      if (isMounted.current) {
        console.error('Error assigning task:', error.message);
        setError(error.message);
      }
    }
  }, []);

  const addProject = useCallback(async (project: Omit<Project, 'id' | 'createdAt'>) => {
    if (!supabaseService.supabase) return;
    try {
      const newProject = await supabaseService.createProject(project);
      if (!isMounted.current) return; // Check after async operation
      if (newProject) {
        setProjects(prev => [...prev, newProject]);
      }
    } catch (error: any) {
      if (isMounted.current) {
        console.error('Error adding project:', error.message);
        setError(error.message);
      }
    }
  }, []);

  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    if (!supabaseService.supabase) return;
    try {
      const { error } = await supabaseService.updateProject(id, updates);
      if (error) throw error;
      if (!isMounted.current) return;
      setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    } catch (error: any) {
      if (isMounted.current) {
        console.error('Error updating project:', error.message);
        setError(error.message);
      }
    }
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    if (!supabaseService.supabase) return;
    try {
      const { error } = await supabaseService.deleteProject(id);
      if (error) throw error;
      if (!isMounted.current) return;
      setProjects(prev => prev.filter(p => p.id !== id));
      setTasks(prev => prev.filter(t => t.projectId !== id)); // Tasks associated with project
      setProjectAssignments(prev => prev.filter(pa => pa.projectId !== id)); // Project assignments
      setAssignments(prev => prev.filter(a => !tasks.filter(t => t.projectId === id).some(task => task.id === a.taskId))); // Task assignments within project
      setGlobalLog(prev => prev.filter(a => !tasks.filter(t => t.projectId === id).some(task => task.id === a.taskId))); // Global annotations within project
    } catch (error: any) {
      if (isMounted.current) {
        console.error('Error deleting project:', error.message);
        setError(error.message);
      }
    }
  }, [tasks]);

  const addTask = useCallback(async (task: Task) => { // Changed type to Task
    if (!supabaseService.supabase) return;
    try {
      const newTask = await supabaseService.createTask(task);
      if (!isMounted.current) return; // Check after async operation
      if (newTask) {
        setTasks(prev => [...prev, newTask]);
      }
    } catch (error: any) {
      if (isMounted.current) {
        console.error('Error adding task:', error.message);
        setError(error.message);
      }
    }
  }, []);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    if (!supabaseService.supabase) return;
    try {
      const { error } = await supabaseService.updateTask(id, updates);
      if (error) throw error;
      if (!isMounted.current) return;
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    } catch (error: any) {
      if (isMounted.current) {
        console.error('Error updating task:', error.message);
        setError(error.message);
      }
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    if (!supabaseService.supabase) return;
    try {
      const { error } = await supabaseService.deleteTask(id);
      if (error) throw error;
      if (!isMounted.current) return;
      setTasks(prev => prev.filter(t => t.id !== id));
      setAssignments(prev => prev.filter(a => a.taskId !== id));
      setGlobalLog(prev => prev.filter(a => a.taskId !== id));
    } catch (error: any) {
      if (isMounted.current) {
        console.error('Error deleting task:', error.message);
        setError(error.message);
      }
    }
  }, []);

  const assignProject = useCallback(async (projectId: string, email: string) => {
    if (!supabaseService.supabase) return;
    try {
      const user = users.find(u => u.email === email);
      if (!user?.id) throw new Error('User not found for assignment');
      const { error } = await supabaseService.upsertProjectAssignment(projectId, user.id);
      if (error) throw error;
      const updatedAssignments = await supabaseService.fetchProjectAssignments();
      if (!isMounted.current) return; // Check after async fetch
      setProjectAssignments(updatedAssignments);
    } catch (error: any) {
      if (isMounted.current) {
        console.error('Error assigning project:', error.message);
        setError(error.message);
      }
    }
  }, [users]);

  const removeProjectAssignment = useCallback(async (projectId: string, email: string) => {
    if (!supabaseService.supabase) return;
    try {
      const user = users.find(u => u.email === email);
      if (!user?.id) throw new Error('User not found for de-assignment');
      const { error } = await supabaseService.deleteProjectAssignment(projectId, user.id);
      if (error) throw error;
      if (!isMounted.current) return;
      setProjectAssignments(prev => prev.filter(pa => !(pa.projectId === projectId && pa.assignedToEmail === email)));
    } catch (error: any) {
      if (isMounted.current) {
        console.error('Error removing project assignment:', error.message);
        setError(error.message);
      }
    }
  }, [users]);

  // --- PROJECT EXPORT / IMPORT ---

  const handleExportProject = async (projectId: string) => {
    if (!supabaseService.supabase) return;

    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const projectTasks = tasks.filter(t => t.projectId === projectId);
    const taskIds = projectTasks.map(t => t.id);

    const allProjectSubmissions = await supabaseService.fetchSubmissionsForTasks(taskIds);
    const allProjectAnnotations = await supabaseService.fetchAnnotationsForTasks(taskIds);
    const allProjectImageAnnotations = await supabaseService.fetchImageAnnotationsForTasks(taskIds);

    const formattedTasks = projectTasks.map(t => {
      const paragraphs = t.text.split(/\n\s*\n/).filter(p => p.trim() !== "");
      return {
        ...t,
        paragraphs,
        paragrah_number: paragraphs.length,
        image_number: t.images?.length || 0,
      };
    });

    const annotatorUsers = users.filter(u => u.role === 'annotator');
    const allUserExportData: any[] = [];

    annotatorUsers.forEach(user => {
      const userSubmissions = allProjectSubmissions.filter(s => s.userId === user.id);
      const userAnnotations = allProjectAnnotations.filter(a => a.userId === user.id);
      const userImageAnnotations = allProjectImageAnnotations.filter(ia => ia.userId === user.id);

      const userExportData = {
        userEmail: user.email,
        userId: user.id,
        completedTaskIds: userSubmissions.filter(s => s.completed).map(s => s.taskId),
        taskData: {} as Record<string, any>
      };

      projectTasks.forEach(task => {
        const taskSubmission = userSubmissions.find(s => s.taskId === task.id);
        const taskAnnos = userAnnotations.filter(a => a.taskId === task.id);
        const taskImageAnnos = userImageAnnotations.filter(ia => ia.taskId === task.id);

        if (taskSubmission || taskAnnos.length > 0 || taskImageAnnos.length > 0) {
          const taskParagraphs = task.text.split(/\n\s*\n/).filter(p => p.trim() !== "").map((p, idx) => {
            const index = task.text.indexOf(p);
            return { text: p, offset: index };
          });

          const processedTextAnnotations = taskAnnos.map(anno => {
            const paraIdx = taskParagraphs.findIndex(p => anno.start >= p.offset && anno.end <= p.offset + p.text.length);
            return {
              ...anno,
              paragraph: paraIdx !== -1 ? paraIdx + 1 : undefined
            };
          });

          const processedImageAnnotations: Record<string, any[]> = {};
          taskImageAnnos.forEach(anno => {
            if (!processedImageAnnotations[anno.paragraph_index!]) {
              processedImageAnnotations[anno.paragraph_index!] = [];
            }
            processedImageAnnotations[anno.paragraph_index!].push({
              ...anno,
              paragraph: anno.paragraph_index! + 1,
              image_number: anno.paragraph_index! + 1
            });
          });

          userExportData.taskData[task.id] = {
            annotations: processedTextAnnotations,
            imageAnnotations: processedImageAnnotations,
            culturalScore: taskSubmission?.culturalScore || 0,
            languageSimilarity: taskSubmission?.languageSimilarity || 'na',
            languageSimilarityJustification: taskSubmission?.languageSimilarityJustification || ''
          };
        }
      });

      if (Object.keys(userExportData.taskData).length > 0 || userExportData.completedTaskIds.length > 0) {
        allUserExportData.push(userExportData);
      }
    });

    const exportData = {
      version: "1.1",
      project,
      tasks: formattedTasks,
      annotations: allUserExportData
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
    if (!supabaseService.supabase) return;

    try {
      const text_content = await file.text();
      const data = JSON.parse(text_content);

      if (!data.project || !data.tasks || !data.annotations) {
        if (isMounted.current) alert("Invalid project file format");
        if (isMounted.current) console.error("Import failed: Invalid project file format", data);
        return;
      }

      // 1. Create or Update Project
      const importedProject = data.project;
      const projectToUpsert: Project = {
        ...importedProject,
        id: isValidUuid(importedProject.id) ? importedProject.id : generateUuid(),
      };
      if (!isValidUuid(importedProject.id)) {
        console.warn(`Invalid UUID found for project ID: "${importedProject.id}". Regenerating to "${projectToUpsert.id}".`);
      }

      await supabaseService.upsertProject(projectToUpsert);
      const updatedProjects = await supabaseService.fetchProjects();
      if (!isMounted.current) return;
      setProjects(updatedProjects);

      // 2. Create or Update Tasks
      for (const t of data.tasks) {
        const taskToUpsert: Task = {
          ...t,
          id: isValidUuid(t.id) ? t.id : generateUuid(),
          text: t.text || (t.paragraphs && Array.isArray(t.paragraphs) ? t.paragraphs.join('\n\n') : ''),
          images: t.images || [],
          audio: t.audio || [],
          question: t.question || '',
          category: t.category,
          gender: t.gender,
          taskType: t.taskType || 'independent'
        };
        if (!isValidUuid(t.id)) {
          console.warn(`Invalid UUID found for task ID: "${t.id}". Regenerating to "${taskToUpsert.id}".`);
        }
        await supabaseService.upsertTask(taskToUpsert);
      }
      const updatedTasks = await supabaseService.fetchTasks();
      if (!isMounted.current) return;
      setTasks(updatedTasks);

      // 3. Create or Update Annotations (Ground Truth) and Submissions
      for (const userImport of data.annotations) {
        const { userEmail, userId, completedTaskIds, taskData } = userImport;
        if (!userEmail || !userId) {
          console.warn(`Skipping user import due to missing email or ID:`, userImport);
          continue;
        }

        for (const taskId of completedTaskIds) {
          // Ensure a submission exists and mark it as completed (score 0, na for simplicity on import if not specified)
          await supabaseService.saveTaskSubmission(taskId, userId, 0, 'na', '', true); // Explicitly mark as completed
        }

        for (const [taskId, tData] of Object.entries(taskData)) {
          // Update submission details
          await supabaseService.saveTaskSubmission(
            taskId,
            userId,
            (tData as any).culturalScore || 0,
            (tData as any).languageSimilarity || 'na',
            (tData as any).languageSimilarityJustification || '',
            true // Assume tasks with data are completed
          );

          // Save text annotations - pass taskId and userId directly
          const incomingAnnos = (tData as any).annotations || [];
          await supabaseService.saveAnnotations(taskId, userId, incomingAnnos);

          // Save image annotations
          const incomingImgAnnos = (tData as any).imageAnnotations || {};
          // Convert incomingImgAnnos (Record<string, any[]>) to a flat array for saveImageAnnotationsFlat
          const flatIncomingImgAnnos: ImageAnnotation[] = Object.entries(incomingImgAnnos).flatMap(([paraIdx, annos]) =>
            (annos as any[]).map(a => ({ ...a, paragraph_index: parseInt(paraIdx) }))
          );
          // Use saveImageAnnotationsFlat which accepts a flat array
          await supabaseService.saveImageAnnotationsFlat(taskId, userId, flatIncomingImgAnnos);
        }
      }

      // Re-fetch all data to ensure UI is up-to-date
      const [updatedAllAnnotations, updatedAllSubmissions] = await Promise.all([
        supabaseService.fetchAllAnnotations(),
        supabaseService.fetchAllUserTaskSubmissions()
      ]);
      if (!isMounted.current) return;
      setGlobalLog(updatedAllAnnotations);
      setAllTaskSubmissions(updatedAllSubmissions);
      setSubmissionUpdateKey(prev => prev + 1); // Increment key after updating global submissions

      if (currentUser) {
        const [userCompletedTasks, userAnnotations, userImageAnnotations, userSubmission] = await Promise.all([
          supabaseService.fetchCompletedTaskIds(currentUser.id!),
          // Only call fetchAnnotations if currentTask and currentTask.id are present
          currentTask?.id ? supabaseService.fetchAnnotations(currentTask.id, currentUser.id!) : Promise.resolve([]),
          // Only call fetchImageAnnotations if currentTask and currentTask.id are present
          currentTask?.id ? supabaseService.fetchImageAnnotations(currentTask.id, currentUser.id!) : Promise.resolve({}),
          currentTask ? supabaseService.fetchTaskSubmission(currentTask.id, currentUser.id!) : Promise.resolve(null)
        ]);
        if (!isMounted.current) return;
        setCompletedTaskIds(userCompletedTasks);
        setAnnotations(userAnnotations);
        setImageAnnotations(userImageAnnotations);
        if (userSubmission) {
          setCulturalScore(userSubmission.cultural_score || 0);
          setLanguageSimilarity(userSubmission.language_similarity || 'na');
          setLanguageSimilarityJustification(userSubmission.language_similarity_justification || '');
        }
      }

      if (isMounted.current) alert("Project, Tasks, and Annotations imported successfully!");

    } catch (e: any) { // Catch as any to access 'message' property
      if (isMounted.current) {
        console.error("Import failed:", e);
        alert(`Failed to import project. Details: ${e.message || e.toString()}`);
      }
    }
  };

  // Auth Handling
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMounted.current) setError('');

    if (!supabaseService.supabase) {
      if (isMounted.current) setError('Supabase is not configured. Cannot perform authentication.');
      return;
    }

    try {
      if (isRegistering) {
        if (formData.password !== formData.confirmPassword) {
          if (isMounted.current) setError(t('auth_error_passwords', language));
          return;
        }

        const { error: signUpError } = await supabaseService.signUp(
          formData.email,
          formData.password,
          formData.name,
          'annotator'
        );

        if (signUpError) {
          if (!isMounted.current) return;
          if (signUpError.message.includes('already registered')) {
            setError(t('auth_error_email_exists', language));
          } else {
            setError(signUpError.message);
          }
          return;
        }
        // Supabase trigger automatically creates the user profile, then we fetch it.
      }

      const { error: signInError } = await supabaseService.signIn(
        formData.email,
        formData.password
      );

      if (signInError) {
        if (isMounted.current) setError(t('auth_error_invalid', language));
        return;
      }

      // Get the user profile after successful sign-in
      const user = await supabaseService.getCurrentUser();
      if (!isMounted.current) return; // Check after getting user

      if (user) {
        setCurrentUser(user);
        setIsAuthenticated(true);
        setViewMode(user.role === 'admin' ? 'admin' : 'workspace');
      } else {
        setError(t('auth_error_invalid', language));
      }

    } catch (err: any) {
      if (isMounted.current) {
        console.error('Auth error:', err);
        setError('An unexpected error occurred: ' + err.message);
      }
    }
  };

  const handleLogout = async () => {
    stopAudio();
    if (supabaseService.supabase) {
      // Perform the actual sign-out
      const { error } = await supabaseService.signOut();
      if (error) {
        if (isMounted.current) {
          console.error('Error during Supabase sign-out:', error);
          setError('Failed to log out. Please try again.');
        }
        return;
      }
    }
    if (!isMounted.current) return; // Final check before clearing all state
    // Clear all local state related to the user and session
    setIsAuthenticated(false);
    setCurrentUser(null);
    setAnnotations([]);
    setImageAnnotations({});
    setCulturalScore(0);
    setLanguageSimilarity('na');
    setLanguageSimilarityJustification('');
    setCompletedTaskIds([]);
    setCurrentTaskIndex(0);
    setFormData({ name: '', email: '', password: '', confirmPassword: '', role: 'annotator' });
    setViewMode('workspace');
    setGlobalLog([]); // Clear global log on logout
    setAllTaskSubmissions([]); // Clear all submissions on logout
    setSubmissionUpdateKey(0); // Reset key on logout
    setError(''); // Clear any previous errors
  };

  const updateAnnotationGlobally = useCallback(async (id: string, updates: Partial<Annotation>) => {
    if (!supabaseService.supabase || !currentUser?.id) return;
    try {
      const { error } = await supabaseService.updateAnnotation(id, updates);
      if (error) throw error;
      if (!isMounted.current) return;
      setGlobalLog(prev => prev.map(a => a.id === id ? { ...a, ...updates, timestamp: Date.now() } : a));
      setAnnotations(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a)); // Update local task annotations too
    } catch (error: any) {
      if (isMounted.current) {
        console.error('Error updating global annotation:', error.message);
        setError(error.message);
      }
    }
  }, [currentUser]);

  const deleteAnnotationGlobally = useCallback(async (id: string) => {
    if (!supabaseService.supabase || !currentUser?.id) return;
    try {
      const { error } = await supabaseService.deleteAnnotation(id);
      if (error) throw error;
      if (!isMounted.current) return;
      setGlobalLog(prev => prev.filter(a => a.id !== id));
      setAnnotations(prev => prev.filter(a => a.id !== id)); // Update local task annotations too
    } catch (error: any) {
      if (isMounted.current) {
        console.error('Error deleting global annotation:', error.message);
        setError(error.message);
      }
    }
  }, [currentUser]);


  // Audio Playback
  const stopAudio = () => {
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch (e) { }
      currentSourceRef.current = null;
    }
    setPlayingParaIdx(null);
  };

  const handlePlayParagraph = (idx: number) => {
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
    if (!overlaps) {
      setEditingTextAnnotation(null);
      setCurrentSelection(s);
      setIsTypeSelectorOpen(true);
    }
  };

  const handleImageChooseType = (subtype: 'culture' | 'issue') => {
    setIsTypeSelectorOpen(false);
    if (subtype === 'culture') {
      setIsImageModalOpen(true);
    } else {
      setIsImageIssueModalOpen(true);
    }
  };

  const handleChooseType = (subtype: 'culture' | 'issue') => {
    if (pendingPin || editingImageAnno) { // Check if an image annotation is pending or being edited
      handleImageChooseType(subtype);
      return;
    }
    // Existing text logic
    if (editingTextAnnotation) {
      setEditingTextAnnotation({ ...editingTextAnnotation, subtype });
    } else if (currentSelection) {
      // Will be handled in save logic
    }

    setIsTypeSelectorOpen(false);
    if (subtype === 'culture') {
      setIsTextModalOpen(true);
    } else {
      setIsIssueModalOpen(true);
    }
  };

  const handleEditHighlight = (anno: Annotation) => {
    setEditingTextAnnotation(anno);
    setCurrentSelection(null);
    if (anno.subtype === 'issue') {
      setIsIssueModalOpen(true);
    } else {
      setIsTextModalOpen(true);
    }
  };

  const saveTextAnnotation = async (
    comment: string,
    isImportant: boolean,
    isRelevant: DecisionStatus,
    relevantJustification: string,
    isSupported: DecisionStatus,
    supportedJustification: string,
    cultureProxy: string
  ) => {
    if (!currentTask || !currentUser?.id) return;
    setIsTextModalOpen(false); // Close modal early to avoid double renders

    let updatedAnnos: Annotation[];

    if (editingTextAnnotation) {
      updatedAnnos = annotations.map(a => a.id === editingTextAnnotation.id ? {
        ...a,
        comment,
        isImportant,
        isRelevant,
        relevantJustification,
        isSupported,
        supportedJustification,
        cultureProxy,
        timestamp: Date.now()
      } : a);
    } else if (currentSelection) {
      const newAnnotation: Annotation = {
        id: generateUuid(), // Use generated UUID
        ...currentSelection,
        comment,
        isImportant,
        isRelevant,
        relevantJustification,
        isSupported,
        supportedJustification,
        cultureProxy,
        type: 'manual',
        timestamp: Date.now(),
        userEmail: currentUser?.email,
        userId: currentUser.id,
        taskId: currentTask.id,
        submissionTaskId: currentTask.id, // Set submission_task_id
        submissionUserId: currentUser.id, // Set submission_user_id
        subtype: 'culture'
      };
      updatedAnnos = [...annotations, newAnnotation];
    } else {
      return; // Should not happen
    }

    setAnnotations(updatedAnnos);
    setCurrentSelection(null);
    setEditingTextAnnotation(null);

    // Manual trigger save for immediate persistence rather than waiting for debounce
    if (currentUser && currentTask) {
      try {
        await supabaseService.saveAnnotations(currentTask.id, currentUser.id, updatedAnnos);
        if (!isMounted.current) return;
        const updatedGlobalLog = await supabaseService.fetchAllAnnotations();
        if (!isMounted.current) return;
        setGlobalLog(updatedGlobalLog);
      } catch (error) {
        if (isMounted.current) console.error('Error saving text annotation:', error);
      }
    }
  };

  const saveIssueAnnotation = async (category: string, description: string) => {
    if (!currentTask || !currentUser?.id) return;
    setIsIssueModalOpen(false);

    let updatedAnnos: Annotation[];

    if (editingTextAnnotation) {
      updatedAnnos = annotations.map(a => a.id === editingTextAnnotation.id ? {
        ...a,
        issueCategory: category,
        issueDescription: description,
        timestamp: Date.now()
      } : a);
    } else if (currentSelection) {
      const newAnnotation: Annotation = {
        id: generateUuid(), // Use generated UUID
        ...currentSelection,
        comment: '',
        isImportant: false,
        type: 'manual',
        subtype: 'issue',
        issueCategory: category,
        issueDescription: description,
        timestamp: Date.now(),
        userEmail: currentUser?.email,
        userId: currentUser.id,
        taskId: currentTask.id,
        submissionTaskId: currentTask.id, // Set submission_task_id
        submissionUserId: currentUser.id, // Set submission_user_id
      };
      updatedAnnos = [...annotations, newAnnotation];
    } else {
      return;
    }

    setAnnotations(updatedAnnos);
    setCurrentSelection(null);
    setEditingTextAnnotation(null);

    // Manual trigger save for immediate persistence
    if (currentUser && currentTask) {
      try {
        await supabaseService.saveAnnotations(currentTask.id, currentUser.id, updatedAnnos);
        if (!isMounted.current) return;
        const updatedGlobalLog = await supabaseService.fetchAllAnnotations();
        if (!isMounted.current) return;
        setGlobalLog(updatedGlobalLog);
      } catch (error) {
        if (isMounted.current) console.error('Error saving issue annotation:', error);
      }
    }
  };

  const handleAddPin = (paraIdx: number, x: number, y: number, width: number, height: number, shapeType: ShapeType) => {
    setActiveImageIdx(paraIdx);
    setPendingPin({ x, y, width, height, shapeType });
    setEditingImageAnno(null);
    setIsTypeSelectorOpen(true);
  };

  const handleEditPin = (paraIdx: number, anno: ImageAnnotation) => {
    setActiveImageIdx(paraIdx);
    setEditingImageAnno(anno);
    setPendingPin(null);
    if (anno.subtype === 'issue') {
      setIsImageIssueModalOpen(true);
    } else {
      setIsImageModalOpen(true);
    }
  };

  const saveImageAnnotation = async (data: Omit<ImageAnnotation, 'id' | 'x' | 'y' | 'width' | 'height' | 'timestamp' | 'userId' | 'taskId' | 'userEmail' | 'paragraph_index' | 'submissionTaskId' | 'submissionUserId'>) => {
    if (activeImageIdx === null || !currentTask || !currentUser?.id) return;
    const paraIdxKey = activeImageIdx.toString();
    setIsImageModalOpen(false);
    setIsImageIssueModalOpen(false);

    let updatedImageAnnos: ImageAnnotation[];

    if (editingImageAnno) {
      updatedImageAnnos = (imageAnnotations[paraIdxKey] || []).map(a => a.id === editingImageAnno.id ? { ...a, ...data } : a);
    } else if (pendingPin) {
      const newAnno: ImageAnnotation = {
        id: generateUuid(), // Use generated UUID
        x: pendingPin.x,
        y: pendingPin.y,
        width: pendingPin.width,
        height: pendingPin.height,
        shapeType: pendingPin.shapeType,
        timestamp: Date.now(),
        userEmail: currentUser?.email,
        userId: currentUser.id,
        taskId: currentTask.id,
        submissionTaskId: currentTask.id, // Set submission_task_id
        submissionUserId: currentUser.id, // Set submission_user_id
        paragraph_index: activeImageIdx,
        // Provide default values for properties that might be omitted when creating an issue annotation
        description: data.description || '',
        comment: data.comment || '',
        isPresent: data.isPresent || 'na',
        presentJustification: data.presentJustification || '',
        isRelevant: data.isRelevant || 'na',
        relevantJustification: data.relevantJustification || '',
        isSupported: data.isSupported || 'na',
        supportedJustification: data.supportedJustification || '',
        cultureProxy: data.cultureProxy || '',
        subtype: data.subtype,
        issueCategory: data.issueCategory,
        issueDescription: data.issueDescription,
      };
      updatedImageAnnos = [...(imageAnnotations[paraIdxKey] || []), newAnno];
    } else {
      return;
    }

    const newImageAnnotationsState = { ...imageAnnotations, [paraIdxKey]: updatedImageAnnos };
    setImageAnnotations(newImageAnnotationsState);
    setEditingImageAnno(null);
    setPendingPin(null);

    // Manual trigger save for immediate persistence
    if (currentUser && currentTask) {
      try {
        await supabaseService.saveImageAnnotations(currentTask.id, currentUser.id, newImageAnnotationsState);
        if (!isMounted.current) return;
        const updatedGlobalLog = await supabaseService.fetchAllAnnotations();
        if (!isMounted.current) return;
        setGlobalLog(updatedGlobalLog);
      } catch (error) {
        if (isMounted.current) console.error('Error saving image annotation:', error);
      }
    }
  };

  const handleCommitTask = async () => {
    if (!currentTask || !currentUser?.id) return;

    const hasTextAnnotations = annotations.length > 0;
    const hasImageAnnotations = Object.values(imageAnnotations).some((list: any) => list.length > 0);

    if (!hasTextAnnotations && !hasImageAnnotations) {
      if (!window.confirm(t('confirm_empty_submission', language))) {
        return;
      }
    }

    try {
      await supabaseService.saveTaskSubmission(
        currentTask.id,
        currentUser.id,
        culturalScore,
        languageSimilarity,
        languageSimilarityJustification,
        true // Mark as completed
      );
      // Re-fetch completed task IDs for the current user
      const updatedCompletedTaskIds = await supabaseService.fetchCompletedTaskIds(currentUser.id);
      if (!isMounted.current) return;
      setCompletedTaskIds(updatedCompletedTaskIds);

      // Re-fetch all submissions to update AdminDashboard agreement metrics
      const updatedAllSubmissions = await supabaseService.fetchAllUserTaskSubmissions();
      if (!isMounted.current) return;
      setAllTaskSubmissions(updatedAllSubmissions);
      setSubmissionUpdateKey(prev => prev + 1); // Increment key after updating global submissions

      setShowResubmitSuccess(true);
      setTimeout(() => {
        if (!isMounted.current) return;
        setShowResubmitSuccess(false);
        if (currentTaskIndex < visibleTasks.length - 1) {
          nextTask();
        } else {
          setIsReviewingCompleted(true); // If all tasks are completed, show completion message
        }
      }, 1200);
    } catch (error) {
      if (isMounted.current) {
        console.error('Error committing task:', error);
        setError('Failed to commit task. Please try again.');
      }
    }
  };

  const handleDeleteSubmission = async () => {
    if (!currentTask || !currentUser?.id) return;
    if (!window.confirm("Are you sure you want to delete this task's submission? This will clear all your annotations for this task.")) {
      return;
    }

    try {
      await supabaseService.deleteTaskSubmission(currentTask.id, currentUser.id);
      if (!isMounted.current) return;
      // Clear local state for this task
      setAnnotations([]);
      setImageAnnotations({});
      setCulturalScore(0);
      setLanguageSimilarity('na');
      setLanguageSimilarityJustification('');
      // Update completed tasks list
      setCompletedTaskIds(prev => prev.filter(id => id !== currentTask.id));
      // Re-fetch all annotations and submissions to update AdminDashboard
      const [updatedGlobalLog, updatedAllSubmissions] = await Promise.all([
        supabaseService.fetchAllAnnotations(),
        supabaseService.fetchAllUserTaskSubmissions()
      ]);
      if (!isMounted.current) return;
      setGlobalLog(updatedGlobalLog);
      setAllTaskSubmissions(updatedAllSubmissions);
      setSubmissionUpdateKey(prev => prev + 1); // Increment key after updating global submissions
    } catch (error) {
      if (isMounted.current) {
        console.error('Error deleting submission:', error);
        setError('Failed to delete submission. Please try again.');
      }
    }
  };


  const getAiSuggestions = async () => {
    if (!currentTask) return;
    setIsAiLoading(true);
    try {
      const suggestions = await getSmartSuggestions(currentTask.text);
      if (!currentUser?.id) {
        throw new Error("User ID not available for AI suggestions.");
      }
      if (!isMounted.current) return; // Check after suggestions arrive

      const newAnnos: Annotation[] = (suggestions || []).map((s: any) => ({
        id: generateUuid(), // Use generated UUID
        start: s.start,
        end: s.end,
        text: s.text,
        comment: `AI Suggestion: ${s.label}`,
        isImportant: false,
        type: 'ai',
        timestamp: Date.now(),
        userEmail: 'system', // AI annotations are system-generated
        userId: currentUser.id, // Associate with current user for saving
        taskId: currentTask.id,
        submissionTaskId: currentTask.id, // Set submission_task_id
        submissionUserId: currentUser.id, // Set submission_user_id
        subtype: 'culture' // Default AI suggestions to culture type
      }));

      setAnnotations(prev => {
        const filtered = newAnnos.filter(na => !prev.some(pa => (na.start < pa.end && na.end > pa.start)));
        const updated = [...prev, ...filtered];
        // Trigger save after AI suggestions
        if (currentUser && currentTask) {
          supabaseService.saveAnnotations(currentTask.id, currentUser.id, updated);
        }
        return updated;
      });
    } catch (error) {
      if (isMounted.current) {
        console.error("Error fetching AI suggestions:", error);
        setError("Failed to get AI suggestions.");
      }
    } finally {
      if (isMounted.current) setIsAiLoading(false);
    }
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
            <button onClick={() => { setIsRegistering(!isRegistering); if (isMounted.current) setError(''); }} className="text-sm font-bold text-indigo-600 hover:text-indigo-800">
              {isRegistering ? t('have_account', language) : t('no_account', language)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 overflow-hidden">
      {/* GLOBAL FLOATING CHARACTER BUTTON - INFORMATION ICON (Only visible in workspace mode) */}
      {viewMode === 'workspace' && (
        <button
          onClick={() => setIsProfileModalOpen(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-indigo-600 text-white rounded-full shadow-[0_20px_50px_-10px_rgba(79,70,229,0.5)] z-[9999] flex items-center justify-center hover:scale-110 hover:bg-indigo-700 active:scale-95 transition-all group"
          title="Researcher Profile"
        >
          <i className="fa-solid fa-info-circle text-2xl group-hover:rotate-12 transition-transform"></i>
        </button>
      )}

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
                  <button onClick={() => setAdminTab('agreement')} title="Agreement" className={`p-3 rounded-xl transition-all ${adminTab === 'agreement' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><i className="fa-solid fa-users-viewfinder"></i></button>
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
                  <button onClick={() => setAdminTab('agreement')} className={`w-full flex items-center px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${adminTab === 'agreement' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <i className="fa-solid fa-users-viewfinder mr-3 text-sm"></i> {t('agreement_tab', language)}
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
                        <div key={anno.id} className={`p-3.5 rounded-2xl border bg-white border-slate-100 text-[11px] hover:bg-slate-50 cursor-pointer group transition-all shadow-sm hover:shadow-md ${anno.subtype === 'issue' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-indigo-500'}`} onClick={() => handleEditHighlight(anno)}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-800 italic truncate mr-2">"{anno.text}"</span>
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${anno.subtype === 'issue' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                              {anno.subtype === 'issue' ? t('text_issue', language) : t('culture_marker', language).split(' ')[0]}
                            </span>
                            <button onClick={(e) => { e.stopPropagation(); setAnnotations(prev => prev.filter(a => a.id !== anno.id)); }} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate opacity-80 leading-relaxed font-medium">
                            {anno.subtype === 'issue'
                              ? `${t(anno.issueCategory as any, language)}: ${anno.issueDescription}`
                              : (
                                <span className="flex flex-col">
                                  {anno.cultureProxy && (
                                    <span className="text-indigo-600 font-black uppercase text-[8px] mb-0.5 tracking-tighter">
                                      [{t(anno.cultureProxy as any, language)}]
                                    </span>
                                  )}
                                  <span className="line-clamp-2 italic text-slate-500">{anno.comment || 'No comment'}</span>
                                </span>
                              )
                            }
                          </p>
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
                        <div key={anno.id} className={`p-3.5 rounded-2xl border bg-white border-slate-100 text-[11px] hover:bg-slate-50 cursor-pointer group transition-all shadow-sm hover:shadow-md ${anno.subtype === 'issue' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-indigo-500'}`} onClick={() => handleEditPin(anno.paragraph_index!, anno)}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-800 capitalize truncate mr-2">
                              {anno.subtype === 'issue' ? t(anno.issueCategory as any, language) : anno.description || `${anno.shapeType} #${anno.id.slice(0, 4)}`}
                            </span>
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${anno.subtype === 'issue' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                              {anno.subtype === 'issue' ? t('image_issue', language).split(' ')[1] : t('image_culture_marker', language).split(' ')[1]}
                            </span>
                            <button onClick={(e) => {
                              e.stopPropagation();
                              setImageAnnotations(prev => {
                                const paraKey = anno.paragraph_index!.toString();
                                return {
                                  ...prev,
                                  [paraKey]: (prev[paraKey] || []).filter(a => a.id !== anno.id)
                                };
                              });
                            }} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                              <i className="fa-solid fa-trash-can text-[10px]"></i>
                            </button>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate opacity-80 leading-relaxed font-medium">
                            {anno.subtype === 'issue'
                              ? anno.issueDescription
                              : (
                                <span className="flex flex-col">
                                  {anno.cultureProxy && (
                                    <span className="text-indigo-600 font-black uppercase text-[8px] mb-0.5 tracking-tighter">
                                      [{t(anno.cultureProxy as any, language)}]
                                    </span>
                                  )}
                                  <span className="line-clamp-2 italic text-slate-500">{anno.comment || 'No comment'}</span>
                                </span>
                              )
                            }
                          </p>
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

          {currentUser?.role === 'admin' && (
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
      </aside >

      {/* MAIN CONTENT AREA */}
      < div className="flex-1 flex flex-col overflow-hidden" >
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
                  disabled={
                    currentTaskIndex === visibleTasks.length - 1 ||
                    (
                      currentUser.role !== 'admin' &&
                      progressPercentage < 100 && completedTaskIds.length + 1 < currentTaskIndex
                    )
                  }

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
                key={submissionUpdateKey} // Added key here
                activeTab={adminTab}
                users={users}
                allAnnotations={globalLog}
                assignments={assignments}
                projectAssignments={projectAssignments}
                tasks={tasks}
                projects={projects}
                allTaskSubmissions={allTaskSubmissions} // Pass all submissions for agreement calculation
                onAddUser={addUser}
                onDeleteUser={deleteUser}
                onUpdateRole={updateRole}
                onAssignTask={assignTask}
                onAssignProject={assignProject}
                onRemoveProjectAssignment={removeProjectAssignment}
                onUpdateAnnotation={updateAnnotationGlobally}
                onDeleteAnnotation={deleteAnnotationGlobally}
                onAddProject={addProject}
                onUpdateProject={updateProject}
                onDeleteProject={deleteProject}
                onAddTask={addTask}
                onUpdateTask={updateTask}
                onDeleteTask={deleteTask}
                onInspectProject={(projectId) => {
                  if (isMounted.current) { // Check if still mounted before state updates
                    setAdminProjectFilter(projectId);
                    setViewMode('workspace');
                  }
                }}
                onExportProject={handleExportProject}
                onImportProject={handleImportProject}
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
                            {currentTask?.audio && currentTask.audio.length > idx && (
                              <div className="flex items-center bg-white rounded-full border border-slate-100 shadow-sm px-2 py-1">
                                <audio
                                  controls
                                  src={currentTask.audio[idx]}
                                  className="h-8 w-60"
                                  onPlay={() => {
                                    setPlayingParaIdx(idx);
                                  }}
                                  onPause={() => setPlayingParaIdx(null)}
                                  onEnded={() => setPlayingParaIdx(null)}
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

                  {/* LANGUAGE SIMILARITY QUESTION */}
                  <div className="pt-32 pb-16 max-w-4xl mx-auto">
                    <div className="bg-white rounded-[4rem] border border-slate-100 shadow-2xl p-16 space-y-12 animate-in slide-in-from-bottom-8">
                      <div className="text-center space-y-4">
                        <h3 className="text-3xl font-black text-slate-900 italic tracking-tight">
                          {t('language_similarity_question', language)}
                        </h3>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                          {t('language_similarity_label', language)}
                        </p>
                      </div>

                      <div className="space-y-10">
                        <div className="flex justify-center space-x-6">
                          {(['yes', 'no'] as DecisionStatus[]).map((status) => (
                            <button
                              key={status}
                              onClick={() => setLanguageSimilarity(status)}
                              className={`px-12 py-6 rounded-3xl text-sm font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 border-b-4 ${languageSimilarity === status
                                ? 'bg-indigo-600 text-white border-indigo-900 shadow-indigo-200'
                                : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                                }`}
                            >
                              <i className={`fa-solid fa-circle-${status === 'yes' ? 'check' : 'xmark'} mr-2`}></i>
                              {status === 'yes' ? 'Yes' : 'No'}
                            </button>
                          ))}
                        </div>

                        {languageSimilarity === 'no' && (
                          <div className="animate-in slide-in-from-top-4 duration-300">
                            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 px-4">
                              {t('why_justification', language)}
                            </label>
                            <textarea
                              className="w-full p-8 bg-red-50/30 border border-red-100 rounded-[2.5rem] font-medium text-slate-700 focus:ring-4 focus:ring-red-100 outline-none transition-all"
                              rows={4}
                              placeholder={t('missing_placeholder', language)}
                              value={languageSimilarityJustification}
                              onChange={(e) => setLanguageSimilarityJustification(e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* CULTURAL ALIGNMENT SCORING */}
                  <div className="pb-16 max-w-4xl mx-auto">
                    <div className="bg-white rounded-[4rem] border border-slate-100 shadow-2xl p-16 space-y-12 animate-in slide-in-from-bottom-8">
                      <div className="text-center space-y-4">
                        <h3 className="text-3xl font-black text-slate-900 italic tracking-tight">
                          {t('score_question', language)}
                        </h3>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                          {t('cultural_score', language)}
                        </p>
                      </div>

                      <div className="space-y-12">
                        {/* Range Meter */}
                        <div className="relative pt-12 pb-8 px-4">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={culturalScore}
                            onChange={(e) => setCulturalScore(parseInt(e.target.value))}
                            className="w-full h-4 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600"
                          />
                          <div className="absolute top-0 left-0 w-full flex justify-between px-4">
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-black text-slate-400">0</span>
                              <div className="w-0.5 h-2 bg-slate-200 mt-1"></div>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-black text-slate-400">25</span>
                              <div className="w-0.5 h-2 bg-slate-200 mt-1"></div>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-black text-slate-400">50</span>
                              <div className="w-0.5 h-2 bg-slate-200 mt-1"></div>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-black text-slate-400">75</span>
                              <div className="w-0.5 h-2 bg-slate-200 mt-1"></div>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-black text-slate-400">100</span>
                              <div className="w-0.5 h-2 bg-slate-200 mt-1"></div>
                            </div>
                          </div>
                          <div className="text-center mt-8">
                            <span className="text-7xl font-black text-indigo-600 italic tracking-tighter">
                              {culturalScore}
                            </span>
                            <span className="text-2xl font-black text-slate-300 ml-2">%</span>
                          </div>
                        </div>

                        {/* Scoring Guide Display */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-slate-50/50 p-10 rounded-[3rem] border border-slate-100">
                          <div className="space-y-4">
                            <h4 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center">
                              <i className="fa-solid fa-circle-info mr-3 text-indigo-500"></i>
                              {t('scoring_guide_title', language)}
                            </h4>
                            <div className="space-y-1">
                              <p className={`text-xs font-bold transition-all ${culturalScore === 0 ? 'text-indigo-600 scale-105 origin-left' : 'text-slate-400 opacity-60'}`}>0: {t('score_0', language)}</p>
                              <p className={`text-xs font-bold transition-all ${culturalScore > 0 && culturalScore <= 20 ? 'text-indigo-600 scale-105 origin-left' : 'text-slate-400 opacity-60'}`}>1-20: {t('score_1_20', language)}</p>
                              <p className={`text-xs font-bold transition-all ${culturalScore > 20 && culturalScore <= 40 ? 'text-indigo-600 scale-105 origin-left' : 'text-slate-400 opacity-60'}`}>21-40: {t('score_21_40', language)}</p>
                              <p className={`text-xs font-bold transition-all ${culturalScore > 40 && culturalScore <= 60 ? 'text-indigo-600 scale-105 origin-left' : 'text-slate-400 opacity-60'}`}>41-60: {t('score_41_60', language)}</p>
                              <p className={`text-xs font-bold transition-all ${culturalScore > 60 && culturalScore <= 80 ? 'text-indigo-600 scale-105 origin-left' : 'text-slate-400 opacity-60'}`}>61-80: {t('score_61_80', language)}</p>
                              <p className={`text-xs font-bold transition-all ${culturalScore > 80 && culturalScore <= 100 ? 'text-indigo-600 scale-105 origin-left' : 'text-slate-400 opacity-60'}`}>81-100: {t('score_81_100', language)}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-center justify-center p-8 bg-white rounded-[2.5rem] shadow-xl border border-slate-100">
                            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                              <i className={`fa-solid ${culturalScore > 60 ? 'fa-face-laugh-beam text-emerald-500' : culturalScore > 20 ? 'fa-face-smile text-amber-500' : 'fa-face-meh text-slate-400'} text-3xl`}></i>
                            </div>
                            <p className="text-sm font-black text-slate-900 italic">
                              {culturalScore === 0 ? t('score_0', language) :
                                culturalScore <= 20 ? t('score_1_20', language) :
                                  culturalScore <= 40 ? t('score_21_40', language) :
                                    culturalScore <= 60 ? t('score_41_60', language) :
                                      culturalScore <= 80 ? t('score_61_80', language) : t('score_81_100', language)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
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

      <AnnotationModal
        isOpen={isTextModalOpen}
        onClose={() => setIsTextModalOpen(false)}
        onSave={saveTextAnnotation}
        selection={currentSelection}
        editingAnnotation={editingTextAnnotation}
        language={language}
        projectGuideline={projects.find(p => p.id === currentTask?.projectId)?.guideline}
      />
      <TextIssueModal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        onSave={saveIssueAnnotation}
        selection={currentSelection}
        editingAnnotation={editingTextAnnotation}
        language={language}
      />
      {/* TYPE SELECTOR MODAL */}
      {
        isTypeSelectorOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-sm transform animate-in zoom-in-95 duration-200 border border-slate-100">
              <h3 className="text-lg font-black text-slate-900 text-center mb-6 italic">{t('select_category', language)}</h3>
              <div className="space-y-4">
                <button
                  onClick={() => handleChooseType('culture')}
                  className="w-full py-6 bg-indigo-50 border-2 border-indigo-100 rounded-2xl flex flex-col items-center hover:bg-indigo-100 hover:border-indigo-300 transition-all group"
                >
                  <i className="fa-solid fa-earth-americas text-2xl text-indigo-600 mb-2 group-hover:scale-110 transition-transform"></i>
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-900">{t('culture_marker', language)}</span>
                </button>
                <button
                  onClick={() => handleChooseType('issue')}
                  className="w-full py-6 bg-red-50 border-2 border-red-100 rounded-2xl flex flex-col items-center hover:bg-red-100 hover:border-red-300 transition-all group"
                >
                  <i className="fa-solid fa-circle-exclamation text-2xl text-red-600 mb-2 group-hover:scale-110 transition-transform"></i>
                  <span className="text-xs font-black uppercase tracking-widest text-red-900">
                    {(pendingPin || editingImageAnno) ? t('image_issue', language) : t('text_issue', language)}
                  </span>
                </button>
              </div>
              <button
                onClick={() => { setIsTypeSelectorOpen(false); setCurrentSelection(null); }}
                className="w-full mt-6 py-3 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-600 transition-colors"
              >
                {t('cancel', language)}
              </button>
            </div>
          </div>
        )
      }
      <ImageAnnotationModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        onSave={saveImageAnnotation}
        existingAnnotation={editingImageAnno}
        language={language}
      />
      <ImageIssueModal
        isOpen={isImageIssueModalOpen}
        onClose={() => setIsImageIssueModalOpen(false)}
        onSave={(data) => saveImageAnnotation({
          ...data,
          subtype: 'issue',
          // Provide default values for other required properties of ImageAnnotation
          description: '',
          comment: '',
          isPresent: 'na',
          presentJustification: '',
          isRelevant: 'na',
          relevantJustification: '',
          isSupported: 'na',
          supportedJustification: '',
          shapeType: editingImageAnno?.shapeType || pendingPin?.shapeType || 'rect', // Fallback to existing or pending shape
          cultureProxy: '',
        })}
        existingAnnotation={editingImageAnno}
        language={language}
      />
      <GuidelinesModal
        isOpen={isGuidelinesModalOpen}
        onClose={() => setIsGuidelinesModalOpen(false)}
        language={language}
        projectGuideline={projects.find(p => p.id === currentTask?.projectId)?.guideline}
      />
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