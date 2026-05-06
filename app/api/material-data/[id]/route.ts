import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";

type AssignmentRow = {
  id: string;
  title: string;
  branch_type: string | null;
  material_id: string | null;
  order_index: number | null;
  content: any;
  created_at: string | null;
};

type ProgressRow = {
  assignment_id: string;
  is_completed: boolean | null;
  score: number | null;
  completed_at: string | null;
  answers?: any;
};

function normalizeScore(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const score = Number(value);

  if (!Number.isFinite(score)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getQuestionsCount(content: any): number {
  return Array.isArray(content?.questions) ? content.questions.length : 0;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const materialId = String(id ?? "").trim();

  if (!materialId) {
    return fail("Missing material id", 400, "VALIDATION");
  }

  try {
    const { data: material, error: materialError } = await supabase
      .from("materials")
      .select("*")
      .eq("id", materialId)
      .single();

    if (materialError || !material) {
      return fail(materialError?.message || "Material not found", 404, "NOT_FOUND");
    }

    if (material.is_active === false) {
      return fail("Material is not active", 404, "NOT_FOUND");
    }

    const [
      { data: access, error: accessError },
      { data: assignments, error: assignmentsError },
      { data: progress, error: progressError },
    ] = await Promise.all([
      supabase
        .from("material_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("material_id", materialId)
        .maybeSingle(),

      supabase
        .from("assignments")
        .select("id, title, branch_type, material_id, order_index, content, created_at")
        .eq("material_id", materialId)
        .eq("branch_type", material.branch_type)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true }),

      supabase
        .from("user_progress")
        .select("assignment_id, is_completed, score, completed_at, answers")
        .eq("user_id", user.id),
    ]);

    if (accessError) return fail(accessError.message, 500, "DB_ERROR");
    if (assignmentsError) return fail(assignmentsError.message, 500, "DB_ERROR");
    if (progressError) return fail(progressError.message, 500, "DB_ERROR");

    const hasAccess = Boolean(material.is_available || access);

    const progressByAssignment = new Map<string, ProgressRow>();

    for (const row of Array.isArray(progress) ? (progress as ProgressRow[]) : []) {
      if (row?.assignment_id) {
        progressByAssignment.set(String(row.assignment_id), row);
      }
    }

    const assignmentRows = Array.isArray(assignments) ? (assignments as AssignmentRow[]) : [];

    const enrichedAssignments = hasAccess
      ? assignmentRows.map((assignment) => {
          const savedProgress = progressByAssignment.get(assignment.id) ?? null;

          return {
            id: assignment.id,
            title: assignment.title,
            branch_type: assignment.branch_type,
            material_id: assignment.material_id,
            order_index: assignment.order_index ?? 0,
            questions_count: getQuestionsCount(assignment.content),
            is_completed: Boolean(savedProgress?.is_completed),
            score: normalizeScore(savedProgress?.score),
            completed_at: savedProgress?.completed_at ?? null,
          };
        })
      : [];

    const totalAssignments = assignmentRows.length;

    const completedAssignments = assignmentRows.filter((assignment) => {
      const savedProgress = progressByAssignment.get(assignment.id) ?? null;
      return Boolean(savedProgress?.is_completed);
    }).length;

    const progressPercent =
      totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

    return ok({
      material,
      hasAccess,
      assignments: enrichedAssignments,
      stats: {
        totalAssignments,
        completedAssignments,
        progress: progressPercent,
      },
    });
  } catch (error: any) {
    return fail(error?.message || "Server error", 500, "SERVER_ERROR");
  }
}