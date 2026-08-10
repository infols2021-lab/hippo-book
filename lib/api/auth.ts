import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fail } from "@/lib/api/response";

export type AuthProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  contact_phone: string | null;
  region: string | null;
  is_admin: boolean | null;
  completed_assignments_count?: number | null;
  ga_completed_assignments_count?: number | null;
};

const RETRY_COUNT = 2;
const RETRY_BASE_DELAY_MS = 350;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMissingSessionError(error: any) {
  const msg = String(error?.message || error || "").toLowerCase();

  return (
    msg.includes("auth session missing") ||
    msg.includes("session missing") ||
    msg.includes("no session") ||
    (msg.includes("jwt") && msg.includes("missing")) ||
    msg.includes("invalid token")
  );
}

function isTransientError(error: any) {
  const msg = String(error?.message || error || "").toLowerCase();

  return (
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("eai_again") ||
    msg.includes("enotfound") ||
    msg.includes("socket") ||
    msg.includes("network")
  );
}

async function getUserWithRetry(supabase: any) {
  let lastError: any = null;

  for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
    const { data, error } = await supabase.auth.getUser();

    if (!error) {
      return { user: data?.user ?? null, error: null };
    }

    lastError = error;

    if (isMissingSessionError(error)) {
      return { user: null, error: null, missingSession: true };
    }

    if (!isTransientError(error) || attempt === RETRY_COUNT) break;

    await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
  }

  return { user: null, error: lastError };
}

async function getProfileWithRetry(supabase: any, userId: string) {
  let lastError: any = null;

  for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        `
        id,
        email,
        full_name,
        contact_phone,
        region,
        is_admin,
        completed_assignments_count,
        ga_completed_assignments_count
      `,
      )
      .eq("id", userId)
      .maybeSingle();

    if (!error) {
      return { profile: data ?? null, error: null };
    }

    lastError = error;

    if (!isTransientError(error) || attempt === RETRY_COUNT) break;

    await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
  }

  return { profile: null, error: lastError };
}

/**
 * Возвращает { supabase, user, profile }.
 * Если юзера нет — возвращает Response (401), чтобы можно было early-return.
 *
 * Ретраит транзиентные сетевые ошибки (fetch failed / ECONNRESET / timeout и т.д.),
 * чтобы разовый сбой хостинга/прокси не превращался в "Auth fetch failed" на ровном месте.
 * Отсутствие сессии — это нормальный 401, а не 500.
 */
export async function requireUser() {
  const supabase = await createSupabaseServerClient();

  const { user, error: userError } = await getUserWithRetry(supabase);

  if (userError) {
    return { response: fail("Auth fetch failed", 500, "AUTH_FETCH_FAILED") } as const;
  }

  if (!user) {
    return { response: fail("Unauthorized", 401, "UNAUTHORIZED") } as const;
  }

  const { profile, error: profileError } = await getProfileWithRetry(supabase, user.id);

  if (profileError) {
    return { response: fail("Profile fetch failed", 500, "PROFILE_FETCH_FAILED") } as const;
  }

  return {
    supabase,
    user,
    profile: (profile ?? null) as AuthProfile | null,
  } as const;
}