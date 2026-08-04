// app/api/admin/projects/[id]/materials/route.ts
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import { normalizeMaterialInput } from "@/lib/materials/normalize";

function normalizePrice(value: any): number {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.round(num) : 1000;
}

// ----------------------------------------------------------------------------
// GET: список материалов для проекта/таба
// ----------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { supabase } = auth;

  const { searchParams } = req.nextUrl;
  const tabId = searchParams.get("tab_id");
  const { id: projectId } = await ctx.params;

  try {
    // Получаем все табы проекта (включая неактивные, чтобы админ видел все материалы)
    const { data: tabs, error: tabsError } = await supabase
      .from("project_tabs")
      .select("id")
      .eq("project_id", projectId);

    if (tabsError) {
      console.error("🔴 [ADMIN GET MATERIALS] Ошибка получения табов:", tabsError.message);
      return fail(tabsError.message, 500, "DB_ERROR");
    }

    const tabIds = tabs?.map((t) => t.id) || [];

    // Если передан конкретный tab_id, проверяем принадлежность проекту
    if (tabId) {
      if (!tabIds.includes(tabId)) {
        return ok({ materials: [] });
      }
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .eq("project_tab_id", tabId)
        .order("order_index", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("🔴 [ADMIN GET MATERIALS] Ошибка БД:", error.message);
        return fail(error.message, 500, "DB_ERROR");
      }
      return ok({ materials: data ?? [] });
    }

    // Если tab_id не передан, возвращаем все материалы, привязанные к любому табу проекта
    if (tabIds.length === 0) {
      return ok({ materials: [] });
    }

    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .in("project_tab_id", tabIds)
      .order("order_index", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("🔴 [ADMIN GET MATERIALS] Ошибка БД:", error.message);
      return fail(error.message, 500, "DB_ERROR");
    }

    return ok({ materials: data ?? [] });
  } catch (e: any) {
    console.error("🔴 [ADMIN GET MATERIALS] Ошибка сервера:", e);
    return fail(e?.message || "Внутренняя ошибка сервера", 500, "SERVER_ERROR");
  }
}

// ----------------------------------------------------------------------------
// POST: создание нового материала
// ----------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Неверный формат JSON", 400, "BAD_JSON");
  }

  // 1. Единая точка нормализации всех данных + фиксация кастомной цены
  const basePayload = normalizeMaterialInput(body, user.id);
  const payload = {
    ...basePayload,
    price: normalizePrice(body.price),
  };

  // 2. Валидация обязательных полей
  if (!payload.title) {
    return fail("Название материала обязательно", 400, "VALIDATION");
  }

  if (!payload.project_tab_id) {
    return fail("Необходимо выбрать корректную вкладку (Таб)", 400, "VALIDATION");
  }

  // Fallback для старых клиентов, если прислали только target_levels
  if (payload.class_levels.length === 0 && payload.target_levels.length > 0) {
    payload.class_levels = payload.target_levels;
  }

  // 3. Сохранение в БД
  try {
    const { data, error } = await supabase
      .from("materials")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error("🔴 [ADMIN POST MATERIAL] Ошибка БД:", error.message);
      return fail(error.message, 500, "DB_ERROR");
    }

    return ok({ material: data });
  } catch (e: any) {
    console.error("🔴 [ADMIN POST MATERIAL] Ошибка сервера:", e);
    return fail(e?.message || "Внутренняя ошибка сервера", 500, "SERVER_ERROR");
  }
}