import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    // 1. Активные проекты
    const { data: projects, error: pErr } = await supabase
      .from("projects")
      .select("id, name, slug, theme_color, theme, order_index")
      .eq("is_active", true)
      .order("order_index", { ascending: true });

    if (pErr) throw pErr;

    const projectIds = (projects || []).map((p) => p.id);

    if (projectIds.length === 0) {
      return NextResponse.json({ ok: true, projects: [], tabs: [], materials: [] });
    }

    // 2. Табы (разделы)
    const { data: tabs, error: tErr } = await supabase
      .from("project_tabs")
      .select("id, project_id, title, icon, order_index")
      .in("project_id", projectIds)
      .order("order_index", { ascending: true });

    if (tErr) throw tErr;

    // 3. Активные материалы
    const { data: materials, error: mErr } = await supabase
      .from("materials")
      .select("id, project_id, project_tab_id, title, description, cover_image_url, price, is_active")
      .eq("is_active", true)
      .in("project_id", projectIds);

    if (mErr) throw mErr;

    // Нормализуем ключи табов
    const normalizedMaterials = (materials || []).map((m: any) => ({
      ...m,
      tab_id: m.project_tab_id || m.tab_id,
    }));

    return NextResponse.json({
      ok: true,
      projects: projects || [],
      tabs: tabs || [],
      materials: normalizedMaterials,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Ошибка загрузки материалов" },
      { status: 500 }
    );
  }
}