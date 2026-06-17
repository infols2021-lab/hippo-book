// app/(app)/assignment/lib/image.ts
import { getStoragePublicUrl, rewriteSupabasePublicStorageUrl } from "@/lib/storage/publicUrl";

// Список известных бакетов хранилища — дублирует DEFAULT_PUBLIC_BUCKETS из
// lib/storage/server.ts. Нельзя импортировать напрямую (server-only).
// При добавлении нового бакета — обновить оба места.
const KNOWN_STORAGE_BUCKETS = [
  "covers",
  "question-images",
  "help-images",
  "backgrounds",
  "streak-icons",
  "streak_icon_assets",
  "streak-roadmap-bg",
  "profile-backgrounds",
];

/**
 * Возвращает URL для источника медиа в задании.
 *
 * Порядок проверок:
 * 1. data: — base64, возвращаем как есть.
 * 2. /api/storage/public — уже наш прокси, возвращаем как есть.
 * 3. https://... — Supabase или Yandex URL → конвертируем через rewriteSupabasePublicStorageUrl.
 * 4. bucket/path/... — "голый" путь без домена, первый сегмент является известным бакетом →
 *    строим прокси-URL через getStoragePublicUrl.
 * 5. Всё остальное — возвращаем как есть (внешние URL и т.п.).
 */
export function getImageUrl(imagePath: unknown): string {
  if (imagePath == null) return "";

  const raw = String(imagePath).trim();
  if (!raw) return "";

  // 1. data: URI — base64-контент, не трогаем
  if (raw.startsWith("data:")) {
    return raw;
  }

  // 2. Уже наш прокси — не трогаем
  if (raw.startsWith("/api/storage/public")) {
    return raw;
  }

  // 3. Абсолютный HTTP(S) URL — Supabase или Yandex → конвертируем в прокси
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return rewriteSupabasePublicStorageUrl(raw);
  }

  // 4. "Голый" путь формата "bucket/path/to/file.ext" — старые записи в БД,
  //    где сохранялся относительный путь без домена.
  //    Определяем по первому сегменту: если это известный бакет — строим прокси.
  if (raw.includes("/")) {
    const slashIdx = raw.indexOf("/");
    const maybeBucket = raw.slice(0, slashIdx);
    const objectPath = raw.slice(slashIdx + 1);

    if (objectPath && KNOWN_STORAGE_BUCKETS.includes(maybeBucket)) {
      return getStoragePublicUrl(maybeBucket, objectPath);
    }
  }

  // 5. Неизвестный формат — возвращаем как есть
  return raw;
}