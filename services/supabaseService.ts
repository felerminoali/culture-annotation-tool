
import { createClient, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { User, Project, Task, Annotation, ImageAnnotation, TaskAssignment, ProjectAssignment, DecisionStatus, UserTaskSubmission } from '../types';

// Access environment variables using process.env, which is defined by Vite's `define` config
const supabaseUrl = process.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not found. Running in offline mode with localStorage.');
}

export const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

/**
 * Generates a UUID (Universally Unique Identifier) using crypto.randomUUID if available,
 * otherwise falls back to a custom implementation.
 */
export const generateUuid = (): string => {
    let generatedId: string;

    // Attempt to use Web Crypto API's `randomUUID` for robust and standard UUIDs
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        try {
            generatedId = crypto.randomUUID();
            console.log('Generated UUID (crypto.randomUUID):', generatedId);
            return generatedId;
        } catch (e) {
            console.error('Error with crypto.randomUUID, falling back:', e);
            // Fallback if crypto.randomUUID throws an error
        }
    }

    // Fallback UUID generation (v4-like, using Math.random for each segment)
    // This method is used if crypto.randomUUID is unavailable or throws an error.
    let d = new Date().getTime(); // Timestamp
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        d += performance.now(); // Add high-precision timestamp
    }
    generatedId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    console.log('Generated UUID (fallback):', generatedId);
    return generatedId;
};

// ============================================
// AUTHENTICATION
// ============================================

export const signUp = async (email: string, password: string, name: string, role: 'admin' | 'annotator') => {
    if (!supabase) throw new Error('Supabase not initialized');

    // Sign up with user metadata - the database trigger will create the profile
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name,
                role // This `role` goes into auth.users.user_metadata.role
            },
            emailRedirectTo: null // Explicitly set to null to indicate no email confirmation redirect
        }
    });

    if (authError) return { data: null, error: authError };

    // You might want to explicitly wait for the `public.users` record to be created by the trigger
    // Or rely on the `getCurrentUser` function after sign-up for subsequent data access.
    return { data: authData, error: null };
};

export const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    return { data, error };
};

export const signOut = async () => {
    if (!supabase) throw new Error('Supabase not initialized');
    const { error } = await supabase.auth.signOut();
    return { error };
};

export const getCurrentUser = async (): Promise<User | null> => {
    if (!supabase) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Fetch from public.users table where the trigger saves the profile
    const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!profile) return null;

    return {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role,
        password: '' // Not returned from database
    };
};

// ============================================
// USERS
// ============================================

export const fetchUsers = async (): Promise<User[]> => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('name', { ascending: true }); // Order by name for consistency

    if (error) {
        console.error('Error fetching users:', error);
        return [];
    }

    return data.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        password: ''
    }));
};

export const deleteUser = async (email: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    // First, get the user ID from the public.users table
    const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

    if (fetchError || !userData) {
        throw new Error(`User with email ${email} not found or error fetching user: ${fetchError?.message}`);
    }

    // Delete from public.users (triggers might handle cascade deletes to other tables)
    const { error: deleteProfileError } = await supabase
        .from('users')
        .delete()
        .eq('id', userData.id);

    if (deleteProfileError) {
        throw new Error(`Error deleting user profile: ${deleteProfileError.message}`);
    }

    // Admin can also delete the user from auth.users (requires service role key or appropriate RLS)
    // For a frontend context, typically only the profile is deleted, and auth.users is handled by backend or RLS.
    // If you enable RLS properly, deleting from `public.users` might automatically handle `auth.users` via a trigger.

    return { error: null };
};


export const updateUserRole = async (email: string, role: 'admin' | 'annotator') => {
    if (!supabase) throw new Error('Supabase not initialized');

    // Update role in public.users table
    const { data, error } = await supabase
        .from('users')
        .update({ role })
        .eq('email', email)
        .select()
        .single();

    if (error) {
        console.error('Error updating user role:', error);
        throw error;
    }
    return { data, error: null };
};

// ============================================
// PROJECTS
// ============================================

export const fetchProjects = async (): Promise<Project[]> => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching projects:', error);
        return [];
    }

    return data.map(p => ({
        id: p.id,
        title: p.name,
        description: p.description || '', // Ensure description is mapped
        guideline: p.guideline || '',
        createdAt: new Date(p.created_at).getTime()
    }));
};

