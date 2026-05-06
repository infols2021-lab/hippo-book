import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import {
  getFileExtension,
  isAllowedImageExtension,
  normalizeStorageObjectPath,
  safeStorageFileName,
  uploadStorageObject,
} from "@/lib/storage/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MAX_MB = 5;

type UploadKind = "image";

function noStoreInit(): ResponseInit {
  return {
    headers: {
      "cache-control": "no-store, max-age=0",
    },
  };
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }

  return Math.random().toString(36).slice(2, 14);
}

function cleanFolder(folder: FormDataEntryValue | null) {
  const raw = String(folder || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");

  if (!raw) return "";

  return raw
    .split("/")
    .map((part) => safeStorageFileName(part))
    .filter(Boolean)
    .join("/");
}

function parseBoolean(value: FormDataEntryValue | null, fallback = false) {
  if (value === null || value === undefined) return fallback;

  const raw = String(value).trim().toLowerCase();

  if (["1", "true", "yes", "y", "да"].includes(raw)) return true;
  if (["0", "false", "no", "n", "нет"].includes(raw)) return false;

  return fallback;
}

function parseMaxBytes(value: FormDataEntryValue | null) {
  const n = Number(value);

  if (!Number.isFinite(n) || n <= 0) {
    return DEFAULT_MAX_MB * 1024 * 1024;
  }

  return Math.min(n, 25) * 1024 * 1024;
}

function buildStoragePath(params: {
  file: File;
  bucket: string;
  folder: string;
  explicitPath: string;
}) {
  if (params.explicitPath) {
    return normalizeStorageObjectPath(params.explicitPath);
  }

  const ext = getFileExtension(params.file.name);
  const baseName = safeStorageFileName(params.file.name.replace(/\.[^.]+$/, ""));
  const fileName = `${Date.now()}_${randomId()}_${baseName}.${ext}`;

  return params.folder ? `${params.folder}/${fileName}` : fileName;
}

function validateUploadKind(kind: UploadKind, file: File) {
  if (kind !== "image") {
    throw new Error("Поддерживается только загрузка изображений");
  }

  const ext = getFileExtension(file.name);
  const mime = String(file.type || "").toLowerCase();

  if (!isAllowedImageExtension(ext)) {
    throw new Error("Поддерживаются только JPG, PNG, GIF, WebP, AVIF");
  }

  if (mime && !mime.startsWith("image/")) {
    throw new Error("Файл должен быть изображением");
  }
}

async function fileToUploadBody(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  try {
    const formData = await req.formData();

    const fileValue = formData.get("file");
    const bucket = String(formData.get("bucket") || "question-images").trim();
    const folder = cleanFolder(formData.get("folder"));
    const explicitPath = String(formData.get("path") || "").trim();
    const upsert = parseBoolean(formData.get("upsert"), false);
    const maxBytes = parseMaxBytes(formData.get("maxMB"));
    const kind = String(formData.get("kind") || "image") as UploadKind;

    if (!(fileValue instanceof File)) {
      return fail("Файл не найден", 400, "FILE_REQUIRED", noStoreInit());
    }

    if (fileValue.size <= 0) {
      return fail("Файл пустой", 400, "EMPTY_FILE", noStoreInit());
    }

    if (fileValue.size > maxBytes) {
      return fail(
        `Файл больше ${Math.round(maxBytes / 1024 / 1024)}MB`,
        413,
        "FILE_TOO_LARGE",
        noStoreInit(),
      );
    }

    validateUploadKind(kind, fileValue);

    const path = buildStoragePath({
      file: fileValue,
      bucket,
      folder,
      explicitPath,
    });

    const body = await fileToUploadBody(fileValue);

    const uploaded = await uploadStorageObject({
      bucket,
      path,
      file: body,
      contentType: fileValue.type || undefined,
      upsert,
      cacheControl: "31536000",
    });

    return ok(
      {
        bucket: uploaded.bucket,
        path: uploaded.path,
        publicUrl: uploaded.publicUrl,
        fileName: fileValue.name,
        fileSize: fileValue.size,
        mimeType: fileValue.type || null,
      },
      noStoreInit(),
    );
  } catch (error: any) {
    const message = String(error?.message || error || "Upload error");
    const lower = message.toLowerCase();

    if (
      lower.includes("not allowed") ||
      lower.includes("не разреш") ||
      lower.includes("permission") ||
      lower.includes("admin")
    ) {
      return fail(message, 403, "UPLOAD_FORBIDDEN", noStoreInit());
    }

    if (
      lower.includes("bucket") &&
      (lower.includes("not found") || lower.includes("не найден"))
    ) {
      return fail(message, 404, "BUCKET_NOT_FOUND", noStoreInit());
    }

    return NextResponse.json(
      {
        ok: false,
        error: message,
        code: "UPLOAD_FAILED",
      },
      {
        status: 500,
        headers: {
          "cache-control": "no-store, max-age=0",
        },
      },
    );
  }
}