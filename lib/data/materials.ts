// lib/data/materials.ts
// Универсальный слой запроса материалов по табу проекта (project_tab_id).
// Поддерживает как единую таблицу materials, так и легаси-таблицы textbooks/crosswords.
// Включает фильтрацию секретных материалов (is_secret).
// Демо-материалы (is_demo = true) — сквозные: подмешиваются в КАЖДЫЙ таб/проект
// независимо от того, в каком табе они физически созданы, и всегда доступны.

import "server-only";

import type {
  MaterialDbRow,
  MaterialWithProgress,
} from "@/lib/materials/types";
import type { DataAuthContext } from "@/lib/data/auth";
import type { BranchType } from "@/lib/branches/types";
import type {
  ProjectSlug,
  ProjectTabConfig,
  ProjectTabSlug,
} from "@/lib/projects/types";
import { getProjectBySlug } from "@/lib/projects/loader";

// ---------------------------------------------------------------------------
// Публичные типы
// ---------------------------------------------------------------------------

export type ProjectAssignmentLink = {
  id: string;
  material_id: string | null;
  title: string;
  order_index: number;
};

export type ProjectProgressRow = {
  assignment_id: string;
  is_completed: boolean;
  score: number | null;
  completed_at: string | null;
};

export type ProjectAssignmentPreview = {
  id: string;
  title: string;
  order_index: number;
  questionsCount: number;
  isCompleted: boolean;
  score: number | null;
  completedAt: string | null;
};

export type ProjectMaterialsData = {
  tab: ProjectTabConfig | null;
  materials: MaterialWithProgress[];
  error: string | null;
};

export type ProjectMaterialPageData = {
  material: MaterialDbRow;
  assignments: ProjectAssignmentPreview[];
  hasAccess: boolean;
  progress: number;
  completedAssignments: number;
  totalAssignments: number;
};

export type ExtendedMaterialDbRow = MaterialDbRow & {
  is_secret?: boolean;
};

