"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import ImageUpload from "./ImageUpload";
import MediaUpload from "./MediaUpload";
import QuestionTypeSwitch from "./QuestionTypeSwitch";
import type { Question, QuestionType } from "./types";
import QuestionTextPreview from "./QuestionTextPreview";

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
  expanded?: boolean;
  onToggleExpand?: () => void;

  onChange: (next: Question) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTypeChange: (t: QuestionType) => void;
};

function typeLabel(t: QuestionType) {
  switch (t) {
    case "test": return "Тест";
    case "fill": return "Вписать ответ";
    case "sentence": return "Предложение";
    case "crossword": return "Кроссворд";
    case "complex": return "Комплексный";
    case "matching": return "Сопоставление";
    case "imagemap": return "Карта";
    case "reading": return "Чтение";
    default: return t;
  }
}

function previewText(value: Question) {
  const raw = String(value.q ?? "").trim();
  if (!raw) return "Без текста";
  const singleLine = raw.replace(/\s+/g, " ");
  return singleLine.length > 120 ? `${singleLine.slice(0, 120)}…` : singleLine;
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
  expanded = true,
  onToggleExpand,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onTypeChange,
}: Props) {
  const [localText, setLocalText] = useState(value.q ?? "");
  const [localExplanation, setLocalExplanation] = useState(value.explanation ?? "");
  const [isDeleting, setIsDeleting] = useState(false);
  const questionTextRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setLocalText(value.q ?? "");
    setLocalExplanation(value.explanation ?? "");
  }, [value.q, value.explanation]);

  const canUp = !disabled && index > 0;
  const canDown = !disabled && index < total - 1;

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

  useEffect(() => {
    resetZoom();
    dragging.current = false;
    dragStart.current = null;
    pinchStart.current = null;
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
    applyTransform();
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

  function commitQuestionText() {
    if (localText !== value.q) {
      onChange({ ...value, q: localText } as Question);
    }
  }

  function commitExplanation() {
    const next = localExplanation.trim();
    if (next !== (value.explanation ?? "")) {
      onChange({ ...value, explanation: next || undefined } as Question);
    }
  }

  const collapsedSummary = useMemo(() => previewText({ ...value, q: localText }), [value, localText]);

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
    <div className={`subtask-item qtype-${value.type} ${expanded ? "is-expanded" : "is-collapsed"}`}>
      <div className="question-card-header">
        <button
          type="button"
          className="question-collapse-toggle"
          onClick={() => onToggleExpand?.()}
          disabled={disabled || !onToggleExpand}
        >
          <div className="question-header-left">
            <div className="question-number-badge">{index + 1}</div>
            <div className="question-type-badge">{typeLabel(value.type)}</div>
            {!expanded ? (
              <div className="question-collapsed-text">{collapsedSummary}</div>
            ) : null}
          </div>
          <span className="question-collapse-indicator">{expanded ? "Свернуть" : "Открыть"}</span>
        </button>

        <div className="question-header-actions">
          {expanded ? (
            <QuestionTypeSwitch value={value.type} onChange={(t) => onTypeChange(t)} disabled={disabled} />
          ) : null}
          <button className="btn btn-small ghost" type="button" onClick={onMoveUp} disabled={!canUp} title="Поднять выше">
            ↑
          </button>
          <button className="btn btn-small ghost" type="button" onClick={onMoveDown} disabled={!canDown} title="Опустить ниже">
            ↓
          </button>

          {isDeleting ? (
            <div className="confirm-delete-box">
              <span>Удалить?</span>
              <button className="btn btn-small btn-danger" type="button" onClick={onRemove}>Да</button>
              <button className="btn btn-small ghost" type="button" onClick={() => setIsDeleting(false)}>Отмена</button>
            </div>
          ) : (
            <button className="btn btn-small btn-danger ghost" type="button" onClick={() => setIsDeleting(true)} disabled={disabled}>
              Удалить
            </button>
          )}
        </div>
      </div>

      {expanded ? (
        <div className="question-card-body">
          {value.type !== "crossword" && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 700, color: "#1e293b", fontSize: 13 }}>
                Текст вопроса
              </label>
              <textarea
                ref={questionTextRef}
                className="question-textarea"
                value={localText}
                placeholder="Введите текст вопроса. Enter — новая строка. **жирный текст** — между двойными звёздочками."
                onChange={(e) => setLocalText(e.target.value)}
                onBlur={() => {
                  commitQuestionText();
                }}
                disabled={disabled}
              />
              <div className="format-toolbar">
                <button
                  type="button"
                  className="btn btn-small ghost"
                  disabled={disabled}
                  onClick={() => {
                    const textarea = questionTextRef.current;
                    const start = textarea?.selectionStart ?? localText.length;
                    const end = textarea?.selectionEnd ?? localText.length;
                    const selected = localText.slice(start, end);
                    const wrapped = selected ? `**${selected}**` : "****";
                    const next = localText.slice(0, start) + wrapped + localText.slice(end);
                    setLocalText(next);
                    requestAnimationFrame(() => {
                      if (!textarea) return;
                      textarea.focus();
                      const caret = selected ? start + wrapped.length : start + 2;
                      textarea.setSelectionRange(caret, caret);
                    });
                  }}
                >
                  B Жирный
                </button>
              </div>
              {localText.trim() && <QuestionTextPreview text={localText} />}
            </div>
          )}

          {value.type !== "crossword" && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 700, color: "#1e293b", fontSize: 13 }}>
                Объяснение для разбора (необязательно)
              </label>
              <textarea
                className="question-textarea"
                value={localExplanation}
                placeholder="Пояснение, которое увидит ученик в review после ответа."
                onChange={(e) => setLocalExplanation(e.target.value)}
                onBlur={commitExplanation}
                disabled={disabled}
                rows={3}
              />
            </div>
          )}

          {value.type !== "crossword" && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              {value.type !== "imagemap" && value.image && typeof value.image === "string" && (!value.media || value.media.length === 0) && (
                <div style={{ marginBottom: 12, padding: 10, background: "#fff5f5", borderRadius: 10, border: "1px solid #fed7d7" }}>
                  <label style={{ display: "block", marginBottom: 6, fontWeight: 700, fontSize: 12, color: "#c53030" }}>
                    Устаревшее изображение
                  </label>
                  <img src={value.image} alt="old media" style={{ maxWidth: 200, borderRadius: 8, display: "block" }} />
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
                label="Прикрепленные медиафайлы"
              />
            </div>
          )}

          {value.type === "crossword" && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 700, color: "#1e293b", fontSize: 13 }}>
                Изображение кроссворда
              </label>
              <ImageUpload
                value={imgUrl}
                onChange={(nextUrl) => onChange({ ...value, image: nextUrl || "" } as Question)}
                disabled={disabled}
                bucket="question-images"
                label="Загрузить изображение"
              />

              {imgUrl && (
                <div style={{ marginTop: 10 }}>
                  <div className="card" style={{ padding: 12, borderRadius: 16, background: "#f8fafc" }}>
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
                        border: "1px solid #cbd5e1", background: "#f1f5f9",
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
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="question-type-content">
            {renderSpecificEditor()}
          </div>
        </div>
      ) : null}
    </div>
  );
}
