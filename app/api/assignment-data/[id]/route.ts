import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { NextResponse, type NextRequest } from "next/server";
import { mockDebugAll, mockDebugReview, mockDebugSingle } from "@/app/(app)/assignment/lib/mockDebugData";

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function isGatehouseAssignment(assignment: any) {
  const material = firstOrNull(assignment?.materials);
  return assignment?.branch_type === "gatehouse" || material?.branch_type === "gatehouse";
}

function getMaterialId(assignment: any): string | null {
  const material = firstOrNull(assignment?.materials);
  const direct = typeof assignment?.material_id === "string" ? assignment.material_id : null;
  const fromMaterial = typeof material?.id === "string" ? material.id : null;
  return direct || fromMaterial || null;
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
    const { data: assignment, error: aErr } = await supabase
      .from("assignments")
      .select(
        `*,
        materials(
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

    if (aErr || !assignment) return fail(aErr?.message || "Assignment not found", 404, "NOT_FOUND");

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

    const material = firstOrNull((assignment as any).materials);
    const gatehouse = isGatehouseAssignment(assignment);

    if (gatehouse) {
      const materialId = getMaterialId(assignment);

      if (!materialId) {
        return fail("Gatehouse assignment has no material", 404, "NOT_FOUND");
      }

      if (material?.is_active === false) {
        return fail("Material is not active", 404, "NOT_FOUND");
      }

      const { data: access, error: accessErr } = await supabase
        .from("material_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("material_id", materialId)
        .maybeSingle();

      if (accessErr) {
        return fail(accessErr.message, 500, "DB_ERROR");
      }

      const hasAccess = Boolean(material?.is_available || access);

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