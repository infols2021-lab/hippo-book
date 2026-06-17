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

function normalizePatchPayload(body: any) {
  const payload: Record<string, any> = {};

  if ("branch_type" in body) payload.branch_type = normalizeBranchType(body.branch_type);
  if ("material_kind" in body) payload.material_kind = normalizeMaterialKind(body.material_kind);
  if ("title" in body) payload.title = String(body.title ?? "").trim();
  if ("description" in body) payload.description = normalizeNullableString(body.description);
  if ("cover_image_url" in body) payload.cover_image_url = normalizeNullableString(body.cover_image_url);
  if ("is_available" in body) payload.is_available = normalizeBool(body.is_available);
  if ("is_active" in body) payload.is_active = normalizeBool(body.is_active);
  if ("order_index" in body) payload.order_index = normalizeOrderIndex(body.order_index);
  
  if ("class_levels" in body || "class_level" in body) {
    payload.class_levels = uniqueStrings(toStringArray(body.class_levels ?? body.class_level));
  }
  if ("target_levels" in body || "target_level" in body) {
    payload.target_levels = uniqueStrings(toStringArray(body.target_levels ?? body.target_level));
  }
  if ("meta" in body) {
    payload.meta = body?.meta && typeof body.meta === "object" && !Array.isArray(body.meta) ? body.meta : {};
  }
  
  // ❗️ ГЛАВНЫЙ ФИКС ЗДЕСЬ:
  // Перехватываем нулевой UUID и превращаем его в null, чтобы БД не падала
  if ("project_tab_id" in body || "tab_id" in body) {
    let tid = normalizeNullableString(body.project_tab_id ?? body.tab_id);
    
    // Если фронт прислал "заглушку" пустого таба - превращаем в null
    if (tid === "00000000-0000-0000-0000-000000000000" || tid === "none" || tid === "") {
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