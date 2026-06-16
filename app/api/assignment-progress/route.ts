// app/api/assignment-progress/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calcAndBuildReview } from "@/lib/assignments/scoring";

// TODO: В будущем (когда отвяжемся от легаси) заменим на универсальный assertProjectAssignmentAccess
import {
  assertOlympiadAssignmentAccess,
  assertGatehouseAssignmentAccess,
} from "@/lib/assignments/access";

// НА ЗАМЕТКУ: Когда закончишь ЭТАП 1, измени этот импорт на: 
// import { recommendLevel } from "@/lib/projects/recommendLevel";
import { recommendGatehouseLevel as recommendLevel } from "@/lib/exams/recommendLevel";

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
  const material = firstOrNull(assignment?.materials);
  return normalizeStringArray(material?.target_levels);
}

function getMaterialId(assignment: any): string | null {
  const material = firstOrNull(assignment?.materials);
  const direct = typeof assignment?.material_id === "string" ? assignment.material_id : null;
  const fromMaterial = typeof material?.id === "string" ? material.id : null;
  return direct || fromMaterial || null;
}

// УНИВЕРСАЛЬНЫЙ ЧТЕНИЯ ФИЧ (Фоллбэк для старых материалов без project_id)
function getProjectConfig(assignment: any) {
  const material = firstOrNull(assignment?.materials);
  const project = material?.projects;
  
  const isLegacyGatehouse = assignment?.branch_type === "gatehouse" || material?.branch_type === "gatehouse";
  
  return {
    slug: project?.slug ?? (isLegacyGatehouse ? "gatehouse" : "olympiad"),
    hasStreaks: project?.features?.hasStreaks ?? !isLegacyGatehouse, // Олимпиада по умолчанию со стриками
    hasRecommendations: project?.features?.hasRecommendations ?? isLegacyGatehouse, // Экзамены по умолчанию с рекомендациями
  };
}

// ПЕРЕПИСАНО: Надежный агрегатор счетчиков (поддерживает и старый branch_type и новый project.slug)
async function recalcCompletedCounters(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_progress")
    .select(`
      id,
      assignments (
        branch_type,
        materials ( projects ( slug ) )
      )
    `)
    .eq("user_id", userId)
    .eq("is_completed", true);

  let olympiadCount = 0;
  let gatehouseCount = 0;

  for (const row of data || []) {
    const assignment = row.assignments;
    if (!assignment) continue;

    const legacyBranch = assignment.branch_type;
    const material = firstOrNull(assignment.materials);
    const projectSlug = material?.projects?.slug;

    if (projectSlug === "gatehouse" || (!projectSlug && legacyBranch === "gatehouse")) {
      gatehouseCount++;
    } else {
      olympiadCount++; // Все остальные проекты и олимпиада летят сюда
    }
  }

  await supabase
    .from("profiles")
    .update({
      completed_assignments_count: olympiadCount,
      ga_completed_assignments_count: gatehouseCount,
    })
    .eq("id", userId);

  return {
    olympiadCompletedAssignmentsCount: olympiadCount,
    gatehouseCompletedAssignmentsCount: gatehouseCount,
  };
}

