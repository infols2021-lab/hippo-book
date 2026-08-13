// app/api/admin/upload/route.ts
import { ok, fail } from "@/lib/api/response";
import { requireAdmin } from "@/lib/api/admin";
import {
  getFileExtension,
  isAllowedMediaExtension,
  isSafeStorageObjectPath,
  normalizeStorageObjectPath,
  safeStorageFileName,
  uploadStorageObject,
} from "@/lib/storage/server";
import Busboy from "busboy";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Увеличиваем таймаут для Vercel (до 60 секунд), чтобы успевали загружаться тяжелые файлы.
export const maxDuration = 60;

// Берем лимит из .env или ставим 100 МБ по умолчанию
const MAX_FILE_SIZE_BYTES = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_SIZE) || 100 * 1024 * 1024;

// ==========================================
// ЖЕЛЕЗОБЕТОННЫЙ БЕЛЫЙ СПИСОК БАКЕТОВ
// ==========================================
// Серверная защита от записи в произвольные/системные директории.
const ALLOWED_BUCKETS = [
  "question-images",
  "hippo-book-audio",
  "assignments",
  "materials",
  "public",
  "media"
];

function noStoreInit(): ResponseInit {
  return { headers: { "cache-control": "no-store, max-age=0" } };
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
}

function cleanFolder(folder: string) {
  const raw = folder.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!raw) return "";
  return raw.split("/").map((part) => safeStorageFileName(part)).filter(Boolean).join("/");
}

function getMediaType(ext: string): "image" | "audio" | "pdf" | "unknown" {
  if (["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(ext)) return "image";
  if (["mp3", "wav", "ogg", "m4a", "mp4"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  return "unknown";
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => { headers[key] = value; });

  const bodyStream = Readable.fromWeb(req.body as any);

  const busboy = Busboy({
    headers,
    limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 10, fields: 20 },
  });

  const fields: Record<string, string> = {};
  const files: Array<{
    fieldname: string;
    file: Buffer;
    filename: string;
    mimeType: string;
    truncated: boolean;
  }> = [];

  const parsePromise = new Promise<void>((resolve, reject) => {
    busboy.on("field", (name, val) => { fields[name] = val; });

    busboy.on("file", (fieldname, stream, { filename, mimeType }) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => {
        files.push({
          fieldname,
          file: Buffer.concat(chunks),
          filename,
          mimeType,
          truncated: (stream as any).truncated === true,
        });
      });
    });

    busboy.on("error", (err: Error) => reject(err));
    busboy.on("finish", resolve);
    bodyStream.pipe(busboy);
  });

  try {
    await parsePromise;
  } catch (err: any) {
    return fail("Error parsing upload: " + String(err.message), 400, "PARSE_ERROR", noStoreInit());
  }

  for (const f of files) {
    if (f.truncated) {
      return fail(
        `Файл "${f.filename}" превышает максимально допустимый размер ${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} МБ`,
        413,
        "FILE_TOO_LARGE",
        noStoreInit()
      );
    }
  }

  const bucket = String(fields.bucket || "media").trim();
  const folder = cleanFolder(fields.folder || "");
  const explicitPath = String(fields.path || "").trim();
  const upsert = ["1", "true", "yes", "y", "да"].includes(String(fields.upsert || "").toLowerCase());

  if (!bucket) {
    return fail("Не указан bucket для загрузки", 400, "MISSING_BUCKET", noStoreInit());
  }

  // БЛОКИРУЕМ ЗАПИСЬ, ЕСЛИ БАКЕТ НЕ В БЕЛОМ СПИСКЕ
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return fail(
      "Ошибка доступа: попытка загрузки в неразрешенный бакет", 
      403, 
      "FORBIDDEN_BUCKET", 
      noStoreInit()
    );
  }

  const validFiles: typeof files = [];
  for (const f of files) {
    const ext = getFileExtension(f.filename);
    if (!isAllowedMediaExtension(ext)) {
      return fail(
        `Тип файла .${ext} не поддерживается. Разрешены: jpg, jpeg, png, gif, webp, avif, mp3, wav, ogg, m4a, mp4, pdf`,
        400,
        "INVALID_FILE",
        noStoreInit()
      );
    }
    validFiles.push(f);
  }

  if (validFiles.length === 0) {
    return fail("Нет корректных файлов для загрузки", 400, "NO_FILES", noStoreInit());
  }

  let resolvedExplicitPath = "";
  if (explicitPath) {
    resolvedExplicitPath = normalizeStorageObjectPath(explicitPath);
    if (!isSafeStorageObjectPath(resolvedExplicitPath)) {
      return fail("Некорректный путь для загрузки", 400, "INVALID_PATH", noStoreInit());
    }
  }

  const uploadPromises = validFiles.map(async (f) => {
    const ext = getFileExtension(f.filename);
    const path = resolvedExplicitPath
      ? resolvedExplicitPath
      : (() => {
          const baseName = safeStorageFileName(f.filename.replace(/\.[^.]+$/, ""));
          const fileName = `${Date.now()}_${randomId()}_${baseName}.${ext}`;
          return folder ? `${folder}/${fileName}` : fileName;
        })();

    const result = await uploadStorageObject({
      bucket,
      path,
      file: f.file,
      contentType: f.mimeType || undefined,
      upsert,
      cacheControl: "31536000",
    });

    return {
      bucket: result.bucket,
      path: result.path,
      publicUrl: result.publicUrl,
      fileName: f.filename,
      fileSize: f.file.length,
      mimeType: f.mimeType,
      mediaType: getMediaType(ext),
    };
  });

  const results = await Promise.all(uploadPromises);

  return ok(
    {
      files: results,
      bucket: results[0]?.bucket ?? "",
      path: results[0]?.path ?? "",
      publicUrl: results[0]?.publicUrl ?? "",
      fileName: results[0]?.fileName ?? "",
    },
    noStoreInit()
  );
}