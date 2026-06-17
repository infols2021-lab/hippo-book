"use client";

import { useRef, useState } from "react";
import type { MediaAttachment } from "./types";

type Props = {
  value: MediaAttachment[];
  onChange: (media: MediaAttachment[]) => void;
  disabled?: boolean;
  bucket?: string;
  audioBucket?: string;
  label?: string;
};

// ==========================================
// УТИЛИТА ДЛЯ ЗАГРУЗКИ (Изолированная логика)
// ==========================================

async function uploadMediaFile(file: File, targetBucket: string) {
  const formData = new FormData();
  formData.append("bucket", targetBucket);
  formData.append("folder", "assignments");
  formData.append("pathPrefix", "assignments");
  formData.append("file", file);

  const response = await fetch("/api/admin/upload", {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  let data: Record<string, unknown>;
  try {
    data = await response.json() as Record<string, unknown>;
  } catch {
    throw new Error(`Ошибка сервера: невозможно прочитать ответ (${response.status})`);
  }

  if (!response.ok || !(data as any).ok) {
    throw new Error(String((data as any).error || `Ошибка загрузки (${response.status})`));
  }

  // Извлекаем данные загруженного файла (поддержка старого и нового формата ответа)
  const filesArray = (data as any).files;
  const fileData = Array.isArray(filesArray) && filesArray.length > 0
    ? filesArray[0]
    : {
        publicUrl: (data as any).publicUrl || (data as any).url || (data as any).data?.publicUrl,
        mediaType: (data as any).mediaType || "image",
        fileName: (data as any).fileName || file.name,
      };

  if (!fileData?.publicUrl) {
    throw new Error("Сервер загрузил файл, но не вернул публичную ссылку (publicUrl)");
  }

  return {
    url: String(fileData.publicUrl),
    type: String(fileData.mediaType || "image") as MediaAttachment["type"],
    name: String(fileData.fileName || file.name),
  };
}

// ==========================================
// КОМПОНЕНТ
// ==========================================

export default function MediaUpload({
  value,
  onChange,
  disabled,
  bucket = "question-images",
  audioBucket,
  label = "Медиафайлы (Изображения, Аудио, PDF):",
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ref-флаг защиты от race condition при двойном клике
  const uploadingRef = useRef(false);

  async function handleFiles(files: FileList | File[]) {
    if (disabled || uploadingRef.current) return;

    const allowedExtensions = [
      "jpg", "jpeg", "png", "gif", "webp", "avif",
      "mp3", "wav", "ogg", "m4a", "mp4", "pdf",
    ];

    const validFiles = Array.from(files).filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      return allowedExtensions.includes(ext);
    });

    if (validFiles.length === 0) {
      setUploadError("Неподдерживаемый формат. Разрешены: JPG, PNG, GIF, WebP, MP3, WAV, OGG, M4A, MP4, PDF.");
      return;
    }

    uploadingRef.current = true;
    setUploading(true);
    setUploadError(null);

    const newMediaAttachments: MediaAttachment[] = [];

    for (const file of validFiles) {
      try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        const isAudio = ["mp3", "wav", "ogg", "m4a", "mp4"].includes(ext);
        const targetBucket = isAudio && audioBucket ? audioBucket : bucket;

        const uploadedFile = await uploadMediaFile(file, targetBucket);

        newMediaAttachments.push({
          id: crypto.randomUUID(),
          url: uploadedFile.url,
          type: uploadedFile.type,
          name: uploadedFile.name,
        });
      } catch (err: unknown) {
        let message = "Ошибка при загрузке файлов.";
        if (err instanceof Error) {
          message = err.message.includes("Failed to fetch") 
            ? "Ошибка соединения с сервером. Проверьте интернет." 
            : err.message;
        } else if (typeof err === "string") {
          message = err;
        }
        setUploadError(message);
        break; // Останавливаемся при первой ошибке, чтобы не спамить загрузками
      }
    }

    uploadingRef.current = false;
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (newMediaAttachments.length > 0) {
      onChange([...value, ...newMediaAttachments]);
    }
  }

  function handleRemove(idToRemove: string) {
    if (disabled) return;
    onChange(value.filter((m) => m.id !== idToRemove));
  }

  return (
    <div className="form-group" style={{ marginBottom: "16px" }}>
      <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
        {label}
      </label>

      {/* ---- Зона перетаскивания / выбора ---- */}
      <div
        style={{
          border: `2px dashed ${dragOver ? "#007bff" : "rgba(0,0,0,0.15)"}`,
          borderRadius: "12px",
          padding: "20px",
          textAlign: "center",
          backgroundColor: dragOver ? "rgba(0,123,255,0.05)" : "transparent",
          transition: "all 0.2s ease",
          cursor: disabled || uploading ? "not-allowed" : "pointer",
          opacity: disabled || uploading ? 0.6 : 1,
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled && !uploading && e.dataTransfer.files?.length) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
      >
        {uploading ? (
          <div style={{ color: "#007bff", fontWeight: 500, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            {/* Встроенный SVG спиннер (работает без <style jsx>) */}
            <svg width="28" height="28" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke="#007bff">
              <g fill="none" fillRule="evenodd">
                <g transform="translate(1 1)" strokeWidth="2.5">
                  <circle strokeOpacity=".2" cx="11" cy="11" r="11" />
                  <path d="M22 11c0-6.075-4.925-11-11-11">
                    <animateTransform attributeName="transform" type="rotate" from="0 11 11" to="360 11 11" dur="0.8s" repeatCount="indefinite" />
                  </path>
                </g>
              </g>
            </svg>
            <span>Загрузка файлов…</span>
          </div>
        ) : (
          <div style={{ color: "rgba(0,0,0,0.5)" }}>
            <span style={{ fontSize: "24px", display: "block", marginBottom: "8px" }}>📥</span>
            Перетащите файлы сюда или нажмите для выбора
            <div style={{ fontSize: "12px", marginTop: "4px" }}>
              (JPG, PNG, GIF, WebP, MP3, WAV, OGG, M4A, MP4, PDF)
            </div>
          </div>
        )}
        <input
          type="file"
          multiple
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          accept="image/*,audio/*,video/mp4,application/pdf"
          disabled={disabled || uploading}
        />
      </div>

      {/* ---- Ошибка загрузки ---- */}
      {uploadError && (
        <div style={{ marginTop: "8px", padding: "10px 14px", background: "#fff5f5", color: "#c62828", border: "1px solid #ffcdd2", borderRadius: "8px", fontSize: "13px", fontWeight: 500, lineHeight: 1.4 }}>
          ⚠️ {uploadError}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setUploadError(null); }}
            style={{ marginLeft: 10, background: "none", border: "none", cursor: "pointer", color: "#c62828", fontWeight: "bold" }}
            title="Закрыть"
          >
            ✕
          </button>
        </div>
      )}

      {/* ---- Список прикреплённых файлов ---- */}
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "16px" }}>
          {value.map((m) => (
            <div key={m.id} style={{ position: "relative", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px", padding: "8px", width: "200px", backgroundColor: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
              
              {m.type === "image" && (
                <img src={m.url} alt={m.name || "media"} style={{ width: "100%", height: "100px", objectFit: "contain", borderRadius: "4px" }} />
              )}
              
              {m.type === "audio" && (
                <div style={{ textAlign: "center", padding: "10px 0" }}>
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>🎵</div>
                  <audio src={m.url} controls style={{ width: "100%", height: "30px" }} />
                  <div style={{ fontSize: "11px", color: "#666", marginTop: 4, wordBreak: "break-all" }}>{m.name}</div>
                </div>
              )}
              
              {m.type === "pdf" && (
                <div style={{ textAlign: "center", padding: "16px 0", wordBreak: "break-word" }}>
                  <div style={{ fontSize: "32px", marginBottom: "8px", color: "#e25555" }}>📄</div>
                  <div style={{ fontSize: "12px", fontWeight: 500, lineHeight: 1.2 }}>{m.name || "Документ PDF"}</div>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleRemove(m.id)}
                disabled={disabled || uploading}
                style={{
                  position: "absolute", top: "-8px", right: "-8px", background: "#ff4d4f", color: "#fff",
                  border: "none", borderRadius: "50%", width: "24px", height: "24px",
                  cursor: disabled || uploading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "14px", boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                }}
                title="Удалить"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}