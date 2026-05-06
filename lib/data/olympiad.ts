import "server-only";

import type { DataAuthContext } from "@/lib/data/auth";

export type OlympiadLegacyMaterialKind = "textbook" | "crossword";

export type OlympiadAssignmentLink = {
  id: string;
  textbook_id: string | null;
  crossword_id: string | null;
  branch_type?: string | null;
};

export type OlympiadProgressRow = {
  assignment_id: string;
  is_completed: boolean | null;
  score?: number | null;
  completed_at?: string | null;
};

export type OlympiadTextbookRow = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_active: boolean | null;
  is_available: boolean | null;
  order_index: number | null;
  created_at: string | null;
  created_by: string | null;
  class_level: string[] | null;
  branch_type?: string | null;
  target_levels?: string[] | null;
};

export type OlympiadCrosswordRow = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_active: boolean | null;
  is_available: boolean | null;
  order_index: number | null;
  created_at: string | null;
  created_by: string | null;
  class_level: string[] | null;
  branch_type?: string | null;
  target_levels?: string[] | null;
};

export type OlympiadMaterialsData = {
  textbooks: OlympiadTextbookRow[];
  crosswords: OlympiadCrosswordRow[];
  assignments: OlympiadAssignmentLink[];
  userProgress: OlympiadProgressRow[];
  textbookAccess: { textbook_id: string }[];
  crosswordAccess: { crossword_id: string }[];
};

export type OlympiadMaterialProgressItem = {
  kind: OlympiadLegacyMaterialKind;
  id: string;
  title: string;
  total: number;
  completed: number;
  progressPercent: number;
  href: string;
};

export type OlympiadProfileProgressData = {
  branch_type: "olympiad";
  stats: {
    totalMaterials: number;
    completedMaterials: number;
    successRate: number;
    totalAvailableAssignments: number;
    completedAvailableAssignments: number;
  };
  materialsProgress: OlympiadMaterialProgressItem[];
};

export type OlympiadSourcePageData = {
  locked: boolean;
  branch_type: "olympiad";
  textbook?: OlympiadTextbookRow;
  crossword?: OlympiadCrosswordRow;
  assignments: any[];
  userProgress: OlympiadProgressRow[];
};

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeTextbook(row: any): OlympiadTextbookRow {
  return {
    id: String(row?.id ?? ""),
    title: String(row?.title ?? ""),
    description: typeof row?.description === "string" ? row.description : null,
    cover_image_url: typeof row?.cover_image_url === "string" ? row.cover_image_url : null,
    is_active: typeof row?.is_active === "boolean" ? row.is_active : true,
    is_available: typeof row?.is_available === "boolean" ? row.is_available : false,
    order_index: typeof row?.order_index === "number" ? row.order_index : 0,
    created_at: typeof row?.created_at === "string" ? row.created_at : null,
    created_by: typeof row?.created_by === "string" ? row.created_by : null,
    class_level: toStringArray(row?.class_level),
    branch_type: typeof row?.branch_type === "string" ? row.branch_type : "olympiad",
    target_levels: toStringArray(row?.target_levels),
  };
}

function normalizeCrossword(row: any): OlympiadCrosswordRow {
  return {
    id: String(row?.id ?? ""),
    title: String(row?.title ?? ""),
    description: typeof row?.description === "string" ? row.description : null,
    cover_image_url: typeof row?.cover_image_url === "string" ? row.cover_image_url : null,
    is_active: typeof row?.is_active === "boolean" ? row.is_active : true,
    is_available: typeof row?.is_available === "boolean" ? row.is_available : false,
    order_index: typeof row?.order_index === "number" ? row.order_index : 0,
    created_at: typeof row?.created_at === "string" ? row.created_at : null,
    created_by: typeof row?.created_by === "string" ? row.created_by : null,
    class_level: toStringArray(row?.class_level),
    branch_type: typeof row?.branch_type === "string" ? row.branch_type : "olympiad",
    target_levels: toStringArray(row?.target_levels),
  };
}

function normalizeAssignmentLink(row: any): OlympiadAssignmentLink {
  return {
    id: String(row?.id ?? ""),
    textbook_id: typeof row?.textbook_id === "string" ? row.textbook_id : null,
    crossword_id: typeof row?.crossword_id === "string" ? row.crossword_id : null,
    branch_type: typeof row?.branch_type === "string" ? row.branch_type : "olympiad",
  };
}

function normalizeProgressRow(row: any): OlympiadProgressRow {
  return {
    assignment_id: String(row?.assignment_id ?? ""),
    is_completed: Boolean(row?.is_completed),
    score: row?.score === null || row?.score === undefined ? null : Number(row.score),
    completed_at: typeof row?.completed_at === "string" ? row.completed_at : null,
  };
}

