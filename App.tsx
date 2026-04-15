
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
  const [adminTab, setAdminTab] = useState<'users' | 'tasks' | 'annotations' | 'score_annotations' | 'projects' | 'agreement'>('users');
  const [language, setLanguage] = useState<Language>('en');

  // Platform Resources
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [globalLog, setGlobalLog] = useState<Annotation[]>([]);
  const [globalImageLog, setGlobalImageLog] = useState<ImageAnnotation[]>([]);
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [imageAnnotations, setImageAnnotations] = useState<Record<string, ImageAnnotation[]>>({});
  const [culturalScore, setCulturalScore] = useState<number>(0);
  const [languageSimilarity, setLanguageSimilarity] = useState<DecisionStatus>('na');
  const [languageSimilarityJustification, setLanguageSimilarityJustification] = useState<string>('');
  const [generalComment, setGeneralComment] = useState<string>('');
  const [textConnectness, setTextConnectness] = useState<Record<number, string>>({});
  const [imageConnectness, setImageConnectness] = useState<Record<number, string>>({});
  const [globalFeedback, setGlobalFeedback] = useState<Partial<UserTaskSubmission>>({
    health_safety: false,
    medically_misleading: false,
    culture_generic: false,
    cultural_stereotypical: false,
    persona_consistency_strong: false,
    persona_consistency_broken: false,
    advice_practical: false,
    advice_vague: false,
    advice_unrealistic: false,
    images_match_story: false,
    images_mismatch_persona: false,
    ai_artifacts: false,
    story_engaging: false,
    story_confusing: false,
    story_supportive: false,
    story_tone_inappropriate: false,
  });

  // UI Modal State
  const [currentSelection, setCurrentSelection] = useState<SelectionState | null>(null);
  const [isReviewingCompleted, setIsReviewingCompleted] = useState(false);
  const [editingTextAnnotation, setEditingTextAnnotation] = useState<Annotation | null>(null);
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isImageIssueModalOpen, setIsImageIssueModalOpen] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState<number | null>(null);
  const [pendingPin, setPendingPin] = useState<{ x: number, y: number, width: number, height: number, shapeType: ShapeType } | null>(null);
  const [editingImageAnno, setEditingImageAnno] = useState<ImageAnnotation | null>(null);
  const [isGuidelinesModalOpen, setIsGuidelinesModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [adminProjectFilter, setAdminProjectFilter] = useState<string | null>(null);
  const [inspectUserId, setInspectUserId] = useState<string | null>(null); // For Admin to inspect specific user work
  const [loadError, setLoadError] = useState<string | null>(null); // To show if data failed to load
  const [isTaskLoading, setIsTaskLoading] = useState(false); // Reactive flag to disable nav buttons during load
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

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Track Unsaved Changes
  const initialLoadRef = useRef(true);
  // Suppresses the unsaved-changes watcher for one render cycle after a successful submit,
  // preventing the race where setShowResubmitSuccess(false) re-triggers the watcher.
  const isJustSubmitted = useRef(false);
  useEffect(() => {
    if (isTaskLoading || isLoadingTaskData.current) {
      initialLoadRef.current = true;
      setHasUnsavedChanges(false);
      return;
    }
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    if (isJustSubmitted.current) {
      isJustSubmitted.current = false;
      return;
    }
    setHasUnsavedChanges(true);
  }, [annotations, imageAnnotations, culturalScore, languageSimilarity, languageSimilarityJustification, generalComment, textConnectness, imageConnectness, globalFeedback]);

  // completedTaskIdsRef: keeps a stale-closure-safe copy so handleCommitTask
  // can read the latest completed list without being a useEffect dependency.
  const completedTaskIdsRef = useRef(completedTaskIds);
  useEffect(() => { completedTaskIdsRef.current = completedTaskIds; }, [completedTaskIds]);

  // Ref that prevents navigation from being triggered while loadTaskData is in flight.
  const isLoadingTaskData = useRef(false);

  // Guard against double-click race conditions on Next/Prev buttons.
  const isNavigating = useRef(false);


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

  // --- START TASK INDEX MANAGEMENT ---
  // Ensure the task index is reset to 0 when the project filter or inspect user changes.
  // This prevents seeing annotations for 'non-existent' tasks after changing views.
  useEffect(() => {
    setCurrentTaskIndex(0);
  }, [adminProjectFilter]);

  // Clamp the task index if it's out of bounds (e.g. after project change or task count shrinks).
  useEffect(() => {
    if (visibleTasks.length > 0 && currentTaskIndex >= visibleTasks.length) {
      setCurrentTaskIndex(0);
    }
  }, [visibleTasks.length, currentTaskIndex]);
  // --- END TASK INDEX MANAGEMENT ---

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

  // Map each annotation to exactly ONE paragraph by finding its true global
  // occurrence in the full task text, and finding which paragraph bounds it.
  // This solves offset drift and "cross-paragraph" duplicates simultaneously.
  const annotationParagraphMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!currentTask || paragraphs.length === 0) return map;
    
    const fullText = currentTask.text;

    annotations.forEach(a => {
      if (!a.text) return; // Skip invalid

      // Find all global occurrences
      const candidates: number[] = [];
      let searchIdx = 0;
      while (searchIdx < fullText.length) {
        const found = fullText.indexOf(a.text, searchIdx);
        if (found === -1) break;
        candidates.push(found);
        searchIdx = found + 1;
      }

      if (candidates.length === 0) return;

      // Find the one closest to stored DB offset
      const bestGlobalStart = candidates.reduce((best, pos) => 
        Math.abs(pos - a.start) < Math.abs(best - a.start) ? pos : best
      );

      // Which paragraph contains this best global start?
      let bestIdx = -1;
      for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i];
        if (bestGlobalStart >= p.offset && bestGlobalStart <= p.offset + p.text.length) {
          bestIdx = i;
          break;
        }
      }

      // If it falls in a trailing space/newline gap, assign to closest paragraph
      if (bestIdx === -1) {
        let minDiff = Infinity;
        for (let i = 0; i < paragraphs.length; i++) {
          const p = paragraphs[i];
          const pCenter = p.offset + p.text.length / 2;
          const diff = Math.abs(bestGlobalStart - pCenter);
          if (diff < minDiff) { 
             minDiff = diff; 
             bestIdx = i; 
          }
        }
      }
      
      map.set(a.id, bestIdx);
    });
    return map;
  }, [annotations, paragraphs, currentTask]);

  const ConnectednessButtons = ({ type, index, state, setState, annotationsCount }: { type: 'text' | 'image', index: number, state: Record<number, string>, setState: React.Dispatch<React.SetStateAction<Record<number, string>>>, annotationsCount: number }) => {
    const value = state[index] || '';
    const options = ['disconnected', 'connected', 'very_connected'];

    return (
      <div className="mt-4 p-6 bg-white border border-slate-100 rounded-3xl shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
        <label className="block text-xs font-black text-slate-700 italic mb-4">

          {type === 'text' ? t('text_connectedness_question', language) : t('image_connectedness_question', language)}
        </label>
        <div className="flex space-x-3">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => setState(prev => ({ ...prev, [index]: opt }))}
              className={`flex-1 py-3 px-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${value === opt
                ? 'bg-slate-900 text-white border-slate-900 shadow-lg scale-[1.02]'
                : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                }`}
            >
              {t(`${opt}` as any, language)}
            </button>
          ))}
        </div>


        <div className={`mt-4 flex items-start text-[11px] p-4 rounded-2xl border transition-all duration-300 ${annotationsCount === 0
          ? 'text-amber-600 bg-amber-50/50 border-amber-100/50 animate-in fade-in slide-in-from-top-2'
          : 'text-slate-400 bg-slate-50/30 border-slate-100/50'
          }`}>
          <i className={`fa-solid ${annotationsCount === 0 ? 'fa-circle-exclamation' : 'fa-circle-check'} mr-3 mt-0.5 ${annotationsCount === 0 ? 'text-amber-500' : 'text-slate-400'}`}></i>
          <span className="font-bold leading-relaxed">
            {type === 'text' ? t('text_highlight_instruction', language) : t('image_highlight_instruction', language)}
          </span>
        </div>

      </div>
    );
  };

  const GlobalFeedbackToggles = () => {
    const feedbackKeys: (keyof UserTaskSubmission)[] = [
      'health_safety',
      'medically_misleading',
      'culture_generic',
      'cultural_stereotypical',
      'persona_consistency_strong',
      'persona_consistency_broken',
      'advice_practical',
      'advice_vague',
      'advice_unrealistic',
      'images_match_story',
      'images_mismatch_persona',
      'ai_artifacts',
      'story_engaging',
      'story_confusing',
      'story_supportive',
      'story_tone_inappropriate'
    ];

    return (
      <div className="bg-slate-50/50 rounded-[2.5rem] border border-slate-100 overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-100/30">
              <th className="px-8 py-2 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('feedback_item', language)}</th>
              <th className="px-8 py-2 text-center text-[10px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap"> {t('select_all', language)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {feedbackKeys.map((key) => (
              <tr key={key} className="hover:bg-white transition-all group">
                <td className="px-8 py-2">
                  <span className="text-[14px] font-bold text-slate-700 leading-snug group-hover:text-indigo-600 transition-colors">
                    {t(key as any, language)}
                  </span>
                </td>
                <td className="px-8 py-2 text-center">
                  <button
                    onClick={() => setGlobalFeedback(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm mx-auto border-2 ${globalFeedback[key as keyof typeof globalFeedback] === true
                      ? 'bg-indigo-600 border-indigo-600 text-white rotate-0'
                      : 'bg-white border-slate-200 text-slate-200 hover:border-indigo-200'
                      }`}
                  >
                    <i className={`fa-solid fa-check transition-all duration-300 ${globalFeedback[key as keyof typeof globalFeedback] === true ? 'scale-110 opacity-100' : 'scale-75 opacity-0'}`}></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const controlStats = useMemo(() => {
    if (!currentUser) return { percent: 0, show: false, empty: true };
    if (visibleTasks.length === 0) return { percent: 0, show: true, empty: true };

    // 1. Identify Control Tasks
    const controlTaskIds = visibleTasks
      .filter(t => t.taskType === 'control')
      .map(t => t.id);

    if (controlTaskIds.length === 0) return { percent: 0, show: true, empty: true };

    // 2. Filter User's Submissions for these tasks
    // Note: allTaskSubmissions contains ALL users' submissions, so we must filter by currentUser.id
    const myControlSubmissions = allTaskSubmissions.filter(s =>
      controlTaskIds.includes(s.taskId) && s.userId === currentUser.id
    );

    const total = myControlSubmissions.length;
    if (total === 0) return { percent: 0, show: true, empty: true };

    // 3. Count Incorrectly Rated (Score > 20)
    const incorrect = myControlSubmissions.filter(s => s.culturalScore > 20).length;

    // 4. Calculate Percentage
    const percent = (incorrect / total) * 100;

    return { percent, show: true, empty: false };
  }, [visibleTasks, allTaskSubmissions, currentUser]);

  const getControlEmoji = (percent: number) => {
    if (percent < 25) return '😊';
    if (percent <= 50) return '😠'; // 25-50 inclusive of 50? user said 25-50
    if (percent <= 75) return '😡'; // 50-75
    return '😭'; // > 75
  };

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
        const [usersData, projectsData, tasksData, projectAssignmentsData, taskAssignmentsData, globalAnnotationsData, globalImageAnnotationsData, allSubmissionsData] = await Promise.all([
          supabaseService.fetchUsers(),
          supabaseService.fetchProjects(),
          supabaseService.fetchTasks(),
          supabaseService.fetchProjectAssignments(),
          supabaseService.fetchTaskAssignments(),
          supabaseService.fetchAllAnnotations(),
          supabaseService.fetchAllImageAnnotations(),
          supabaseService.fetchAllUserTaskSubmissions()
        ]);

        if (!isMounted.current) return; // Prevent state updates if component unmounted

        setUsers(usersData);
        setProjects(projectsData);
        setTasks(tasksData);
        setProjectAssignments(projectAssignmentsData);
        setAssignments(taskAssignmentsData);
        setGlobalLog(globalAnnotationsData);
        setGlobalImageLog(globalImageAnnotationsData);
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

    let ignore = false;

    const loadTaskData = async () => {
      isLoadingTaskData.current = true;
      setIsTaskLoading(true);
      setLoadError(null);
      
      // Wipe state before loading
      setAnnotations([]);
      setImageAnnotations({});
      setCulturalScore(0);
      setLanguageSimilarity('na');
      setLanguageSimilarityJustification('');
      setGeneralComment('');
      setTextConnectness({});
      setImageConnectness({});
      setGlobalFeedback({
        health_safety: false,
        medically_misleading: false,
        culture_generic: false,
        cultural_stereotypical: false,
        persona_consistency_strong: false,
        persona_consistency_broken: false,
        advice_practical: false,
        advice_vague: false,
        advice_unrealistic: false,
        images_match_story: false,
        images_mismatch_persona: false,
        ai_artifacts: false,
        story_engaging: false,
        story_confusing: false,
        story_supportive: false,
        story_tone_inappropriate: false,
      });

      try {
        const fetchUserId = inspectUserId || currentUser.id!;
        const [completedIds, annotationsData, imageAnnotationsData, submission] = await Promise.all([
          supabaseService.fetchCompletedTaskIds(fetchUserId),
          supabaseService.fetchAnnotations(currentTask.id, fetchUserId),
          supabaseService.fetchImageAnnotations(currentTask.id, fetchUserId),
          supabaseService.fetchTaskSubmission(currentTask.id, fetchUserId)
        ]);

        if (!isMounted.current || ignore) return;

        setCompletedTaskIds(completedIds);

        setAnnotations(annotationsData);
        setImageAnnotations(imageAnnotationsData);

        if (submission) {
          setCulturalScore(submission.cultural_score || 0);
          setLanguageSimilarity(submission.language_similarity || 'na');
          setLanguageSimilarityJustification(submission.language_similarity_justification || '');
          setGeneralComment(submission.general_comment || '');
          setTextConnectness(submission.text_connectness || {});
          setImageConnectness(submission.image_connectness || {});
          setGlobalFeedback({
            health_safety: submission.health_safety || false,
            medically_misleading: submission.medically_misleading || false,
            culture_generic: submission.culture_generic || false,
            cultural_stereotypical: submission.cultural_stereotypical || false,
            persona_consistency_strong: submission.persona_consistency_strong || false,
            persona_consistency_broken: submission.persona_consistency_broken || false,
            advice_practical: submission.advice_practical || false,
            advice_vague: submission.advice_vague || false,
            advice_unrealistic: submission.advice_unrealistic || false,
            images_match_story: submission.images_match_story || false,
            images_mismatch_persona: submission.images_mismatch_persona || false,
            ai_artifacts: submission.ai_artifacts || false,
            story_engaging: submission.story_engaging || false,
            story_confusing: submission.story_confusing || false,
            story_supportive: submission.story_supportive || false,
            story_tone_inappropriate: submission.story_tone_inappropriate || false,
          });
        }
        
        setIsTaskLoading(false);
      } catch (error) {
        if (!isMounted.current || ignore) return;
        console.error('Error loading task data:', error);
        setLoadError('Failed to load annotations. Please refresh to try again.');
        setIsTaskLoading(false);
      }
    };

    loadTaskData();
    return () => {
      ignore = true;
      // Optional: Clear highlights when task changes to avoid flash of old content
      // setAnnotations([]); 
    };
  }, [isAuthenticated, currentUser?.id, currentTask?.id, inspectUserId]); // Re-load when inspecting a specific user

  // Clear the isLoadingTaskData guard once loading is done so nav buttons re-enable.
  useEffect(() => {
    if (!isTaskLoading && isLoadingTaskData.current) {
      isLoadingTaskData.current = false;
    }
  }, [isTaskLoading]);

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

  const bulkAddTasks = useCallback(async (tasksList: any[]) => {
    try {
      if (!supabaseService.supabase) throw new Error("Supabase is not configured.");
      
      await supabaseService.bulkCreateTasks(tasksList);
      
      const updatedTasks = await supabaseService.fetchTasks();
      if (!isMounted.current) return;
      setTasks(updatedTasks);
      alert("Tasks imported successfully!");
    } catch (error) {
      if (isMounted.current) {
        console.error('Error in bulkAddTasks:', error);
        alert('Failed to bulk add tasks: ' + (error as Error).message);
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
        metadata: t.metadata || {}
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
            languageSimilarityJustification: taskSubmission?.languageSimilarityJustification || '',
            generalComment: taskSubmission?.generalComment || '',
            textConnectness: taskSubmission?.text_connectness || {},
            imageConnectness: taskSubmission?.image_connectness || {},
            globalFeedback: {
              health_safety: taskSubmission?.health_safety || false,
              medically_misleading: taskSubmission?.medically_misleading || false,
              culture_generic: taskSubmission?.culture_generic || false,
              cultural_stereotypical: taskSubmission?.cultural_stereotypical || false,
              persona_consistency_strong: taskSubmission?.persona_consistency_strong || false,
              persona_consistency_broken: taskSubmission?.persona_consistency_broken || false,
              advice_practical: taskSubmission?.advice_practical || false,
              advice_vague: taskSubmission?.advice_vague || false,
              advice_unrealistic: taskSubmission?.advice_unrealistic || false,
              images_match_story: taskSubmission?.images_match_story || false,
              images_mismatch_persona: taskSubmission?.images_mismatch_persona || false,
              ai_artifacts: taskSubmission?.ai_artifacts || false,
              story_engaging: taskSubmission?.story_engaging || false,
              story_confusing: taskSubmission?.story_confusing || false,
              story_supportive: taskSubmission?.story_supportive || false,
              story_tone_inappropriate: taskSubmission?.story_tone_inappropriate || false,
            }
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
      let data;
      try {
        data = JSON.parse(text_content);
      } catch (e) {
        if (isMounted.current) alert(t("import_error_invalid_json" as any, language) || "Invalid JSON file");
        return;
      }

      if (!data.project || !data.tasks) {
        if (isMounted.current) alert(t("import_error_missing_data" as any, language) || "Invalid project file format: missing project or tasks");
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
      for (const tTask of data.tasks) {
        const taskToUpsert: Task = {
          ...tTask,
          id: isValidUuid(tTask.id) ? tTask.id : generateUuid(),
          text: tTask.text || (tTask.paragraphs && Array.isArray(tTask.paragraphs) ? tTask.paragraphs.join('\n\n') : ''),
          images: tTask.images || [],
          audio: tTask.audio || [],
          question: tTask.question || '',
          category: tTask.category || '',
          gender: tTask.gender || 'neutral',
          taskType: tTask.taskType || 'independent',
          metadata: tTask.metadata || {}
        };
        if (!isValidUuid(tTask.id)) {
          console.warn(`Invalid UUID found for task ID: "${tTask.id}". Regenerating to "${taskToUpsert.id}".`);
        }
        await supabaseService.upsertTask(taskToUpsert);
      }
      const updatedTasks = await supabaseService.fetchTasks();
      if (!isMounted.current) return;
      setTasks(updatedTasks);

      // 3. Create or Update Annotations (Optional)
      if (data.annotations && Array.isArray(data.annotations)) {
        for (const userImport of data.annotations) {
          const { userEmail, userId, completedTaskIds, taskData } = userImport;
          if (!userEmail || !userId) {
            console.warn(`Skipping user import due to missing email or ID:`, userImport);
            continue;
          }

          for (const taskId of completedTaskIds || []) {
            // Fetch existing submission first to avoid overwriting connectedness and feedback
            const existing = await supabaseService.fetchTaskSubmission(taskId, userId);
            await supabaseService.saveTaskSubmission(
              taskId, 
              userId, 
              existing?.cultural_score || 0,
              existing?.language_similarity || 'na',
              existing?.language_similarity_justification || '',
              existing?.general_comment || '',
              true,
              existing?.text_connectness || {},
              existing?.image_connectness || {},
              existing ? {
                health_safety: existing.health_safety,
                medically_misleading: existing.medically_misleading,
                culture_generic: existing.culture_generic,
                cultural_stereotypical: existing.cultural_stereotypical,
                persona_consistency_strong: existing.persona_consistency_strong,
                persona_consistency_broken: existing.persona_consistency_broken,
                advice_practical: existing.advice_practical,
                advice_vague: existing.advice_vague,
                advice_unrealistic: existing.advice_unrealistic,
                images_match_story: existing.images_match_story,
                images_mismatch_persona: existing.images_mismatch_persona,
                ai_artifacts: existing.ai_artifacts,
                story_engaging: existing.story_engaging,
                story_confusing: existing.story_confusing,
                story_supportive: existing.story_supportive,
                story_tone_inappropriate: existing.story_tone_inappropriate,
              } : {}
            );
            if (isMounted.current) {
              setCompletedTaskIds(prev => Array.from(new Set([...prev, taskId])));
            }
          }

          for (const [taskId, tData] of Object.entries(taskData || {})) {
            await supabaseService.saveTaskSubmission(
              taskId,
              userId,
              (tData as any).culturalScore || 0,
              (tData as any).languageSimilarity || 'na',
              (tData as any).languageSimilarityJustification || '',
              (tData as any).generalComment || '',
              true,
              (tData as any).textConnectness || {},
              (tData as any).imageConnectness || {},
              (tData as any).globalFeedback || {}
            );

            const incomingAnnos = (tData as any).annotations || [];
            await supabaseService.saveAnnotations(taskId, userId, incomingAnnos);

            const incomingImgAnnos = (tData as any).imageAnnotations || {};
            const flatIncomingImgAnnos: ImageAnnotation[] = Object.entries(incomingImgAnnos).flatMap(([paraIdx, annos]) =>
              (annos as any[]).map(a => ({ ...a, paragraph_index: parseInt(paraIdx) }))
            );
            await supabaseService.saveImageAnnotationsFlat(taskId, userId, flatIncomingImgAnnos);
          }
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
      setSubmissionUpdateKey(prev => prev + 1);

      if (currentUser) {
        const [userCompletedTasks, userAnnotations, userImageAnnotations] = await Promise.all([
          supabaseService.fetchCompletedTaskIds(currentUser.id!),
          currentTask?.id ? supabaseService.fetchAnnotations(currentTask.id, currentUser.id!) : Promise.resolve([]),
          currentTask?.id ? (supabaseService.fetchImageAnnotations ? supabaseService.fetchImageAnnotations(currentTask.id, currentUser.id!) : Promise.resolve({})) : Promise.resolve({}),
        ]);
        if (isMounted.current) {
          setCompletedTaskIds(userCompletedTasks);
          setAnnotations(userAnnotations);
          setImageAnnotations(userImageAnnotations as Record<number, ImageAnnotation[]>);
        }
      }

      if (isMounted.current) alert(t("import_success" as any, language) || "Project imported successfully!");

    } catch (error) {
      if (isMounted.current) {
        alert((t("import_error_failed" as any, language) || "Failed to import project: ") + (error instanceof Error ? error.message : String(error)));
        console.error("Import error:", error);
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

  const navigateWithGuard = (action: () => void) => {
    if (hasUnsavedChanges) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to leave? Your unsaved work will be lost.")) {
        return;
      }
    }
    action();
  };

  const nextTask = async () => {
    navigateWithGuard(() => {
      if (isNavigating.current || isLoadingTaskData.current) return;
      isNavigating.current = true;
      try {
        stopAudio();
        if (currentTaskIndex < visibleTasks.length - 1) {
          setCurrentTaskIndex(currentTaskIndex + 1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } finally {
        isNavigating.current = false;
      }
    });
  };

  const prevTask = async () => {
    navigateWithGuard(() => {
      if (isNavigating.current || isLoadingTaskData.current) return;
      isNavigating.current = true;
      try {
        stopAudio();
        if (currentTaskIndex > 0) {
          setCurrentTaskIndex(currentTaskIndex - 1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } finally {
        isNavigating.current = false;
      }
    });
  };

  const handleSelect = (s: SelectionState) => {
    // Read-only in admin inspect mode — never allow new annotations to be created
    if (inspectUserId) return;

    // Overlap check: use offset-based detection but with a small tolerance,
    // since stored DB offsets can drift slightly from rendered positions.
    // A true overlap means the ranges intersect (not just touch at boundaries).
    const overlaps = annotations.some(a =>
      s.start < a.end && s.end > a.start
    );
    if (!overlaps) {
      setEditingTextAnnotation(null);
      // Clear any pending image selection state to prevent conflicts
      setPendingPin(null);
      setEditingImageAnno(null);
      setActiveImageIdx(null);

      setCurrentSelection(s);
      setIsTextModalOpen(true);
    }
  };



  const handleEditHighlight = (anno: Annotation) => {
    // Read-only in admin inspect mode — block editing inspected user's annotations
    if (inspectUserId) return;
    setEditingTextAnnotation(anno);
    setCurrentSelection(null);
    if (anno.subtype === 'issue') {
      setIsIssueModalOpen(true);
    } else {
      setIsTextModalOpen(true);
    }
  };
  const handleDeleteTextAnnotation = async () => {
    if (!editingTextAnnotation || !currentTask || !currentUser) return;
    setIsTextModalOpen(false);

    const id = editingTextAnnotation.id;
    const updatedAnnos = annotations.filter(a => a.id !== id);
    setAnnotations(updatedAnnos);
    setEditingTextAnnotation(null);
  };

  const saveTextAnnotation = async (
    comment: string,
    isImportant: boolean,
    isRelevant: DecisionStatus,
    relevantJustification: string,
    isSupported: DecisionStatus,
    supportedJustification: string,
    cultureProxy: string,
    rating: number
  ) => {
    if (!currentTask || !currentUser?.id) return;
    setIsTextModalOpen(false); // Close modal early to avoid double renders

    setAnnotations(prev => {
      let updated: Annotation[];
      if (editingTextAnnotation) {
        updated = prev.map(a => a.id === editingTextAnnotation.id ? {
          ...a,
          comment,
          isImportant,
          isRelevant,
          relevantJustification,
          isSupported,
          supportedJustification,
          cultureProxy,
          rating,
          timestamp: Date.now()
        } : a);
      } else if (currentSelection) {
        const newAnnotation: Annotation = {
          id: generateUuid(),
          ...currentSelection,
          comment,
          isImportant,
          isRelevant,
          relevantJustification,
          isSupported,
          supportedJustification,
          cultureProxy,
          rating,
          type: 'manual',
          timestamp: Date.now(),
          userEmail: currentUser?.email,
          userId: currentUser.id,
          taskId: currentTask.id,
          submissionTaskId: currentTask.id,
          submissionUserId: currentUser.id,
          subtype: 'culture'
        };
        updated = [...prev, newAnnotation];
      } else {
        return prev;
      }

      return updated;
    });

    setCurrentSelection(null);
    setEditingTextAnnotation(null);
  };

  const saveIssueAnnotation = async (category: string, description: string) => {
    if (!currentTask || !currentUser?.id) return;
    setIsIssueModalOpen(false);

    setAnnotations(prev => {
      let updated: Annotation[];
      if (editingTextAnnotation) {
        updated = prev.map(a => a.id === editingTextAnnotation.id ? {
          ...a,
          issueCategory: category,
          issueDescription: description,
          timestamp: Date.now()
        } : a);
      } else if (currentSelection) {
        const newAnnotation: Annotation = {
          id: generateUuid(),
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
          submissionTaskId: currentTask.id,
          submissionUserId: currentUser.id,
        };
        updated = [...prev, newAnnotation];
      } else {
        return prev;
      }

      return updated;
    });

    setCurrentSelection(null);
    setEditingTextAnnotation(null);
  };

  const handleAddPin = (paraIdx: number, x: number, y: number, width: number, height: number, shapeType: ShapeType) => {
    // Read-only in admin inspect mode
    if (inspectUserId) return;
    setActiveImageIdx(paraIdx);

    // Clear any pending text selection state
    setCurrentSelection(null);
    setEditingTextAnnotation(null);

    setPendingPin({ x, y, width, height, shapeType });
    setEditingImageAnno(null);
    setIsImageModalOpen(true);
  };

  const handleEditPin = (paraIdx: number, anno: ImageAnnotation) => {
    // Read-only in admin inspect mode
    if (inspectUserId) return;
    setActiveImageIdx(paraIdx);
    setEditingImageAnno(anno);
    setPendingPin(null);
    if (anno.subtype === 'issue') {
      setIsImageIssueModalOpen(true);
    } else {
      setIsImageModalOpen(true);
    }
  };

  const handleDeleteImageAnnotation = async () => {
    if (!editingImageAnno || activeImageIdx === null || !currentTask || !currentUser) return;
    const paraIdxKey = activeImageIdx.toString();
    setIsImageModalOpen(false);

    setImageAnnotations(prev => {
      const currentAnnos = prev[paraIdxKey] || [];
      const updatedImageAnnos = currentAnnos.filter(a => a.id !== editingImageAnno.id);
      return { ...prev, [paraIdxKey]: updatedImageAnnos };
    });

    setEditingImageAnno(null);
    setPendingPin(null);
  };

  const saveImageAnnotation = async (data: Omit<ImageAnnotation, 'id' | 'x' | 'y' | 'width' | 'height' | 'timestamp' | 'userId' | 'taskId' | 'userEmail' | 'paragraph_index' | 'submissionTaskId' | 'submissionUserId'> & { rating: number }) => {
    if (activeImageIdx === null || !currentTask || !currentUser?.id) return;
    const paraIdxKey = activeImageIdx.toString();
    setIsImageModalOpen(false);
    setIsImageIssueModalOpen(false);

    setImageAnnotations(prev => {
      let updatedImageAnnos: ImageAnnotation[];
      const currentListForPara = prev[paraIdxKey] || [];

      if (editingImageAnno) {
        updatedImageAnnos = currentListForPara.map(a => a.id === editingImageAnno.id ? { ...a, ...data } : a);
      } else if (pendingPin) {
        const newAnno: ImageAnnotation = {
          id: generateUuid(),
          x: pendingPin.x,
          y: pendingPin.y,
          width: pendingPin.width,
          height: pendingPin.height,
          shapeType: pendingPin.shapeType,
          timestamp: Date.now(),
          userEmail: currentUser?.email,
          userId: currentUser.id,
          taskId: currentTask.id,
          submissionTaskId: currentTask.id,
          submissionUserId: currentUser.id,
          paragraph_index: activeImageIdx!,
          description: data.description || '',
          comment: data.comment || '',
          isPresent: data.isPresent || 'na',
          presentJustification: data.presentJustification || '',
          isRelevant: data.isRelevant || 'na',
          relevantJustification: data.relevantJustification || '',
          isSupported: data.isSupported || 'na',
          supportedJustification: data.supportedJustification || '',
          cultureProxy: data.cultureProxy || '',
          subtype: data.subtype || 'culture',
          issueCategory: data.issueCategory,
          issueDescription: data.issueDescription,
          rating: data.rating,
        };
        updatedImageAnnos = [...currentListForPara, newAnno];
      } else {
        return prev;
      }

      return { ...prev, [paraIdxKey]: updatedImageAnnos };
    });

    setEditingImageAnno(null);
    setPendingPin(null);
  };

  const handleCommitTask = async () => {
    if (!currentTask || !currentUser?.id) return;

    // Strict Validation: Check if Yes/No selections have at least one annotation
    const validationErrors: string[] = [];

    paragraphs.forEach((para, idx) => {
      // Check Text Connectedness directly from state
      const currentTextConn = textConnectness[idx];
      if (currentTextConn && currentTextConn !== '') {
        const hasTextAnno = annotations.some(a => a.start >= para.offset && a.end <= para.offset + para.text.length);
        if (!hasTextAnno) {
          validationErrors.push(`${t('paragraph_label', language)} #${idx + 1}`);
        }
      }

      // Check Image Connectedness directly from state
      const currentImageConn = imageConnectness[idx];
      if (currentImageConn && currentImageConn !== '') {
        const hasImageAnno = imageAnnotations[idx.toString()] && imageAnnotations[idx.toString()].length > 0;
        if (!hasImageAnno) {
          validationErrors.push(`Image #${idx + 1}`);
        }
      }
    });

    console.log(validationErrors.length);

    if (validationErrors.length > 0) {
      alert(`${t('validation_missing_annotations', language)}\n\nMissing: ${validationErrors.join(', ')}`);
      return;
    }

    const hasTextAnnotations = annotations.length > 0;
    const hasImageAnnotations = Object.values(imageAnnotations).some((list: any) => list.length > 0);

    if (!hasTextAnnotations && !hasImageAnnotations) {
      if (!window.confirm(t('confirm_empty_submission', language))) {
        return;
      }
    }

    if (inspectUserId) {
      alert("Read-only mode. You cannot submit or modify annotations while inspecting another user.");
      return;
    }

    try {
      await supabaseService.saveTaskSubmission(
        currentTask.id,
        currentUser.id,
        culturalScore,
        languageSimilarity,
        languageSimilarityJustification,
        generalComment,
        true, // Mark as completed
        textConnectness,
        imageConnectness,
        globalFeedback
      );
      
      // Explicitly flush pending annotations alongside submission
      await supabaseService.saveAnnotations(currentTask.id, inspectUserId || currentUser.id, annotations); // Changed to use fetchUserId just in case, though blocked by guard
      await supabaseService.saveImageAnnotations(currentTask.id, inspectUserId || currentUser.id, imageAnnotations);

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
      setHasUnsavedChanges(false);
      // Arm the just-submitted guard so the watcher ignores the state churn
      // caused by setShowResubmitSuccess(false) 1200ms later.
      isJustSubmitted.current = true;
      setTimeout(() => {
        if (!isMounted.current) return;
        setShowResubmitSuccess(false);
        if (currentTaskIndex < visibleTasks.length - 1) {
          // Navigate directly — data is already saved, no guard needed.
          stopAudio();
          setCurrentTaskIndex(currentTaskIndex + 1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          setIsReviewingCompleted(true);
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
    if (inspectUserId) {
      alert("Read-only mode. You cannot delete submissions while inspecting another user.");
      return;
    }
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
      setGeneralComment('');
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
        return [...prev, ...filtered];
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
        <>
          <button
            onClick={() => setIsGuidelinesModalOpen(true)}
            className="fixed bottom-28 right-8 w-16 h-16 bg-white text-indigo-600 border border-indigo-100 rounded-full shadow-[0_20px_50px_-10px_rgba(79,70,229,0.3)] z-[9999] flex items-center justify-center hover:scale-110 hover:bg-slate-50 active:scale-95 transition-all group"
            title="Guidelines"
          >
            <i className="fa-solid fa-book-open text-xl group-hover:rotate-12 transition-transform"></i>
          </button>
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="fixed bottom-8 right-8 w-16 h-16 bg-indigo-600 text-white rounded-full shadow-[0_20px_50px_-10px_rgba(79,70,229,0.5)] z-[9999] flex items-center justify-center hover:scale-110 hover:bg-indigo-700 active:scale-95 transition-all group"
            title="Researcher Profile"
          >
            <i className="fa-solid fa-solid fa-hospital-user text-2xl group-hover:rotate-12 transition-transform"></i>
          </button>
        </>
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
                  <button onClick={() => setAdminTab('annotations')} title={t('annotations_tab', language)} className={`p-3 rounded-xl transition-all ${adminTab === 'annotations' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><i className="fa-solid fa-database"></i></button>
                  <button onClick={() => setAdminTab('score_annotations')} title={t('score_annotations_tab', language)} className={`p-3 rounded-xl transition-all ${adminTab === 'score_annotations' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><i className="fa-solid fa-star"></i></button>
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
                  <button onClick={() => setAdminTab('score_annotations')} className={`w-full flex items-center px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${adminTab === 'score_annotations' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <i className="fa-solid fa-star mr-3 text-sm"></i> {t('score_annotations_tab', language)}
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
                        <div key={anno.id} className={`p-3.5 rounded-2xl border bg-white border-slate-100 text-[11px] hover:bg-slate-50 cursor-pointer group transition-all shadow-sm hover:shadow-md ${anno.subtype === 'issue' || anno.isSupported === 'no' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-indigo-500'}`} onClick={() => handleEditHighlight(anno)}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-800 italic truncate mr-2">"{anno.text}"</span>
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${anno.subtype === 'issue' || anno.isSupported === 'no' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                              {anno.subtype === 'issue' ? t('text_issue', language) : t('culture_marker', language).split(' ')[0]}
                            </span>
                            {!inspectUserId && <button onClick={(e) => { e.stopPropagation(); setAnnotations(prev => prev.filter(a => a.id !== anno.id)); }} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"><i className="fa-solid fa-trash-can text-[10px]"></i></button>}
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
                        <div key={anno.id} className={`p-3.5 rounded-2xl border bg-white border-slate-100 text-[11px] hover:bg-slate-50 cursor-pointer group transition-all shadow-sm hover:shadow-md ${anno.subtype === 'issue' || anno.isSupported === 'no' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-indigo-500'}`} onClick={() => handleEditPin(anno.paragraph_index!, anno)}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-800 capitalize truncate mr-2">
                              {anno.subtype === 'issue' ? t(anno.issueCategory as any, language) : anno.description || `${anno.shapeType} #${anno.id.slice(0, 4)}`}
                            </span>
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${anno.subtype === 'issue' || anno.isSupported === 'no' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                              {anno.subtype === 'issue' ? t('image_issue', language).split(' ')[1] : t('image_culture_marker', language).split(' ')[1]}
                            </span>
                            {!inspectUserId && <button onClick={(e) => {
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
                            </button>}
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
            onClick={() => navigateWithGuard(() => setViewMode('workspace'))}
            className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center active:scale-95 ${viewMode === 'workspace' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}
          >
            <i className={`fa-solid fa-code-branch ${isSidebarCollapsed ? '' : 'mr-3'}`}></i>
            {!isSidebarCollapsed && t('workspace_nav', language)}
          </button>

          {currentUser?.role === 'admin' && (
            <button
              onClick={() => navigateWithGuard(() => setViewMode('admin'))}
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
                      onChange={(e) => {
                        const val = e.target.value || null;
                        navigateWithGuard(() => setAdminProjectFilter(val));
                      }}
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

                {/* CONTROL TASK SCORE EMOJI */}
                {controlStats.show && (
                  <div className="flex items-center justify-center w-10 h-10 bg-white border border-slate-100 rounded-xl shadow-sm" title={controlStats.empty ? "No control tasks submitted" : `Error Rate: ${Math.round(controlStats.percent)}%`}>
                    <span className="text-xl" role="img" aria-label="performance">
                      {controlStats.empty ? '😶' : getControlEmoji(controlStats.percent)}
                    </span>
                  </div>
                )}

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
                  adminTab === 'projects' ? t('project_management', language) :
                  adminTab === 'annotations' ? t('annotations_tab', language) :
                  adminTab === 'score_annotations' ? t('score_annotations_tab', language) : t('agreement_tab', language)}
              </h2>
            )}
          </div>

          <div className="flex items-center space-x-8">
            {viewMode === 'workspace' && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={prevTask}
                  disabled={currentTaskIndex === 0 || isTaskLoading}
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
                    isTaskLoading ||
                    currentTaskIndex === visibleTasks.length - 1 ||
                    (
                      currentUser.role !== 'admin' &&
                      progressPercentage < 100 && completedTaskIds.length + 1 < currentTaskIndex + 2
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
                allImageAnnotations={globalImageLog}
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
                onBulkAddTasks={bulkAddTasks}
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
                onInspectUser={(userId, taskId) => {
                  setInspectUserId(userId);
                  if (taskId) {
                    // Update admin filter to 'all' to ensure the target task is visible in the workspace list
                    setAdminProjectFilter('all');
                    const idx = tasks.findIndex(t => t.id === taskId);
                    if (idx !== -1) setCurrentTaskIndex(idx);
                  }
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
                  {loadError && (
                    <div className="bg-red-50 border border-red-100 p-8 rounded-[2rem] flex items-center space-x-6 animate-in slide-in-from-top-4 mb-12 shadow-sm">
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 shrink-0">
                        <i className="fa-solid fa-triangle-exclamation text-xl"></i>
                      </div>
                      <div className="flex-1">
                        <p className="text-red-900 font-black italic text-lg leading-tight">{loadError}</p>
                        <p className="text-red-400 text-xs font-bold mt-1 uppercase tracking-widest">Database connection failed during handshake</p>
                      </div>
                      <button onClick={() => window.location.reload()} className="px-6 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg active:scale-95">
                        {t('refresh', language)}
                      </button>
                    </div>
                  )}

                  {inspectUserId && (
                    <div className="bg-amber-50 border border-amber-100 p-8 rounded-[2rem] flex items-center justify-between animate-in slide-in-from-top-4 mb-12 shadow-sm">
                      <div className="flex items-center space-x-6">
                        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shrink-0">
                          <i className="fa-solid fa-user-secret text-xl"></i>
                        </div>
                        <div>
                          <p className="text-amber-900 font-black italic text-lg leading-tight">Admin Review Mode Active</p>
                          <p className="text-amber-400 text-xs font-bold mt-1 uppercase tracking-widest">Inspecting work for user: {inspectUserId}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setInspectUserId(null);
                          setViewMode('admin');
                        }} 
                        className="px-6 py-3 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-lg active:scale-95"
                      >
                        Exit Review
                      </button>
                    </div>
                  )}

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
                            paragraphOffset={para.offset}
                            annotations={annotations
                              // Only guard against cross-task contamination via taskId.
                              .filter(a => (!a.taskId || a.taskId === currentTask.id) && annotationParagraphMap.get(a.id) === idx)
                            }
                            onSelect={s => {
                              // Translate paragraph-local offsets to global task-text offsets.
                              // Use s.end directly (not s.text.length) to avoid drift from trimming.
                              handleSelect({ ...s, start: para.offset + s.start, end: para.offset + s.end });
                            }}
                            onEditAnnotation={a => handleEditHighlight(a)}
                          />
                          <ConnectednessButtons
                            type="text"
                            index={idx}
                            state={textConnectness}
                            setState={setTextConnectness}
                            annotationsCount={annotations.filter(a => (!a.taskId || a.taskId === currentTask.id) && a.text && para.text.includes(a.text)).length}
                          />
                        </div>

                        <div className="lg:sticky lg:top-10">
                          <ImageWithPinpoints
                            imageUrl={currentTask.images[idx % currentTask.images.length]}
                            annotations={imageAnnotations[idx.toString()] || []}
                            onAddPin={(x, y, w, h, t) => handleAddPin(idx, x, y, w, h, t)}
                            onEditPin={a => handleEditPin(idx, a)}
                          />
                          <ConnectednessButtons
                            type="image"
                            index={idx}
                            state={imageConnectness}
                            setState={setImageConnectness}
                            annotationsCount={imageAnnotations[idx.toString()]?.length || 0}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* LANGUAGE SIMILARITY QUESTION */}
                  {/*
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
                  </div>
                  */}

                  <div className="pt-32 pb-16 max-w-4xl mx-auto">
                    <div className="bg-white rounded-[4rem] border border-slate-100 shadow-2xl p-16 space-y-12 animate-in slide-in-from-bottom-8">
                      <div className="pt-8 border-t border-slate-50">
                        <div className="text-center mb-10">
                          <h4 className="text-xl font-black text-slate-900 italic tracking-tight"> {t('global_question', language)} </h4>
                          {/* <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Please answer the following global questions about the story and images</p> */}
                        </div>
                        <GlobalFeedbackToggles />
                      </div>

                      <div className="pt-8 border-t border-slate-50">
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 px-4">
                          {t('general_comment', language)}
                        </label>
                        <textarea
                          className="w-full p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] font-medium text-slate-700 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                          rows={3}
                          placeholder={t('general_comment_placeholder', language)}
                          value={generalComment}
                          onChange={(e) => setGeneralComment(e.target.value)}
                        />
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

                    {inspectUserId ? (
                      <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-amber-50 border border-amber-100 text-amber-700 px-8 py-4 rounded-2xl flex items-center shadow-sm">
                          <i className="fa-solid fa-eye text-sm mr-3"></i>
                          <span className="font-black text-[10px] uppercase tracking-[0.2em]">Read-only — Admin Review Mode Active</span>
                        </div>
                      </div>
                    ) : isTaskSubmitted ? (
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
        onClose={() => { setIsTextModalOpen(false); setCurrentSelection(null); setEditingTextAnnotation(null); }}
        onSave={saveTextAnnotation}
        onDelete={handleDeleteTextAnnotation}
        selection={currentSelection}
        editingAnnotation={editingTextAnnotation}
        language={language}
        projectGuideline={projects.find(p => p.id === currentTask?.projectId)?.guideline}
      />
      <TextIssueModal
        isOpen={isIssueModalOpen}
        onClose={() => { setIsIssueModalOpen(false); setCurrentSelection(null); setEditingTextAnnotation(null); }}
        onSave={saveIssueAnnotation}
        selection={currentSelection}
        editingAnnotation={editingTextAnnotation}
        language={language}
      />

      <ImageAnnotationModal
        isOpen={isImageModalOpen}
        onClose={() => { setIsImageModalOpen(false); setPendingPin(null); setEditingImageAnno(null); }}
        onSave={saveImageAnnotation}
        onDelete={handleDeleteImageAnnotation}
        existingAnnotation={editingImageAnno}
        language={language}
      />
      <ImageIssueModal
        isOpen={isImageIssueModalOpen}
        onClose={() => { setIsImageIssueModalOpen(false); setPendingPin(null); setEditingImageAnno(null); }}
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
          rating: 0,
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
        question={currentTask?.question}
        language={language}
      />
    </div >
  );
};

export default App;