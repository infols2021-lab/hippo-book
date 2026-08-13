export const MATERIAL_ASSIGNMENTS_FORMAT = "hippo-book-material-assignments" as const;
export const MATERIAL_ASSIGNMENTS_VERSION = 1 as const;

export type MaterialAssignmentsMaterialMeta = {
  id: string;
  title: string;
  kind: "textbook" | "crossword" | "material";
  branch_type?: string;
  project_id?: string;
  project_tab_id?: string;
};

export type MaterialAssignmentExportItem = {
  id: string;
  title: string;
  order_index: number;
  assignment_type: "test" | "intro";
  content: Record<string, unknown>;
  created_at?: string | null;
};

export type MaterialAssignmentsExportPack = {
  format: typeof MATERIAL_ASSIGNMENTS_FORMAT;
  version: typeof MATERIAL_ASSIGNMENTS_VERSION;
  exported_at: string;
  material: MaterialAssignmentsMaterialMeta;
  assignments: MaterialAssignmentExportItem[];
};

export type MaterialAssignmentImportItem = {
  id?: string;
  title: string;
  order_index?: number;
  assignment_type?: "test" | "intro";
  content: Record<string, unknown>;
};

export type ParseImportResult =
  | { ok: true; pack: MaterialAssignmentsExportPack }
  | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeAssignmentType(value: unknown): "test" | "intro" {
  return value === "intro" ? "intro" : "test";
}

export function buildMaterialAssignmentsExportPack(input: {
  material: MaterialAssignmentsMaterialMeta;
  assignments: Array<{
    id: string;
    title: string;
    order_index?: number | null;
    assignment_type?: string | null;
    content?: unknown;
    created_at?: string | null;
  }>;
}): MaterialAssignmentsExportPack {
  return {
    format: MATERIAL_ASSIGNMENTS_FORMAT,
    version: MATERIAL_ASSIGNMENTS_VERSION,
    exported_at: new Date().toISOString(),
    material: {
      id: String(input.material.id),
      title: String(input.material.title ?? ""),
      kind: input.material.kind,
      branch_type: input.material.branch_type,
      project_id: input.material.project_id,
      project_tab_id: input.material.project_tab_id,
    },
    assignments: input.assignments.map((row) => ({
      id: String(row.id),
      title: String(row.title ?? "").trim(),
      order_index: Number.isFinite(Number(row.order_index)) ? Number(row.order_index) : 0,
      assignment_type: sanitizeAssignmentType(row.assignment_type),
      content: JSON.parse(JSON.stringify(row.content ?? {})) as Record<string, unknown>,
      created_at: row.created_at ?? null,
    })),
  };
}

export function parseMaterialAssignmentsImportPack(raw: unknown): ParseImportResult {
  if (!isObject(raw)) {
    return { ok: false, error: "Файл должен содержать JSON-объект" };
  }

  if (raw.format !== MATERIAL_ASSIGNMENTS_FORMAT) {
    return {
      ok: false,
      error: `Неизвестный формат файла. Ожидается "${MATERIAL_ASSIGNMENTS_FORMAT}"`,
    };
  }

  if (Number(raw.version) !== MATERIAL_ASSIGNMENTS_VERSION) {
    return {
      ok: false,
      error: `Неподдерживаемая версия файла: ${String(raw.version)}`,
    };
  }

  if (!isObject(raw.material) || !String(raw.material.id || "").trim()) {
    return { ok: false, error: "В файле отсутствует блок material.id" };
  }

  if (!Array.isArray(raw.assignments)) {
    return { ok: false, error: "В файле отсутствует массив assignments" };
  }

  const material = raw.material;
  const kind = String(material.kind || "material").trim().toLowerCase();
  const normalizedKind: MaterialAssignmentsMaterialMeta["kind"] =
    kind === "textbook" ? "textbook" : kind === "crossword" ? "crossword" : "material";

  const assignments: MaterialAssignmentExportItem[] = [];

  for (let i = 0; i < raw.assignments.length; i += 1) {
    const item = raw.assignments[i];
    if (!isObject(item)) {
      return { ok: false, error: `assignments[${i}] должен быть объектом` };
    }

    const title = String(item.title ?? "").trim();
    if (!title) {
      return { ok: false, error: `assignments[${i}]: пустой title` };
    }

    if (!isObject(item.content)) {
      return { ok: false, error: `assignments[${i}] "${title}": content должен быть объектом` };
    }

    const id = String(item.id ?? "").trim();
    if (!id) {
      return { ok: false, error: `assignments[${i}] "${title}": отсутствует id` };
    }

    assignments.push({
      id,
      title,
      order_index: Number.isFinite(Number(item.order_index)) ? Number(item.order_index) : 0,
      assignment_type: sanitizeAssignmentType(item.assignment_type),
      content: JSON.parse(JSON.stringify(item.content)) as Record<string, unknown>,
      created_at: typeof item.created_at === "string" ? item.created_at : null,
    });
  }

  return {
    ok: true,
    pack: {
      format: MATERIAL_ASSIGNMENTS_FORMAT,
      version: MATERIAL_ASSIGNMENTS_VERSION,
      exported_at: typeof raw.exported_at === "string" ? raw.exported_at : new Date().toISOString(),
      material: {
        id: String(material.id),
        title: String(material.title ?? ""),
        kind: normalizedKind,
        branch_type: material.branch_type ? String(material.branch_type) : undefined,
        project_id: material.project_id ? String(material.project_id) : undefined,
        project_tab_id: material.project_tab_id ? String(material.project_tab_id) : undefined,
      },
      assignments,
    },
  };
}

export function downloadMaterialAssignmentsPack(
  pack: MaterialAssignmentsExportPack,
  filename?: string
) {
  const safeTitle = pack.material.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const date = new Date().toISOString().slice(0, 10);
  const finalName = filename || `assignments-${safeTitle || pack.material.id}-${date}.json`;

  const blob = new Blob([JSON.stringify(pack, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = finalName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function materialMetaFromSelection(material: {
  id: string;
  title: string;
  kind: "textbook" | "crossword" | "material";
  branch_type?: string;
  project_id?: string;
  project_tab_id?: string;
}): MaterialAssignmentsMaterialMeta {
  return {
    id: String(material.id),
    title: String(material.title ?? ""),
    kind: material.kind,
    branch_type: material.branch_type,
    project_id: material.project_id,
    project_tab_id: material.project_tab_id,
  };
}
