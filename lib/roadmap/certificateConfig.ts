import type { CertificateFieldSource, RoadmapCertificateTemplateConfig, RoadmapStructure } from "@/lib/roadmap/types";

export const CERTIFICATE_BUCKET = process.env.CERTIFICATE_BUCKET_NAME || "hippo-book-certificates";

export const CERTIFICATE_FIELD_OPTIONS: Array<{ value: CertificateFieldSource | "static"; label: string }> = [
  { value: "profile.full_name", label: "Имя ученика" },
  { value: "profile.email", label: "Email ученика" },
  { value: "material.title", label: "Название курса" },
  { value: "issued_at.ru", label: "Дата выдачи (ДД.ММ.ГГГГ)" },
  { value: "issued_at.iso", label: "Дата выдачи (ISO)" },
  { value: "certificate.id", label: "Номер сертификата" },
  { value: "empty", label: "Пусто" },
];

export function certificateTemplatePath(materialId: string) {
  return `certificates/${materialId}/template.pdf`;
}

export function findCertificateSegment(structure: RoadmapStructure | null) {
  if (!structure) return null;
  return structure.segments.find((segment) => segment.kind === "certificate") ?? null;
}

export function getCertificateTemplateConfig(
  structure: RoadmapStructure | null,
): RoadmapCertificateTemplateConfig | null {
  const segment = findCertificateSegment(structure);
  if (!segment || segment.kind !== "certificate") return null;
  return segment.template ?? null;
}

export function applyCertificateTemplateConfig(
  structure: RoadmapStructure,
  template: RoadmapCertificateTemplateConfig | null,
): RoadmapStructure {
  const segments = structure.segments.map((segment) => {
    if (segment.kind !== "certificate") return segment;
    return {
      ...segment,
      template,
    };
  });

  const hasCertificate = segments.some((segment) => segment.kind === "certificate");
  if (!hasCertificate && template) {
    segments.push({
      kind: "certificate",
      id: "certificate",
      title: "Сертификат",
      enabled: true,
      template,
    });
  }

  return {
    ...structure,
    segments,
  };
}

export type CertificateRenderContext = {
  profileFullName?: string | null;
  profileEmail?: string | null;
  materialTitle?: string | null;
  issuedAt: Date;
  certificateId: string;
};

export function resolveCertificateFieldValue(
  source: CertificateFieldSource | `static:${string}` | string,
  context: CertificateRenderContext,
  fallback?: string,
): string {
  const normalized = String(source || "").trim();

  if (!normalized || normalized === "empty") return "";

  if (normalized.startsWith("static:")) {
    return normalized.slice("static:".length);
  }

  switch (normalized as CertificateFieldSource) {
    case "profile.full_name":
      return context.profileFullName?.trim() || fallback || "Участник";
    case "profile.email":
      return context.profileEmail?.trim() || fallback || "";
    case "material.title":
      return context.materialTitle?.trim() || fallback || "Курс";
    case "issued_at.ru":
      return context.issuedAt.toLocaleDateString("ru-RU");
    case "issued_at.iso":
      return context.issuedAt.toISOString().slice(0, 10);
    case "certificate.id":
      return context.certificateId;
    default:
      return fallback || "";
  }
}

export function normalizeFieldMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const fieldName = String(key || "").trim();
    const mapped = String(value ?? "").trim();
    if (fieldName && mapped) result[fieldName] = mapped;
  }
  return result;
}

export function normalizeFallbacks(raw: unknown): Record<string, string> {
  return normalizeFieldMap(raw);
}

export function buildDefaultFieldMap(fieldNames: string[]): Record<string, string> {
  const defaults: Record<string, string> = {
    student_name: "profile.full_name",
    full_name: "profile.full_name",
    username: "profile.full_name",
    user_name: "profile.full_name",
    name: "profile.full_name",
    course_title: "material.title",
    course: "material.title",
    course_name: "material.title",
    material_title: "material.title",
    issue_date: "issued_at.ru",
    date: "issued_at.ru",
    issued_at: "issued_at.ru",
    certificate_id: "certificate.id",
    certificate_no: "certificate.id",
    cert_id: "certificate.id",
    email: "profile.email",
  };

  const result: Record<string, string> = {};
  for (const fieldName of fieldNames) {
    const key = fieldName.trim();
    if (!key) continue;
    const normalized = key.toLowerCase();
    result[key] = defaults[normalized] || "empty";
  }
  return result;
}
