BEGIN;

CREATE TABLE IF NOT EXISTS public.roadmap_courses (
  material_id UUID PRIMARY KEY REFERENCES public.materials(id) ON DELETE CASCADE,
  structure JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roadmap_node_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  best_stars SMALLINT NOT NULL DEFAULT 0 CHECK (best_stars >= 0 AND best_stars <= 3),
  best_score SMALLINT NOT NULL DEFAULT 0 CHECK (best_score >= 0 AND best_score <= 100),
  exam_passed BOOLEAN NOT NULL DEFAULT false,
  attempts_count INTEGER NOT NULL DEFAULT 0 CHECK (attempts_count >= 0),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_roadmap_node_progress_unique UNIQUE (user_id, material_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roadmap_node_progress_user_material
  ON public.user_roadmap_node_progress (user_id, material_id);

CREATE INDEX IF NOT EXISTS idx_user_roadmap_node_progress_material
  ON public.user_roadmap_node_progress (material_id);

CREATE INDEX IF NOT EXISTS idx_roadmap_courses_updated_at
  ON public.roadmap_courses (updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_roadmap_courses_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_roadmap_courses_updated_at ON public.roadmap_courses;
CREATE TRIGGER trg_roadmap_courses_updated_at
  BEFORE UPDATE ON public.roadmap_courses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_roadmap_courses_updated_at();

CREATE OR REPLACE FUNCTION public.set_user_roadmap_node_progress_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roadmap_node_progress_updated_at ON public.user_roadmap_node_progress;
CREATE TRIGGER trg_user_roadmap_node_progress_updated_at
  BEFORE UPDATE ON public.user_roadmap_node_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_roadmap_node_progress_updated_at();

ALTER TABLE public.roadmap_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roadmap_node_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roadmap_courses_select_authenticated ON public.roadmap_courses;
CREATE POLICY roadmap_courses_select_authenticated
  ON public.roadmap_courses
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS user_roadmap_node_progress_select_own ON public.user_roadmap_node_progress;
CREATE POLICY user_roadmap_node_progress_select_own
  ON public.user_roadmap_node_progress
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_roadmap_node_progress_insert_own ON public.user_roadmap_node_progress;
CREATE POLICY user_roadmap_node_progress_insert_own
  ON public.user_roadmap_node_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_roadmap_node_progress_update_own ON public.user_roadmap_node_progress;
CREATE POLICY user_roadmap_node_progress_update_own
  ON public.user_roadmap_node_progress
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMIT;