export const createProject = async (project: Omit<Project, 'id' | 'createdAt'>): Promise<Project | null> => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
        .from('projects')
        .insert({
            name: project.title,
            description: project.description,
            guideline: project.guideline,
            created_by: user.id
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating project:', error);
        throw error;
    }

    return {
        id: data.id,
        title: data.name,
        description: data.description || '',
        guideline: data.guideline || '',
        createdAt: new Date(data.created_at).getTime()
    };
};

export const updateProject = async (id: string, updates: Partial<Project>) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const payload: { [key: string]: any } = {};
    if (updates.title !== undefined) payload.name = updates.title;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.guideline !== undefined) payload.guideline = updates.guideline;

    const { error } = await supabase
        .from('projects')
        .update(payload)
        .eq('id', id);

    if (error) {
        console.error('Error updating project:', error);
        throw error;
    }
    return { error: null };
};

export const upsertProject = async (project: Project): Promise<Project | null> => {
    if (!supabase) throw new Error('Supabase not initialized');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const payload = {
        id: project.id,
        name: project.title,
        description: project.description,
        guideline: project.guideline,
        created_by: user.id,
        created_at: new Date(project.createdAt).toISOString()
    };

    const { data, error } = await supabase
        .from('projects')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();

    if (error) {
        console.error('Error upserting project:', error);
        throw error;
    }

    return {
        id: data.id,
        title: data.name,
        description: data.description || '',
        guideline: data.guideline || '',
        createdAt: new Date(data.created_at).getTime()
    };
};

export const deleteProject = async (id: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting project:', error);
        throw error;
    }
    return { error: null };
};

// ============================================
// TASKS
// ============================================

export const fetchTasks = async (projectId?: string): Promise<Task[]> => {
    if (!supabase) return [];

    let query = supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

    if (projectId) {
        query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching tasks:', error);
        return [];
    }

    return data.map(t => ({
        id: t.id,
        projectId: t.project_id,
        title: t.title,
        objective: t.objective || '',
        description: t.description || '',
        text: t.text,
        images: t.images || [],
        audio: t.audio || [],
        question: t.question || '',
        category: t.category,
        gender: t.gender,
        taskType: (t.task_type || 'independent') as 'independent' | 'overlapped'
    }));
};

export const createTask = async (task: Omit<Task, 'id'>): Promise<Task | null> => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data, error } = await supabase
        .from('tasks')
        .insert({
            project_id: task.projectId,
            title: task.title,
            objective: task.objective,
            description: task.description,
            text: task.text,
            images: task.images,
            audio: task.audio,
            question: task.question,
            category: task.category,
            gender: task.gender,
            task_type: task.taskType
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating task:', error);
        throw error;
    }

    return {
        id: data.id,
        projectId: data.project_id,
        title: data.title,
        objective: data.objective || '',
        description: data.description || '',
        text: data.text,
        images: data.images || [],
        audio: data.audio || [],
        question: data.question || '',
        category: data.category,
        gender: data.gender,
        taskType: (data.task_type || 'independent') as 'independent' | 'overlapped'
    };
};

export const updateTask = async (id: string, updates: Partial<Task>) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const payload: { [key: string]: any } = {};
    if (updates.projectId !== undefined) payload.project_id = updates.projectId;
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.objective !== undefined) payload.objective = updates.objective;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.text !== undefined) payload.text = updates.text;
    if (updates.images !== undefined) payload.images = updates.images;
    if (updates.audio !== undefined) payload.audio = updates.audio;
    if (updates.question !== undefined) payload.question = updates.question;
    if (updates.category !== undefined) payload.category = updates.category;
    if (updates.gender !== undefined) payload.gender = updates.gender;
    if (updates.taskType !== undefined) payload.task_type = updates.taskType;

    const { error } = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', id);

    if (error) {
        console.error('Error updating task:', error);
        throw error;
    }
    return { error: null };
};

