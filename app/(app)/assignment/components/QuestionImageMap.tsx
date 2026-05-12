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
import MediaRenderer from "./MediaRenderer";
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
  y: number; // центр нижней грани карточки
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

  // ---- calculate pixel positions ----
  const recalc = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();

    // ---- points ----
    // we look for the image element inside the map-area to get its dimensions
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
      setPointPixels(newPoints);
    }

    // ---- answer anchors ----
    const newAnchors: AnswerAnchor[] = [];
    for (const ans of answers) {
      const el = answerElRefs.current.get(ans.id);
      if (el) {
        const rect = el.getBoundingClientRect();
        // anchor: center bottom of the element
        newAnchors.push({
          answerId: ans.id,
          x: rect.left + rect.width / 2 - containerRect.left,
          y: rect.bottom - containerRect.top,
        });
      }
    }
    setAnswerAnchors(newAnchors);
  }, [points, answers]);

  // recalc on mount and resize
  useEffect(() => {
    recalc();
    const onResize = () => recalc();
    window.addEventListener("resize", onResize);
    // also observe container size changes
    const observer = new ResizeObserver(() => recalc());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => {
      window.removeEventListener("resize", onResize);
      observer.disconnect();
    };
  }, [recalc]);

  // also recalc when image loads
  const handleImageLoad = useCallback(() => recalc(), [recalc]);

  // ---- interactions ----
  const handleAnswerClick = useCallback(
    (answerId: string) => {
      if (disabled) return;

      // if this answer already has a connection, remove it and select this answer for new connection
      if (value[answerId]) {
        const next = { ...value };
        delete next[answerId];
        onChange(next);
        setSelectedAnswerId(answerId);
        return;
      }

      // toggle selection
      setSelectedAnswerId((prev) => (prev === answerId ? null : answerId));
    },
    [disabled, value, onChange],
  );

  const handlePointClick = useCallback(
    (pointId: string, e: React.MouseEvent | React.PointerEvent) => {
      if (disabled) return;
      e.stopPropagation();

      if (!selectedAnswerId) return;

      // check if this point is already connected to another answer
      const existingAnswerForPoint = Object.entries(value).find(
        ([, pid]) => pid === pointId,
      )?.[0];
      if (existingAnswerForPoint) {
        // remove old connection
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

  const handleMapBackgroundClick = useCallback(() => {
    // deselect answer when clicking on empty area of the map
    setSelectedAnswerId(null);
  }, []);

  // ---- render helpers ----
  const getAnswerPoint = (answerId: string): PointPixel | undefined => {
    const pointId = value[answerId];
    if (!pointId) return undefined;
    return pointPixels.find((p) => p.id === pointId);
  };

  const getAnchor = (answerId: string): AnswerAnchor | undefined =>
    answerAnchors.find((a) => a.answerId === answerId);

  // ---- SVG line generation ----
  const linePath = (anchor: AnswerAnchor, point: PointPixel) =>
    `M ${anchor.x} ${anchor.y} L ${point.x} ${point.y}`;

  // ---- collect refs for answers ----
  const setAnswerRef = useCallback(
    (ansId: string, el: HTMLElement | null) => {
      if (el) {
        answerElRefs.current.set(ansId, el);
      } else {
        answerElRefs.current.delete(ansId);
      }
      // recalc anchors after render
      setTimeout(recalc, 0);
    },
    [recalc],
  );

  // ============================================================
  // RENDER
  // ============================================================

  return (
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
            <line
              key={`${ansId}-${pointId}`}
              x1={anchor.x}
              y1={anchor.y}
              x2={point.x}
              y2={point.y}
              stroke="#6366f1"
              strokeWidth="4"
              strokeLinecap="round"
              style={{ filter: `url(#${filterId})`, opacity: 0.85 }}
            />
          );
        })}

        {/* dashed line from selected answer to mouse (we'll handle in a moment, but here we can't track mouse without state; we'll skip the preview line for simplicity, but we can add a simple approach if needed) */}
        {/* For now, no preview line for simplicity; they just click point and it connects */}
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
              onPointerDown={(e) => handlePointClick(pt.id, e)}
              style={{
                position: "absolute",
                left: pt.x - 12,
                top: pt.y - 12,
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: isConnected
                  ? "#6366f1"
                  : isSelectable
                  ? "rgba(99,102,241,0.25)"
                  : "rgba(0,0,0,0.2)",
                border: "3px solid #fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                cursor,
                transition: "background 0.15s ease",
                boxSizing: "border-box",
                zIndex: 10,
                pointerEvents: disabled ? "none" : "auto",
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
          gap: "12px",
          justifyContent: "center",
          marginTop: "8px",
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
                minWidth: "100px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "6px",
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
              {/* media thumbnail */}
              {ans.media && ans.media.length > 0 && (
                <div style={{ width: "100%", maxWidth: 120 }}>
                  <MediaRenderer media={ans.media} />
                </div>
              )}

              {/* text */}
              {ans.text && (
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: isSelected ? "#6366f1" : "#334155",
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
                  Выберите точку
                </span>
              )}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .imagemap-answer-card:hover {
          transform: translateY(-2px);
        }
        .imagemap-answer-card:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}