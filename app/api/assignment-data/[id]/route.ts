import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import type { NextRequest } from "next/server";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;
  const { id } = await ctx.params;

  try {
    const { data: assignment, error: aErr } = await supabase
      .from("assignments")
      .select("*")
      .eq("id", id)
      .single();

    if (aErr || !assignment) return fail(aErr?.message || "Assignment not found", 404, "NOT_FOUND");

    const { data: progress, error: pErr } = await supabase
      .from("user_progress")
      .select("is_completed, score, completed_at, answers")
      .eq("user_id", user.id)
      .eq("assignment_id", id)
      .maybeSingle();

    if (pErr) return fail(pErr.message, 500, "DB_ERROR");

    return ok({
      assignment,
      progress: progress
        ? {
            is_completed: Boolean(progress.is_completed),
            score: progress.score ?? null,
            completed_at: progress.completed_at ?? null,
            answers: progress.answers ?? {},
          }
        : null,
    });
  } catch (e: any) {
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}
