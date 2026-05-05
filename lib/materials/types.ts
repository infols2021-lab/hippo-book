import type { BranchType } from "@/lib/branches/types";

export type OlympiadMaterialKind = "textbook" | "crossword";
export type GatehouseMaterialKind = "mock_test";

export type MaterialKind = OlympiadMaterialKind | GatehouseMaterialKind | (string & {});

export type MaterialTargetMode = "class_level" | "target_levels";

export type MaterialLegacySourceTable = "textbooks" | "crosswords" | null;

export type MaterialDbRow = {
  id: string;
  branch_type: BranchType;
  material_kind: MaterialKind;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_active: boolean;
  is_available: boolean;
  order_index: number;
  class_levels: string[];
  target_levels: string[];
  legacy_source_table: MaterialLegacySourceTable;
  legacy_source_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  meta: Record<string, unknown>;
};

export type MaterialAccessDbRow = {
  id: string;
  user_id: string;
  material_id: string;
  granted_by: string | null;
  granted_at: string;
  meta: Record<string, unknown>;
};

export type LegacyTextbookDbRow = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_active: boolean | null;
  is_available: boolean | null;
  order_index: number | null;
  class_level: string[] | null;
  branch_type?: BranchType | null;
  target_levels?: string[] | null;
  created_by: string | null;
  created_at: string | null;
};

export type LegacyCrosswordDbRow = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_active: boolean | null;
  is_available: boolean | null;
  order_index: number | null;
  class_level: string[] | null;
  branch_type?: BranchType | null;
  target_levels?: string[] | null;
  created_by: string | null;
  created_at: string | null;
};

export type AssignmentMaterialLink = {
  id: string;
  material_id: string | null;
  textbook_id?: string | null;
  crossword_id?: string | null;
  branch_type?: BranchType | null;
};

export type MaterialWithProgress = MaterialDbRow & {
  totalAssignments: number;
  completedAssignments: number;
  progress: number;
  hasAccess: boolean;
};

export type MaterialCreateInput = {
  branch_type: BranchType;
  material_kind: MaterialKind;
  title: string;
  description?: string | null;
  cover_image_url?: string | null;
  is_available?: boolean;
  order_index?: number;
  class_levels?: string[];
  target_levels?: string[];
};

export type MaterialUpdateInput = Partial<MaterialCreateInput> & {
  is_active?: boolean;
};

export type PurchaseRequestMaterialKind = MaterialKind;

export type PurchaseRequestTarget = {
  branch_type: BranchType;
  material_kinds: PurchaseRequestMaterialKind[];
  class_level: string | null;
  target_levels: string[];
};

export type MaterialGrantRow = {
  request_id: string;
  user_id: string;
  kind: MaterialKind;
  item_id: string;
  material_id: string;
  branch_type: BranchType;
  material_kind: MaterialKind;
  title: string;
  granted_by: string;
  granted_at: string;
};

export function isOlympiadMaterialKind(kind: unknown): kind is OlympiadMaterialKind {
  return kind === "textbook" || kind === "crossword";
}

export function isGatehouseMaterialKind(kind: unknown): kind is GatehouseMaterialKind {
  return kind === "mock_test";
}

export function isKnownMaterialKind(kind: unknown): kind is OlympiadMaterialKind | GatehouseMaterialKind {
  return isOlympiadMaterialKind(kind) || isGatehouseMaterialKind(kind);
}