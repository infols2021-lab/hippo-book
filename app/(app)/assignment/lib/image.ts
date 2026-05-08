import { getStoragePublicUrl } from "@/lib/storage/publicUrl";

function isHttpUrl(v: unknown): boolean {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

// Утилита для проверки, что это именно картинка (чтобы не проксировать аудио)
function isImageFile(url: string): boolean {
  const ext = url.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext || '');
}

export function getImageUrl(imagePath: unknown) {
  if (imagePath == null) return "";

  const raw = String(imagePath).trim();
  if (!raw) return "";

  // Если это уже data-uri или путь к нашему API, возвращаем как есть
  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("/api/media")) return raw;
  if (raw.startsWith("/api/storage/public/")) return raw;

  const storageMarker = "/storage/v1/object/public/";
  let publicUrl = "";

  if (isHttpUrl(raw)) {
    const markerIndex = raw.indexOf(storageMarker);

    if (markerIndex === -1) {
      publicUrl = raw;
    } else {
      const rest = raw.slice(markerIndex + storageMarker.length).split("?")[0]?.split("#")[0] ?? "";
      const parts = rest.split("/").filter(Boolean);

      const bucket = parts.shift();
      const path = parts.join("/");

      publicUrl = (!bucket || !path) ? raw : getStoragePublicUrl(bucket, path);
    }
  } else {
    const bucket = process.env.NEXT_PUBLIC_ASSIGNMENTS_BUCKET || "assignments";
    const cleaned = raw
      .replace(/^\/+/, "")
      .replace(/^storage\/v1\/object\/public\/[^/]+\//, "");

    publicUrl = getStoragePublicUrl(bucket, cleaned);
  }

  // --- МАГИЯ УСКОРЕНИЯ ---
  // Если это картинка, прогоняем её через наш API роут со сжатием sharp
  if (isImageFile(publicUrl)) {
    return `/api/media?url=${encodeURIComponent(publicUrl)}`;
  }

  // Аудио, PDF и прочее отдаем прямой ссылкой
  return publicUrl;
}