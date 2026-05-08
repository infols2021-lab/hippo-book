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
  const [drawingLine, setDrawingLine] = useState<{ startId: string; x: number; y: number } | null>(null);

  // 1. Перемешивание правой колонки один раз при загрузке
  useEffect(() => {
    const shuffled = [...pairs].sort(() => Math.random() - 0.5);
    setRightItems(shuffled);
    setIsMounted(true);
  }, [pairs]);

  // 2. Функция точного расчета координат точек
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
      newDots[id] = {
        id,
        side,
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top + rect.height / 2,
      };
    });

    setDots(newDots);
  }, []);

  // 3. Следим за размерами через ResizeObserver (чтобы линии не ехали при загрузке картинок)
  useEffect(() => {
    if (!isMounted || !containerRef.current) return;

    const observer = new ResizeObserver(() => {
      updateDotPositions();
    });

    observer.observe(containerRef.current);
    // Также наблюдаем за всеми карточками внутри
    containerRef.current.querySelectorAll(".matching-card").forEach(card => {
      observer.observe(card);
    });

    window.addEventListener("scroll", updateDotPositions);
    
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateDotPositions);
    };
  }, [isMounted, updateDotPositions]);

  // 4. Pointer Events
  const handlePointerDown = (e: React.PointerEvent, id: string, side: "left" | "right") => {
    if (disabled) return;
    
    // Сброс старой связи
    if (side === "left" && value[id]) {
      const nextVal = { ...value };
      delete nextVal[id];
      onChange(nextVal);
    } else if (side === "right") {
      const leftKey = Object.keys(value).find(key => value[key] === id);
      if (leftKey) {
        const nextVal = { ...value };
        delete nextVal[leftKey];
        onChange(nextVal);
      }
    }

    const rect = containerRef.current!.getBoundingClientRect();
    setDrawingLine({
      startId: id,
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
      const endId = targetEl.dataset.id;
      const endSide = targetEl.dataset.side;
      const startDot = dots[drawingLine.startId];
      
      if (startDot && endId && endSide && startDot.side !== endSide) {
        const leftId = startDot.side === "left" ? startDot.id : endId;
        const rightId = startDot.side === "right" ? startDot.id : endId;
        
        const nextVal = { ...value };
        // Правило 1:1
        Object.keys(nextVal).forEach(key => {
          if (nextVal[key] === rightId) delete nextVal[key];
        });
        
        nextVal[leftId] = rightId;
        onChange(nextVal);
      }
    }

    setDrawingLine(null);
  };

  const generateCurve = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.abs(x2 - x1);
    const midX = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  };

  if (!isMounted) return <div style={{ height: "300px", background: "rgba(0,0,0,0.02)", borderRadius: "20px" }} />;

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        position: "relative",
        width: "100%",
        minHeight: "400px",
        padding: "20px 0",
        userSelect: "none",
        touchAction: drawingLine ? "none" : "auto",
      }}
    >
      {/* Слой SVG */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}>
        {Object.entries(value).map(([leftId, rightId]) => {
          const a = dots[leftId];
          const b = dots[rightId];
          if (!a || !b) return null;
          return (
            <path
              key={`${leftId}-${rightId}`}
              d={generateCurve(a.x, a.y, b.x, b.y)}
              fill="none"
              stroke="#007bff"
              strokeWidth="5"
              strokeLinecap="round"
              className="line-dash"
            />
          );
        })}

        {drawingLine && dots[drawingLine.startId] && (
          <path
            d={generateCurve(
              dots[drawingLine.startId].side === "left" ? dots[drawingLine.startId].x : drawingLine.x,
              dots[drawingLine.startId].side === "left" ? dots[drawingLine.startId].y : drawingLine.y,
              dots[drawingLine.startId].side === "right" ? dots[drawingLine.startId].x : drawingLine.x,
              dots[drawingLine.startId].side === "right" ? dots[drawingLine.startId].y : drawingLine.y
            )}
            fill="none"
            stroke="rgba(0,123,255,0.5)"
            strokeWidth="4"
            strokeDasharray="8 8"
            strokeLinecap="round"
          />
        )}
      </svg>

      {/* Колонки */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: "40px", position: "relative", zIndex: 2 }}>
        
        {/* ЛЕВАЯ КОЛОНКА */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "42%" }}>
          {pairs.map((p) => (
            <div key={`l-${p.id}`} className="matching-card-wrapper" style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <div className="matching-card" style={{
                flex: 1, padding: "15px", background: "#fff", borderRadius: "20px",
                border: value[p.id] ? "2px solid #007bff" : "2px solid #e2e8f0",
                boxShadow: "0 4px 12px rgba(0,0,0,0.03)", minHeight: "80px"
              }}>
                {p.left.text && <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "8px" }}>{p.left.text}</div>}
                <MediaRenderer media={p.left.media} />
              </div>
              <div
                className="matching-dot"
                data-id={p.id} data-side="left"
                onPointerDown={(e) => handlePointerDown(e, p.id, "left")}
                style={{
                  width: "28px", height: "28px", borderRadius: "50%", background: value[p.id] ? "#007bff" : "#fff",
                  border: value[p.id] ? "5px solid #fff" : "5px solid #cbd5e1", 
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  position: "absolute", right: "-14px", cursor: "pointer", zIndex: 10
                }}
              />
            </div>
          ))}
        </div>

        {/* ЦЕНТР (ОПЦИОНАЛЬНО) */}
        {question.centerImage && (
          <div style={{ display: "flex", alignItems: "center", width: "10%" }}>
            <div style={{ padding: "8px", background: "#fff", borderRadius: "15px", boxShadow: "0 5px 15px rgba(0,0,0,0.05)" }}>
              <MediaRenderer media={[question.centerImage]} />
            </div>
          </div>
        )}

        {/* ПРАВАЯ КОЛОНКА */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "42%" }}>
          {rightItems.map((p) => {
            const isConnected = Object.values(value).includes(p.id);
            return (
              <div key={`r-${p.id}`} className="matching-card-wrapper" style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <div
                  className="matching-dot"
                  data-id={p.id} data-side="right"
                  onPointerDown={(e) => handlePointerDown(e, p.id, "right")}
                  style={{
                    width: "28px", height: "28px", borderRadius: "50%", background: isConnected ? "#007bff" : "#fff",
                    border: isConnected ? "5px solid #fff" : "5px solid #cbd5e1",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    position: "absolute", left: "-14px", cursor: "pointer", zIndex: 10
                  }}
                />
                <div className="matching-card" style={{
                  flex: 1, padding: "15px", background: "#fff", borderRadius: "20px",
                  border: isConnected ? "2px solid #007bff" : "2px solid #e2e8f0",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.03)", minHeight: "80px"
                }}>
                  {p.right.text && <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "8px" }}>{p.right.text}</div>}
                  <MediaRenderer media={p.right.media} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes lineDash { to { stroke-dashoffset: -20; } }
        .line-dash { stroke-dasharray: 10 5; animation: lineDash 1.5s linear infinite; }
        .matching-card { transition: all 0.3s ease; }
        .matching-dot:hover { transform: scale(1.2); }
      `}} />
    </div>
  );
}