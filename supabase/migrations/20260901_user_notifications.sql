BEGIN;

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'material_grant',
  request_id TEXT,
  material_id TEXT,
  project_id UUID,
  project_slug TEXT,
  material_title TEXT NOT NULL DEFAULT '',
  tab_title TEXT,
  tab_slug TEXT,
  cover_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON public.user_notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_notifications_select_own ON public.user_notifications;
CREATE POLICY user_notifications_select_own
  ON public.user_notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_notifications_update_own ON public.user_notifications;
CREATE POLICY user_notifications_update_own
  ON public.user_notifications FOR UPDATE
  USING (auth.uid() = user_id);

COMMIT;
