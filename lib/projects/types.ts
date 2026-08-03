// lib/projects/types.ts
// Типы для динамической системы проектов (читается из БД).
// Совместим по форме с lib/branches/types.ts, чтобы старый код мог
// постепенно переехать на новый источник данных.

/** Slug проекта = старый branch_type ("olympiad", "gatehouse", ...). Открытый тип. */
export type ProjectSlug = string;

/** Идентификатор таба (slug таба внутри проекта). */
export type ProjectTabSlug = string;

/** Код уровня проекта ("hippo_1", "stage_1", "A1", ...). */
export type ProjectLevelCode = string;

// ---------------------------------------------------------------------------
// СТРОКИ ИЗ БД (raw rows)
// ---------------------------------------------------------------------------

export type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  theme_color: string | null;
  fallback_icon: string | null;
  is_active: boolean;
  order_index: number;
  theme: ProjectThemeJson | null;
  features: ProjectFeaturesJson | null;
  ui_texts: ProjectUiTextsJson | null;
  created_at: string | null;
  updated_at: string | null;
  sheet_name: string | null; // Название листа в Google Таблице (например "Заявки Hippo")
};

export type ProjectTabRow = {
  id: string;
  project_id: string | null;
  slug: string;
  title: string;
  component_type: string;
  material_kind: string | null;
  icon: string | null;
  order_index: number | null;
  is_active: boolean | null;
  is_hidden: boolean;
  features: Record<string, unknown>;
  ui_texts: Record<string, unknown>;
};

export type ProjectLevelRow = {
  id: string;
  project_id: string;
  code: string;
  label: string;
  short_label: string | null;
  level_group: string | null;
  order_index: number;
  description: string | null;
  is_active: boolean;
};

// ---------------------------------------------------------------------------
// JSONB-ПОДСТРУКТУРЫ (некоторые поля опциональны для устойчивости)
// ---------------------------------------------------------------------------

export type ProjectThemeJson = {
  tone?: string;
  rootClassName?: string;
  cssFile?: string | null;
  fontFamily?: string;
  colors?: Partial<ProjectThemeColors> & Record<string, string | undefined>;
};

export type ProjectFeaturesJson = {
  avatars?: boolean;
  leaderboard?: boolean;
  profileProgress?: boolean;
  requestMode?: "class_level" | "target_levels";
  [key: string]: unknown;
};

export type ProjectUiTextsJson = {
  label?: string;
  shortLabel?: string;
  adminLabel?: string;
  portalTitle?: string;
  portalSubtitle?: string;
  portalDescription?: string;
  portalBadge?: string;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// НОРМАЛИЗОВАННЫЕ КОНФИГИ (то, что получает фронтенд)
// ---------------------------------------------------------------------------

export type ProjectThemeColors = {
  pageBg: string;
  cardBg: string;
  cardBgSoft: string;
  primary: string;
  primarySoft: string;
  secondary: string;
  accent: string;
  accentSoft: string;
  text: string;
  muted: string;
  border: string;
  glow: string;
};

export type ProjectThemeConfig = {
  tone: string;
  rootClassName: string;
  cssFile?: string | null;
  fontFamily: string;
  colors: ProjectThemeColors;
};

export type ProjectTabConfig = {
  id: string;
  slug: string;
  title: string;
  componentType: string;
  materialKind: string | null;
  icon: string;
  orderIndex: number;
  isActive: boolean;
  isHidden: boolean;
  isPlaceholder: boolean;
  uiTexts: ProjectUiTextsJson;
};

export type ProjectLevelConfig = {
  id: string;
  code: string;
  label: string;
  shortLabel: string;
  group: string;
  order: number;
  description: string;
};

/** Маршруты проекта. Для известных slug — legacy-роуты, для новых — /projects/[slug]/* */
export type ProjectRouteConfig = {
  portal: string;
  profile: string;
  materials: string;
  requests: string;
  assignment: (id: string) => string;
  material: (id: string) => string;
};

export type ProjectPortalCardConfig = {
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  href: string;
  image: { src: string; alt: string } | null;
  fallbackIcon: string;
};

/**
 * Полный конфиг проекта — аналог BranchConfig из lib/branches,
 * но собирается из БД.
 */
export type ProjectConfig = {
  // Идентификация
  id: string;
  slug: ProjectSlug;
  /** Совпадает с legacy branch_type (slug = branch_type). */
  type: ProjectSlug;

  // Тексты
  name: string;
  label: string;
  shortLabel: string;
  adminLabel: string;
  description: string;

  // Структура
  isActive: boolean;
  orderIndex: number;
  fallbackIcon: string;
  themeColor: string;
  sheetName: string | null;

  // Подконфиги
  theme: ProjectThemeConfig;
  features: ProjectFeaturesJson;
  uiTexts: ProjectUiTextsJson;
  routes: ProjectRouteConfig;
  portalCard: ProjectPortalCardConfig;
  tabs: ProjectTabConfig[];
  levels: ProjectLevelConfig[];
};