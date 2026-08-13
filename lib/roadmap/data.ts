import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { scoreToStars } from "@/lib/roadmap/stars";
import type { RoadmapNodeProgressRow, RoadmapStructure } from "@/lib/roadmap/types";

export async function fetchRoadmapStructure(
  supabase: SupabaseClient,
  materialId: string,
): Promise<RoadmapStructure | null> {
  const { data, error } = await supabase
    .from("roadmap_courses")
    .select("structure")
    .eq("material_id", materialId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.structure || typeof data.structure !== "object") return null;
  return data.structure as RoadmapStructure;
}

export async function fetchRoadmapProgress(
  supabase: SupabaseClient,
  userId: string,
  materialId: string,
): Promise<RoadmapNodeProgressRow[]> {
  const { data, error } = await supabase
    .from("user_roadmap_node_progress")
    .select("node_id, best_stars, best_score, exam_passed, attempts_count, completed_at")
    .eq("user_id", userId)
    .eq("material_id", materialId);

  if (error) throw error;
  return (data ?? []) as RoadmapNodeProgressRow[];
}

export async function upsertRoadmapNodeProgress(input: {
  supabase: SupabaseClient;
  userId: string;
  materialId: string;
  nodeId: string;
  score: number;
  nodeType: "lesson" | "exam";
  passPercent?: number;
}) {
  const stars = scoreToStars(input.score);
  const now = new Date().toISOString();

  const { data: existing, error: readError } = await input.supabase
    .from("user_roadmap_node_progress")
    .select("best_stars, best_score, exam_passed, attempts_count")
    .eq("user_id", input.userId)
    .eq("material_id", input.materialId)
    .eq("node_id", input.nodeId)
    .maybeSingle();

  if (readError) throw readError;

  const previousStars = Number(existing?.best_stars ?? 0);
  const previousScore = Number(existing?.best_score ?? 0);
  const attempts = Number(existing?.attempts_count ?? 0) + 1;

  const nextStars = Math.max(previousStars, stars);
  const nextScore = Math.max(previousScore, Math.round(input.score));

  let examPassed = Boolean(existing?.exam_passed);
  if (input.nodeType === "exam") {
    const threshold = Number(input.passPercent ?? 80);
    if (input.score >= threshold) {
      examPassed = true;
    }
  }

  const payload = {
    user_id: input.userId,
    material_id: input.materialId,
    node_id: input.nodeId,
    best_stars: input.nodeType === "lesson" ? nextStars : previousStars,
    best_score: nextScore,
    exam_passed: examPassed,
    attempts_count: attempts,
    completed_at: nextStars > 0 || examPassed ? now : existing ? undefined : null,
    updated_at: now,
  };

  const { error } = await input.supabase
    .from("user_roadmap_node_progress")
    .upsert(payload, { onConflict: "user_id,material_id,node_id" });

  if (error) throw error;

  return {
    best_stars: payload.best_stars,
    best_score: payload.best_score,
    exam_passed: payload.exam_passed,
  };
}

export function findRoadmapNodeMeta(structure: RoadmapStructure | null, nodeId: string) {
  if (!structure) return null;

  for (const segment of structure.segments) {
    if (segment.kind === "block") {
      const node = segment.nodes.find((item) => item.id === nodeId);
      if (node) {
        return {
          node,
          nodeType: node.type,
          passPercent: node.exam?.pass_percent,
        };
      }
    }

    if (segment.kind === "exam" && segment.node.id === nodeId) {
      return {
        node: segment.node,
        nodeType: "exam" as const,
        passPercent: segment.node.exam?.pass_percent,
      };
    }
  }

  return null;
}

export function findRoadmapNodeByAssignmentId(
  structure: RoadmapStructure | null,
  assignmentId: string,
) {
  if (!structure) return null;

  for (const segment of structure.segments) {
    if (segment.kind === "block") {
      const node = segment.nodes.find((item) => item.assignment_id === assignmentId);
      if (node) return { nodeId: node.id, nodeType: node.type, passPercent: node.exam?.pass_percent };
    }

    if (segment.kind === "exam" && segment.node.assignment_id === assignmentId) {
      return {
        nodeId: segment.node.id,
        nodeType: "exam" as const,
        passPercent: segment.node.exam?.pass_percent,
      };
    }
  }

  return null;
}
