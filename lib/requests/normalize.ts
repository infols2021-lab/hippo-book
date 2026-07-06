// lib/requests/normalize.ts
// Единая нормализация данных для заявок (purchase_requests).
// Production-ready: полностью удалены легаси-зависимости gatehouse и format.ts

import {
  normalizeString,
  normalizeNullableString,
  toStringArray,
  uniqueStrings,
  normalizeBranchType,
  normalizeMaterialKind,
  normalizeTargetLevels,
} from "@/lib/materials/normalize";

// ----------------------------------------------------------------------------
// Типы
// ----------------------------------------------------------------------------

export type RequestBranchType = string;

export type NormalizedRequest = {
  branch_type: RequestBranchType;
  class_level: string | null;
  target_levels: string[];
  textbook_types: string[];
  material_kinds: string[];
  email: string;
  full_name: string;
  contact_phone: string | null;
  is_processed: boolean;
};

// ----------------------------------------------------------------------------
// Нормализация массивов и строк
// ----------------------------------------------------------------------------

// 🔥 ИСПРАВЛЕНИЕ: Жесткая нормализация для class_level ("Stage 1" -> "stage_1")
export function normalizeLevelCode(value: unknown): string | null {
  const s = normalizeNullableString(value);
  if (!s) return null;
  return s.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, "_");
}

export function normalizeRequestTargetLevels(value: unknown): string[] {
  return normalizeTargetLevels(value);
}

export function normalizeRequestMaterialKinds(value: unknown): string[] {
  return uniqueStrings(toStringArray(value).map(v => normalizeMaterialKind(v)));
}

// ----------------------------------------------------------------------------
// Полная нормализация заявки (из body)
// ----------------------------------------------------------------------------

export function normalizeRequestPayload(
  body: Record<string, unknown>,
  profileEmail?: string,
  profileFullName?: string,
  profilePhone?: string,
): NormalizedRequest {
  const branch_type = normalizeBranchType(body.branch_type ?? "olympiad");
  
  // 🔥 ИСПРАВЛЕНИЕ: Теперь в базу летит только технический код
  const class_level = normalizeLevelCode(body.class_level);
  
  // Умный фолбэк если пришел class_level но нет target_levels мы дублируем данные
  // чтобы универсальная валидация проходила для всех проектов
  const rawTargetLevels = body.target_levels ?? body.target_level;
  const target_levels = normalizeRequestTargetLevels(
    rawTargetLevels !== undefined ? rawTargetLevels : (class_level ? [class_level] : [])
  );
  
  const textbook_types = normalizeRequestMaterialKinds(body.textbook_types ?? body.material_kinds);
  const material_kinds = normalizeRequestMaterialKinds(body.material_kinds ?? body.textbook_types);
  
  const email = normalizeString(profileEmail ?? body.email);
  const full_name = normalizeString(profileFullName ?? body.full_name);
  const contact_phone = normalizeNullableString(profilePhone ?? body.contact_phone);

  return {
    branch_type,
    class_level,
    target_levels,
    textbook_types,
    material_kinds,
    email,
    full_name,
    contact_phone,
    is_processed: false,
  };
}

// ----------------------------------------------------------------------------
// Генерация номера заявки
// ----------------------------------------------------------------------------

export function generateRequestNumber(
  branchType: RequestBranchType,
  customPrefix?: string,
): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();

  let prefix = "PR";
  if (customPrefix) {
    prefix = customPrefix.toUpperCase();
  } else if (branchType === "gatehouse") {
    prefix = "GA";
  } else if (branchType !== "olympiad") {
    prefix = branchType.substring(0, 2).toUpperCase();
  }

  return `${prefix}-${yyyy}${mm}${dd}-${random}`;
}

// ----------------------------------------------------------------------------
// Форматирование для Google Sheets (A:G)
// ----------------------------------------------------------------------------

