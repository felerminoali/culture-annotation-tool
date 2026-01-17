

export type UserRole = 'admin' | 'annotator';
export type Language = 'en' | 'pt';

export interface User {
  id?: string; // Add ID for Supabase
  name: string;
  email: string;
  role: UserRole;
  password?: string;
}

export type AnnotationSubtype = 'culture' | 'issue';

export interface Annotation {
  id: string;
  start: number;
  end: number;
  text: string;
  comment: string;
  isImportant: boolean;
  type: 'manual' | 'ai';
  subtype?: AnnotationSubtype;
  issueCategory?: string;
  issueDescription?: string;
  timestamp: number;
  userEmail?: string; // Track who made it
  userId?: string; // Supabase user ID
  taskId?: string;
  isRelevant?: DecisionStatus;
  relevantJustification?: string;
  isSupported?: DecisionStatus;
  supportedJustification?: string;
  cultureProxy?: string;
}

export interface TaskData {
  annotations: Annotation[];
  imageAnnotations: Record<string, ImageAnnotation[]>;
  culturalScore: number;
  languageSimilarity: DecisionStatus;
  languageSimilarityJustification: string;
}

export type DecisionStatus = 'yes' | 'no' | 'na';
export type ShapeType = 'rect' | 'circle';

export interface ImageAnnotation {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shapeType: ShapeType;
  description: string;
  comment: string;
  isPresent: DecisionStatus; // Retain if needed for other image annotation types, removed from modal but still in type
  presentJustification?: string; // Retain if needed
  isRelevant: DecisionStatus;
  relevantJustification?: string;
  isSupported?: DecisionStatus;
  supportedJustification?: string;
  subtype?: AnnotationSubtype;
  issueCategory?: string;
  issueDescription?: string;
  cultureProxy?: string;
  timestamp: number;
  userEmail?: string;
  userId?: string; // Supabase user ID
  taskId?: string;
  paragraph_index?: number; // Add paragraph_index to ImageAnnotation
}

export interface SelectionState {
  start: number;
  end: number;
  text: string;
}

export interface TaskAssignment {
  id?: string; // Supabase ID
  taskId: string;
  assignedToEmail: string; // "all" or specific email
  userId?: string; // Supabase user ID
}

export interface Project {
  id: string;
  title: string;
  description: string;
  guideline?: string;
  createdAt: number;
}

export interface Task {
  id: string;
  title: string;
  objective: string;
  description: string;
  text: string;
  images: string[];
  audio?: string[]; // New: Audio URLs
  projectId?: string;
  question?: string; // New: Task-specific question
  category?: 'diet' | 'exercise'; // New: Task category
  gender?: 'male' | 'female' | 'other'; // New: Persona gender
  taskType?: 'independent' | 'overlapped'; // New: Task type for agreement calculation
}

export interface ProjectAssignment {
  id?: string; // Supabase ID
  projectId: string;
  assignedToEmail: string;
  userId?: string; // Supabase user ID
}

// Interface for fetching submission data for agreement calculation
export interface UserTaskSubmission {
  taskId: string;
  userEmail: string;
  userId: string;
  culturalScore: number;
  languageSimilarity?: DecisionStatus; // Added for Admin Dashboard
  languageSimilarityJustification?: string; // Added for Admin Dashboard
  completed: boolean; // Indicates if a submission exists for this task/user
}