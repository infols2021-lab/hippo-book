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

/**
 * Возвращает { supabase, user, profile }.
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

  const { data: profile, error: profileError } = await supabase
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
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    return { response: fail("Profile fetch failed", 500, "PROFILE_FETCH_FAILED") } as const;
  }

  return {
    supabase,
    user: data.user,
    profile: (profile ?? null) as AuthProfile | null,
  } as const;
}