// app/(app)/assignment/lib/image.ts
import { getStoragePublicUrl } from "@/lib/storage/publicUrl";

function isHttpUrl(v: unknown): boolean {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

/**
 * Возвращает URL, готовый для использования в src изображений / аудио / iframe.
 *
 * Для полных HTTP-ссылок (Supabase, Yandex) – возвращает как есть.
 * Для уже готовых прокси-путей (/api/storage/public/…) – возвращает без изменений.
 * Для data: URI – возвращает без изменений.
 * Для любого другого формата (обычно относительный путь) – строит URL через
 * наш прокси getStoragePublicUrl, чтобы не зависеть от структуры хранилища.
 *
 * Оптимизация изображений через /api/media временно отключена для повышения
 * стабильности загрузки из Yandex Object Storage.
 */
export function getImageUrl(imagePath: unknown) {
  if (imagePath == null) return "";

  const raw = String(imagePath).trim();
  if (!raw) return "";

  // 1. Уже готовый URL (data: или наши прокси-пути) – возвращаем без изменений
  if (
    raw.startsWith("data:") ||
    raw.startsWith("/api/media") ||
    raw.startsWith("/api/storage/public")
  ) {
    return raw;
  }

  // 2. Прямые HTTP/HTTPS ссылки (например, на Supabase или Yandex) — отдаём как есть,
  //    чтобы браузер мог загружать их напрямую, без лишнего проксирования.
  if (isHttpUrl(raw)) {
    return raw;
  }

  // 3. Относительный путь (например, пришедший из старых заданий, где url — просто
  //    имя файла или путь относительно бакета). Строим абсолютный URL через наш прокси,
  //    используя дефолтный бакет для новых заданий.
  const bucket = process.env.NEXT_PUBLIC_ASSIGNMENTS_BUCKET || "question-images";
  const cleaned = raw
    .replace(/^\/+/, "")
    .replace(/^storage\/v1\/object\/public\/[^/]+\//, "");

  return getStoragePublicUrl(bucket, cleaned);
}