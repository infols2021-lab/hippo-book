// lib/projects/levels.ts
// Работа с уровнями проекта (обобщение lib/exams/levels.ts).
// Уровни теперь живут в БД (table: project_levels).

import type { ProjectLevelCode, ProjectLevelConfig, ProjectSlug } from "./types";
import { requireProject } from "./loader";

// ---------------------------------------------------------------------------
// СИНОНИМЫ (для устойчивости к раскладке/пробелам/дефисам)
// ---------------------------------------------------------------------------

/**
 * Карта алиасов уровня. Применяется для известной группы CEFR/Stage,
 * чтобы "a1", "A 1", "stage-1" и т.п. сводились к каноническому коду.
 */
const COMMON_ALIASES: Record<string, string> = {
  // CEFR
  a1: "A1", "a 1": "A1", "a-1": "A1",
  a2: "A2", "a 2": "A2", "a-2": "A2",
  b1: "B1", "b 1": "B1", "b-1": "B1",
  b2: "B2", "b 2": "B2", "b-2": "B2",
  c1: "C1", "c 1": "C1", "c-1": "C1",
  c2: "C2", "c 2": "C2", "c-2": "C2",

  // Stage (Gatehouse)
  stage_1: "stage_1", stage1: "stage_1", "stage 1": "stage_1", "stage-1": "stage_1",
  stage_2: "stage_2", stage2: "stage_2", "stage 2": "stage_2", "stage-2": "stage_2",
  stage_3: "stage_3", stage3: "stage_3", "stage 3": "stage_3", "stage-3": "stage_3",
};

// ---------------------------------------------------------------------------
// УТИЛИТЫ
// ---------------------------------------------------------------------------

/** Нормализованная форма строки для сравнения (без пробелов/дефисов, lower). */
function normalizeKey(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[-]+/g, "_");
}

/** Приводит произвольное значение к каноническому коду уровня проекта. */
export function normalizeProjectLevel(value: unknown): ProjectLevelCode | null {
  if (typeof value !== "string") return null;

  const raw = value.trim();
  if (!raw) return null;

  if (COMMON_ALIASES[raw]) return COMMON_ALIASES[raw];

  const key = normalizeKey(raw);
  if (COMMON_ALIASES[key]) return COMMON_ALIASES[key];

  return raw;
}

/**
 * Нормализует массив уровней (например из target_levels[]).
 * Дедуплицирует, сохраняя порядок первого вхождения.
 */
export function normalizeProjectLevels(values: unknown): ProjectLevelCode[] {
  const src = Array.isArray(values) ? values : values == null ? [] : [values];

  const seen = new Set<string>();
  const out: ProjectLevelCode[] = [];

  for (const v of src) {
    const code = normalizeProjectLevel(v);
    if (!code) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }

  return out;
}

// ---------------------------------------------------------------------------
// API (серверный — требует проект из БД)
// ---------------------------------------------------------------------------

/** Все уровни проекта, отсортированные по order_index. */
export async function getProjectLevels(slug: ProjectSlug): Promise<ProjectLevelConfig[]> {
  const project = await requireProject(slug);
  return project.levels;
}

/** Коды уровней проекта. */
export async function getProjectLevelCodes(slug: ProjectSlug): Promise<ProjectLevelCode[]> {
  const levels = await getProjectLevels(slug);
  return levels.map((l) => l.code);
}

/** Найти уровень по коду (с учётом алиасов). */
export async function findProjectLevel(
  slug: ProjectSlug,
  code: unknown,
): Promise<ProjectLevelConfig | null> {
  const target = normalizeProjectLevel(code);
  if (!target) return null;

  const levels = await getProjectLevels(slug);
  const byCode = new Map(levels.map((l) => [l.code, l]));

  return byCode.get(target) ?? null;
}

/** Метка уровня (label) по коду. */
export async function getProjectLevelLabel(slug: ProjectSlug, code: unknown): Promise<string> {
  const level = await findProjectLevel(slug, code);
  return level?.label ?? "—";
}

/** Описание уровня по коду. */
export async function getProjectLevelDescription(slug: ProjectSlug, code: unknown): Promise<string> {
  const level = await findProjectLevel(slug, code);
  return level?.description ?? "";
}

/**
 * Фильтрует массив кодов, оставляя только валидные для проекта.
 * Полезно при выдаче доступов: не выдать несуществующий уровень.
 */
export async function filterValidLevels(
  slug: ProjectSlug,
  codes: unknown[],
): Promise<ProjectLevelCode[]> {
  const allowed = new Set(await getProjectLevelCodes(slug));
  const requested = normalizeProjectLevels(codes);
  return requested.filter((c) => allowed.has(c));
}

/** Сортирует коды уровней по order_index проекта. */
export async function sortProjectLevels(
  slug: ProjectSlug,
  codes: unknown[],
): Promise<ProjectLevelCode[]> {
  const levels = await getProjectLevels(slug);
  const order = new Map(levels.map((l) => [l.code, l.order]));

  const requested = normalizeProjectLevels(codes);
  return requested.sort((a, b) => (order.get(a) ?? 9999) - (order.get(b) ?? 9999));
}

/** Красивое отображение списка уровней через запятую. */
export async function formatProjectLevels(slug: ProjectSlug, values: unknown): Promise<string> {
  const codes = normalizeProjectLevels(values);
  if (codes.length === 0) return "—";

  const levels = await getProjectLevels(slug);
  const byCode = new Map(levels.map((l) => [l.code, l]));

  return codes
    .map((c) => byCode.get(c)?.label ?? c)
    .join(", ");
}
