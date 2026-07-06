// lib/materials/normalize.ts
// Единая точка нормализации для материалов, доступов и связанных сущностей.
// Production-ready версия: строгая типизация, полная динамика, защита от мусорных данных.

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
 * Поддерживает JSON-массивы и строки, разделённые запятыми.
 */
export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return [];
    
    if (text.startsWith("[") && text.endsWith("]")) {
      try {
        return toStringArray(JSON.parse(text));
      } catch {
        return [];
      }
    }
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
 */
export function normalizeNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === "") return fallback;
  
  // Если пришла строка, меняем запятую на точку и убираем пробелы (защита от кривого ввода)
  let parsedValue = value;
  if (typeof value === "string") {
    parsedValue = value.replace(/,/g, ".").replace(/\s/g, "");
  }
  
  const n = Number(parsedValue);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Нормализует порядковый индекс (неотрицательное целое).
 */
export function normalizeOrderIndex(value: unknown): number {
  return Math.max(0, Math.trunc(normalizeNumber(value, 0)));
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
 * Нормализует UUID: убивает любые "костыли" фронтенда ("none", "null", нули).
 * Если строка невалидна, возвращает настоящий SQL null.
 */
export function normalizeUUID(value: unknown): string | null {
  const s = normalizeNullableString(value);
  if (!s) return null;
  
  const lower = s.toLowerCase();
  if (
    lower === "00000000-0000-0000-0000-000000000000" || 
    lower === "none" || 
    lower === "null" ||
    lower === "undefined"
  ) {
    return null;
  }
  
  return isValidUUID(s) ? s : null;
}

// ----------------------------------------------------------------------------
// Динамическая классификация (Ветки и Типы)
// ----------------------------------------------------------------------------

/**
 * Нормализует branch_type.
 * Обрабатывает легаси-алиасы, но пропускает любые новые динамические ветки как есть.
 */
export function normalizeBranchType(value: unknown): string {
  const raw = normalizeString(value);
  if (!raw) return "olympiad"; // Базовый фолбэк
  
  const lower = raw.toLowerCase();
  // Легаси алиасы для обратной совместимости
  if (["gatehouse", "ga", "ga_exam", "exam", "exams", "gatehouse_awards"].includes(lower)) {
    return "gatehouse";
  }
  
  return lower; // Полная поддержка новых динамических веток
}

/**
 * Нормализует material_kind.
 * Идеально для универсальной таблицы materials. Поддерживает любые новые типы.
 */
export function normalizeMaterialKind(value: unknown): string {
  const raw = normalizeString(value);
  if (!raw) return "material"; 
  
  const lower = raw.toLowerCase();
  // Легаси алиасы
  if (["учебник", "textbook"].includes(lower)) return "textbook";
  if (["кроссворд", "crossword"].includes(lower)) return "crossword";
  if (["пробный тест", "пробные тесты", "mock_test", "mock-test", "mocktest"].includes(lower)) return "mock_test";

  return lower; // Поддержка кастомных типов (например "video", "audio", "interactive")
}

// ----------------------------------------------------------------------------
// Уровни и Классы
// ----------------------------------------------------------------------------

/**
 * Нормализует массивы уровней и классов.
 */
export function normalizeTargetLevels(value: unknown): string[] {
  return uniqueStrings(toStringArray(value).map(s => s.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, "_")));
}

export function normalizeClassLevels(value: unknown): string[] {
  return uniqueStrings(toStringArray(value));
}

// ----------------------------------------------------------------------------
// Комплексная нормализация материала (Главный экспорт для API)
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
  project_tab_id: string | null;
  meta: Record<string, unknown>;
  created_by?: string | null;
};

/**
 * ГЛАВНАЯ ФУНКЦИЯ: Нормализует входящий JSON (body) в идеальный объект для БД.
 * Решает проблемы со snake_case / camelCase и потерянными полями.
 */
export function normalizeMaterialInput(
  body: Record<string, unknown>,
  userId?: string | null,
): NormalizedMaterial {
  // Гарантируем, что body это объект
  const safeBody = body && typeof body === "object" ? body : {};

  return {
    title: normalizeString(safeBody.title ?? safeBody.name),
    description: normalizeNullableString(safeBody.description),
    cover_image_url: normalizeNullableString(
      safeBody.cover_image_url ?? safeBody.coverImageUrl ?? safeBody.image_url ?? safeBody.imageUrl
    ),
    branch_type: normalizeBranchType(safeBody.branch_type ?? safeBody.branchType),
    material_kind: normalizeMaterialKind(safeBody.material_kind ?? safeBody.materialKind),
    
    target_levels: normalizeTargetLevels(safeBody.target_levels ?? safeBody.target_level ?? safeBody.targetLevels),
    class_levels: normalizeClassLevels(safeBody.class_levels ?? safeBody.class_level ?? safeBody.classLevels),
    
    is_available: normalizeBool(safeBody.is_available ?? safeBody.isAvailable ?? true),
    is_active: normalizeBool(safeBody.is_active ?? safeBody.isActive ?? true),
    
    order_index: normalizeOrderIndex(safeBody.order_index ?? safeBody.orderIndex),
    
    // БАГ С ID ВКЛАДКИ ИСПРАВЛЕН ЗДЕСЬ: "none" превратится в null
    project_tab_id: normalizeUUID(
      safeBody.project_tab_id ?? safeBody.tab_id ?? safeBody.projectTabId ?? safeBody.tabId
    ),
    
    meta: safeBody.meta && typeof safeBody.meta === "object" && !Array.isArray(safeBody.meta)
      ? (safeBody.meta as Record<string, unknown>)
      : {},
      
    created_by: userId ?? null,
  };
}

// ----------------------------------------------------------------------------
// Экспорт
// ----------------------------------------------------------------------------

export default {
  normalizeString,
  normalizeNullableString,
  toStringArray,
  uniqueStrings,
  normalizeBool,
  normalizeNumber,
  normalizeOrderIndex,
  isValidUUID,
  normalizeUUID,
  normalizeBranchType,
  normalizeMaterialKind,
  normalizeTargetLevels,
  normalizeClassLevels,
  normalizeMaterialInput,
};