// ---------------------------------------------------------------------------
// Утилиты нормализации
// ---------------------------------------------------------------------------

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeScore(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizePrice(value: unknown): number {
  const p = Number(value);
  return Number.isFinite(p) && p >= 0 ? p : 1000;
}

function getQuestionsCount(content: unknown): number {
  const data = content as { questions?: unknown } | null | undefined;
  return Array.isArray(data?.questions) ? data.questions.length : 0;
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

function normalizeProjectMaterial(row: any): ExtendedMaterialDbRow {
  const branchType = String(row?.branch_type ?? "olympiad") as BranchType;
  return {
    id: String(row?.id ?? ""),
    branch_type: branchType,
    material_kind: String(row?.material_kind ?? ""),
    title: String(row?.title ?? "Материал"),
    description: typeof row?.description === "string" ? row.description : null,
    cover_image_url: typeof row?.cover_image_url === "string" ? row.cover_image_url : null,
    is_active: typeof row?.is_active === "boolean" ? row.is_active : true,
    is_available: typeof row?.is_available === "boolean" ? row.is_available : false,
    is_demo: Boolean(row?.is_demo),
    is_secret: Boolean(row?.is_secret),
    order_index: typeof row?.order_index === "number" ? row.order_index : 0,
    price: normalizePrice(row?.price),
    class_levels: normalizeArray(row?.class_levels ?? row?.class_level),
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
    project_tab_id: row?.project_tab_id ?? null,
  };
}

function normalizeTextbookToMaterial(row: any): ExtendedMaterialDbRow {
  return {
    id: String(row?.id ?? ""),
    branch_type: (row?.branch_type as BranchType) || "olympiad",
    material_kind: "textbook",
    title: String(row?.title ?? "Учебник"),
    description: typeof row?.description === "string" ? row.description : null,
    cover_image_url: typeof row?.cover_image_url === "string" ? row.cover_image_url : null,
    is_active: typeof row?.is_active === "boolean" ? row.is_active : true,
    is_available: typeof row?.is_available === "boolean" ? row.is_available : false,
    // Легаси-таблица textbooks не имеет колонки is_demo — демо-режим для неё не поддерживается.
    is_demo: false,
    is_secret: Boolean(row?.is_secret),
    order_index: typeof row?.order_index === "number" ? row.order_index : 0,
    price: normalizePrice(row?.price),
    class_levels: normalizeArray(row?.class_level ?? row?.class_levels),
    target_levels: normalizeArray(row?.target_levels),
    legacy_source_table: "textbooks",
    legacy_source_id: String(row?.id ?? ""),
    created_by: typeof row?.created_by === "string" ? row.created_by : null,
    created_at: typeof row?.created_at === "string" ? row.created_at : new Date().toISOString(),
    updated_at: typeof row?.updated_at === "string" ? row.updated_at : new Date().toISOString(),
    meta: row?.meta && typeof row.meta === "object" ? row.meta : {},
    project_tab_id: row?.project_tab_id ?? null,
  };
}

function normalizeCrosswordToMaterial(row: any): ExtendedMaterialDbRow {
  return {
    id: String(row?.id ?? ""),
    branch_type: (row?.branch_type as BranchType) || "olympiad",
    material_kind: "crossword",
    title: String(row?.title ?? "Кроссворд"),
    description: typeof row?.description === "string" ? row.description : null,
    cover_image_url: typeof row?.cover_image_url === "string" ? row.cover_image_url : null,
    is_active: typeof row?.is_active === "boolean" ? row.is_active : true,
    is_available: typeof row?.is_available === "boolean" ? row.is_available : false,
    // Легаси-таблица crosswords не имеет колонки is_demo.
    is_demo: false,
    is_secret: Boolean(row?.is_secret),
    order_index: typeof row?.order_index === "number" ? row.order_index : 0,
    price: normalizePrice(row?.price),
    class_levels: normalizeArray(row?.class_level ?? row?.class_levels),
    target_levels: normalizeArray(row?.target_levels),
    legacy_source_table: "crosswords",
    legacy_source_id: String(row?.id ?? ""),
    created_by: typeof row?.created_by === "string" ? row.created_by : null,
    created_at: typeof row?.created_at === "string" ? row.created_at : new Date().toISOString(),
    updated_at: typeof row?.updated_at === "string" ? row.updated_at : new Date().toISOString(),
    meta: row?.meta && typeof row.meta === "object" ? row.meta : {},
    project_tab_id: row?.project_tab_id ?? null,
  };
}

function buildMaterialsWithProgress(params: {
  materials: ExtendedMaterialDbRow[];
  assignments: ProjectAssignmentLink[];
  userProgress: ProjectProgressRow[];
  accessIds: Set<string>;
}): MaterialWithProgress[] {
  const completedSet = new Set(
    params.userProgress
      .filter((item) => item.is_completed)
      .map((item) => item.assignment_id)
      .filter(Boolean),
  );

  const assignmentsByMaterial = new Map<string, ProjectAssignmentLink[]>();
  for (const assignment of params.assignments) {
    const materialId = assignment.material_id;
    if (!materialId) continue;
    const current = assignmentsByMaterial.get(materialId) ?? [];
    current.push(assignment);
    assignmentsByMaterial.set(materialId, current);
  }

  const result: MaterialWithProgress[] = [];

  for (const material of params.materials) {
    // Демо-материал всегда доступен, наравне с is_available и выданным material_access.
    const hasAccess = Boolean(
      material.is_available || material.is_demo || params.accessIds.has(material.id),
    );

    // КЛЮЧЕВАЯ ЛОГИКА СЕКРЕТНЫХ МАТЕРИАЛОВ:
    // Если материал секретный и у ученика НЕТ доступа к нему, скрываем его полностью
    if (material.is_secret && !hasAccess) {
      continue;
    }

    const materialAssignments = assignmentsByMaterial.get(material.id) ?? [];
    const totalAssignments = materialAssignments.length;

    let completedAssignments = 0;
    for (const assignment of materialAssignments) {
      if (completedSet.has(assignment.id)) completedAssignments += 1;
    }

    const progress =
      totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

    result.push({
      ...material,
      totalAssignments,
      completedAssignments,
      progress,
      hasAccess,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Запросы
// ---------------------------------------------------------------------------

export async function loadProjectMaterialsData(
  ctx: DataAuthContext,
  projectSlug: ProjectSlug,
  tabSlug: ProjectTabSlug,
): Promise<ProjectMaterialsData> {
  const { supabase, user } = ctx;

  const project = await getProjectBySlug(projectSlug);
  if (!project) {
    return { tab: null, materials: [], error: `Проект «${projectSlug}» не найден.` };
  }

  const tab = project.tabs.find((t) => t.slug === tabSlug) ?? null;
  if (!tab) {
    return { tab: null, materials: [], error: `Таб «${tabSlug}» не найден в проекте «${projectSlug}».` };
  }

  const materialsQuery = supabase
    .from("materials")
    .select("*")
    .eq("is_active", true)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (tab.id) {
    materialsQuery.eq("project_tab_id", tab.id);
  } else if (tab.materialKind) {
    materialsQuery
      .eq("branch_type", projectSlug)
      .eq("material_kind", tab.materialKind);
  }

  // Демо-материалы — сквозные. Тянем их ОТДЕЛЬНЫМ запросом, без привязки к table/branch/tab,
  // чтобы они попадали в любой таб любого проекта, независимо от того, где физически созданы.
  const demoMaterialsQuery = supabase
    .from("materials")
    .select("*")
    .eq("is_active", true)
    .eq("is_demo", true);

  // Легаси-запросы запрашиваем ТОЛЬКО если у таба нет собственного project_tab_id
  const isOlympiad = projectSlug === "olympiad" || !projectSlug;
  const shouldFetchTextbooks = !tab.id && isOlympiad && (!tab.materialKind || tab.materialKind === "textbook");
  const shouldFetchCrosswords = !tab.id && isOlympiad && (!tab.materialKind || tab.materialKind === "crossword");

  const [
    { data: materialRows, error: materialsError },
    { data: demoMaterialRows, error: demoMaterialsError },
    { data: textbookRows, error: textbooksError },
    { data: crosswordRows, error: crosswordsError },
    { data: progressRows, error: progressError },
    { data: accessRows, error: accessError },
    { data: tbAccessRows, error: tbAccessError },
    { data: cwAccessRows, error: cwAccessError },
  ] = await Promise.all([
    materialsQuery,
    demoMaterialsQuery,
    shouldFetchTextbooks
      ? supabase.from("textbooks").select("*").eq("is_active", true).order("order_index", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    shouldFetchCrosswords
      ? supabase.from("crosswords").select("*").eq("is_active", true).order("order_index", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("user_progress")
      .select("assignment_id, is_completed, score, completed_at")
      .eq("user_id", user.id),
    supabase.from("material_access").select("material_id").eq("user_id", user.id),
    shouldFetchTextbooks
      ? supabase.from("textbook_access").select("textbook_id").eq("user_id", user.id)
      : Promise.resolve({ data: [], error: null }),
    shouldFetchCrosswords
      ? supabase.from("crossword_access").select("crossword_id").eq("user_id", user.id)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const materialsMap = new Map<string, ExtendedMaterialDbRow>();

  if (Array.isArray(materialRows)) {
    for (const r of materialRows) {
      const item = normalizeProjectMaterial(r);
      materialsMap.set(item.id, item);
    }
  }

  // Подмешиваем демо-материалы во ВСЕ табы/проекты (если ещё не попали через обычный запрос выше).
  if (Array.isArray(demoMaterialRows)) {
    for (const r of demoMaterialRows) {
      const item = normalizeProjectMaterial(r);
      if (!materialsMap.has(item.id)) {
        materialsMap.set(item.id, item);
      }
    }
  }

  if (Array.isArray(textbookRows)) {
    for (const r of textbookRows) {
      if (r?.project_tab_id && tab.id && r.project_tab_id !== tab.id) continue;
      const item = normalizeTextbookToMaterial(r);
      if (!materialsMap.has(item.id)) {
        materialsMap.set(item.id, item);
      }
    }
  }

  if (Array.isArray(crosswordRows)) {
    for (const r of crosswordRows) {
      if (r?.project_tab_id && tab.id && r.project_tab_id !== tab.id) continue;
      const item = normalizeCrosswordToMaterial(r);
      if (!materialsMap.has(item.id)) {
        materialsMap.set(item.id, item);
      }
    }
  }

  const materials = Array.from(materialsMap.values());
  const materialIds = materials.map((m) => m.id);

  let assignmentRows: any[] = [];
  let assignmentsError: any = null;

  if (materialIds.length > 0) {
    const { data, error } = await supabase
      .from("assignments")
      .select("id, material_id, textbook_id, crossword_id, title, order_index")
      .or(
        `material_id.in.(${materialIds.join(",")}),textbook_id.in.(${materialIds.join(",")}),crossword_id.in.(${materialIds.join(",")})`
      )
      .order("order_index", { ascending: true, nullsFirst: false });

    assignmentRows = data || [];
    assignmentsError = error;
  }

  const error =
    materialsError?.message ||
    demoMaterialsError?.message ||
    textbooksError?.message ||
    crosswordsError?.message ||
    assignmentsError?.message ||
    progressError?.message ||
    accessError?.message ||
    tbAccessError?.message ||
    cwAccessError?.message ||
    null;

  const assignments: ProjectAssignmentLink[] = Array.isArray(assignmentRows)
    ? assignmentRows.map((row: any) => ({
        id: String(row?.id ?? ""),
        material_id:
          typeof row?.material_id === "string" && row.material_id
            ? row.material_id
            : typeof row?.textbook_id === "string" && row.textbook_id
            ? row.textbook_id
            : typeof row?.crossword_id === "string" && row.crossword_id
            ? row.crossword_id
            : null,
        title: String(row?.title ?? "Задание"),
        order_index: Number(row?.order_index ?? 0),
      }))
    : [];

  const userProgress: ProjectProgressRow[] = Array.isArray(progressRows)
    ? progressRows.map((row: any) => ({
        assignment_id: String(row?.assignment_id ?? ""),
        is_completed: Boolean(row?.is_completed),
        score: normalizeScore(row?.score),
        completed_at:
          typeof row?.completed_at === "string" ? row.completed_at : null,
      }))
    : [];

  const accessIds = new Set<string>();
  if (Array.isArray(accessRows)) {
    for (const r of accessRows) {
      if (r?.material_id) accessIds.add(String(r.material_id));
    }
  }
  if (Array.isArray(tbAccessRows)) {
    for (const r of tbAccessRows) {
      if (r?.textbook_id) accessIds.add(String(r.textbook_id));
    }
  }
  if (Array.isArray(cwAccessRows)) {
    for (const r of cwAccessRows) {
      if (r?.crossword_id) accessIds.add(String(r.crossword_id));
    }
  }

  return {
    tab,
    materials: buildMaterialsWithProgress({
      materials,
      assignments,
      userProgress,
      accessIds,
    }),
    error,
  };
}

export async function loadProjectMaterialPageData(
  ctx: DataAuthContext,
  projectSlug: ProjectSlug,
  tabSlug: ProjectTabSlug,
  materialId: string,
): Promise<{ data: ProjectMaterialPageData | null; error: string | null }> {
  const id = String(materialId || "").trim();
  if (!id) return { data: null, error: "Материал не найден" };

  const { supabase, user } = ctx;

  const project = await getProjectBySlug(projectSlug);
  if (!project) return { data: null, error: `Проект «${projectSlug}» не найден.` };

  const tab = project.tabs.find((t) => t.slug === tabSlug) ?? null;
  if (!tab) return { data: null, error: `Таб «${tabSlug}» не найден.` };

  let materialRow: any = null;
  let materialSource: "materials" | "textbooks" | "crosswords" = "materials";

  const materialQuery = supabase.from("materials").select("*").eq("id", id).eq("is_active", true);
  if (tab.id) {
    materialQuery.eq("project_tab_id", tab.id);
  } else if (tab.materialKind) {
    materialQuery.eq("branch_type", projectSlug).eq("material_kind", tab.materialKind);
  }

  const { data: mData } = await materialQuery.maybeSingle();
  if (mData) {
    materialRow = mData;
  } else {
    // Материал не нашёлся в этом табе напрямую — проверяем, не демо-материал ли это
    // (он мог быть создан в другом табе, но должен открываться отовсюду).
    const { data: demoData } = await supabase
      .from("materials")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .eq("is_demo", true)
      .maybeSingle();

    if (demoData) {
      materialRow = demoData;
    } else if (!tab.id && (projectSlug === "olympiad" || !projectSlug)) {
      const { data: tbData } = await supabase.from("textbooks").select("*").eq("id", id).eq("is_active", true).maybeSingle();
      if (tbData) {
        materialRow = tbData;
        materialSource = "textbooks";
      } else {
        const { data: cwData } = await supabase.from("crosswords").select("*").eq("id", id).eq("is_active", true).maybeSingle();
        if (cwData) {
          materialRow = cwData;
          materialSource = "crosswords";
        }
      }
    }
  }

  if (!materialRow) {
    return { data: null, error: "Материал не найден" };
  }

  const material =
    materialSource === "textbooks"
      ? normalizeTextbookToMaterial(materialRow)
      : materialSource === "crosswords"
      ? normalizeCrosswordToMaterial(materialRow)
      : normalizeProjectMaterial(materialRow);

  const [
    { data: accessRow },
    { data: tbAccessRow },
    { data: cwAccessRow },
    { data: assignmentRows, error: assignmentsError },
    { data: progressRows, error: progressError },
  ] = await Promise.all([
    supabase.from("material_access").select("id").eq("user_id", user.id).eq("material_id", id).maybeSingle(),
    supabase.from("textbook_access").select("id").eq("user_id", user.id).eq("textbook_id", id).maybeSingle(),
    supabase.from("crossword_access").select("id").eq("user_id", user.id).eq("crossword_id", id).maybeSingle(),
    supabase
      .from("assignments")
      .select("id, title, order_index, content, created_at")
      .or(`material_id.eq.${id},textbook_id.eq.${id},crossword_id.eq.${id}`)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("user_progress")
      .select("assignment_id, is_completed, score, completed_at")
      .eq("user_id", user.id),
  ]);

  const hasAccess = Boolean(
    material.is_available || material.is_demo || accessRow || tbAccessRow || cwAccessRow,
  );

  // Если материал секретный и у пользователя НЕТ доступа — отклоняем запрос
  if (material.is_secret && !hasAccess) {
    return { data: null, error: "Материал не найден" };
  }

  const error = assignmentsError?.message || progressError?.message || null;

  const progressByAssignment = new Map<string, ProjectProgressRow>();
  for (const row of Array.isArray(progressRows) ? progressRows : []) {
    const assignmentId = String((row as any)?.assignment_id ?? "");
    if (!assignmentId) continue;
    progressByAssignment.set(assignmentId, {
      assignment_id: assignmentId,
      is_completed: Boolean((row as any)?.is_completed),
      score: normalizeScore((row as any)?.score),
      completed_at:
        typeof (row as any)?.completed_at === "string" ? (row as any).completed_at : null,
    });
  }

  const assignments: ProjectAssignmentPreview[] = Array.isArray(assignmentRows)
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

  const completedAssignments = assignments.filter((a) => a.isCompleted).length;
  const totalAssignments = assignments.length;
  const progress = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

  return {
    data: { material, assignments, hasAccess, progress, completedAssignments, totalAssignments },
    error,
  };
}

export function formatMaterialDate(value: unknown): string {
  return formatDate(value);
}