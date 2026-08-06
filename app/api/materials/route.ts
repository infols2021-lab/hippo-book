import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 0;

export async function GET() {
  try {
    // Создаем клиент с Service Role Key для полного обхода RLS на сервере
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Активные проекты
    const { data: projects, error: pErr } = await supabaseAdmin
      .from("projects")
      .select("id, name, slug, theme_color, theme, order_index")
      .eq("is_active", true)
      .order("order_index", { ascending: true });

    if (pErr) throw pErr;

    const projectIds = (projects || []).map((p) => p.id);

    if (projectIds.length === 0) {
      return NextResponse.json({ ok: true, projects: [], tabs: [], materials: [] });
    }

    // 2. Активные табы (разделы)
    const { data: tabs, error: tErr } = await supabaseAdmin
      .from("project_tabs")
      .select("id, project_id, title, icon, order_index")
      .in("project_id", projectIds)
      .eq("is_active", true)
      .order("order_index", { ascending: true });

    if (tErr) throw tErr;

    const tabIds = (tabs || []).map((t) => t.id);

    if (tabIds.length === 0) {
      return NextResponse.json({ ok: true, projects: projects || [], tabs: [], materials: [] });
    }

    // 3. Активные материалы по project_tab_id
    const { data: materials, error: mErr } = await supabaseAdmin
      .from("materials")
      .select("id, project_tab_id, title, description, cover_image_url, price, is_active, is_secret")
      .eq("is_active", true)
      .in("project_tab_id", tabIds);

    if (mErr) throw mErr;

    // Маппинг tab_id -> project_id для связывания в интерфейсе
    const tabToProjectMap = new Map<string, string>();
    (tabs || []).forEach((t) => {
      tabToProjectMap.set(t.id, t.project_id);
    });

    const normalizedMaterials = (materials || [])
      .filter((m: any) => !m.is_secret)
      .map((m: any) => {
        const tabId = m.project_tab_id;
        const projectId = tabToProjectMap.get(tabId) || null;
        return {
          ...m,
          project_id: projectId,
          tab_id: tabId,
        };
      });

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