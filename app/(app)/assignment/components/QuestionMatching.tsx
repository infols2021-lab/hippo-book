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

// Точка подключения
type DotNode = { id: string; x: number; y: number; side: "left" | "right" };

export default function QuestionMatching({ question, value = {}, onChange, disabled }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Оригинальные пары (левая колонка стабильна)
  const pairs = Array.isArray(question.pairs) ? question.pairs : [];
  
  // Состояние перемешанной правой колонки
  const [rightItems, setRightItems] = useState<MatchingPair[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // Координаты точек (anchor points) для SVG
  const [dots, setDots] = useState<Record<string, DotNode>>({});
  
  // Состояние активного рисования линии
  const [drawingLine, setDrawingLine] = useState<{ startId: string; x: number; y: number } | null>(null);

  // 1. Инициализация и перемешивание правой колонки только после маунта (чтобы избежать Hydration error)
  useEffect(() => {
    const shuffled = [...pairs].sort(() => Math.random() - 0.5);
    setRightItems(shuffled);
    setIsMounted(true);
  }, [pairs]);

  // 2. Функция для обновления координат всех точек
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
        // Координаты центра точки относительно контейнера
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top + rect.height / 2,
      };
    });

    setDots(newDots);
  }, []);

  // 3. Отслеживаем ресайз и скролл для пересчета точек
  useEffect(() => {
    if (!isMounted) return;
    
    // Небольшая задержка, чтобы DOM успел отрендерить медиа (картинки могут изменить высоту)
    const timeout = setTimeout(updateDotPositions, 100);
    window.addEventListener("resize", updateDotPositions);
    
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", updateDotPositions);
    };
  }, [isMounted, updateDotPositions]);

  // 4. Логика рисования (Pointer Events)
  const handlePointerDown = (e: React.PointerEvent, id: string, side: "left" | "right") => {
    if (disabled) return;
    e.preventDefault(); // Предотвращаем скролл на телефонах во время рисования
    
    // Удаляем старую связь, если точка уже подключена
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

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
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

    // Находим элемент под курсором в момент отпускания
    const targetEl = document.elementFromPoint(e.clientX, e.clientY)?.closest(".matching-dot") as HTMLElement;
    
    if (targetEl) {
      const endId = targetEl.dataset.id;
      const endSide = targetEl.dataset.side;
      
      const startDot = dots[drawingLine.startId];
      
      // Проверяем, что соединяем левую с правой (а не левую с левой)
      if (startDot && endId && endSide && startDot.side !== endSide) {
        const leftId = startDot.side === "left" ? startDot.id : endId;
        const rightId = startDot.side === "right" ? startDot.id : endId;
        
        // Удаляем любые другие связи с этой правой точкой (1 к 1)
        const nextVal = { ...value };
        Object.keys(nextVal).forEach(key => {
          if (nextVal[key] === rightId) delete nextVal[key];
        });
        
        nextVal[leftId] = rightId;
        onChange(nextVal);
      }
    }

    setDrawingLine(null);
  };

  // Построение плавной кривой Безье между двумя точками
  const generateBezierCurve = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.abs(x2 - x1);
    const offset = Math.max(dx * 0.4, 30); // Изгиб зависит от расстояния
    return `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`;
  };

  if (!isMounted) return <div style={{ minHeight: "200px" }} />;

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        position: "relative",
        width: "100%",
        padding: "10px 0",
        userSelect: "none",
        touchAction: drawingLine ? "none" : "auto", // Блокируем скролл только при рисовании
      }}
    >
      {/* Слой SVG для линий */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        {/* Отрисовка установленных связей */}
        {Object.entries(value).map(([leftId, rightId]) => {
          const dotA = dots[leftId];
          const dotB = dots[rightId];
          if (!dotA || !dotB) return null;

          return (
            <path
              key={`${leftId}-${rightId}`}
              d={generateBezierCurve(dotA.x, dotA.y, dotB.x, dotB.y)}
              fill="none"
              stroke={disabled ? "#a8c9ff" : "#007bff"}
              strokeWidth="4"
              strokeLinecap="round"
              className="matching-line-animate"
              style={{ transition: "stroke 0.3s ease" }}
            />
          );
        })}

        {/* Отрисовка активной (рисуемой) линии */}
        {drawingLine && dots[drawingLine.startId] && (
          <path
            d={generateBezierCurve(
              dots[drawingLine.startId].side === "left" ? dots[drawingLine.startId].x : drawingLine.x,
              dots[drawingLine.startId].side === "left" ? dots[drawingLine.startId].y : drawingLine.y,
              dots[drawingLine.startId].side === "right" ? dots[drawingLine.startId].x : drawingLine.x,
              dots[drawingLine.startId].side === "right" ? dots[drawingLine.startId].y : drawingLine.y
            )}
            fill="none"
            stroke="#007bff"
            strokeWidth="4"
            strokeDasharray="8 8"
            strokeLinecap="round"
          />
        )}
      </svg>

      {/* Колонки */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", position: "relative", zIndex: 5 }}>
        
        {/* ЛЕВАЯ КОЛОНКА */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1, maxWidth: "45%" }}>
          {pairs.map((p) => (
            <div key={`left-${p.id}`} style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <div style={{
                flex: 1, padding: "16px", background: "#fff", borderRadius: "16px",
                border: value[p.id] ? "2px solid #007bff" : "2px solid rgba(0,0,0,0.08)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.04)"
              }}>
                {p.left.text && <div style={{ fontSize: "15px", fontWeight: 500, marginBottom: "8px" }}>{p.left.text}</div>}
                <MediaRenderer media={p.left.media} />
              </div>
              
              {/* Левая точка подключения */}
              <div
                className="matching-dot"
                data-id={p.id}
                data-side="left"
                onPointerDown={(e) => handlePointerDown(e, p.id, "left")}
                style={{
                  width: "24px", height: "24px", borderRadius: "50%", background: value[p.id] ? "#007bff" : "#fff",
                  border: value[p.id] ? "4px solid #fff" : "4px solid #d1d5db", boxShadow: "0 0 0 1px rgba(0,0,0,0.1)",
                  position: "absolute", right: "-12px", cursor: disabled ? "default" : "pointer",
                  transition: "all 0.2s ease", zIndex: 20
                }}
              />
            </div>
          ))}
        </div>

        {/* ОПЦИОНАЛЬНОЕ ЦЕНТРАЛЬНОЕ МЕДИА */}
        {question.centerImage && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
            <div style={{ padding: "12px", background: "rgba(255,255,255,0.8)", backdropFilter: "blur(10px)", borderRadius: "24px", border: "1px solid rgba(0,0,0,0.05)" }}>
              <MediaRenderer media={[question.centerImage]} />
            </div>
          </div>
        )}

        {/* ПРАВАЯ КОЛОНКА */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1, maxWidth: "45%" }}>
          {rightItems.map((p) => {
            const isConnected = Object.values(value).includes(p.id);
            return (
              <div key={`right-${p.id}`} style={{ position: "relative", display: "flex", alignItems: "center" }}>
                {/* Правая точка подключения */}
                <div
                  className="matching-dot"
                  data-id={p.id}
                  data-side="right"
                  onPointerDown={(e) => handlePointerDown(e, p.id, "right")}
                  style={{
                    width: "24px", height: "24px", borderRadius: "50%", background: isConnected ? "#007bff" : "#fff",
                    border: isConnected ? "4px solid #fff" : "4px solid #d1d5db", boxShadow: "0 0 0 1px rgba(0,0,0,0.1)",
                    position: "absolute", left: "-12px", cursor: disabled ? "default" : "pointer",
                    transition: "all 0.2s ease", zIndex: 20
                  }}
                />
                
                <div style={{
                  flex: 1, padding: "16px", background: "#fff", borderRadius: "16px",
                  border: isConnected ? "2px solid #007bff" : "2px solid rgba(0,0,0,0.08)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.04)"
                }}>
                  {p.right.text && <div style={{ fontSize: "15px", fontWeight: 500, marginBottom: "8px" }}>{p.right.text}</div>}
                  <MediaRenderer media={p.right.media} />
                </div>
              </div>
            );
          })}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes dash {
          to { stroke-dashoffset: -16; }
        }
        .matching-line-animate {
          animation: dash 1s linear infinite;
        }
      `}} />
    </div>
  );
}