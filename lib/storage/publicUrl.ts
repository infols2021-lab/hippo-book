// lib/storage/publicUrl.ts
const STORAGE_PROXY_PREFIX = "/api/storage/public";

type PrimitiveQueryValue = string | number | boolean | null | undefined;

export type StoragePublicUrlOptions = {
  searchParams?: Record<string, PrimitiveQueryValue>;
  cacheBust?: boolean | string | number;
};

export type StoragePublicUrlInput = {
  bucket: string;
  path: string | string[];
} & StoragePublicUrlOptions;

/** Максимальное время кеширования (1 год) */
const LONG_CACHE_MAX_AGE = "31536000";

function cleanPart(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

export function normalizeStoragePath(path: string | string[]) {
  if (Array.isArray(path)) {
    // фильтруем пустые и чистим каждый сегмент
    return path.map(part => cleanPart(String(part))).filter(Boolean).join("/");
  }
  return String(path || "")
    .split("/")
    .map(part => cleanPart(part))
    .filter(Boolean)
    .join("/");
}

function appendSearchParams(url: string, options?: StoragePublicUrlOptions) {
  const params = new URLSearchParams();

  if (options?.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      if (value === null || value === undefined || value === "") continue;
      params.set(key, String(value));
    }
  }

  if (options?.cacheBust) {
    params.set(
      "v",
      options.cacheBust === true ? String(Date.now()) : String(options.cacheBust)
    );
  }

  const query = params.toString();
  return query ? `${url}?${query}` : url;
}

/**
 * Формирует публичный URL через наш прокси.
 * Всегда отдаёт абсолютный путь, начинающийся с /api/storage/public/...
 */
export function getStoragePublicUrl(
  bucket: string,
  path: string | string[],
  options?: StoragePublicUrlOptions
) {
  const cleanBucket = cleanPart(bucket);
  const cleanPath = normalizeStoragePath(path);

  if (!cleanBucket || !cleanPath) return "";

  const encodedBucket = encodeURIComponent(cleanBucket);
  const encodedPath = cleanPath
    .split("/")
    .map(part => encodeURIComponent(part))
    .join("/");

  const url = `${STORAGE_PROXY_PREFIX}/${encodedBucket}/${encodedPath}`;
  return appendSearchParams(url, options);
}

export function storagePublicUrl(input: StoragePublicUrlInput) {
  return getStoragePublicUrl(input.bucket, input.path, {
    searchParams: input.searchParams,
    cacheBust: input.cacheBust,
  });
}

/** Проверяет, ведёт ли ссылка на Supabase Storage (публичный) */
export function isSupabasePublicStorageUrl(value: string) {
  return /\/storage\/v1\/object\/public\//.test(value);
}

/** Проверяет, является ли ссылка Yandex Object Storage */
export function isYandexStorageUrl(value: string) {
  return /storage\.yandexcloud\.net\//.test(value);
}

/**
 * Перезаписывает переданный URL в прокси-формат, если это ссылка на Supabase или Yandex.
 * Если URL уже начинается с нашего прокси – только добавляет параметры.
 * Иначе возвращает исходный URL без изменений.
 */
export function rewriteSupabasePublicStorageUrl(
  value: string | null | undefined,
  options?: StoragePublicUrlOptions
): string {
  const raw = String(value || "").trim();
  if (!raw) return "";

  // 1. Уже наш прокси – просто докидываем параметры
  if (raw.startsWith(STORAGE_PROXY_PREFIX)) {
    return appendSearchParams(raw, options);
  }

  // 2. Прямая ссылка Yandex Object Storage
  if (isYandexStorageUrl(raw)) {
    try {
      const url = new URL(raw);
      // Путь Yandex: /<bucket>/<object-path>
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        const bucket = parts[0];
        const objectPath = parts.slice(1).join("/");
        return getStoragePublicUrl(decodeURIComponent(bucket), decodeURIComponent(objectPath), options);
      }
    } catch {
      // fallback – вернём как есть
    }
    return raw;
  }

  // 3. Supabase public URL
  if (isSupabasePublicStorageUrl(raw)) {
    try {
      const url = new URL(raw);
      const marker = "/storage/v1/object/public/";
      const index = url.pathname.indexOf(marker);
      if (index < 0) return raw;

      const rest = url.pathname.slice(index + marker.length);
      const [bucket, ...pathParts] = rest.split("/").filter(Boolean);
      if (!bucket || !pathParts.length) return raw;

      const mergedSearchParams: Record<string, PrimitiveQueryValue> = {};
      url.searchParams.forEach((val, key) => {
        mergedSearchParams[key] = val;
      });
      if (options?.searchParams) {
        Object.assign(mergedSearchParams, options.searchParams);
      }

      return getStoragePublicUrl(
        decodeURIComponent(bucket),
        pathParts.map(decodeURIComponent),
        {
          searchParams: mergedSearchParams,
          cacheBust: options?.cacheBust,
        }
      );
    } catch {
      return raw;
    }
  }

  // 4. Неизвестный формат – возвращаем без изменений
  return raw;
}

/** Обёртка для удобства */
export function toStoragePublicUrl(
  value: string | null | undefined,
  options?: StoragePublicUrlOptions
) {
  return rewriteSupabasePublicStorageUrl(value, options);
}