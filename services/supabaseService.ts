import { createClient, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { User, Project, Task, Annotation, ImageAnnotation, TaskAssignment, ProjectAssignment, DecisionStatus } from '../types';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not found. Running in offline mode with localStorage.');
}

export const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

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
                role
            },
            emailRedirectTo: undefined // Disable email confirmation
        }
    });

    if (authError) return { data: null, error: authError };

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

    const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!profile) return null;

    return {
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
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching users:', error);
        return [];
    }

    return data.map(u => ({
        email: u.email,
        name: u.name,
        role: u.role,
        password: ''
    }));
};

export const deleteUser = async (email: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { error } = await supabase
        .from('users')
        .delete()
        .eq('email', email);

    return { error };
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
        title: p.name, // Map name to title
        description: '', // No description in DB schema
        guideline: p.guideline || '',
        createdAt: new Date(p.created_at).getTime()
    }));
};

export const createProject = async (project: Omit<Project, 'id'>): Promise<Project | null> => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from('projects')
        .insert({
            name: project.title, // Map title to name
            guideline: project.guideline,
            created_by: user?.id
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating project:', error);
        return null;
    }

    return {
        id: data.id,
        title: data.name,
        description: '',
        guideline: data.guideline || '',
        createdAt: new Date(data.created_at).getTime()
    };
};

export const updateProject = async (id: string, updates: Partial<Project>) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id);

    return { error };
};

export const deleteProject = async (id: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

    return { error };
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
        objective: t.description || '', // Map description to objective
        description: t.description || '',
        text: t.text,
        images: t.images || [],
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
            text: task.text,
            description: task.description,
            images: task.images,
            task_type: task.taskType
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating task:', error);
        return null;
    }

    return {
        id: data.id,
        projectId: data.project_id,
        title: data.title,
        objective: data.description || '',
        description: data.description || '',
        text: data.text,
        images: data.images || [],
        taskType: (data.task_type || 'independent') as 'independent' | 'overlapped'
    };
};

export const deleteTask = async (id: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

    return { error };
};

// ============================================
// TASK SUBMISSIONS
// ============================================

export const saveTaskSubmission = async (
    taskId: string,
    culturalScore: number,
    languageSimilarity: DecisionStatus,
    languageSimilarityJustification: string
) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
        .from('task_submissions')
        .upsert({
            task_id: taskId,
            user_id: user.id,
            cultural_score: culturalScore,
            language_similarity: languageSimilarity,
            language_similarity_justification: languageSimilarityJustification
        }, {
            onConflict: 'task_id,user_id'
        })
        .select()
        .single();

    return { data, error };
};

export const fetchTaskSubmission = async (taskId: string) => {
    if (!supabase) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('task_submissions')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', user.id)
        .single();

    if (error) return null;
    return data;
};

export const fetchCompletedTaskIds = async (): Promise<string[]> => {
    if (!supabase) return [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('task_submissions')
        .select('task_id')
        .eq('user_id', user.id);

    if (error) return [];
    return data.map(s => s.task_id);
};

// ============================================
// ANNOTATIONS
// ============================================

export const saveAnnotations = async (taskId: string, annotations: Annotation[]) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get or create submission
    const submission = await fetchTaskSubmission(taskId);
    let submissionId = submission?.id;

    if (!submissionId) {
        const { data: newSubmission } = await saveTaskSubmission(taskId, 0, 'na', '');
        submissionId = newSubmission?.id;
    }

    // Delete existing annotations for this submission
    await supabase
        .from('annotations')
        .delete()
        .eq('submission_id', submissionId);

    // Insert new annotations
    const annotationsData = annotations.map(a => ({
        submission_id: submissionId,
        task_id: taskId,
        user_id: user.id,
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
        issue_description: a.issueDescription
    }));

    const { error } = await supabase
        .from('annotations')
        .insert(annotationsData);

    return { error };
};

export const fetchAnnotations = async (taskId: string): Promise<Annotation[]> => {
    if (!supabase) return [];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('annotations')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', user.id);

    if (error) return [];

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
        userEmail: user.email || '',
        taskId: a.task_id
    }));
};

// ============================================
// IMAGE ANNOTATIONS
// ============================================

export const saveImageAnnotations = async (taskId: string, imageAnnotations: Record<string, ImageAnnotation[]>) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get or create submission
    const submission = await fetchTaskSubmission(taskId);
    let submissionId = submission?.id;

    if (!submissionId) {
        const { data: newSubmission } = await saveTaskSubmission(taskId, 0, 'na', '');
        submissionId = newSubmission?.id;
    }

    // Delete existing image annotations for this submission
    await supabase
        .from('image_annotations')
        .delete()
        .eq('submission_id', submissionId);

    // Flatten and insert new image annotations
    const imageAnnotationsData = Object.entries(imageAnnotations).flatMap(([paraIdx, annos]) =>
        annos.map(a => ({
            submission_id: submissionId,
            task_id: taskId,
            user_id: user.id,
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
            issue_description: a.issueDescription
        }))
    );

    if (imageAnnotationsData.length > 0) {
        const { error } = await supabase
            .from('image_annotations')
            .insert(imageAnnotationsData);

        return { error };
    }

    return { error: null };
};

export const fetchImageAnnotations = async (taskId: string): Promise<Record<string, ImageAnnotation[]>> => {
    if (!supabase) return {};

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};

    const { data, error } = await supabase
        .from('image_annotations')
        .select('*')
        .eq('task_id', taskId)
        .eq('user_id', user.id);

    if (error) return {};

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
            userEmail: user.email || '',
            taskId: a.task_id
        });
    });

    return grouped;
};

// ============================================
// PROJECT ASSIGNMENTS
// ============================================

export const fetchProjectAssignments = async (): Promise<ProjectAssignment[]> => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('project_assignments')
        .select(`
      *,
      users!inner(email)
    `);

    if (error) return [];

    return data.map(pa => ({
        projectId: pa.project_id,
        assignedToEmail: pa.users.email
    }));
};

export const createProjectAssignment = async (projectId: string, userEmail: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    // Get user ID from email
    const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', userEmail)
        .single();

    if (!userData) throw new Error('User not found');

    const { error } = await supabase
        .from('project_assignments')
        .insert({
            project_id: projectId,
            user_id: userData.id
        });

    return { error };
};

export const deleteProjectAssignment = async (projectId: string, userEmail: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', userEmail)
        .single();

    if (!userData) throw new Error('User not found');

    const { error } = await supabase
        .from('project_assignments')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userData.id);

    return { error };
};

// ============================================
// TASK ASSIGNMENTS
// ============================================

export const fetchTaskAssignments = async (): Promise<TaskAssignment[]> => {
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('task_assignments')
        .select('*');

    if (error) return [];

    return data.map(ta => ({
        taskId: ta.task_id,
        assignedToEmail: ta.assigned_to_email
    }));
};

export const createTaskAssignment = async (taskId: string, assignedToEmail: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { error } = await supabase
        .from('task_assignments')
        .insert({
            task_id: taskId,
            assigned_to_email: assignedToEmail
        });

    return { error };
};

export const deleteTaskAssignment = async (taskId: string, assignedToEmail: string) => {
    if (!supabase) throw new Error('Supabase not initialized');

    const { error } = await supabase
        .from('task_assignments')
        .delete()
        .eq('task_id', taskId)
        .eq('assigned_to_email', assignedToEmail);

    return { error };
};
