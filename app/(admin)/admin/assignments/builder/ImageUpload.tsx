"use client";

import { useEffect, useRef, useState } from "react";
import { getStoragePublicUrl } from "@/lib/storage/publicUrl";

type Props = {
  label?: string;
  bucket?: string;
  value: string;
  onChange: (nextUrl: string) => void;
  disabled?: boolean;
  maxMB?: number;
};

// Белый список разрешенных бакетов для Yandex Storage
const ALLOWED_BUCKETS = ["question-images", "hippo-book-audio", "assignments", "materials", "public"];

// ==========================================
// УТИЛИТЫ ДЛЯ ЗАГРУЗКИ
// ==========================================

function safeExt(name: string) {
  return (name.split(".").pop() || "").toLowerCase() || "bin";
}

function isAllowedImageExt(ext: string) {
  return ["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(ext);
}

function cacheBustUrl(url: string) {
  if (!url) return "";
  return `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
}

async function uploadImageThroughApi(file: File, bucket: string, folder: string): Promise<string> {
  // Базовая клиентская защита от подмены бакета
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    throw new Error("Недопустимый бакет для загрузки файлов");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("bucket", bucket);
  formData.append("folder", folder);
  formData.append("pathPrefix", folder);

  const res = await fetch("/api/admin/upload", {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  let json: Record<string, any>;
  try {
    json = await res.json();
  } catch {
    throw new Error("Ошибка сервера: не удалось прочитать ответ");
  }

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `HTTP ${res.status}`);
  }

  // Пытаемся извлечь прямой URL
  const directUrl =
    json.publicUrl || json.url || json.imageUrl ||
    json.data?.publicUrl || json.data?.url || json.data?.imageUrl;

  if (directUrl) return cacheBustUrl(String(directUrl));

  // Если прямого URL нет, генерируем его через бакет и путь
  const resBucket = json.bucket || json.data?.bucket || bucket;
  const resPath = json.path || json.data?.path;

  if (resBucket && resPath) {
    return cacheBustUrl(getStoragePublicUrl(String(resBucket), String(resPath)));
  }

  throw new Error("Сервер загрузил файл, но не вернул публичную ссылку (publicUrl)");
}

// ==========================================
// КОМПОНЕНТ
// ==========================================

export default function ImageUpload({
  label = "Изображение для вопроса (опционально):",
  bucket = "question-images",
  value,
  onChange,
  disabled = false,
  maxMB = 5,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const localUrlRef = useRef<string | null>(null); // Для очистки URL.createObjectURL

  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string>(value || "");
  const [error, setError] = useState<string | null>(null); 

  useEffect(() => {
    setPreviewUrl(value || "");
    setError(null);
  }, [value]);

  useEffect(() => {
    return () => {
      if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
    };
  }, []);

  function openPicker() {
    if (disabled || busy) return;
    inputRef.current?.click();
  }

  function resetProgress() {
    setProgress(0);
  }

  async function handleFile(file: File) {
    setError(null);
    const ext = safeExt(file.name);

    if (!isAllowedImageExt(ext)) {
      setError("Поддерживаются только JPG, PNG, GIF, WebP, AVIF");
      return;
    }

    if (file.size > maxMB * 1024 * 1024) {
      setError(`Размер файла больше ${maxMB}MB`);
      return;
    }

    if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    localUrlRef.current = objectUrl;
    
    setPreviewUrl(objectUrl);
    setBusy(true);
    setProgress(15);

    try {
      setProgress(45);
      const finalUrl = await uploadImageThroughApi(file, bucket, "assignments");
      setProgress(85);

      onChange(finalUrl);
      setPreviewUrl(finalUrl);
      
      URL.revokeObjectURL(objectUrl);
      localUrlRef.current = null;

      setProgress(100);
      window.setTimeout(resetProgress, 450);
    } catch (err: unknown) {
      if (!value) setPreviewUrl("");
      resetProgress();
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setDragOver(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="form-group">
      <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>{label}</label>

      {error && (
        <div style={{ padding: "8px 12px", background: "#fee", color: "red", borderRadius: 8, marginBottom: 12, fontSize: 14 }}>
          ❌ Ошибка загрузки: {error}
        </div>
      )}

      <div
        className={`upload-area ${dragOver ? "dragover" : ""}`}
        onClick={openPicker}
        onDragOver={(e) => {
          e.preventDefault();
          if (disabled || busy) return;
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (disabled || busy) return;
          setDragOver(false);

          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        role="button"
        aria-disabled={disabled || busy}
        style={{
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <p style={{ margin: 0 }}>📁 Нажмите для загрузки изображения или перетащите файл сюда</p>
        <p className="small-muted" style={{ marginTop: 6 }}>
          Поддерживаемые форматы: JPG, PNG, GIF, WebP, AVIF, максимум {maxMB}MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png, image/jpeg, image/gif, image/webp, image/avif"
        disabled={disabled || busy}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <div className="upload-progress" style={{ display: busy || progress > 0 ? "block" : "none" }}>
        <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      {previewUrl && (
        <div style={{ marginTop: 10 }}>
          <img
            className="question-image-preview"
            src={previewUrl}
            alt="Предпросмотр изображения"
            style={{ display: "block", maxWidth: 200, borderRadius: 8 }}
            onError={() => {
              if (!value) setPreviewUrl("");
            }}
          />

          <button
            type="button"
            className="btn btn-small btn-danger remove-image-btn"
            disabled={disabled || busy}
            onClick={() => {
              setPreviewUrl("");
              onChange("");
              resetProgress();
              setError(null);
            }}
            style={{ marginTop: 8 }}
          >
            🗑️ Удалить изображение
          </button>
        </div>
      )}
    </div>
  );
}