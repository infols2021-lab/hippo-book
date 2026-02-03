import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;

  try {
    const [
      { data: textbooks, error: tErr },
      { data: crosswords, error: cErr },
      { data: assignments, error: aErr },
      { data: userProgress, error: pErr },
      { data: textbookAccess, error: taErr },
      { data: crosswordAccess, error: caErr },
    ] = await Promise.all([
      supabase
        .from("textbooks")
        .select("id, title, is_available, is_active, order_index")
        .eq("is_active", true)
        .order("order_index"),
      supabase
        .from("crosswords")
        .select("id, title, is_available, is_active, order_index")
        .eq("is_active", true)
        .order("order_index"),
      supabase.from("assignments").select("id, textbook_id, crossword_id"),
      supabase.from("user_progress").select("assignment_id, is_completed").eq("user_id", user.id),
      supabase.from("textbook_access").select("textbook_id").eq("user_id", user.id),
      supabase.from("crossword_access").select("crossword_id").eq("user_id", user.id),
    ]);

    const err = tErr || cErr || aErr || pErr || taErr || caErr;
    if (err) return fail(err.message, 500, "DB_ERROR");

    const tb = textbooks ?? [];
    const cw = crosswords ?? [];
    const asg = assignments ?? [];
    const up = userProgress ?? [];
    const tba = textbookAccess ?? [];
    const cwa = crosswordAccess ?? [];

    const hasTextbookAccess = new Set(tba.map((x: any) => x.textbook_id));
    const hasCrosswordAccess = new Set(cwa.map((x: any) => x.crossword_id));

    const availableTextbooks = tb.filter((t: any) => t.is_available || hasTextbookAccess.has(t.id));
    const availableCrosswords = cw.filter((c: any) => c.is_available || hasCrosswordAccess.has(c.id));

    const completedSet = new Set(up.filter((x: any) => x.is_completed).map((x: any) => x.assignment_id));

    function countForTextbook(textbookId: string) {
      const ids = asg.filter((a: any) => a.textbook_id === textbookId).map((a: any) => a.id);
      const total = ids.length;
      let completed = 0;
      for (const id of ids) if (completedSet.has(id)) completed++;
      const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { total, completed, progressPercent };
    }

    function countForCrossword(crosswordId: string) {
      const ids = asg.filter((a: any) => a.crossword_id === crosswordId).map((a: any) => a.id);
      const total = ids.length;
      let completed = 0;
      for (const id of ids) if (completedSet.has(id)) completed++;
      const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { total, completed, progressPercent };
    }

    let totalAvailableAssignments = 0;
    let completedAvailableAssignments = 0;

    const materialsProgress: any[] = [];

    for (const t of availableTextbooks) {
      const { total, completed, progressPercent } = countForTextbook(t.id);
      totalAvailableAssignments += total;
      completedAvailableAssignments += completed;
      materialsProgress.push({
        kind: "textbook",
        id: t.id,
        title: t.title,
        total,
        completed,
        progressPercent,
        href: `/materials#textbook-${t.id}`,
      });
    }

    for (const c of availableCrosswords) {
      const { total, completed, progressPercent } = countForCrossword(c.id);
      totalAvailableAssignments += total;
      completedAvailableAssignments += completed;
      materialsProgress.push({
        kind: "crossword",
        id: c.id,
        title: c.title,
        total,
        completed,
        progressPercent,
        href: `/materials#crossword-${c.id}`,
      });
    }

    let completedMaterials = 0;
    for (const t of availableTextbooks) {
      const { total, completed } = countForTextbook(t.id);
      if (total > 0 && completed === total) completedMaterials++;
    }
    for (const c of availableCrosswords) {
      const { total, completed } = countForCrossword(c.id);
      if (total > 0 && completed === total) completedMaterials++;
    }

    const totalMaterials = availableTextbooks.length + availableCrosswords.length;

    const successRate =
      totalAvailableAssignments > 0
        ? Math.round((completedAvailableAssignments / totalAvailableAssignments) * 100)
        : 0;

    return ok({
      stats: {
        totalMaterials,
        completedMaterials,
        successRate,
        totalAvailableAssignments,
        completedAvailableAssignments,
      },
      materialsProgress,
    });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}