export const upsertTask = async (task: Task): Promise<Task | null> => {
    if (!supabase) throw new Error('Supabase not initialized');

    const payload = {
        id: task.id,
        project_id: task.projectId,
        title: task.title,
        objective: task.objective,
        description: task.description,
        text: task.text,
        images: task.images,
        audio: task.audio,
        question: task.question,
        category: task.category,
        gender: task.gender,
        task_type: task.taskType
    };

    const { data, error } = await supabase
        .from('tasks')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();

    if (error) {
        console.error('Error upserting task:', error);
        throw error;
    }

    return {
        id: data.id,
        projectId: data.project_id,
        title: data.title,
        objective: data.objective || '',
        description: data.description || '',
        text: data.text,
        images: data.images || [],
        audio: data.audio || [],
        question: data.question || '',
        category: data.category,
        gender: data.gender,
        taskType: (data.task_type || 'independent') as 'independent' | 'overlapped'
    };
};

export const deleteTask = async (id: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting task:', error);
        throw error;
    }
    return { error: null };
};

// ============================================
// TASK SUBMISSIONS
// ============================================

export const getOrCreateSubmissionId = async (taskId: string, userId: string): Promise<string | null> => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data: existingSubmission, error: fetchError } = await supabase
        .from('task_submissions')
        .select('id')
        .eq('task_id', taskId)
        .eq('user_id', userId)
        .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "No rows found"
        console.error(`Error fetching existing submission for task ${taskId}, user ${userId}:`, fetchError);
        throw fetchError;
    }

    if (existingSubmission) {
        return existingSubmission.id;
    } else {
        const { data: newSubmission, error: insertError } = await supabase
            .from('task_submissions')
            .insert({
                task_id: taskId,
                user_id: userId,
                cultural_score: 0,
                language_similarity: 'na',
                language_similarity_justification: '',
                completed: false // Default to not completed on initial creation
            })
            .select('id')
            .single();

        if (insertError) {
            console.error(`Error creating new submission for task ${taskId}, user ${userId}:`, insertError);
            throw insertError;
        }
        return newSubmission?.id || null;
    }
};

export const saveTaskSubmission = async (
    taskId: string,
    userId: string,
    culturalScore: number,
    languageSimilarity: DecisionStatus,
    languageSimilarityJustification: string,
    completed: boolean = false // New parameter to mark as completed
) => {
    if (!supabase) throw new Error('Supabase not initialized');

    // Get or create the submission record
    const submissionId = await getOrCreateSubmissionId(taskId, userId);
    if (!submissionId) throw new Error('Failed to get or create submission ID');

    const { data, error } = await supabase
        .from('task_submissions')
        .update({
            cultural_score: culturalScore,
            language_similarity: languageSimilarity,
            language_similarity_justification: languageSimilarityJustification,
            completed: completed // Set completed status
        })
        .eq('id', submissionId)
        .select()
        .single();

    if (error) {
        console.error('Supabase Error (saveTaskSubmission):', error);
        throw error;
    }

    return { data, error: null };
};

export const fetchTaskSubmission = async (taskId: string, userId: string) => {
    if (!supabase) return null;

    const { data, error } = await supabase
        .from('task_submissions')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "No rows found"
        console.error('Error fetching task submission:', error);
        throw error;
    }
    return data;
};

export const fetchCompletedTaskIds = async (userId: string): Promise<string[]> => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('task_submissions')
        .select('task_id')
        .eq('user_id', userId)
        .eq('completed', true); // Fetch only explicitly completed ones

    if (error) {
        console.error('Error fetching completed task IDs:', error);
        return [];
    }
    return data.map(s => s.task_id);
};

export const fetchAllUserTaskSubmissions = async (): Promise<UserTaskSubmission[]> => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('task_submissions')
        .select(`
            task_id,
            cultural_score,
            language_similarity,
            language_similarity_justification,
            completed,
            users(email, id)
        `);

    if (error) {
        console.error('Error fetching all user task submissions:', error);
        return [];
    }

    return data.map(s => ({
        taskId: s.task_id,
        userEmail: (s.users as Partial<User> | null)?.email || 'unknown', // Cast to Partial<User> | null
        userId: (s.users as Partial<User> | null)?.id || 'unknown', // Cast to Partial<User> | null
        culturalScore: s.cultural_score,
        languageSimilarity: s.language_similarity,
        languageSimilarityJustification: s.language_similarity_justification,
        completed: s.completed
    }));
};

