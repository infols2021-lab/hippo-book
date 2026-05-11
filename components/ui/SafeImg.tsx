/**
 * components/ui/SafeImg.tsx
 *
 * Универсальный <img> компонент для всего сайта.
 * Автоматически прогоняет src через прокси — пользователям
 * не нужен прямой доступ к Яндексу или Supabase.
 *
 * Использование — везде вместо <img>:
 *   import { SafeImg } from "@/components/ui/SafeImg";
 *   <SafeImg src={someUrl} alt="..." className="..." />
 */

"use client";

import React, { useState, useCallback } from "react";
import { rewriteSupabasePublicStorageUrl } from "@/lib/storage/publicUrl";

// ─────────────────────────────────────────────────────────────────────────────
// Типы
// ─────────────────────────────────────────────────────────────────────────────

type SafeImgProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  /** Исходный URL — любой формат: прямой Yandex, Supabase, прокси или data: */
  src?: string | null;
  /** Fallback если картинка не загрузилась (по умолчанию — скрыть элемент) */
  fallbackSrc?: string;
  /** Показывать ли заглушку при ошибке (по умолчанию true) */
  showPlaceholderOnError?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Компонент
// ─────────────────────────────────────────────────────────────────────────────

export function SafeImg({
  src,
  alt = "",
  fallbackSrc,
  showPlaceholderOnError = true,
  style,
  ...rest
}: SafeImgProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [hasError, setHasError] = useState(false);

  // Конвертируем URL в прокси-формат
  // rewriteSupabasePublicStorageUrl:
  //   - /api/storage/public/... → оставляет как есть
  //   - https://storage.yandexcloud.net/... → конвертирует в прокси
  //   - https://xxx.supabase.co/storage/... → конвертирует в прокси
  //   - data:... → оставляет как есть
  //   - "" / null / undefined → ""
  const rawUrl = src ? String(src).trim() : "";
  const baseUrl = rawUrl ? rewriteSupabasePublicStorageUrl(rawUrl) : "";

  // При retry добавляем ?retry=N чтобы сломать браузерный кеш ошибки
  const proxiedSrc = baseUrl
    ? retryCount > 0
      ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}retry=${retryCount}`
      : baseUrl
    : "";

  const handleError = useCallback(() => {
    if (fallbackSrc && !hasError) {
      setHasError(true);
      return;
    }
    if (!hasError) {
      setHasError(true);
    }
  }, [fallbackSrc, hasError]);

  // Нет URL — ничего не рендерим
  if (!proxiedSrc && !hasError) return null;

  // Ошибка + есть fallback — показываем fallback
  const displaySrc = hasError && fallbackSrc ? fallbackSrc : proxiedSrc;

  if (!displaySrc) {
    // Нет ни URL ни fallback — показываем заглушку или ничего
    if (!showPlaceholderOnError) return null;
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f1f5f9",
          color: "#94a3b8",
          fontSize: "11px",
          fontWeight: 600,
          borderRadius: "inherit",
          ...style,
        }}
        {...(rest as any)}
      >
        ⚠️
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={displaySrc}
      alt={alt}
      onError={handleError}
      style={style}
      {...rest}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Вспомогательная функция для использования вне JSX
// (например в src атрибутах обычных img тегов)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Конвертирует любой URL изображения в прокси-URL.
 * Используй когда нужно src без компонента SafeImg.
 *
 * Пример:
 *   <img src={toProxyUrl(cover_image_url)} alt="..." />
 */
export function toProxyUrl(url: string | null | undefined): string {
  if (!url) return "";
  const raw = String(url).trim();
  if (!raw) return "";
  return rewriteSupabasePublicStorageUrl(raw);
}