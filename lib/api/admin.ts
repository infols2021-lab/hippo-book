// lib/api/admin.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fail } from "@/lib/api/response";

/**
 * Надёжный admin guard для Route Handlers / Server Components.
 * Не использует getSession().user как источник прав, чтобы не ловить Supabase warning.
 */
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
    msg.includes("jwt") && msg.includes("missing")
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
      return { user: null, error: null };
    }

    if (!isTransientError(error) || attempt === RETRY_COUNT) break;

    await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
  }

  return { user: null, error: lastError };
}

async function getAdminProfileWithRetry(supabase: any, userId: string) {
  let lastError: any = null;

  for (let attempt = 0; attempt <= RETRY_COUNT; attempt += 1) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,is_admin,full_name,email")
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

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();

  const { user, error: userError } = await getUserWithRetry(supabase);

  if (userError) {
    return { response: fail("Auth fetch failed", 401, "AUTH_FETCH_FAILED") } as const;
  }

  if (!user) {
    return { response: fail("Unauthorized", 401, "UNAUTHORIZED") } as const;
  }

  const { profile, error: profileError } = await getAdminProfileWithRetry(supabase, user.id);

  if (profileError) {
    return { response: fail(profileError.message, 500, "DB_ERROR") } as const;
  }

  if (!profile?.is_admin) {
    return { response: fail("Forbidden", 403, "FORBIDDEN") } as const;
  }

  return { supabase, user, profile } as const;
}