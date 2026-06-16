import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { slug } = await ctx.params;
  const { searchParams } = req.nextUrl;
  
  const tabSlug = searchParams.get("tab"); // e.g. 'textbooks' или 'mock-tests'
  const levelCode = searchParams.get("level"); // e.g. 'hippo-1'

  try {
    // 1. Проверяем существование и доступность проекта по slug
    const { data: project, error: projError } = await supabase
      .from("projects")
      .select("id, is_available")
      .eq("slug", slug)
      .single();

    if (projError || !project) return fail("Проект не найден", 404, "NOT_FOUND");
    if (!project.is_available) return fail("Ветка временно недоступна", 403, "FORBIDDEN");

    // 2. Если передан slug таба — находим его ID
    let tabId: string | null = null;
    if (tabSlug) {
      const { data: tab } = await supabase
        .from("project_tabs")
        .select("id")
        .eq("project_id", project.id)
        .eq("slug", tabSlug)
        .single();
        
      // Если фронт запросил несуществующий таб, отдаем пустой массив
      if (!tab) return ok({ materials: [] });
      tabId = tab.id;
    }

    // 3. Собираем запрос к материалам
    let query = supabase
      .from("materials")
      .select(`
        *,
        project_tabs ( id, name, slug, icon )
      `)
      .eq("project_id", project.id)
      .eq("is_active", true)
      .order("order_index", { ascending: false })
      .order("created_at", { ascending: false });

    // Фильтр по табу
    if (tabId) {
      query = query.eq("tab_id", tabId);
    }

    // Фильтр по уровню: Supabase поддерживает оператор contains для массивов
    if (levelCode) {
      query = query.contains("target_levels", [levelCode]);
    }

    const { data: materials, error: matError } = await query;

    if (matError) return fail(matError.message, 500, "DB_ERROR");

    return ok({ materials: materials ?? [] });
  } catch (e: any) {
    return fail(e?.message || "Внутренняя ошибка сервера", 500, "SERVER_ERROR");
  }
}