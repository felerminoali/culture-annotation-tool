-- AnnotatePro AI Database Schema for Supabase
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'annotator')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  guideline TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  description TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  task_type TEXT CHECK (task_type IN ('standard', 'overlapped')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Task submissions (tracks completion status)
CREATE TABLE public.task_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  cultural_score INTEGER CHECK (cultural_score >= 0 AND cultural_score <= 100),
  language_similarity TEXT CHECK (language_similarity IN ('yes', 'no', 'na')),
  language_similarity_justification TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(task_id, user_id)
);

-- Text annotations table
CREATE TABLE public.annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES public.task_submissions(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  start_pos INTEGER NOT NULL,
  end_pos INTEGER NOT NULL,
  text TEXT NOT NULL,
  comment TEXT,
  is_important BOOLEAN DEFAULT false,
  is_relevant TEXT CHECK (is_relevant IN ('yes', 'no', 'na')),
  relevant_justification TEXT,
  is_supported TEXT CHECK (is_supported IN ('yes', 'no', 'na')),
  supported_justification TEXT,
  culture_proxy TEXT,
  annotation_type TEXT CHECK (annotation_type IN ('manual', 'ai')),
  subtype TEXT CHECK (subtype IN ('culture', 'issue')),
  issue_category TEXT,
  issue_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Image annotations table
CREATE TABLE public.image_annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES public.task_submissions(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  paragraph_index INTEGER NOT NULL,
  x FLOAT NOT NULL,
  y FLOAT NOT NULL,
  width FLOAT NOT NULL,
  height FLOAT NOT NULL,
  shape_type TEXT CHECK (shape_type IN ('rect', 'circle')),
  description TEXT,
  comment TEXT,
  is_present TEXT CHECK (is_present IN ('yes', 'no', 'na')),
  present_justification TEXT,
  is_relevant TEXT CHECK (is_relevant IN ('yes', 'no', 'na')),
  relevant_justification TEXT,
  is_supported TEXT CHECK (is_supported IN ('yes', 'no', 'na')),
  supported_justification TEXT,
  culture_proxy TEXT,
  subtype TEXT CHECK (subtype IN ('culture', 'issue')),
  issue_category TEXT,
  issue_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project assignments table
CREATE TABLE public.project_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Task assignments table
CREATE TABLE public.task_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  assigned_to_email TEXT NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_annotations_task_id ON public.annotations(task_id);
CREATE INDEX idx_annotations_user_id ON public.annotations(user_id);
CREATE INDEX idx_annotations_submission_id ON public.annotations(submission_id);
CREATE INDEX idx_image_annotations_task_id ON public.image_annotations(task_id);
CREATE INDEX idx_image_annotations_user_id ON public.image_annotations(user_id);
CREATE INDEX idx_task_submissions_task_id ON public.task_submissions(task_id);
CREATE INDEX idx_task_submissions_user_id ON public.task_submissions(user_id);
CREATE INDEX idx_tasks_project_id ON public.tasks(project_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Projects policies
CREATE POLICY "Users can view all projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Admins can insert projects" ON public.projects FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update projects" ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can delete projects" ON public.projects FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Tasks policies
CREATE POLICY "Users can view all tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Admins can manage tasks" ON public.tasks FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Task submissions policies
CREATE POLICY "Users can view own submissions" ON public.task_submissions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can view all submissions" ON public.task_submissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can insert own submissions" ON public.task_submissions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own submissions" ON public.task_submissions FOR UPDATE USING (user_id = auth.uid());

-- Annotations policies
CREATE POLICY "Users can view own annotations" ON public.annotations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can view all annotations" ON public.annotations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can manage own annotations" ON public.annotations FOR ALL USING (user_id = auth.uid());

-- Image annotations policies
CREATE POLICY "Users can view own image annotations" ON public.image_annotations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admins can view all image annotations" ON public.image_annotations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can manage own image annotations" ON public.image_annotations FOR ALL USING (user_id = auth.uid());

-- Project assignments policies
CREATE POLICY "Users can view project assignments" ON public.project_assignments FOR SELECT USING (true);
CREATE POLICY "Admins can manage project assignments" ON public.project_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Task assignments policies
CREATE POLICY "Users can view task assignments" ON public.task_assignments FOR SELECT USING (true);
CREATE POLICY "Admins can manage task assignments" ON public.task_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_submissions_updated_at BEFORE UPDATE ON public.task_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_annotations_updated_at BEFORE UPDATE ON public.annotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_image_annotations_updated_at BEFORE UPDATE ON public.image_annotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
