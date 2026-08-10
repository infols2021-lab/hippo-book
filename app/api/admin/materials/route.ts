import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import { 
  normalizeMaterialInput, 
  normalizeMaterialKind 
} from "@/lib/materials/normalize";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;
  const { searchParams } = new URL(req.url);

  const branch_type = searchParams.get("branch_type");
  const material_kind = searchParams.get("material_kind");
  const is_demo = searchParams.get("is_demo");
  const includeCounts = searchParams.get("include_counts") !== "false";

  try {
    let query = supabase
      .from("materials")
      .select("*")
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: false });

    // Если запрошен демо-материал
    if (is_demo === "true") {
      query = query.eq("is_demo", true);
    } else if (branch_type) {
      query = query.eq("branch_type", String(branch_type).trim());
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

  const rawBranchType = String(body.branch_type || body.branch || body.project_slug || "general").trim();
  const isDemo = Boolean(body.is_demo);

  const payload = {
    ...normalizeMaterialInput(body, user.id),
    branch_type: rawBranchType,
    is_secret: typeof body.is_secret === "boolean" ? body.is_secret : Boolean(body.isSecret),
    is_demo: isDemo,
  };

  if (!payload.title) {
    return fail("title required", 400, "VALIDATION");
  }

  try {
    // Если новый материал помечается как единственное Демо - снимаем флаг со всех остальных
    if (isDemo) {
      await supabase.from("materials").update({ is_demo: false }).eq("is_demo", true);
    }

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