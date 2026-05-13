"use client";

import { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  src: string;
  zoom: number;
  setZoom: (z: number) => void;
  onClose: () => void;
};

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const WHEEL_ZOOM_FACTOR = 0.1;

export default function ImageModal({ open, src, zoom, setZoom, onClose }: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, translateX: 0, translateY: 0 });
  const translate = useRef({ x: 0, y: 0 });

  // При открытии: запрет скролла body + моментальный прыжок в верх страницы
  useEffect(() => {
    if (open) {
      // Фиксируем текущую позицию скролла, но модалка всё равно fixed – не нужно.
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "contain";
      // Мгновенный прыжок в начало, чтобы модалка всегда была видна
      window.scrollTo(0, 0);
    } else {
      document.body.style.overflow = "";
      document.body.style.overscrollBehavior = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.overscrollBehavior = "";
    };
  }, [open]);

  // Автоподгон размера изображения при открытии
  useEffect(() => {
    if (open) {
      translate.current = { x: 0, y: 0 };
      if (imageRef.current) {
        imageRef.current.style.transform = `translate(0px, 0px) scale(${zoom})`;
        imageRef.current.style.transition = "transform 0.2s ease";
        const fitZoom = calculateFitZoom(imageRef.current, containerRef.current);
        setZoom(Math.min(MAX_ZOOM, Math.max(1, fitZoom)));
      }
    }
  }, [open, src]);

  // Обновление transform при изменении zoom
  useEffect(() => {
    if (!imageRef.current) return;
    imageRef.current.style.transform = `translate(${translate.current.x}px, ${translate.current.y}px) scale(${zoom})`;
    imageRef.current.style.transition = "transform 0.15s ease";
  }, [zoom]);

  // Закрытие по Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Прокрутка колёсиком
  const handleWheel = (e: React.WheelEvent) => {
    if (!imageRef.current) return;
    e.preventDefault();
    const delta = -Math.sign(e.deltaY);
    const newZoom = +(zoom + delta * WHEEL_ZOOM_FACTOR).toFixed(2);
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom)));
  };

  // Drag мышью
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    dragging.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      translateX: translate.current.x,
      translateY: translate.current.y,
    };
    if (imageRef.current) {
      imageRef.current.style.cursor = "grabbing";
      imageRef.current.style.transition = "none";
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current || !imageRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    translate.current = {
      x: dragStart.current.translateX + dx,
      y: dragStart.current.translateY + dy,
    };
    imageRef.current.style.transform = `translate(${translate.current.x}px, ${translate.current.y}px) scale(${zoom})`;
  };

  const handleMouseUp = () => {
    if (dragging.current) {
      dragging.current = false;
      if (imageRef.current) {
        imageRef.current.style.cursor = zoom > 1 ? "grab" : "default";
        imageRef.current.style.transition = "transform 0.15s ease";
      }
    }
  };

  // Touch drag
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) return;
    if (zoom <= 1) return;
    const touch = e.touches[0];
    dragging.current = true;
    dragStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      translateX: translate.current.x,
      translateY: translate.current.y,
    };
    if (imageRef.current) {
      imageRef.current.style.cursor = "grabbing";
      imageRef.current.style.transition = "none";
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || !imageRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStart.current.x;
    const dy = touch.clientY - dragStart.current.y;
    translate.current = {
      x: dragStart.current.translateX + dx,
      y: dragStart.current.translateY + dy,
    };
    imageRef.current.style.transform = `translate(${translate.current.x}px, ${translate.current.y}px) scale(${zoom})`;
  };

  const handleTouchEnd = () => {
    if (dragging.current) {
      dragging.current = false;
      if (imageRef.current) {
        imageRef.current.style.cursor = zoom > 1 ? "grab" : "default";
        imageRef.current.style.transition = "transform 0.15s ease";
      }
    }
  };

  function calculateFitZoom(img: HTMLImageElement, container: HTMLElement | null) {
    if (!container) return 1;
    const containerW = container.clientWidth * 0.9;
    const containerH = container.clientHeight * 0.85;
    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    if (!imgW || !imgH) return 1;
    const scaleW = containerW / imgW;
    const scaleH = containerH / imgH;
    return Math.min(scaleW, scaleH);
  }

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(10px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        touchAction: "none",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Кнопка закрытия */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 18,
          right: 22,
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.2)",
          background: "rgba(255,255,255,0.1)",
          color: "#fff",
          fontSize: 28,
          fontWeight: 300,
          cursor: "pointer",
          backdropFilter: "blur(14px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
        aria-label="Закрыть"
      >
        ✕
      </button>

      <img
        ref={imageRef}
        src={src}
        alt=""
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        draggable={false}
        style={{
          maxWidth: "90vw",
          maxHeight: "85vh",
          objectFit: "contain",
          borderRadius: 12,
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          cursor: zoom > 1 ? "grab" : "default",
          userSelect: "none",
          transition: "transform 0.15s ease",
        }}
      />

      {/* Панель управления зумом */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(18px)",
          padding: "10px 18px",
          borderRadius: 30,
          border: "1px solid rgba(255,255,255,0.15)",
          zIndex: 10,
        }}
      >
        <button
          onClick={() => setZoom(Math.max(MIN_ZOOM, +(zoom - ZOOM_STEP).toFixed(2)))}
          style={btnStyle}
          type="button"
        >
          −
        </button>

        <span style={{ color: "#fff", fontWeight: 700, minWidth: 56, textAlign: "center", fontSize: 15 }}>
          {Math.round(zoom * 100)}%
        </span>

        <button
          onClick={() => setZoom(Math.min(MAX_ZOOM, +(zoom + ZOOM_STEP).toFixed(2)))}
          style={btnStyle}
          type="button"
        >
          +
        </button>

        <button
          onClick={() => {
            translate.current = { x: 0, y: 0 };
            setZoom(1);
            if (imageRef.current) {
              imageRef.current.style.transform = "translate(0px, 0px) scale(1)";
            }
          }}
          style={{ ...btnStyle, fontSize: 18 }}
          type="button"
        >
          ⟲
        </button>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: "50%",
  border: "2px solid rgba(255,255,255,0.25)",
  background: "rgba(255,255,255,0.12)",
  color: "#fff",
  fontSize: 24,
  fontWeight: 400,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.15s",
};