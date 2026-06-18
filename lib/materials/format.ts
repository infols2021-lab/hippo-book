// lib/materials/format.ts
// Форматирование и вспомогательные функции для материалов.
// Не зависит от lib/branches/config — использует только явные проверки на olympiad/gatehouse.

import type { BranchType } from "@/lib/branches/types";
import type { MaterialDbRow, MaterialKind, MaterialTargetMode } from "@/lib/materials/types";
import {
  normalizeBranchType,
  normalizeString,
  toStringArray,
  uniqueStrings,
  normalizeMaterialKind,
  normalizeMaterialKinds,
} from "./normalize";

// ----------------------------------------------------------------------------
// Константы
// ----------------------------------------------------------------------------

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
  material: "Материал",
};

export const MATERIAL_KIND_PLURAL_LABELS: Record<string, string> = {
  textbook: "Учебники",
  crossword: "Кроссворды",
  mock_test: "Пробные тесты",
  material: "Материалы",
};

export const MATERIAL_KIND_ICONS: Record<string, string> = {
  textbook: "📚",
  crossword: "🧩",
  mock_test: "📝",
  material: "📁",
};

// ----------------------------------------------------------------------------
// Реэкспорты из normalize.ts (для обратной совместимости)
// ----------------------------------------------------------------------------

export {
  normalizeString,
  toStringArray,
  uniqueStrings,
  normalizeMaterialKind,
  normalizeMaterialKinds,
};

// ----------------------------------------------------------------------------
// Форматирование материала
// ----------------------------------------------------------------------------

export function getMaterialKindIcon(kind: unknown): string {
  const normalized = normalizeMaterialKind(kind);
  return MATERIAL_KIND_ICONS[normalized] ?? "📁";
}

export function formatMaterialKind(kind: unknown): string {
  const normalized = normalizeMaterialKind(kind);
  if (MATERIAL_KIND_LABELS[normalized]) {
    return MATERIAL_KIND_LABELS[normalized];
  }
  // Кастомный тип — с заглавной буквы
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatMaterialKindPlural(kind: unknown): string {
  const normalized = normalizeMaterialKind(kind);
  return MATERIAL_KIND_PLURAL_LABELS[normalized] ?? `${formatMaterialKind(kind)}s`;
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

// ----------------------------------------------------------------------------
// Классы и уровни
// ----------------------------------------------------------------------------

export function formatClassLevel(value: unknown): string {
  const raw = normalizeString(value);
  if (!raw) return "—";
  return OLYMPIAD_CLASS_LABELS[raw] ?? raw;
}

export function formatClassLevels(values: unknown): string {
  const arr = toStringArray(values);
  if (!arr.length) return "—";
  return arr.map(formatClassLevel).join(", ");
}

export function normalizeGatehouseLevel(value: unknown): string {
  const raw = normalizeString(value);
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

// ----------------------------------------------------------------------------
// Целевой режим (targetMode) — больше не зависит от конфига веток
// ----------------------------------------------------------------------------

export function getMaterialTargetMode(branchType: unknown): MaterialTargetMode {
  const branch = normalizeBranchType(branchType);
  if (branch === "gatehouse") return "target_levels";
  if (branch === "olympiad") return "class_level";
  // Для динамических веток используем target_levels (как в Gatehouse)
  return "target_levels";
}

export function formatMaterialTarget(
  material: Pick<MaterialDbRow, "branch_type" | "class_levels" | "target_levels">,
): string {
  const branch = normalizeBranchType(material.branch_type);
  if (branch === "gatehouse") {
    return formatGatehouseLevels(material.target_levels);
  }
  if (branch !== "olympiad" && Array.isArray(material.target_levels) && material.target_levels.length > 0) {
    return material.target_levels.join(", ");
  }
  return formatClassLevels(material.class_levels);
}

// ----------------------------------------------------------------------------
// Построение ссылок (без getBranchConfig)
// ----------------------------------------------------------------------------

function buildDynamicPath(branchType: string, path: string): string {
  // Для legacy используем старые пути, иначе /projects/${branchType}/${path}
  if (branchType === "olympiad") {
    return `/${path}`; // например /profile, /materials
  }
  if (branchType === "gatehouse") {
    return `/gatehouse/${path}`;
  }
  return `/projects/${branchType}/${path}`;
}

export function getMaterialHref(
  material: Pick<MaterialDbRow, "id" | "branch_type" | "material_kind">,
): string {
  const branch = normalizeBranchType(material.branch_type);
  if (branch === "olympiad") {
    if (material.material_kind === "crossword") return `/crossword/${material.id}`;
    return `/textbook/${material.id}`;
  }
  if (branch === "gatehouse") {
    return `/gatehouse/material/${material.id}`;
  }
  return `/projects/${branch}/materials/${material.id}`;
}

export function getAssignmentHref(branchType: unknown, assignmentId: string): string {
  const branch = normalizeBranchType(branchType);
  if (branch === "olympiad") {
    return `/assignment/${assignmentId}`;
  }
  if (branch === "gatehouse") {
    return `/gatehouse/assignment/${assignmentId}`;
  }
  return `/projects/${branch}/assignment/${assignmentId}`;
}

export function getMaterialsHref(branchType: unknown): string {
  const branch = normalizeBranchType(branchType);
  if (branch === "olympiad") {
    return "/materials";
  }
  if (branch === "gatehouse") {
    return "/gatehouse/materials";
  }
  return `/projects/${branch}/materials`;
}

export function getRequestsHref(branchType: unknown): string {
  const branch = normalizeBranchType(branchType);
  if (branch === "olympiad") {
    return "/requests";
  }
  if (branch === "gatehouse") {
    return "/gatehouse/requests";
  }
  return `/projects/${branch}/requests`;
}

export function getProfileHref(branchType: unknown): string {
  const branch = normalizeBranchType(branchType);
  if (branch === "olympiad") {
    return "/profile";
  }
  if (branch === "gatehouse") {
    return "/gatehouse/profile";
  }
  return `/projects/${branch}/profile`;
}

// ----------------------------------------------------------------------------
// Прочие утилиты
// ----------------------------------------------------------------------------

export function formatBranchMaterialLabel(branchType: unknown, kind: unknown): string {
  const branch = normalizeBranchType(branchType);
  // Для динамических веток используем slug как label
  const branchLabel = branch === "olympiad" ? "Олимпиада" : branch === "gatehouse" ? "Экзамены" : branch;
  return `${branchLabel} · ${formatMaterialKindWithIcon(kind)}`;
}

export function shouldUseOlympiadStreaks(branchType: unknown): boolean {
  const branch = normalizeBranchType(branchType);
  // Только олимпиада использует стрики (по умолчанию)
  return branch === "olympiad";
}

export function isGatehouseBranch(branchType: unknown): branchType is "gatehouse" {
  return normalizeBranchType(branchType) === "gatehouse";
}

export function isOlympiadBranch(branchType: unknown): branchType is "olympiad" {
  return normalizeBranchType(branchType) === "olympiad";
}

export function branchAwareCompletedCountField(
  branchType: BranchType,
): "completed_assignments_count" | "ga_completed_assignments_count" {
  return branchType === "gatehouse" ? "ga_completed_assignments_count" : "completed_assignments_count";
}