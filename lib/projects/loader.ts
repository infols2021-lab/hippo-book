// lib/projects/loader.ts
// Загрузчик конфигов проектов из БД с in-memory кэшем.
// Серверная сторона. Для клиента — тот же API через /api/projects.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ProjectConfig,
  ProjectFeaturesJson,
  ProjectLevelConfig,
  ProjectLevelRow,
  ProjectPortalCardConfig,
  ProjectRouteConfig,
  ProjectRow,
  ProjectSlug,
  ProjectTabConfig,
  ProjectTabRow,
  ProjectThemeColors,
  ProjectThemeConfig,
  ProjectThemeJson,
  ProjectUiTextsJson,
} from "./types";

// ---------------------------------------------------------------------------
// КЭШ
// ---------------------------------------------------------------------------

type CacheEntry = {
  config: ProjectConfig | null;
  fetchedAt: number;
};

type CacheShape = {
  /** Slug → проект. */
  bySlug: Map<ProjectSlug, CacheEntry>;
  /** Полный список (только активные). */
  list: { items: ProjectConfig[]; fetchedAt: number } | null;
};

const TTL_MS = 60_000; // 1 минута

const cache: CacheShape = {
  bySlug: new Map(),
  list: null,
};

export function invalidateProjectsCache() {
  cache.bySlug.clear();
  cache.list = null;
}

function isFresh(fetchedAt: number) {
  return Date.now() - fetchedAt < TTL_MS;
}

// ---------------------------------------------------------------------------
// ДЕФОЛТЫ
// ---------------------------------------------------------------------------

const DEFAULT_COLORS: ProjectThemeColors = {
  pageBg: "#ffffff",
  cardBg: "#ffffff",
  cardBgSoft: "#f8fafc",
  primary: "#10b981",
  primarySoft: "rgba(16,185,129,0.12)",
  secondary: "#22d3ee",
  accent: "#8b5cf6",
  accentSoft: "rgba(139,92,246,0.12)",
  text: "#0f172a",
  muted: "#64748b",
  border: "rgba(15,23,42,0.12)",
  glow: "rgba(16,185,129,0.25)",
};

const DEFAULT_THEME: ProjectThemeConfig = {
  tone: "default",
  rootClassName: "project-default",
  cssFile: null,
  fontFamily: "inherit",
  colors: { ...DEFAULT_COLORS },
};

const DEFAULT_FEATURES: ProjectFeaturesJson = {
  streaks: false,
  titles: false,
  avatars: false,
  leaderboard: false,
  profileProgress: true,
  requestMode: "target_levels",
};

const DEFAULT_UI_TEXTS: ProjectUiTextsJson = {};

// ---------------------------------------------------------------------------
// МАРШРУТЫ
// ---------------------------------------------------------------------------

/**
 * Известные slug → legacy-роуты (старые хардкод-папки app/(app)/...).
 * Для новых веток — универсальный /projects/[slug]/*.
 */
const LEGACY_ROUTES: Partial<Record<ProjectSlug, ProjectRouteConfig>> = {
  olympiad: {
    portal: "/portal",
    profile: "/profile",
    materials: "/materials",
    requests: "/requests",
    assignment: (id) => `/assignment/${id}`,
    material: (id) => `/textbook/${id}`,
  },
  gatehouse: {
    portal: "/portal",
    profile: "/gatehouse/profile",
    materials: "/gatehouse/materials",
    requests: "/gatehouse/requests",
    assignment: (id) => `/gatehouse/assignment/${id}`,
    material: (id) => `/gatehouse/material/${id}`,
  },
};

function buildRoutes(slug: ProjectSlug): ProjectRouteConfig {
  const legacy = LEGACY_ROUTES[slug];
  if (legacy) return legacy;

  const base = `/projects/${slug}`;
  return {
    portal: "/portal",
    profile: `${base}/profile`,
    materials: `${base}/materials`,
    requests: `${base}/requests`,
    assignment: (id) => `${base}/assignment/${id}`,
    material: (id) => `${base}/materials/${id}`,
  };
}

