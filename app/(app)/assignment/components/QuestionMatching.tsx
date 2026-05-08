"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import type { QuestionMatching, MatchingPair } from "../lib/types";
import MediaRenderer from "./MediaRenderer";

type Props = {
  question: QuestionMatching;
  value: Record<string, string>; // leftId -> rightId
  onChange: (val: Record<string, string>) => void;
  disabled?: boolean;
};

type DotNode = { id: string; x: number; y: number; side: "left" | "right" };

export default function QuestionMatching({ question, value = {}, onChange, disabled }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pairs = Array.isArray(question.pairs) ? question.pairs : [];
  
  const [rightItems, setRightItems] = useState<MatchingPair[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [dots, setDots] = useState<Record<string, DotNode>>({});
  const [drawingLine, setDrawingLine] = useState<{ startId: string; side: "left" | "right"; x: number; y: number } | null>(null);

  // Перемешиваем только один раз на клиенте
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
      newDots[id + side] = { // Уникальный ключ по ID + сторона
        id,
        side,
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top + rect.height / 2,
      };
    });
    setDots(newDots);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const timeout = setTimeout(updateDotPositions, 200); // Даем время картинкам
    window.addEventListener("resize", updateDotPositions);
    return () => window.removeEventListener("resize", updateDotPositions);
  }, [isMounted, updateDotPositions, rightItems]);

  const handlePointerDown = (e: React.PointerEvent, id: string, side: "left" | "right") => {
    if (disabled) return;
    e.preventDefault();

    // Сбрасываем связь, если она уже была
    const nextVal = { ...value };
    if (side === "left") {
      delete nextVal[id];
    } else {
      const leftKey = Object.keys(nextVal).find(k => nextVal[k] === id);
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

    const targetEl = document.elementFromPoint(e.clientX, e.clientY)?.closest(".matching-dot") as HTMLElement;
    
    if (targetEl) {
      const targetId = targetEl.dataset.id;
      const targetSide = targetEl.dataset.side as "left" | "right";
      
      if (targetId && targetSide !== drawingLine.side) {
        const leftId = drawingLine.side === "left" ? drawingLine.startId : targetId;
        const rightId = drawingLine.side === "right" ? drawingLine.startId : targetId;
        
        const nextVal = { ...value };
        // Очищаем другие связи с этим rightId (1 к 1)
        Object.keys(nextVal).forEach(k => {
          if (nextVal[k] === rightId) delete nextVal[k];
        });
        nextVal[leftId] = rightId;
        onChange(nextVal);
      }
    }
    setDrawingLine(null);
  };

  const generateCurve = (x1: number, y1: number, x2: number, y2: number) => {
    const cp1x = x1 + (x2 - x1) / 2;
    const cp2x = x1 + (x2 - x1) / 2;
    return `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp2x} ${y2}, ${x2} ${y2}`;
  };

  if (!isMounted) return <div style={{ height: "300px" }} />;

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        position: "relative",
        width: "100%",
        padding: "20px 0",
        userSelect: "none",
        touchAction: "none", // Важно для тач-устройств
      }}
    >
      {/* SVG СЛОЙ ВЫШЕ ВСЕГО */}
      <svg style={{ 
        position: "absolute", 
        inset: 0, 
        width: "100%", 
        height: "100%", 
        pointerEvents: "none", 
        zIndex: 50 
      }}>
        <defs>
          <filter id="shadow">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.2"/>
          </filter>
        </defs>

        {/* Существующие связи */}
        {Object.entries(value).map(([lId, rId]) => {
          const start = dots[lId + "left"];
          const end = dots[rId + "right"];
          if (!start || !end) return null;
          return (
            <path
              key={`${lId}-${rId}`}
              d={generateCurve(start.x, start.y, end.x, end.y)}
              fill="none"
              stroke="#6366f1"
              strokeWidth="5"
              strokeLinecap="round"
              filter="url(#shadow)"
              style={{ transition: "all 0.3s ease" }}
            />
          );
        })}

        {/* Линия в процессе рисования */}
        {drawingLine && dots[drawingLine.startId + drawingLine.side] && (
          <path
            d={generateCurve(
              dots[drawingLine.startId + drawingLine.side].x,
              dots[drawingLine.startId + drawingLine.side].y,
              drawingLine.x,
              drawingLine.y
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

      <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", position: "relative", zIndex: 10 }}>
        {/* ЛЕВАЯ КОЛОНКА */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "45%" }}>
          {pairs.map((p) => (
            <div key={p.id} className="matching-card" style={{ 
              position: "relative", 
              background: "#fff", 
              border: `2px solid ${value[p.id] ? "#6366f1" : "#e2e8f0"}`,
              borderRadius: "16px",
              padding: "16px",
              display: "flex",
              alignItems: "center",
              minHeight: "80px",
              boxShadow: value[p.id] ? "0 4px 12px rgba(99,102,241,0.1)" : "none"
            }}>
              <div style={{ flex: 1 }}>
                {p.left.text && <div style={{ fontWeight: 600, fontSize: "15px" }}>{p.left.text}</div>}
                <MediaRenderer media={p.left.media} />
              </div>
              <div
                className="matching-dot"
                data-id={p.id}
                data-side="left"
                onPointerDown={(e) => handlePointerDown(e, p.id, "left")}
                style={{
                  width: "24px", height: "24px", borderRadius: "50%",
                  background: value[p.id] ? "#6366f1" : "#fff",
                  border: "4px solid #fff",
                  boxShadow: "0 0 0 2px #e2e8f0",
                  position: "absolute", right: "-12px", cursor: "crosshair", zIndex: 60
                }}
              />
            </div>
          ))}
        </div>

        {/* ПРАВАЯ КОЛОНКА */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "45%" }}>
          {rightItems.map((p) => {
            const isConnected = Object.values(value).includes(p.id);
            return (
              <div key={p.id} className="matching-card" style={{ 
                position: "relative", 
                background: "#fff", 
                border: `2px solid ${isConnected ? "#6366f1" : "#e2e8f0"}`,
                borderRadius: "16px",
                padding: "16px",
                display: "flex",
                alignItems: "center",
                minHeight: "80px",
                boxShadow: isConnected ? "0 4px 12px rgba(99,102,241,0.1)" : "none"
              }}>
                <div
                  className="matching-dot"
                  data-id={p.id}
                  data-side="right"
                  onPointerDown={(e) => handlePointerDown(e, p.id, "right")}
                  style={{
                    width: "24px", height: "24px", borderRadius: "50%",
                    background: isConnected ? "#6366f1" : "#fff",
                    border: "4px solid #fff",
                    boxShadow: "0 0 0 2px #e2e8f0",
                    position: "absolute", left: "-12px", cursor: "crosshair", zIndex: 60
                  }}
                />
                <div style={{ flex: 1 }}>
                  {p.right.text && <div style={{ fontWeight: 600, fontSize: "15px" }}>{p.right.text}</div>}
                  <MediaRenderer media={p.right.media} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .matching-card { transition: all 0.2s ease; }
        .matching-dot { transition: transform 0.2s ease; }
        .matching-dot:hover { transform: scale(1.2); }
      `}</style>
    </div>
  );
}