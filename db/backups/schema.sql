


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."annotation_subtype_enum" AS ENUM (
    'culture',
    'issue'
);


ALTER TYPE "public"."annotation_subtype_enum" OWNER TO "postgres";


CREATE TYPE "public"."annotation_type_enum" AS ENUM (
    'manual',
    'ai'
);


ALTER TYPE "public"."annotation_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."decision_status_enum" AS ENUM (
    'yes',
    'no',
    'na'
);


ALTER TYPE "public"."decision_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."persona_gender" AS ENUM (
    'male',
    'female',
    'other'
);


ALTER TYPE "public"."persona_gender" OWNER TO "postgres";


CREATE TYPE "public"."shape_type_enum" AS ENUM (
    'rect',
    'circle'
);


ALTER TYPE "public"."shape_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."task_category" AS ENUM (
    'diet',
    'exercise'
);


ALTER TYPE "public"."task_category" OWNER TO "postgres";


CREATE TYPE "public"."task_type_enum" AS ENUM (
    'independent',
    'overlapped',
    'control',
    'consistency'
);


ALTER TYPE "public"."task_type_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'role');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."annotations" (
    "id" character varying NOT NULL,
    "submission_task_id" character varying NOT NULL,
    "submission_user_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "start_pos" integer NOT NULL,
    "end_pos" integer NOT NULL,
    "text" "text" NOT NULL,
    "comment" "text",
    "is_important" boolean DEFAULT false NOT NULL,
    "is_relevant" "public"."decision_status_enum" DEFAULT 'na'::"public"."decision_status_enum",
    "relevant_justification" "text",
    "is_supported" "public"."decision_status_enum" DEFAULT 'na'::"public"."decision_status_enum",
    "supported_justification" "text",
    "culture_proxy" "text",
    "annotation_type" "public"."annotation_type_enum" DEFAULT 'manual'::"public"."annotation_type_enum" NOT NULL,
    "subtype" "public"."annotation_subtype_enum" DEFAULT 'culture'::"public"."annotation_subtype_enum",
    "issue_category" "text",
    "issue_description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "task_id" character varying,
    "rating" integer
);


ALTER TABLE "public"."annotations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."image_annotations" (
    "id" character varying NOT NULL,
    "submission_task_id" character varying NOT NULL,
    "submission_user_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "paragraph_index" integer NOT NULL,
    "x" double precision NOT NULL,
    "y" double precision NOT NULL,
    "width" double precision NOT NULL,
    "height" double precision NOT NULL,
    "shape_type" "public"."shape_type_enum" DEFAULT 'rect'::"public"."shape_type_enum" NOT NULL,
    "description" "text",
    "comment" "text",
    "is_present" "public"."decision_status_enum" DEFAULT 'yes'::"public"."decision_status_enum",
    "present_justification" "text",
    "is_relevant" "public"."decision_status_enum" DEFAULT 'na'::"public"."decision_status_enum",
    "relevant_justification" "text",
    "is_supported" "public"."decision_status_enum" DEFAULT 'na'::"public"."decision_status_enum",
    "supported_justification" "text",
    "culture_proxy" "text",
    "subtype" "public"."annotation_subtype_enum" DEFAULT 'culture'::"public"."annotation_subtype_enum",
    "issue_category" "text",
    "issue_description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "task_id" character varying,
    "rating" integer
);


