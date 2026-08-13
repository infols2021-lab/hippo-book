import { ok, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { isValidUUID } from "@/lib/api/validate";
import {
  findRoadmapNodeMeta,
  fetchRoadmapProgress,
  fetchRoadmapStructure,
} from "@/lib/roadmap/data";
import { buildRoadmapUiState } from "@/lib/roadmap/unlock";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreInit(): ResponseInit {
  return { headers: { "cache-control": "no-store, max-age=0" } };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ materialId: string }> },
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { materialId } = await ctx.params;
  const nodeId = req.nextUrl.searchParams.get("nodeId")?.trim() ?? "";

  if (!isValidUUID(materialId)) {
    return fail("Invalid material id", 400, "VALIDATION", noStoreInit());
  }
  if (!nodeId) {
    return fail("nodeId is required", 400, "VALIDATION", noStoreInit());
  }

  const { supabase, user } = auth;

  const { data: material, error: materialError } = await supabase
    .from("materials")
    .select("id, title, material_kind, is_active, is_available, is_demo")
    .eq("id", materialId)
    .maybeSingle();

  if (materialError) return fail(materialError.message, 500, "DB_ERROR", noStoreInit());
  if (!material || material.is_active === false || material.material_kind !== "roadmap") {
    return fail("Material not found", 404, "NOT_FOUND", noStoreInit());
  }

  let hasAccess = Boolean(material.is_available || material.is_demo);
  if (!hasAccess) {
    const { data: access } = await supabase
      .from("material_access")
      .select("id")
      .eq("user_id", user.id)
      .eq("material_id", materialId)
      .maybeSingle();
    hasAccess = Boolean(access);
  }

  if (!hasAccess) {
    return fail("Access denied", 403, "FORBIDDEN", noStoreInit());
  }

  const structure = await fetchRoadmapStructure(supabase, materialId);
  if (!structure) {
    return fail("Roadmap is not configured", 404, "ROADMAP_NOT_CONFIGURED", noStoreInit());
  }

  const meta = findRoadmapNodeMeta(structure, nodeId);
  if (!meta || meta.nodeType !== "exam" || !meta.node.exam) {
    return fail("Exam node not found", 404, "NOT_FOUND", noStoreInit());
  }

  const progressRows = await fetchRoadmapProgress(supabase, user.id, materialId);
  const ui = buildRoadmapUiState({
    materialId,
    title: material.title,
    description: null,
    structure,
    progressRows,
  });

  const uiNode = ui.segments.flatMap((segment) => segment.nodes).find((node) => node.id === nodeId);
  if (!uiNode || uiNode.status === "locked") {
    return fail("Exam is locked", 403, "FORBIDDEN", noStoreInit());
  }

  return ok(
    {
      node_id: nodeId,
      title: meta.node.title,
      exam: meta.node.exam,
      assignment_id: meta.node.assignment_id ?? null,
    },
    noStoreInit(),
  );
}
