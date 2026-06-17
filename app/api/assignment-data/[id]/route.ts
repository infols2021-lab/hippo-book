import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { NextResponse, type NextRequest } from "next/server";
import { mockDebugAll, mockDebugReview, mockDebugSingle } from "@/lib/assignments/mockDebugData";
import type { AssignmentData } from "@/lib/assignments/types";

// Умная функция-хэлпер для извлечения материала из разных вариантов JOIN-ответов Supabase
// (Гарантирует совместимость и с новой архитектурой, и с легаси-кодом)
function getMaterial(assignment: any) {
  if (!assignment) return null;
  
  // Если пришел как объект (новый синтаксис)
  if (assignment.material && !Array.isArray(assignment.material)) return assignment.material;
  if (assignment.materials && !Array.isArray(assignment.materials)) return assignment.materials;
  
  // Если пришел как массив (старый синтаксис)
  if (Array.isArray(assignment.materials)) return assignment.materials[0] || null;
  if (Array.isArray(assignment.material)) return assignment.material[0] || null;
  
  return null;
}

function isGatehouseAssignment(assignment: any) {
  const mat = getMaterial(assignment);
  return assignment?.branch_type === "gatehouse" || mat?.branch_type === "gatehouse";
}

function getMaterialId(assignment: any): string | null {
  const mat = getMaterial(assignment);
  return assignment?.material_id || mat?.id || null;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;
  const { id } = await ctx.params;

  // ====== БЭКДОР ДЛЯ ДЕБАГА ======
  if (id === "debug-all") return NextResponse.json(mockDebugAll);
  if (id === "debug-review") return NextResponse.json(mockDebugReview);
  if (id === "debug-single") return NextResponse.json(mockDebugSingle);
  // ===============================

  try {
    // ❗️ ИСПРАВЛЕННЫЙ JOIN-ЗАПРОС
    // Мы используем алиас "material:materials", чтобы явно указать связь 
    // и избежать краша "Could not find a relationship between materials and projects"
    const { data: rawAssignment, error: aErr } = await supabase
      .from("assignments")
      .select(`
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
      `)
      .eq("id", id)
      .single();

    if (aErr || !rawAssignment) {
      console.error("🔴 [API ASSIGNMENT-DATA] Ошибка поиска задания:", aErr?.message);
      return fail(aErr?.message || "Assignment not found", 404, "NOT_FOUND");
    }

    const assignment = rawAssignment as any;

    // --- ПРОВЕРКА НА ПУСТОЕ ЗАДАНИЕ С УЧЕТОМ ТИПА (TEST / INTRO) ---
    const content = assignment.content || {};
    const assignmentType = assignment.assignment_type || 'test';
    const isIntro = assignmentType === 'intro' || content.mode === 'informational';
    
    const questions = Array.isArray(content.questions) ? content.questions : [];
    const blocks = Array.isArray(content.blocks) ? content.blocks : [];

    // Блокируем, только если это ТЕСТ (с проверкой) и в нем 0 вопросов
    if (!isIntro && questions.length === 0) {
      return fail("Задание еще не готово (нет вопросов)", 403, "NOT_READY");
    }

    // Защита от пустых ознакомительных материалов (если нет ни блоков, ни вопросов)
    if (isIntro && blocks.length === 0 && questions.length === 0) {
      return fail("Ознакомительный материал еще не заполнен", 403, "NOT_READY");
    }
    // -----------------------------------------------------------------

    const gatehouse = isGatehouseAssignment(assignment);
    const mat = getMaterial(assignment);

    if (gatehouse) {
      const materialId = getMaterialId(assignment);

      if (!materialId) {
        return fail("Gatehouse assignment has no material", 404, "NOT_FOUND");
      }

      if (mat && mat.is_active === false) {
        return fail("Material is not active", 404, "NOT_FOUND");
      }

      const { data: access, error: accessErr } = await supabase
        .from("material_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("material_id", materialId)
        .maybeSingle();

      if (accessErr) {
        console.error("🔴 [API ASSIGNMENT-DATA] Ошибка доступа:", accessErr.message);
        return fail(accessErr.message, 500, "DB_ERROR");
      }

      const hasAccess = Boolean(mat?.is_available || access);

      if (!hasAccess) {
        return fail("No access to this Gatehouse material", 403, "FORBIDDEN");
      }
    }

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

    // Возвращаем данные, совместимые с AssignmentClient
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