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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ref-флаг защиты от race condition при двойном клике / двойном drop:
  const uploadingRef = useRef(false);

  async function parseServerResponse(response: Response) {
    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      const rawText = await response.text();
      if (contentType.includes("text/html") || rawText.trimStart().startsWith("<")) {
        const titleMatch = rawText.match(/<title>(.*?)<\/title>/i);
        const message = titleMatch
          ? `Ошибка сервера: ${titleMatch[1]}`
          : `Ошибка сервера (${response.status})`;
        throw new Error(message);
      }

      try {
        const json = JSON.parse(rawText);
        throw new Error(json.error || `Ошибка загрузки (${response.status})`);
      } catch (e) {
        throw new Error(
          rawText.length > 200
            ? `Ошибка загрузки (${response.status}): ${rawText.slice(0, 200)}…`
            : rawText,
        );
      }
    }

    return response.json();
  }

  async function handleFiles(files: FileList | File[]) {
    // Двойная защита: ref — синхронная (мгновенная), state — для UI
    if (disabled || uploadingRef.current) return;

    // mp4 добавлен: аудиозаписи с мобильных устройств часто имеют расширение .mp4
    const allowedExtensions = [
      "jpg", "jpeg", "png", "gif", "webp", "avif",
      "mp3", "wav", "ogg", "m4a", "mp4", "pdf",
    ];

    const validFiles = Array.from(files).filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      return allowedExtensions.includes(ext);
    });

    if (validFiles.length === 0) {
      setUploadError(
        "Неподдерживаемый формат файла. Разрешены: JPG, PNG, GIF, WebP, MP3, WAV, OGG, M4A, MP4, PDF.",
      );
      return;
    }

    // Выставляем оба флага — ref синхронно, state для рендера
    uploadingRef.current = true;
    setUploading(true);
    setUploadError(null);

    const newMediaAttachments: MediaAttachment[] = [];

    for (const file of validFiles) {
      try {
        const formData = new FormData();
        formData.append("bucket", bucket);
        formData.append("file", file);

        const response = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });

        const data = await parseServerResponse(response);

        // Извлекаем данные загруженного файла
        const fileData = Array.isArray(data.files) && data.files.length > 0
          ? data.files[0]
          : {
              publicUrl: data.publicUrl,
              mediaType: data.mediaType || "image",
              fileName: data.fileName || file.name,
            };

        if (!fileData?.publicUrl) {
          throw new Error("Сервер не вернул publicUrl для файла " + file.name);
        }

        newMediaAttachments.push({
          id: crypto.randomUUID(),
          url: fileData.publicUrl,
          type: fileData.mediaType || "image",
          name: fileData.fileName || file.name,
        });
      } catch (err: any) {
        // Останавливаемся при первой ошибке
        let message = "Ошибка при загрузке файлов.";
        if (err instanceof Error) {
          if (
            err.message.includes("Failed to fetch") ||
            err.message.includes("NetworkError")
          ) {
            message = "Ошибка соединения с сервером. Проверьте интернет и попробуйте снова.";
          } else {
            message = err.message;
          }
        } else if (typeof err === "string") {
          message = err;
        }
        setUploadError(message);
        break;
      }
    }

    uploadingRef.current = false;
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

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
          <div
            style={{
              color: "#007bff",
              fontWeight: 500,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                border: "3px solid rgba(0,123,255,0.2)",
                borderTopColor: "#007bff",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <span>Загрузка файлов…</span>
          </div>
        ) : (
          <div style={{ color: "rgba(0,0,0,0.5)" }}>
            <span style={{ fontSize: "24px", display: "block", marginBottom: "8px" }}>
              📥
            </span>
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
          disabled={disabled}
        />
      </div>

      {/* ---- Ошибка загрузки ---- */}
      {uploadError && (
        <div
          style={{
            marginTop: "8px",
            padding: "10px 14px",
            background: "#fff5f5",
            color: "#c62828",
            border: "1px solid #ffcdd2",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 500,
            lineHeight: 1.4,
          }}
        >
          ⚠️ {uploadError}
          <button
            type="button"
            onClick={() => setUploadError(null)}
            style={{
              marginLeft: 10,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#c62828",
              fontWeight: "bold",
            }}
            title="Закрыть"
          >
            ✕
          </button>
        </div>
      )}

      {/* ---- Список уже прикреплённых файлов ---- */}
      {value.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            marginTop: "16px",
          }}
        >
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
                <img
                  src={m.url}
                  alt={m.name || "media"}
                  style={{
                    width: "100%",
                    height: "100px",
                    objectFit: "contain",
                    borderRadius: "4px",
                  }}
                />
              )}
              {m.type === "audio" && (
                <div style={{ textAlign: "center", padding: "10px 0" }}>
                  <div style={{ fontSize: "24px", marginBottom: "8px" }}>🎵</div>
                  <audio
                    src={m.url}
                    controls
                    style={{ width: "100%", height: "30px" }}
                  />
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#666",
                      marginTop: 4,
                      wordBreak: "break-all",
                    }}
                  >
                    {m.name}
                  </div>
                </div>
              )}
              {m.type === "pdf" && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "16px 0",
                    wordBreak: "break-word",
                  }}
                >
                  <div
                    style={{
                      fontSize: "32px",
                      marginBottom: "8px",
                      color: "#e25555",
                    }}
                  >
                    📄
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: 500, lineHeight: 1.2 }}>
                    {m.name || "Документ PDF"}
                  </div>
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

      {/* Анимация спиннера */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}