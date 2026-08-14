import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFTextField } from "pdf-lib";
import {
  type CertificateRenderContext,
  resolveCertificateFieldValue,
} from "@/lib/roadmap/certificateConfig";
import type { RoadmapCertificateTemplateConfig } from "@/lib/roadmap/types";
import { buildRoadmapCertificatePdf } from "@/lib/roadmap/certificatePdf";

const ROBOTO_REGULAR_URL =
  "https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Regular.ttf";

let cachedFontBytes: Uint8Array | null = null;

async function loadCyrillicFontBytes() {
  if (cachedFontBytes) return cachedFontBytes;
  const res = await fetch(ROBOTO_REGULAR_URL, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error("Не удалось загрузить шрифт для сертификата");
  }
  cachedFontBytes = new Uint8Array(await res.arrayBuffer());
  return cachedFontBytes;
}

export async function listPdfFormFieldNames(pdfBytes: Uint8Array | ArrayBuffer): Promise<string[]> {
  const fields = await listPdfFormFieldsAsync(pdfBytes);
  return fields.map((field) => field.name);
}

export async function listPdfFormFieldsAsync(
  pdfBytes: Uint8Array | ArrayBuffer,
): Promise<Array<{ name: string; type: string }>> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const form = pdfDoc.getForm();
  return form.getFields().map((field) => ({
    name: field.getName(),
    type: field.constructor.name.replace(/^PDF/, "").replace(/Field$/, "") || "Field",
  }));
}

export async function fillCertificateTemplatePdf(input: {
  templateBytes: Uint8Array | ArrayBuffer;
  config: RoadmapCertificateTemplateConfig;
  context: CertificateRenderContext;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(input.templateBytes, { ignoreEncryption: true });
  pdfDoc.registerFontkit(fontkit);
  const fontBytes = await loadCyrillicFontBytes();
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });

  const form = pdfDoc.getForm();
  const entries = Object.entries(input.config.field_map || {});

  for (const [fieldName, source] of entries) {
    const value = resolveCertificateFieldValue(
      source,
      input.context,
      input.config.fallbacks?.[fieldName],
    );

    let field: PDFTextField | null = null;
    try {
      field = form.getTextField(fieldName);
    } catch {
      continue;
    }

    field.setText(value);
    try {
      field.updateAppearances(font);
    } catch {
      field.setText(value);
    }
  }

  try {
    form.flatten();
  } catch {
    // ignore flatten issues for exotic templates
  }

  return pdfDoc.save();
}

export async function buildCertificatePdf(input: {
  templateBytes?: Uint8Array | ArrayBuffer | null;
  config?: RoadmapCertificateTemplateConfig | null;
  context: CertificateRenderContext;
}): Promise<Uint8Array> {
  if (input.templateBytes && input.config?.field_map && Object.keys(input.config.field_map).length > 0) {
    try {
      return await fillCertificateTemplatePdf({
        templateBytes: input.templateBytes,
        config: input.config,
        context: input.context,
      });
    } catch (error) {
      console.error("[certificate] template fill failed, fallback to default:", error);
    }
  }

  return buildRoadmapCertificatePdf({
    userName: resolveCertificateFieldValue("profile.full_name", input.context),
    courseTitle: resolveCertificateFieldValue("material.title", input.context),
    completedAt: input.context.issuedAt,
  });
}
