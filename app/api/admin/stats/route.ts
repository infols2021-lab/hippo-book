// app/api/admin/stats/route.ts
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  try {
    // count без вытягивания всех строк
    const [t, c, a, u] = await Promise.all([
      supabase.from("textbooks").select("*", { count: "exact", head: true }),
      supabase.from("crosswords").select("*", { count: "exact", head: true }),
      supabase.from("assignments").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
    ]);

    const err = t.error || c.error || a.error || u.error;
    if (err) return fail(err.message, 500, "DB_ERROR");

    return ok({
      stats: {
        textbooks: t.count ?? 0,
        crosswords: c.count ?? 0,
        assignments: a.count ?? 0,
        users: u.count ?? 0,
      },
    });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}
