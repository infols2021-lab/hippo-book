/* lib/storage/server.ts */
import "server-only";

import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { directFetch } from "@/lib/net/directFetch";
import { getStoragePublicUrl } from "@/lib/storage/publicUrl";

const DEFAULT_PUBLIC_BUCKETS = [
  "covers",
  "question-images",
  "help-images",
  "backgrounds",
  "streak-icons",
  "streak_icon_assets",
  "streak-roadmap-bg",
  "profile-backgrounds",
];

const DEFAULT_UPLOAD_BUCKETS = [
  "covers",
  "question-images",
  "backgrounds",
  "streak-icons",
  "streak_icon_assets",
  "streak-roadmap-bg",
  "profile-backgrounds",
];

const DEFAULT_ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "avif"];

// mp4 добавлен: аудиозаписи с iPhone/Android часто имеют расширение .mp4
const DEFAULT_ALLOWED_MEDIA_EXTENSIONS = [
  ...DEFAULT_ALLOWED_IMAGE_EXTENSIONS,
  "mp3",
  "wav",
  "ogg",
  "m4a",
  "mp4",
  "pdf",
];

export type UploadStorageObjectInput = {
  bucket: string;
  path: string;
  file: Blob | ArrayBuffer | Uint8Array | Buffer;
  contentType?: string;
  upsert?: boolean;
  cacheControl?: string;
  maxRetries?: number;
};

export type DownloadStorageObjectResult = {
  data: Blob;
  contentType: string;
  size: number | null;
};

function envList(name: string, fallback: string[]) {
  const raw = process.env[name];
  if (!raw) return fallback;

  const list = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return list.length ? list : fallback;
}

export function getPublicStorageBuckets() {
  return envList("STORAGE_PUBLIC_BUCKETS", DEFAULT_PUBLIC_BUCKETS);
}

export function getUploadStorageBuckets() {
  const yandexBucket = process.env.YANDEX_BUCKET_NAME;
  const buckets = envList("STORAGE_UPLOAD_BUCKETS", DEFAULT_UPLOAD_BUCKETS);
  if (yandexBucket && !buckets.includes(yandexBucket)) {
    buckets.push(yandexBucket);
  }
  return buckets;
}

export function isValidBucketName(bucket: string) {
  return /^[a-zA-Z0-9._-]{1,80}$/.test(bucket);
}

export function normalizeStorageObjectPath(path: string | string[]) {
  const raw = Array.isArray(path) ? path.join("/") : String(path || "");
  const clean = raw
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
  if (!clean) return "";

  try {
    return decodeURIComponent(clean);
  } catch {
    return clean;
  }
}

export function isSafeStorageObjectPath(path: string) {
  if (!path) return false;
  if (path.startsWith("/")) return false;
  if (path.includes("\\")) return false;
  if (path.includes("\0")) return false;

  const parts = path.split("/");
  return parts.every((part) => {
    if (!part) return false;
    if (part === "." || part === "..") return false;
    return true;
  });
}

export function assertPublicStorageBucket(bucket: string) {
  if (!isValidBucketName(bucket)) {
    throw new Error("Некорректное имя bucket");
  }
  const allowed = getPublicStorageBuckets();
  if (!allowed.includes(bucket) && bucket !== process.env.YANDEX_BUCKET_NAME) {
    throw new Error(`Bucket "${bucket}" не разрешён для публичной выдачи`);
  }
}

export function assertUploadStorageBucket(bucket: string) {
  if (!isValidBucketName(bucket)) {
    throw new Error("Некорректное имя bucket");
  }
  const allowed = getUploadStorageBuckets();
  if (!allowed.includes(bucket)) {
    throw new Error(`Bucket "${bucket}" не разрешён для загрузки`);
  }
}

export function safeStorageFileName(name: string) {
  const fallback = "file";
  const raw = String(name || fallback)
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9а-яА-ЯёЁ._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");

  return raw || fallback;
}

export function getFileExtension(name: string) {
  const clean = safeStorageFileName(name);
  const ext = clean.split(".").pop()?.toLowerCase() || "";
  return ext || "bin";
}

export function isAllowedImageExtension(ext: string) {
  return DEFAULT_ALLOWED_IMAGE_EXTENSIONS.includes(String(ext || "").toLowerCase());
}

