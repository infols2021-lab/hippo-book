import { maxStarsForLessonNodes, sumStars } from "@/lib/roadmap/stars";
import type {
  RoadmapCourseUiState,
  RoadmapNodeProgressRow,
  RoadmapNodeUiState,
  RoadmapSegment,
  RoadmapSegmentUiState,
  RoadmapStructure,
} from "@/lib/roadmap/types";

function progressMap(rows: RoadmapNodeProgressRow[]): Map<string, RoadmapNodeProgressRow> {
  return new Map(rows.map((row) => [row.node_id, row]));
}

function lessonNodesFromBlock(segment: Extract<RoadmapSegment, { kind: "block" }>) {
  return (segment.nodes || []).filter((node) => node.type === "lesson");
}

function blockStars(
  segment: Extract<RoadmapSegment, { kind: "block" }>,
  progress: Map<string, RoadmapNodeProgressRow>,
) {
  const lessons = lessonNodesFromBlock(segment);
  const earned = sumStars(
    lessons.map((node) => progress.get(node.id)?.best_stars ?? 0),
  );
  const max = maxStarsForLessonNodes(lessons.length);
  return { earned, max };
}

function examNodePassed(
  nodeId: string,
  progress: Map<string, RoadmapNodeProgressRow>,
) {
  return Boolean(progress.get(nodeId)?.exam_passed);
}

export function buildRoadmapUiState(input: {
  materialId: string;
  title: string;
  description: string | null;
  structure: RoadmapStructure;
  progressRows: RoadmapNodeProgressRow[];
}): RoadmapCourseUiState {
  const progress = progressMap(input.progressRows);
  const segments: RoadmapSegmentUiState[] = [];
  let previousSegmentComplete = true;
  let globalOrder = 0;

  for (const segment of input.structure.segments || []) {
    if (segment.kind === "block") {
      const lessons = lessonNodesFromBlock(segment);
      const { earned, max } = blockStars(segment, progress);
      const unlocked: boolean = previousSegmentComplete;
      const completed: boolean = unlocked && earned >= Number(segment.stars_required || 0);

      const nodes: RoadmapNodeUiState[] = lessons.map((node) => {
        const row = progress.get(node.id);
        const bestStars = row?.best_stars ?? 0;
        const bestScore = row?.best_score ?? 0;
        const status: RoadmapNodeUiState["status"] = !unlocked
          ? "locked"
          : bestStars > 0 || Boolean(row?.exam_passed)
            ? "completed"
            : "available";

        return {
          id: node.id,
          type: node.type,
          title: node.title,
          segment_id: segment.id,
          segment_kind: "block",
          assignment_id: node.assignment_id ?? null,
          exam: null,
          status,
          best_stars: bestStars,
          best_score: bestScore,
          exam_passed: Boolean(row?.exam_passed),
          order_index: globalOrder++,
        };
      });

      segments.push({
        id: segment.id,
        kind: "block",
        title: segment.title,
        stars_required: Number(segment.stars_required || 0),
        stars_earned: earned,
        stars_max: max,
        unlocked,
        completed,
        nodes,
      });

      previousSegmentComplete = completed;
      continue;
    }

    if (segment.kind === "exam") {
      const node = segment.node;
      const row = progress.get(node.id);
      const passed = examNodePassed(node.id, progress);
      const unlocked = previousSegmentComplete;
      const completed = unlocked && passed;

      segments.push({
        id: segment.id,
        kind: "exam",
        title: segment.title,
        stars_required: segment.stars_required ?? null,
        stars_earned: 0,
        stars_max: 0,
        unlocked,
        completed,
        nodes: [
          {
            id: node.id,
            type: "exam",
            title: node.title,
            segment_id: segment.id,
            segment_kind: "exam",
            assignment_id: node.assignment_id ?? null,
            exam: node.exam ?? null,
            status: !unlocked ? "locked" : passed ? "completed" : "available",
            best_stars: row?.best_stars ?? 0,
            best_score: row?.best_score ?? 0,
            exam_passed: passed,
            order_index: globalOrder++,
          },
        ],
      });

      previousSegmentComplete = completed;
      continue;
    }

    if (segment.kind === "certificate") {
      const enabled = segment.enabled !== false;
      segments.push({
        id: segment.id,
        kind: "certificate",
        title: segment.title,
        stars_required: null,
        stars_earned: 0,
        stars_max: 0,
        unlocked: previousSegmentComplete && enabled,
        completed: previousSegmentComplete && enabled,
        nodes: [],
      });
      previousSegmentComplete = previousSegmentComplete && enabled;
    }
  }

  const totalStars = sumStars(
    segments
      .filter((segment) => segment.kind === "block")
      .map((segment) => segment.stars_earned),
  );
  const totalStarsMax = sumStars(
    segments
      .filter((segment) => segment.kind === "block")
      .map((segment) => segment.stars_max),
  );

  return {
    material_id: input.materialId,
    title: input.title,
    description: input.description,
    segments,
    total_stars: totalStars,
    total_stars_max: totalStarsMax,
  };
}
