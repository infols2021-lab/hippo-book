// app/api/assignment-progress/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calcAndBuildReview } from "@/lib/assignments/scoring";
import {
  assertOlympiadAssignmentAccess,
  assertGatehouseAssignmentAccess,
} from "@/lib/assignments/access";
import { recommendGatehouseLevel } from "@/lib/exams/recommendLevel";

type Body = {
  assignmentId: string;
  answers: Record<string, any>;
  isCompleted: boolean;
  score: number | null;    // присланный клиентом балл игнорируется
  source?: string;
  sourceId?: string;
  branchType?: string;
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeScore(value: unknown): number {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function getMaterialLevels(assignment: any): string[] {
  // Баг #10: Извлекаем уровни из связанных материалов
  const material = firstOrNull(assignment?.materials);
  return normalizeStringArray(material?.target_levels);
}

function getMaterialId(assignment: any): string | null {
  const material = firstOrNull(assignment?.materials);
  const direct = typeof assignment?.material_id === "string" ? assignment.material_id : null;
  const fromMaterial = typeof material?.id === "string" ? material.id : null;
  return direct || fromMaterial || null;
}

function isGatehouseAssignment(assignment: any) {
  if (assignment?.branch_type === "gatehouse") return true;
  
  const material = firstOrNull(assignment?.materials);
  if (material?.branch_type === "gatehouse") return true;

  return false;
}

async function recalcCompletedCounters(supabase: any, userId: string) {
  const [{ count: olympiadCount }, { count: gatehouseCount }] = await Promise.all([
    supabase
      .from("user_progress")
      .select("id, assignments!inner(branch_type)", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_completed", true)
      .eq("assignments.branch_type", "olympiad"),
    supabase
      .from("user_progress")
      .select("id, assignments!inner(branch_type)", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_completed", true)
      .eq("assignments.branch_type", "gatehouse"),
  ]);

  await supabase
    .from("profiles")
    .update({
      completed_assignments_count: olympiadCount ?? 0,
      ga_completed_assignments_count: gatehouseCount ?? 0,
    })
    .eq("id", userId);

  return {
    olympiadCompletedAssignmentsCount: olympiadCount ?? 0,
    gatehouseCompletedAssignmentsCount: gatehouseCount ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authErr } = await supabase.auth.getUser();

  if (authErr)
    return NextResponse.json({ ok: false, error: "Auth fetch failed" }, { status: 500 });
  if (!auth.user)
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }

  if (!body?.assignmentId) {
    return NextResponse.json(
      { ok: false, error: "assignmentId required" },
      { status: 400 }
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Дебаг-задания (не существуют в БД) – возвращаем успех без сохранения
  // ─────────────────────────────────────────────────────────────
  const debugIds = [
    "debug-all",
    "debug-review",
    "debug-perfect",
    "debug-mode-choice",
    "debug-gatehouse",
  ];
  const isDebugId = debugIds.includes(body.assignmentId) || body.assignmentId?.startsWith("debug-single-");
  if (isDebugId) {
    return NextResponse.json({
      ok: true,
      score: body.score,
      branch_type: "olympiad",
      counters: {
        olympiadCompletedAssignmentsCount: 0,
        gatehouseCompletedAssignmentsCount: 0,
      },
    });
  }

  if (!body.isCompleted) {
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }

  // ЗАПРОС ИСПРАВЛЕН: убрали несуществующее поле target_levels из assignments
  const { data: assignment, error: assignmentErr } = await supabase
    .from("assignments")
    .select(
      `id,
      branch_type,
      material_id,
      textbook_id,
      crossword_id,
      content,
      materials(
        id,
        branch_type,
        material_kind,
        target_levels,
        is_active,
        is_available
      )`
    )
    .eq("id", body.assignmentId)
    .single();

  if (assignmentErr || !assignment) {
    return NextResponse.json(
      { ok: false, error: assignmentErr?.message || "Assignment not found" },
      { status: 404 }
    );
  }

  const gatehouse = isGatehouseAssignment(assignment);
  try {
    if (gatehouse) {
      await assertGatehouseAssignmentAccess(supabase, auth.user.id, assignment);
    } else {
      await assertOlympiadAssignmentAccess(supabase, auth.user.id, assignment);
    }
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "Access denied" },
      { status: err.status || 403 }
    );
  }

  // =================================================================
  // ЛОГИКА ОПРЕДЕЛЕНИЯ БАЛЛОВ (ИНТЕРАКТИВНЫЙ VS ОЗНАКОМИТЕЛЬНЫЙ)
  // =================================================================
  const isInformational = assignment.content?.mode === "informational";
  let realScore: number | null = null;

  if (!isInformational) {
    const questions = assignment.content?.questions;
    if (!Array.isArray(questions)) {
      return NextResponse.json(
        { ok: false, error: "Некорректное содержимое задания" },
        { status: 500 }
      );
    }
    const { stats } = calcAndBuildReview(questions, body.answers);
    realScore = normalizeScore(stats.score);
  }

  const payload = {
    user_id: auth.user.id,
    assignment_id: body.assignmentId,
    answers: body.answers ?? {},
    is_completed: true,
    completed_at: new Date().toISOString(),
    score: realScore,
  };

  const { error: upsertError } = await supabase
    .from("user_progress")
    .upsert(payload, { onConflict: "user_id,assignment_id" });

  if (upsertError) {
    console.error("[ERROR] user_progress upsert failed:", upsertError.message);
    return NextResponse.json({ ok: false, error: upsertError.message }, { status: 500 });
  }

  const counters = await recalcCompletedCounters(supabase, auth.user.id);

  if (gatehouse) {
    const materialId = getMaterialId(assignment);
    
    // Если это ознакомительное задание, рекомендация не выдается
    let recommendation: any = null;
    if (!isInformational && realScore !== null) {
      recommendation = recommendGatehouseLevel({
        score: realScore,
        maxScore: 100,
        percent: realScore,
        materialLevels: getMaterialLevels(assignment),
      });
    }

    const examResultPayload = {
      user_id: auth.user.id,
      assignment_id: body.assignmentId,
      material_id: materialId,
      score: realScore,
      recommended_level: recommendation?.recommendedLevel || null,
      breakdown: {
        recommendation,
        source: body.source ?? null,
        sourceId: body.sourceId ?? null,
      },
      answers: body.answers ?? {},
      completed_at: payload.completed_at,
    };

    const { error: examErr } = await supabase
      .from("exam_results")
      .upsert(examResultPayload, { onConflict: "user_id,assignment_id" });

    if (examErr) {
      console.error("[ERROR] exam_results upsert failed:", examErr.message);
    }

    return NextResponse.json(
      { ok: true, branch_type: "gatehouse", score: realScore, recommendation, counters },
      { status: 200 }
    );
  }

  let streak: any = null;
  const { data: streakData, error: streakErr } = await supabase.rpc(
    "record_streak_completion",
    { _assignment_id: body.assignmentId }
  );

  if (!streakErr) {
    streak = streakData ?? null;
  } else {
    console.error("[ERROR] record_streak_completion RPC failed:", streakErr.message);
  }

  return NextResponse.json(
    { ok: true, branch_type: "olympiad", score: realScore, streak, counters },
    { status: 200 }
  );
}