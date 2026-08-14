import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import { isValidUUID } from "@/lib/api/validate";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  CERTIFICATE_BUCKET,
  applyCertificateTemplateConfig,
  buildDefaultFieldMap,
  certificateTemplatePath,
  getCertificateTemplateConfig,
  normalizeFallbacks,
  normalizeFieldMap,
} from "@/lib/roadmap/certificateConfig";
import { listPdfFormFieldsAsync, buildCertificatePdf } from "@/lib/roadmap/certificateTemplate";
import { fetchRoadmapStructure } from "@/lib/roadmap/data";
import type { RoadmapCertificateTemplateConfig, RoadmapStructure } from "@/lib/roadmap/types";
import { downloadStorageObjectBytes } from "@/lib/storage/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreInit(): ResponseInit {
  return { headers: { "cache-control": "no-store, max-age=0" } };
}

async function readParams(ctx: { params: Promise<{ materialId: string }> }) {
  return ctx.params;
}

async function loadStructure(materialId: string): Promise<RoadmapStructure | null> {
  const adminDb = getSupabaseAdminClient();
  const { data, error } = await adminDb
    .from("roadmap_courses")
    .select("structure")
    .eq("material_id", materialId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.structure || typeof data.structure !== "object") return null;
  return data.structure as RoadmapStructure;
}

async function saveStructure(materialId: string, structure: RoadmapStructure) {
  const adminDb = getSupabaseAdminClient();
  const { error } = await adminDb.from("roadmap_courses").upsert(
    {
      material_id: materialId,
      structure,
      version: structure.version,
    },
    { onConflict: "material_id" },
  );
  if (error) throw error;
}

async function readTemplateBytes(config: RoadmapCertificateTemplateConfig | null) {
  if (!config?.bucket || !config.path) return null;
  const result = await downloadStorageObjectBytes(config.bucket, config.path);
  return result.bytes;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ materialId: string }> },
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const { materialId } = await readParams(ctx);
  if (!isValidUUID(materialId)) {
    return fail("Invalid material id", 400, "VALIDATION", noStoreInit());
  }

  const testMode = req.nextUrl.searchParams.get("test") === "1";

  try {
    const structure = await loadStructure(materialId);
    const template = getCertificateTemplateConfig(structure);

    if (testMode) {
      const { data: material } = await auth.supabase
        .from("materials")
        .select("title")
        .eq("id", materialId)
        .maybeSingle();

      const templateBytes = await readTemplateBytes(template);
      const pdfBytes = await buildCertificatePdf({
        templateBytes,
        config: template,
        context: {
          profileFullName: auth.profile?.full_name || "Иван Тестов",
          profileEmail: auth.profile?.email || "test@example.com",
          materialTitle: material?.title || "Тестовый курс",
          issuedAt: new Date(),
          certificateId: randomUUID(),
        },
      });

      return new Response(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": 'attachment; filename="certificate-test.pdf"',
          "cache-control": "no-store, max-age=0",
        },
      });
    }

    let fields: Array<{ name: string; type: string }> = [];
    if (template) {
      try {
        const templateBytes = await readTemplateBytes(template);
        if (templateBytes) {
          fields = await listPdfFormFieldsAsync(templateBytes);
        }
      } catch (parseError) {
        console.error("[admin certificate] parse fields failed:", parseError);
      }
    }

    return ok(
      {
        bucket: CERTIFICATE_BUCKET,
        default_path: certificateTemplatePath(materialId),
        template,
        fields,
      },
      noStoreInit(),
    );
  } catch (error: any) {
    return fail(String(error?.message || error || "Certificate load failed"), 500, "DB_ERROR", noStoreInit());
  }
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("Bad JSON", 400, "BAD_JSON", noStoreInit());
  }

  try {
    const structure = await loadStructure(materialId);
    if (!structure) {
      return fail("Roadmap is not configured", 404, "ROADMAP_NOT_CONFIGURED", noStoreInit());
    }

    const bucket = String(body?.bucket || CERTIFICATE_BUCKET).trim();
    const path = String(body?.path || certificateTemplatePath(materialId)).trim();
    const fieldMap = normalizeFieldMap(body?.field_map);
    const fallbacks = normalizeFallbacks(body?.fallbacks);

    const templateBytes = await downloadStorageObjectBytes(bucket, path);
    const fields = await listPdfFormFieldsAsync(templateBytes.bytes);
    const fieldNames = fields.map((field) => field.name);

    const mergedFieldMap = {
      ...buildDefaultFieldMap(fieldNames),
      ...getCertificateTemplateConfig(structure)?.field_map,
      ...fieldMap,
    };

    const nextTemplate: RoadmapCertificateTemplateConfig = {
      bucket,
      path,
      field_map: mergedFieldMap,
      fallbacks,
      updated_at: new Date().toISOString(),
    };

    const nextStructure = applyCertificateTemplateConfig(structure, nextTemplate);
    await saveStructure(materialId, nextStructure);

    return ok(
      {
        saved: true,
        template: nextTemplate,
        fields,
      },
      noStoreInit(),
    );
  } catch (error: any) {
    return fail(String(error?.message || error || "Certificate save failed"), 500, "SAVE_FAILED", noStoreInit());
  }
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

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const bucket = String(body?.bucket || CERTIFICATE_BUCKET).trim();
  const path = String(body?.path || certificateTemplatePath(materialId)).trim();

  try {
    const templateBytes = await downloadStorageObjectBytes(bucket, path);
    const fields = await listPdfFormFieldsAsync(templateBytes.bytes);

    return ok(
      {
        bucket,
        path,
        fields,
        suggested_field_map: buildDefaultFieldMap(fields.map((field) => field.name)),
      },
      noStoreInit(),
    );
  } catch (error: any) {
    return fail(String(error?.message || error || "Certificate parse failed"), 500, "PARSE_FAILED", noStoreInit());
  }
}