ALTER TABLE "public"."image_annotations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_assignments" (
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."project_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "guideline" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_assignments" (
    "assigned_to_email" "text" NOT NULL,
    "task_id" character varying NOT NULL
);


ALTER TABLE "public"."task_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_submissions" (
    "task_id" character varying NOT NULL,
    "user_id" "uuid" NOT NULL,
    "cultural_score" integer DEFAULT 0 NOT NULL,
    "language_similarity" "public"."decision_status_enum" DEFAULT 'na'::"public"."decision_status_enum" NOT NULL,
    "language_similarity_justification" "text",
    "completed" boolean DEFAULT false NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "general_comment" "text",
    "text_connectness" "jsonb" DEFAULT '{}'::"jsonb",
    "image_connectness" "jsonb" DEFAULT '{}'::"jsonb",
    "medically_misleading" boolean DEFAULT false,
    "culture_generic" boolean DEFAULT false,
    "cultural_stereotypical" boolean DEFAULT false,
    "persona_consistency_strong" boolean DEFAULT false,
    "persona_consistency_broken" boolean DEFAULT false,
    "advice_practical" boolean DEFAULT false,
    "advice_vague" boolean DEFAULT false,
    "advice_unrealistic" boolean DEFAULT false,
    "images_match_story" boolean DEFAULT false,
    "images_mismatch_persona" boolean DEFAULT false,
    "ai_artifacts" boolean DEFAULT false,
    "story_engaging" boolean DEFAULT false,
    "story_confusing" boolean DEFAULT false,
    "story_supportive" boolean DEFAULT false,
    "story_tone_inappropriate" boolean DEFAULT false,
    "health_safety" boolean DEFAULT false
);


ALTER TABLE "public"."task_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" character varying NOT NULL,
    "project_id" "uuid",
    "title" "text" NOT NULL,
    "objective" "text",
    "description" "text",
    "text" "text" NOT NULL,
    "images" "text"[],
    "audio" "text"[],
    "question" "text",
    "category" "public"."task_category",
    "gender" "public"."persona_gender",
    "task_type" "public"."task_type_enum" DEFAULT 'independent'::"public"."task_type_enum" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb"
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "role" "text" DEFAULT 'annotator'::"text" NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."annotations"
    ADD CONSTRAINT "annotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."image_annotations"
    ADD CONSTRAINT "image_annotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_pkey" PRIMARY KEY ("project_id", "user_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_assignments"
    ADD CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("task_id");



ALTER TABLE ONLY "public"."task_submissions"
    ADD CONSTRAINT "task_submissions_pkey" PRIMARY KEY ("task_id", "user_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."annotations"
    ADD CONSTRAINT "annotations_submission_fkey" FOREIGN KEY ("submission_task_id", "submission_user_id") REFERENCES "public"."task_submissions"("task_id", "user_id");



ALTER TABLE ONLY "public"."annotations"
    ADD CONSTRAINT "annotations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."annotations"
    ADD CONSTRAINT "annotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."image_annotations"
    ADD CONSTRAINT "image_annotations_submission_fkey" FOREIGN KEY ("submission_task_id", "submission_user_id") REFERENCES "public"."task_submissions"("task_id", "user_id");



ALTER TABLE ONLY "public"."image_annotations"
    ADD CONSTRAINT "image_annotations_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."image_annotations"
    ADD CONSTRAINT "image_annotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_assignments"
    ADD CONSTRAINT "project_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."task_assignments"
    ADD CONSTRAINT "task_assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_submissions"
    ADD CONSTRAINT "task_submissions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_submissions"
    ADD CONSTRAINT "task_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can create projects" ON "public"."projects" FOR INSERT WITH CHECK (((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can create tasks" ON "public"."tasks" FOR INSERT WITH CHECK (((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can delete projects" ON "public"."projects" FOR DELETE USING (((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can delete tasks" ON "public"."tasks" FOR DELETE USING (((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can delete user profiles" ON "public"."users" FOR DELETE USING (((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can manage project assignments" ON "public"."project_assignments" USING (((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can manage task assignments" ON "public"."task_assignments" USING (((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can update any user profile" ON "public"."users" FOR UPDATE WITH CHECK (((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can update projects" ON "public"."projects" FOR UPDATE USING (((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can update tasks" ON "public"."tasks" FOR UPDATE USING (((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Admins can view all user profiles" ON "public"."users" FOR SELECT USING (((("auth"."jwt"() -> 'user_metadata'::"text") ->> 'role'::"text") = 'admin'::"text"));



CREATE POLICY "Authenticated users can read all project assignments" ON "public"."project_assignments" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can read all projects" ON "public"."projects" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can read all task assignments" ON "public"."task_assignments" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can read all tasks" ON "public"."tasks" FOR SELECT USING (true);



CREATE POLICY "Users can update their own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own profile" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."project_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";


















GRANT ALL ON TABLE "public"."annotations" TO "anon";
GRANT ALL ON TABLE "public"."annotations" TO "authenticated";
GRANT ALL ON TABLE "public"."annotations" TO "service_role";



GRANT ALL ON TABLE "public"."image_annotations" TO "anon";
GRANT ALL ON TABLE "public"."image_annotations" TO "authenticated";
GRANT ALL ON TABLE "public"."image_annotations" TO "service_role";



GRANT ALL ON TABLE "public"."project_assignments" TO "anon";
GRANT ALL ON TABLE "public"."project_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."project_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."task_assignments" TO "anon";
GRANT ALL ON TABLE "public"."task_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."task_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."task_submissions" TO "anon";
GRANT ALL ON TABLE "public"."task_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."task_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































