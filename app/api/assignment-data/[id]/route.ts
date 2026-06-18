// app/api/assignment-data/[id]/route.ts
import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { NextResponse, type NextRequest } from "next/server";
import {
  mockDebugAll,
  mockDebugReview,
  mockDebugSingle,
} from "@/lib/assignments/mockDebugData";
import {
  assertOlympiadAssignmentAccess,
  assertGatehouseAssignmentAccess,
} from "@/lib/assignments/access";

// ----------------------------------------------------------------------------
// Вспомогательные функции
// ----------------------------------------------------------------------------

function getMaterial(assignment: any) {
  if (!assignment) return null;

  if (assignment.material && !Array.isArray(assignment.material))
    return assignment.material;
  if (assignment.materials && !Array.isArray(assignment.materials))
    return assignment.materials;

  if (Array.isArray(assignment.materials)) return assignment.materials[0] || null;
  if (Array.isArray(assignment.material)) return assignment.material[0] || null;

  return null;
}

function isGatehouseAssignment(assignment: any) {
  const mat = getMaterial(assignment);
  return (
    assignment?.branch_type === "gatehouse" || mat?.branch_type === "gatehouse"
  );
}

function getMaterialId(assignment: any): string | null {
  const mat = getMaterial(assignment);
  return assignment?.material_id || mat?.id || null;
}

// ----------------------------------------------------------------------------
// GET handler
// ----------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  // 1. Проверка авторизации
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;
  const { id } = await ctx.params;

  // 2. Debug-моки — ТОЛЬКО в режиме разработки
  if (process.env.NODE_ENV !== "production") {
    if (id === "debug-all") return NextResponse.json(mockDebugAll);
    if (id === "debug-review") return NextResponse.json(mockDebugReview);
    if (id === "debug-single") return NextResponse.json(mockDebugSingle);
  }

  try {
    // 3. Загрузка задания с материалом
    const { data: rawAssignment, error: aErr } = await supabase
      .from("assignments")
      .select(
        `
          *,
          material:materials (
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

    if (aErr || !rawAssignment) {
      console.error("🔴 [API ASSIGNMENT-DATA] Ошибка поиска задания:", aErr?.message);
      return fail(aErr?.message || "Assignment not found", 404, "NOT_FOUND");
    }

    const assignment = rawAssignment as any;

    // 4. Проверка, что задание готово к показу
    const content = assignment.content || {};
    const assignmentType = assignment.assignment_type || "test";
    const isIntro = assignmentType === "intro" || content.mode === "informational";
    const questions = Array.isArray(content.questions) ? content.questions : [];
    const blocks = Array.isArray(content.blocks) ? content.blocks : [];

    if (!isIntro && questions.length === 0) {
      return fail("Задание еще не готово (нет вопросов)", 403, "NOT_READY");
    }
    if (isIntro && blocks.length === 0 && questions.length === 0) {
      return fail(
        "Ознакомительный материал еще не заполнен",
        403,
        "NOT_READY",
      );
    }

    // 5. Проверка прав доступа
    const gatehouse = isGatehouseAssignment(assignment);
    const mat = getMaterial(assignment);

    try {
      if (gatehouse) {
        await assertGatehouseAssignmentAccess(supabase, user.id, assignment);
      } else {
        await assertOlympiadAssignmentAccess(supabase, user.id, assignment);
      }
    } catch (accessError: any) {
      console.error("🔴 [API ASSIGNMENT-DATA] Ошибка доступа:", accessError.message);
      return fail(
        accessError.message || "Access denied",
        accessError.status || 403,
        "FORBIDDEN",
      );
    }

    // 6. Загрузка прогресса пользователя
    const { data: progress, error: pErr } = await supabase
      .from("user_progress")
      .select("is_completed, score, completed_at, answers")
      .eq("user_id", user.id)
      .eq("assignment_id", id)
      .maybeSingle();

    if (pErr) {
      console.error("🔴 [API ASSIGNMENT-DATA] Ошибка прогресса:", pErr.message);
      return fail(pErr.message, 500, "DB_ERROR");
    }

    // 7. Ответ
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
    console.error("🔴 [API ASSIGNMENT-DATA] Внутренняя ошибка:", e);
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}