// ---------------------------------------------------------------------------
// МАППЕРЫ (raw row → config)
// ---------------------------------------------------------------------------

function asBoolean(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asInt(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return fallback;
}

function buildTheme(raw: ProjectThemeJson | null): ProjectThemeConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_THEME };

  const incoming = raw.colors ?? {};
  const colors: ProjectThemeColors = { ...DEFAULT_COLORS };
  (Object.keys(colors) as (keyof ProjectThemeColors)[]).forEach((key) => {
    const v = incoming[key];
    if (typeof v === "string" && v.length > 0) colors[key] = v;
  });

  return {
    tone: asString(raw.tone, DEFAULT_THEME.tone),
    rootClassName: asString(raw.rootClassName, DEFAULT_THEME.rootClassName),
    cssFile: typeof raw.cssFile === "string" ? raw.cssFile : null,
    fontFamily: asString(raw.fontFamily, DEFAULT_THEME.fontFamily),
    colors,
  };
}

function buildPortalCard(
  slug: ProjectSlug,
  name: string,
  fallbackIcon: string,
  ui: ProjectUiTextsJson,
  routes: ProjectRouteConfig,
): ProjectPortalCardConfig {
  return {
    title: asString(ui.portalTitle, name),
    subtitle: asString(ui.portalSubtitle, ""),
    description: asString(ui.portalDescription, ""),
    badge: asString(ui.portalBadge, slug),
    href: routes.profile,
    image: null,
    fallbackIcon,
  };
}

function mapTab(row: ProjectTabRow): ProjectTabConfig {
  const ui = (row.ui_texts ?? {}) as ProjectUiTextsJson;
  const isPlaceholder = row.component_type === "placeholder";
  return {
    id: row.id,
    slug: row.slug,
    title: asString(row.title, asString(ui.label, row.slug)),
    componentType: asString(row.component_type, "materials"),
    materialKind: row.material_kind ?? null,
    icon: asString(row.icon, "📁"),
    orderIndex: asInt(row.order_index, 0),
    isActive: asBoolean(row.is_active, true),
    isHidden: asBoolean(row.is_hidden, false),
    isPlaceholder,
    uiTexts: ui,
  };
}

function mapLevel(row: ProjectLevelRow): ProjectLevelConfig {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    shortLabel: asString(row.short_label, row.label),
    group: asString(row.level_group, "custom"),
    order: asInt(row.order_index, 0),
    description: asString(row.description, ""),
  };
}

function buildConfig(row: ProjectRow, tabs: ProjectTabRow[], levels: ProjectLevelRow[]): ProjectConfig {
  const theme = buildTheme(row.theme);
  const features = (row.features ?? {}) as ProjectFeaturesJson;
  const ui = (row.ui_texts ?? {}) as ProjectUiTextsJson;
  const routes = buildRoutes(row.slug);
  const fallbackIcon = asString(row.fallback_icon, "📁");

  return {
    id: row.id,
    slug: row.slug,
    type: row.slug,
    name: row.name,
    label: asString(ui.label, row.name),
    shortLabel: asString(ui.shortLabel, asString(ui.label, row.name)),
    adminLabel: asString(ui.adminLabel, row.name),
    description: asString(row.description, ""),
    isActive: asBoolean(row.is_active, true),
    orderIndex: asInt(row.order_index, 0),
    fallbackIcon,
    themeColor: asString(row.theme_color, DEFAULT_COLORS.primary),
    theme,
    features,
    uiTexts: ui,
    routes,
    portalCard: buildPortalCard(row.slug, row.name, fallbackIcon, ui, routes),
    tabs: tabs
      .filter((t) => t.project_id === row.id)
      .sort((a, b) => asInt(a.order_index, 0) - asInt(b.order_index, 0))
      .map(mapTab),
    levels: levels
      .filter((l) => l.project_id === row.id)
      .sort((a, b) => a.order_index - b.order_index)
      .map(mapLevel),
    // ✅ Фаза 2: добавлено поле sheetName
    sheetName: row.sheet_name ?? null,
    // ✅ Фаза 2: флаг стриков (уже был)
    hasOlympiadStreaks: asBoolean(features.streaks, false),
  };
}

