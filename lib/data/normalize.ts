export type BranchType = "olympiad" | "gatehouse";
export type MaterialKind = "textbook" | "crossword" | "mock_test" | "coming_soon" | string;

export const OLYMPIAD_BRANCH: BranchType = "olympiad";
export const GATEHOUSE_BRANCH: BranchType = "gatehouse";

export function normalizeString(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

export function normalizeNullableString(value: unknown) {
  const text = normalizeString(value);
  return text ? text : null;
}

export function normalizeId(value: unknown) {
  const text = normalizeString(value);
  return text || null;
}

export function normalizeBranchType(value: unknown): BranchType {
  const text = normalizeString(value).toLowerCase();

  if (text === "gatehouse") return "gatehouse";
  return "olympiad";
}

export function isGatehouseBranch(value: unknown) {
  return normalizeBranchType(value) === "gatehouse";
}

export function isOlympiadBranch(value: unknown) {
  return normalizeBranchType(value) === "olympiad";
}

export function normalizeMaterialKind(value: unknown): MaterialKind {
  const text = normalizeString(value).toLowerCase();

  if (!text) return "mock_test";

  return text
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    const text = value.trim();

    if (!text) return [];

    if (text.startsWith("[") && text.endsWith("]")) {
      try {
        const parsed = JSON.parse(text);
        return normalizeStringArray(parsed);
      } catch {
        return [];
      }
    }

    return text
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function normalizeUniqueStringArray(value: unknown): string[] {
  return Array.from(new Set(normalizeStringArray(value)));
}

export function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const text = normalizeString(value).toLowerCase();

  if (["true", "1", "yes", "y", "да"].includes(text)) return true;
  if (["false", "0", "no", "n", "нет"].includes(text)) return false;

  return fallback;
}

export function normalizeInteger(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

export function normalizeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

export function clampNumber(value: unknown, min: number, max: number, fallback = min) {
  const n = normalizeNumber(value, fallback);
  return Math.max(min, Math.min(max, n));
}

export function clampPercent(value: unknown, fallback = 0) {
  return Math.round(clampNumber(value, 0, 100, fallback));
}

export function normalizeScore(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const score = Number(value);
  if (!Number.isFinite(score)) return null;

  return clampPercent(score);
}

export function normalizeDateString(value: unknown): string | null {
  const text = normalizeString(value);
  if (!text) return null;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

export function formatRuDate(value: unknown, fallback = "—") {
  const text = normalizeString(value);
  if (!text) return fallback;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function getQuestionsCount(content: unknown) {
  const data = content as any;
  return Array.isArray(data?.questions) ? data.questions.length : 0;
}

export function percent(completed: number, total: number) {
  if (!total || total <= 0) return 0;
  return clampPercent((completed / total) * 100);
}

export function compactObject<T extends Record<string, any>>(value: T): Partial<T> {
  const out: Partial<T> = {};

  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    out[key as keyof T] = item;
  }

  return out;
}

export function normalizeProfileName(value: unknown) {
  return normalizeString(value).replace(/\s+/g, " ");
}

export function normalizePhone(value: unknown) {
  return normalizeString(value).replace(/\s+/g, " ");
}

export function safeJsonParse<T = any>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}