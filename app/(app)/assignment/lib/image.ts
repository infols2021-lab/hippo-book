// app/(app)/assignment/lib/image.ts
import { rewriteSupabasePublicStorageUrl } from "@/lib/storage/publicUrl";

/**
 * Возвращает URL для источника медиа в задании.
 *
 * Если путь уже data: или начинается с /api/storage/public – возвращает как есть.
 * Иначе пропускает через rewriteSupabasePublicStorageUrl,
 * которая преобразует Supabase/Yandex прямые ссылки в наш прокси.
 */
export function getImageUrl(imagePath: unknown) {
  if (imagePath == null) return "";

  const raw = String(imagePath).trim();
  if (!raw) return "";

  // data: или уже наш прокси – не трогаем
  if (raw.startsWith("data:") || raw.startsWith("/api/storage/public")) {
    return raw;
  }

  // Всё остальное (HTTP-ссылки Supabase/Yandex, относительные пути)
  // прогоняем через универсальный конвертер, который строит прокси-путь.
  return rewriteSupabasePublicStorageUrl(raw);
}