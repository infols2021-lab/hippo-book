import { fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/auth";
import { isValidUUID } from "@/lib/api/validate";
import { buildRoadmapCertificatePdf } from "@/lib/roadmap/certificatePdf";
import { fetchRoadmapProgress, fetchRoadmapStructure } from "@/lib/roadmap/data";
import { buildRoadmapUiState } from "@/lib/roadmap/unlock";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreInit(): ResponseInit {
  return { headers: { "cache-control": "no-store, max-age=0" } };
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ materialId: string }> },
) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { materialId } = await ctx.params;
  if (!isValidUUID(materialId)) {
    return fail("Invalid material id", 400, "VALIDATION", noStoreInit());
  }

  const { supabase, user, profile } = auth;

  const { data: material, error: materialError } = await supabase
    .from("materials")
    .select("id, title, material_kind, is_active, is_available, is_demo")
    .eq("id", materialId)
    .maybeSingle();

  if (materialError) {
    return fail(materialError.message, 500, "DB_ERROR", noStoreInit());
  }
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

  const progressRows = await fetchRoadmapProgress(supabase, user.id, materialId);
  const ui = buildRoadmapUiState({
    materialId,
    title: material.title,
    description: null,
    structure,
    progressRows,
  });

  const certificateSegment = ui.segments.find((segment) => segment.kind === "certificate");
  if (!certificateSegment?.unlocked) {
    return fail("Certificate is not available yet", 403, "FORBIDDEN", noStoreInit());
  }

  const completedAt = progressRows
    .map((row) => row.completed_at)
    .filter(Boolean)
    .sort()
    .pop();

  const pdfBytes = await buildRoadmapCertificatePdf({
    userName: profile?.full_name?.trim() || user.email?.split("@")[0] || "Участник",
    courseTitle: material.title,
    completedAt: completedAt ? new Date(completedAt) : new Date(),
  });

  const filename = `certificate-${materialId.slice(0, 8)}.pdf`;
  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store, max-age=0",
    },
  });
}
