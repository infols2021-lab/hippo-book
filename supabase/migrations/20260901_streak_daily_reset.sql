-- ============================================================
-- 20260901_streak_daily_reset.sql (финальная версия)
-- Ежедневные стрики: единая функция засчитывания + сброс протухших.
-- Безопасно запускать повторно (идемпотентно).
-- ============================================================
BEGIN;

-- 1) Убираем ВСЕ старые перегрузки RPC, чтобы у PostgREST не было
--    неоднозначности при выборе функции.
DROP FUNCTION IF EXISTS public.record_streak_completion();
DROP FUNCTION IF EXISTS public.record_streak_completion(text);
DROP FUNCTION IF EXISTS public.record_streak_completion(uuid);

-- 2) Гарантируем уникальность «день — пользователь» в user_streak_days
--    (дедуп может пересечь дубли, потом накладываем уникальный индекс).
DELETE FROM public.user_streak_days a
USING public.user_streak_days b
WHERE a.user_id = b.user_id
  AND a.activity_date = b.activity_date
  AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_streak_days_user_date
  ON public.user_streak_days (user_id, activity_date);

-- 3) ЕДИНСТВЕННАЯ функция засчитывания серии.
--    Логика (от даты последнего засчитывания):
--      - сегодня уже засчитано   -> вернуть без изменений (already_counted)
--      - вчера засчитано         -> current_streak + 1 (продолжение)
--      - позавчера или раньше    -> серия сгорела, стартуем с 1
--    longest_streak только растёт.
CREATE OR REPLACE FUNCTION public.record_streak_completion(_assignment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_today      date := current_date;
  v_yesterday  date := current_date - 1;
  v_last_date  date;
  v_current    integer;
  v_longest    integer;
  v_new_current integer;
  v_row        public.user_streaks%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Блокируем строку пользователя (защита от гонок)
  SELECT * INTO v_row
  FROM public.user_streaks
  WHERE user_id = v_user_id
  FOR UPDATE;

  -- Первое засчитывание в жизни — старт с 1
  IF v_row.user_id IS NULL THEN
    INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_completed_date)
    VALUES (v_user_id, 1, 1, v_today)
    ON CONFLICT (user_id)
    DO UPDATE SET
      current_streak      = EXCLUDED.current_streak,
      longest_streak      = GREATEST(public.user_streaks.longest_streak, EXCLUDED.longest_streak),
      last_completed_date = EXCLUDED.last_completed_date;

    INSERT INTO public.user_streak_days (user_id, activity_date)
    VALUES (v_user_id, v_today)
    ON CONFLICT (user_id, activity_date) DO NOTHING;

    RETURN jsonb_build_object(
      'current_streak',      1,
      'longest_streak',      1,
      'last_completed_date', v_today
    );
  END IF;

  v_last_date := v_row.last_completed_date::date;
  v_current   := COALESCE(v_row.current_streak, 0);
  v_longest   := COALESCE(v_row.longest_streak, 0);

  IF v_last_date = v_today THEN
    -- Сегодня уже засчитано — повторно не накручиваем
    RETURN jsonb_build_object(
      'current_streak',      v_current,
      'longest_streak',      v_longest,
      'last_completed_date', v_today,
      'already_counted',     true
    );
  ELSIF v_last_date = v_yesterday THEN
    -- Продолжение серии
    v_new_current := v_current + 1;
  ELSE
    -- Серия сгорела (пропущены сутки) — стартуем с 1
    v_new_current := 1;
  END IF;

  IF v_new_current > v_longest THEN
    v_longest := v_new_current;
  END IF;

  UPDATE public.user_streaks
  SET current_streak = v_new_current,
      longest_streak = v_longest,
      last_completed_date = v_today
  WHERE user_id = v_user_id;

  INSERT INTO public.user_streak_days (user_id, activity_date)
  VALUES (v_user_id, v_today)
  ON CONFLICT (user_id, activity_date) DO NOTHING;

  RETURN jsonb_build_object(
    'current_streak',      v_new_current,
    'longest_streak',      v_longest,
    'last_completed_date', v_today
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_streak_completion(uuid) TO authenticated;

-- 4) Сброс протухших серий + разовый прогон
CREATE OR REPLACE FUNCTION public.reset_expired_streaks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_yesterday date := (current_date - 1);
  v_updated   integer := 0;
BEGIN
  UPDATE public.user_streaks
  SET current_streak = 0
  WHERE current_streak > 0
    AND last_completed_date IS NOT NULL
    AND last_completed_date::date < v_yesterday;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_expired_streaks() TO authenticated;

SELECT public.reset_expired_streaks();

COMMIT;
