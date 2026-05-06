import "server-only";

import type { DataAuthContext, DataAuthProfile } from "@/lib/data/auth";
import { loadOlympiadProfileProgressData, type OlympiadProfileProgressData } from "@/lib/data/olympiad";
import { loadGatehouseProfilePageData, type GatehouseProfilePageData } from "@/lib/data/gatehouse";
import { normalizeScore } from "@/lib/data/normalize";

export type ProfileStreakSnapshot = {
  current_streak?: number;
  longest_streak?: number;
  last_completed_date?: string | null;
  title?: string | null;
  icon?: string | null;
  [key: string]: unknown;
};

export type ProfileRecentAssignment = {
  id: string;
  assignment_id: string;
  title: string;
  branch_type: "olympiad" | "gatehouse";
  score: number | null;
  completed_at: string | null;
};

export type ProfilePageData = {
  profile: DataAuthProfile | null;
  olympiad: OlympiadProfileProgressData | null;
  gatehouse: GatehouseProfilePageData | null;
  streak: ProfileStreakSnapshot | null;
  recentAssignments: ProfileRecentAssignment[];
  errors: {
    olympiad?: string;
    gatehouse?: string;
    streak?: string;
    recentAssignments?: string;
  };
};

function safeErrorMessage(error: unknown) {
  return String((error as any)?.message || error || "Unknown error");
}

function normalizeRecentAssignment(row: any): ProfileRecentAssignment {
  const assignment = row?.assignments;

  return {
    id: String(row?.id ?? row?.assignment_id ?? ""),
    assignment_id: String(row?.assignment_id ?? assignment?.id ?? ""),
    title: String(assignment?.title ?? "Задание"),
    branch_type: assignment?.branch_type === "gatehouse" ? "gatehouse" : "olympiad",
    score: normalizeScore(row?.score),
    completed_at: typeof row?.completed_at === "string" ? row.completed_at : null,
  };
}

export async function loadProfileStreakSnapshot(ctx: DataAuthContext): Promise<ProfileStreakSnapshot | null> {
  const { supabase } = ctx;

  const { data, error } = await supabase.rpc("get_my_streak_snapshot");

  if (error) {
    throw new Error(error.message);
  }

  if (!data || typeof data !== "object") return null;

  return data as ProfileStreakSnapshot;
}

export async function loadRecentAssignments(ctx: DataAuthContext, limit = 8): Promise<ProfileRecentAssignment[]> {
  const { supabase, user } = ctx;

  const { data, error } = await supabase
    .from("user_progress")
    .select(
      `
      id,
      assignment_id,
      score,
      completed_at,
      assignments(
        id,
        title,
        branch_type
      )
    `,
    )
    .eq("user_id", user.id)
    .eq("is_completed", true)
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return Array.isArray(data) ? data.map(normalizeRecentAssignment) : [];
}

export async function loadProfilePageData(ctx: DataAuthContext): Promise<ProfilePageData> {
  const [olympiadResult, gatehouseResult, streakResult, recentResult] = await Promise.allSettled([
    loadOlympiadProfileProgressData(ctx),
    loadGatehouseProfilePageData(ctx),
    loadProfileStreakSnapshot(ctx),
    loadRecentAssignments(ctx),
  ]);

  const errors: ProfilePageData["errors"] = {};

  if (olympiadResult.status === "rejected") {
    errors.olympiad = safeErrorMessage(olympiadResult.reason);
  }

  if (gatehouseResult.status === "rejected") {
    errors.gatehouse = safeErrorMessage(gatehouseResult.reason);
  }

  if (streakResult.status === "rejected") {
    errors.streak = safeErrorMessage(streakResult.reason);
  }

  if (recentResult.status === "rejected") {
    errors.recentAssignments = safeErrorMessage(recentResult.reason);
  }

  return {
    profile: ctx.profile,
    olympiad: olympiadResult.status === "fulfilled" ? olympiadResult.value : null,
    gatehouse: gatehouseResult.status === "fulfilled" ? gatehouseResult.value : null,
    streak: streakResult.status === "fulfilled" ? streakResult.value : null,
    recentAssignments: recentResult.status === "fulfilled" ? recentResult.value : [],
    errors,
  };
}

export async function loadProfileHeaderData(ctx: DataAuthContext) {
  const streak = await loadProfileStreakSnapshot(ctx).catch(() => null);

  return {
    profile: ctx.profile,
    user: {
      id: ctx.user.id,
      email: ctx.user.email ?? ctx.profile?.email ?? "",
    },
    streak,
  };
}

export async function updateOwnProfile(
  ctx: DataAuthContext,
  payload: {
    full_name?: string;
    contact_phone?: string;
    region?: string;
  },
) {
  const { supabase, user } = ctx;

  const updatePayload: Record<string, string | null> = {};

  if ("full_name" in payload) updatePayload.full_name = payload.full_name?.trim() || null;
  if ("contact_phone" in payload) updatePayload.contact_phone = payload.contact_phone?.trim() || null;
  if ("region" in payload) updatePayload.region = payload.region?.trim() || null;

  const { data, error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", user.id)
    .select(
      `
      id,
      email,
      full_name,
      contact_phone,
      region,
      is_admin,
      completed_assignments_count,
      ga_completed_assignments_count
    `,
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}