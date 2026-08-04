// app/api/admin/materials/route.ts
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import { 
  normalizeMaterialInput, 
  normalizeBranchType, 
  normalizeMaterialKind 
} from "@/lib/materials/normalize";

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

  const payload = {
    ...normalizeMaterialInput(body, user.id),
    is_secret: typeof body.is_secret === "boolean" ? body.is_secret : Boolean(body.isSecret),
  };

  if (!payload.title) {
    return fail("title required", 400, "VALIDATION");
  }
  if (payload.branch_type === "olympiad" && payload.class_levels.length === 0) {
    return fail("class_levels required", 400, "VALIDATION");
  }
  if (payload.branch_type === "gatehouse" && payload.target_levels.length === 0) {
    return fail("target_levels required", 400, "VALIDATION");
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