import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const { searchParams } = req.nextUrl;
  const tabId = searchParams.get("tab_id");

  try {
    // В таблице materials нет project_id, фильтруем через project_tabs
    let query = supabase
      .from("materials")
      .select(`
        *,
        project_tabs!inner ( id, title, slug, project_id ) 
      `)
      .order("order_index", { ascending: false })
      .order("created_at", { ascending: false });

    // Если админ выбрал конкретный таб в селекте
    if (tabId) {
      query = query.eq("project_tab_id", tabId);
    } else {
      // Иначе показываем все материалы этого проекта (через связь с project_tabs)
      const { id: projectId } = await ctx.params;
      query = query.eq("project_tabs.project_id", projectId);
    }

    const { data, error } = await query;

    if (error) return fail(error.message, 500, "DB_ERROR");

    return ok({ materials: data ?? [] });
  } catch (e: any) {
    return fail(e?.message || "Внутренняя ошибка сервера", 500, "SERVER_ERROR");
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Неверный формат JSON", 400, "BAD_JSON");
  }

  const title = String(body?.title ?? "").trim();
  const description = body?.description ? String(body.description).trim() : null;
  const project_tab_id = String(body?.project_tab_id ?? "").trim();
  const target_levels = Array.isArray(body?.target_levels) ? body.target_levels.map(String).filter(Boolean) : [];
  const order_index = Number.isFinite(Number(body?.order_index)) ? Number(body.order_index) : 0;
  const is_available = Boolean(body?.is_available);
  const is_active = body?.is_active !== undefined ? Boolean(body?.is_active) : true;
  const cover_image_url = body?.cover_image_url ? String(body.cover_image_url).trim() : null;

  if (!title) return fail("Название материала обязательно", 400, "VALIDATION");
  if (!project_tab_id) return fail("Необходимо выбрать вкладку (Таб)", 400, "VALIDATION");

  try {
    const { data, error } = await supabase
      .from("materials")
      .insert({
        project_tab_id, 
        title,
        description,
        target_levels, 
        class_levels: target_levels, // Дублируем для обратной совместимости с БД
        material_kind: "textbook",   // Обходим легаси-ограничение БД 
        branch_type: "olympiad",     // Обходим ограничение "materials_branch_type_check"
        order_index,
        is_available,
        is_active,
        cover_image_url,
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500, "DB_ERROR");

    return ok({ material: data });
  } catch (e: any) {
    return fail(e?.message || "Внутренняя ошибка сервера", 500, "SERVER_ERROR");
  }
}