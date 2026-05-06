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

type UploadApiResponse = {
  ok?: boolean;
  error?: string;
  url?: string | null;
  publicUrl?: string | null;
  imageUrl?: string | null;
  path?: string | null;
  bucket?: string | null;
  data?: {
    url?: string | null;
    publicUrl?: string | null;
    imageUrl?: string | null;
    path?: string | null;
    bucket?: string | null;
  } | null;
};

function safeExt(name: string) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  return ext || "bin";
}

function isAllowedImageExt(ext: string) {
  return ["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(ext);
}

function cacheBustUrl(url: string) {
  if (!url) return "";
  return `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
}

async function readJsonSafe<T>(res: Response): Promise<T | null> {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function extractUploadUrl(json: UploadApiResponse | null, fallbackBucket: string): string {
  if (!json) return "";

  const directUrl = json.publicUrl || json.url || json.imageUrl || json.data?.publicUrl || json.data?.url || json.data?.imageUrl;

  if (directUrl) return String(directUrl);

  const bucket = json.bucket || json.data?.bucket || fallbackBucket;
  const path = json.path || json.data?.path;

  if (bucket && path) {
    return getStoragePublicUrl(String(bucket), String(path));
  }

  return "";
}

async function uploadImageThroughApi(params: {
  file: File;
  bucket: string;
  folder: string;
}) {
  const formData = new FormData();

  formData.append("file", params.file);
  formData.append("bucket", params.bucket);
  formData.append("folder", params.folder);
  formData.append("pathPrefix", params.folder);

  const res = await fetch("/api/admin/upload", {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  const json = await readJsonSafe<UploadApiResponse>(res);

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `HTTP ${res.status}`);
  }

  const uploadedUrl = extractUploadUrl(json, params.bucket);

  if (!uploadedUrl) {
    throw new Error("Сервер загрузил файл, но не вернул publicUrl");
  }

  return cacheBustUrl(uploadedUrl);
}

export default function ImageUpload({
  label = "Изображение для вопроса (опционально):",
  bucket = "question-images",
  value,
  onChange,
  disabled = false,
  maxMB = 5,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string>(value || "");

  useEffect(() => {
    setPreviewUrl(value || "");
  }, [value]);

  function openPicker() {
    if (disabled || busy) return;
    inputRef.current?.click();
  }

  function resetProgress() {
    setProgress(0);
  }

  async function uploadFile(file: File) {
    const ext = safeExt(file.name);

    if (!isAllowedImageExt(ext)) {
      throw new Error("Поддерживаются только JPG, PNG, GIF, WebP, AVIF");
    }

    if (file.size > maxMB * 1024 * 1024) {
      throw new Error(`Размер файла больше ${maxMB}MB`);
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    setBusy(true);
    setProgress(15);

    setProgress(45);

    const finalUrl = await uploadImageThroughApi({
      file,
      bucket,
      folder: "assignments",
    });

    setProgress(85);

    onChange(finalUrl);
    setPreviewUrl(finalUrl);

    setProgress(100);
    window.setTimeout(resetProgress, 450);
  }

  async function handleFile(file: File) {
    try {
      await uploadFile(file);
    } catch (e: any) {
      if (!value) setPreviewUrl("");

      resetProgress();
      alert("❌ Ошибка загрузки: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
      setDragOver(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className="form-group">
      <label>{label}</label>

      <div
        className={"upload-area" + (dragOver ? " dragover" : "")}
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
        accept="image/*"
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

      {previewUrl ? (
        <div style={{ marginTop: 10 }}>
          <img
            className="question-image-preview"
            src={previewUrl}
            alt="Предпросмотр изображения"
            style={{ display: "block" }}
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
            }}
            style={{ marginTop: 8 }}
          >
            🗑️ Удалить изображение
          </button>
        </div>
      ) : null}
    </div>
  );
}