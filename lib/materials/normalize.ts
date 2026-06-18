// lib/materials/normalize.ts
// Единая точка нормализации для материалов, заданий и связанных сущностей.

// ----------------------------------------------------------------------------
// Базовые утилиты
// ----------------------------------------------------------------------------

/**
 * Приводит значение к строке и обрезает пробелы.
 * Возвращает пустую строку, если значение null/undefined.
 */
export function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/**
 * Приводит значение к строке или возвращает null, если строка пустая.
 */
export function normalizeNullableString(value: unknown): string | null {
  const s = normalizeString(value);
  return s || null;
}

/**
 * Нормализует массив строк: фильтрует пустые и обрезает пробелы.
 */
export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return [];
    // Поддержка JSON-массивов
    if (text.startsWith("[") && text.endsWith("]")) {
      try {
        const parsed = JSON.parse(text);
        return toStringArray(parsed);
      } catch {
        return [];
      }
    }
    // Поддержка строк, разделённых запятыми
    return text.split(",").map((s) => s.trim()).filter(Boolean);
  }
  const single = normalizeString(value);
  return single ? [single] : [];
}

/**
 * Дедуплицирует массив строк.
 */
export function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
}

/**
 * Нормализует булево значение.
 * Поддерживает строки "true", "1", "yes", "y", "да" → true.
 */
export function normalizeBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const s = normalizeString(value).toLowerCase();
  return ["true", "1", "yes", "y", "да"].includes(s);
}

/**
 * Нормализует число (целое или с плавающей точкой).
 * Если число не валидно, возвращает fallback.
 */
export function normalizeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Нормализует целое число (отбрасывает дробную часть).
 */
export function normalizeInteger(value: unknown, fallback = 0): number {
  return Math.trunc(normalizeNumber(value, fallback));
}

/**
 * Нормализует порядковый индекс (неотрицательное целое).
 */
export function normalizeOrderIndex(value: unknown): number {
  return Math.max(0, normalizeInteger(value, 0));
}

/**
 * Нормализует цену (неотрицательное число, по умолчанию 1000).
 */
export function normalizePrice(value: unknown): number {
  const n = normalizeNumber(value, 1000);
  return Math.max(0, n);
}

// ----------------------------------------------------------------------------
// Валидация UUID
// ----------------------------------------------------------------------------

/**
 * Проверяет, является ли строка валидным UUID (v4).
 */
export function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Нормализует UUID: если строка невалидна или является "заглушкой", возвращает null.
 * Заглушки: "00000000-0000-0000-0000-000000000000", "none", "null", "".
 */
export function normalizeUUID(value: unknown): string | null {
  const s = normalizeNullableString(value);
  if (!s) return null;
  if (s === "00000000-0000-0000-0000-000000000000") return null;
  if (s.toLowerCase() === "none" || s.toLowerCase() === "null") return null;
  return isValidUUID(s) ? s : null;
}

// ----------------------------------------------------------------------------
// Ветки (branch_type)
// ----------------------------------------------------------------------------

/**
 * Нормализует branch_type.
 * Возвращает переданную строку в нижнем регистре, или "olympiad" как fallback.
 * Специальные алиасы: "gatehouse", "ga", "ga_exam", "exam", "exams", "gatehouse_awards" → "gatehouse".
 * Для остальных — возвращает как есть (поддержка динамических веток).
 */
export function normalizeBranchType(value: unknown): string {
  const raw = normalizeString(value);
  if (!raw) return "olympiad";
  const lower = raw.toLowerCase();
  if (
    lower === "gatehouse" ||
    lower === "ga" ||
    lower === "ga_exam" ||
    lower === "exam" ||
    lower === "exams" ||
    lower === "gatehouse_awards"
  ) {
    return "gatehouse";
  }
  return lower;
}

// ----------------------------------------------------------------------------
// Типы материалов (material_kind)
// ----------------------------------------------------------------------------

/**
 * Нормализует material_kind.
 * Поддерживает алиасы: "учебник", "textbook" → "textbook"; "кроссворд", "crossword" → "crossword";
 * "пробный тест", "mock_test", "mock-test", "mocktest" → "mock_test".
 * Если тип не распознан, возвращает как есть (поддержка кастомных типов).
 */
export function normalizeMaterialKind(value: unknown): string {
  const raw = normalizeString(value);
  if (!raw) return "material"; // универсальный фолбэк
  const lower = raw.toLowerCase();

  // Алиасы для учебников
  if (lower === "учебник" || lower === "textbook") return "textbook";

  // Алиасы для кроссвордов
  if (lower === "кроссворд" || lower === "crossword") return "crossword";

  // Алиасы для пробных тестов
  if (
    lower === "пробный тест" ||
    lower === "пробные тесты" ||
    lower === "mock_test" ||
    lower === "mock-test" ||
    lower === "mocktest"
  ) {
    return "mock_test";
  }

  // Возвращаем как есть (поддержка будущих типов)
  return lower;
}

/**
 * Нормализует массив material_kind.
 */
export function normalizeMaterialKinds(value: unknown): string[] {
  return uniqueStrings(toStringArray(value).map(normalizeMaterialKind));
}

// ----------------------------------------------------------------------------
// Уровни (target_levels, class_levels)
// ----------------------------------------------------------------------------

/**
 * Нормализует уровни для Gatehouse (Stage / CEFR).
 * Приводит к каноническому виду: "stage_1", "stage_2", "stage_3", "A1", "A2", "B1", "B2", "C1", "C2".
 * Для остальных — возвращает как есть (нижний регистр).
 */
