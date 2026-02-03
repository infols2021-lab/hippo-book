// lib/api/admin.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fail } from "@/lib/api/response";

/**
 * Надёжный admin guard для Route Handlers / Server Components.
 * Возвращает { supabase, user, profile } или { response }.
 */
export async function requireAdmin() {
  const supabase = await createSupabaseServerClient();

  // 1) Пытаемся получить user (иногда getUser может падать при нагрузке/обрывах)
  const { data: u1, error: e1 } = await supabase.auth.getUser();

  // fallback: если getUser упал — пробуем session
  if (e1) {
    const { data: s2, error: e2 } = await supabase.auth.getSession();
    if (e2) return { response: fail("Auth fetch failed", 401, "AUTH_FETCH_FAILED") } as const;
    if (!s2.session?.user) return { response: fail("Unauthorized", 401, "UNAUTHORIZED") } as const;

    const user = s2.session.user;
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id,is_admin,full_name,email")
      .eq("id", user.id)
      .maybeSingle();

    if (pErr) return { response: fail(pErr.message, 500, "DB_ERROR") } as const;
    if (!profile?.is_admin) return { response: fail("Forbidden", 403, "FORBIDDEN") } as const;

    return { supabase, user, profile } as const;
  }

  if (!u1.user) return { response: fail("Unauthorized", 401, "UNAUTHORIZED") } as const;

  const user = u1.user;

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id,is_admin,full_name,email")
    .eq("id", user.id)
    .maybeSingle();

  if (pErr) return { response: fail(pErr.message, 500, "DB_ERROR") } as const;
  if (!profile?.is_admin) return { response: fail("Forbidden", 403, "FORBIDDEN") } as const;

  return { supabase, user, profile } as const;
}
