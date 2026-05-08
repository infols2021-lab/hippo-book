import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import {
  getFileExtension,
  isAllowedMediaExtension,
  normalizeStorageObjectPath,
  safeStorageFileName,
  uploadStorageObject,
} from "@/lib/storage/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Увеличиваем лимит для аудио и PDF
const DEFAULT_MAX_MB = 50; 

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
  return Math.min(n, 100) * 1024 * 1024; // Жесткий лимит 100MB
}

function buildStoragePath(params: {
  file: File;
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

function validateFile(file: File) {
  const ext = getFileExtension(file.name);

  if (!isAllowedMediaExtension(ext)) {
    throw new Error(`Тип файла .${ext} не поддерживается`);
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

    // Теперь мы достаем массив файлов вместо одного
    const fileValues = formData.getAll("file");
    const bucket = String(formData.get("bucket") || "media").trim();
    const folder = cleanFolder(formData.get("folder"));
    const explicitPath = String(formData.get("path") || "").trim();
    const upsert = parseBoolean(formData.get("upsert"), false);
    const maxBytes = parseMaxBytes(formData.get("maxMB"));

    const validFiles: File[] = [];

    for (const fileValue of fileValues) {
      if (!(fileValue instanceof File)) continue;
      
      if (fileValue.size <= 0) {
        return fail(`Файл ${fileValue.name} пустой`, 400, "EMPTY_FILE", noStoreInit());
      }
      
      if (fileValue.size > maxBytes) {
        return fail(
          `Файл ${fileValue.name} больше ${Math.round(maxBytes / 1024 / 1024)}MB`,
          413,
          "FILE_TOO_LARGE",
          noStoreInit()
        );
      }
      
      validateFile(fileValue);
      validFiles.push(fileValue);
    }

    if (validFiles.length === 0) {
      return fail("Нет корректных файлов для загрузки", 400, "NO_FILES", noStoreInit());
    }

    // Обрабатываем файлы параллельно
    const uploadPromises = validFiles.map(async (file) => {
      const path = buildStoragePath({
        file,
        folder,
        explicitPath: validFiles.length === 1 ? explicitPath : "", // Explicit path только если файл один
      });

      const body = await fileToUploadBody(file);

      const uploaded = await uploadStorageObject({
        bucket,
        path,
        file: body,
        contentType: file.type || undefined,
        upsert,
        cacheControl: "31536000",
      });

      // Определяем наш тип медиа для фронта
      const ext = getFileExtension(file.name);
      let mediaType = "application/octet-stream";
      if (["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(ext)) mediaType = "image";
      else if (["mp3", "wav", "ogg", "m4a"].includes(ext)) mediaType = "audio";
      else if (ext === "pdf") mediaType = "pdf";

      return {
        bucket: uploaded.bucket,
        path: uploaded.path,
        publicUrl: uploaded.publicUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || null,
        mediaType,
      };
    });

    const results = await Promise.all(uploadPromises);

    // Возвращаем массив. Для обратной совместимости, если файл 1, можно вернуть его же в корне,
    // но лучше использовать results массив.
    return ok(
      {
        files: results,
        // Оставляем поля первого файла в корне объекта для обратной совместимости старого кода админки
        bucket: results[0].bucket,
        path: results[0].path,
        publicUrl: results[0].publicUrl,
        fileName: results[0].fileName,
      },
      noStoreInit()
    );
  } catch (error: any) {
    const message = String(error?.message || error || "Upload error");
    const lower = message.toLowerCase();

    if (lower.includes("not allowed") || lower.includes("не разреш") || lower.includes("permission") || lower.includes("admin")) {
      return fail(message, 403, "UPLOAD_FORBIDDEN", noStoreInit());
    }

    if (lower.includes("bucket") && (lower.includes("not found") || lower.includes("не найден"))) {
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
      }
    );
  }
}