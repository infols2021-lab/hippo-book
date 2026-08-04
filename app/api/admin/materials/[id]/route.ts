// app/api/admin/materials/[id]/route.ts
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";

import {
  normalizeString,
  normalizeNullableString,
  normalizeBool,
  normalizeOrderIndex,
  normalizeUUID,
  normalizeBranchType,
  normalizeMaterialKind,
  normalizeClassLevels,
  normalizeTargetLevels,
} from "@/lib/materials/normalize";

function normalizePrice(value: any): number {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.round(num) : 1000;
}

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

  if ("price" in body) {
    payload.price = normalizePrice(body.price);
  }

  if ("is_available" in body || "isAvailable" in body) {
    payload.is_available = normalizeBool(body.is_available ?? body.isAvailable);
  }

  if ("is_active" in body || "isActive" in body) {
    payload.is_active = normalizeBool(body.is_active ?? body.isActive);
  }

  if ("is_secret" in body || "isSecret" in body) {
    payload.is_secret = normalizeBool(body.is_secret ?? body.isSecret);
  }

  if ("order_index" in body || "orderIndex" in body) {
    payload.order_index = normalizeOrderIndex(body.order_index ?? body.orderIndex);
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

    if (data?.legacy_source_table && data?.legacy_source_id) {
      const legacyPayload: Record<string, any> = {};
      if ("price" in payload) legacyPayload.price = payload.price;
      if ("title" in payload) legacyPayload.title = payload.title;
      if ("description" in payload) legacyPayload.description = payload.description;
      if ("cover_image_url" in payload) legacyPayload.cover_image_url = payload.cover_image_url;

      if (Object.keys(legacyPayload).length > 0) {
        try {
          await supabase
            .from(data.legacy_source_table)
            .update(legacyPayload)
            .eq("id", data.legacy_source_id);
        } catch {
          // Игнорируем ошибки синхронизации легаси-таблиц
        }
      }
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