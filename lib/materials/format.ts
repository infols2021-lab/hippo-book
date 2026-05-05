import { getBranchConfig, normalizeBranchType } from "@/lib/branches/config";
import type { BranchType } from "@/lib/branches/types";
import type { MaterialDbRow, MaterialKind, MaterialTargetMode } from "@/lib/materials/types";

export const OLYMPIAD_CLASS_LABELS: Record<string, string> = {
  "1-2": "1-2 класс",
  "3-4": "3-4 класс",
  "5-6": "5-6 класс",
  "7": "7 класс",
  "8-9": "8-9 класс",
  "10-11": "10-11 класс (техникум, колледж — 1 курс)",
  "12": "12 класс (техникум, колледж)",
};

export const GATEHOUSE_LEVEL_LABELS: Record<string, string> = {
  stage_1: "Stage 1",
  stage_2: "Stage 2",
  stage_3: "Stage 3",
  "Stage 1": "Stage 1",
  "Stage 2": "Stage 2",
  "Stage 3": "Stage 3",
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
  C2: "C2",
};

export const MATERIAL_KIND_LABELS: Record<string, string> = {
  textbook: "Учебник",
  crossword: "Кроссворд",
  mock_test: "Пробный тест",
};

export const MATERIAL_KIND_PLURAL_LABELS: Record<string, string> = {
  textbook: "Учебники",
  crossword: "Кроссворды",
  mock_test: "Пробные тесты",
};

export const MATERIAL_KIND_ICONS: Record<string, string> = {
  textbook: "📚",
  crossword: "🧩",
  mock_test: "📝",
};

export const LEGACY_MATERIAL_KIND_ALIASES: Record<string, MaterialKind> = {
  учебник: "textbook",
  textbook: "textbook",
  textbooks: "textbook",
  кроссворд: "crossword",
  crossword: "crossword",
  crosswords: "crossword",
  "пробный тест": "mock_test",
  "пробные тесты": "mock_test",
  mock_test: "mock_test",
  "mock-test": "mock_test",
  mocktest: "mock_test",
};

export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
  }

  if (value === null || value === undefined) return [];

  const str = String(value).trim();
  return str ? [str] : [];
}

export function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function normalizeMaterialKind(value: unknown): MaterialKind {
  const raw = String(value ?? "").trim();
  if (!raw) return "textbook";

  const key = raw.toLowerCase();
  return LEGACY_MATERIAL_KIND_ALIASES[key] ?? key;
}

export function normalizeMaterialKinds(value: unknown): MaterialKind[] {
  return uniqueStrings(toStringArray(value).map((item) => normalizeMaterialKind(item)));
}

export function getMaterialKindIcon(kind: unknown): string {
  return MATERIAL_KIND_ICONS[String(kind ?? "")] ?? "📦";
}

export function formatMaterialKind(kind: unknown): string {
  const normalized = normalizeMaterialKind(kind);
  return MATERIAL_KIND_LABELS[normalized] ?? String(kind ?? "Материал");
}

export function formatMaterialKindPlural(kind: unknown): string {
  const normalized = normalizeMaterialKind(kind);
  return MATERIAL_KIND_PLURAL_LABELS[normalized] ?? formatMaterialKind(kind);
}

export function formatMaterialKindWithIcon(kind: unknown): string {
  const normalized = normalizeMaterialKind(kind);
  return `${getMaterialKindIcon(normalized)} ${formatMaterialKind(normalized)}`;
}

export function formatMaterialKinds(kinds: unknown): string {
  const normalized = normalizeMaterialKinds(kinds);
  if (!normalized.length) return "—";
  return normalized.map(formatMaterialKindWithIcon).join(", ");
}

export function formatClassLevel(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  return OLYMPIAD_CLASS_LABELS[raw] ?? raw;
}

export function formatClassLevels(values: unknown): string {
  const arr = toStringArray(values);
  if (!arr.length) return "—";
  return arr.map(formatClassLevel).join(", ");
}

export function normalizeGatehouseLevel(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const lower = raw.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");

  if (lower === "stage_1") return "stage_1";
  if (lower === "stage_2") return "stage_2";
  if (lower === "stage_3") return "stage_3";

  const upper = raw.toUpperCase();
  if (["A1", "A2", "B1", "B2", "C1", "C2"].includes(upper)) return upper;

  return raw;
}

export function formatGatehouseLevel(value: unknown): string {
  const normalized = normalizeGatehouseLevel(value);
  if (!normalized) return "—";
  return GATEHOUSE_LEVEL_LABELS[normalized] ?? normalized;
}

export function formatGatehouseLevels(values: unknown): string {
  const arr = uniqueStrings(toStringArray(values).map(normalizeGatehouseLevel));
  if (!arr.length) return "—";
  return arr.map(formatGatehouseLevel).join(", ");
}

export function getMaterialTargetMode(branchType: unknown): MaterialTargetMode {
  const branch = normalizeBranchType(branchType);
  return getBranchConfig(branch).requests.targetMode;
}

export function formatMaterialTarget(material: Pick<MaterialDbRow, "branch_type" | "class_levels" | "target_levels">): string {
  if (material.branch_type === "gatehouse") {
    return formatGatehouseLevels(material.target_levels);
  }

  return formatClassLevels(material.class_levels);
}

export function getMaterialHref(material: Pick<MaterialDbRow, "id" | "branch_type" | "material_kind">): string {
  const branch = normalizeBranchType(material.branch_type);
  const config = getBranchConfig(branch);

  if (branch === "olympiad") {
    if (material.material_kind === "crossword") return `/crossword/${material.id}`;
    return `/textbook/${material.id}`;
  }

  return config.routes.material(material.id);
}

export function getAssignmentHref(branchType: unknown, assignmentId: string): string {
  const branch = normalizeBranchType(branchType);
  return getBranchConfig(branch).routes.assignment(assignmentId);
}

export function getMaterialsHref(branchType: unknown): string {
  const branch = normalizeBranchType(branchType);
  return getBranchConfig(branch).routes.materials;
}

export function getRequestsHref(branchType: unknown): string {
  const branch = normalizeBranchType(branchType);
  return getBranchConfig(branch).routes.requests;
}

export function getProfileHref(branchType: unknown): string {
  const branch = normalizeBranchType(branchType);
  return getBranchConfig(branch).routes.profile;
}

export function formatBranchMaterialLabel(branchType: unknown, kind: unknown): string {
  const branch = normalizeBranchType(branchType);
  const branchLabel = getBranchConfig(branch).shortLabel;
  return `${branchLabel} · ${formatMaterialKindWithIcon(kind)}`;
}

export function shouldUseOlympiadStreaks(branchType: unknown): boolean {
  const branch = normalizeBranchType(branchType);
  return getBranchConfig(branch).hasOlympiadStreaks;
}

export function isGatehouseBranch(branchType: unknown): branchType is "gatehouse" {
  return normalizeBranchType(branchType) === "gatehouse";
}

export function isOlympiadBranch(branchType: unknown): branchType is "olympiad" {
  return normalizeBranchType(branchType) === "olympiad";
}

export function branchAwareCompletedCountField(branchType: BranchType): "completed_assignments_count" | "ga_completed_assignments_count" {
  return branchType === "gatehouse" ? "ga_completed_assignments_count" : "completed_assignments_count";
}