function countAssignmentsForMaterial(params: {
  materialId: string;
  kind: OlympiadLegacyMaterialKind;
  assignments: OlympiadAssignmentLink[];
  completedSet: Set<string>;
}) {
  const ids: string[] = [];

  for (const assignment of params.assignments) {
    if (params.kind === "textbook" && assignment.textbook_id === params.materialId) {
      ids.push(assignment.id);
    }

    if (params.kind === "crossword" && assignment.crossword_id === params.materialId) {
      ids.push(assignment.id);
    }
  }

  let completed = 0;

  for (const id of ids) {
    if (params.completedSet.has(id)) completed += 1;
  }

  const total = ids.length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    progressPercent,
  };
}

export async function loadOlympiadMaterialsData(ctx: DataAuthContext): Promise<OlympiadMaterialsData> {
  const { supabase, user } = ctx;

  const [
    { data: textbookRows, error: textbookError },
    { data: crosswordRows, error: crosswordError },
    { data: assignmentRows, error: assignmentError },
    { data: progressRows, error: progressError },
    { data: textbookAccessRows, error: textbookAccessError },
    { data: crosswordAccessRows, error: crosswordAccessError },
  ] = await Promise.all([
    supabase
      .from("textbooks")
      .select("*")
      .eq("is_active", true)
      .or("branch_type.eq.olympiad,branch_type.is.null")
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true }),

    supabase
      .from("crosswords")
      .select("*")
      .eq("is_active", true)
      .or("branch_type.eq.olympiad,branch_type.is.null")
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true }),

    supabase
      .from("assignments")
      .select("id, textbook_id, crossword_id, branch_type")
      .or("branch_type.eq.olympiad,branch_type.is.null")
      .order("order_index", { ascending: true }),

    supabase
      .from("user_progress")
      .select("assignment_id, is_completed, score, completed_at")
      .eq("user_id", user.id),

    supabase.from("textbook_access").select("textbook_id").eq("user_id", user.id),

    supabase.from("crossword_access").select("crossword_id").eq("user_id", user.id),
  ]);

  const error =
    textbookError ||
    crosswordError ||
    assignmentError ||
    progressError ||
    textbookAccessError ||
    crosswordAccessError;

  if (error) {
    throw new Error(error.message);
  }

  return {
    textbooks: Array.isArray(textbookRows) ? textbookRows.map(normalizeTextbook) : [],
    crosswords: Array.isArray(crosswordRows) ? crosswordRows.map(normalizeCrossword) : [],
    assignments: Array.isArray(assignmentRows) ? assignmentRows.map(normalizeAssignmentLink) : [],
    userProgress: Array.isArray(progressRows) ? progressRows.map(normalizeProgressRow) : [],
    textbookAccess: Array.isArray(textbookAccessRows)
      ? textbookAccessRows
          .map((row: any) => ({ textbook_id: String(row?.textbook_id ?? "") }))
          .filter((row) => row.textbook_id)
      : [],
    crosswordAccess: Array.isArray(crosswordAccessRows)
      ? crosswordAccessRows
          .map((row: any) => ({ crossword_id: String(row?.crossword_id ?? "") }))
          .filter((row) => row.crossword_id)
      : [],
  };
}

export function buildOlympiadProfileProgress(data: OlympiadMaterialsData): OlympiadProfileProgressData {
  const textbookAccess = new Set(data.textbookAccess.map((item) => item.textbook_id));
  const crosswordAccess = new Set(data.crosswordAccess.map((item) => item.crossword_id));

  const availableTextbooks = data.textbooks.filter((item) => item.is_available || textbookAccess.has(item.id));
  const availableCrosswords = data.crosswords.filter((item) => item.is_available || crosswordAccess.has(item.id));

  const completedSet = new Set(
    data.userProgress
      .filter((item) => item.is_completed)
      .map((item) => item.assignment_id)
      .filter(Boolean),
  );

  const materialsProgress: OlympiadMaterialProgressItem[] = [];

  let totalAvailableAssignments = 0;
  let completedAvailableAssignments = 0;
  let completedMaterials = 0;

  for (const textbook of availableTextbooks) {
    const counts = countAssignmentsForMaterial({
      materialId: textbook.id,
      kind: "textbook",
      assignments: data.assignments,
      completedSet,
    });

    totalAvailableAssignments += counts.total;
    completedAvailableAssignments += counts.completed;

    if (counts.total > 0 && counts.completed === counts.total) {
      completedMaterials += 1;
    }

    materialsProgress.push({
      kind: "textbook",
      id: textbook.id,
      title: textbook.title,
      total: counts.total,
      completed: counts.completed,
      progressPercent: counts.progressPercent,
      href: `/materials#textbook-${textbook.id}`,
    });
  }

  for (const crossword of availableCrosswords) {
    const counts = countAssignmentsForMaterial({
      materialId: crossword.id,
      kind: "crossword",
      assignments: data.assignments,
      completedSet,
    });

    totalAvailableAssignments += counts.total;
    completedAvailableAssignments += counts.completed;

    if (counts.total > 0 && counts.completed === counts.total) {
      completedMaterials += 1;
    }

    materialsProgress.push({
      kind: "crossword",
      id: crossword.id,
      title: crossword.title,
      total: counts.total,
      completed: counts.completed,
      progressPercent: counts.progressPercent,
      href: `/materials#crossword-${crossword.id}`,
    });
  }

  const successRate =
    totalAvailableAssignments > 0
      ? Math.round((completedAvailableAssignments / totalAvailableAssignments) * 100)
      : 0;

  return {
    branch_type: "olympiad",
    stats: {
      totalMaterials: availableTextbooks.length + availableCrosswords.length,
      completedMaterials,
      successRate,
      totalAvailableAssignments,
      completedAvailableAssignments,
    },
    materialsProgress,
  };
}

