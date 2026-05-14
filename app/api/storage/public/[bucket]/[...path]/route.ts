/* app/api/storage/public/[bucket]/[...path]/route.ts */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Разрешаем Next.js принимать тела запросов до 50 МБ для этого прокси-роута

// Vercel: увеличиваем таймаут — крупные файлы (аудио, PDF) могут грузиться дольше 10 сек
export const maxDuration = 30;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type RouteParams = { bucket: string; path: string[] };
type RouteContext = { params: RouteParams | Promise<RouteParams> };

// ─────────────────────────────────────────────────────────────
// Config helpers
// ─────────────────────────────────────────────────────────────

function normalizeBucket(value: unknown) {
  return String(value ?? "").trim();
}

function normalizePath(parts: unknown) {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join("/");
}

/**
 * Дефолтный список публичных бакетов.
 * ВАЖНО: синхронизировать с DEFAULT_PUBLIC_BUCKETS в lib/storage/server.ts
 */
const DEFAULT_PROXY_PUBLIC_BUCKETS = [
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
 * Возвращает список разрешённых бакетов.
 * Если STORAGE_PUBLIC_BUCKETS задан — берём его.
 * Если нет — используем DEFAULT_PROXY_PUBLIC_BUCKETS.
 * Yandex-бакет добавляется всегда.
 */
function getAllowedPublicBuckets(): string[] {
  const fromEnv = (process.env.STORAGE_PUBLIC_BUCKETS || "")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);

  const base = fromEnv.length > 0 ? fromEnv : [...DEFAULT_PROXY_PUBLIC_BUCKETS];

  const yandexBucket = process.env.YANDEX_BUCKET_NAME;
  if (yandexBucket && !base.includes(yandexBucket)) {
    base.push(yandexBucket);
  }

  return base;
}

function isBucketAllowed(bucket: string) {
  return getAllowedPublicBuckets().includes(bucket);
}

function getSupabaseUrl() {
  return String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
}

function isYandexBucket(bucket: string) {
  const yb = process.env.YANDEX_BUCKET_NAME;
  return Boolean(yb && bucket === yb);
}

/** Запрещаем path traversal */
function isSafeStorageObjectPath(path: string) {
  if (!path) return false;
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  return path.split("/").every((part) => part && part !== "." && part !== "..");
}

// ─────────────────────────────────────────────────────────────
// URL builders
// ─────────────────────────────────────────────────────────────

function encodeStoragePath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function buildSupabasePublicUrl(bucket: string, objectPath: string) {
  const base = getSupabaseUrl();
  if (!base) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeStoragePath(objectPath)}`;
}

function buildYandexPublicUrl(bucket: string, objectPath: string) {
  return `https://storage.yandexcloud.net/${encodeURIComponent(bucket)}/${encodeStoragePath(objectPath)}`;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function jsonError(message: string, status = 500, code = "STORAGE_PROXY_ERROR") {
  return NextResponse.json(
    { ok: false, error: message, code },
    { status, headers: { "cache-control": "no-store, max-age=0" } }
  );
}

async function readParams(ctx: RouteContext): Promise<RouteParams> {
  return await ctx.params;
}

// ─────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, ctx: RouteContext) {
  const params = await readParams(ctx);
  const bucket = normalizeBucket(params.bucket);
  const objectPath = normalizePath(params.path);

  if (!bucket) return jsonError("Bucket is required", 400, "VALIDATION");
  if (!objectPath) return jsonError("Path is required", 400, "VALIDATION");
  if (!isBucketAllowed(bucket))
    return jsonError(`Public access to bucket "${bucket}" is not allowed`, 403, "BUCKET_NOT_ALLOWED");
  if (!isSafeStorageObjectPath(objectPath))
    return jsonError("Invalid object path", 400, "INVALID_PATH");

  let targetUrl: string;
  try {
    targetUrl = isYandexBucket(bucket)
      ? buildYandexPublicUrl(bucket, objectPath)
      : buildSupabasePublicUrl(bucket, objectPath);
  } catch (e: any) {
    return jsonError(e?.message || "URL build error", 500, "URL_BUILD_ERROR");
  }

  try {
    // Формируем upstream-заголовки
    const upstreamHeaders: Record<string, string> = {
      // Представляемся браузером — некоторые CDN блокируют bot-like UA
      "User-Agent":
        "Mozilla/5.0 (compatible; HippoProxy/1.0; +https://hippo-book.ru)",
    };

    // ↓ Пробрасываем Range для поддержки audio seek через прокси.
    //   Без этого браузер не может перематывать аудиофайлы.
    const rangeHeader = req.headers.get("Range");
    if (rangeHeader) {
      upstreamHeaders["Range"] = rangeHeader;
    }

    // Запрашиваем файл server-to-server.
    // Пользователю не нужен прямой доступ к Яндексу/Supabase —
    // наш сервер сам забирает контент и стримит его пользователю.
    const upstream = await fetch(targetUrl, {
      headers: upstreamHeaders,
      // Отключаем Next.js-кеш fetch — нам важен свежий ответ от upstream,
      // а кешировать будем на уровне браузера через Cache-Control
      cache: "no-store",
    });

    // 206 Partial Content — легитимный ответ на Range-запрос
    if (!upstream.ok && upstream.status !== 206) {
      if (upstream.status === 404) {
        return jsonError("File not found", 404, "NOT_FOUND");
      }
      return jsonError(`Upstream error: ${upstream.status}`, 502, "UPSTREAM_ERROR");
    }

    // ─── Формируем заголовки ответа ───────────────────────────────────────
    const resHeaders: Record<string, string> = {
      // Тип контента — берём от upstream (image/jpeg, audio/mp4, и т.д.)
      "Content-Type":
        upstream.headers.get("Content-Type") || "application/octet-stream",

      // Долгое кеширование в браузере — файлы в хранилище immutable
      "Cache-Control": "public, max-age=31536000, immutable",

      // Безопасность
      "X-Content-Type-Options": "nosniff",
    };

    // Пробрасываем заголовки для range requests и кеш-валидации
    const headersToForward = [
      "Content-Length",
      "Content-Range",
      "Accept-Ranges",
      "ETag",
      "Last-Modified",
    ] as const;

    for (const header of headersToForward) {
      const val = upstream.headers.get(header);
      if (val) resHeaders[header] = val;
    }

    // ─── Стримим тело напрямую — без буферизации в памяти ────────────────
    // upstream.body — это ReadableStream, NextResponse умеет его стримить.
    return new NextResponse(upstream.body, {
      status: upstream.status, // 200 или 206 (для range requests)
      headers: resHeaders,
    });
  } catch (e: any) {
    // fetch упал (network error, timeout и т.д.)
    return jsonError(e?.message || "Storage fetch error", 502, "FETCH_ERROR");
  }
}

// HEAD используется браузером для preflight проверок и audio duration
export async function HEAD(req: NextRequest, ctx: RouteContext) {
  // Переиспользуем GET — NextResponse автоматически уберёт body для HEAD
  return GET(req, ctx);
}