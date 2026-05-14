"use client";

import React, { useEffect, useRef, useState, useCallback, useId, useMemo } from "react";
import type { QuestionMatching, MatchingPair } from "../lib/types";
import MediaRenderer from "./MediaRenderer";

type Props = {
  question: QuestionMatching;
  value: Record<string, string>; // leftId -> rightId
  onChange: (val: Record<string, string>) => void;
  disabled?: boolean;
};

type DotNode = { id: string; x: number; y: number; side: "left" | "right" };

// ============================================================================
// Read-only компонент для отображения линий сопоставления в ревью
// ============================================================================

export type MatchingLinesRendererProps = {
  title?: string;
  pairs: MatchingPair[];
  matches: Record<string, string>;      // leftId -> rightId
  leftLabels: Record<string, string>;
  rightLabels: Record<string, string>;
  correctMatches?: Record<string, string>; // для определения правильности (опционально)
};

export function MatchingLinesRenderer({
  title,
  pairs,
  matches,
  leftLabels,
  rightLabels,
  correctMatches,
}: MatchingLinesRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const filterId = useId();
  const [dots, setDots] = useState<Record<string, DotNode>>({});
  const [rightItems, setRightItems] = useState<MatchingPair[]>([]);

  // Перемешиваем правую колонку для визуализации (как в оригинале)
  useEffect(() => {
    setRightItems([...pairs].sort(() => Math.random() - 0.5));
  }, [pairs]);

  const updateDotPositions = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newDots: Record<string, DotNode> = {};

    const dotElements = containerRef.current.querySelectorAll(".matching-dot-static");
    dotElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const id = htmlEl.dataset.id;
      const side = htmlEl.dataset.side as "left" | "right";
      if (!id || !side) return;

      const rect = htmlEl.getBoundingClientRect();
      newDots[`${side}-${id}`] = {
        id,
        side,
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top + rect.height / 2,
      };
    });
    setDots(newDots);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => updateDotPositions());
    observer.observe(containerRef.current);
    containerRef.current.querySelectorAll(".matching-card-static").forEach((card) => {
      observer.observe(card);
    });
    return () => observer.disconnect();
  }, [updateDotPositions, rightItems]);

  useEffect(() => {
    updateDotPositions();
  }, [updateDotPositions, rightItems]);

  const generatePath = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const midX = (x1 + x2) / 2;
    if (Math.abs(y1 - y2) < 10) {
      const offsetY = 30;
      return `M ${x1} ${y1} C ${midX} ${y1 - offsetY}, ${midX} ${y2 - offsetY}, ${x2} ${y2}`;
    }
    return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  }, []);

  const getStrokeColor = (leftId: string, rightId: string) => {
    if (!correctMatches) return "#6366f1"; // нейтральный
    const isCorrect = correctMatches[leftId] === rightId;
    return isCorrect ? "#22c55e" : "#ef4444";
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        minHeight: "300px",
        padding: "20px 0",
        userSelect: "none",
      }}
    >
      {title && (
        <div style={{ fontWeight: 800, marginBottom: 16, textAlign: "center" }}>{title}</div>
      )}

      <svg
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

        {Object.entries(matches).map(([leftId, rightId]) => {
          const start = dots[`left-${leftId}`];
          const end = dots[`right-${rightId}`];
          if (!start || !end) return null;
          const strokeColor = getStrokeColor(leftId, rightId);
          return (
            <path
              key={`${leftId}-${rightId}`}
              d={generatePath(start.x, start.y, end.x, end.y)}
              fill="none"
              stroke={strokeColor}
              strokeWidth="5"
              strokeLinecap="round"
              style={{ filter: `url(#${filterId})`, opacity: 0.85 }}
            />
          );
        })}
      </svg>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "50px",
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* Левая колонка */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "42%" }}>
          {pairs.map((p) => {
            const isConnected = !!matches[p.id];
            const leftText = leftLabels[p.id] || p.left.text || "—";
            return (
              <div
                key={p.id}
                className="matching-card-static"
                style={{
                  position: "relative",
                  background: "#fff",
                  border: `2px solid ${isConnected ? "#6366f1" : "#e2e8f0"}`,
                  borderRadius: "20px",
                  padding: "16px",
                  display: "flex",
                  alignItems: "center",
                  minHeight: "80px",
                  boxShadow: isConnected ? "0 8px 20px rgba(99,102,241,0.12)" : "0 2px 10px rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "8px" }}>
                    {leftText}
                  </div>
                  <MediaRenderer media={p.left.media} />
                </div>
                <div
                  className="matching-dot-static"
                  data-id={p.id}
                  data-side="left"
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: isConnected ? "#6366f1" : "#fff",
                    border: "4px solid #fff",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    position: "absolute",
                    right: "-14px",
                    zIndex: 50,
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Правая колонка */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "42%" }}>
          {rightItems.map((p) => {
            const isConnected = Object.values(matches).includes(p.id);
            const rightText = rightLabels[p.id] || p.right.text || "—";
            return (
              <div
                key={p.id}
                className="matching-card-static"
                style={{
                  position: "relative",
                  background: "#fff",
                  border: `2px solid ${isConnected ? "#6366f1" : "#e2e8f0"}`,
                  borderRadius: "20px",
                  padding: "16px",
                  display: "flex",
                  alignItems: "center",
                  minHeight: "80px",
                  boxShadow: isConnected ? "0 8px 20px rgba(99,102,241,0.12)" : "0 2px 10px rgba(0,0,0,0.02)",
                }}
              >
                <div
                  className="matching-dot-static"
                  data-id={p.id}
                  data-side="right"
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: isConnected ? "#6366f1" : "#fff",
                    border: "4px solid #fff",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    position: "absolute",
                    left: "-14px",
                    zIndex: 50,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "8px" }}>
                    {rightText}
                  </div>
                  <MediaRenderer media={p.right.media} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Оригинальный интерактивный компонент
// ============================================================================

export default function QuestionMatching({ question, value = {}, onChange, disabled }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const filterId = useId();

  const pairs = Array.isArray(question.pairs) ? question.pairs : [];
  const [rightItems, setRightItems] = useState<MatchingPair[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [dots, setDots] = useState<Record<string, DotNode>>({});

  const [drawingLine, setDrawingLine] = useState<{
    startId: string;
    side: "left" | "right";
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const shuffled = [...pairs].sort(() => Math.random() - 0.5);
    setRightItems(shuffled);
    setIsMounted(true);
  }, [pairs]);

  const updateDotPositions = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newDots: Record<string, DotNode> = {};

    const dotElements = containerRef.current.querySelectorAll(".matching-dot");
    dotElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const id = htmlEl.dataset.id;
      const side = htmlEl.dataset.side as "left" | "right";
      if (!id || !side) return;

      const rect = htmlEl.getBoundingClientRect();
      newDots[`${side}-${id}`] = {
        id,
        side,
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top + rect.height / 2,
      };
    });
    setDots(newDots);
  }, []);

  useEffect(() => {
    if (!isMounted || !containerRef.current) return;

    const observer = new ResizeObserver(() => {
      updateDotPositions();
    });

    observer.observe(containerRef.current);
    containerRef.current.querySelectorAll(".matching-card").forEach((card) => {
      observer.observe(card);
    });

    return () => observer.disconnect();
  }, [isMounted, updateDotPositions, rightItems]);

  const handlePointerDown = (e: React.PointerEvent, id: string, side: "left" | "right") => {
    if (disabled) return;
    e.preventDefault();

    const nextVal = { ...value };
    if (side === "left") {
      delete nextVal[id];
    } else {
      const leftKey = Object.keys(nextVal).find((k) => nextVal[k] === id);
      if (leftKey) delete nextVal[leftKey];
    }
    onChange(nextVal);

    const rect = containerRef.current!.getBoundingClientRect();
    setDrawingLine({
      startId: id,
      side: side,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drawingLine || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDrawingLine({
      ...drawingLine,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!drawingLine) return;

    const targetEl = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest(".matching-dot") as HTMLElement;

    if (targetEl) {
      const targetId = targetEl.dataset.id;
      const targetSide = targetEl.dataset.side as "left" | "right";

      if (targetId && targetSide !== drawingLine.side) {
        const leftId = drawingLine.side === "left" ? drawingLine.startId : targetId;
        const rightId = drawingLine.side === "right" ? drawingLine.startId : targetId;

        const nextVal = { ...value };
        Object.keys(nextVal).forEach((k) => {
          if (nextVal[k] === rightId) delete nextVal[k];
        });
        nextVal[leftId] = rightId;
        onChange(nextVal);
      }
    }
    setDrawingLine(null);
  };

  const generatePath = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const midX = (x1 + x2) / 2;
    if (Math.abs(y1 - y2) < 10) {
      const offsetY = 30;
      return `M ${x1} ${y1} C ${midX} ${y1 - offsetY}, ${midX} ${y2 - offsetY}, ${x2} ${y2}`;
    }
    return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  }, []);

  if (!isMounted)
    return (
      <div style={{ height: "300px", background: "rgba(0,0,0,0.02)", borderRadius: "20px" }} />
    );

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        position: "relative",
        width: "100%",
        minHeight: "350px",
        padding: "20px 0",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      <svg
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

        {Object.entries(value).map(([lId, rId]) => {
          const start = dots[`left-${lId}`];
          const end = dots[`right-${rId}`];
          if (!start || !end) return null;
          return (
            <path
              key={`${lId}-${rId}`}
              d={generatePath(start.x, start.y, end.x, end.y)}
              fill="none"
              stroke="#6366f1"
              strokeWidth="6"
              strokeLinecap="round"
              style={{ filter: `url(#${filterId})`, opacity: 0.9 }}
            />
          );
        })}

        {drawingLine && dots[`${drawingLine.side}-${drawingLine.startId}`] && (
          <path
            d={generatePath(
              dots[`${drawingLine.side}-${drawingLine.startId}`].x,
              dots[`${drawingLine.side}-${drawingLine.startId}`].y,
              drawingLine.x,
              drawingLine.y,
            )}
            fill="none"
            stroke="#6366f1"
            strokeWidth="4"
            strokeDasharray="8 8"
            strokeLinecap="round"
            opacity="0.6"
          />
        )}
      </svg>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "50px",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "42%" }}>
          {pairs.map((p) => (
            <div
              key={p.id}
              className="matching-card"
              style={{
                position: "relative",
                background: "#fff",
                border: `2px solid ${value[p.id] ? "#6366f1" : "#e2e8f0"}`,
                borderRadius: "20px",
                padding: "16px",
                display: "flex",
                alignItems: "center",
                minHeight: "80px",
                boxShadow: value[p.id]
                  ? "0 8px 20px rgba(99,102,241,0.12)"
                  : "0 2px 10px rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ flex: 1 }}>
                {p.left.text && (
                  <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "8px" }}>
                    {p.left.text}
                  </div>
                )}
                <MediaRenderer media={p.left.media} />
              </div>
              <div
                className="matching-dot"
                data-id={p.id}
                data-side="left"
                onPointerDown={(e) => handlePointerDown(e, p.id, "left")}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: value[p.id] ? "#6366f1" : "#fff",
                  border: "6px solid #fff",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                  position: "absolute",
                  right: "-16px",
                  cursor: "crosshair",
                  zIndex: 50,
                }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "42%" }}>
          {rightItems.map((p) => {
            const isConnected = Object.values(value).includes(p.id);
            return (
              <div
                key={p.id}
                className="matching-card"
                style={{
                  position: "relative",
                  background: "#fff",
                  border: `2px solid ${isConnected ? "#6366f1" : "#e2e8f0"}`,
                  borderRadius: "20px",
                  padding: "16px",
                  display: "flex",
                  alignItems: "center",
                  minHeight: "80px",
                  boxShadow: isConnected
                    ? "0 8px 20px rgba(99,102,241,0.12)"
                    : "0 2px 10px rgba(0,0,0,0.02)",
                }}
              >
                <div
                  className="matching-dot"
                  data-id={p.id}
                  data-side="right"
                  onPointerDown={(e) => handlePointerDown(e, p.id, "right")}
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    background: isConnected ? "#6366f1" : "#fff",
                    border: "6px solid #fff",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
                    position: "absolute",
                    left: "-16px",
                    cursor: "crosshair",
                    zIndex: 50,
                  }}
                />
                <div style={{ flex: 1 }}>
                  {p.right.text && (
                    <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "8px" }}>
                      {p.right.text}
                    </div>
                  )}
                  <MediaRenderer media={p.right.media} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .matching-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .matching-dot {
          transition: transform 0.2s ease, background 0.2s ease;
        }
        .matching-dot:hover {
          transform: scale(1.15);
        }
      `}</style>
    </div>
  );
}