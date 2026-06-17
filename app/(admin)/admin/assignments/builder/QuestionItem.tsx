"use client";

import { useEffect, useRef, useState } from "react";

import ImageUpload from "./ImageUpload";
import MediaUpload from "./MediaUpload";
import QuestionTypeSwitch from "./QuestionTypeSwitch";
import type { Question, QuestionType } from "./types";

import TestEditor from "./test/TestEditor";
import FillEditor from "./fill/FillEditor";
import SentenceEditor from "./sentence/SentenceEditor";
import CrosswordEditor from "./crossword/CrosswordEditor";
import ComplexEditor from "./complex/ComplexEditor";
import MatchingEditor from "./matching/MatchingEditor";
import ImageMapEditor from "./imagemap/ImageMapEditor";
import ReadingEditor from "./reading/ReadingEditor";

type Props = {
  index: number;
  total: number;
  value: Question;
  disabled?: boolean;

  onChange: (next: Question) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTypeChange: (t: QuestionType) => void;
};

function typeLabel(t: QuestionType) {
  switch (t) {
    case "test": return "📝 Тест";
    case "fill": return "✍️ Вписать ответ";
    case "sentence": return "📝 Заполнить предложение";
    case "crossword": return "🧩 Кроссворд";
    case "complex": return "📚 Комплексный вопрос";
    case "matching": return "🔗 Сопоставление";
    case "imagemap": return "🗺 Карта";
    case "reading": return "📖 Чтение + тест";
    default: return t;
  }
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export default function QuestionItem({
  index,
  total,
  value,
  disabled,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onTypeChange,
}: Props) {
  
  // Локальный стейт для текста, чтобы не вызывать глобальный ре-рендер на каждый символ
  const [localText, setLocalText] = useState(value.q ?? "");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setLocalText(value.q ?? "");
  }, [value.q]);

  const canUp = !disabled && index > 0;
  const canDown = !disabled && index < total - 1;

  // ====== ОПТИМИЗИРОВАННЫЙ ЗУМ (ЧЕРЕЗ DOM REFS, БЕЗ РЕ-РЕНДЕРОВ) ======
  const imgUrl: string = typeof value.image === "string" ? value.image : "";
  
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const zoomTextRef = useRef<HTMLElement | null>(null);

  const tRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const dragging = useRef(false);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  
  const pinchStart = useRef<{
    d: number;
    scale: number;
    mid: { x: number; y: number };
    tx: number;
    ty: number;
  } | null>(null);

  const minScale = 1;
  const maxScale = 6;

  function applyTransform() {
    if (imgRef.current) {
      const { tx, ty, scale } = tRef.current;
      imgRef.current.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      
      // Меняем курсор в зависимости от состояния
      if (wrapRef.current) {
         wrapRef.current.style.cursor = scale > 1 ? (dragging.current ? "grabbing" : "grab") : "default";
      }
    }
    if (zoomTextRef.current) {
      zoomTextRef.current.innerText = `${Math.round(tRef.current.scale * 100)}%`;
    }
  }

  function resetZoom() {
    tRef.current = { scale: 1, tx: 0, ty: 0 };
    applyTransform();
  }

  // Сброс при смене картинки
  useEffect(() => {
    resetZoom();
    dragging.current = false;
    dragStart.current = null;
    pinchStart.current = null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgUrl, value.type]);

  function clientToLocal(eClientX: number, eClientY: number) {
    const el = wrapRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: eClientX - r.left, y: eClientY - r.top };
  }

  function applyZoom(nextScale: number, originLocal: { x: number; y: number }) {
    nextScale = clamp(nextScale, minScale, maxScale);
    const { scale: s0, tx, ty } = tRef.current;
    const s1 = nextScale;

    if (s0 === s1) return;

    const t1x = originLocal.x - (originLocal.x - tx) * (s1 / s0);
    const t1y = originLocal.y - (originLocal.y - ty) * (s1 / s0);

    tRef.current = { scale: s1, tx: t1x, ty: t1y };
    applyTransform();
  }

  function onWheel(e: React.WheelEvent) {
    if (disabled || !imgUrl) return;
    e.preventDefault();

    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.12 : 0.89;
    const origin = clientToLocal(e.clientX, e.clientY);
    
    applyZoom(tRef.current.scale * factor, origin);
  }

  function onMouseDown(e: React.MouseEvent) {
    if (disabled || !imgUrl || tRef.current.scale <= 1) return;
    
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, tx: tRef.current.tx, ty: tRef.current.ty };
    applyTransform(); // Для смены курсора на grabbing
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    tRef.current.tx = dragStart.current.tx + dx;
    tRef.current.ty = dragStart.current.ty + dy;
    applyTransform();
  }

  function endDrag() {
    dragging.current = false;
    dragStart.current = null;
    applyTransform();
  }

  // Touch события также оптимизированы на useRef
  function onTouchStart(e: React.TouchEvent) {
    if (disabled || !imgUrl) return;

    if (e.touches.length === 2) {
      e.preventDefault();
      const a = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const b = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      const midLocal = clientToLocal(midpoint(a, b).x, midpoint(a, b).y);

      pinchStart.current = { d: dist(a, b), scale: tRef.current.scale, mid: midLocal, tx: tRef.current.tx, ty: tRef.current.ty };
      return;
    }

    if (e.touches.length === 1 && tRef.current.scale > 1) {
      e.preventDefault();
      dragging.current = true;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: tRef.current.tx, ty: tRef.current.ty };
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (disabled || !imgUrl) return;

    if (e.touches.length === 2 && pinchStart.current) {
      e.preventDefault();
      const a = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const b = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      
      const ratio = dist(a, b) / pinchStart.current.d;
      const nextScale = pinchStart.current.scale * ratio;
      const s1 = clamp(nextScale, minScale, maxScale);
      const s0 = pinchStart.current.scale;

      const { mid: origin, tx: baseTx, ty: baseTy } = pinchStart.current;

      tRef.current.scale = s1;
      tRef.current.tx = origin.x - (origin.x - baseTx) * (s1 / s0);
      tRef.current.ty = origin.y - (origin.y - baseTy) * (s1 / s0);
      applyTransform();
      return;
    }

    if (e.touches.length === 1 && dragging.current && dragStart.current) {
      e.preventDefault();
      tRef.current.tx = dragStart.current.tx + (e.touches[0].clientX - dragStart.current.x);
      tRef.current.ty = dragStart.current.ty + (e.touches[0].clientY - dragStart.current.y);
      applyTransform();
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchStart.current = null;
    if (e.touches.length === 0) endDrag();
  }

  // ====== РЕНДЕР ======

  // Type Guards: Строгая типизация редакторов без ts-ignore
  const renderSpecificEditor = () => {
    switch (value.type) {
      case "test": return <TestEditor value={value} disabled={disabled} onChange={onChange} />;
      case "fill": return <FillEditor value={value} disabled={disabled} onChange={onChange} />;
      case "sentence": return <SentenceEditor value={value} disabled={disabled} onChange={onChange} />;
      case "crossword": return <CrosswordEditor value={value} disabled={disabled} onChange={onChange} />;
      case "complex": return <ComplexEditor value={value} disabled={disabled} onChange={onChange} />;
      case "matching": return <MatchingEditor value={value} disabled={disabled} onChange={onChange} />;
      case "imagemap": return <ImageMapEditor value={value} disabled={disabled} onChange={onChange} />;
      case "reading": return <ReadingEditor value={value} disabled={disabled} onChange={onChange} />;
      default: return null;
    }
  };

  return (
    <div className={`subtask-item qtype-${value.type}`} style={{ position: "relative" }}>
      <div className="question-number">{index + 1}</div>

      {/* Header */}
      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800 }}>{typeLabel(value.type)}</div>
          <QuestionTypeSwitch value={value.type} onChange={(t) => onTypeChange(t)} disabled={disabled} />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-small" type="button" onClick={onMoveUp} disabled={!canUp}>↑</button>
          <button className="btn btn-small" type="button" onClick={onMoveDown} disabled={!canDown}>↓</button>
          
          {isDeleting ? (
            <div style={{ display: "flex", gap: 4, alignItems: "center", background: "var(--danger-light, #fee)", padding: "2px 8px", borderRadius: 6 }}>
              <span style={{ fontSize: 13, color: "red", fontWeight: "bold" }}>Точно?</span>
              <button className="btn btn-small btn-danger" type="button" onClick={onRemove}>Да</button>
              <button className="btn btn-small" type="button" onClick={() => setIsDeleting(false)}>Нет</button>
            </div>
          ) : (
            <button className="btn btn-small btn-danger" type="button" onClick={() => setIsDeleting(true)} disabled={disabled}>
              🗑️ Удалить
            </button>
          )}
        </div>
      </div>

      <div style={{ height: 12 }} />

      {/* Текст вопроса (кроме кроссворда) */}
      {value.type !== "crossword" && (
        <div className="form-group">
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Текст вопроса:</label>
          <textarea
            className="question-textarea"
            value={localText}
            placeholder="Введите текст вопроса. Enter — новая строка"
            onChange={(e) => setLocalText(e.target.value)}
            onBlur={() => {
               // Отправляем наверх только при потере фокуса (мощнейшая оптимизация)
               if (localText !== value.q) {
                 onChange({ ...value, q: localText } as Question);
               }
            }}
            disabled={disabled}
          />
          <div className="format-hint">💡 Используйте Enter для переноса строк</div>
        </div>
      )}

      {/* Общий загрузчик медиа (кроме кроссворда) */}
      {value.type !== "crossword" && (
        <>
          {value.type !== "imagemap" && value.image && typeof value.image === "string" && (!value.media || value.media.length === 0) && (
            <div className="form-group" style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Устаревшее изображение:</label>
              <img src={value.image} alt="old media" style={{ maxWidth: 200, borderRadius: 8 }} />
              <button 
                className="btn btn-small btn-danger" 
                style={{ marginTop: 8 }} 
                onClick={() => onChange({ ...value, image: "" } as Question)}
              >
                Удалить
              </button>
            </div>
          )}

          <MediaUpload
            value={value.media || []}
            onChange={(nextMedia) => onChange({ ...value, media: nextMedia } as Question)}
            disabled={disabled}
            bucket="question-images"
            audioBucket="hippo-book-audio"
            label="Прикрепленные медиафайлы (Изображения, Аудио, PDF):"
          />
        </>
      )}

      {/* Изображение кроссворда с оптимизированным зумом */}
      {value.type === "crossword" && (
        <div className="form-group">
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Изображение кроссворда (опционально):</label>
          <ImageUpload
            value={imgUrl}
            onChange={(nextUrl) => onChange({ ...value, image: nextUrl || "" } as Question)}
            disabled={disabled}
            bucket="question-images"
            label="Загрузить изображение (можно перетаскиванием):"
          />

          {imgUrl && (
            <div style={{ marginTop: 10 }}>
              <div className="card" style={{ padding: 10, borderRadius: 16 }}>
                <div className="small-muted" style={{ marginBottom: 8 }}>
                  Zoom: колесико/тачпад • телефон: pinch • двойной клик/тап — сброс • drag при увеличении
                </div>

                <div
                  ref={wrapRef}
                  onWheel={onWheel}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseLeave={endDrag}
                  onMouseUp={endDrag}
                  onDoubleClick={() => resetZoom()}
                  onTouchStart={onTouchStart}
                  onTouchMove={onTouchMove}
                  onTouchEnd={onTouchEnd}
                  style={{
                    width: "100%", height: 320, overflow: "hidden", borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.12)", background: "rgba(0,0,0,0.03)",
                    position: "relative", touchAction: "none", cursor: disabled ? "not-allowed" : "default"
                  }}
                >
                  <img
                    ref={imgRef}
                    src={imgUrl}
                    alt="Кроссворд"
                    draggable={false}
                    style={{
                      transformOrigin: "0 0", willChange: "transform", userSelect: "none",
                      pointerEvents: "none", maxWidth: "none", maxHeight: "none",
                      width: "auto", height: "auto", display: "block",
                    }}
                  />
                  
                  {/* Мини-панель управления */}
                  <div style={{
                    position: "absolute", right: 10, top: 10, display: "flex", gap: 6,
                    alignItems: "center", padding: "6px 8px", borderRadius: 12,
                    background: "rgba(255,255,255,0.85)", border: "1px solid rgba(0,0,0,0.12)", backdropFilter: "blur(8px)"
                  }}>
                    <button type="button" className="btn small ghost" disabled={disabled} onClick={() => applyZoom(tRef.current.scale * 1.15, { x: 160, y: 160 })}>＋</button>
                    <button type="button" className="btn small ghost" disabled={disabled} onClick={() => applyZoom(tRef.current.scale * 0.87, { x: 160, y: 160 })}>－</button>
                    <button type="button" className="btn small secondary" disabled={disabled} onClick={resetZoom}>Reset</button>
                  </div>
                </div>

                <div className="small-muted" style={{ marginTop: 8 }}>
                  Масштаб: <b ref={zoomTextRef}>100%</b>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Рендер конкретного редактора (Type-Safe) */}
      <div className="question-type-content">
        {renderSpecificEditor()}
      </div>
    </div>
  );
}