export function normalizeGatehouseLevel(value: unknown): string {
  const raw = normalizeString(value);
  if (!raw) return "";
  const v = raw.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

  if (v === "stage 1" || v === "stage1") return "stage_1";
  if (v === "stage 2" || v === "stage2") return "stage_2";
  if (v === "stage 3" || v === "stage3") return "stage_3";

  const upper = raw.toUpperCase();
  if (["A1", "A2", "B1", "B2", "C1", "C2"].includes(upper)) return upper;

  return v || raw;
}

/**
 * Нормализует массив уровней для Gatehouse.
 */
export function normalizeGatehouseLevels(value: unknown): string[] {
  return uniqueStrings(toStringArray(value).map(normalizeGatehouseLevel));
}

// ----------------------------------------------------------------------------
// Классы (для олимпиад)
// ----------------------------------------------------------------------------

/**
 * Нормализует класс (class_level) — просто обрезает пробелы.
 * Возвращает null, если строка пустая.
 */
export function normalizeClassLevel(value: unknown): string | null {
  return normalizeNullableString(value);
}

/**
 * Нормализует массив классов.
 */
export function normalizeClassLevels(value: unknown): string[] {
  return uniqueStrings(toStringArray(value).map(normalizeString));
}

// ----------------------------------------------------------------------------
// Защита от SQL-инъекций (для поисковых запросов)
// ----------------------------------------------------------------------------

/**
 * Экранирует строку для использования в ILIKE (%...%).
 * Удаляет символы %, _ и \\ (учитывая особенность PostgREST).
 */
export function sanitizeSearchQuery(value: unknown): string {
  const s = normalizeString(value);
  // Экранируем опасные символы для ILIKE: %, _, \
  return s.replace(/[%_\\]/g, (match) => {
    if (match === "%") return "\\%";
    if (match === "_") return "\\_";
    if (match === "\\") return "\\\\";
    return match;
  });
}

// ----------------------------------------------------------------------------
// Slug-валидация
// ----------------------------------------------------------------------------

/**
 * Проверяет, что slug состоит только из латиницы, цифр, дефиса и подчёркивания.
 * Первый символ — буква или цифра (не дефис/подчёркивание).
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-_]*$/i.test(slug);
}

// ----------------------------------------------------------------------------
// Комплексная нормализация материала (для создания/обновления)
// ----------------------------------------------------------------------------

export type NormalizedMaterial = {
  title: string;
  description: string | null;
  cover_image_url: string | null;
  branch_type: string;
  material_kind: string;
  target_levels: string[];
  class_levels: string[];
  is_available: boolean;
  is_active: boolean;
  order_index: number;
  price: number;
  project_tab_id: string | null;
  meta: Record<string, unknown>;
  created_by?: string | null;
};

/**
 * Нормализует входные данные материала для вставки/обновления в БД.
 * Принимает сырой объект body и userId (опционально).
 * Возвращает объект, готовый для Supabase.
 */
export function normalizeMaterialInput(
  body: Record<string, unknown>,
  userId?: string | null,
): NormalizedMaterial {
  // Извлечение всех полей с поддержкой разных вариантов ключей (snake_case / camelCase)
  const title = normalizeString(body.title ?? body.name);
  const description = normalizeNullableString(body.description);
  const cover_image_url = normalizeNullableString(
    body.cover_image_url ?? body.coverImageUrl ?? body.image_url ?? body.imageUrl,
  );
  const branch_type = normalizeBranchType(body.branch_type ?? body.branchType);
  const material_kind = normalizeMaterialKind(body.material_kind ?? body.materialKind);
  const target_levels = uniqueStrings(
    toStringArray(body.target_levels ?? body.target_level ?? body.targetLevels),
  );
  const class_levels = uniqueStrings(
    toStringArray(body.class_levels ?? body.class_level ?? body.classLevels),
  );
  const is_available = normalizeBool(body.is_available ?? body.isAvailable);
  const is_active =
    body.is_active !== undefined ? normalizeBool(body.is_active) : true;
  const order_index = normalizeOrderIndex(body.order_index ?? body.orderIndex);
  const price = normalizePrice(body.price);
  const project_tab_id = normalizeUUID(
    body.project_tab_id ?? body.tab_id ?? body.projectTabId ?? body.tabId,
  );
  const meta =
    body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
      ? (body.meta as Record<string, unknown>)
      : {};

  return {
    title,
    description,
    cover_image_url,
    branch_type,
    material_kind,
    target_levels,
    class_levels,
    is_available,
    is_active,
    order_index,
    price,
    project_tab_id,
    meta,
    created_by: userId ?? null,
  };
}

// ----------------------------------------------------------------------------
// Экспорт всех утилит для удобства
// ----------------------------------------------------------------------------

export default {
  normalizeString,
  normalizeNullableString,
  toStringArray,
  uniqueStrings,
  normalizeBool,
  normalizeNumber,
  normalizeInteger,
  normalizeOrderIndex,
  normalizePrice,
  isValidUUID,
  normalizeUUID,
  normalizeBranchType,
  normalizeMaterialKind,
  normalizeMaterialKinds,
  normalizeGatehouseLevel,
  normalizeGatehouseLevels,
  normalizeClassLevel,
  normalizeClassLevels,
  sanitizeSearchQuery,
  isValidSlug,
  normalizeMaterialInput,
};