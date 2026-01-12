
export type UserRole = 'admin' | 'annotator';
export type Language = 'en' | 'pt';

export interface User {
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
  isPresent: DecisionStatus;
  presentJustification?: string;
  isRelevant: DecisionStatus;
  relevantJustification?: string;
  subtype?: AnnotationSubtype;
  issueCategory?: string;
  issueDescription?: string;
  cultureProxy?: string;
  isSupported?: DecisionStatus;
  supportedJustification?: string;
  timestamp: number;
  userEmail?: string;
  taskId?: string;
}

export interface SelectionState {
  start: number;
  end: number;
  text: string;
}

export interface TaskAssignment {
  taskId: string;
  assignedToEmail: string; // "all" or specific email
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
  audio?: string[];
  projectId?: string;
  question?: string;
  category?: 'diet' | 'exercise';
  gender?: 'male' | 'female' | 'other';
  taskType?: 'independent' | 'overlapped';
}

export interface ProjectAssignment {
  projectId: string;
  assignedToEmail: string;
}
