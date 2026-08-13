export const ROADMAP_PACK_FORMAT = "hippo-book-roadmap" as const;
export const ROADMAP_PACK_VERSION = 1 as const;

export type RoadmapNodeType = "lesson" | "exam" | "certificate";

export type RoadmapExamConfig = {
  time_limit_sec: number;
  pass_percent: number;
  unlimited_attempts?: boolean;
};

export type RoadmapAssignmentInline = {
  title?: string;
  assignment_type?: "test" | "intro";
  order_index?: number;
  content: Record<string, unknown>;
};

export type RoadmapNodeDef = {
  id: string;
  type: RoadmapNodeType;
  title: string;
  order_index?: number;
  assignment_id?: string | null;
  assignment?: RoadmapAssignmentInline | null;
  exam?: RoadmapExamConfig | null;
};

export type RoadmapBlockSegment = {
  kind: "block";
  id: string;
  title: string;
  stars_required: number;
  nodes: RoadmapNodeDef[];
};

export type RoadmapExamSegment = {
  kind: "exam";
  id: string;
  title: string;
  stars_required?: number;
  node: RoadmapNodeDef;
};

export type RoadmapCertificateSegment = {
  kind: "certificate";
  id: string;
  title: string;
  enabled?: boolean;
};

export type RoadmapSegment =
  | RoadmapBlockSegment
  | RoadmapExamSegment
  | RoadmapCertificateSegment;

export type RoadmapStructure = {
  format: typeof ROADMAP_PACK_FORMAT;
  version: typeof ROADMAP_PACK_VERSION;
  title?: string;
  description?: string;
  segments: RoadmapSegment[];
};

export type RoadmapImportPack = RoadmapStructure & {
  material?: {
    title?: string;
    description?: string;
    cover_image_url?: string;
  };
};

export type RoadmapNodeProgressRow = {
  node_id: string;
  best_stars: number;
  best_score: number;
  exam_passed: boolean;
  attempts_count: number;
  completed_at: string | null;
};

export type RoadmapNodeUiState = {
  id: string;
  type: RoadmapNodeType;
  title: string;
  segment_id: string;
  segment_kind: RoadmapSegment["kind"];
  assignment_id: string | null;
  exam: RoadmapExamConfig | null;
  status: "locked" | "available" | "completed";
  best_stars: number;
  best_score: number;
  exam_passed: boolean;
  order_index: number;
};

export type RoadmapSegmentUiState = {
  id: string;
  kind: RoadmapSegment["kind"];
  title: string;
  stars_required: number | null;
  stars_earned: number;
  stars_max: number;
  unlocked: boolean;
  completed: boolean;
  nodes: RoadmapNodeUiState[];
};

export type RoadmapCourseUiState = {
  material_id: string;
  title: string;
  description: string | null;
  segments: RoadmapSegmentUiState[];
  total_stars: number;
  total_stars_max: number;
};