export async function loadOlympiadProfileProgressData(ctx: DataAuthContext) {
  const data = await loadOlympiadMaterialsData(ctx);
  return buildOlympiadProfileProgress(data);
}

export async function loadTextbookPageData(
  ctx: DataAuthContext,
  textbookId: string,
): Promise<OlympiadSourcePageData | null> {
  const id = String(textbookId || "").trim();
  if (!id) return null;

  const { supabase, user } = ctx;

  const { data: textbookRow, error: textbookError } = await supabase
    .from("textbooks")
    .select("*")
    .eq("id", id)
    .or("branch_type.eq.olympiad,branch_type.is.null")
    .single();

  if (textbookError || !textbookRow) {
    return null;
  }

  const textbook = normalizeTextbook(textbookRow);

  const { data: accessRow, error: accessError } = await supabase
    .from("textbook_access")
    .select("id")
    .eq("user_id", user.id)
    .eq("textbook_id", id)
    .maybeSingle();

  if (accessError) {
    throw new Error(accessError.message);
  }

  const hasAccess = Boolean(textbook.is_available || accessRow);

  if (!hasAccess) {
    return {
      locked: true,
      branch_type: "olympiad",
      textbook,
      assignments: [],
      userProgress: [],
    };
  }

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("assignments")
    .select("*")
    .eq("textbook_id", id)
    .or("branch_type.eq.olympiad,branch_type.is.null")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (assignmentError) {
    throw new Error(assignmentError.message);
  }

  const assignments = Array.isArray(assignmentRows) ? assignmentRows : [];
  const assignmentIds = assignments.map((item: any) => String(item?.id ?? "")).filter(Boolean);

  let userProgress: OlympiadProgressRow[] = [];

  if (assignmentIds.length) {
    const { data: progressRows, error: progressError } = await supabase
      .from("user_progress")
      .select("assignment_id, is_completed, score, completed_at")
      .eq("user_id", user.id)
      .eq("is_completed", true)
      .in("assignment_id", assignmentIds);

    if (progressError) {
      throw new Error(progressError.message);
    }

    userProgress = Array.isArray(progressRows) ? progressRows.map(normalizeProgressRow) : [];
  }

  return {
    locked: false,
    branch_type: "olympiad",
    textbook,
    assignments,
    userProgress,
  };
}

export async function loadCrosswordPageData(
  ctx: DataAuthContext,
  crosswordId: string,
): Promise<OlympiadSourcePageData | null> {
  const id = String(crosswordId || "").trim();
  if (!id) return null;

  const { supabase, user } = ctx;

  const { data: crosswordRow, error: crosswordError } = await supabase
    .from("crosswords")
    .select("*")
    .eq("id", id)
    .or("branch_type.eq.olympiad,branch_type.is.null")
    .single();

  if (crosswordError || !crosswordRow) {
    return null;
  }

  const crossword = normalizeCrossword(crosswordRow);

  const { data: accessRow, error: accessError } = await supabase
    .from("crossword_access")
    .select("id")
    .eq("user_id", user.id)
    .eq("crossword_id", id)
    .maybeSingle();

  if (accessError) {
    throw new Error(accessError.message);
  }

  const hasAccess = Boolean(crossword.is_available || accessRow);

  if (!hasAccess) {
    return {
      locked: true,
      branch_type: "olympiad",
      crossword,
      assignments: [],
      userProgress: [],
    };
  }

  const { data: assignmentRows, error: assignmentError } = await supabase
    .from("assignments")
    .select("*")
    .eq("crossword_id", id)
    .or("branch_type.eq.olympiad,branch_type.is.null")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (assignmentError) {
    throw new Error(assignmentError.message);
  }

  const assignments = Array.isArray(assignmentRows) ? assignmentRows : [];
  const assignmentIds = assignments.map((item: any) => String(item?.id ?? "")).filter(Boolean);

  let userProgress: OlympiadProgressRow[] = [];

  if (assignmentIds.length) {
    const { data: progressRows, error: progressError } = await supabase
      .from("user_progress")
      .select("assignment_id, is_completed, score, completed_at")
      .eq("user_id", user.id)
      .eq("is_completed", true)
      .in("assignment_id", assignmentIds);

    if (progressError) {
      throw new Error(progressError.message);
    }

    userProgress = Array.isArray(progressRows) ? progressRows.map(normalizeProgressRow) : [];
  }

  return {
    locked: false,
    branch_type: "olympiad",
    crossword,
    assignments,
    userProgress,
  };
}