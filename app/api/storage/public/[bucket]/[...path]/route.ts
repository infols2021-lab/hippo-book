/* app/api/storage/public/[bucket]/[...path]/route.ts */
import "server-only";

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = {
  bucket: string;
  path: string[];
};

type RouteContext = {
  params: RouteParams | Promise<RouteParams>;
};

function jsonError(message: string, status = 500, code = "STORAGE_PROXY_ERROR") {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      code,
    },
    {
      status,
      headers: {
        "cache-control": "no-store, max-age=0",
      },
    },
  );
}

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

function getAllowedPublicBuckets() {
  const raw = process.env.STORAGE_PUBLIC_BUCKETS || "";

  return raw
    .split(",")
    .map((bucket) => bucket.trim())
    .filter(Boolean);
}

function isBucketAllowed(bucket: string) {
  const allowed = getAllowedPublicBuckets();

  if (!allowed.length) return true;

  return allowed.includes(bucket);
}

function getSupabaseUrl() {
  return String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
}

function encodeStoragePath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

async function readParams(ctx: RouteContext): Promise<RouteParams> {
  return await ctx.params;
}

function buildPublicStorageUrl(req: NextRequest, bucket: string, objectPath: string) {
  const supabaseUrl = getSupabaseUrl();

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  const encodedBucket = encodeURIComponent(bucket);
  const encodedPath = encodeStoragePath(objectPath);

  const target = new URL(`${supabaseUrl}/storage/v1/object/public/${encodedBucket}/${encodedPath}`);

  for (const [key, value] of req.nextUrl.searchParams.entries()) {
    target.searchParams.set(key, value);
  }

  return target;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const params = await readParams(ctx);

  const bucket = normalizeBucket(params.bucket);
  const objectPath = normalizePath(params.path);

  if (!bucket) {
    return jsonError("Bucket is required", 400, "VALIDATION");
  }

  if (!objectPath) {
    return jsonError("Path is required", 400, "VALIDATION");
  }

  if (!isBucketAllowed(bucket)) {
    return jsonError(`Public access to bucket "${bucket}" is not allowed`, 403, "BUCKET_NOT_ALLOWED");
  }

  try {
    const target = buildPublicStorageUrl(req, bucket, objectPath);

    return NextResponse.redirect(target, {
      status: 307,
      headers: {
        "cache-control": "public, max-age=300",
      },
    });
  } catch (e: any) {
    return jsonError(e?.message || "Storage redirect error", 500, "STORAGE_REDIRECT_ERROR");
  }
}

export async function HEAD(req: NextRequest, ctx: RouteContext) {
  return GET(req, ctx);
}