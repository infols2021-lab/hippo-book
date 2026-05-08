"use client";

import { useRef, useState } from "react";
import type { MediaAttachment } from "./types";

type Props = {
  value: MediaAttachment[];
  onChange: (media: MediaAttachment[]) => void;
  disabled?: boolean;
  bucket?: string;
  label?: string;
};

export default function MediaUpload({
  value,
  onChange,
  disabled,
  bucket = "question-images",
  label = "Медиафайлы (Изображения, Аудио, PDF):",
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    if (disabled || uploading) return;

    const validFiles = Array.from(files).filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      return ["jpg", "jpeg", "png", "gif", "webp", "avif", "mp3", "wav", "ogg", "m4a", "pdf"].includes(ext);
    });

    if (validFiles.length === 0) {
      alert("Неподдерживаемый формат файла.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("bucket", bucket);
      formData.append("kind", "image"); // API пока использует этот флаг исторически, но внутри пропускает новые форматы
      validFiles.forEach((file) => formData.append("file", file));

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "Ошибка загрузки");
      }

      // Если вернулся массив files (новый API)
      const uploadedFiles = data.files || [data]; 
      
      const newMedia: MediaAttachment[] = uploadedFiles.map((uf: any) => ({
        id: crypto.randomUUID(),
        url: uf.publicUrl,
        type: uf.mediaType,
        name: uf.fileName,
      }));

      onChange([...value, ...newMedia]);
    } catch (err: any) {
      alert(err.message || "Ошибка при загрузке");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleRemove(idToRemove: string) {
    if (disabled) return;
    onChange(value.filter((m) => m.id !== idToRemove));
  }

  return (
    <div className="form-group" style={{ marginBottom: "16px" }}>
      <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>{label}</label>

      {/* Зона загрузки */}
      <div
        style={{
          border: `2px dashed ${dragOver ? "#007bff" : "rgba(0,0,0,0.15)"}`,
          borderRadius: "12px",
          padding: "20px",
          textAlign: "center",
          backgroundColor: dragOver ? "rgba(0,123,255,0.05)" : "transparent",
          transition: "all 0.2s ease",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        {uploading ? (
          <div style={{ color: "#007bff", fontWeight: 500 }}>⏳ Загрузка файлов...</div>
        ) : (
          <div style={{ color: "rgba(0,0,0,0.5)" }}>
            <span style={{ fontSize: "24px", display: "block", marginBottom: "8px" }}>📥</span>
            Перетащите файлы сюда или нажмите для выбора
            <div style={{ fontSize: "12px", marginTop: "4px" }}>
              (JPG, PNG, GIF, WebP, MP3, WAV, PDF)
            </div>
          </div>
        )}
        <input
          type="file"
          multiple
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          accept="image/*,audio/*,application/pdf"
          disabled={disabled}
        />
      </div>

      {/* Список прикрепленных медиа */}
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "16px" }}>
          {value.map((m) => (
            <div
              key={m.id}
              style={{
                position: "relative",
                border: "1px solid rgba(0,0,0,0.1)",
                borderRadius: "8px",
                padding: "8px",
                width: "200px",
                backgroundColor: "#fff",
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
              }}
            >
              {m.type === "image" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="media" style={{ width: "100%", height: "100px", objectFit: "contain", borderRadius: "4px" }} />
              )}
              {m.type === "audio" && (
                <div style={{ textAlign: "center", padding: "10px 0" }}>
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>🎵</div>
                  <audio src={m.url} controls style={{ width: "100%", height: "30px" }} />
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
                disabled={disabled}
                style={{
                  position: "absolute",
                  top: "-8px",
                  right: "-8px",
                  background: "#ff4d4f",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  width: "24px",
                  height: "24px",
                  cursor: disabled ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
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