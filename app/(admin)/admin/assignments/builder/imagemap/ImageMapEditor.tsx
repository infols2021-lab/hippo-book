"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ImageMapQuestion, ImageMapPoint, ImageMapAnswer } from "../types";
import ImageUpload from "../ImageUpload";
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

const DRAG_THRESHOLD_PX = 3; // Минимальное движение для старта перетаскивания

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------
export default function ImageMapEditor({ value, onChange, disabled }: Props) {
  // Для избежания устаревших замыканий (stale closures) во всех коллбеках
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const answers = Array.isArray(value.answers) ? value.answers : [];

  // --- ЛОКАЛЬНЫЙ СТЕЙТ ДЛЯ ПЛАВНОГО ДРАГА ---
  // Чтобы не ререндерить всё древо React при каждом пикселе движения
  const [localPoints, setLocalPoints] = useState<ImageMapPoint[]>(
    Array.isArray(value.points) ? value.points : []
  );
  const localPointsRef = useRef(localPoints);
  useEffect(() => {
    localPointsRef.current = localPoints;
  }, [localPoints]);

  const isDragging = useRef(false);

  // Синхронизация с родительским стейтом, только если мы не тащим точку прямо сейчас
  useEffect(() => {
    if (!isDragging.current) {
      setLocalPoints(Array.isArray(value.points) ? value.points : []);
    }
  }, [value.points]);

  // --- Refs ---
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgNaturalSize, setImgNaturalSize] = useState<{ w: number; h: number } | null>(null);

  // ---------- Методы обновления ----------
  const handleImageChange = useCallback((url: string) => {
    onChange({ ...valueRef.current, image: url || "" });
    setImgNaturalSize(null);
  }, [onChange]);

  const addPoint = useCallback((xPercent: number, yPercent: number) => {
    const current = valueRef.current;
    const newPoint: ImageMapPoint = {
      id: generateId(),
      x: clamp(xPercent, 0, 100),
      y: clamp(yPercent, 0, 100),
      correctAnswerId: current.answers?.[0]?.id ?? "",
      label: `Точка ${current.points.length + 1}`,
    };
    onChange({ ...current, points: [...current.points, newPoint] });
  }, [onChange]);

  const updatePoint = useCallback((pointId: string, updates: Partial<ImageMapPoint>) => {
    const current = valueRef.current;
    const nextPoints = current.points.map((p) => (p.id === pointId ? { ...p, ...updates } : p));
    onChange({ ...current, points: nextPoints });
  }, [onChange]);

  const removePoint = useCallback((pointId: string) => {
    const current = valueRef.current;
    onChange({ ...current, points: current.points.filter((p) => p.id !== pointId) });
  }, [onChange]);

  const addAnswer = useCallback(() => {
    const current = valueRef.current;
    const newAnswer: ImageMapAnswer = { id: generateId(), text: "", media: [] };
    onChange({ ...current, answers: [...current.answers, newAnswer] });
  }, [onChange]);

  const updateAnswer = useCallback((answerId: string, updates: Partial<ImageMapAnswer>) => {
    const current = valueRef.current;
    const nextAnswers = current.answers.map((a) => (a.id === answerId ? { ...a, ...updates } : a));
    onChange({ ...current, answers: nextAnswers });
  }, [onChange]);

  const removeAnswer = useCallback((answerId: string) => {
    const current = valueRef.current;
    const nextAnswers = current.answers.filter((a) => a.id !== answerId);
    // Отвязываем удаленный ответ от точек
    const nextPoints = current.points.map((p) =>
      p.correctAnswerId === answerId ? { ...p, correctAnswerId: "" } : p
    );
    onChange({ ...current, answers: nextAnswers, points: nextPoints });
  }, [onChange]);

  // ---------- Логика Drag & Drop ----------
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);
  const dragMovedRef = useRef(false);
  const dragStartClient = useRef<{ x: number; y: number } | null>(null);

  const getPercentFromEvent = useCallback((e: React.MouseEvent | React.PointerEvent | PointerEvent) => {
    const container = imgContainerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    return {
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
    };
  }, []);

  const handleImageClick = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    const perc = getPercentFromEvent(e);
    if (!perc) return;
    addPoint(perc.x, perc.y);
  }, [disabled, getPercentFromEvent, addPoint]);

  const handlePointPointerDown = useCallback((e: React.PointerEvent, pointId: string) => {
    if (disabled) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragMovedRef.current = false;
    dragStartClient.current = { x: e.clientX, y: e.clientY };
    isDragging.current = true;
    setDraggingPointId(pointId);
  }, [disabled]);

  useEffect(() => {
    if (!draggingPointId) return;

    const onMove = (e: PointerEvent) => {
      const start = dragStartClient.current;
      if (start) {
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
          dragMovedRef.current = true;
        }
      }
      const perc = getPercentFromEvent(e);
      if (perc) {
        // Обновляем только локальный стейт (60 FPS, без тормозов всего приложения)
        setLocalPoints((prev) =>
          prev.map((p) =>
            p.id === draggingPointId ? { ...p, x: clamp(perc.x, 0, 100), y: clamp(perc.y, 0, 100) } : p
          )
        );
      }
    };

    const onUp = () => {
      isDragging.current = false;
      setDraggingPointId(null);
      dragStartClient.current = null;
      // Сохраняем итоговые координаты в родительский стейт ОДИН раз
      onChange({ ...valueRef.current, points: localPointsRef.current });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingPointId, getPercentFromEvent, onChange]);

  // ---------- Валидация ----------
  const validAnswerIds = new Set(answers.map((a) => a.id));
  const duplicateConnections = localPoints.filter(
    (p) => p.correctAnswerId && localPoints.filter((pp) => pp.correctAnswerId === p.correctAnswerId).length > 1
  );

  return (
    <div className="form-group" style={{ marginTop: 16 }}>
      <label style={{ fontWeight: 800, display: "block", marginBottom: 8 }}>
        🗺️ Редактор карты изображения
      </label>

      {/* Центральное изображение */}
      <div className="card" style={{ padding: 12, marginBottom: 14 }}>
        <label className="small-muted" style={{ fontWeight: 800, marginBottom: 6 }}>
          Центральное изображение:
        </label>
        <ImageUpload
          value={value.image || ""}
          onChange={(nextUrl) => handleImageChange(nextUrl || "")}
          disabled={disabled}
          bucket="question-images"
          label="Загрузить изображение (можно перетаскиванием):"
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
              alt="Центральное изображение карты"
              onLoad={(e) => setImgNaturalSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              draggable={false}
              style={{ width: "100%", height: "auto", display: "block" }}
            />
            
            {/* Рендер точек из локального стейта */}
            {localPoints.map((pt) => (
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
                      ? "#f59e0b" // Оранжевый во время перетаскивания
                      : validAnswerIds.has(pt.correctAnswerId)
                      ? "#10b981" // Зеленый, если привязан валидный ответ
                      : "#ef4444", // Красный, если ответ не выбран или удален
                  border: "3px solid white",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                  cursor: disabled ? "not-allowed" : "grab",
                  zIndex: draggingPointId === pt.id ? 20 : 10,
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

      {/* Список точек */}
      <div className="card" style={{ padding: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label className="small-muted" style={{ fontWeight: 800 }}>
            Точки на картинке ({localPoints.length})
          </label>
          <button type="button" className="btn small" onClick={() => addPoint(50, 50)} disabled={disabled}>
            ➕ Добавить точку (50%,50%)
          </button>
        </div>
        {localPoints.length === 0 ? (
          <div className="small-muted" style={{ marginTop: 8 }}>
            Нет точек. Кликните по изображению, чтобы создать.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {localPoints.map((pt) => (
              <div
                key={pt.id}
                style={{
                  display: "flex", gap: 8, alignItems: "center", padding: "8px 12px",
                  background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10,
                }}
              >
                <span style={{ fontWeight: 800, minWidth: 60 }}>{pt.label || pt.id}</span>
                <label className="small-muted">X%</label>
                <input
                  type="number"
                  className="input"
                  style={{ width: 70 }}
                  value={Math.round(pt.x * 10) / 10}
                  min={0} max={100} step={0.1}
                  disabled={disabled}
                  onChange={(e) => updatePoint(pt.id, { x: clamp(Number(e.target.value), 0, 100) })}
                />
                <label className="small-muted">Y%</label>
                <input
                  type="number"
                  className="input"
                  style={{ width: 70 }}
                  value={Math.round(pt.y * 10) / 10}
                  min={0} max={100} step={0.1}
                  disabled={disabled}
                  onChange={(e) => updatePoint(pt.id, { y: clamp(Number(e.target.value), 0, 100) })}
                />
                <label className="small-muted" style={{ marginLeft: 8 }}>Ответ:</label>
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
                      {ans.text || `Ответ (${ans.id.split("-")[0]})`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() => removePoint(pt.id)}
                  disabled={disabled}
                  title="Удалить точку"
                >
                  🗑️
                </button>
              </div>
            ))}
            {duplicateConnections.length > 0 && (
              <div className="error" style={{ marginTop: 8 }}>
                ⚠️ Обнаружены точки с одинаковым правильным ответом. Для этого типа заданий рекомендуется связь 1:1.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Варианты ответов */}
      <div className="card" style={{ padding: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label className="small-muted" style={{ fontWeight: 800 }}>
            Варианты ответов ({answers.length})
          </label>
          <button type="button" className="btn small" onClick={addAnswer} disabled={disabled}>
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
              <div key={ans.id} style={{ padding: "12px 14px", background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <label className="small-muted" style={{ minWidth: 60 }}>Текст:</label>
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
                    disabled={disabled}
                  >
                    🗑️
                  </button>
                </div>
                <MediaUpload
                  value={ans.media || []}
                  onChange={(media) => updateAnswer(ans.id, { media })}
                  disabled={disabled}
                  bucket="question-images"
                  label="Медиа для ответа (опционально):"
                />
                <div className="small-muted" style={{ marginTop: 6 }}>
                  ID: {ans.id.split("-")[0]}... {localPoints.some(p => p.correctAnswerId === ans.id) ? "✅ (привязан к точке)" : "⚠️ (не используется)"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Базовая валидация */}
      {!value.image && (
        <div className="error" style={{ marginTop: 8 }}>
          ❗ Изображение обязательно для этого типа вопроса.
        </div>
      )}
    </div>
  );
}