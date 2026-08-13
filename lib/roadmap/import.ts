import {
  ROADMAP_PACK_FORMAT,
  ROADMAP_PACK_VERSION,
  type RoadmapImportPack,
  type RoadmapNodeDef,
  type RoadmapSegment,
  type RoadmapStructure,
} from "@/lib/roadmap/types";

export type RoadmapValidationIssue = {
  path: string;
  message: string;
};

export type RoadmapValidationResult =
  | { ok: true; pack: RoadmapImportPack; structure: RoadmapStructure }
  | { ok: false; issues: RoadmapValidationIssue[] };

const NODE_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const SEGMENT_ID_RE = NODE_ID_RE;

function issue(path: string, message: string): RoadmapValidationIssue {
  return { path, message };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeNode(raw: unknown, path: string, issues: RoadmapValidationIssue[]): RoadmapNodeDef | null {
  const obj = asObject(raw);
  if (!obj) {
    issues.push(issue(path, "Узел должен быть объектом"));
    return null;
  }

  const id = String(obj.id ?? "").trim();
  const type = String(obj.type ?? "").trim() as RoadmapNodeDef["type"];
  const title = String(obj.title ?? "").trim();

  if (!id || !NODE_ID_RE.test(id)) {
    issues.push(issue(`${path}.id`, "Некорректный id узла"));
  }
  if (!["lesson", "exam", "certificate"].includes(type)) {
    issues.push(issue(`${path}.type`, "type должен быть lesson, exam или certificate"));
  }
  if (!title) {
    issues.push(issue(`${path}.title`, "title обязателен"));
  }

  const assignmentId = obj.assignment_id != null ? String(obj.assignment_id).trim() : null;
  const assignment = asObject(obj.assignment);
  const exam = asObject(obj.exam);

  if (type === "lesson" && !assignmentId && !assignment) {
    issues.push(issue(path, "lesson требует assignment или assignment_id"));
  }

  if (type === "exam") {
    if (!exam) {
      issues.push(issue(`${path}.exam`, "exam конфиг обязателен"));
    } else {
      const timeLimit = Number(exam.time_limit_sec);
      const passPercent = Number(exam.pass_percent);
      if (!Number.isFinite(timeLimit) || timeLimit <= 0) {
        issues.push(issue(`${path}.exam.time_limit_sec`, "time_limit_sec должен быть > 0"));
      }
      if (!Number.isFinite(passPercent) || passPercent <= 0 || passPercent > 100) {
        issues.push(issue(`${path}.exam.pass_percent`, "pass_percent должен быть 1..100"));
      }
    }
    if (!assignmentId && !assignment) {
      issues.push(issue(path, "exam требует assignment или assignment_id"));
    }
  }

  return {
    id,
    type,
    title,
    order_index: Number.isFinite(Number(obj.order_index)) ? Number(obj.order_index) : undefined,
    assignment_id: assignmentId,
    assignment: assignment
      ? {
          title: assignment.title != null ? String(assignment.title) : undefined,
          assignment_type:
            String(assignment.assignment_type ?? "test").trim() === "intro" ? "intro" : "test",
          order_index: Number.isFinite(Number(assignment.order_index))
            ? Number(assignment.order_index)
            : undefined,
          content: asObject(assignment.content) ?? {},
        }
      : null,
    exam: exam
      ? {
          time_limit_sec: Number(exam.time_limit_sec),
          pass_percent: Number(exam.pass_percent),
          unlimited_attempts: exam.unlimited_attempts !== false,
        }
      : null,
  };
}

function normalizeSegment(raw: unknown, index: number, issues: RoadmapValidationIssue[]): RoadmapSegment | null {
  const obj = asObject(raw);
  const path = `segments[${index}]`;
  if (!obj) {
    issues.push(issue(path, "Сегмент должен быть объектом"));
    return null;
  }

  const kind = String(obj.kind ?? "").trim();
  const id = String(obj.id ?? "").trim();
  const title = String(obj.title ?? "").trim();

  if (!id || !SEGMENT_ID_RE.test(id)) {
    issues.push(issue(`${path}.id`, "Некорректный id сегмента"));
  }
  if (!title) {
    issues.push(issue(`${path}.title`, "title обязателен"));
  }

  if (kind === "block") {
    const starsRequired = Number(obj.stars_required);
    if (!Number.isFinite(starsRequired) || starsRequired < 0) {
      issues.push(issue(`${path}.stars_required`, "stars_required должен быть >= 0"));
    }

    const nodesRaw = Array.isArray(obj.nodes) ? obj.nodes : [];
    if (nodesRaw.length === 0) {
      issues.push(issue(`${path}.nodes`, "block должен содержать nodes"));
    }

    const nodes: RoadmapNodeDef[] = [];
    nodesRaw.forEach((nodeRaw, nodeIndex) => {
      const node = normalizeNode(nodeRaw, `${path}.nodes[${nodeIndex}]`, issues);
      if (node) nodes.push(node);
    });

    return {
      kind: "block",
      id,
      title,
      stars_required: Number.isFinite(starsRequired) ? starsRequired : 0,
      nodes,
    };
  }

  if (kind === "exam") {
    const node = normalizeNode(obj.node, `${path}.node`, issues);
    if (!node) {
      issues.push(issue(`${path}.node`, "exam сегмент требует node"));
      return null;
    }
    if (node.type !== "exam") {
      issues.push(issue(`${path}.node.type`, "node.type должен быть exam"));
    }

    return {
      kind: "exam",
      id,
      title,
      stars_required:
        obj.stars_required == null ? undefined : Number(obj.stars_required),
      node: { ...node, type: "exam" },
    };
  }

  if (kind === "certificate") {
    return {
      kind: "certificate",
      id,
      title,
      enabled: obj.enabled !== false,
    };
  }

  issues.push(issue(`${path}.kind`, "kind должен быть block, exam или certificate"));
  return null;
}

export function parseRoadmapImportPack(raw: unknown): RoadmapValidationResult {
  const issues: RoadmapValidationIssue[] = [];
  const obj = asObject(raw);

  if (!obj) {
    return { ok: false, issues: [issue("$", "JSON должен быть объектом")] };
  }

  const format = String(obj.format ?? "").trim();
  const version = Number(obj.version);

  if (format !== ROADMAP_PACK_FORMAT) {
    issues.push(issue("format", `Ожидается ${ROADMAP_PACK_FORMAT}`));
  }
  if (version !== ROADMAP_PACK_VERSION) {
    issues.push(issue("version", `Ожидается version ${ROADMAP_PACK_VERSION}`));
  }

  const segmentsRaw = Array.isArray(obj.segments) ? obj.segments : [];
  if (segmentsRaw.length === 0) {
    issues.push(issue("segments", "Нужен минимум один сегмент"));
  }

  const segments: RoadmapSegment[] = [];
  segmentsRaw.forEach((segmentRaw, index) => {
    const segment = normalizeSegment(segmentRaw, index, issues);
    if (segment) segments.push(segment);
  });

  const ids = new Set<string>();
  for (const segment of segments) {
    if (ids.has(segment.id)) {
      issues.push(issue("segments", `Дублирующийся id сегмента: ${segment.id}`));
    }
    ids.add(segment.id);

    if (segment.kind === "block") {
      for (const node of segment.nodes) {
        if (ids.has(node.id)) {
          issues.push(issue("segments", `Дублирующийся id узла: ${node.id}`));
        }
        ids.add(node.id);
      }
    }

    if (segment.kind === "exam") {
      if (ids.has(segment.node.id)) {
        issues.push(issue("segments", `Дублирующийся id узла: ${segment.node.id}`));
      }
      ids.add(segment.node.id);
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const structure: RoadmapStructure = {
    format: ROADMAP_PACK_FORMAT,
    version: ROADMAP_PACK_VERSION,
    title: obj.title != null ? String(obj.title) : undefined,
    description: obj.description != null ? String(obj.description) : undefined,
    segments,
  };

  const pack: RoadmapImportPack = {
    ...structure,
    material: (() => {
      const materialObj = asObject(obj.material);
      if (!materialObj) return undefined;
      return {
        title: materialObj.title != null ? String(materialObj.title) : undefined,
        description:
          materialObj.description != null ? String(materialObj.description) : undefined,
        cover_image_url:
          materialObj.cover_image_url != null
            ? String(materialObj.cover_image_url)
            : undefined,
      };
    })(),
  };

  return { ok: true, pack, structure };
}

export function collectInlineAssignments(structure: RoadmapStructure) {
  const items: Array<{
    nodeId: string;
    nodeTitle: string;
    nodeType: RoadmapNodeDef["type"];
    assignment: NonNullable<RoadmapNodeDef["assignment"]>;
  }> = [];

  for (const segment of structure.segments) {
    if (segment.kind === "block") {
      for (const node of segment.nodes) {
        if (node.assignment) {
          items.push({
            nodeId: node.id,
            nodeTitle: node.title,
            nodeType: node.type,
            assignment: node.assignment,
          });
        }
      }
    }

    if (segment.kind === "exam" && segment.node.assignment) {
      items.push({
        nodeId: segment.node.id,
        nodeTitle: segment.node.title,
        nodeType: "exam",
        assignment: segment.node.assignment,
      });
    }
  }

  return items;
}

export function attachAssignmentIds(
  structure: RoadmapStructure,
  assignmentIdsByNode: Record<string, string>,
): RoadmapStructure {
  const segments = structure.segments.map((segment) => {
    if (segment.kind === "block") {
      return {
        ...segment,
        nodes: segment.nodes.map((node) => ({
          ...node,
          assignment_id: assignmentIdsByNode[node.id] ?? node.assignment_id ?? null,
          assignment: null,
        })),
      };
    }

    if (segment.kind === "exam") {
      return {
        ...segment,
        node: {
          ...segment.node,
          assignment_id: assignmentIdsByNode[segment.node.id] ?? segment.node.assignment_id ?? null,
          assignment: null,
        },
      };
    }

    return segment;
  });

  return {
    ...structure,
    segments,
  };
}
