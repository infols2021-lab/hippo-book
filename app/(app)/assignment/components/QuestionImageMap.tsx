"use client";

import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { QuestionImageMap } from "../lib/types";
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
function buildCurvePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // контрольные точки: первая идёт вверх от ответа, вторая — вниз к точке
  const cp1x = x1;
  const cp1y = y1 - Math.min(50, dist * 0.4);
  const cp2x = x2;
  const cp2y = y2 + Math.min(50, dist * 0.4);
  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QuestionImageMap({
  question,
  value = {},
  onChange,
  disabled,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const filterId = useId();

  // ---- data normalization ----
  const points = useMemo(
    () => (Array.isArray(question.points) ? question.points : []),
    [question.points],
  );

  const answers = useMemo(
    () => (Array.isArray(question.answers) ? question.answers : []),
    [question.answers],
  );

  const imageUrl = useMemo(
    () => getImageUrl(question.image),
    [question.image],
  );

  // ---- UI state ----
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);

  // ---- pixel positions (recalculated on resize) ----
  const [pointPixels, setPointPixels] = useState<PointPixel[]>([]);
  const [answerAnchors, setAnswerAnchors] = useState<AnswerAnchor[]>([]);

  // ---- Refs for answer elements (to measure anchors) ----
  const answerElRefs = useRef<Map<string, HTMLElement>>(new Map());

  const recalcRequestedRef = useRef(false);

  // ---- calculate pixel positions (debounced) ----
  const recalc = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    // ---- points ----
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

    // ---- answer anchors ----
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

  // recalc on mount, resize, and whenever connections change
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
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => {
      window.removeEventListener("resize", onResize);
      observer.disconnect();
    };
  }, [recalc]);

  const handleImageLoad = useCallback(() => recalc(), [recalc]);

  // ---- interactions ----
  const handleAnswerClick = useCallback(
    (answerId: string) => {
      if (disabled) return;

      // if this answer already has a connection, remove it and prepare to reconnect
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

      // if this point is already connected to another answer, remove that link
      const existingAnswerForPoint = Object.entries(value).find(
        ([, pid]) => pid === pointId,
      )?.[0];
      if (existingAnswerForPoint) {
        const next = { ...value };
        delete next[existingAnswerForPoint];
        onChange(next);
      }

      // connect selected answer to this point
      const next = { ...value, [selectedAnswerId]: pointId };
      onChange(next);
      setSelectedAnswerId(null);
    },
    [disabled, selectedAnswerId, value, onChange],
  );

  const handleMapBackgroundClick = useCallback(
    (e: React.MouseEvent) => {
      // deselect only when clicking exactly on the background, not on points or cards
      if (e.target === e.currentTarget) {
        setSelectedAnswerId(null);
      }
    },
    [],
  );

  // ---- render helpers ----
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

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div>
      {/* Подсказка сверху */}
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
        {/* ====== SVG overlay ====== */}
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

          {/* existing connections */}
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

        {/* ====== Central Image + Points ====== */}
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

          {/* clickable points */}
          {pointPixels.map((pt) => {
            const isConnected = Object.values(value).includes(pt.id);
            const isSelectable = !!selectedAnswerId;
            const cursor =
              disabled ? "not-allowed" : isSelectable ? "pointer" : "default";

            return (
              <div
                key={pt.id}
                data-point-id={pt.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePointClick(pt.id, e);
                }}
                className={
                  isSelectable && !isConnected ? "imagemap-point-pulse" : ""
                }
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
                  boxShadow: isSelectable
                    ? "0 0 0 4px rgba(99,102,241,0.2)"
                    : "0 2px 8px rgba(0,0,0,0.15)",
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

        {/* ====== Answer Cards ====== */}
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
                {/* media thumbnail — рендерим простое изображение без MediaRenderer */}
                {ans.media && ans.media.length > 0 && (
                  <div
                    style={{
                      width: "120px",
                      height: "120px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "12px",
                      overflow: "hidden",
                      backgroundColor: "#f8fafc",
                    }}
                  >
                    <img
                      src={getImageUrl(ans.media[0].url)}
                      alt={ans.text || "Ответ"}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                )}

                {/* text */}
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

                {/* indicator */}
                {isConnected && (
                  <span style={{ fontSize: 20, lineHeight: 1 }}>✅</span>
                )}
                {isSelected && !isConnected && (
                  <span
                    style={{
                      fontSize: 12,
                      color: "#6366f1",
                      fontWeight: 600,
                    }}
                  >
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

        /* pulse animation for available points */
        @keyframes pulse {
          0% {
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.15);
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
          }
        }
        .imagemap-point-pulse {
          animation: pulse 1.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}