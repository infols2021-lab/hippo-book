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
import Busboy from "busboy";
import { Readable } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function cleanFolder(folder: string) {
  const raw = folder.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!raw) return "";
  return raw
    .split("/")
    .map((part) => safeStorageFileName(part))
    .filter(Boolean)
    .join("/");
}

function getMediaType(ext: string): "image" | "audio" | "pdf" | "unknown" {
  if (["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(ext)) return "image";
  if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  return "unknown";
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  // Получаем заголовки из запроса
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const bodyStream = Readable.fromWeb(req.body as any);
  const busboy = Busboy({ headers });

  const fields: Record<string, string> = {};
  const files: Array<{
    fieldname: string;
    file: Buffer;
    filename: string;
    mimeType: string;
  }> = [];

  const parsePromise = new Promise<void>((resolve, reject) => {
    busboy.on("field", (name, val) => {
      fields[name] = val;
    });
    busboy.on("file", (fieldname, stream, { filename, mimeType }) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("end", () => {
        files.push({ fieldname, file: Buffer.concat(chunks), filename, mimeType });
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

  const bucket = String(fields.bucket || "media").trim();
  const folder = cleanFolder(fields.folder || "");
  const explicitPath = String(fields.path || "").trim();
  const upsert = ["1", "true", "yes", "y", "да"].includes(String(fields.upsert || "").toLowerCase());

  if (!bucket) {
    return fail("Не указан bucket для загрузки", 400, "MISSING_BUCKET", noStoreInit());
  }

  // Валидация файлов
  const validFiles: typeof files = [];
  for (const f of files) {
    const ext = getFileExtension(f.filename);

    if (!isAllowedMediaExtension(ext)) {
      return fail(
        `Тип файла .${ext} не поддерживается. Разрешены: jpg, jpeg, png, gif, webp, avif, mp3, wav, ogg, m4a, pdf`,
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

  // Загрузка всех файлов параллельно
  const uploadPromises = validFiles.map(async (f) => {
    const ext = getFileExtension(f.filename);
    const path = explicitPath
      ? normalizeStorageObjectPath(explicitPath)
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