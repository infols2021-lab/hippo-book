/* app/api/storage/public/[bucket]/[...path]/route.ts */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  "media",
];

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

  // Возвращаем 307 HTTP-редирект на целевой CDN-URL.
  // Браузер напрямую загрузит файл из S3/Supabase CDN,
  // что сэкономит трафик серверлесс-функций Vercel и снимет ограничение по таймауту.
  return NextResponse.redirect(targetUrl, {
    status: 307,
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable, s-maxage=31536000",
    },
  });
}

export async function HEAD(req: NextRequest, ctx: RouteContext) {
  return GET(req, ctx);
}