export const fetchSubmissionsForTasks = async (taskIds: string[]): Promise<UserTaskSubmission[]> => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('task_submissions')
        .select(`
            task_id,
            cultural_score,
            language_similarity,
            language_similarity_justification,
            completed,
            users(email, id)
        `)
        .in('task_id', taskIds);

    if (error) {
        console.error('Error fetching submissions for tasks:', error);
        return [];
    }

    return data.map(s => ({
        taskId: s.task_id,
        userEmail: (s.users as Partial<User> | null)?.email || 'unknown', // Cast to Partial<User> | null
        userId: (s.users as Partial<User> | null)?.id || 'unknown', // Cast to Partial<User> | null
        culturalScore: s.cultural_score,
        languageSimilarity: s.language_similarity,
        languageSimilarityJustification: s.language_similarity_justification,
        completed: s.completed
    }));
};


export const deleteTaskSubmission = async (taskId: string, userId: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    // Cascade deletes should handle annotations and image_annotations related to this submission.
    const { error } = await supabase
        .from('task_submissions')
        .delete()
        .eq('task_id', taskId)
        .eq('user_id', userId);

    if (error) {
        console.error('Error deleting task submission:', error);
        throw error;
    }
    return { error: null };
};


// ============================================
// ANNOTATIONS
// ============================================

export const saveAnnotations = async (taskId: string, userId: string, annotations: Annotation[], submissionId?: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const currentSubmissionId = submissionId || await getOrCreateSubmissionId(taskId, userId);
    if (!currentSubmissionId) throw new Error('Failed to get or create submission ID for annotations');

    // Delete existing annotations for this submission/task/user to avoid duplicates and handle updates simply
    const { error: deleteError } = await supabase
        .from('annotations')
        .delete()
        .eq('submission_id', currentSubmissionId)
        .eq('task_id', taskId)
        .eq('user_id', userId);

    if (deleteError) {
        console.error('Supabase Error (delete existing annotations):', deleteError);
        // Continue, as delete might fail if no records exist, or due to RLS,
        // but we want to attempt insert anyway for new annotations.
        // For a critical app, you might want more robust error handling here.
    }

    if (annotations.length === 0) return { error: null };

    // Insert new annotations
    const annotationsData = annotations.map(a => ({
        id: a.id, // Keep client-generated ID
        submission_id: currentSubmissionId,
        task_id: taskId,
        user_id: userId,
        start_pos: a.start,
        end_pos: a.end,
        text: a.text,
        comment: a.comment,
        is_important: a.isImportant,
        is_relevant: a.isRelevant,
        relevant_justification: a.relevantJustification,
        is_supported: a.isSupported,
        supported_justification: a.supportedJustification,
        culture_proxy: a.cultureProxy,
        annotation_type: a.type,
        subtype: a.subtype,
        issue_category: a.issueCategory,
        issue_description: a.issueDescription,
        created_at: new Date(a.timestamp).toISOString(),
    }));

    const { error: insertError } = await supabase
        .from('annotations')
        .insert(annotationsData);

    if (insertError) {
        console.error('Supabase Error (insert annotations):', insertError);
        // Log the problematic data for diagnostics
        if (insertError.message.includes('invalid input syntax for type uuid')) {
            console.error('Attempted to insert annotations with invalid UUIDs:', annotationsData);
        }
        throw insertError;
    }
    return { error: null };
};

export const fetchAnnotations = async (taskId: string, userId: string): Promise<Annotation[]> => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('annotations')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true }); // Order for consistent display

    if (error) {
        console.error('Error fetching annotations:', error);
        return [];
    }

    return data.map(a => ({
        id: a.id,
        start: a.start_pos,
        end: a.end_pos,
        text: a.text,
        comment: a.comment || '',
        isImportant: a.is_important || false,
        isRelevant: a.is_relevant || 'na',
        relevantJustification: a.relevant_justification || '',
        isSupported: a.is_supported || 'na',
        supportedJustification: a.supported_justification || '',
        cultureProxy: a.culture_proxy || '',
        type: a.annotation_type || 'manual',
        subtype: a.subtype,
        issueCategory: a.issue_category,
        issueDescription: a.issue_description,
        timestamp: new Date(a.created_at).getTime(),
        userEmail: '', // Will be hydrated by client if needed, or fetched with join
        userId: a.user_id,
        taskId: a.task_id
    }));
};