// ---------------------------------------------------------------------------
// ЗАГРУЗКА ИЗ БД
// ---------------------------------------------------------------------------

async function fetchRawProjectBySlug(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, slug: ProjectSlug) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Не удалось загрузить проект ${slug}: ${error.message}`);
  return data as ProjectRow | null;
}

async function fetchRawProjects(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("is_active", true)
    .order("order_index", { ascending: true })
    .order("slug", { ascending: true });

  if (error) throw new Error(`Не удалось загрузить список проектов: ${error.message}`);
  return (data ?? []) as ProjectRow[];
}

async function fetchTabs(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, projectIds: string[]) {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from("project_tabs")
    .select("*")
    .in("project_id", projectIds)
    .order("order_index", { ascending: true, nullsFirst: false });

  if (error) throw new Error(`Не удалось загрузить табы проектов: ${error.message}`);
  return (data ?? []) as ProjectTabRow[];
}

async function fetchLevels(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, projectIds: string[]) {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from("project_levels")
    .select("*")
    .in("project_id", projectIds)
    .order("order_index", { ascending: true });

  if (error) throw new Error(`Не удалось загрузить уровни проектов: ${error.message}`);
  return (data ?? []) as ProjectLevelRow[];
}

// ---------------------------------------------------------------------------
// ПУБЛИЧНЫЕ ФУНКЦИИ
// ---------------------------------------------------------------------------

/** Возвращает полный список активных проектов. */
export async function getProjects(): Promise<ProjectConfig[]> {
  if (cache.list && isFresh(cache.list.fetchedAt)) {
    return cache.list.items;
  }

  const supabase = await createSupabaseServerClient();
  const rows = await fetchRawProjects(supabase);

  const projectIds = rows.map((r) => r.id);
  const [tabs, levels] = await Promise.all([
    fetchTabs(supabase, projectIds),
    fetchLevels(supabase, projectIds),
  ]);

  const items = rows.map((row) => buildConfig(row, tabs, levels));

  cache.list = { items, fetchedAt: Date.now() };
  return items;
}

/** Возвращает конфиг одного проекта по slug. null, если не найден/неактивен. */
export async function getProjectBySlug(slug: unknown): Promise<ProjectConfig | null> {
  const key = typeof slug === "string" ? slug : "";

  const cached = cache.bySlug.get(key);
  if (cached && isFresh(cached.fetchedAt)) return cached.config;

  const supabase = await createSupabaseServerClient();
  const row = await fetchRawProjectBySlug(supabase, key);

  let config: ProjectConfig | null = null;
  if (row && row.is_active) {
    const [tabs, levels] = await Promise.all([
      fetchTabs(supabase, [row.id]),
      fetchLevels(supabase, [row.id]),
    ]);
    config = buildConfig(row, tabs, levels);
  }

  cache.bySlug.set(key, { config, fetchedAt: Date.now() });
  return config;
}

/** Возвращает конфиг проекта. Если не найден — бросает. */
export async function requireProject(slug: unknown): Promise<ProjectConfig> {
  const config = await getProjectBySlug(slug);
  if (!config) throw new Error(`Проект "${slug}" не найден или неактивен.`);
  return config;
}

/** Быстрая проверка: существует ли проект. */
export async function projectExists(slug: unknown): Promise<boolean> {
  const config = await getProjectBySlug(slug);
  return Boolean(config);
}

/** Сбросить кэш (вызывать из админки после изменения данных). */
export { invalidateProjectsCache as invalidateProjectCache };