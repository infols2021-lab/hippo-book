// app/api/assignment-progress/route.ts
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { calcAndBuildReview, deriveScoreFromPoints } from "@/lib/assignments/scoring";
import type { AssignmentData } from "@/lib/assignments/types";

import {
  assertOlympiadAssignmentAccess,
  assertGatehouseAssignmentAccess,
} from "@/lib/assignments/access";

import {
  findRoadmapNodeByAssignmentId,
  fetchRoadmapStructure,
  upsertRoadmapNodeProgress,
} from "@/lib/roadmap/data";
import { recommendGatehouseLevel as recommendLevel } from "@/lib/exams/recommendLevel";

type Body = {
  assignmentId: string;
  answers: Record<string, any>;
  isCompleted: boolean;
  score: number | null;
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

function normalizeScore(value: unknown, pointsEarned?: number, pointsTotal?: number): number {
  const score = Number(value);
  if (Number.isFinite(score) && score > 0) {
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  if (
    typeof pointsEarned === "number" &&
    typeof pointsTotal === "number" &&
    pointsTotal > 0
  ) {
    return deriveScoreFromPoints(pointsEarned, pointsTotal);
  }

  return Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function getMaterial(assignment: any) {
  if (!assignment) return null;
  if (assignment.material && !Array.isArray(assignment.material)) return assignment.material;
  if (assignment.materials && !Array.isArray(assignment.materials)) return assignment.materials;
  if (Array.isArray(assignment.materials)) return assignment.materials[0] || null;
  if (Array.isArray(assignment.material)) return assignment.material[0] || null;
  return null;
}

function getMaterialLevels(assignment: AssignmentData | null): string[] {
  const material = getMaterial(assignment);
  return normalizeStringArray(material?.target_levels);
}

function getMaterialId(assignment: AssignmentData | null): string | null {
  const material = getMaterial(assignment);
  return assignment?.material_id || material?.id || null;
}

function getProjectConfig(assignment: AssignmentData | null) {
  const material = getMaterial(assignment);
  const project = material?.project_tabs?.projects;
  const isLegacyGatehouse = assignment?.branch_type === "gatehouse" || material?.branch_type === "gatehouse";

  return {
    slug: project?.slug ?? (isLegacyGatehouse ? "gatehouse" : "olympiad"),
    hasStreaks: project?.features?.streaks !== false && !isLegacyGatehouse,
    hasRecommendations: project?.features?.hasRecommendations ?? isLegacyGatehouse,
  };
}

async function recalcCompletedCounters(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_progress")
    .select(`
      id,
      assignments (
        branch_type,
        material_id,
        textbook_id,
        crossword_id
      )
    `)
    .eq("user_id", userId)
    .eq("is_completed", true);

  let olympiadCount = 0;
  let gatehouseCount = 0;

  for (const row of data || []) {
    const assignment = row.assignments;
    if (!assignment) continue;

    if (assignment.branch_type === "gatehouse") {
      gatehouseCount++;
    } else {
      olympiadCount++;
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
  // ✅ Используем requireUser() для единообразной проверки авторизации
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { supabase, user } = auth;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }

  if (!body?.assignmentId) {
    return NextResponse.json({ ok: false, error: "assignmentId required" }, { status: 400 });
  }

  // ─────────────────────────────────────────────────────────────
  // Дебаг-задания — ТОЛЬКО В РЕЖИМЕ РАЗРАБОТКИ
  // ─────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const debugIds = [
      "debug-all",
      "debug-review",
      "debug-perfect",
      "debug-mode-choice",
      "debug-gatehouse",
    ];
    if (
      debugIds.includes(body.assignmentId) ||
      body.assignmentId?.startsWith("debug-single-")
    ) {
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
  }

  if (!body.isCompleted) {
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }

  // ─────────────────────────────────────────────────────────────
  // Получение задания + данные проекта
  // ─────────────────────────────────────────────────────────────
  const { data: rawAssignment, error: assignmentErr } = await supabase
    .from("assignments")
    .select(`
      id,
      branch_type,
      material_id,
      textbook_id,
      crossword_id,
      content,
      assignment_type,
      material:materials(
        id,
        branch_type,
        project_tab_id,
        material_kind,
        target_levels,
        is_active,
        is_available,
        project_tabs ( projects ( id, slug, features ) )
      )
    `)
    .eq("id", body.assignmentId)
    .single();

  if (assignmentErr || !rawAssignment) {
    console.error("🔴 [API ASSIGNMENT-PROGRESS] Ошибка получения задания:", assignmentErr?.message);
    return NextResponse.json(
      { ok: false, error: assignmentErr?.message || "Assignment not found" },
      { status: 404 },
    );
  }

  const assignment = rawAssignment as AssignmentData;
  const projectConfig = getProjectConfig(assignment);

  // ─────────────────────────────────────────────────────────────
  // Проверка доступа
  // ─────────────────────────────────────────────────────────────
  try {
    if (projectConfig.slug === "gatehouse") {
      await assertGatehouseAssignmentAccess(supabase, user.id, assignment);
    } else {
      await assertOlympiadAssignmentAccess(supabase, user.id, assignment);
    }
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "Access denied" },
      { status: err.status || 403 },
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Оценка
  // ─────────────────────────────────────────────────────────────
  const assignmentType = assignment.assignment_type || "test";
  const isInformational = assignmentType === "intro" || assignment.content?.mode === "informational";

  let realScore: number | null = null;

  if (!isInformational) {
    const questions = assignment.content?.questions;
    if (!Array.isArray(questions)) {
      return NextResponse.json(
        { ok: false, error: "Некорректное содержимое" },
        { status: 500 },
      );
    }
    const { stats } = calcAndBuildReview(questions, body.answers);
    realScore = normalizeScore(stats.score, stats.pointsEarned, stats.pointsTotal);
  }

  const payload = {
    user_id: user.id,
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
    console.error("🔴 [ERROR] user_progress upsert failed:", upsertError.message);
    return NextResponse.json({ ok: false, error: upsertError.message }, { status: 500 });
  }

  const counters = await recalcCompletedCounters(supabase, user.id);

  let roadmapProgress: Record<string, unknown> | null = null;
  const materialIdForRoadmap = getMaterialId(assignment);
  if (materialIdForRoadmap && realScore !== null && !isInformational) {
    try {
      const { data: roadmapMaterial } = await supabase
        .from("materials")
        .select("material_kind")
        .eq("id", materialIdForRoadmap)
        .maybeSingle();

      if (roadmapMaterial?.material_kind === "roadmap") {
        const structure = await fetchRoadmapStructure(supabase, materialIdForRoadmap);
        const nodeMeta = findRoadmapNodeByAssignmentId(structure, body.assignmentId);
        if (nodeMeta) {
          roadmapProgress = await upsertRoadmapNodeProgress({
            supabase,
            userId: user.id,
            materialId: materialIdForRoadmap,
            nodeId: nodeMeta.nodeId,
            score: realScore,
            nodeType: nodeMeta.nodeType === "exam" ? "exam" : "lesson",
            passPercent: nodeMeta.passPercent,
          });
        }
      }
    } catch (roadmapError) {
      console.error("[assignment-progress] roadmap sync failed:", roadmapError);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Динамические модули
  // ─────────────────────────────────────────────────────────────
  let recommendation: any = null;
  let streak: any = null;

  if (projectConfig.hasRecommendations) {
    const materialId = getMaterialId(assignment);

    if (!isInformational && realScore !== null) {
      recommendation = recommendLevel({
        score: realScore,
        maxScore: 100,
        percent: realScore,
        materialLevels: getMaterialLevels(assignment),
      });
    }

    const { error: examErr } = await supabase
      .from("exam_results")
      .upsert(
        {
          user_id: user.id,
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
        },
        { onConflict: "user_id,assignment_id" },
      );

    if (examErr) console.error("🔴 [ERROR] exam_results upsert failed:", examErr.message);
  }

  if (projectConfig.hasStreaks) {
    // Серия засчитывается единственной RPC-функцией БД record_streak_completion.
    // Работает и для нового прохождения, и для перепрохождения любого задания:
    // логика зависит только от даты последнего засчитывания (см. миграцию).
    const { data: streakData, error: streakErr } = await supabase.rpc(
      "record_streak_completion",
      { _assignment_id: body.assignmentId },
    );
    if (!streakErr) streak = streakData ?? null;
    else console.error("🔴 [ERROR] record_streak_completion RPC failed:", streakErr.message);
  }

  return NextResponse.json(
    {
      ok: true,
      branch_type: projectConfig.slug,
      score: realScore,
      recommendation,
      streak,
      counters,
      roadmap: roadmapProgress,
    },
    { status: 200 },
  );
}