export const fetchAllAnnotations = async (): Promise<Annotation[]> => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('annotations')
        .select(`
            *,
            users(email)
        `);

    if (error) {
        console.error('Error fetching all annotations:', error);
        return [];
    }

    return data.map(a => ({
        id: a.id,
        start: a.start_pos,
        end: a.end_pos,
        text: a.text,
        comment: a.comment || '',
        isImportant: a.is_important || false,
        isRelevant: a.is_relevant || 'na',
        relevantJustification: a.relevant_justification || '',
        isSupported: a.is_supported || 'na',
        supportedJustification: a.supported_justification || '',
        cultureProxy: a.culture_proxy || '',
        type: a.annotation_type || 'manual',
        subtype: a.subtype,
        issueCategory: a.issue_category,
        issueDescription: a.issue_description,
        timestamp: new Date(a.created_at).getTime(),
        userEmail: (a.users as Partial<User> | null)?.email || 'unknown', // Cast to Partial<User> | null
        userId: a.user_id,
        taskId: a.task_id
    }));
};

export const fetchAnnotationsForTasks = async (taskIds: string[]): Promise<Annotation[]> => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('annotations')
        .select(`
            *,
            users(email)
        `)
        .in('task_id', taskIds)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching annotations for tasks:', error);
        return [];
    }

    return data.map(a => ({
        id: a.id,
        start: a.start_pos,
        end: a.end_pos,
        text: a.text,
        comment: a.comment || '',
        isImportant: a.is_important || false,
        isRelevant: a.is_relevant || 'na',
        relevantJustification: a.relevant_justification || '',
        isSupported: a.is_supported || 'na',
        supportedJustification: a.supported_justification || '',
        cultureProxy: a.culture_proxy || '',
        type: a.annotation_type || 'manual',
        subtype: a.subtype,
        issueCategory: a.issue_category,
        issueDescription: a.issue_description,
        timestamp: new Date(a.created_at).getTime(),
        userEmail: (a.users as Partial<User> | null)?.email || 'unknown', // Cast to Partial<User> | null
        userId: a.user_id,
        taskId: a.task_id
    }));
};

export const updateAnnotation = async (id: string, updates: Partial<Annotation>) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const payload: { [key: string]: any } = {};
    if (updates.comment !== undefined) payload.comment = updates.comment;
    if (updates.isImportant !== undefined) payload.is_important = updates.isImportant;
    if (updates.isRelevant !== undefined) payload.is_relevant = updates.isRelevant;
    if (updates.relevantJustification !== undefined) payload.relevant_justification = updates.relevantJustification;
    if (updates.isSupported !== undefined) payload.is_supported = updates.isSupported;
    if (updates.supportedJustification !== undefined) payload.supported_justification = updates.supportedJustification;
    if (updates.cultureProxy !== undefined) payload.culture_proxy = updates.cultureProxy;
    if (updates.issueCategory !== undefined) payload.issue_category = updates.issueCategory;
    if (updates.issueDescription !== undefined) payload.issue_description = updates.issueDescription;
    // Updated at will be handled by the trigger
    // payload.created_at = new Date(Date.now()).toISOString(); // Not updated here, only on create

    const { error } = await supabase
        .from('annotations')
        .update(payload)
        .eq('id', id);

    if (error) {
        console.error('Supabase Error (update annotation):', error);
        throw error;
    }
    return { error: null };
};

export const deleteAnnotation = async (id: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { error } = await supabase
        .from('annotations')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Supabase Error (delete annotation):', error);
        throw error;
    }
    return { error: null };
};

// ============================================
// IMAGE ANNOTATIONS
// ============================================