export function formatDateTimeRU(dateString: string): string {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRequestStatus(isProcessed: boolean, processedAt?: string | null): string {
  if (!isProcessed) return "⏳ Ожидает";
  if (processedAt) return `✅ Обработана · ${formatDateTimeRU(processedAt)}`;
  return "✅ Обработана";
}

export function formatTargetForSheet(
  branchType: RequestBranchType,
  classLevel: string | null,
  targetLevels: string[],
): string {
  if (targetLevels.length > 0) return targetLevels.join(", ");
  return classLevel ? classLevel : "—";
}

export function formatMaterialTypesForSheet(
  branchType: RequestBranchType,
  kinds: string[],
): string {
  const typeMap: Record<string, string> = {
    mock_test: "📝 Пробные тесты",
    textbook: "📚 Учебник",
    crossword: "🧩 Кроссворд",
    material: "📁 Материалы"
  };
  return kinds.map((t) => typeMap[t.toLowerCase()] || t).join(", ");
}

export function buildSheetValues(
  requestNumber: string,
  createdAt: string,
  branchType: RequestBranchType,
  classLevel: string | null,
  targetLevels: string[],
  materialKinds: string[],
  email: string,
  fullName: string,
  isProcessed: boolean,
  processedAt?: string | null,
): string[] {
  return [
    requestNumber,
    formatDateTimeRU(createdAt),
    formatTargetForSheet(branchType, classLevel, targetLevels),
    formatMaterialTypesForSheet(branchType, materialKinds),
    email,
    fullName,
    formatRequestStatus(isProcessed, processedAt),
  ];
}

// ----------------------------------------------------------------------------
// Валидация
// ----------------------------------------------------------------------------

export function validateRequest(normalized: NormalizedRequest): {
  valid: boolean;
  error?: string;
} {
  if (!normalized.textbook_types.length && !normalized.material_kinds.length) {
    return { valid: false, error: "Выберите раздел материалов" };
  }
  
  // Универсальная проверка для всех проектов
  // Если есть хотя бы один из параметров уровня валидация проходит
  if (!normalized.class_level && normalized.target_levels.length === 0) {
    return { valid: false, error: "Выберите класс или уровень" };
  }
  
  if (!normalized.email || !normalized.full_name) {
    return { valid: false, error: "Заполните email и ФИО" };
  }
  
  return { valid: true };
}

// ----------------------------------------------------------------------------
// Экспорты для admin/requests/route.ts
// ----------------------------------------------------------------------------

export type ReqRowLike = {
  target_levels?: unknown;
  target_level?: unknown;
  material_kinds?: unknown;
  textbook_types?: unknown;
  class_level?: unknown;
  branch_type?: unknown;
};

export function getRequestTargetLevels(r: ReqRowLike): string[] {
  const raw = r.target_levels ?? r.target_level ?? [];
  // 🔥 ИСПРАВЛЕНИЕ: Читаем старые заявки корректно, превращая их уровни в коды
  return normalizeTargetLevels(raw);
}

export function getRequestMaterialKinds(r: ReqRowLike): string[] {
  const raw = r.material_kinds ?? r.textbook_types ?? [];
  return normalizeRequestMaterialKinds(raw);
}

// ----------------------------------------------------------------------------
// Реэкспорты из материалов (для маршрутов create/update)
// ----------------------------------------------------------------------------

export {
  normalizeBranchType,
  normalizeString,
  normalizeNullableString,
  toStringArray,
  uniqueStrings,
  normalizeMaterialKind,
};

// ----------------------------------------------------------------------------
// Вспомогательные функции для массивов
// ----------------------------------------------------------------------------

export function toArr(v: any): string[] {
  return toStringArray(v);
}

export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function overlaps(a: string[], b: string[]): boolean {
  const set = new Set(a.map(String));
  return b.some((x) => set.has(String(x)));
}

export function formatBranchLabel(branchType: RequestBranchType): string {
  if (branchType === "gatehouse") return "🎓 Gatehouse Awards";
  if (branchType === "olympiad") return "🏆 Олимпиада";
  return `📁 ${branchType.charAt(0).toUpperCase() + branchType.slice(1)}`;
}