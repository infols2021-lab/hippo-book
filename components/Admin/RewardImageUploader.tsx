"use client";

import React, { useState, useRef, DragEvent, ChangeEvent } from "react";

type Props = {
  value: string;
  onChange: (url: string) => void;
  bucket?: string;
  label?: string;
  disabled?: boolean;
};

export default function RewardImageUploader({
  value,
  onChange,
  bucket = "question-images",
  label = "Изображение предмета / награды:",
  disabled = false,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Пожалуйста, загружайте только изображения (PNG, WEBP, JPG, SVG)");
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", bucket);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Ошибка при загрузке файла");
      }

      // Получаем публичный URL и передаем наверх
      const uploadedUrl = data.publicUrl || data.url || "";
      onChange(uploadedUrl);
    } catch (err: any) {
      setError(err.message || "Не удалось загрузить картинку");
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || uploading) return;

    const file = e.dataTransfer.files[0];
    if (file) void uploadFile(file);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && !disabled && !uploading) {
      void uploadFile(file);
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{ fontWeight: 800, fontSize: 13, display: "block", marginBottom: 6, color: "#374151" }}>
          {label}
        </label>
      )}

      {/* Зона Drag & Drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? "var(--accent2, #4ecdc4)" : "rgba(0,0,0,0.15)"}`,
          background: isDragging ? "rgba(78, 205, 196, 0.08)" : "#f8fafc",
          borderRadius: 16,
          padding: 20,
          textAlign: "center",
          cursor: disabled || uploading ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: "none" }}
          disabled={disabled || uploading}
        />

        {value ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <img
              src={value}
              alt="Превью"
              style={{ maxHeight: 90, maxWidth: 120, objectFit: "contain", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)" }}
            />
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#166534" }}>✅ Картинка загружена</div>
              <div style={{ fontSize: 11, color: "#6b7280", wordBreak: "break-all", maxWidth: 260 }}>{value}</div>
              <button
                type="button"
                className="btn small ghost"
                style={{ marginTop: 6, color: "#ef4444" }}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
              >
                🗑️ Удалить / Заменить
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 32, marginBottom: 4 }}>
              {uploading ? "⚡" : "📦"}
            </div>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#1f2937" }}>
              {uploading ? "Загрузка в Yandex Storage..." : "Перетащите картинку сюда"}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
              или кликните, чтобы выбрать файл с компьютера
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: "#dc2626", fontSize: 12, fontWeight: 700, marginTop: 6 }}>
          ⚠️ {error}
        </div>
      )}
    </div>
  );
}