export const saveImageAnnotations = async (taskId: string, userId: string, imageAnnotations: Record<string, ImageAnnotation[]>, submissionId?: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const currentSubmissionId = submissionId || await getOrCreateSubmissionId(taskId, userId);
    if (!currentSubmissionId) throw new Error('Failed to get or create submission ID for image annotations');

    // Delete existing image annotations for this submission/task/user
    const { error: deleteError } = await supabase
        .from('image_annotations')
        .delete()
        .eq('submission_id', currentSubmissionId)
        .eq('task_id', taskId)
        .eq('user_id', userId);

    if (deleteError) {
        console.error('Supabase Error (delete existing image annotations):', deleteError);
    }

    const flattenedImageAnnotations = Object.entries(imageAnnotations).flatMap(([paraIdx, annos]) =>
        annos.map(a => ({
            id: a.id,
            submission_id: currentSubmissionId,
            task_id: taskId,
            user_id: userId,
            paragraph_index: parseInt(paraIdx),
            x: a.x,
            y: a.y,
            width: a.width,
            height: a.height,
            shape_type: a.shapeType,
            description: a.description,
            comment: a.comment,
            is_present: a.isPresent,
            present_justification: a.presentJustification,
            is_relevant: a.isRelevant,
            relevant_justification: a.relevantJustification,
            is_supported: a.isSupported,
            supported_justification: a.supportedJustification,
            culture_proxy: a.cultureProxy,
            subtype: a.subtype,
            issue_category: a.issueCategory,
            issue_description: a.issueDescription,
            created_at: new Date(a.timestamp).toISOString(),
        }))
    );

    if (flattenedImageAnnotations.length === 0) return { error: null };

    const { error: insertError } = await supabase
        .from('image_annotations')
        .insert(flattenedImageAnnotations);

    if (insertError) {
        console.error('Supabase Error (insert image annotations):', insertError);
        // Log the problematic data for diagnostics
        if (insertError.message.includes('invalid input syntax for type uuid')) {
            console.error('Attempted to insert image annotations with invalid UUIDs:', flattenedImageAnnotations);
        }
        throw insertError;
    }
    return { error: null };
};

// Overload for when importing flat image annotations
export const saveImageAnnotationsFlat = async (taskId: string, userId: string, imageAnnotations: ImageAnnotation[], submissionId?: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const currentSubmissionId = submissionId || await getOrCreateSubmissionId(taskId, userId);
    if (!currentSubmissionId) throw new Error('Failed to get or create submission ID for image annotations');

    // Delete existing image annotations for this submission/task/user
    const { error: deleteError } = await supabase
        .from('image_annotations')
        .delete()
        .eq('submission_id', currentSubmissionId)
        .eq('task_id', taskId)
        .eq('user_id', userId);

    if (deleteError) {
        console.error('Supabase Error (delete existing image annotations for import):', deleteError);
    }

    const imageAnnotationsData = imageAnnotations.map(a => ({
        id: a.id,
        submission_id: currentSubmissionId,
        task_id: taskId,
        user_id: userId,
        paragraph_index: a.paragraph_index,
        x: a.x,
        y: a.y,
        width: a.width,
        height: a.height,
        shape_type: a.shapeType,
        description: a.description,
        comment: a.comment,
        is_present: a.isPresent,
        present_justification: a.presentJustification,
        is_relevant: a.isRelevant,
        relevant_justification: a.relevantJustification,
        is_supported: a.isSupported,
        supported_justification: a.supportedJustification,
        culture_proxy: a.cultureProxy,
        subtype: a.subtype,
        issue_category: a.issueCategory,
        issue_description: a.issueDescription,
        created_at: new Date(a.timestamp).toISOString(),
    }));

    if (imageAnnotationsData.length === 0) return { error: null };

    const { error: insertError } = await supabase
        .from('image_annotations')
        .insert(imageAnnotationsData);

    if (insertError) {
        console.error('Supabase Error (insert image annotations for import):', insertError);
        // Log the problematic data for diagnostics
        if (insertError.message.includes('invalid input syntax for type uuid')) {
            console.error('Attempted to insert imported image annotations with invalid UUIDs:', imageAnnotationsData);
        }
        throw insertError;
    }
    return { error: null };
};


export const fetchImageAnnotations = async (taskId: string, userId: string): Promise<Record<string, ImageAnnotation[]>> => {
    if (!supabase) return {};

    const { data, error } = await supabase
        .from('image_annotations')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching image annotations:', error);
        return {};
    }

    const grouped: Record<string, ImageAnnotation[]> = {};

    data.forEach(a => {
        const paraIdx = a.paragraph_index.toString();
        if (!grouped[paraIdx]) grouped[paraIdx] = [];

        grouped[paraIdx].push({
            id: a.id,
            x: a.x,
            y: a.y,
            width: a.width,
            height: a.height,
            shapeType: a.shape_type,
            description: a.description || '',
            comment: a.comment || '',
            isPresent: a.is_present || 'yes',
            presentJustification: a.present_justification,
            isRelevant: a.is_relevant || 'na',
            relevantJustification: a.relevant_justification,
            isSupported: a.is_supported || 'na',
            supportedJustification: a.supported_justification,
            cultureProxy: a.culture_proxy,
            subtype: a.subtype,
            issueCategory: a.issue_category,
            issueDescription: a.issue_description,
            timestamp: new Date(a.created_at).getTime(),
            userEmail: '', // Will be hydrated by client if needed
            userId: a.user_id,
            taskId: a.task_id,
            paragraph_index: a.paragraph_index // Ensure paragraph_index is mapped
        });
    });

    return grouped;
};

