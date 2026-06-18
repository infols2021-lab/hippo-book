// lib/requests/normalize.ts
// Единая нормализация данных для заявок (purchase_requests).
// Используется в create/update/delete и админке.

import {
  normalizeString,
  normalizeNullableString,
  toStringArray,
  uniqueStrings,
  normalizeBranchType,
  normalizeGatehouseLevel,
  normalizeMaterialKind,
  normalizeMaterialKinds,
} from "@/lib/materials/normalize";

import {
  formatClassLevel,
  formatGatehouseLevel,
  formatGatehouseLevels,
  formatMaterialKindWithIcon,
} from "@/lib/materials/format";

// ----------------------------------------------------------------------------
// Типы
// ----------------------------------------------------------------------------

export type RequestBranchType = string; // "olympiad", "gatehouse" или динамический slug

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
// Нормализация уровней (target_levels)
// ----------------------------------------------------------------------------

export function normalizeRequestTargetLevels(
  value: unknown,
  branchType: RequestBranchType,
): string[] {
  const raw = toStringArray(value);
  if (branchType === "gatehouse") {
    return uniqueStrings(raw.map((v) => normalizeGatehouseLevel(v)).filter(Boolean));
  }
  return uniqueStrings(raw.map((v) => normalizeString(v)).filter(Boolean));
}

// ----------------------------------------------------------------------------
// Нормализация типов материалов
// ----------------------------------------------------------------------------

export function normalizeRequestMaterialKinds(value: unknown): string[] {
  const raw = toStringArray(value);
  return uniqueStrings(raw.map((v) => normalizeMaterialKind(v)));
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
  const class_level = normalizeNullableString(body.class_level);
  const target_levels = normalizeRequestTargetLevels(
    body.target_levels ?? body.target_level,
    branch_type,
  );
  const textbook_types = normalizeRequestMaterialKinds(
    body.textbook_types ?? body.material_kinds,
  );
  const material_kinds = normalizeRequestMaterialKinds(
    body.material_kinds ?? body.textbook_types,
  );
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
  if (branchType === "gatehouse") {
    return targetLevels.length ? formatGatehouseLevels(targetLevels) : "—";
  }
  if (targetLevels.length > 0 && !classLevel) {
    return targetLevels.join(", ");
  }
  return classLevel ? formatClassLevel(classLevel) : "—";
}

export function formatMaterialTypesForSheet(
  branchType: RequestBranchType,
  kinds: string[],
): string {
  if (branchType === "gatehouse") {
    const typeMap: Record<string, string> = {
      mock_test: "📝 Пробные тесты",
      mock_tests: "📝 Пробные тесты",
      "mock-test": "📝 Пробные тесты",
      "mock test": "📝 Пробные тесты",
      "мок-тест": "📝 Пробные тесты",
      "мок тест": "📝 Пробные тесты",
      "пробный тест": "📝 Пробные тесты",
      "пробные тесты": "📝 Пробные тесты",
    };
    return kinds.map((t) => typeMap[t.toLowerCase()] || t).join(", ");
  }

  const typeMap: Record<string, string> = {
    textbook: "📚 Учебник",
    crossword: "🧩 Кроссворд",
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
    return { valid: false, error: "Выберите тип материала" };
  }
  if (normalized.branch_type === "gatehouse" && normalized.target_levels.length === 0) {
    return { valid: false, error: "Выберите уровень экзамена" };
  }
  if (normalized.branch_type !== "gatehouse" && !normalized.class_level && normalized.target_levels.length === 0) {
    return { valid: false, error: "Выберите класс или уровень" };
  }
  if (!normalized.email || !normalized.full_name) {
    return { valid: false, error: "Заполните email и ФИО" };
  }
  return { valid: true };
}

// ----------------------------------------------------------------------------
// Экспорты для grants/index.ts и admin/requests/route.ts
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
  return toStringArray(raw);
}

export function getRequestMaterialKinds(r: ReqRowLike): string[] {
  const raw = r.material_kinds ?? r.textbook_types ?? [];
  return normalizeRequestMaterialKinds(raw);
}

// ----------------------------------------------------------------------------
// Реэкспорты из материалов (для удобства импорта в одном месте)
// ----------------------------------------------------------------------------

export {
  normalizeBranchType,
  normalizeGatehouseLevel,
  normalizeString,
  normalizeNullableString,
  toStringArray,
  uniqueStrings,
  normalizeMaterialKind,
  normalizeMaterialKinds,
};

// ----------------------------------------------------------------------------
// Вспомогательные функции для работы с массивами (используются в admin/requests)
// ----------------------------------------------------------------------------

export function toArr(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v.map(String).map((x) => x.trim()).filter(Boolean);
  }
  if (typeof v === "string") {
    const text = v.trim();
    if (!text) return [];
    if (text.startsWith("[") && text.endsWith("]")) {
      try {
        return toArr(JSON.parse(text));
      } catch {
        return [];
      }
    }
    return text.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return [String(v).trim()].filter(Boolean);
}

export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function overlaps(a: string[], b: string[]): boolean {
  const set = new Set(a.map(String));
  return b.some((x) => set.has(String(x)));
}

export function overlapsGatehouseLevels(a: string[], b: string[]): boolean {
  const aa = a.map(normalizeGatehouseLevel).filter(Boolean);
  const bb = b.map(normalizeGatehouseLevel).filter(Boolean);
  return overlaps(aa, bb);
}

export function normalizeGatehouseMaterialKind(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (
    raw === "mock_test" ||
    raw === "mock_tests" ||
    raw === "mock-test" ||
    raw === "mock test" ||
    raw === "мок-тест" ||
    raw === "мок тест" ||
    raw === "пробный тест" ||
    raw === "пробные тесты"
  ) {
    return "mock_test";
  }
  return raw;
}

export function normalizeGatehouseMaterialKinds(types: any): string[] {
  return uniq(toArr(types).map(normalizeGatehouseMaterialKind).filter(Boolean));
}

export function formatBranchLabel(branchType: RequestBranchType): string {
  if (branchType === "gatehouse") return "🎓 Gatehouse Awards";
  if (branchType === "olympiad") return "🏆 Олимпиада";
  return `📁 ${branchType.charAt(0).toUpperCase() + branchType.slice(1)}`;
}