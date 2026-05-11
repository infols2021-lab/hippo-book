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
 * Дефолтный список публичных бакетов — зеркалит DEFAULT_PUBLIC_BUCKETS
 * из lib/storage/server.ts. Используется когда STORAGE_PUBLIC_BUCKETS
 * не задан в env, либо как база для объединения со значением из env.
 *
 * ВАЖНО: этот список должен оставаться синхронизированным с
 * DEFAULT_PUBLIC_BUCKETS в lib/storage/server.ts.
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
 * Возвращает итоговый массив разрешённых публичных бакетов.
 *
 * Логика:
 * 1. Если STORAGE_PUBLIC_BUCKETS задан — берём его как базу.
 * 2. Если НЕ задан — используем DEFAULT_PROXY_PUBLIC_BUCKETS как базу.
 * 3. В обоих случаях дополнительно добавляем YANDEX_BUCKET_NAME (если задан).
 *
 * Это исправляет баг: раньше при незаданном STORAGE_PUBLIC_BUCKETS список
 * был пуст, и isBucketAllowed возвращал true для всех (dev-режим).
 * Но при частично заданном STORAGE_PUBLIC_BUCKETS бакеты Supabase
 * (question-images и др.) блокировались 403, не попав в список.
 */
function getAllowedPublicBuckets(): string[] {
  const fromEnv = (process.env.STORAGE_PUBLIC_BUCKETS || "")
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);

  // Если env задан — используем его; если нет — берём дефолты
  const base = fromEnv.length > 0 ? fromEnv : [...DEFAULT_PROXY_PUBLIC_BUCKETS];

  // Всегда добавляем Yandex-бакет, если задан и ещё не в списке
  const yandexBucket = process.env.YANDEX_BUCKET_NAME;
  if (yandexBucket && !base.includes(yandexBucket)) {
    base.push(yandexBucket);
  }

  return base;
}

function isBucketAllowed(bucket: string) {
  const allowed = getAllowedPublicBuckets();
  return allowed.includes(bucket);
}

function getSupabaseUrl() {
  return String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
}

function getYandexEndpoint() {
  return "https://storage.yandexcloud.net";
}

function isYandexBucket(bucket: string) {
  const yandexBucket = process.env.YANDEX_BUCKET_NAME;
  return Boolean(yandexBucket && bucket === yandexBucket);
}

/** Безопасность: запрещаем path traversal */
function isSafeStorageObjectPath(path: string) {
  if (!path) return false;
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;

  const parts = path.split("/");
  return parts.every((part) => {
    if (!part || part === "." || part === "..") return false;
    return true;
  });
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

/** Прямая ссылка на публичный объект в Supabase Storage */
function buildSupabasePublicUrl(bucket: string, objectPath: string) {
  const base = getSupabaseUrl();
  if (!base) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");

  return `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeStoragePath(objectPath)}`;
}

/** Прямая ссылка на публичный объект в Yandex Object Storage */
function buildYandexPublicUrl(bucket: string, objectPath: string) {
  return `${getYandexEndpoint()}/${encodeURIComponent(bucket)}/${encodeStoragePath(objectPath)}`;
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

/** Формирует ответ-редирект (307) на целевой URL с кеширующими заголовками */
function redirectResponse(url: string, cacheMaxAge = 300) {
  return NextResponse.redirect(url, {
    status: 307,
    headers: {
      "cache-control": `public, max-age=${cacheMaxAge}`,
    },
  });
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
  if (!isBucketAllowed(bucket)) return jsonError(`Public access to bucket "${bucket}" is not allowed`, 403, "BUCKET_NOT_ALLOWED");
  if (!isSafeStorageObjectPath(objectPath)) return jsonError("Invalid object path", 400, "INVALID_PATH");

  try {
    // Для Yandex-бакетов редиректим на прямое хранилище (публичный доступ)
    if (isYandexBucket(bucket)) {
      const targetUrl = buildYandexPublicUrl(bucket, objectPath);
      return redirectResponse(targetUrl, 31536000);
    }

    // Для всех остальных — Supabase
    const targetUrl = buildSupabasePublicUrl(bucket, objectPath);
    return redirectResponse(targetUrl, 300);
  } catch (e: any) {
    return jsonError(e?.message || "Storage redirect error", 500, "STORAGE_REDIRECT_ERROR");
  }
}

export async function HEAD(req: NextRequest, ctx: RouteContext) {
  return GET(req, ctx);
}