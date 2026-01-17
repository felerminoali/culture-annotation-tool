-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.annotations (
  id character varying NOT NULL,
  submission_id uuid NOT NULL,
  user_id uuid NOT NULL,
  start_pos integer NOT NULL,
  end_pos integer NOT NULL,
  text text NOT NULL,
  comment text,
  is_important boolean NOT NULL DEFAULT false,
  is_relevant USER-DEFINED DEFAULT 'na'::decision_status_enum,
  relevant_justification text,
  is_supported USER-DEFINED DEFAULT 'na'::decision_status_enum,
  supported_justification text,
  culture_proxy text,
  annotation_type USER-DEFINED NOT NULL DEFAULT 'manual'::annotation_type_enum,
  subtype USER-DEFINED DEFAULT 'culture'::annotation_subtype_enum,
  issue_category text,
  issue_description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  task_id character varying,
  CONSTRAINT annotations_pkey PRIMARY KEY (id),
  CONSTRAINT annotations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT annotations_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.task_submissions(id),
  CONSTRAINT annotations_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)
);
CREATE TABLE public.image_annotations (
  id character varying NOT NULL,
  submission_id uuid NOT NULL,
  user_id uuid NOT NULL,
  paragraph_index integer NOT NULL,
  x double precision NOT NULL,
  y double precision NOT NULL,
  width double precision NOT NULL,
  height double precision NOT NULL,
  shape_type USER-DEFINED NOT NULL DEFAULT 'rect'::shape_type_enum,
  description text,
  comment text,
  is_present USER-DEFINED DEFAULT 'yes'::decision_status_enum,
  present_justification text,
  is_relevant USER-DEFINED DEFAULT 'na'::decision_status_enum,
  relevant_justification text,
  is_supported USER-DEFINED DEFAULT 'na'::decision_status_enum,
  supported_justification text,
  culture_proxy text,
  subtype USER-DEFINED DEFAULT 'culture'::annotation_subtype_enum,
  issue_category text,
  issue_description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  task_id character varying,
  CONSTRAINT image_annotations_pkey PRIMARY KEY (id),
  CONSTRAINT image_annotations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT image_annotations_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.task_submissions(id),
  CONSTRAINT image_annotations_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)
);
CREATE TABLE public.project_assignments (
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  CONSTRAINT project_assignments_pkey PRIMARY KEY (project_id, user_id),
  CONSTRAINT project_assignments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT project_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  guideline text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT projects_pkey PRIMARY KEY (id),
  CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);
CREATE TABLE public.task_assignments (
  assigned_to_email text NOT NULL,
  task_id character varying NOT NULL,
  CONSTRAINT task_assignments_pkey PRIMARY KEY (task_id),
  CONSTRAINT task_assignments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)
);
CREATE TABLE public.task_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id character varying NOT NULL,
  user_id uuid NOT NULL,
  cultural_score integer NOT NULL DEFAULT 0,
  language_similarity USER-DEFINED NOT NULL DEFAULT 'na'::decision_status_enum,
  language_similarity_justification text,
  completed boolean NOT NULL DEFAULT false,
  submitted_at timestamp with time zone DEFAULT now(),
  CONSTRAINT task_submissions_pkey PRIMARY KEY (id),
  CONSTRAINT task_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT task_submissions_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id)
);
CREATE TABLE public.tasks (
  id character varying NOT NULL,
  project_id uuid,
  title text NOT NULL,
  objective text,
  description text,
  text text NOT NULL,
  images ARRAY,
  audio ARRAY,
  question text,
  category USER-DEFINED,
  gender USER-DEFINED,
  task_type USER-DEFINED NOT NULL DEFAULT 'independent'::task_type_enum,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'annotator'::text,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);