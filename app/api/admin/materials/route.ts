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

function isValidUUID(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

function normalizePayload(body: any, userId: string) {
  const branch_type = normalizeBranchType(body?.branch_type);
  const material_kind = normalizeMaterialKind(body?.material_kind || "mock_test");
  const title = String(body?.title ?? "").trim();
  const description = normalizeNullableString(body?.description);
  const cover_image_url = normalizeNullableString(body?.cover_image_url);
  const is_available = normalizeBool(body?.is_available);
  const is_active = body?.is_active === undefined ? true : normalizeBool(body?.is_active);
  const order_index = normalizeOrderIndex(body?.order_index);
  const class_levels = uniqueStrings(toStringArray(body?.class_levels ?? body?.class_level));
  const target_levels = uniqueStrings(toStringArray(body?.target_levels ?? body?.target_level));
  const meta = body?.meta && typeof body.meta === "object" && !Array.isArray(body.meta) ? body.meta : {};

  let project_tab_id = normalizeNullableString(body?.project_tab_id ?? body?.tab_id);
  
  if (project_tab_id === "00000000-0000-0000-0000-000000000000" || project_tab_id === "none" || project_tab_id === "null" || project_tab_id === "") {
    project_tab_id = null;
  }

  if (project_tab_id && !isValidUUID(project_tab_id)) {
    project_tab_id = null;
  }

  return {
    project_tab_id,
    branch_type,
    material_kind,
    title,
    description,
    cover_image_url,
    is_available,
    is_active,
    order_index,
    class_levels,
    target_levels,
    created_by: userId,
    meta,
  };
}

function validateMaterial(payload: ReturnType<typeof normalizePayload>) {
  if (!payload.title) return "title required";
  if (!payload.material_kind) return "material_kind required";

  if (payload.branch_type === "olympiad" && payload.class_levels.length === 0) {
    return "class_levels required";
  }

  if (payload.branch_type === "gatehouse" && payload.target_levels.length === 0) {
    return "target_levels required";
  }

  return null;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;
  const { searchParams } = new URL(req.url);

  const branch_type = searchParams.get("branch_type");
  const material_kind = searchParams.get("material_kind");
  const includeCounts = searchParams.get("include_counts") !== "false";

  try {
    let query = supabase
      .from("materials")
      .select("*")
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: false });

    if (branch_type) {
      query = query.eq("branch_type", normalizeBranchType(branch_type));
    }

    if (material_kind) {
      query = query.eq("material_kind", normalizeMaterialKind(material_kind));
    }

    const { data, error } = await query;

    if (error) return fail(error.message, 500, "DB_ERROR");

    const materials = data ?? [];

    if (!includeCounts || materials.length === 0) {
      return ok({ materials });
    }

    // ❗️ УБИТА ПРИЧИНА ЗАВИСАНИЯ: Больше никаких гигантских .or() строк
    // Просто забираем связи и считаем в памяти. 
    const { data: assignments, error: countError } = await supabase
      .from("assignments")
      .select("id, material_id, textbook_id, crossword_id");

    if (countError) {
      console.error("🔴 [ADMIN GET MATERIALS] Ошибка подсчета заданий:", countError.message);
      return ok({ materials });
    }

    const counts: Record<string, number> = {};

    for (const assignment of assignments ?? []) {
      const matId = String(assignment.material_id || assignment.textbook_id || assignment.crossword_id || "");
      if (!matId) continue;
      counts[matId] = (counts[matId] || 0) + 1;
    }

    return ok({
      materials: materials.map((material: any) => ({
        ...material,
        assignments_count: counts[String(material.id)] || 0,
      })),
    });
  } catch (error: any) {
    console.error("🔴 [ADMIN GET MATERIALS] Серверная ошибка:", error);
    return fail(error?.message || "Server error", 500, "SERVER_ERROR");
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Bad JSON", 400, "BAD_JSON");
  }

  const payload = normalizePayload(body, user.id);
  const validationError = validateMaterial(payload);

  if (validationError) {
    console.error("🔴 [ADMIN POST MATERIAL] Ошибка валидации:", validationError);
    return fail(validationError, 400, "VALIDATION");
  }

  try {
    const { data, error } = await supabase
      .from("materials")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error("🔴 [ADMIN POST MATERIAL] Ошибка БД:", error.message, error.details);
      return fail(error.message, 500, "DB_ERROR");
    }

    return ok({ material: data });
  } catch (error: any) {
    console.error("🔴 [ADMIN POST MATERIAL] Серверная ошибка:", error);
    return fail(error?.message || "Server error", 500, "SERVER_ERROR");
  }
}