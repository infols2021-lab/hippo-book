import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import type { NextRequest } from "next/server";

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function isGatehouseAssignment(assignment: any) {
  const material = firstOrNull(assignment?.materials);
  return assignment?.branch_type === "gatehouse" || material?.branch_type === "gatehouse";
}

function getMaterialId(assignment: any): string | null {
  const material = firstOrNull(assignment?.materials);
  const direct = typeof assignment?.material_id === "string" ? assignment.material_id : null;
  const fromMaterial = typeof material?.id === "string" ? material.id : null;
  return direct || fromMaterial || null;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;
  const { id } = await ctx.params;

  try {
    const { data: assignment, error: aErr } = await supabase
      .from("assignments")
      .select(
        `*,
        materials(
          id,
          title,
          branch_type,
          material_kind,
          is_active,
          is_available,
          target_levels,
          class_levels
        )
      `)
      .eq("id", id)
      .single();

    if (aErr || !assignment) return fail(aErr?.message || "Assignment not found", 404, "NOT_FOUND");

    const material = firstOrNull((assignment as any).materials);
    const gatehouse = isGatehouseAssignment(assignment);

    if (gatehouse) {
      const materialId = getMaterialId(assignment);

      if (!materialId) {
        return fail("Gatehouse assignment has no material", 404, "NOT_FOUND");
      }

      if (material?.is_active === false) {
        return fail("Material is not active", 404, "NOT_FOUND");
      }

      const { data: access, error: accessErr } = await supabase
        .from("material_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("material_id", materialId)
        .maybeSingle();

      if (accessErr) {
        return fail(accessErr.message, 500, "DB_ERROR");
      }

      const hasAccess = Boolean(material?.is_available || access);

      if (!hasAccess) {
        return fail("No access to this Gatehouse material", 403, "FORBIDDEN");
      }
    }

    const { data: progress, error: pErr } = await supabase
      .from("user_progress")
      .select("is_completed, score, completed_at, answers")
      .eq("user_id", user.id)
      .eq("assignment_id", id)
      .maybeSingle();

    if (pErr) return fail(pErr.message, 500, "DB_ERROR");

    return ok({
      assignment,
      progress: progress
        ? {
            is_completed: Boolean(progress.is_completed),
            score: progress.score ?? null,
            completed_at: progress.completed_at ?? null,
            answers: progress.answers ?? {},
          }
        : null,
    });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}