// lib/api/validate.ts
// Утилиты для валидации и санитизации данных в API-роутах.

// ----------------------------------------------------------------------------
// UUID
// ----------------------------------------------------------------------------

/**
 * Проверяет, является ли строка валидным UUID (версия 4).
 * Формат: 8-4-4-4-12 шестнадцатеричных символов.
 */
export function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Нормализует и проверяет UUID.
 * Если строка пустая, null, undefined или является заглушкой ("00000000-...", "none", "null") — возвращает null.
 * Иначе возвращает строку, если она валидный UUID.
 */
export function normalizeUUID(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  // Заглушки
  if (
    s === "00000000-0000-0000-0000-000000000000" ||
    s.toLowerCase() === "none" ||
    s.toLowerCase() === "null"
  ) {
    return null;
  }
  return isValidUUID(s) ? s : null;
}

// ----------------------------------------------------------------------------
// Slug
// ----------------------------------------------------------------------------

/**
 * Проверяет, что slug состоит только из латиницы, цифр, дефиса и подчёркивания.
 * Первый символ — буква или цифра (не дефис/подчёркивание).
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-_]*$/i.test(slug);
}

/**
 * Нормализует slug: приводит к нижнему регистру, удаляет лишние пробелы,
 * заменяет пробелы на дефисы, удаляет недопустимые символы.
 */
export function normalizeSlug(value: unknown): string {
  let s = typeof value === "string" ? value.trim().toLowerCase() : "";
  s = s.replace(/\s+/g, "-");
  s = s.replace(/[^a-z0-9-_]/g, "");
  return s;
}

// ----------------------------------------------------------------------------
// Санитизация поисковых запросов (для ILIKE)
// ----------------------------------------------------------------------------

const POSTGREST_FILTER_METACHAR_RE = /[,().]/g;
const MAX_SEARCH_QUERY_LENGTH = 120;

/**
 * Экранирует строку для безопасного использования в ILIKE-запросах PostgREST.
 * Удаляет или экранирует символы %, _ и \, а также метасимволы фильтра PostgREST
 * (запятая, скобки, точка), чтобы предотвратить инъекцию в .or()-фильтры.
 */
export function sanitizeSearchQuery(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value).trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
  const withoutFilterMeta = s.replace(POSTGREST_FILTER_METACHAR_RE, " ");
  // Экранируем опасные символы для ILIKE: %, _, \
  return withoutFilterMeta.replace(/[%_\\]/g, (match) => {
    if (match === "%") return "\\%";
    if (match === "_") return "\\_";
    if (match === "\\") return "\\\\";
    return match;
  });
}

/**
 * Оборачивает значение в двойные кавычки для безопасной подстановки в PostgREST .or().
 */
export function quotePostgrestFilterValue(value: string): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/**
 * Строит безопасный OR-фильтр ilike для нескольких колонок.
 */
export function buildIlikeOrFilter(columns: readonly string[], pattern: string): string {
  const quoted = quotePostgrestFilterValue(sanitizeLikeQuery(pattern));
  return columns.map((column) => `${column}.ilike.${quoted}`).join(",");
}

/**
 * Санитизирует строку и добавляет wildcards для поиска по частичному совпадению.
 * Например: "john" -> "%john%"
 */
export function sanitizeLikeQuery(value: unknown): string {
  const s = sanitizeSearchQuery(value);
  if (!s) return "";
  return `%${s}%`;
}

// ----------------------------------------------------------------------------
// Общие валидации
// ----------------------------------------------------------------------------

/**
 * Проверяет, что значение является непустой строкой.
 */
export function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Проверяет, что значение является положительным целым числом.
 */
export function isPositiveInteger(value: unknown): boolean {
  if (typeof value === "number") return Number.isInteger(value) && value > 0;
  if (typeof value === "string") {
    const num = Number.parseInt(value, 10);
    return Number.isInteger(num) && num > 0 && String(num) === value.trim();
  }
  return false;
}

/**
 * Проверяет, что значение является допустимым email (базовая проверка).
 */
export function isValidEmail(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// ----------------------------------------------------------------------------
// Домены для редиректов (open redirect protection)
// ----------------------------------------------------------------------------

/**
 * Проверяет, что URL ведёт на разрешённый домен (защита от open redirect).
 * Разрешены только домены из переменной окружения APP_ALLOWED_REDIRECT_DOMAINS
 * или, если не задана, использует домен приложения из NEXT_PUBLIC_APP_URL.
 */
export function isAllowedRedirectUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, "http://localhost"); // базовый URL для относительных
    const hostname = parsed.hostname.toLowerCase();

    // Если это относительный путь (без протокола), считаем безопасным
    if (!parsed.protocol || parsed.protocol === "http:" || parsed.protocol === "https:") {
      // Если путь начинается с / и нет домена, считаем безопасным (относительный)
      if (url.startsWith("/") && !url.startsWith("//")) {
        return true;
      }
    }

    // Разрешённые домены из окружения
    const allowedEnv = process.env.APP_ALLOWED_REDIRECT_DOMAINS;
    let allowedDomains: string[] = [];

    if (allowedEnv) {
      allowedDomains = allowedEnv.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
    } else {
      // Fallback: из NEXT_PUBLIC_APP_URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
      if (appUrl) {
        try {
          const appParsed = new URL(appUrl);
          allowedDomains = [appParsed.hostname.toLowerCase()];
        } catch {
          // если не удалось распарсить, используем пустой список
        }
      }
    }

    // Если список разрешённых доменов пуст — запрещаем все внешние редиректы
    if (allowedDomains.length === 0) {
      return false;
    }

    // Проверяем, что хост входит в список разрешённых
    return allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    // Если URL не удалось распарсить — считаем небезопасным
    return false;
  }
}

// ----------------------------------------------------------------------------
// Экспорт всех функций для удобства
// ----------------------------------------------------------------------------

export default {
  isValidUUID,
  normalizeUUID,
  isValidSlug,
  normalizeSlug,
  sanitizeSearchQuery,
  sanitizeLikeQuery,
  quotePostgrestFilterValue,
  buildIlikeOrFilter,
  isNonEmptyString,
  isPositiveInteger,
  isValidEmail,
  isAllowedRedirectUrl,
};