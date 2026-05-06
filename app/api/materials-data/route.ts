import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";

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
        .select("*")
        .eq("is_active", true)
        .or("branch_type.eq.olympiad,branch_type.is.null")
        .order("order_index", { ascending: false })
        .order("created_at", { ascending: false }),

      supabase
        .from("crosswords")
        .select("*")
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

    return ok({
      branch_type: "olympiad",
      textbooks: textbooks ?? [],
      crosswords: crosswords ?? [],
      assignments: assignments ?? [],
      userProgress: userProgress ?? [],
      textbookAccess: textbookAccess ?? [],
      crosswordAccess: crosswordAccess ?? [],
    });
  } catch (error: any) {
    return fail(error?.message || "Server error", 500, "SERVER_ERROR");
  }
}