import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  User,
  Project,
  Task,
  Annotation,
  ImageAnnotation,
  TaskAssignment,
  ProjectAssignment,
  DecisionStatus,
  UserTaskSubmission
} from '../types';

/* ============================================
   SUPABASE CLIENT
============================================ */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const requireSupabase = (): SupabaseClient => {
  if (!supabase) throw new Error('Supabase not initialized');
  return supabase;
};

/* ============================================
   UUID UTILITIES (CRITICAL FIX)
============================================ */

export const generateUuid = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const isValidUuid = (uuid: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);

const ensureUuid = (id?: string): string =>
  id && isValidUuid(id) ? id : generateUuid();

/* ============================================
   AUTH
============================================ */

export const signUp = async (
  email: string,
  password: string,
  name: string,
  role: 'admin' | 'annotator'
) => {
  const db = requireSupabase();
  return db.auth.signUp({
    email,
    password,
    options: {
      data: { name, role }
    }
  });
};

export const signIn = async (email: string, password: string) => {
  const db = requireSupabase();
  return db.auth.signInWithPassword({ email, password });
};

export const signOut = async () => {
  const db = requireSupabase();
  return db.auth.signOut();
};

/* ============================================
   USERS
============================================ */

export const fetchUsers = async (): Promise<User[]> => {
  const db = requireSupabase();
  const { data, error } = await db.from('users').select('*').order('name');
  if (error) return [];
  return data.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    password: ''
  }));
};

/* ============================================
   PROJECTS
============================================ */

export const fetchProjects = async (): Promise<Project[]> => {
  const db = requireSupabase();
  const { data, error } = await db.from('projects').select('*');
  if (error) return [];
  return data.map(p => ({
    id: p.id,
    title: p.name,
    description: p.description || '',
    guideline: p.guideline || '',
    createdAt: new Date(p.created_at).getTime()
  }));
};

/* ============================================
   TASK SUBMISSIONS
============================================ */

export const getOrCreateSubmissionId = async (
  taskId: string,
  userId: string
): Promise<string> => {
  const db = requireSupabase();

  const { data } = await db
    .from('task_submissions')
    .select('id')
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .single();

  if (data) return data.id;

  const { data: created, error } = await db
    .from('task_submissions')
    .insert({
      task_id: taskId,
      user_id: userId,
      completed: false
    })
    .select('id')
    .single();

  if (error || !created) throw error;
  return created.id;
};

/* ============================================
   TEXT ANNOTATIONS (UUID FIXED)
============================================ */

export const saveAnnotations = async (
  taskId: string,
  userId: string,
  annotations: Annotation[],
  submissionId?: string
) => {
  const db = requireSupabase();
  const sid = submissionId ?? await getOrCreateSubmissionId(taskId, userId);

  await db
    .from('annotations')
    .delete()
    .eq('submission_id', sid);

  if (!annotations.length) return;

  const payload = annotations.map(a => ({
    id: ensureUuid(a.id),
    submission_id: sid,
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
    issue_description: a.issueDescription
  }));

  const { error } = await db.from('annotations').insert(payload);
  if (error) throw error;
};

/* ============================================
   IMAGE ANNOTATIONS (UUID BUG FIXED)
============================================ */

export const saveImageAnnotations = async (
  taskId: string,
  userId: string,
  imageAnnotations: Record<string, ImageAnnotation[]>,
  submissionId?: string
) => {
  const db = requireSupabase();
  const sid = submissionId ?? await getOrCreateSubmissionId(taskId, userId);

  await db
    .from('image_annotations')
    .delete()
    .eq('submission_id', sid);

  const payload = Object.entries(imageAnnotations).flatMap(
    ([paraIdx, annos]) =>
      annos.map(a => ({
        id: ensureUuid(a.id), // 🔥 FIX
        submission_id: sid,
        task_id: taskId,
        user_id: userId,
        paragraph_index: Number(paraIdx),
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

  if (!payload.length) return;

  const { error } = await db.from('image_annotations').insert(payload);
  if (error) throw error;
};

/* ============================================
   ASSIGNMENTS
============================================ */

export const fetchProjectAssignments = async (): Promise<ProjectAssignment[]> => {
  const db = requireSupabase();
  const { data, error } = await db
    .from('project_assignments')
    .select('project_id, users(email, id)');
  if (error) return [];
  return data.map(p => ({
    projectId: p.project_id,
    assignedToEmail: p.users?.email ?? 'unknown',
    userId: p.users?.id ?? 'unknown'
  }));
};

export const fetchTaskAssignments = async (): Promise<TaskAssignment[]> => {
  const db = requireSupabase();
  const { data, error } = await db.from('task_assignments').select('*');
  if (error) return [];
  return data.map(t => ({
    taskId: t.task_id,
    assignedToEmail: t.assigned_to_email
  }));
};
