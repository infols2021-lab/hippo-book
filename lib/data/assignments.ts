// lib/data/assignments.ts
import "server-only";

import type { DataAuthContext } from "@/lib/data/auth";

export type AssignmentProgressData = {
  is_completed: boolean;
  score: number | null;
  completed_at: string | null;
  answers: any;
};

export type AssignmentDataResult = {
  assignment: any;
  progress: AssignmentProgressData | null;
};

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeScore(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const score = Number(value);
  if (!Number.isFinite(score)) return null;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeProgress(row: any): AssignmentProgressData | null {
  if (!row) return null;

  return {
    is_completed: Boolean(row?.is_completed),
    score: normalizeScore(row?.score),
    completed_at: typeof row?.completed_at === "string" ? row.completed_at : null,
    answers: row?.answers ?? {},
  };
}

function isGatehouseAssignment(assignment: any) {
  const material = firstOrNull(assignment?.materials);

  return assignment?.branch_type === "gatehouse" || material?.branch_type === "gatehouse";
}

function getGatehouseMaterialId(assignment: any): string | null {
  const material = firstOrNull(assignment?.materials);

  if (typeof assignment?.material_id === "string" && assignment.material_id) {
    return assignment.material_id;
  }

  if (typeof material?.id === "string" && material.id) {
    return material.id;
  }

  return null;
}

async function assertGatehouseAssignmentAccess(ctx: DataAuthContext, assignment: any) {
  const { supabase, user } = ctx;
  const material = firstOrNull(assignment?.materials);
  const materialId = getGatehouseMaterialId(assignment);

  if (!materialId) {
    const error = new Error("Gatehouse assignment has no material") as Error & {
      status?: number;
      code?: string;
    };

    error.status = 404;
    error.code = "NOT_FOUND";
    throw error;
  }

  if (material?.is_active === false) {
    const error = new Error("Material is not active") as Error & {
      status?: number;
      code?: string;
    };

    error.status = 404;
    error.code = "NOT_FOUND";
    throw error;
  }

  const { data: accessRow, error: accessError } = await supabase
    .from("material_access")
    .select("id")
    .eq("user_id", user.id)
    .eq("material_id", materialId)
    .maybeSingle();

  if (accessError) {
    throw new Error(accessError.message);
  }

  const hasAccess = Boolean(material?.is_available || accessRow);

  if (!hasAccess) {
    const error = new Error("No access to this Gatehouse material") as Error & {
      status?: number;
      code?: string;
    };

    error.status = 403;
    error.code = "FORBIDDEN";
    throw error;
  }
}

async function assertOlympiadAssignmentAccess(ctx: DataAuthContext, assignment: any) {
  const { supabase, user } = ctx;

  const material = firstOrNull(assignment?.materials);
  const materialId =
    typeof assignment?.material_id === "string" && assignment.material_id
      ? assignment.material_id
      : typeof material?.id === "string"
        ? material.id
        : null;

  // Доступ только через родительский material_id в таблице material_access.
  if (materialId) {
    const [
      { data: material, error: materialError },
      { data: access, error: accessError },
    ] = await Promise.all([
      supabase
        .from("materials")
        .select("id, is_available, is_active")
        .eq("id", materialId)
        .maybeSingle(),

      supabase
        .from("material_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("material_id", materialId)
        .maybeSingle(),
    ]);

    if (materialError) throw new Error(materialError.message);
    if (accessError) throw new Error(accessError.message);

    if (!material || material.is_active === false) {
      const error = new Error("Material not found") as Error & { status?: number; code?: string; };
      error.status = 404;
      error.code = "NOT_FOUND";
      throw error;
    }

    if (!material.is_available && !access) {
      const error = new Error("No access to this material") as Error & { status?: number; code?: string; };
      error.status = 403;
      error.code = "FORBIDDEN";
      throw error;
    }

    return;
  }

  // Если у задания нет material_id — доступ невозможен
  const error = new Error("Assignment has no material_id") as Error & { status?: number; code?: string; };
  error.status = 400;
  error.code = "BAD_REQUEST";
  throw error;
}

export async function loadAssignmentData(
  ctx: DataAuthContext,
  assignmentId: string,
): Promise<AssignmentDataResult | null> {
  const id = String(assignmentId || "").trim();
  if (!id) return null;

  const { supabase, user } = ctx;

  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .select(
      `
      *,
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
    `,
    )
    .eq("id", id)
    .single();

  if (assignmentError || !assignment) {
    const error = new Error(assignmentError?.message || "Assignment not found") as Error & {
      status?: number;
      code?: string;
    };

    error.status = 404;
    error.code = "NOT_FOUND";
    throw error;
  }

  // --- ПРОВЕРКА НА ПУСТОЕ ЗАДАНИЕ С УЧЕТОМ ТИПА (TEST / INTRO) ---
  const content = assignment.content || {};
  const assignmentType = assignment.assignment_type || 'test';
  const isIntro = assignmentType === 'intro' || content.mode === 'informational';
  
  const questions = Array.isArray(content.questions) ? content.questions : [];
  const blocks = Array.isArray(content.blocks) ? content.blocks : [];

  if (!isIntro && questions.length === 0) {
    const error = new Error("Задание еще не готово (нет вопросов)") as Error & {
      status?: number;
      code?: string;
    };
    error.status = 403;
    error.code = "NOT_READY";
    throw error;
  }

  if (isIntro && blocks.length === 0 && questions.length === 0) {
    const error = new Error("Ознакомительный материал еще не заполнен") as Error & {
      status?: number;
      code?: string;
    };
    error.status = 403;
    error.code = "NOT_READY";
    throw error;
  }
  // -----------------------------------------------------------------

  if (isGatehouseAssignment(assignment)) {
    await assertGatehouseAssignmentAccess(ctx, assignment);
  } else {
    await assertOlympiadAssignmentAccess(ctx, assignment);
  }

  const { data: progressRow, error: progressError } = await supabase
    .from("user_progress")
    .select("is_completed, score, completed_at, answers")
    .eq("user_id", user.id)
    .eq("assignment_id", id)
    .maybeSingle();

  if (progressError) {
    throw new Error(progressError.message);
  }

  return {
    assignment,
    progress: normalizeProgress(progressRow),
  };
}

export async function loadGatehouseAssignmentShellData(ctx: DataAuthContext, assignmentId: string) {
  const result = await loadAssignmentData(ctx, assignmentId);

  if (!result) {
    return null;
  }

  const material = firstOrNull(result.assignment?.materials);
  const materialId = getGatehouseMaterialId(result.assignment);

  return {
    assignment: result.assignment,
    progress: result.progress,
    material,
    materialId,
    isGatehouse: isGatehouseAssignment(result.assignment),
  };
}