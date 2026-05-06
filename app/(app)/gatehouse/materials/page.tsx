import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MaterialDbRow, MaterialWithProgress } from "@/lib/materials/types";
import GatehouseMaterialsClient from "./GatehouseMaterialsClient";

type AssignmentRow = {
  id: string;
  material_id: string | null;
};

type UserProgressRow = {
  assignment_id: string;
  is_completed: boolean | null;
};

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeMaterial(row: any): MaterialDbRow {
  return {
    id: String(row?.id ?? ""),
    branch_type: "gatehouse",
    material_kind: String(row?.material_kind ?? "mock_test"),
    title: String(row?.title ?? "Пробный тест"),
    description: typeof row?.description === "string" ? row.description : null,
    cover_image_url: typeof row?.cover_image_url === "string" ? row.cover_image_url : null,
    is_active: Boolean(row?.is_active ?? true),
    is_available: Boolean(row?.is_available ?? false),
    order_index: Number(row?.order_index ?? 0),
    class_levels: normalizeArray(row?.class_levels),
    target_levels: normalizeArray(row?.target_levels),
    legacy_source_table:
      row?.legacy_source_table === "textbooks" || row?.legacy_source_table === "crosswords"
        ? row.legacy_source_table
        : null,
    legacy_source_id: typeof row?.legacy_source_id === "string" ? row.legacy_source_id : null,
    created_by: typeof row?.created_by === "string" ? row.created_by : null,
    created_at: typeof row?.created_at === "string" ? row.created_at : new Date().toISOString(),
    updated_at: typeof row?.updated_at === "string" ? row.updated_at : new Date().toISOString(),
    meta: row?.meta && typeof row.meta === "object" ? row.meta : {},
  };
}

function buildMaterialsWithProgress({
  materials,
  assignments,
  userProgress,
  accessIds,
}: {
  materials: MaterialDbRow[];
  assignments: AssignmentRow[];
  userProgress: UserProgressRow[];
  accessIds: Set<string>;
}): MaterialWithProgress[] {
  const completedSet = new Set(
    userProgress
      .filter((item) => item.is_completed)
      .map((item) => item.assignment_id)
      .filter(Boolean),
  );

  return materials.map((material) => {
    const materialAssignments = assignments.filter((assignment) => assignment.material_id === material.id);

    const totalAssignments = materialAssignments.length;

    const completedAssignments = materialAssignments.filter((assignment) =>
      completedSet.has(assignment.id),
    ).length;

    const progress = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

    return {
      ...material,
      totalAssignments,
      completedAssignments,
      progress,
      hasAccess: Boolean(material.is_available || accessIds.has(material.id)),
    };
  });
}

export default async function GatehouseMaterialsPage() {
  const supabase = await createSupabaseServerClient();

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    redirect("/login");
  }

  const [
    { data: materialsRows, error: materialsError },
    { data: assignmentsRows, error: assignmentsError },
    { data: progressRows, error: progressError },
    { data: accessRows, error: accessError },
  ] = await Promise.all([
    supabase
      .from("materials")
      .select("*")
      .eq("branch_type", "gatehouse")
      .eq("material_kind", "mock_test")
      .eq("is_active", true)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true }),

    supabase
      .from("assignments")
      .select("id, material_id")
      .eq("branch_type", "gatehouse")
      .order("order_index", { ascending: true }),

    supabase
      .from("user_progress")
      .select("assignment_id, is_completed")
      .eq("user_id", user.id),

    supabase
      .from("material_access")
      .select("material_id")
      .eq("user_id", user.id),
  ]);

  const error =
    materialsError?.message ||
    assignmentsError?.message ||
    progressError?.message ||
    accessError?.message ||
    null;

  const materials = Array.isArray(materialsRows) ? materialsRows.map(normalizeMaterial) : [];
  const assignments = Array.isArray(assignmentsRows) ? (assignmentsRows as AssignmentRow[]) : [];
  const userProgress = Array.isArray(progressRows) ? (progressRows as UserProgressRow[]) : [];

  const accessIds = new Set(
    Array.isArray(accessRows)
      ? accessRows.map((item: any) => String(item?.material_id ?? "")).filter(Boolean)
      : [],
  );

  const materialsWithProgress = buildMaterialsWithProgress({
    materials,
    assignments,
    userProgress,
    accessIds,
  });

  return <GatehouseMaterialsClient initialMaterials={materialsWithProgress} initialError={error} />;
}