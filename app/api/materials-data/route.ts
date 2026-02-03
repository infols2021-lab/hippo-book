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
      supabase.from("textbooks").select("*").eq("is_active", true).order("order_index"),
      supabase.from("crosswords").select("*").eq("is_active", true).order("order_index"),
      supabase.from("assignments").select("id, textbook_id, crossword_id"),
      supabase.from("user_progress").select("assignment_id, is_completed").eq("user_id", user.id),
      supabase.from("textbook_access").select("textbook_id").eq("user_id", user.id),
      supabase.from("crossword_access").select("crossword_id").eq("user_id", user.id),
    ]);

    const err = tErr || cErr || aErr || pErr || taErr || caErr;
    if (err) return fail(err.message, 500, "DB_ERROR");

    return ok({
      textbooks: textbooks ?? [],
      crosswords: crosswords ?? [],
      assignments: assignments ?? [],
      userProgress: userProgress ?? [],
      textbookAccess: textbookAccess ?? [],
      crosswordAccess: crosswordAccess ?? [],
    });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}
