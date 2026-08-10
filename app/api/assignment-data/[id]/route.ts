// app/api/assignment-data/[id]/route.ts
import { ok, fail } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

// Демо-задание — определяется по материалу (is_demo проставляется в админке,
// см. app/(admin)/admin/projects/MaterialsManager.tsx). Такие задания должны
// быть доступны анонимным гостям на странице /demo без авторизации.
function isDemoAssignment(assignment: any) {
  const mat = getMaterial(assignment);
  return Boolean(assignment?.is_demo || mat?.is_demo);
}

// ----------------------------------------------------------------------------
// GET handler
// ----------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  // 1. Debug-моки — ТОЛЬКО в режиме разработки
  if (process.env.NODE_ENV !== "production") {
    if (id === "debug-all") return NextResponse.json(mockDebugAll);
    if (id === "debug-review") return NextResponse.json(mockDebugReview);
    if (id === "debug-single") return NextResponse.json(mockDebugSingle);
  }

  // 2. Пытаемся получить пользователя, но НЕ блокируем запрос здесь.
  // Окончательное решение об авторизации принимается ниже — после того,
  // как станет известно, demo-задание это или нет.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
            is_demo,
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
    const isDemo = isDemoAssignment(assignment);

    // 4. Для НЕ-демо заданий авторизация обязательна.
    // Демо-задания открыты всем, включая анонимных гостей.
    if (!isDemo && !user) {
      return fail("Unauthorized", 401, "UNAUTHORIZED");
    }

    // 5. Проверка, что задание готово к показу
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

    // 6. Проверка прав доступа — пропускается для демо-заданий
    if (!isDemo) {
      const gatehouse = isGatehouseAssignment(assignment);

      try {
        if (gatehouse) {
          await assertGatehouseAssignmentAccess(supabase, user!.id, assignment);
        } else {
          await assertOlympiadAssignmentAccess(supabase, user!.id, assignment);
        }
      } catch (accessError: any) {
        console.error("🔴 [API ASSIGNMENT-DATA] Ошибка доступа:", accessError.message);
        return fail(
          accessError.message || "Access denied",
          accessError.status || 403,
          "FORBIDDEN",
        );
      }
    }

    // 7. Загрузка прогресса пользователя (у анонимного гостя серверного прогресса нет)
    let progressRow: any = null;
    if (user) {
      const { data, error: pErr } = await supabase
        .from("user_progress")
        .select("is_completed, score, completed_at, answers")
        .eq("user_id", user.id)
        .eq("assignment_id", id)
        .maybeSingle();

      if (pErr) {
        console.error("🔴 [API ASSIGNMENT-DATA] Ошибка прогресса:", pErr.message);
        return fail(pErr.message, 500, "DB_ERROR");
      }

      progressRow = data;
    }

    // 8. Ответ
    return ok({
      assignment,
      progress: progressRow
        ? {
            is_completed: Boolean(progressRow.is_completed),
            score: progressRow.score ?? null,
            completed_at: progressRow.completed_at ?? null,
            answers: progressRow.answers ?? {},
          }
        : null,
    });
  } catch (e: any) {
    console.error("🔴 [API ASSIGNMENT-DATA] Внутренняя ошибка:", e);
    return fail(e?.message || "Server error", 500, "SERVER_ERROR");
  }
}