export const fetchImageAnnotationsForTasks = async (taskIds: string[]): Promise<ImageAnnotation[]> => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('image_annotations')
        .select(`
            *,
            users(email)
        `)
        .in('task_id', taskIds)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching image annotations for tasks:', error);
        return [];
    }

    return data.map(a => ({
        id: a.id,
        x: a.x,
        y: a.y,
        width: a.width,
        height: a.height,
        shapeType: a.shape_type,
        description: a.description || '',
        comment: a.comment || '',
        isPresent: a.is_present || 'yes',
        presentJustification: a.present_justification,
        isRelevant: a.is_relevant || 'na',
        relevantJustification: a.relevant_justification,
        isSupported: a.is_supported || 'na',
        supportedJustification: a.supported_justification,
        cultureProxy: a.culture_proxy,
        subtype: a.subtype,
        issueCategory: a.issue_category,
        issueDescription: a.issue_description,
        timestamp: new Date(a.created_at).getTime(),
        userEmail: (a.users as Partial<User> | null)?.email || 'unknown', // Cast to Partial<User> | null
        userId: a.user_id,
        taskId: a.task_id,
        paragraph_index: a.paragraph_index // Ensure paragraph_index is mapped
    }));
};


// ============================================
// PROJECT ASSIGNMENTS
// ============================================

export const fetchProjectAssignments = async (): Promise<ProjectAssignment[]> => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('project_assignments')
        .select(`
            project_id,
            users(email, id)
        `);

    if (error) {
        console.error('Error fetching project assignments:', error);
        return [];
    }

    return data.map(pa => ({
        projectId: pa.project_id,
        assignedToEmail: (pa.users as Partial<User> | null)?.email || 'unknown', // Cast to Partial<User> | null
        userId: (pa.users as Partial<User> | null)?.id || 'unknown' // Cast to Partial<User> | null
    }));
};

export const upsertProjectAssignment = async (projectId: string, userId: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data, error } = await supabase
        .from('project_assignments')
        .upsert({
            project_id: projectId,
            user_id: userId
        }, {
            onConflict: 'project_id,user_id'
        })
        .select()
        .single();

    if (error) {
        console.error('Error upserting project assignment:', error);
        throw error;
    }
    return { data, error: null };
};

export const deleteProjectAssignment = async (projectId: string, userId: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { error } = await supabase
        .from('project_assignments')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);

    if (error) {
        console.error('Error deleting project assignment:', error);
        throw error;
    }
    return { error: null };
};

// ============================================
// TASK ASSIGNMENTS
// ============================================

export const fetchTaskAssignments = async (): Promise<TaskAssignment[]> => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('task_assignments')
        .select('*');

    if (error) {
        console.error('Error fetching task assignments:', error);
        return [];
    }

    return data.map(ta => ({
        taskId: ta.task_id,
        assignedToEmail: ta.assigned_to_email
    }));
};

export const upsertTaskAssignment = async (taskId: string, assignedToEmail: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    // If 'all', remove existing explicit assignments for this task
    if (assignedToEmail === 'all') {
        const {error} = await supabase.from('task_assignments').delete().eq('task_id', taskId);
        if (error) {
            console.error('Supabase Error (delete task assignment for "all"):', error);
            throw error;
        }
        return { data: null, error: null };
    }

    const { data, error } = await supabase
        .from('task_assignments')
        .upsert({
            task_id: taskId,
            assigned_to_email: assignedToEmail
        }, {
            onConflict: 'task_id' // Assuming one assignment per task, or you can make task_id, assigned_to_email unique
        })
        .select()
        .single();

    if (error) {
        console.error('Supabase Error (upsert task assignment):', error);
        throw error;
    }
    return { data, error: null };
};

export const deleteTaskAssignment = async (taskId: string, assignedToEmail: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { error } = await supabase
        .from('task_assignments')
        .delete()
        .eq('task_id', taskId)
        .eq('assigned_to_email', assignedToEmail);

    if (error) {
        console.error('Supabase Error (delete task assignment):', error);
        throw error;
    }
    return { error: null };
};
