"use client";

// Общий превью-компонент картинок в вариантах ответов (test / matching /
// imagemap). Резервирует место под картинку (boxWidth x boxHeight), пока она
// грузится показывает спокойный серый скелетон (bg-slate-100 animate-pulse)
// и плавно проявляет изображение после загрузки — без скачков layout (CLS).
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { getImageUrl } from "@/lib/assignments/image";

type Props = {
  src: string;
  alt?: string;
  priority?: boolean;
  /** Резерв места под картинку, чтобы карточка не «прыгала» до загрузки. */
  boxWidth?: number;
  boxHeight?: number;
  /** Максимальный размер самой картинки внутри бокса. */
  imgMaxWidth?: number;
  imgMaxHeight?: number;
  radius?: number;
  style?: CSSProperties;
  imgStyle?: CSSProperties;
};

export default function MediaImage({
  src,
  alt = "",
  priority = false,
  boxWidth = 120,
  boxHeight = 120,
  imgMaxWidth = boxWidth,
  imgMaxHeight = boxHeight,
  radius = 10,
  style,
  imgStyle,
}: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const resolved = getImageUrl(src);

  // Если картинка пришла из дискового кеша, onLoad может не сработать —
  // проверяем флаг complete после монтирования (см. MediaRenderer).
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [resolved]);

  if (!resolved) return null;

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-slate-100 ${
        loaded ? "" : "animate-pulse"
      }`}
      style={{
        width: boxWidth,
        height: boxHeight,
        minWidth: boxWidth,
        minHeight: boxHeight,
        borderRadius: radius,
        border: "1px solid rgba(2, 6, 23, 0.06)",
        ...style,
      }}
    >
      {!failed && (
        <img
          ref={imgRef}
          src={resolved}
          alt={alt}
          loading="eager"
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          draggable={false}
          style={{
            maxWidth: imgMaxWidth,
            maxHeight: imgMaxHeight,
            width: "auto",
            height: "auto",
            objectFit: "contain",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.25s ease",
            ...imgStyle,
          }}
        />
      )}
    </div>
  );
}
