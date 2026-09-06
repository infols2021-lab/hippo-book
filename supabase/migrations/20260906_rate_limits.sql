BEGIN;

-- ---------------------------------------------------------------------------
-- Rate limiting (фиксированное окно) через таблицу-счётчик.
-- Доступ только через service_role (RLS включён, политик нет).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  count INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.rate_limits FROM anon, authenticated;

-- Атомарный счётчик: при попадании в новое окно сбрасывает счётчик.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_key TEXT, p_window_sec INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.rate_limits (key, window_start, count)
  VALUES (p_key, now(), 1)
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN public.rate_limits.window_start < now() - make_interval(secs => p_window_sec)
        THEN 1
      ELSE public.rate_limits.count + 1
    END,
    window_start = CASE
      WHEN public.rate_limits.window_start < now() - make_interval(secs => p_window_sec)
        THEN now()
      ELSE public.rate_limits.window_start
    END
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rate_limit_hit(TEXT, INTEGER) TO service_role;

COMMIT;
