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
      { data: textbooks, error: tErr },
      { data: crosswords, error: cErr },
      { data: materials, error: mErr },
      { data: projects, error: pErr },
      { data: tabs, error: tabErr },
      { data: ta, error: taErr },
      { data: ca, error: caErr },
      { data: ma, error: maErr },
    ] = await Promise.all([
      // Легаси: Учебники
      supabase
        .from("textbooks")
        .select("id,title,class_level,is_active,order_index,branch_type")
        .eq("is_active", true)
        .or("branch_type.eq.olympiad,branch_type.is.null")
        .order("order_index", { ascending: true }),

      // Легаси: Кроссворды
      supabase
        .from("crosswords")
        .select("id,title,class_level,is_active,order_index,branch_type")
        .eq("is_active", true)
        .or("branch_type.eq.olympiad,branch_type.is.null")
        .order("order_index", { ascending: true }),

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
      supabase.from("textbook_access").select("textbook_id").eq("user_id", userId),
      supabase.from("crossword_access").select("crossword_id").eq("user_id", userId),
      supabase.from("material_access").select("material_id").eq("user_id", userId),
    ]);

    const err = tErr || cErr || mErr || pErr || tabErr || taErr || caErr || maErr;

    if (err) return fail(err.message, 500, "DB_ERROR");

    const selectedTextbookIds = (ta ?? []).map((x: any) => String(x.textbook_id));
    const selectedCrosswordIds = (ca ?? []).map((x: any) => String(x.crossword_id));
    const selectedMaterialIds = (ma ?? []).map((x: any) => String(x.material_id));

    return ok({
      textbooks: textbooks ?? [],
      crosswords: crosswords ?? [],
      materials: materials ?? [],
      projects: projects ?? [],
      project_tabs: tabs ?? [],
      selectedTextbookIds,
      selectedCrosswordIds,
      selectedMaterialIds,
    });
  } catch (e: any) {
    console.error("🔴 [ADMIN GET USER DATA] Ошибка:", e);
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}