export function isAllowedMediaExtension(ext: string) {
  return DEFAULT_ALLOWED_MEDIA_EXTENSIONS.includes(String(ext || "").toLowerCase());
}

export function guessContentTypeFromPath(path: string) {
  const ext = getFileExtension(path);
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "avif") return "image/avif";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "pdf") return "application/pdf";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "wav") return "audio/wav";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "m4a") return "audio/mp4";
  // mp4 — контейнер AAC; аудиофайлы с мобильных устройств часто имеют именно это расширение
  if (ext === "mp4") return "audio/mp4";
  return "application/octet-stream";
}

function getSupabaseStorageKey(admin: boolean) {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (admin) {
    if (!serviceRole) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
    return serviceRole;
  }
  if (serviceRole) return serviceRole;
  if (!anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return anon;
}

export function createSupabaseStorageClient(options?: { admin?: boolean }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");

  const key = getSupabaseStorageKey(Boolean(options?.admin));

  return createClient(url, key, {
    global: {
      fetch: directFetch,
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function downloadPublicStorageObject(bucket: string, path: string | string[]) {
  const cleanBucket = String(bucket || "").trim();
  const cleanPath = normalizeStorageObjectPath(path);
  assertPublicStorageBucket(cleanBucket);
  if (!isSafeStorageObjectPath(cleanPath)) {
    throw new Error("Некорректный путь к файлу");
  }
  const supabase = createSupabaseStorageClient({ admin: false });
  const { data, error } = await supabase.storage.from(cleanBucket).download(cleanPath);
  if (error) throw error;
  if (!data) throw new Error("Файл не найден");

  const contentType = data.type || guessContentTypeFromPath(cleanPath);
  const size = typeof data.size === "number" ? data.size : null;
  return { data, contentType, size } satisfies DownloadStorageObjectResult;
}

function isTransientStorageError(error: any): boolean {
  const msg = String(error?.message || error || "").toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("network") ||
    msg.includes("terminated") ||
    msg.includes("timeout") ||
    msg.includes("too many requests")
  );
}

export async function uploadStorageObject(input: UploadStorageObjectInput) {
  const bucket = String(input.bucket || "").trim();
  const path = normalizeStorageObjectPath(input.path);
  assertUploadStorageBucket(bucket);

  if (!isSafeStorageObjectPath(path)) {
    throw new Error("Некорректный путь к файлу");
  }

  let safeBody = input.file;
  if (input.file instanceof ArrayBuffer) {
    safeBody = Buffer.from(input.file);
  }

  const isYandexBucket = bucket === process.env.YANDEX_BUCKET_NAME;
  const maxRetries = Math.max(0, Number(input.maxRetries) || 2);
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (isYandexBucket) {
        const s3Client = new S3Client({
          region: process.env.YANDEX_REGION || "ru-central1",
          endpoint: "https://storage.yandexcloud.net",
          credentials: {
            accessKeyId: process.env.YANDEX_ACCESS_KEY_ID!,
            secretAccessKey: process.env.YANDEX_SECRET_ACCESS_KEY!,
          },
        });

        await s3Client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: path,
            Body: safeBody as any,
            ContentType: input.contentType || guessContentTypeFromPath(path),
            CacheControl: input.cacheControl || "max-age=31536000",
          })
        );

        return {
          bucket,
          path,
          publicUrl: `https://storage.yandexcloud.net/${bucket}/${path}`,
        };
      } else {
        const supabase = createSupabaseStorageClient({ admin: true });

        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(path, input.file, {
            cacheControl: input.cacheControl ?? "31536000",
            upsert: Boolean(input.upsert),
            contentType: input.contentType || guessContentTypeFromPath(path),
          });

        if (error) {
          if (!isTransientStorageError(error) || attempt === maxRetries) {
            throw error;
          }
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
          continue;
        }

        return {
          bucket,
          path: data?.path || path,
          publicUrl: getStoragePublicUrl(bucket, data?.path || path),
        };
      }
    } catch (error: any) {
      lastError = error;
      if (!isTransientStorageError(error) || attempt === maxRetries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }

  throw lastError ?? new Error("Upload failed after retries");
}