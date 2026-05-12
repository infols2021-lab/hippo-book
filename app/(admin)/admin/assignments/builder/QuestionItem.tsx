"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import ImageUpload from "./ImageUpload";
import MediaUpload from "./MediaUpload";
import QuestionTypeSwitch from "./QuestionTypeSwitch";
import { deepClone, type Question, type QuestionType } from "./types";

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
  if (t === "test") return "📝 Тест";
  if (t === "fill") return "✍️ Вписать ответ";
  if (t === "sentence") return "📝 Заполнить предложение";
  if (t === "crossword") return "🧩 Кроссворд";
  if (t === "complex") return "📚 Комплексный вопрос";
  if (t === "matching") return "🔗 Сопоставление";
  if (t === "imagemap") return "🗺 Карта";
  if (t === "reading") return "📖 Чтение + тест";
  return t;
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
  const q = value as any;

  function patch(patchObj: Record<string, any>) {
    const next = deepClone(value) as any;
    Object.assign(next, patchObj);
    onChange(next);
  }

  const canUp = !disabled && index > 0;
  const canDown = !disabled && index < total - 1;

  const typeClass =
    q.type === "test"
      ? "qtype-test"
      : q.type === "fill"
      ? "qtype-fill"
      : q.type === "sentence"
      ? "qtype-sentence"
      : q.type === "complex"
      ? "qtype-complex"
      : q.type === "matching"
      ? "qtype-matching"
      : q.type === "imagemap"
      ? "qtype-imagemap"
      : q.type === "reading"
      ? "qtype-reading"
      : "qtype-crossword";

  // ====== Zoomable image state (for crossword) ======
  const imgUrl: string = typeof q.image === "string" ? q.image : "";

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [tx, setTx] = useState<number>(0);
  const [ty, setTy] = useState<number>(0);

  const [dragging, setDragging] = useState(false);
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

  // сброс при смене картинки/типа
  useEffect(() => {
    setScale(1);
    setTx(0);
    setTy(0);
    setDragging(false);
    dragStart.current = null;
    pinchStart.current = null;
  }, [imgUrl, q.type]);

  function resetZoom() {
    setScale(1);
    setTx(0);
    setTy(0);
  }

  function clientToLocal(eClientX: number, eClientY: number) {
    const el = wrapRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: eClientX - r.left, y: eClientY - r.top };
  }

  // Zoom around point:
  // keep point under cursor stable by adjusting translation
  function applyZoom(nextScale: number, originLocal: { x: number; y: number }) {
    nextScale = clamp(nextScale, minScale, maxScale);

    const s0 = scale;
    const s1 = nextScale;

    if (s0 === s1) return;

    // Transform model: translate(tx,ty) then scale(scale)
    // We adjust tx/ty so that originLocal stays fixed in screen coordinates.
    // New translation:
    // origin = (originLocal - t) / s  -> keep same => t1 = originLocal - (originLocal - t0) * (s1/s0)
    const t1x = originLocal.x - (originLocal.x - tx) * (s1 / s0);
    const t1y = originLocal.y - (originLocal.y - ty) * (s1 / s0);

    setScale(s1);
    setTx(t1x);
    setTy(t1y);
  }

  function onWheel(e: React.WheelEvent) {
    if (disabled) return;
    if (!imgUrl) return;

    // чтобы колесо не скроллило страницу во время зума
    e.preventDefault();

    const delta = -e.deltaY; // вверх => zoom in
    const factor = delta > 0 ? 1.12 : 0.89;

    const origin = clientToLocal(e.clientX, e.clientY);
    applyZoom(scale * factor, origin);
  }

  function onMouseDown(e: React.MouseEvent) {
    if (disabled) return;
    if (!imgUrl) return;

    // drag only if zoomed
    if (scale <= 1) return;

    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, tx, ty };
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging || !dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setTx(dragStart.current.tx + dx);
    setTy(dragStart.current.ty + dy);
  }

  function endDrag() {
    setDragging(false);
    dragStart.current = null;
  }

  function onTouchStart(e: React.TouchEvent) {
    if (disabled) return;
    if (!imgUrl) return;

    if (e.touches.length === 2) {
      // pinch start
      e.preventDefault();
      const a = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const b = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      const d0 = dist(a, b);
      const mid = midpoint(a, b);
      const midLocal = clientToLocal(mid.x, mid.y);

      pinchStart.current = { d: d0, scale, mid: midLocal, tx, ty };
      return;
    }

    if (e.touches.length === 1 && scale > 1) {
      // drag with one finger when zoomed
      e.preventDefault();
      const t = e.touches[0];
      setDragging(true);
      dragStart.current = { x: t.clientX, y: t.clientY, tx, ty };
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    if (disabled) return;
    if (!imgUrl) return;

    if (e.touches.length === 2 && pinchStart.current) {
      e.preventDefault();
      const a = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      const b = { x: e.touches[1].clientX, y: e.touches[1].clientY };
      const d1 = dist(a, b);

      const ratio = d1 / pinchStart.current.d;
      const nextScale = pinchStart.current.scale * ratio;

      // zoom around stored midpoint
      // use stored tx/ty baseline instead of current to reduce jitter
      const s0 = pinchStart.current.scale;
      const s1 = clamp(nextScale, minScale, maxScale);

      const origin = pinchStart.current.mid;
      const baseTx = pinchStart.current.tx;
      const baseTy = pinchStart.current.ty;

      const t1x = origin.x - (origin.x - baseTx) * (s1 / s0);
      const t1y = origin.y - (origin.y - baseTy) * (s1 / s0);

      setScale(s1);
      setTx(t1x);
      setTy(t1y);
      return;
    }

    if (e.touches.length === 1 && dragging && dragStart.current) {
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - dragStart.current.x;
      const dy = t.clientY - dragStart.current.y;
      setTx(dragStart.current.tx + dx);
      setTy(dragStart.current.ty + dy);
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchStart.current = null;
    if (e.touches.length === 0) endDrag();
  }

  const imgTransform = useMemo(() => {
    // translate first then scale around top-left (so formula matches applyZoom)
    return `translate(${tx}px, ${ty}px) scale(${scale})`;
  }, [tx, ty, scale]);

  return (
    <div className={`subtask-item ${typeClass}`} style={{ position: "relative" }}>
      {/* номер вопроса */}
      <div className="question-number">{index + 1}</div>

      {/* header */}
      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontWeight: 800 }}>{typeLabel(q.type)}</div>

          <QuestionTypeSwitch value={q.type as QuestionType} onChange={(t) => onTypeChange(t)} disabled={disabled} />
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-small" type="button" onClick={onMoveUp} disabled={!canUp}>
            ↑
          </button>
          <button className="btn btn-small" type="button" onClick={onMoveDown} disabled={!canDown}>
            ↓
          </button>
          <button
            className="btn btn-small btn-danger"
            type="button"
            onClick={() => {
              if (disabled) return;
              if (confirm("Удалить вопрос?")) onRemove();
            }}
            disabled={disabled}
          >
            🗑️ Удалить
          </button>
        </div>
      </div>

      <div style={{ height: 12 }} />

      {/* ===== ТЕКСТ ВОПРОСА (ПОКАЗЫВАЕМ ДЛЯ ВСЕХ, КРОМЕ КРОССВОРДА, IMAGEMAP, READING) ===== */}
      {q.type !== "crossword" && q.type !== "imagemap" && q.type !== "reading" ? (
        <div className="form-group">
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Текст вопроса:</label>
          <textarea
            className="question-textarea"
            value={q.q ?? ""}
            placeholder="Введите текст вопроса. Enter — новая строка"
            onChange={(e) => patch({ q: e.target.value })}
            disabled={disabled}
          />
          <div className="format-hint">💡 Используйте Enter для переноса строк</div>
        </div>
      ) : null}

      {/* ===== ОБЩИЙ ЗАГРУЗЧИК МЕДИА (ПОКАЗЫВАЕМ ДЛЯ ВСЕХ, КРОМЕ КРОССВОРДА) ===== */}
      {q.type !== "crossword" ? (
        <>
          {/* Оставлено для обратной совместимости старых данных (единичная картинка) – скрыто для imagemap и reading */}
          {q.type !== "imagemap" && q.type !== "reading" && q.image && typeof q.image === "string" && !q.media?.length && (
             <div className="form-group" style={{ marginBottom: "16px" }}>
               <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Устаревшее изображение:</label>
               <img src={q.image} alt="old media" style={{ maxWidth: 200, borderRadius: 8 }} />
               <button className="btn btn-small btn-danger" style={{ marginTop: 8 }} onClick={() => patch({ image: "" })}>Удалить</button>
             </div>
          )}

          <MediaUpload
            value={q.media || []}
            onChange={(nextMedia) => patch({ media: nextMedia })}
            disabled={disabled}
            bucket="question-images"
            audioBucket="hippo-book-audio"
            label="Прикрепленные медиафайлы (Изображения, Аудио, PDF):"
          />
        </>
      ) : null}

      {/* ===== ИЗОБРАЖЕНИЕ КРОССВОРДА (УВЕЛИЧЕНИЕ/ПИНЧ) ===== */}
      {q.type === "crossword" ? (
        <div className="form-group">
          <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Изображение кроссворда (опционально):</label>

          <ImageUpload
            value={imgUrl}
            onChange={(nextUrl) => patch({ image: nextUrl || "" })}
            disabled={disabled}
            bucket="question-images"
            label="Загрузить изображение (можно перетаскиванием):"
          />

          {imgUrl ? (
            <div style={{ marginTop: 10 }}>
              <div
                className="card"
                style={{
                  padding: 10,
                  borderRadius: 16,
                }}
              >
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
                    width: "100%",
                    height: 320,
                    overflow: "hidden",
                    borderRadius: 14,
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "rgba(0,0,0,0.03)",
                    position: "relative",
                    touchAction: "none", // важно для pinch/drag
                    cursor: disabled ? "not-allowed" : scale > 1 ? (dragging ? "grabbing" : "grab") : "default",
                  }}
                >
                  <img
                    src={imgUrl}
                    alt="Кроссворд"
                    draggable={false}
                    style={{
                      transform: imgTransform,
                      transformOrigin: "0 0",
                      willChange: "transform",
                      userSelect: "none",
                      pointerEvents: "none",
                      maxWidth: "none",
                      maxHeight: "none",
                      width: "auto",
                      height: "auto",
                      display: "block",
                    }}
                  />

                  {/* мини-панель */}
                  <div
                    style={{
                      position: "absolute",
                      right: 10,
                      top: 10,
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      padding: "6px 8px",
                      borderRadius: 12,
                      background: "rgba(255,255,255,0.85)",
                      border: "1px solid rgba(0,0,0,0.12)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <button
                      type="button"
                      className="btn small ghost"
                      disabled={disabled}
                      onClick={() => applyZoom(scale * 1.15, { x: 160, y: 160 })}
                    >
                      ＋
                    </button>
                    <button
                      type="button"
                      className="btn small ghost"
                      disabled={disabled}
                      onClick={() => applyZoom(scale * 0.87, { x: 160, y: 160 })}
                    >
                      －
                    </button>
                    <button type="button" className="btn small secondary" disabled={disabled} onClick={resetZoom}>
                      Reset
                    </button>
                  </div>
                </div>

                <div className="small-muted" style={{ marginTop: 8 }}>
                  Масштаб: <b>{Math.round(scale * 100)}%</b>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ===== TYPE-SPECIFIC ===== */}
      <div className="question-type-content">
        {q.type === "test" ? (
          <TestEditor value={q} disabled={disabled} onChange={(next) => onChange(next)} />
        ) : q.type === "fill" ? (
          <FillEditor value={q} disabled={disabled} onChange={(next) => onChange(next)} />
        ) : q.type === "sentence" ? (
          <SentenceEditor value={q} disabled={disabled} onChange={(next) => onChange(next)} />
        ) : q.type === "crossword" ? (
          <CrosswordEditor value={q} disabled={disabled} onChange={(next) => onChange(next)} />
        ) : q.type === "complex" ? (
          // @ts-ignore
          <ComplexEditor value={q} disabled={disabled} onChange={(next) => onChange(next)} />
        ) : q.type === "matching" ? (
          // @ts-ignore
          <MatchingEditor value={q} disabled={disabled} onChange={(next) => onChange(next)} />
        ) : q.type === "imagemap" ? (
          // @ts-ignore
          <ImageMapEditor value={q} disabled={disabled} onChange={(next) => onChange(next)} />
        ) : q.type === "reading" ? (
          // @ts-ignore
          <ReadingEditor value={q} disabled={disabled} onChange={(next) => onChange(next)} />
        ) : null}
      </div>
    </div>
  );
}