// ─────────────────────────────────────────────────────────────
// POST handler
// ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authErr } = await supabase.auth.getUser();

  if (authErr) return NextResponse.json({ ok: false, error: "Auth fetch failed" }, { status: 500 });
  if (!auth.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 }); }
  if (!body?.assignmentId) return NextResponse.json({ ok: false, error: "assignmentId required" }, { status: 400 });

  // ─────────────────────────────────────────────────────────────
  // Дебаг-задания (не существуют в БД)
  // ─────────────────────────────────────────────────────────────
  const debugIds = ["debug-all", "debug-review", "debug-perfect", "debug-mode-choice", "debug-gatehouse"];
  if (debugIds.includes(body.assignmentId) || body.assignmentId?.startsWith("debug-single-")) {
    return NextResponse.json({
      ok: true, score: body.score, branch_type: "olympiad",
      counters: { olympiadCompletedAssignmentsCount: 0, gatehouseCompletedAssignmentsCount: 0 },
    });
  }

  if (!body.isCompleted) return NextResponse.json({ ok: true, skipped: true }, { status: 200 });

  // ─────────────────────────────────────────────────────────────
  // ПОЛУЧЕНИЕ ЗАДАНИЯ + ДАННЫЕ ПРОЕКТА (NEW ARCHITECTURE)
  // ─────────────────────────────────────────────────────────────
  const { data: assignment, error: assignmentErr } = await supabase
    .from("assignments")
    .select(`
      id, branch_type, material_id, textbook_id, crossword_id, content,
      materials(
        id, branch_type, project_id, material_kind, target_levels, is_active, is_available,
        projects ( id, slug, features )
      )
    `)
    .eq("id", body.assignmentId)
    .single();

  if (assignmentErr || !assignment) {
    return NextResponse.json({ ok: false, error: assignmentErr?.message || "Assignment not found" }, { status: 404 });
  }

  const projectConfig = getProjectConfig(assignment);

  // ─────────────────────────────────────────────────────────────
  // ДОСТУПЫ (Временный фоллбэк до полного переезда на единый assert)
  // ─────────────────────────────────────────────────────────────
  try {
    if (projectConfig.slug === "gatehouse") {
      await assertGatehouseAssignmentAccess(supabase, auth.user.id, assignment);
    } else {
      await assertOlympiadAssignmentAccess(supabase, auth.user.id, assignment);
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Access denied" }, { status: err.status || 403 });
  }

  // ─────────────────────────────────────────────────────────────
  // ОЦЕНКА (Интерактивный vs Ознакомительный)
  // ─────────────────────────────────────────────────────────────
  const isInformational = assignment.content?.mode === "informational";
  let realScore: number | null = null;

  if (!isInformational) {
    const questions = assignment.content?.questions;
    if (!Array.isArray(questions)) return NextResponse.json({ ok: false, error: "Некорректное содержимое" }, { status: 500 });
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

  // ─────────────────────────────────────────────────────────────
  // ДИНАМИЧЕСКИЕ МОДУЛИ (ПО ФЛАГАМ ПРОЕКТА)
  // ─────────────────────────────────────────────────────────────
  let recommendation: any = null;
  let streak: any = null;

  // 1. Модуль Рекомендаций (ранее только для Gatehouse)
  if (projectConfig.hasRecommendations) {
    const materialId = getMaterialId(assignment);
    
    if (!isInformational && realScore !== null) {
      recommendation = recommendLevel({
        score: realScore, maxScore: 100, percent: realScore,
        materialLevels: getMaterialLevels(assignment),
      });
    }

    const { error: examErr } = await supabase
      .from("exam_results")
      .upsert({
        user_id: auth.user.id, assignment_id: body.assignmentId, material_id: materialId,
        score: realScore, recommended_level: recommendation?.recommendedLevel || null,
        breakdown: { recommendation, source: body.source ?? null, sourceId: body.sourceId ?? null },
        answers: body.answers ?? {}, completed_at: payload.completed_at,
      }, { onConflict: "user_id,assignment_id" });

    if (examErr) console.error("[ERROR] exam_results upsert failed:", examErr.message);
  }

  // 2. Модуль Стриков (ранее только для Олимпиады)
  if (projectConfig.hasStreaks) {
    const { data: streakData, error: streakErr } = await supabase.rpc(
      "record_streak_completion",
      { _assignment_id: body.assignmentId }
    );
    if (!streakErr) streak = streakData ?? null;
    else console.error("[ERROR] record_streak_completion RPC failed:", streakErr.message);
  }

  // ─────────────────────────────────────────────────────────────
  // ЕДИНЫЙ ОТВЕТ СЕРВЕРА
  // ─────────────────────────────────────────────────────────────
  return NextResponse.json(
    { 
      ok: true, 
      branch_type: projectConfig.slug, // Клиент получит актуальный слаг (olympiad, exam и т.д.)
      score: realScore, 
      recommendation, 
      streak, 
      counters 
    },
    { status: 200 }
  );
}