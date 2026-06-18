import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import { normalizeBranchType } from "@/lib/branches/config";
import { normalizeMaterialKind, toStringArray, uniqueStrings } from "@/lib/materials/format";

function normalizeBool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeOrderIndex(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str || null;
}

// Проверка, является ли строка настоящим UUID
function isValidUUID(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

function normalizePatchPayload(body: any) {
  const payload: Record<string, any> = {};

  // Поддержка snake_case и camelCase с фронтенда
  const branchType = body.branch_type ?? body.branchType;
  if (branchType !== undefined) payload.branch_type = normalizeBranchType(branchType);

  const materialKind = body.material_kind ?? body.materialKind;
  if (materialKind !== undefined) payload.material_kind = normalizeMaterialKind(materialKind);

  if ("title" in body) payload.title = String(body.title ?? "").trim();
  if ("description" in body) payload.description = normalizeNullableString(body.description);
  
  const coverUrl = body.cover_image_url ?? body.coverImageUrl;
  if (coverUrl !== undefined) payload.cover_image_url = normalizeNullableString(coverUrl);
  
  if ("is_available" in body) payload.is_available = normalizeBool(body.is_available);
  if ("is_active" in body) payload.is_active = normalizeBool(body.is_active);
  if ("order_index" in body) payload.order_index = normalizeOrderIndex(body.order_index);
  
  const classLevels = body.class_levels ?? body.class_level ?? body.classLevels;
  if (classLevels !== undefined) {
    payload.class_levels = uniqueStrings(toStringArray(classLevels));
  }
  
  const targetLevels = body.target_levels ?? body.target_level ?? body.targetLevels;
  if (targetLevels !== undefined) {
    payload.target_levels = uniqueStrings(toStringArray(targetLevels));
  }
  
  if ("meta" in body) {
    payload.meta = body?.meta && typeof body.meta === "object" && !Array.isArray(body.meta) ? body.meta : {};
  }
  
  // ❗️ УЛЬТРА-ФИКС ДЛЯ ТАБОВ:
  // Ловим все варианты ключей от фронтенда
  const rawTabId = body.project_tab_id ?? body.tab_id ?? body.projectTabId ?? body.tabId;
  if (rawTabId !== undefined) {
    let tid = normalizeNullableString(rawTabId);
    
    // Очищаем от заглушек фронтенда
    if (tid === "00000000-0000-0000-0000-000000000000" || tid === "none" || tid === "null" || tid === "") {
      tid = null;
    }

    // Защита от краша базы: если фронт прислал текст вместо ID (например, "что то") — сбрасываем в null
    if (tid && !isValidUUID(tid)) {
      console.warn("⚠️ [ADMIN PATCH MATERIAL] Получен невалидный UUID для таба:", tid, "Сбрасываем в null, чтобы БД не упала.");
      tid = null;
    }
    
    payload.project_tab_id = tid;
  }

  return payload;
}

function validatePatchPayload(payload: Record<string, any>) {
  if ("title" in payload && !payload.title) return "title required";
  if ("material_kind" in payload && !payload.material_kind) return "material_kind required";
  if ("branch_type" in payload && payload.branch_type === "gatehouse" && "target_levels" in payload && payload.target_levels.length === 0) {
    return "target_levels required";
  }
  if ("branch_type" in payload && payload.branch_type === "olympiad" && "class_levels" in payload && payload.class_levels.length === 0) {
    return "class_levels required";
  }

  return null;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;
  const { id } = await ctx.params;

  if (!id) return fail("id required", 400, "VALIDATION");

  try {
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("🔴 [ADMIN GET MATERIAL] Ошибка поиска:", error.message);
      return fail(error.message, 404, "NOT_FOUND");
    }

    const { count, error: countErr } = await supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .or(`material_id.eq.${id},textbook_id.eq.${id},crossword_id.eq.${id}`);

    if (countErr) {
      console.error("🔴 [ADMIN GET MATERIAL] Ошибка подсчета заданий:", countErr.message);
    }

    return ok({
      material: {
        ...data,
        assignments_count: count ?? 0,
      },
    });
  } catch (error: any) {
    console.error("🔴 [ADMIN GET MATERIAL] Серверная ошибка:", error);
    return fail(error?.message || "Server error", 500, "SERVER_ERROR");
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;
  const { id } = await ctx.params;

  if (!id) return fail("id required", 400, "VALIDATION");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Bad JSON", 400, "BAD_JSON");
  }

  const payload = normalizePatchPayload(body);
  const validationError = validatePatchPayload(payload);

  if (validationError) {
    console.error("🔴 [ADMIN PATCH MATERIAL] Провал валидации:", validationError);
    return fail(validationError, 400, "VALIDATION");
  }

  if (Object.keys(payload).length === 0) {
    return fail("Nothing to update", 400, "VALIDATION");
  }

  try {
    const { data, error } = await supabase
      .from("materials")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error("🔴 [ADMIN PATCH MATERIAL] Ошибка БД при сохранении:", error.message, error.details);
      
      let errorMsg = error.message;
      if (errorMsg.includes("foreign key")) errorMsg = "Ошибка привязки таба (несуществующий ID)";
      
      return fail(errorMsg, 500, "DB_ERROR");
    }

    return ok({ material: data });
  } catch (error: any) {
    console.error("🔴 [ADMIN PATCH MATERIAL] Серверная ошибка:", error);
    return fail(error?.message || "Server error", 500, "SERVER_ERROR");
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;
  const { id } = await ctx.params;

  if (!id) return fail("id required", 400, "VALIDATION");

  try {
    const { error } = await supabase.from("materials").delete().eq("id", id);

    if (error) {
      console.error("🔴 [ADMIN DELETE MATERIAL] Ошибка удаления:", error.message);
      return fail(error.message, 500, "DB_ERROR");
    }

    return ok({ deleted: true });
  } catch (error: any) {
    return fail(error?.message || "Server error", 500, "SERVER_ERROR");
  }
}