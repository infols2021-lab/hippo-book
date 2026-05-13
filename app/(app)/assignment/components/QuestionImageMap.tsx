// файл app/(app)/assignment/components/QuestionImageMap.tsx
// Улучшенная версия с визуализацией карточек, линий и медиа
// Исправлена проблема мелких картинок в прохождении задания: убран фиксированный размер 120x120,
// теперь картинки отображаются с max-width 180px и max-height 140px, сохраняя пропорции.
"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { QuestionImageMap, ImageMapPoint, ImageMapAnswer } from "../lib/types";
import { getImageUrl } from "../lib/image";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PointPixel = {
  id: string;
  x: number;
  y: number;
  correctAnswerId: string;
  label?: string;
};

type AnswerAnchor = {
  answerId: string;
  x: number;
  y: number; // центр верхней грани карточки
};

type Props = {
  question: QuestionImageMap;
  value: Record<string, string>; // answerId -> pointId
  onChange: (val: Record<string, string>) => void;
  disabled?: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Генератор плавной кривой от ответа к точке */
function buildCurvePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const cp1x = x1;
  const cp1y = y1 - Math.min(50, dist * 0.4);
  const cp2x = x2;
  const cp2y = y2 + Math.min(50, dist * 0.4);
  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
}

// ---------------------------------------------------------------------------
// 🎯 ВЫНЕСЕННАЯ ФУНКЦИЯ ДЛЯ ВИЗУАЛИЗАЦИИ (используется в ReviewPanel)
// ---------------------------------------------------------------------------

export type ImageMapMatch = Record<string, string>; // answerId -> pointId

export type ImageMapRendererProps = {
  imageUrl: string;
  points: ImageMapPoint[];
  answers: ImageMapAnswer[];
  matches: ImageMapMatch;          // фактические связи (пользовательские или правильные)
  correctMatches: ImageMapMatch;   // правильные связи (для определения цвета)
  pointColorConnected?: string;
  pointColorUnconnected?: string;
  pointSize?: number;
  lineColorCorrect?: string;
  lineColorIncorrect?: string;
  strokeWidth?: number;
  showLabels?: boolean;
};

/**
 * Компонент для статической визуализации карты изображения с точками и линиями.
 * Используется в разборе (ReviewPanel).
 */
