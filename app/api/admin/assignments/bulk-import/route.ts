import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import {
  parseMaterialAssignmentsImportPack,
  type MaterialAssignmentsMaterialMeta,
} from "@/lib/assignments/materialAssignmentsPack";
import { validateBlocks, validateQuestions } from "@/app/(admin)/admin/assignments/builder/validate";
import type { NextRequest } from "next/server";

type ImportResultItem = {
  id: string;
  title: string;
  status: "updated" | "skipped" | "failed";
  message?: string;
};

function buildMaterialPayload(material: MaterialAssignmentsMaterialMeta) {
  const branch_type = String(material.branch_type || "olympiad").trim().toLowerCase();

  if (material.kind === "textbook") {
    return {
      branch_type: branch_type === "gatehouse" ? "gatehouse" : "olympiad",
      kind: "textbook" as const,
      material_id: null,
      textbook_id: material.id,
      crossword_id: null,
    };
  }

  if (material.kind === "crossword") {
    return {
      branch_type: branch_type === "gatehouse" ? "gatehouse" : "olympiad",
      kind: "crossword" as const,
      material_id: null,
      textbook_id: null,
      crossword_id: material.id,
    };
  }

  return {
    branch_type: branch_type === "gatehouse" ? "gatehouse" : branch_type === "demo" ? "olympiad" : branch_type,
    kind: "material" as const,
    material_id: material.id,
    textbook_id: null,
    crossword_id: null,
  };
}

function assignmentBelongsToMaterial(
  row: {
    material_id?: string | null;
    textbook_id?: string | null;
    crossword_id?: string | null;
  },
  material: MaterialAssignmentsMaterialMeta
) {
  if (material.kind === "textbook") {
    return String(row.textbook_id || "") === material.id;
  }
  if (material.kind === "crossword") {
    return String(row.crossword_id || "") === material.id;
  }
  return String(row.material_id || "") === material.id;
}

function validateAssignmentContent(content: Record<string, unknown>) {
  const mode = String(content.mode || "interactive").trim().toLowerCase();

  if (mode === "informational") {
    const blocks = Array.isArray(content.blocks) ? content.blocks : [];
    const result = validateBlocks(blocks as any);
    if (!result.ok) {
      return result.issues.map((issue) => issue.message).join("; ");
    }
    return null;
  }

  const questions = Array.isArray(content.questions) ? content.questions : [];
  const result = validateQuestions(questions as any);
  if (!result.ok) {
    return result.issues.map((issue) => issue.message).join("; ");
  }

  return null;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { supabase } = auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Bad JSON", 400, "BAD_JSON");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail("Body must be an object", 400, "VALIDATION");
  }

  const parsed = parseMaterialAssignmentsImportPack(body);
  if (!parsed.ok) {
    return fail(parsed.error, 400, "VALIDATION");
  }

  const expectedMaterialId = String((body as any).target_material_id || "").trim();
  const pack = parsed.pack;

  if (expectedMaterialId && expectedMaterialId !== pack.material.id) {
    return fail(
      "ID материала в файле не совпадает с выбранным материалом",
      400,
      "MATERIAL_MISMATCH"
    );
  }

  const materialPayload = buildMaterialPayload(pack.material);
  const results: ImportResultItem[] = [];
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of pack.assignments) {
    const { data: existing, error: loadError } = await supabase
      .from("assignments")
      .select("id, title, material_id, textbook_id, crossword_id")
      .eq("id", item.id)
      .maybeSingle();

    if (loadError) {
      failed += 1;
      results.push({
        id: item.id,
        title: item.title,
        status: "failed",
        message: loadError.message,
      });
      continue;
    }

    if (!existing) {
      skipped += 1;
      results.push({
        id: item.id,
        title: item.title,
        status: "skipped",
        message: "Задание с таким id не найдено в базе",
      });
      continue;
    }

    if (!assignmentBelongsToMaterial(existing, pack.material)) {
      skipped += 1;
      results.push({
        id: item.id,
        title: item.title,
        status: "skipped",
        message: "Задание принадлежит другому материалу",
      });
      continue;
    }

    const contentError = validateAssignmentContent(item.content);
    if (contentError) {
      failed += 1;
      results.push({
        id: item.id,
        title: item.title,
        status: "failed",
        message: contentError,
      });
      continue;
    }

    const safeContent = JSON.parse(JSON.stringify(item.content));
    const updatePayload = {
      title: item.title,
      order_index: item.order_index,
      assignment_type: item.assignment_type,
      content: safeContent,
      branch_type: materialPayload.branch_type,
      material_id: materialPayload.material_id,
      textbook_id: materialPayload.textbook_id,
      crossword_id: materialPayload.crossword_id,
    };

    const { error: updateError } = await supabase
      .from("assignments")
      .update(updatePayload)
      .eq("id", item.id);

    if (updateError) {
      failed += 1;
      results.push({
        id: item.id,
        title: item.title,
        status: "failed",
        message: updateError.message,
      });
      continue;
    }

    updated += 1;
    results.push({
      id: item.id,
      title: item.title,
      status: "updated",
    });
  }

  return ok({
    material_id: pack.material.id,
    total: pack.assignments.length,
    updated,
    skipped,
    failed,
    results,
  });
}
