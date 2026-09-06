import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import type { NextRequest } from "next/server";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;
  const { id: userId } = await ctx.params;

  try {
    const [
      { data: materials, error: mErr },
      { data: projects, error: pErr },
      { data: tabs, error: tabErr },
      { data: ma, error: maErr },
    ] = await Promise.all([
      // ❗️ НОВОЕ: Грузим ВСЕ активные материалы без жесткой привязки к gatehouse
      supabase
        .from("materials")
        .select("id,title,branch_type,material_kind,target_levels,class_levels,project_tab_id,is_active,is_available,order_index")
        .eq("is_active", true)
        .order("order_index", { ascending: true }),

      // ❗️ НОВОЕ: Грузим все проекты для модалки
      supabase
        .from("projects")
        .select("id,name,slug")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),

      // ❗️ НОВОЕ: Грузим табы для фильтрации внутри проектов
      supabase
        .from("project_tabs")
        .select("id,title,project_id")
        .eq("is_active", true)
        .order("order_index", { ascending: true }),

      // Текущие доступы юзера
      supabase.from("material_access").select("material_id").eq("user_id", userId),
    ]);

    const err = mErr || pErr || tabErr || maErr;

    if (err) return fail(err.message, 500, "DB_ERROR");

    const selectedMaterialIds = (ma ?? []).map((x: any) => String(x.material_id));

    return ok({
      materials: materials ?? [],
      projects: projects ?? [],
      project_tabs: tabs ?? [],
      selectedMaterialIds,
    });
  } catch (e: any) {
    console.error("🔴 [ADMIN GET USER DATA] Ошибка:", e);
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}