// app/api/admin/projects/[id]/materials/route.ts
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import {
  normalizeUUID,
  normalizeBranchType,
  normalizeMaterialKind,
  normalizePrice,
  normalizeOrderIndex,
  normalizeBool,
  normalizeNullableString,
  toStringArray,
  uniqueStrings,
} from "@/lib/materials/normalize";

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
    let query = supabase
      .from("materials")
      .select(
        `
        *,
        project_tabs!inner ( id, title, slug, project_id )
      `,
      )
      .order("order_index", { ascending: false })
      .order("created_at", { ascending: false });

    if (tabId) {
      query = query.eq("project_tab_id", tabId);
    } else {
      query = query.eq("project_tabs.project_id", projectId);
    }

    const { data, error } = await query;

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

  // 1. Обязательные поля
  const title = body?.title?.trim();
  if (!title) {
    return fail("Название материала обязательно", 400, "VALIDATION");
  }

  // 2. Нормализация project_tab_id
  const project_tab_id = normalizeUUID(body?.project_tab_id ?? body?.tab_id);
  if (!project_tab_id) {
    return fail("Необходимо выбрать корректную вкладку (Таб)", 400, "VALIDATION");
  }

  // 3. Остальные поля с нормализацией
  const description = normalizeNullableString(body?.description);
  const cover_image_url = normalizeNullableString(body?.cover_image_url);
  const branch_type = normalizeBranchType(body?.branch_type ?? "olympiad");
  const material_kind = normalizeMaterialKind(body?.material_kind ?? "mock_test");
  const target_levels = uniqueStrings(toStringArray(body?.target_levels ?? body?.target_level));
  const class_levels = uniqueStrings(toStringArray(body?.class_levels ?? body?.class_level));
  const order_index = normalizeOrderIndex(body?.order_index);
  const is_available = normalizeBool(body?.is_available);
  const is_active = body?.is_active !== undefined ? normalizeBool(body?.is_active) : true;
  const price = normalizePrice(body?.price); // ✅ Добавляем цену

  try {
    const { data, error } = await supabase
      .from("materials")
      .insert({
        project_tab_id,
        title,
        description,
        cover_image_url,
        branch_type,
        material_kind,
        target_levels,
        class_levels: class_levels.length > 0 ? class_levels : target_levels, // fallback для обратной совместимости
        order_index,
        is_available,
        is_active,
        price, // ✅ Сохраняем цену
        created_by: user.id,
      })
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