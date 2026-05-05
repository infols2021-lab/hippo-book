import { getBranchConfig, getBranchLabel, normalizeBranchType } from "@/lib/branches/config";
import type { BranchType } from "@/lib/branches/types";
import {
  formatClassLevel,
  formatGatehouseLevels,
  formatMaterialKinds,
  normalizeMaterialKinds,
  toStringArray,
  uniqueStrings,
} from "@/lib/materials/format";
import type { MaterialKind, PurchaseRequestTarget } from "@/lib/materials/types";

export type PurchaseRequestStatus = "pending" | "processed";

export type PurchaseRequestLike = {
  branch_type?: string | null;
  class_level?: string | null;
  target_level?: string[] | null;
  target_levels?: string[] | null;
  textbook_types?: string[] | null;
  material_kinds?: string[] | null;
  is_processed?: boolean | null;
};

export type RequestNumberOptions = {
  prefix?: string;
  date?: Date;
  randomPart?: string;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function getDateStamp(date: Date): string {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
}

function getRandomRequestPart(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function createClientRequestNumber(options: RequestNumberOptions = {}): string {
  const prefix = options.prefix ?? "PR";
  const date = options.date ?? new Date();
  const randomPart = options.randomPart ?? getRandomRequestPart();

  return `${prefix}-${getDateStamp(date)}-${randomPart}`;
}

export function getRequestStatus(request: PurchaseRequestLike): PurchaseRequestStatus {
  return request.is_processed ? "processed" : "pending";
}

export function getRequestStatusLabel(request: PurchaseRequestLike): string {
  return request.is_processed ? "Обработана" : "Ожидает обработки";
}

export function getRequestStatusClassName(request: PurchaseRequestLike): string {
  return request.is_processed ? "status-processed" : "status-pending";
}

export function getRequestBranchType(request: PurchaseRequestLike): BranchType {
  return normalizeBranchType(request.branch_type);
}

export function getRequestBranchLabel(request: PurchaseRequestLike): string {
  return getBranchLabel(getRequestBranchType(request));
}

export function getRequestMaterialKinds(request: PurchaseRequestLike): MaterialKind[] {
  const directKinds = normalizeMaterialKinds(request.material_kinds);
  if (directKinds.length) return directKinds;

  const legacyKinds = normalizeMaterialKinds(request.textbook_types);
  if (legacyKinds.length) return legacyKinds;

  const branch = getRequestBranchType(request);
  return getBranchConfig(branch).requests.defaultMaterialKinds;
}

export function formatRequestMaterialKinds(request: PurchaseRequestLike): string {
  return formatMaterialKinds(getRequestMaterialKinds(request));
}

export function getRequestTargetLevels(request: PurchaseRequestLike): string[] {
  const targetLevels = toStringArray(request.target_levels);
  if (targetLevels.length) return uniqueStrings(targetLevels);

  return uniqueStrings(toStringArray(request.target_level));
}

export function formatRequestTarget(request: PurchaseRequestLike): string {
  const branch = getRequestBranchType(request);

  if (branch === "gatehouse") {
    return formatGatehouseLevels(getRequestTargetLevels(request));
  }

  return formatClassLevel(request.class_level);
}

export function buildPurchaseRequestTarget(request: PurchaseRequestLike): PurchaseRequestTarget {
  const branch_type = getRequestBranchType(request);

  return {
    branch_type,
    material_kinds: getRequestMaterialKinds(request),
    class_level: branch_type === "olympiad" ? request.class_level ?? null : null,
    target_levels: branch_type === "gatehouse" ? getRequestTargetLevels(request) : [],
  };
}

export function serializeRequestMaterialKindsForDb(request: PurchaseRequestLike): string[] {
  return getRequestMaterialKinds(request);
}

export function serializeRequestLegacyTextbookTypesForDb(request: PurchaseRequestLike): string[] {
  const branch = getRequestBranchType(request);
  const kinds = getRequestMaterialKinds(request);

  if (branch === "gatehouse") {
    return kinds;
  }

  return kinds.map((kind) => {
    if (kind === "textbook") return "учебник";
    if (kind === "crossword") return "кроссворд";
    return kind;
  });
}

export function getRequestSummary(request: PurchaseRequestLike): string {
  const branchLabel = getRequestBranchLabel(request);
  const materials = formatRequestMaterialKinds(request);
  const target = formatRequestTarget(request);

  return `${branchLabel} · ${materials} · ${target}`;
}

export function isGatehouseRequest(request: PurchaseRequestLike): boolean {
  return getRequestBranchType(request) === "gatehouse";
}

export function isOlympiadRequest(request: PurchaseRequestLike): boolean {
  return getRequestBranchType(request) === "olympiad";
}