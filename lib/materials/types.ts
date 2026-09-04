import type { BranchType as KnownBranchType } from "@/lib/branches/types";

// Поддерживаем как известную строго типизированную ветку, так и кастомные строки веток
export type BranchType = KnownBranchType | (string & {});

export type OlympiadMaterialKind = "textbook" | "crossword";
export type GatehouseMaterialKind = "mock_test";

// Поддерживаем как старые строго типизированные виды, так и новые кастомные строки
export type MaterialKind = OlympiadMaterialKind | GatehouseMaterialKind | (string & {});

export type MaterialTargetMode = "class_level" | "target_levels";

export type MaterialLegacySourceTable = "textbooks" | "crosswords" | null;

export type MaterialDbRow = {
  id: string;
  branch_type: string;
  material_kind: MaterialKind;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_active: boolean;
  is_available: boolean;
  is_demo: boolean;
  order_index: number;
  price: number;
  class_levels: string[];
  target_levels: string[];
  legacy_source_table: MaterialLegacySourceTable;
  legacy_source_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  meta: Record<string, unknown>;
  project_tab_id: string | null;
  is_pro: boolean;
  pro_material_id: string | null;
  checkout_description: string | null;
};

/**
 * Режим доступа ученика к связке «База + PRO».
 * - none — нет доступа ни к одному тарифу (карточка закрыта);
 * - base — доступна только База (классический задачник);
 * - pro — доступен только PRO (roadmap-тренажёр);
 * - full — куплены оба тарифа (доступен переключатель режимов).
 */
export type MaterialAccessMode = "none" | "base" | "pro" | "full";

/**
 * Связанный PRO-материал в формате витрины заявок (публичный DTO).
 * Поле image соответствует cover_image_url в БД.
 */
export type LinkedProMaterial = {
  id: string;
  title: string;
  price: number;
  description: string | null;
  checkout_description: string | null;
  image: string | null;
  is_active: boolean;
};

/**
 * Связанный PRO-материал во внутреннем слое загрузчика кабинета ученика
 * (хранит доступы и поля из materials).
 */
export type MaterialProLink = {
  id: string;
  title: string;
  price: number;
  description: string | null;
  cover_image_url: string | null;
  checkout_description: string | null;
  material_kind: MaterialKind;
  is_active: boolean;
  is_available: boolean;
  hasAccess: boolean;
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
  branch_type?: string | null;
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
  branch_type?: string | null;
  target_levels?: string[] | null;
  created_by: string | null;
  created_at: string | null;
};

export type AssignmentMaterialLink = {
  id: string;
  material_id: string | null;
  textbook_id?: string | null;
  crossword_id?: string | null;
  branch_type?: string | null;
};

export type MaterialWithProgress = MaterialDbRow & {
  totalAssignments: number;
  completedAssignments: number;
  progress: number;
  /** Доступ к БАЗОВОМУ материалу (обратная совместимость). */
  hasAccess: boolean;
  /** Доступ к связанному PRO-материалу. */
  hasProAccess: boolean;
  /** Режим доступа к связке «База + PRO». */
  accessMode: MaterialAccessMode;
  /** Связанный PRO-материал (если привязан админом), иначе null. */
  pro: MaterialProLink | null;
};

export type MaterialCreateInput = {
  branch_type: string;
  material_kind: MaterialKind;
  title: string;
  description?: string | null;
  cover_image_url?: string | null;
  is_available?: boolean;
  is_demo?: boolean;
  order_index?: number;
  price?: number;
  class_levels?: string[];
  target_levels?: string[];
  project_tab_id?: string | null;
  is_pro?: boolean;
  pro_material_id?: string | null;
  checkout_description?: string | null;
};

export type MaterialUpdateInput = Partial<MaterialCreateInput> & {
  is_active?: boolean;
};

export type PurchaseRequestMaterialKind = MaterialKind;

export type PurchaseRequestTarget = {
  branch_type: string;
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
  branch_type: string;
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