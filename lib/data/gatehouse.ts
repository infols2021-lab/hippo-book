import "server-only";

import type { DataAuthContext } from "@/lib/data/auth";
import type { MaterialDbRow, MaterialWithProgress } from "@/lib/materials/types";

export type GatehouseAssignmentLink = {
  id: string;
  material_id: string | null;
};

export type GatehouseProgressRow = {
  assignment_id: string;
  is_completed: boolean | null;
  score?: number | null;
  completed_at?: string | null;
};

export type GatehouseAssignmentPreview = {
  id: string;
  title: string;
  order_index: number;
  questionsCount: number;
  isCompleted: boolean;
  score: number | null;
  completedAt: string | null;
};

export type GatehouseMaterialPageData = {
  material: MaterialDbRow;
  assignments: GatehouseAssignmentPreview[];
  hasAccess: boolean;
  progress: number;
  completedAssignments: number;
  totalAssignments: number;
};

export type GatehouseProfileData = {
  id: string;
  email: string;
  full_name: string;
  contact_phone: string;
  region: string;
};

export type GatehouseProfileStats = {
  totalMaterials: number;
  availableMaterials: number;
  completedAssignments: number;
};

export type GatehouseProfileRecentProgress = {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  materialTitle: string;
  score: number;
  completedAt: string | null;
  completedAtLabel: string;
};

