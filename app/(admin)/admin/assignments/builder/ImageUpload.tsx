"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Props = {
  label?: string;
  bucket?: string; // default: question-images
  value: string; // public url or ""
  onChange: (nextUrl: string) => void;
  disabled?: boolean;
  maxMB?: number; // default 5
};

function safeExt(name: string) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  return ext || "bin";
}

function isAllowedImageExt(ext: string) {
  return ["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(ext);
}

function randomId(len = 8) {
  return Math.random().toString(36).slice(2, 2 + len);
}

export default function ImageUpload({
  label = "Изображение для вопроса (опционально):",
  bucket = "question-images",
  value,
  onChange,
  disabled,
  maxMB = 5,
}: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
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
      throw new Error(`Размер файла > ${maxMB}MB`);
    }

    // локальный preview сразу
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    setBusy(true);
    setProgress(15);

    // path
    const path = `${Date.now()}_${randomId(6)}.${ext}`;

    // лёгкая “анимация прогресса”
    setProgress(45);

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("not found") || msg.includes("bucket")) {
        throw new Error(`Бакет "${bucket}" не найден. Создай его в Supabase Storage и сделай публичным.`);
      }
      throw new Error(error.message);
    }

    setProgress(85);

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = data?.publicUrl || "";
    if (!publicUrl) throw new Error("Не удалось получить publicUrl");

    // cache bust
    const finalUrl = publicUrl + `?v=${Date.now()}`;
    onChange(finalUrl);

    setProgress(100);
    setTimeout(resetProgress, 450);
  }

  async function handleFile(file: File) {
    try {
      await uploadFile(file);
    } catch (e: any) {
      // если упало — убираем preview, если раньше не было value
      if (!value) setPreviewUrl("");
      resetProgress();
      alert("❌ Ошибка загрузки: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
      setDragOver(false);
      // чистим input чтобы можно было выбрать тот же файл снова
      if (inputRef.current) inputRef.current.value = "";
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
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
        role="button"
        aria-disabled={disabled || busy}
        style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
      >
        <p style={{ margin: 0 }}>
          📁 Нажмите для загрузки изображения или перетащите файл сюда
        </p>
        <p className="small-muted" style={{ marginTop: 6 }}>
          Поддерживаемые форматы: JPG, PNG, GIF, WebP, AVIF (макс. {maxMB}MB)
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        disabled={disabled || busy}
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />

      {/* progress */}
      <div className="upload-progress" style={{ display: busy || progress > 0 ? "block" : "none" }}>
        <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      {/* preview */}
      {previewUrl ? (
        <div style={{ marginTop: 10 }}>
          <img
            className="question-image-preview"
            src={previewUrl}
            alt="Предпросмотр изображения"
            style={{ display: "block" }}
            onError={() => {
              // если битая ссылка — просто прячем
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
