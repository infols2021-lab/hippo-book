// app/api/admin/stats/route.ts
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;

  try {
    const [t, c, m, gaM, a, gaA, u] = await Promise.all([
      supabase
        .from("textbooks")
        .select("*", { count: "exact", head: true })
        .or("branch_type.eq.olympiad,branch_type.is.null"),

      supabase
        .from("crosswords")
        .select("*", { count: "exact", head: true })
        .or("branch_type.eq.olympiad,branch_type.is.null"),

      supabase.from("materials").select("*", { count: "exact", head: true }),

      supabase
        .from("materials")
        .select("*", { count: "exact", head: true })
        .eq("branch_type", "gatehouse"),

      supabase.from("assignments").select("*", { count: "exact", head: true }),

      supabase
        .from("assignments")
        .select("*", { count: "exact", head: true })
        .eq("branch_type", "gatehouse"),

      supabase.from("profiles").select("*", { count: "exact", head: true }),
    ]);

    const err = t.error || c.error || m.error || gaM.error || a.error || gaA.error || u.error;
    if (err) return fail(err.message, 500, "DB_ERROR");

    return ok({
      stats: {
        textbooks: t.count ?? 0,
        crosswords: c.count ?? 0,
        materials: m.count ?? 0,
        gatehouseMaterials: gaM.count ?? 0,
        assignments: a.count ?? 0,
        gatehouseAssignments: gaA.count ?? 0,
        users: u.count ?? 0,
      },
    });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}