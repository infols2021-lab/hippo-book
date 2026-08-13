import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import { isValidUUID } from "@/lib/api/validate";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  attachAssignmentIds,
  collectInlineAssignments,
  parseRoadmapImportPack,
} from "@/lib/roadmap/import";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreInit(): ResponseInit {
  return { headers: { "cache-control": "no-store, max-age=0" } };
}

async function readParams(ctx: { params: Promise<{ materialId: string }> }) {
  return ctx.params;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ materialId: string }> },
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { materialId } = await readParams(ctx);
  if (!isValidUUID(materialId)) {
    return fail("Invalid material id", 400, "VALIDATION", noStoreInit());
  }

  const { supabase, user } = auth;
  const adminDb = getSupabaseAdminClient();

  const [{ data: material, error: materialError }, { data: roadmap, error: roadmapError }] =
    await Promise.all([
      supabase.from("materials").select("id, title, material_kind").eq("id", materialId).maybeSingle(),
      adminDb.from("roadmap_courses").select("structure, version, updated_at").eq("material_id", materialId).maybeSingle(),
    ]);

  if (materialError) return fail(materialError.message, 500, "DB_ERROR", noStoreInit());
  if (!material) return fail("Material not found", 404, "NOT_FOUND", noStoreInit());
  if (roadmapError) return fail(roadmapError.message, 500, "DB_ERROR", noStoreInit());

  return ok(
    {
      material,
      roadmap: roadmap ?? null,
    },
    noStoreInit(),
  );
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ materialId: string }> },
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { materialId } = await readParams(ctx);
  if (!isValidUUID(materialId)) {
    return fail("Invalid material id", 400, "VALIDATION", noStoreInit());
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Bad JSON", 400, "BAD_JSON", noStoreInit());
  }

  const parsed = parseRoadmapImportPack(body);
  if (!parsed.ok) {
    return fail(
      parsed.issues.map((item) => `${item.path}: ${item.message}`).join("; "),
      400,
      "VALIDATION",
      noStoreInit(),
    );
  }

  const { supabase, user } = auth;
  const adminDb = getSupabaseAdminClient();

  const { data: material, error: materialError } = await adminDb
    .from("materials")
    .select("id, branch_type, project_tab_id")
    .eq("id", materialId)
    .maybeSingle();

  if (materialError) return fail(materialError.message, 500, "DB_ERROR", noStoreInit());
  if (!material) return fail("Material not found", 404, "NOT_FOUND", noStoreInit());

  const inlineAssignments = collectInlineAssignments(parsed.structure);
  const assignmentIdsByNode: Record<string, string> = {};
  let orderCounter = 0;

  for (const item of inlineAssignments) {
    const assignmentType = item.assignment.assignment_type === "intro" ? "intro" : "test";
    const title = String(item.assignment.title || item.nodeTitle || "Задание").trim();
    const orderIndex =
      Number.isFinite(Number(item.assignment.order_index))
        ? Number(item.assignment.order_index)
        : orderCounter++;

    const payload = {
      title,
      order_index: orderIndex,
      assignment_type: assignmentType,
      content: item.assignment.content,
      material_id: materialId,
      branch_type: material.branch_type ?? "olympiad",
      project_tab_id: material.project_tab_id ?? null,
      created_by: user.id,
    };

    const { data: created, error: createError } = await adminDb
      .from("assignments")
      .insert(payload)
      .select("id")
      .single();

    if (createError) {
      return fail(createError.message, 500, "ASSIGNMENT_CREATE_FAILED", noStoreInit());
    }

    assignmentIdsByNode[item.nodeId] = String(created.id);
  }

  for (const segment of parsed.structure.segments) {
    if (segment.kind !== "block") continue;
    for (const node of segment.nodes) {
      if (node.assignment_id && !assignmentIdsByNode[node.id]) {
        assignmentIdsByNode[node.id] = node.assignment_id;
      }
    }
    continue;
  }

  for (const segment of parsed.structure.segments) {
    if (segment.kind !== "exam") continue;
    if (segment.node.assignment_id && !assignmentIdsByNode[segment.node.id]) {
      assignmentIdsByNode[segment.node.id] = segment.node.assignment_id;
    }
  }

  const finalStructure = attachAssignmentIds(parsed.structure, assignmentIdsByNode);

  const materialPatch: Record<string, unknown> = {
    material_kind: "roadmap",
  };

  if (parsed.pack.material?.title) materialPatch.title = parsed.pack.material.title;
  if (parsed.pack.material?.description != null) {
    materialPatch.description = parsed.pack.material.description;
  }
  if (parsed.pack.material?.cover_image_url != null) {
    materialPatch.cover_image_url = parsed.pack.material.cover_image_url;
  }

  const { error: materialUpdateError } = await adminDb
    .from("materials")
    .update(materialPatch)
    .eq("id", materialId);

  if (materialUpdateError) {
    return fail(materialUpdateError.message, 500, "MATERIAL_UPDATE_FAILED", noStoreInit());
  }

  const { error: roadmapError } = await adminDb.from("roadmap_courses").upsert(
    {
      material_id: materialId,
      structure: finalStructure,
      version: finalStructure.version,
    },
    { onConflict: "material_id" },
  );

  if (roadmapError) {
    return fail(roadmapError.message, 500, "ROADMAP_SAVE_FAILED", noStoreInit());
  }

  return ok(
    {
      imported: true,
      material_id: materialId,
      assignments_created: Object.keys(assignmentIdsByNode).length,
      structure: finalStructure,
    },
    noStoreInit(),
  );
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ materialId: string }> },
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { materialId } = await readParams(ctx);
  if (!isValidUUID(materialId)) {
    return fail("Invalid material id", 400, "VALIDATION", noStoreInit());
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Bad JSON", 400, "BAD_JSON", noStoreInit());
  }

  const parsed = parseRoadmapImportPack(body, { allowUnlinkedAssignments: true });
  if (!parsed.ok) {
    return fail(
      parsed.issues.map((item) => `${item.path}: ${item.message}`).join("; "),
      400,
      "VALIDATION",
      noStoreInit(),
    );
  }

  const adminDb = getSupabaseAdminClient();

  const { data: material, error: materialError } = await adminDb
    .from("materials")
    .select("id")
    .eq("id", materialId)
    .maybeSingle();

  if (materialError) return fail(materialError.message, 500, "DB_ERROR", noStoreInit());
  if (!material) return fail("Material not found", 404, "NOT_FOUND", noStoreInit());

  const finalStructure = attachAssignmentIds(parsed.structure, {});

  const { error: roadmapError } = await adminDb.from("roadmap_courses").upsert(
    {
      material_id: materialId,
      structure: finalStructure,
      version: finalStructure.version,
    },
    { onConflict: "material_id" },
  );

  if (roadmapError) {
    return fail(roadmapError.message, 500, "ROADMAP_SAVE_FAILED", noStoreInit());
  }

  return ok(
    {
      saved: true,
      material_id: materialId,
      structure: finalStructure,
    },
    noStoreInit(),
  );
}
