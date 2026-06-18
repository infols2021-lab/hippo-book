import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";

// Утилиты для безопасной обработки данных
function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str || null;
}

function isValidUUID(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

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
  const { supabase, user } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Неверный формат JSON", 400, "BAD_JSON");
  }

  const title = String(body?.title ?? "").trim();
  if (!title) return fail("Название материала обязательно", 400, "VALIDATION");

  // ❗️ ЗАЩИТА ТАБА: Читаем и проверяем UUID
  let project_tab_id = normalizeNullableString(body?.project_tab_id ?? body?.tab_id);
  
  if (project_tab_id === "00000000-0000-0000-0000-000000000000" || project_tab_id === "none" || project_tab_id === "null") {
    project_tab_id = null;
  }
  
  // Если прилетел кривой текст вместо UUID
  if (project_tab_id && !isValidUUID(project_tab_id)) {
    project_tab_id = null;
  }

  if (!project_tab_id) {
    return fail("Необходимо выбрать корректную вкладку (Таб)", 400, "VALIDATION");
  }

  const description = normalizeNullableString(body?.description);
  const cover_image_url = normalizeNullableString(body?.cover_image_url);
  const target_levels = Array.isArray(body?.target_levels) ? body.target_levels.map(String).filter(Boolean) : [];
  const order_index = Number.isFinite(Number(body?.order_index)) ? Number(body.order_index) : 0;
  const is_available = Boolean(body?.is_available);
  const is_active = body?.is_active !== undefined ? Boolean(body?.is_active) : true;

  // ❗️ УБИРАЕМ ХАРДКОД: Читаем реальные значения от фронта. 
  // Дефолты оставляем только для обхода ограничений старой БД (если фронт их не прислал)
  const branch_type = normalizeNullableString(body?.branch_type) || "olympiad"; 
  const material_kind = normalizeNullableString(body?.material_kind) || "mock_test"; 

  try {
    const { data, error } = await supabase
      .from("materials")
      .insert({
        project_tab_id, 
        title,
        description,
        target_levels, 
        class_levels: target_levels, // Дублируем для обратной совместимости
        material_kind,
        branch_type,
        order_index,
        is_available,
        is_active,
        cover_image_url,
        created_by: user.id // Логируем, кто создал материал
      })
      .select("*")
      .single();

    if (error) {
      console.error("🔴 [ADMIN POST MATERIAL] Ошибка Базы Данных:", error.message);
      return fail(error.message, 500, "DB_ERROR");
    }

    return ok({ material: data });
  } catch (e: any) {
    console.error("🔴 [ADMIN POST MATERIAL] Ошибка сервера:", e);
    return fail(e?.message || "Внутренняя ошибка сервера", 500, "SERVER_ERROR");
  }
}