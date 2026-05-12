"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageMapQuestion, ImageMapPoint, ImageMapAnswer, MediaAttachment } from "../types";
import MediaUpload from "../MediaUpload";

type Props = {
  value: ImageMapQuestion;
  onChange: (next: ImageMapQuestion) => void;
  disabled?: boolean;
};

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function generateId(): string {
  return crypto.randomUUID();
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------
export default function ImageMapEditor({ value, onChange, disabled }: Props) {
  const points = Array.isArray(value.points) ? value.points : [];
  const answers = Array.isArray(value.answers) ? value.answers : [];

  // --- image preview refs ---
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgNaturalSize, setImgNaturalSize] = useState<{ w: number; h: number } | null>(null);

  const patch = useCallback(
    (partial: Partial<ImageMapQuestion>) => {
      onChange({ ...value, ...partial });
    },
    [value, onChange],
  );

  // ---------- Central Image ----------
  const handleImageChange = useCallback(
    (url: string) => {
      patch({ image: url || "" });
      setImgNaturalSize(null);
    },
    [patch],
  );

  // ---------- Points ----------
  const addPoint = useCallback(
    (xPercent: number, yPercent: number) => {
      const newPoint: ImageMapPoint = {
        id: generateId(),
        x: clamp(xPercent, 0, 100),
        y: clamp(yPercent, 0, 100),
        correctAnswerId: answers[0]?.id ?? "",
        label: `Точка ${points.length + 1}`,
      };
      patch({ points: [...points, newPoint] });
    },
    [patch, points, answers],
  );

  const updatePoint = useCallback(
    (pointId: string, updates: Partial<ImageMapPoint>) => {
      const nextPoints = points.map((p) => (p.id === pointId ? { ...p, ...updates } : p));
      patch({ points: nextPoints });
    },
    [patch, points],
  );

  const removePoint = useCallback(
    (pointId: string) => {
      patch({ points: points.filter((p) => p.id !== pointId) });
    },
    [patch, points],
  );

  // ---------- Answers ----------
  const addAnswer = useCallback(() => {
    const newAnswer: ImageMapAnswer = {
      id: generateId(),
      text: "",
      media: [],
    };
    patch({ answers: [...answers, newAnswer] });
  }, [patch, answers]);

  const updateAnswer = useCallback(
    (answerId: string, updates: Partial<ImageMapAnswer>) => {
      const nextAnswers = answers.map((a) => (a.id === answerId ? { ...a, ...updates } : a));
      patch({ answers: nextAnswers });
    },
    [patch, answers],
  );

  const removeAnswer = useCallback(
    (answerId: string) => {
      // remove answer and also unlink any point that references it
      const nextAnswers = answers.filter((a) => a.id !== answerId);
      const nextPoints = points.map((p) =>
        p.correctAnswerId === answerId ? { ...p, correctAnswerId: "" } : p,
      );
      patch({ answers: nextAnswers, points: nextPoints });
    },
    [patch, answers, points],
  );

  // ---------- Drag a point on the image ----------
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);

  const getPercentFromEvent = useCallback(
    (e: React.MouseEvent | React.PointerEvent): { x: number; y: number } | null => {
      const container = imgContainerRef.current;
      const img = imgRef.current;
      if (!container || !img) return null;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
      return {
        x: (x / rect.width) * 100,
        y: (y / rect.height) * 100,
      };
    },
    [],
  );

  const handleImageClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      if (draggingPointId) return; // don't add new when dragging
      const perc = getPercentFromEvent(e);
      if (!perc) return;
      addPoint(perc.x, perc.y);
    },
    [disabled, draggingPointId, getPercentFromEvent, addPoint],
  );

  const handlePointPointerDown = useCallback(
    (e: React.PointerEvent, pointId: string) => {
      if (disabled) return;
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDraggingPointId(pointId);
    },
    [disabled],
  );

  useEffect(() => {
    if (!draggingPointId) return;
    const onMove = (e: PointerEvent) => {
      const perc = getPercentFromEvent(e as any);
      if (perc) {
        updatePoint(draggingPointId, { x: clamp(perc.x, 0, 100), y: clamp(perc.y, 0, 100) });
      }
    };
    const onUp = () => setDraggingPointId(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingPointId, getPercentFromEvent, updatePoint]);

  // ---------- Handle image load to show native size information ----------
  const onImgLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    },
    [],
  );

  // ---- Validation warnings ----
  const usedAnswerIds = new Set(points.map((p) => p.correctAnswerId));
  const duplicateConnections = points.filter(
    (p) => points.filter((pp) => pp.correctAnswerId === p.correctAnswerId).length > 1,
  );

  return (
    <div className="form-group" style={{ marginTop: 16 }}>
      <label style={{ fontWeight: 800, display: "block", marginBottom: 8 }}>
        🗺️ Редактор карты изображения
      </label>

      {/* ---------- Image upload ---------- */}
      <div className="card" style={{ padding: 12, marginBottom: 14 }}>
        <label className="small-muted" style={{ fontWeight: 800, marginBottom: 6 }}>
          Центральное изображение:
        </label>
        <MediaUpload
          value={
            value.image
              ? [{ id: "central", url: value.image, type: "image", name: "central-image" }]
              : []
          }
          onChange={(media) => handleImageChange(media.length > 0 ? media[0].url : "")}
          disabled={disabled}
          bucket="question-images"
          label="Загрузить изображение (перетащить / выбрать):"
        />

        {value.image && (
          <div
            ref={imgContainerRef}
            style={{
              position: "relative",
              marginTop: 12,
              border: "2px dashed rgba(0,0,0,0.2)",
              borderRadius: 12,
              overflow: "hidden",
              cursor: disabled ? "not-allowed" : "crosshair",
              background: "#f8fafc",
            }}
            onClick={handleImageClick}
          >
            <img
              ref={imgRef}
              src={value.image}
              alt=""
              onLoad={onImgLoad}
              draggable={false}
              style={{ width: "100%", height: "auto", display: "block" }}
            />
            {/* render points */}
            {points.map((pt) => (
              <div
                key={pt.id}
                onPointerDown={(e) => handlePointPointerDown(e, pt.id)}
                title={`${pt.label || ""} (${Math.round(pt.x)}%, ${Math.round(pt.y)}%)`}
                style={{
                  position: "absolute",
                  left: `${pt.x}%`,
                  top: `${pt.y}%`,
                  transform: "translate(-50%, -50%)",
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background:
                    draggingPointId === pt.id
                      ? "#f59e0b"
                      : usedAnswerIds.has(pt.correctAnswerId)
                      ? "#10b981"
                      : "#ef4444",
                  border: "3px solid white",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                  cursor: disabled ? "not-allowed" : "grab",
                  zIndex: 10,
                }}
              />
            ))}
          </div>
        )}

        {imgNaturalSize && (
          <div className="small-muted" style={{ marginTop: 6 }}>
            Размер оригинала: {imgNaturalSize.w} × {imgNaturalSize.h} px — кликайте по картинке для добавления точек.
          </div>
        )}
      </div>

      {/* ---------- Points list ---------- */}
      <div className="card" style={{ padding: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label className="small-muted" style={{ fontWeight: 800 }}>
            Точки на картинке ({points.length})
          </label>
          <button
            type="button"
            className="btn small"
            onClick={() => addPoint(50, 50)}
            disabled={disabled}
          >
            ➕ Добавить точку (50%,50%)
          </button>
        </div>
        {points.length === 0 ? (
          <div className="small-muted" style={{ marginTop: 8 }}>
            Нет точек. Кликните по изображению, чтобы создать.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {points.map((pt) => (
              <div
                key={pt.id}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  padding: "8px 12px",
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.1)",
                  borderRadius: 10,
                }}
              >
                <span style={{ fontWeight: 800, minWidth: 60 }}>{pt.label || pt.id}</span>
                <label className="small-muted">X%</label>
                <input
                  type="number"
                  className="input"
                  style={{ width: 70 }}
                  value={pt.x}
                  min={0}
                  max={100}
                  step={0.1}
                  disabled={disabled}
                  onChange={(e) =>
                    updatePoint(pt.id, { x: clamp(Number(e.target.value), 0, 100) })
                  }
                />
                <label className="small-muted">Y%</label>
                <input
                  type="number"
                  className="input"
                  style={{ width: 70 }}
                  value={pt.y}
                  min={0}
                  max={100}
                  step={0.1}
                  disabled={disabled}
                  onChange={(e) =>
                    updatePoint(pt.id, { y: clamp(Number(e.target.value), 0, 100) })
                  }
                />
                <label className="small-muted">Ответ:</label>
                <select
                  className="input"
                  style={{ flex: 1 }}
                  value={pt.correctAnswerId}
                  disabled={disabled}
                  onChange={(e) => updatePoint(pt.id, { correctAnswerId: e.target.value })}
                >
                  <option value="">-- Выберите ответ --</option>
                  {answers.map((ans) => (
                    <option key={ans.id} value={ans.id}>
                      {ans.text || ans.id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() => removePoint(pt.id)}
                  disabled={disabled || points.length <= 1}
                  title="Удалить точку"
                >
                  🗑️
                </button>
              </div>
            ))}
            {duplicateConnections.length > 0 && (
              <div className="error" style={{ marginTop: 8 }}>
                ⚠️ Обнаружены точки с одинаковым правильным ответом. Рекомендуется уникальная связь 1:1.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---------- Answers list ---------- */}
      <div className="card" style={{ padding: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label className="small-muted" style={{ fontWeight: 800 }}>
            Варианты ответов ({answers.length})
          </label>
          <button
            type="button"
            className="btn small"
            onClick={addAnswer}
            disabled={disabled}
          >
            ➕ Добавить ответ
          </button>
        </div>
        {answers.length === 0 ? (
          <div className="small-muted" style={{ marginTop: 8 }}>
            Нет ответов. Добавьте хотя бы один.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {answers.map((ans) => (
              <div
                key={ans.id}
                style={{
                  padding: "12px 14px",
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 12,
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <label className="small-muted" style={{ minWidth: 60 }}>
                    Текст:
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Например: Apple"
                    value={ans.text || ""}
                    disabled={disabled}
                    onChange={(e) => updateAnswer(ans.id, { text: e.target.value })}
                  />
                  <button
                    type="button"
                    className="btn small ghost"
                    onClick={() => removeAnswer(ans.id)}
                    disabled={disabled || answers.length <= 1}
                  >
                    🗑️
                  </button>
                </div>
                <MediaUpload
                  value={ans.media || []}
                  onChange={(media) => updateAnswer(ans.id, { media })}
                  disabled={disabled}
                  bucket="question-images"
                  label="Медиа для ответа (картинка/аудио/PDF):"
                />
                <div className="small-muted" style={{ marginTop: 6 }}>
                  ID: {ans.id} {usedAnswerIds.has(ans.id) ? "✅ (используется)" : "⚠️ (не используется)"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* quick validation */}
      {!value.image && (
        <div className="error" style={{ marginTop: 8 }}>
          ❗ Изображение обязательно для этого типа вопроса.
        </div>
      )}
    </div>
  );
}