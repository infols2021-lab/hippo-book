// app/api/admin/upload/route.ts
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

// Максимальный размер файла по умолчанию (50 МБ для всех типов)
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
  // Если передан явный путь – используем его
  if (params.explicitPath) {
    return normalizeStorageObjectPath(params.explicitPath);
  }

  const ext = getFileExtension(params.file.name);
  const baseName = safeStorageFileName(params.file.name.replace(/\.[^.]+$/, ""));
  const fileName = `${Date.now()}_${randomId()}_${baseName}.${ext}`;

  return params.folder ? `${params.folder}/${fileName}` : fileName;
}

function validateFile(file: File) {
  if (!file || !(file instanceof File)) {
    throw new Error("Передан невалидный объект файла");
  }

  if (file.size <= 0) {
    throw new Error(`Файл ${file.name} пустой`);
  }

  const ext = getFileExtension(file.name);

  if (!isAllowedMediaExtension(ext)) {
    throw new Error(
      `Тип файла .${ext} не поддерживается. Разрешены: jpg, jpeg, png, gif, webp, avif, mp3, wav, ogg, m4a, pdf`
    );
  }
}

async function fileToUploadBody(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Определяет тип медиа для отображения на клиенте
 */
function getMediaType(ext: string): "image" | "audio" | "pdf" | "unknown" {
  if (["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(ext)) return "image";
  if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  return "unknown";
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  try {
    const formData = await req.formData();

    // Извлекаем все файлы из FormData
    const fileValues = formData.getAll("file");
    const bucket = String(formData.get("bucket") || "media").trim();
    const folder = cleanFolder(formData.get("folder"));
    const explicitPath = String(formData.get("path") || "").trim();
    const upsert = parseBoolean(formData.get("upsert"), false);
    const maxBytes = parseMaxBytes(formData.get("maxMB"));

    if (!bucket) {
      return fail("Не указан bucket для загрузки", 400, "MISSING_BUCKET", noStoreInit());
    }

    // Валидация файлов
    const validFiles: File[] = [];

    for (const fileValue of fileValues) {
      if (!(fileValue instanceof File)) continue;

      try {
        validateFile(fileValue);
      } catch (validationError: any) {
        return fail(validationError.message, 400, "INVALID_FILE", noStoreInit());
      }

      if (fileValue.size > maxBytes) {
        return fail(
          `Файл ${fileValue.name} превышает максимальный размер ${Math.round(maxBytes / 1024 / 1024)}MB`,
          413,
          "FILE_TOO_LARGE",
          noStoreInit()
        );
      }

      validFiles.push(fileValue);
    }

    if (validFiles.length === 0) {
      return fail("Нет корректных файлов для загрузки", 400, "NO_FILES", noStoreInit());
    }

    // Параллельная загрузка всех файлов
    const uploadPromises = validFiles.map(async (file) => {
      const path = buildStoragePath({
        file,
        folder,
        explicitPath: validFiles.length === 1 ? explicitPath : "",
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

      const ext = getFileExtension(file.name);
      const mediaType = getMediaType(ext);

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

    // Формируем ответ с обратной совместимостью
    return ok(
      {
        files: results,
        // Поля первого файла для старого кода админки
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

    // Понятные сообщения для клиента
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