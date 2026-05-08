import { getStoragePublicUrl } from "@/lib/storage/publicUrl";

function isHttpUrl(v: unknown): boolean {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

function isImageFile(url: string): boolean {
  const ext = url.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext || '');
}

export function getImageUrl(imagePath: unknown) {
  if (imagePath == null) return "";

  const raw = String(imagePath).trim();
  if (!raw) return "";

  // 1. Если это уже готовая ссылка (base64 или наш прокси)
  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("/api/media")) return raw;

  let publicUrl = "";

  // 2. Логика для Supabase (старые задания)
  // Обычно ссылки supabase содержат 'supabase.co' или маркер '/storage/v1/object/public/'
  const supabaseMarker = "/storage/v1/object/public/";
  const isSupabase = raw.includes("supabase.co") || raw.includes(supabaseMarker);

  if (isHttpUrl(raw)) {
    publicUrl = raw;
  } else if (isSupabase || raw.startsWith("assignments/")) {
    // Если в БД лежит путь типа "assignments/photo.png" от Supabase
    // Замени [PROJECT_ID] на ID своего проекта Supabase, если env не подтягивается
    const supabaseDomain = process.env.NEXT_PUBLIC_SUPABASE_URL; 
    const bucket = "assignments";
    const path = raw.replace("assignments/", "");
    publicUrl = `${supabaseDomain}${supabaseMarker}${bucket}/${path}`;
  } else {
    // 3. Логика для Yandex Cloud (новые задания)
    const bucket = process.env.NEXT_PUBLIC_ASSIGNMENTS_BUCKET || "assignments";
    const cleaned = raw
      .replace(/^\/+/, "")
      .replace(/^storage\/v1\/object\/public\/[^/]+\//, "");

    publicUrl = getStoragePublicUrl(bucket, cleaned);
  }

  // Оптимизируем через наш API только картинки
  if (isImageFile(publicUrl)) {
    return `/api/media?url=${encodeURIComponent(publicUrl)}`;
  }

  return publicUrl;
}