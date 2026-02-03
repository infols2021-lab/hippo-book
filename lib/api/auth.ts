import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fail } from "@/lib/api/response";

/**
 * Возвращает { supabase, user }.
 * Если юзера нет — возвращает Response (401), чтобы можно было early-return.
 */
export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return { response: fail("Auth fetch failed", 500, "AUTH_FETCH_FAILED") } as const;
  }
  if (!data.user) {
    return { response: fail("Unauthorized", 401, "UNAUTHORIZED") } as const;
  }

  return { supabase, user: data.user } as const;
}
