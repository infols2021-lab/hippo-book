import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";

// Импортируем всё из нашей новой единой точки истины (Single Source of Truth)
import {
  normalizeString,
  normalizeNullableString,
  normalizeBool,
  normalizeOrderIndex,
  normalizePrice,
  normalizeUUID,
  normalizeBranchType,
  normalizeMaterialKind,
  normalizeClassLevels,
  normalizeTargetLevels
} from "@/lib/materials/normalize";

// Создаем чистый payload, поддерживающий частичное обновление (PATCH/PUT)
function normalizePatchPayload(body: any) {
  const payload: Record<string, any> = {};

  if ("branch_type" in body || "branchType" in body) {
    payload.branch_type = normalizeBranchType(body.branch_type ?? body.branchType);
  }
  
  if ("material_kind" in body || "materialKind" in body) {
    payload.material_kind = normalizeMaterialKind(body.material_kind ?? body.materialKind);
  }
  
  if ("title" in body) {
    payload.title = normalizeString(body.title);
  }
  
  if ("description" in body) {
    payload.description = normalizeNullableString(body.description);
  }
  
  if ("cover_image_url" in body || "coverImageUrl" in body) {
    payload.cover_image_url = normalizeNullableString(body.cover_image_url ?? body.coverImageUrl);
  }
  
  if ("is_available" in body || "isAvailable" in body) {
    payload.is_available = normalizeBool(body.is_available ?? body.isAvailable);
  }
  
  if ("is_active" in body || "isActive" in body) {
    payload.is_active = normalizeBool(body.is_active ?? body.isActive);
  }
  
  if ("order_index" in body || "orderIndex" in body) {
    payload.order_index = normalizeOrderIndex(body.order_index ?? body.orderIndex);
  }

  // ❗️ ИСПРАВЛЕНА ПРОБЛЕМА: Цена теперь сохраняется
  if ("price" in body) {
    payload.price = normalizePrice(body.price);
  }
  
  if ("class_levels" in body || "class_level" in body || "classLevels" in body) {
    payload.class_levels = normalizeClassLevels(body.class_levels ?? body.class_level ?? body.classLevels);
  }
  
  if ("target_levels" in body || "target_level" in body || "targetLevels" in body) {
    payload.target_levels = normalizeTargetLevels(body.target_levels ?? body.target_level ?? body.targetLevels);
  }
  
  if ("meta" in body) {
    payload.meta = body?.meta && typeof body.meta === "object" && !Array.isArray(body.meta) ? body.meta : {};
  }
  
  // ❗️ ИСПРАВЛЕНА ПРОБЛЕМА: Ультра-фикс для табов теперь под капотом в normalizeUUID
  const hasTabId = "project_tab_id" in body || "tab_id" in body || "projectTabId" in body || "tabId" in body;
  if (hasTabId) {
    const rawTabId = body.project_tab_id ?? body.tab_id ?? body.projectTabId ?? body.tabId;
    payload.project_tab_id = normalizeUUID(rawTabId);
  }

  return payload;
}

function validatePatchPayload(payload: Record<string, any>) {
  if ("title" in payload && !payload.title) return "title required";
  if ("material_kind" in payload && !payload.material_kind) return "material_kind required";
  
  if (
    "branch_type" in payload && 
    payload.branch_type === "gatehouse" && 
    "target_levels" in payload && 
    (!payload.target_levels || payload.target_levels.length === 0)
  ) {
    return "target_levels required";
  }
  
  if (
    "branch_type" in payload && 
    payload.branch_type === "olympiad" && 
    "class_levels" in payload && 
    (!payload.class_levels || payload.class_levels.length === 0)
  ) {
    return "class_levels required";
  }
  
  return null;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; materialId: string }> }) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;
  const { materialId } = await ctx.params;

  if (!materialId) return fail("materialId required", 400, "VALIDATION");

  try {
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .eq("id", materialId)
      .single();

    if (error) return fail(error.message, 404, "NOT_FOUND");

    const { count } = await supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .or(`material_id.eq.${materialId},textbook_id.eq.${materialId},crossword_id.eq.${materialId}`);

    return ok({
      material: {
        ...data,
        assignments_count: count ?? 0,
      },
    });
  } catch (error: any) {
    return fail(error?.message || "Server error", 500, "SERVER_ERROR");
  }
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string; materialId: string }> }) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;
  const { materialId } = await ctx.params;

  if (!materialId) return fail("materialId required", 400, "VALIDATION");

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Bad JSON", 400, "BAD_JSON");
  }

  const payload = normalizePatchPayload(body);
  const validationError = validatePatchPayload(payload);

  if (validationError) {
    console.error("🔴 [ADMIN PUT MATERIAL] Провал валидации:", validationError);
    return fail(validationError, 400, "VALIDATION");
  }

  if (Object.keys(payload).length === 0) {
    return fail("Nothing to update", 400, "VALIDATION");
  }

  try {
    const { data, error } = await supabase
      .from("materials")
      .update(payload)
      .eq("id", materialId)
      .select("*")
      .single();

    if (error) {
      console.error("🔴 [ADMIN PUT MATERIAL] Ошибка БД при сохранении:", error.message, error.details);
      let errorMsg = error.message;
      if (errorMsg.includes("foreign key")) errorMsg = "Ошибка привязки таба (несуществующий ID)";
      return fail(errorMsg, 500, "DB_ERROR");
    }

    return ok({ material: data });
  } catch (error: any) {
    console.error("🔴 [ADMIN PUT MATERIAL] Серверная ошибка:", error);
    return fail(error?.message || "Server error", 500, "SERVER_ERROR");
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; materialId: string }> }) {
  return PUT(req, ctx);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; materialId: string }> }) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;
  const { materialId } = await ctx.params;

  if (!materialId) return fail("materialId required", 400, "VALIDATION");

  try {
    const { error } = await supabase.from("materials").delete().eq("id", materialId);

    if (error) return fail(error.message, 500, "DB_ERROR");

    return ok({ deleted: true });
  } catch (error: any) {
    return fail(error?.message || "Server error", 500, "SERVER_ERROR");
  }
}