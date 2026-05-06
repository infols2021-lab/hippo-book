import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";

type TextbookRow = {
  id: string;
  title: string;
  is_available: boolean | null;
};

type CrosswordRow = {
  id: string;
  title: string;
  is_available: boolean | null;
};

type AssignmentRow = {
  id: string;
  textbook_id: string | null;
  crossword_id: string | null;
};

type ProgressRow = {
  assignment_id: string;
  is_completed: boolean | null;
};

function groupAssignments(assignments: AssignmentRow[]) {
  const byTextbook = new Map<string, string[]>();
  const byCrossword = new Map<string, string[]>();

  for (const assignment of assignments) {
    if (assignment.textbook_id) {
      const list = byTextbook.get(assignment.textbook_id) ?? [];
      list.push(assignment.id);
      byTextbook.set(assignment.textbook_id, list);
    }

    if (assignment.crossword_id) {
      const list = byCrossword.get(assignment.crossword_id) ?? [];
      list.push(assignment.id);
      byCrossword.set(assignment.crossword_id, list);
    }
  }

  return { byTextbook, byCrossword };
}

function countProgress(ids: string[], completedSet: Set<string>) {
  const total = ids.length;
  let completed = 0;

  for (const id of ids) {
    if (completedSet.has(id)) completed++;
  }

  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    progressPercent,
  };
}

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;

  try {
    const [
      { data: textbooks, error: textbooksError },
      { data: crosswords, error: crosswordsError },
      { data: assignments, error: assignmentsError },
      { data: userProgress, error: progressError },
      { data: textbookAccess, error: textbookAccessError },
      { data: crosswordAccess, error: crosswordAccessError },
    ] = await Promise.all([
      supabase
        .from("textbooks")
        .select("id, title, is_available, is_active, order_index, branch_type")
        .eq("is_active", true)
        .or("branch_type.eq.olympiad,branch_type.is.null")
        .order("order_index", { ascending: false })
        .order("created_at", { ascending: false }),

      supabase
        .from("crosswords")
        .select("id, title, is_available, is_active, order_index, branch_type")
        .eq("is_active", true)
        .or("branch_type.eq.olympiad,branch_type.is.null")
        .order("order_index", { ascending: false })
        .order("created_at", { ascending: false }),

      supabase
        .from("assignments")
        .select("id, textbook_id, crossword_id, branch_type")
        .or("branch_type.eq.olympiad,branch_type.is.null"),

      supabase
        .from("user_progress")
        .select("assignment_id, is_completed")
        .eq("user_id", user.id),

      supabase
        .from("textbook_access")
        .select("textbook_id")
        .eq("user_id", user.id),

      supabase
        .from("crossword_access")
        .select("crossword_id")
        .eq("user_id", user.id),
    ]);

    const error =
      textbooksError ||
      crosswordsError ||
      assignmentsError ||
      progressError ||
      textbookAccessError ||
      crosswordAccessError;

    if (error) {
      return fail(error.message, 500, "DB_ERROR");
    }

    const textbookRows = Array.isArray(textbooks) ? (textbooks as TextbookRow[]) : [];
    const crosswordRows = Array.isArray(crosswords) ? (crosswords as CrosswordRow[]) : [];
    const assignmentRows = Array.isArray(assignments) ? (assignments as AssignmentRow[]) : [];
    const progressRows = Array.isArray(userProgress) ? (userProgress as ProgressRow[]) : [];

    const textbookAccessSet = new Set(
      Array.isArray(textbookAccess)
        ? textbookAccess.map((item: any) => String(item?.textbook_id ?? "")).filter(Boolean)
        : [],
    );

    const crosswordAccessSet = new Set(
      Array.isArray(crosswordAccess)
        ? crosswordAccess.map((item: any) => String(item?.crossword_id ?? "")).filter(Boolean)
        : [],
    );

    const completedSet = new Set(
      progressRows
        .filter((item) => item.is_completed)
        .map((item) => String(item.assignment_id ?? ""))
        .filter(Boolean),
    );

    const { byTextbook, byCrossword } = groupAssignments(assignmentRows);

    const availableTextbooks = textbookRows.filter(
      (textbook) => Boolean(textbook.is_available) || textbookAccessSet.has(textbook.id),
    );

    const availableCrosswords = crosswordRows.filter(
      (crossword) => Boolean(crossword.is_available) || crosswordAccessSet.has(crossword.id),
    );

    let totalAvailableAssignments = 0;
    let completedAvailableAssignments = 0;
    let completedMaterials = 0;

    const materialsProgress: any[] = [];

    for (const textbook of availableTextbooks) {
      const assignmentIds = byTextbook.get(textbook.id) ?? [];
      const { total, completed, progressPercent } = countProgress(assignmentIds, completedSet);

      totalAvailableAssignments += total;
      completedAvailableAssignments += completed;

      if (total > 0 && completed === total) {
        completedMaterials++;
      }

      materialsProgress.push({
        kind: "textbook",
        id: textbook.id,
        title: textbook.title,
        total,
        completed,
        progressPercent,
        href: `/materials#textbook-${textbook.id}`,
      });
    }

    for (const crossword of availableCrosswords) {
      const assignmentIds = byCrossword.get(crossword.id) ?? [];
      const { total, completed, progressPercent } = countProgress(assignmentIds, completedSet);

      totalAvailableAssignments += total;
      completedAvailableAssignments += completed;

      if (total > 0 && completed === total) {
        completedMaterials++;
      }

      materialsProgress.push({
        kind: "crossword",
        id: crossword.id,
        title: crossword.title,
        total,
        completed,
        progressPercent,
        href: `/materials#crossword-${crossword.id}`,
      });
    }

    const totalMaterials = availableTextbooks.length + availableCrosswords.length;

    const successRate =
      totalAvailableAssignments > 0
        ? Math.round((completedAvailableAssignments / totalAvailableAssignments) * 100)
        : 0;

    return ok({
      branch_type: "olympiad",
      stats: {
        totalMaterials,
        completedMaterials,
        successRate,
        totalAvailableAssignments,
        completedAvailableAssignments,
      },
      materialsProgress,
    });
  } catch (error: any) {
    return fail(error?.message || "Server error", 500, "SERVER_ERROR");
  }
}