export function ImageMapRenderer({
  imageUrl,
  points,
  answers,
  matches,
  correctMatches,
  pointColorConnected = "#22c55e",   // ярко-зелёный
  pointColorUnconnected = "#94a3b8",
  pointSize = 20,
  lineColorCorrect = "#22c55e",      // ярко-зелёный
  lineColorIncorrect = "#ef4444",    // ярко-красный
  strokeWidth = 4,
  showLabels = true,
}: ImageMapRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pointPixels, setPointPixels] = useState<PointPixel[]>([]);
  const [answerAnchors, setAnswerAnchors] = useState<AnswerAnchor[]>([]);

  // Маппинг для быстрого доступа
  const answerMap = useMemo(() => new Map(answers.map(a => [a.id, a])), [answers]);
  const pointMap = useMemo(() => new Map(points.map(p => [p.id, p])), [points]);

  // пересчёт пиксельных координат точек и карточек
  const recalc = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    // точки
    const imgEl = container.querySelector<HTMLImageElement>(".imagemap-renderer-image");
    if (imgEl) {
      const imgRect = imgEl.getBoundingClientRect();
      const imgWidth = imgRect.width;
      const imgHeight = imgRect.height;
      const imgLeft = imgRect.left - containerRect.left;
      const imgTop = imgRect.top - containerRect.top;
      const newPoints: PointPixel[] = points.map((p) => ({
        id: p.id,
        x: imgLeft + (clamp(p.x, 0, 100) / 100) * imgWidth,
        y: imgTop + (clamp(p.y, 0, 100) / 100) * imgHeight,
        correctAnswerId: p.correctAnswerId,
        label: p.label,
      }));
      setPointPixels(newPoints);
    }

    // карточки ответов (снизу)
    const answerCards = container.querySelectorAll<HTMLElement>(".imagemap-answer-card");
    const newAnchors: AnswerAnchor[] = [];
    answerCards.forEach((card) => {
      const answerId = card.dataset.answerId;
      if (!answerId) return;
      const rect = card.getBoundingClientRect();
      newAnchors.push({
        answerId,
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top - containerRect.top,
      });
    });
    setAnswerAnchors(newAnchors);
  }, [points, answers]);

  useEffect(() => {
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [recalc]);

  const handleImageLoad = () => recalc();

  // вспомогательная функция: правильная ли связь
  const isMatchCorrect = (answerId: string, pointId: string) => {
    return correctMatches[answerId] === pointId;
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <img
        className="imagemap-renderer-image"
        src={getImageUrl(imageUrl)}
        alt=""
        onLoad={handleImageLoad}
        style={{ width: "100%", height: "auto", display: "block", borderRadius: 12 }}
      />

      {/* Слой для линий */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        {answerAnchors.map((anchor) => {
          const pointId = matches[anchor.answerId];
          if (!pointId) return null;
          const point = pointPixels.find(p => p.id === pointId);
          if (!point) return null;
          const isCorrect = isMatchCorrect(anchor.answerId, pointId);
          return (
            <path
              key={`line-${anchor.answerId}`}
              d={buildCurvePath(anchor.x, anchor.y, point.x, point.y)}
              fill="none"
              stroke={isCorrect ? lineColorCorrect : lineColorIncorrect}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={isCorrect ? "none" : "6,6"}
              opacity={0.9}
            />
          );
        })}
      </svg>

      {/* Точки */}
      {pointPixels.map((pt) => {
        const connectedAnswerId = Object.entries(matches).find(([, pid]) => pid === pt.id)?.[0];
        const isConnected = !!connectedAnswerId;
        const isCorrect = isConnected ? isMatchCorrect(connectedAnswerId, pt.id) : false;
        const color = isConnected ? (isCorrect ? pointColorConnected : lineColorIncorrect) : pointColorUnconnected;
        const answerLabel = connectedAnswerId ? answerMap.get(connectedAnswerId)?.text : undefined;
        return (
          <div
            key={pt.id}
            style={{
              position: "absolute",
              left: pt.x - pointSize/2,
              top: pt.y - pointSize/2,
              width: pointSize,
              height: pointSize,
              borderRadius: "50%",
              background: color,
              border: "3px solid white",
              boxShadow: "0 0 0 2px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: pointSize * 0.5,
              fontWeight: "bold",
              color: "#fff",
              textShadow: "0 1px 1px rgba(0,0,0,0.3)",
            }}
            title={pt.label || pt.id}
          >
            {showLabels && answerLabel ? answerLabel.slice(0, 2) : ""}
          </div>
        );
      })}

      {/* Карточки ответов внизу */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          justifyContent: "center",
          marginTop: "24px",
        }}
      >
        {answers.map((ans) => {
          const pointId = matches[ans.id];
          const isConnected = !!pointId;
          const isCorrect = isConnected ? isMatchCorrect(ans.id, pointId) : false;
          return (
            <div
              key={ans.id}
              data-answer-id={ans.id}
              className="imagemap-answer-card"
              style={{
                background: isConnected ? (isCorrect ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)") : "#fff",
                border: `2px solid ${isConnected ? (isCorrect ? "#22c55e" : "#ef4444") : "#e2e8f0"}`,
                borderRadius: "16px",
                padding: "8px 12px",
                minWidth: "100px",
                textAlign: "center",
                cursor: "default",
                transition: "all 0.2s",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              }}
            >
              {ans.media && ans.media.length > 0 ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                  <img
                    src={getImageUrl(ans.media[0].url)}
                    alt=""
                    style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 8 }}
                  />
                  {ans.text && <span style={{ fontWeight: "bold", color: "#1e293b" }}>{ans.text}</span>}
                </div>
              ) : (
                <span style={{ fontWeight: "bold", color: "#1e293b" }}>{ans.text || ans.id.slice(0,4)}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ОСНОВНОЙ КОМПОНЕНТ ДЛЯ РЕДАКТИРОВАНИЯ (исправлен: картинки больше не мелкие)
// ---------------------------------------------------------------------------

export default function QuestionImageMap({
  question,
  value = {},
  onChange,
  disabled,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const filterId = useId();

  const points = useMemo(
    () => (Array.isArray(question.points) ? question.points : []),
    [question.points],
  );

  const answers = useMemo(
    () => (Array.isArray(question.answers) ? question.answers : []),
    [question.answers],
  );

  const imageUrl = useMemo(() => getImageUrl(question.image), [question.image]);

  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [pointPixels, setPointPixels] = useState<PointPixel[]>([]);
  const [answerAnchors, setAnswerAnchors] = useState<AnswerAnchor[]>([]);
  const answerElRefs = useRef<Map<string, HTMLElement>>(new Map());
  const recalcRequestedRef = useRef(false);

  const recalc = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();

    const imgEl = container.querySelector<HTMLImageElement>(".imagemap-image");
    if (imgEl) {
      const imgRect = imgEl.getBoundingClientRect();
      const imgWidth = imgRect.width;
      const imgHeight = imgRect.height;
      const imgLeft = imgRect.left - containerRect.left;
      const imgTop = imgRect.top - containerRect.top;

      const newPoints: PointPixel[] = points.map((p) => ({
        id: p.id,
        x: imgLeft + (clamp(p.x, 0, 100) / 100) * imgWidth,
        y: imgTop + (clamp(p.y, 0, 100) / 100) * imgHeight,
        correctAnswerId: p.correctAnswerId,
        label: p.label,
      }));
      setPointPixels((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(newPoints)) return prev;
        return newPoints;
      });
    }

    const newAnchors: AnswerAnchor[] = [];
    for (const ans of answers) {
      const el = answerElRefs.current.get(ans.id);
      if (el) {
        const rect = el.getBoundingClientRect();
        newAnchors.push({
          answerId: ans.id,
          x: rect.left + rect.width / 2 - containerRect.left,
          y: rect.top - containerRect.top,
        });
      }
    }
    setAnswerAnchors((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(newAnchors)) return prev;
      return newAnchors;
    });
  }, [points, answers]);

  useEffect(() => {
    recalc();
  }, [recalc, value]);

  useEffect(() => {
    const onResize = () => {
      if (!recalcRequestedRef.current) {
        recalcRequestedRef.current = true;
        requestAnimationFrame(() => {
          recalc();
          recalcRequestedRef.current = false;
        });
      }
    };
    window.addEventListener("resize", onResize);
    const observer = new ResizeObserver(() => {
      if (!recalcRequestedRef.current) {
        recalcRequestedRef.current = true;
        requestAnimationFrame(() => {
          recalc();
          recalcRequestedRef.current = false;
        });
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      window.removeEventListener("resize", onResize);
      observer.disconnect();
    };
  }, [recalc]);

  const handleImageLoad = useCallback(() => recalc(), [recalc]);

  const handleAnswerClick = useCallback(
    (answerId: string) => {
      if (disabled) return;
      if (value[answerId]) {
        const next = { ...value };
        delete next[answerId];
        onChange(next);
        setSelectedAnswerId(answerId);
        return;
      }
      setSelectedAnswerId((prev) => (prev === answerId ? null : answerId));
    },
    [disabled, value, onChange],
  );

  const handlePointClick = useCallback(
    (pointId: string, e: React.MouseEvent | React.PointerEvent) => {
      if (disabled) return;
      e.stopPropagation();
      if (!selectedAnswerId) return;

      const existingAnswerForPoint = Object.entries(value).find(
        ([, pid]) => pid === pointId,
      )?.[0];
      let next = { ...value };
      if (existingAnswerForPoint) delete next[existingAnswerForPoint];
      next = { ...next, [selectedAnswerId]: pointId };
      onChange(next);
      setSelectedAnswerId(null);
    },
    [disabled, selectedAnswerId, value, onChange],
  );

  const handleMapBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setSelectedAnswerId(null);
  }, []);

  const getAnswerPoint = (answerId: string): PointPixel | undefined => {
    const pointId = value[answerId];
    if (!pointId) return undefined;
    return pointPixels.find((p) => p.id === pointId);
  };

  const getAnchor = (answerId: string): AnswerAnchor | undefined =>
    answerAnchors.find((a) => a.answerId === answerId);

  const setAnswerRef = useCallback(
    (ansId: string, el: HTMLElement | null) => {
      if (el) {
        answerElRefs.current.set(ansId, el);
      } else {
        answerElRefs.current.delete(ansId);
      }
      setTimeout(recalc, 0);
    },
    [recalc],
  );

  return (
    <div>
      <div
        style={{
          textAlign: "center",
          marginBottom: 16,
          color: "#475569",
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        {selectedAnswerId
          ? "✅ Ответ выбран – нажмите на нужную точку на карте"
          : "👆 Сначала нажмите на карточку ответа, затем – на точку на карте"}
      </div>

      <div
        ref={containerRef}
        onClick={handleMapBackgroundClick}
        style={{
          position: "relative",
          width: "100%",
          userSelect: "none",
          touchAction: "none",
        }}
      >
        <svg
          className="imagemap-svg"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 5,
          }}
        >
          <defs>
            <filter id={filterId}>
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {Object.entries(value).map(([ansId, pointId]) => {
            const anchor = getAnchor(ansId);
            const point = getAnswerPoint(ansId);
            if (!anchor || !point) return null;
            return (
              <path
                key={`${ansId}-${pointId}`}
                d={buildCurvePath(anchor.x, anchor.y, point.x, point.y)}
                fill="none"
                stroke="#6366f1"
                strokeWidth="3"
                strokeLinecap="round"
                style={{ filter: `url(#${filterId})`, opacity: 0.85 }}
              />
            );
          })}
        </svg>

        <div
          className="imagemap-map-area"
          style={{ position: "relative", width: "100%", marginBottom: "16px" }}
        >
          <img
            className="imagemap-image"
            src={imageUrl}
            alt=""
            onLoad={handleImageLoad}
            draggable={false}
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              borderRadius: "16px",
              boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
            }}
          />

          {pointPixels.map((pt) => {
            const isConnected = Object.values(value).includes(pt.id);
            const isSelectable = !!selectedAnswerId;
            const cursor = disabled ? "not-allowed" : isSelectable ? "pointer" : "default";
            return (
              <div
                key={pt.id}
                data-point-id={pt.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePointClick(pt.id, e);
                }}
                className={isSelectable && !isConnected ? "imagemap-point-pulse" : ""}
                style={{
                  position: "absolute",
                  left: pt.x - 16,
                  top: pt.y - 16,
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: isConnected
                    ? "#6366f1"
                    : isSelectable
                    ? "rgba(99,102,241,0.35)"
                    : "rgba(0,0,0,0.2)",
                  border: "3px solid #fff",
                  boxShadow: isSelectable ? "0 0 0 4px rgba(99,102,241,0.2)" : "0 2px 8px rgba(0,0,0,0.15)",
                  cursor,
                  transition: "background 0.15s ease, box-shadow 0.15s ease",
                  boxSizing: "border-box",
                  zIndex: 10,
                }}
              >
                {pt.label && (
                  <span
                    style={{
                      position: "absolute",
                      top: -20,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "rgba(0,0,0,0.6)",
                      color: "#fff",
                      padding: "2px 6px",
                      borderRadius: 4,
                      fontSize: 10,
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                    }}
                  >
                    {pt.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div
          className="imagemap-answers"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "16px",
            justifyContent: "center",
            marginTop: "12px",
          }}
        >
          {answers.map((ans) => {
            const isConnected = !!value[ans.id];
            const isSelected = selectedAnswerId === ans.id;
            return (
              <div
                key={ans.id}
                ref={(el) => setAnswerRef(ans.id, el)}
                className="imagemap-answer-card"
                onClick={() => handleAnswerClick(ans.id)}
                style={{
                  background: isSelected
                    ? "rgba(99,102,241,0.12)"
                    : isConnected
                    ? "rgba(99,102,241,0.05)"
                    : "#fff",
                  border: `2px solid ${
                    isSelected
                      ? "#6366f1"
                      : isConnected
                      ? "rgba(99,102,241,0.3)"
                      : "#e2e8f0"
                  }`,
                  borderRadius: "16px",
                  padding: "12px 16px",
                  minWidth: "120px",
                  maxWidth: "220px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  cursor: disabled ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: isSelected
                    ? "0 4px 12px rgba(99,102,241,0.15)"
                    : isConnected
                    ? "0 2px 8px rgba(0,0,0,0.04)"
                    : "0 1px 4px rgba(0,0,0,0.02)",
                  opacity: disabled && !isConnected ? 0.6 : 1,
                }}
              >
                {/* 🔧 ИСПРАВЛЕНО: убран фиксированный размер 120x120, теперь картинка занимает разумное место */}
                {ans.media && ans.media.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "12px",
                      overflow: "hidden",
                      backgroundColor: "#f8fafc",
                      maxWidth: "100%",
                    }}
                  >
                    <img
                      src={getImageUrl(ans.media[0].url)}
                      alt={ans.text || "Ответ"}
                      style={{
                        width: "auto",
                        height: "auto",
                        maxWidth: "180px",
                        maxHeight: "140px",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                )}
                {ans.text && (
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: isSelected ? "#6366f1" : "#334155",
                      textAlign: "center",
                      wordBreak: "break-word",
                    }}
                  >
                    {ans.text}
                  </span>
                )}
                {isConnected && <span style={{ fontSize: 20, lineHeight: 1 }}>✅</span>}
                {isSelected && !isConnected && (
                  <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 600 }}>
                    Теперь выберите точку
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .imagemap-answer-card:hover {
          transform: translateY(-2px);
        }
        .imagemap-answer-card:active {
          transform: translateY(0);
        }
        @keyframes pulse {
          0% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.15); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
        .imagemap-point-pulse {
          animation: pulse 1.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}