export type GatehouseProfilePageData = {
  profile: GatehouseProfileData;
  stats: GatehouseProfileStats;
  recentProgress: GatehouseProfileRecentProgress[];
};

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeScore(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const score = Number(value);
  if (!Number.isFinite(score)) return null;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeScoreRequired(value: unknown): number {
  return normalizeScore(value) ?? 0;
}

function getQuestionsCount(content: any): number {
  return Array.isArray(content?.questions) ? content.questions.length : 0;
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";

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

export function normalizeGatehouseMaterial(row: any): MaterialDbRow {
  return {
    id: String(row?.id ?? ""),
    branch_type: "gatehouse",
    material_kind: String(row?.material_kind ?? "mock_test"),
    title: String(row?.title ?? "Пробный тест"),
    description: typeof row?.description === "string" ? row.description : null,
    cover_image_url: typeof row?.cover_image_url === "string" ? row.cover_image_url : null,
    is_active: typeof row?.is_active === "boolean" ? row.is_active : true,
    is_available: typeof row?.is_available === "boolean" ? row.is_available : false,
    order_index: typeof row?.order_index === "number" ? row.order_index : 0,
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

function buildGatehouseMaterialsWithProgress(params: {
  materials: MaterialDbRow[];
  assignments: GatehouseAssignmentLink[];
  userProgress: GatehouseProgressRow[];
  accessIds: Set<string>;
}): MaterialWithProgress[] {
  const completedSet = new Set(
    params.userProgress
      .filter((item) => item.is_completed)
      .map((item) => item.assignment_id)
      .filter(Boolean),
  );

  const assignmentsByMaterial = new Map<string, GatehouseAssignmentLink[]>();

  for (const assignment of params.assignments) {
    const materialId = assignment.material_id;
    if (!materialId) continue;

    const current = assignmentsByMaterial.get(materialId) ?? [];
    current.push(assignment);
    assignmentsByMaterial.set(materialId, current);
  }

  return params.materials.map((material) => {
    const materialAssignments = assignmentsByMaterial.get(material.id) ?? [];
    const totalAssignments = materialAssignments.length;

    let completedAssignments = 0;

    for (const assignment of materialAssignments) {
      if (completedSet.has(assignment.id)) {
        completedAssignments += 1;
      }
    }

    const progress =
      totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

    return {
      ...material,
      totalAssignments,
      completedAssignments,
      progress,
      hasAccess: Boolean(material.is_available || params.accessIds.has(material.id)),
    };
  });
}

export async function loadGatehouseMaterialsData(ctx: DataAuthContext): Promise<{
  materials: MaterialWithProgress[];
  error: string | null;
}> {
  const { supabase, user } = ctx;

  const [
    { data: materialRows, error: materialsError },
    { data: assignmentRows, error: assignmentsError },
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

    supabase.from("user_progress").select("assignment_id, is_completed").eq("user_id", user.id),

    supabase.from("material_access").select("material_id").eq("user_id", user.id),
  ]);

  const error =
    materialsError?.message ||
    assignmentsError?.message ||
    progressError?.message ||
    accessError?.message ||
    null;

  const materials = Array.isArray(materialRows) ? materialRows.map(normalizeGatehouseMaterial) : [];

  const assignments: GatehouseAssignmentLink[] = Array.isArray(assignmentRows)
    ? assignmentRows.map((row: any) => ({
        id: String(row?.id ?? ""),
        material_id: typeof row?.material_id === "string" ? row.material_id : null,
      }))
    : [];

  const userProgress: GatehouseProgressRow[] = Array.isArray(progressRows)
    ? progressRows.map((row: any) => ({
        assignment_id: String(row?.assignment_id ?? ""),
        is_completed: Boolean(row?.is_completed),
      }))
    : [];

  const accessIds = new Set(
    Array.isArray(accessRows)
      ? accessRows.map((row: any) => String(row?.material_id ?? "")).filter(Boolean)
      : [],
  );

  return {
    materials: buildGatehouseMaterialsWithProgress({
      materials,
      assignments,
      userProgress,
      accessIds,
    }),
    error,
  };
}

export async function loadGatehouseMaterialPageData(
  ctx: DataAuthContext,
  materialId: string,
): Promise<{
  data: GatehouseMaterialPageData | null;
  error: string | null;
}> {
  const id = String(materialId || "").trim();

  if (!id) {
    return {
      data: null,
      error: "Материал не найден",
    };
  }

  const { supabase, user } = ctx;

  const { data: materialRow, error: materialError } = await supabase
    .from("materials")
    .select("*")
    .eq("id", id)
    .eq("branch_type", "gatehouse")
    .eq("material_kind", "mock_test")
    .eq("is_active", true)
    .single();

  if (materialError || !materialRow) {
    return {
      data: null,
      error: materialError?.message || "Материал не найден",
    };
  }

  const material = normalizeGatehouseMaterial(materialRow);

  const [
    { data: accessRow, error: accessError },
    { data: assignmentRows, error: assignmentsError },
    { data: progressRows, error: progressError },
  ] = await Promise.all([
    supabase.from("material_access").select("id").eq("user_id", user.id).eq("material_id", id).maybeSingle(),

    supabase
      .from("assignments")
      .select("id, title, order_index, content, created_at")
      .eq("material_id", id)
      .eq("branch_type", "gatehouse")
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true }),

    supabase
      .from("user_progress")
      .select("assignment_id, is_completed, score, completed_at")
      .eq("user_id", user.id),
  ]);

  const error = accessError?.message || assignmentsError?.message || progressError?.message || null;

  const progressByAssignment = new Map<string, GatehouseProgressRow>();

  for (const row of Array.isArray(progressRows) ? progressRows : []) {
    const assignmentId = String((row as any)?.assignment_id ?? "");
    if (!assignmentId) continue;

    progressByAssignment.set(assignmentId, {
      assignment_id: assignmentId,
      is_completed: Boolean((row as any)?.is_completed),
      score: normalizeScore((row as any)?.score),
      completed_at: typeof (row as any)?.completed_at === "string" ? (row as any).completed_at : null,
    });
  }

  const hasAccess = Boolean(material.is_available || accessRow);

  const assignments: GatehouseAssignmentPreview[] = Array.isArray(assignmentRows)
    ? assignmentRows.map((assignment: any) => {
        const assignmentId = String(assignment?.id ?? "");
        const progress = progressByAssignment.get(assignmentId) ?? null;

        return {
          id: assignmentId,
          title: String(assignment?.title ?? "Задание"),
          order_index: Number(assignment?.order_index ?? 0),
          questionsCount: getQuestionsCount(assignment?.content),
          isCompleted: Boolean(progress?.is_completed),
          score: normalizeScore(progress?.score),
          completedAt: progress?.completed_at ?? null,
        };
      })
    : [];

  const completedAssignments = assignments.filter((assignment) => assignment.isCompleted).length;
  const totalAssignments = assignments.length;
  const progress = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

  return {
    data: {
      material,
      assignments,
      hasAccess,
      progress,
      completedAssignments,
      totalAssignments,
    },
    error,
  };
}

export async function loadGatehouseProfilePageData(ctx: DataAuthContext): Promise<GatehouseProfilePageData> {
  const { supabase, user, profile } = ctx;

  const [
    { count: totalMaterialsCount, error: totalMaterialsError },
    { count: availableMaterialsCount, error: availableMaterialsError },
    { count: completedAssignmentsCount, error: completedAssignmentsError },
    { data: recentRows, error: recentError },
  ] = await Promise.all([
    supabase
      .from("materials")
      .select("id", { count: "exact", head: true })
      .eq("branch_type", "gatehouse")
      .eq("material_kind", "mock_test")
      .eq("is_active", true),

    supabase
      .from("material_access")
      .select("id, materials!inner(branch_type, material_kind, is_active)", {
        count: "exact",
        head: true,
      })
      .eq("user_id", user.id)
      .eq("materials.branch_type", "gatehouse")
      .eq("materials.material_kind", "mock_test")
      .eq("materials.is_active", true),

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
    totalMaterialsError ||
    availableMaterialsError ||
    completedAssignmentsError ||
    recentError;

  if (error) {
    throw new Error(error.message);
  }

  const recentProgress: GatehouseProfileRecentProgress[] = Array.isArray(recentRows)
    ? recentRows.map((row: any) => {
        const assignment = row?.assignments;
        const material = assignment?.materials;

        return {
          id: String(row?.id ?? row?.assignment_id ?? ""),
          assignmentId: String(row?.assignment_id ?? assignment?.id ?? ""),
          assignmentTitle: String(assignment?.title ?? "Задание"),
          materialTitle: typeof material?.title === "string" ? material.title : "Gatehouse Awards",
          score: normalizeScoreRequired(row?.score),
          completedAt: typeof row?.completed_at === "string" ? row.completed_at : null,
          completedAtLabel: formatDate(row?.completed_at),
        };
      })
    : [];

  return {
    profile: {
      id: user.id,
      email: String(profile?.email || user.email || ""),
      full_name: typeof profile?.full_name === "string" ? profile.full_name : "",
      contact_phone: typeof profile?.contact_phone === "string" ? profile.contact_phone : "",
      region: typeof profile?.region === "string" ? profile.region : "",
    },
    stats: {
      totalMaterials: totalMaterialsCount ?? 0,
      availableMaterials: availableMaterialsCount ?? 0,
      completedAssignments: completedAssignmentsCount ?? 0,
    },
    recentProgress,
  };
}