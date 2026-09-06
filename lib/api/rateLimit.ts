// lib/api/rateLimit.ts
// Rate limiting с фиксированным окном поверх Supabase (service_role).
import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
};

const DEFAULT_WINDOW_SEC = 60;
const DEFAULT_LIMIT = 60;

/**
 * Увеличивает счётчик для ключа и возвращает, не превышен ли лимит.
 * Сбои БД — fail-open (не блокируем легитимные запросы из-за проблем с лимитером).
 */
export async function checkRateLimit(
  key: string,
  limit = DEFAULT_LIMIT,
  windowSec = DEFAULT_WINDOW_SEC
): Promise<RateLimitResult> {
  if (!key) return { allowed: true, remaining: limit };

  try {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_key: key,
      p_window_sec: windowSec,
    });

    if (error) {
      console.error("[rate_limit] RPC error:", error.message);
      return { allowed: true, remaining: limit };
    }

    const count = Number(data ?? 0);
    return { allowed: count <= limit, remaining: Math.max(limit - count, 0) };
  } catch (e) {
    console.error("[rate_limit] error:", e);
    return { allowed: true, remaining: limit };
  }
}
