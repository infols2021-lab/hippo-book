import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;
  const { id } = await ctx.params;

  const textbookId = String(id ?? "").trim();

  if (!textbookId) {
    return fail("Missing textbook id", 400, "VALIDATION");
  }

  try {
    const { data: textbook, error: textbookError } = await supabase
      .from("textbooks")
      .select("*")
      .eq("id", textbookId)
      .eq("is_active", true)
      .or("branch_type.eq.olympiad,branch_type.is.null")
      .single();

    if (textbookError || !textbook) {
      return fail(textbookError?.message || "Textbook not found", 404, "NOT_FOUND");
    }

    const { data: access, error: accessError } = await supabase
      .from("textbook_access")
      .select("id")
      .eq("user_id", user.id)
      .eq("textbook_id", textbookId)
      .maybeSingle();

    if (accessError) {
      return fail(accessError.message, 500, "DB_ERROR");
    }

    const isAllowed = Boolean(textbook.is_available || access);

    if (!isAllowed) {
      return ok({
        locked: true,
        branch_type: "olympiad",
        textbook,
        assignments: [],
        userProgress: [],
      });
    }

    const { data: assignments, error: assignmentsError } = await supabase
      .from("assignments")
      .select("*")
      .eq("textbook_id", textbookId)
      .or("branch_type.eq.olympiad,branch_type.is.null")
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true });

    if (assignmentsError) {
      return fail(assignmentsError.message, 500, "DB_ERROR");
    }

    const assignmentRows = assignments ?? [];
    const assignmentIds = assignmentRows.map((assignment: any) => String(assignment.id)).filter(Boolean);

    let userProgress: any[] = [];

    if (assignmentIds.length > 0) {
      const { data: progressRows, error: progressError } = await supabase
        .from("user_progress")
        .select("assignment_id, is_completed, score")
        .eq("user_id", user.id)
        .eq("is_completed", true)
        .in("assignment_id", assignmentIds);

      if (progressError) {
        return fail(progressError.message, 500, "DB_ERROR");
      }

      userProgress = progressRows ?? [];
    }

    return ok({
      locked: false,
      branch_type: "olympiad",
      textbook,
      assignments: assignmentRows,
      userProgress,
    });
  } catch (error: any) {
    return fail(error?.message || "Server error", 500, "SERVER_ERROR");
  }
}