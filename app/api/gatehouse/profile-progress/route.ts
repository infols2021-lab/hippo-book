import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";

function normalizeScore(value: unknown): number {
  const score = Number(value ?? 0);

  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function GET(_req: NextRequest) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;

  try {
    const [
      { data: materialsRows, error: materialsError },
      { data: accessRows, error: accessError },
      { count: completedAssignmentsCount, error: completedAssignmentsError },
      { data: recentRows, error: recentError },
    ] = await Promise.all([
      supabase
        .from("materials")
        .select("id, is_available")
        .eq("branch_type", "gatehouse")
        .eq("material_kind", "mock_test")
        .eq("is_active", true),

      supabase
        .from("material_access")
        .select("material_id")
        .eq("user_id", user.id),

      supabase
        .from("user_progress")
        .select("id, assignments!inner(branch_type)", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_completed", true)
        .eq("assignments.branch_type", "gatehouse"),

      supabase
        .from("user_progress")
        .select(
          `
          id,
          assignment_id,
          completed_at,
          score,
          assignments!inner(
            id,
            title,
            branch_type,
            material_id,
            materials(
              id,
              title,
              target_levels,
              material_kind
            )
          )
        `,
        )
        .eq("user_id", user.id)
        .eq("is_completed", true)
        .eq("assignments.branch_type", "gatehouse")
        .order("completed_at", { ascending: false })
        .limit(5),
    ]);

    const error =
      materialsError?.message ||
      accessError?.message ||
      completedAssignmentsError?.message ||
      recentError?.message ||
      null;

    if (error) {
      return fail(error, 500, "DB_ERROR");
    }

    const materialAccessSet = new Set(
      Array.isArray(accessRows)
        ? accessRows.map((item: any) => String(item?.material_id ?? "")).filter(Boolean)
        : [],
    );

    const totalMaterials = Array.isArray(materialsRows) ? materialsRows.length : 0;

    const availableMaterials = Array.isArray(materialsRows)
      ? materialsRows.filter((material: any) => {
          const id = String(material?.id ?? "");
          return Boolean(material?.is_available) || materialAccessSet.has(id);
        }).length
      : 0;

    const recentProgress = Array.isArray(recentRows)
      ? recentRows.map((row: any) => {
          const assignment = firstOrNull(row?.assignments);
          const material = firstOrNull(assignment?.materials);

          return {
            id: String(row?.id ?? row?.assignment_id ?? ""),
            assignmentId: String(row?.assignment_id ?? assignment?.id ?? ""),
            assignmentTitle: String(assignment?.title ?? "Задание"),
            materialTitle: typeof material?.title === "string" ? material.title : "Gatehouse Awards",
            score: normalizeScore(row?.score),
            completedAt: typeof row?.completed_at === "string" ? row.completed_at : null,
            completedAtLabel: formatDate(row?.completed_at),
          };
        })
      : [];

    return ok({
      stats: {
        totalMaterials,
        availableMaterials,
        completedAssignments: completedAssignmentsCount ?? 0,
      },
      recentProgress,
    });
  } catch (error: any) {
    return fail(error?.message || "Server error", 500, "SERVER_ERROR");
  }
}