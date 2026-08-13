import { getImageUrl } from "@/lib/assignments/image";
import { rewriteSupabasePublicStorageUrl } from "@/lib/storage/publicUrl";

const MEDIA_KEYS = new Set(["url", "image", "src", "cover", "cover_image_url", "coverUrl"]);

function encodeStoragePath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function buildDirectPublicUrl(bucket: string, objectPath: string): string | null {
  const cleanBucket = bucket.trim();
  const cleanPath = objectPath.trim();
  if (!cleanBucket || !cleanPath) return null;

  const yandexBucket = process.env.YANDEX_BUCKET_NAME?.trim();
  if (yandexBucket && cleanBucket === yandexBucket) {
    return `https://storage.yandexcloud.net/${encodeURIComponent(cleanBucket)}/${encodeStoragePath(cleanPath)}`;
  }

  const supabaseBase = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  if (supabaseBase) {
    return `${supabaseBase}/storage/v1/object/public/${encodeURIComponent(cleanBucket)}/${encodeStoragePath(cleanPath)}`;
  }

  return null;
}

function resolveDirectMediaUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("data:")) return trimmed;

  if (trimmed.startsWith("/api/storage/public/")) {
    const rest = trimmed.slice("/api/storage/public/".length).split("?")[0] ?? "";
    const parts = rest.split("/").filter(Boolean);
    const bucket = parts.shift();
    const objectPath = parts.map((part) => decodeURIComponent(part)).join("/");
    if (bucket && objectPath) {
      return buildDirectPublicUrl(decodeURIComponent(bucket), objectPath) ?? trimmed;
    }
    return trimmed;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const rewritten = rewriteSupabasePublicStorageUrl(trimmed);
    if (rewritten.startsWith("/api/storage/public/")) {
      return resolveDirectMediaUrl(rewritten);
    }
    return rewritten;
  }

  if (trimmed.includes("/")) {
    const direct = getImageUrl(trimmed);
    if (direct.startsWith("/api/storage/public/")) {
      return resolveDirectMediaUrl(direct);
    }
    return direct;
  }

  return getImageUrl(trimmed);
}

function shouldRewriteKey(key: string, value: unknown, parent: Record<string, unknown> | null) {
  if (typeof value !== "string" || !value.trim()) return false;
  if (MEDIA_KEYS.has(key)) return true;
  if (key === "type" && typeof value === "string") return false;
  if (parent && "type" in parent) {
    const type = String(parent.type ?? "").toLowerCase();
    if ((type === "image" || type === "audio" || type === "pdf") && key === "url") return true;
  }
  return false;
}

function rewriteValue(value: unknown, key = "", parent: Record<string, unknown> | null = null): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => rewriteValue(item, key, parent));
  }

  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(source)) {
      next[childKey] = rewriteValue(childValue, childKey, source);
    }
    return next;
  }

  if (shouldRewriteKey(key, value, parent)) {
    return resolveDirectMediaUrl(String(value));
  }

  return value;
}

export function rewriteAssignmentMediaUrls<T>(assignment: T): T {
  return rewriteValue(assignment) as T;
}
