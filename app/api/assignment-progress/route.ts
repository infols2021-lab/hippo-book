import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recommendGatehouseLevel } from "@/lib/exams/recommendLevel";

type Body = {
  assignmentId: string;
  answers: any;
  isCompleted: boolean;
  score: number;
  source?: string;
  sourceId?: string;
  branchType?: string;
};

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

function isGatehouseAssignment(assignment: any, body: Body) {
  const material = firstOrNull(assignment?.materials);

  return (
    body.branchType === "gatehouse" ||
    body.source === "gatehouse" ||
    body.source === "gatehouse-material" ||
    assignment?.branch_type === "gatehouse" ||
    material?.branch_type === "gatehouse"
  );
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

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: auth, error: authErr } = await supabase.auth.getUser();

  if (authErr) return NextResponse.json({ ok: false, error: "Auth fetch failed" }, { status: 500 });
  if (!auth.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }

  if (!body?.assignmentId) {
    return NextResponse.json({ ok: false, error: "assignmentId required" }, { status: 400 });
  }

  if (!body.isCompleted) {
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }

  const safeScore = normalizeScore(body.score);

  const { data: assignment, error: assignmentErr } = await supabase
    .from("assignments")
    .select(
      `id,
      branch_type,
      material_id,
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
      { status: 404 },
    );
  }

  const gatehouse = isGatehouseAssignment(assignment, body);
  const material = firstOrNull((assignment as any).materials);
  const materialId = getMaterialId(assignment);

  if (gatehouse) {
    if (!materialId) {
      return NextResponse.json({ ok: false, error: "Gatehouse assignment has no material" }, { status: 400 });
    }

    if (material?.is_active === false) {
      return NextResponse.json({ ok: false, error: "Material is not active" }, { status: 404 });
    }

    const { data: access, error: accessErr } = await supabase
      .from("material_access")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("material_id", materialId)
      .maybeSingle();

    if (accessErr) {
      return NextResponse.json({ ok: false, error: accessErr.message }, { status: 500 });
    }

    const hasAccess = Boolean(material?.is_available || access);

    if (!hasAccess) {
      return NextResponse.json({ ok: false, error: "No access to this Gatehouse material" }, { status: 403 });
    }
  }

  const payload = {
    user_id: auth.user.id,
    assignment_id: body.assignmentId,
    answers: body.answers ?? {},
    is_completed: true,
    completed_at: new Date().toISOString(),
    score: safeScore,
  };

  const { data: existing, error: exErr } = await supabase
    .from("user_progress")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("assignment_id", body.assignmentId)
    .maybeSingle();

  if (exErr) {
    return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 });
  }

  const res = existing?.id
    ? await supabase.from("user_progress").update(payload).eq("id", existing.id)
    : await supabase.from("user_progress").insert(payload);

  if (res.error) {
    return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
  }

  const counters = await recalcCompletedCounters(supabase, auth.user.id);

  if (gatehouse) {
    const recommendation = recommendGatehouseLevel({
      score: safeScore,
      maxScore: 100,
      percent: safeScore,
      materialLevels: getMaterialLevels(assignment),
    });

    const examResultPayload = {
      user_id: auth.user.id,
      assignment_id: body.assignmentId,
      material_id: materialId,
      score: safeScore,
      recommended_level: recommendation.recommendedLevel,
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
      .upsert(examResultPayload, {
        onConflict: "user_id,assignment_id",
      });

    if (examErr) {
      console.error("exam_results upsert error:", examErr.message);
    }

    return NextResponse.json(
      {
        ok: true,
        branch_type: "gatehouse",
        recommendation,
        counters,
      },
      { status: 200 },
    );
  }

  let streak: any = null;
  const { data: streakData, error: streakErr } = await supabase.rpc("record_streak_completion", {
    _assignment_id: body.assignmentId,
  });

  if (!streakErr) {
    streak = streakData ?? null;
  } else {
    console.error("record_streak_completion RPC error:", streakErr.message);
  }

  return NextResponse.json(
    {
      ok: true,
      branch_type: "olympiad",
      streak,
      counters,
    },
    { status: 200 },
  );
}