"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  src: string;
  onClose: () => void;
};

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const WHEEL_ZOOM_FACTOR = 0.1;

export default function ImageModal({ open, src, onClose }: Props) {
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const translate = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, translateX: 0, translateY: 0 });

  // Блокируем скролл body при открытии, сбрасываем трансформацию
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      document.body.style.overscrollBehavior = "contain";
      translate.current = { x: 0, y: 0 };
      setZoom(1);
      if (imageRef.current) {
        imageRef.current.style.transform = "translate(0px, 0px) scale(1)";
        imageRef.current.style.transition = "transform 0.2s ease";
      }
      // Автоподгон размера после загрузки изображения
      setTimeout(() => {
        if (imageRef.current && containerRef.current) {
          const fit = calculateFitZoom(imageRef.current, containerRef.current);
          setZoom(Math.min(MAX_ZOOM, Math.max(1, fit)));
        }
      }, 50);
    } else {
      document.body.style.overflow = "";
      document.body.style.overscrollBehavior = "";
      setZoom(1);
      translate.current = { x: 0, y: 0 };
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.overscrollBehavior = "";
    };
  }, [open]);

  // Применяем трансформацию при каждом изменении зума или переводе
  useEffect(() => {
    if (!imageRef.current) return;
    imageRef.current.style.transform = `translate(${translate.current.x}px, ${translate.current.y}px) scale(${zoom})`;
    imageRef.current.style.transition = "transform 0.15s cubic-bezier(0.2, 0.9, 0.4, 1.1)";
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

  // Подгонка размера под экран
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

  // Колёсико мыши / тачпад
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

  // Touch drag (один палец)
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

  // Пинч (двумя пальцами) – простейшая реализация через отслеживание расстояния
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  const handleTouchStartPinch = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      pinchRef.current = { dist, zoom };
    }
  };
  const handleTouchMovePinch = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const ratio = newDist / pinchRef.current.dist;
      let newZoom = pinchRef.current.zoom * ratio;
      newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
      setZoom(newZoom);
    }
  };
  const handleTouchEndPinch = () => {
    pinchRef.current = null;
  };

  // Сброс (центр + масштаб 1)
  const resetTransform = () => {
    translate.current = { x: 0, y: 0 };
    setZoom(1);
  };

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={(e) => {
        handleTouchStart(e);
        handleTouchStartPinch(e);
      }}
      onTouchMove={(e) => {
        handleTouchMove(e);
        handleTouchMovePinch(e);
      }}
      onTouchEnd={() => {
        handleTouchEnd();
        handleTouchEndPinch();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.94)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        touchAction: "none",
        willChange: "transform",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Кнопка закрытия */}
      <button
        onClick={onClose}
        className="image-modal-close-btn"
        aria-label="Закрыть"
        style={{
          position: "absolute",
          top: 20,
          right: 24,
          width: 48,
          height: 48,
          borderRadius: "50%",
          border: "none",
          background: "rgba(255,255,255,0.15)",
          backdropFilter: "blur(8px)",
          color: "#fff",
          fontSize: 28,
          fontWeight: 300,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "transform 0.2s, background 0.2s",
          zIndex: 20,
        }}
      >
        ✕
      </button>

      <img
        ref={imageRef}
        src={src}
        alt=""
        onMouseDown={handleMouseDown}
        draggable={false}
        style={{
          maxWidth: "90vw",
          maxHeight: "85vh",
          objectFit: "contain",
          borderRadius: 16,
          boxShadow: "0 30px 60px rgba(0,0,0,0.5)",
          cursor: zoom > 1 ? "grab" : "default",
          userSelect: "none",
          transition: "transform 0.15s cubic-bezier(0.2, 0.9, 0.4, 1.1)",
        }}
      />

      {/* Панель управления */}
      <div className="image-modal-controls" style={{
        position: "absolute",
        bottom: 30,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 16,
        background: "rgba(20,20,30,0.8)",
        backdropFilter: "blur(20px)",
        padding: "12px 20px",
        borderRadius: 60,
        border: "1px solid rgba(255,255,255,0.2)",
        zIndex: 20,
      }}>
        <button onClick={() => setZoom(Math.max(MIN_ZOOM, +(zoom - ZOOM_STEP).toFixed(2)))} style={ctrlBtnStyle}>
          −
        </button>
        <span style={{ color: "#fff", fontWeight: 700, minWidth: 60, textAlign: "center" }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={() => setZoom(Math.min(MAX_ZOOM, +(zoom + ZOOM_STEP).toFixed(2)))} style={ctrlBtnStyle}>
          +
        </button>
        <button onClick={resetTransform} style={{ ...ctrlBtnStyle, fontSize: 18 }}>
          ⟲
        </button>
      </div>

      {/* Инструкция для мобильных */}
      <div className="image-modal-hint" style={{
        position: "absolute",
        bottom: 100,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        padding: "8px 16px",
        borderRadius: 30,
        color: "rgba(255,255,255,0.7)",
        fontSize: 12,
        fontWeight: 500,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        zIndex: 20,
      }}>
        🖱️ Колесо — зум • Перетаскивание
      </div>
    </div>
  );
}

const ctrlBtnStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: "50%",
  border: "1px solid rgba(255,255,255,0.3)",
  background: "rgba(255,255,255,0.1)",
  color: "#fff",
  fontSize: 26,
  fontWeight: 500,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "transform 0.15s, background 0.2s",
};