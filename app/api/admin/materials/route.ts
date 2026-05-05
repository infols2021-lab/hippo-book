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

  return {
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

    const ids = materials.map((material: any) => material.id).filter(Boolean);

    const { data: assignments, error: countError } = await supabase
      .from("assignments")
      .select("id, material_id")
      .in("material_id", ids);

    if (countError) {
      return ok({ materials });
    }

    const counts: Record<string, number> = {};

    for (const assignment of assignments ?? []) {
      const materialId = String((assignment as any).material_id ?? "");
      if (!materialId) continue;
      counts[materialId] = (counts[materialId] || 0) + 1;
    }

    return ok({
      materials: materials.map((material: any) => ({
        ...material,
        assignments_count: counts[String(material.id)] || 0,
      })),
    });
  } catch (error: any) {
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
    return fail(validationError, 400, "VALIDATION");
  }

  try {
    const { data, error } = await supabase
      .from("materials")
      .insert(payload)
      .select("*")
      .single();

    if (error) return fail(error.message, 500, "DB_ERROR");

    return ok({ material: data });
  } catch (error: any) {
    return fail(error?.message || "Server error", 500, "SERVER_ERROR");
  }
}