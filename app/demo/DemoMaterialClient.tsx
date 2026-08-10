"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Props = {
  material: any;
  assignments: any[];
  coverUrl: string;
};

export default function DemoMaterialClient({
  material,
  assignments,
  coverUrl,
}: Props) {
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("demo_completed");
      if (saved) {
        const parsed = JSON.parse(saved);
        setCompletedIds(Object.keys(parsed).filter((id) => parsed[id]));
      }
    } catch (e) {
      console.error("Ошибка считывания прогресса демо:", e);
    }
  }, []);

  const totalCount = assignments.length;
  const completedCount = completedIds.length;
  const progressPct =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#f8fafc",
        color: "#1e293b",
        fontFamily: "var(--font-geist-sans), 'Inter', sans-serif",
        paddingBottom: "60px",
        // Фиксированные CSS-переменные для белой темы
        ["--project-primary" as any]: "#0284c7",
        ["--project-text" as any]: "#1e293b",
        ["--project-card-bg" as any]: "#ffffff",
        ["--glass-border" as any]: "#e2e8f0",
        ["--glass-bg" as any]: "#ffffff",
      }}
    >
      {/* Шапка гостевого просмотра */}
      <header
        style={{
          borderBottom: "1px solid #e2e8f0",
          backgroundColor: "#ffffff",
          padding: "16px 24px",
          marginBottom: "32px",
        }}
      >
        <div
          style={{
            maxWidth: "840px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Link
            href="/login"
            style={{
              fontSize: "14px",
              fontWeight: 800,
              color: "#64748b",
              textDecoration: "none",
            }}
          >
            ← На страницу входа
          </Link>
          <span
            style={{
              backgroundColor: "#e0f2fe",
              color: "#0369a1",
              padding: "4px 12px",
              borderRadius: "9999px",
              fontSize: "12px",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Демо-режим
          </span>
        </div>
      </header>

      <div className="container" style={{ maxWidth: "840px", margin: "0 auto", padding: "0 16px" }}>
        {/* Главная карточка материала */}
        <div
          className="card"
          style={{
            display: "flex",
            gap: "24px",
            marginBottom: "32px",
            flexWrap: "wrap",
            padding: "32px",
            borderRadius: "28px",
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              flexShrink: 0,
              width: "160px",
              height: "160px",
              borderRadius: "20px",
              overflow: "hidden",
              backgroundColor: "#f1f5f9",
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={material.title}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: "14px", color: "#94a3b8", fontWeight: 700 }}>
                DOC
              </span>
            )}
          </div>

          <div
            style={{
              flex: 1,
              minWidth: "250px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <h1
              style={{
                margin: "0 0 12px 0",
                fontSize: "28px",
                fontWeight: 900,
                color: "#0f172a",
                lineHeight: 1.2,
              }}
            >
              {material.title}
            </h1>
            <p
              style={{
                color: "#64748b",
                margin: "0 0 24px 0",
                lineHeight: 1.5,
                fontSize: "15px",
                fontWeight: 500,
              }}
            >
              {material.description ||
                "Ознакомительное демо-задание для проверки возможностей платформы"}
            </p>

            {/* Прогресс-бар */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  flex: 1,
                  height: "8px",
                  backgroundColor: "#f1f5f9",
                  borderRadius: "999px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progressPct}%`,
                    height: "100%",
                    backgroundColor: "#0284c7",
                    transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                    borderRadius: "999px",
                  }}
                />
              </div>
              <span
                style={{
                  fontWeight: 900,
                  fontSize: "16px",
                  color: "#0284c7",
                  minWidth: "44px",
                  textAlign: "right",
                }}
              >
                {progressPct}%
              </span>
            </div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#64748b",
                marginTop: "10px",
              }}
            >
              Выполнено {completedCount} из {totalCount} заданий
            </div>
          </div>
        </div>

        {/* Заголовок списка заданий */}
        <div
          style={{
            marginBottom: "20px",
            fontSize: "14px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 800,
            color: "#64748b",
            paddingLeft: "8px",
          }}
        >
          Задания демо-материала
        </div>

        {/* Список заданий */}
        {assignments.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {assignments.map((a, index) => {
              const isDone = completedIds.includes(a.id);
              const assignTypeLabel =
                a.assignment_type === "intro" ? "ОЗНАКОМИТЕЛЬНОЕ" : "ТЕСТ";
              const isHovered = hoveredId === a.id;

              return (
                <Link
                  key={a.id}
                  href={`/demo?assignmentId=${a.id}`}
                  onMouseEnter={() => setHoveredId(a.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "20px 24px",
                    backgroundColor: "#ffffff",
                    borderRadius: "20px",
                    textDecoration: "none",
                    color: "inherit",
                    border: `1px solid ${
                      isHovered ? "#38bdf8" : "#e2e8f0"
                    }`,
                    transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                    boxShadow: isHovered
                      ? "0 12px 24px -8px rgba(0, 0, 0, 0.08)"
                      : "0 4px 12px -4px rgba(0, 0, 0, 0.03)",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        flexShrink: 0,
                        borderRadius: "14px",
                        backgroundColor: "#f0f9ff",
                        color: "#0284c7",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        fontWeight: 900,
                      }}
                    >
                      TASK
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: "16px",
                          color: "#0f172a",
                        }}
                      >
                        {index + 1}. {a.title || "Задание без названия"}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 800,
                          color: "#64748b",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {assignTypeLabel}
                      </div>
                    </div>
                  </div>

                  {/* Кнопка-статус */}
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "8px 20px",
                      borderRadius: "99px",
                      fontWeight: 800,
                      fontSize: "13px",
                      whiteSpace: "nowrap",
                      transition: "all 0.2s ease",
                      backgroundColor: isDone
                        ? "#dcfce7"
                        : isHovered
                        ? "#0284c7"
                        : "#f1f5f9",
                      color: isDone
                        ? "#166534"
                        : isHovered
                        ? "#ffffff"
                        : "#334155",
                      border: isDone
                        ? "1px solid #bbf7d0"
                        : `1px solid ${isHovered ? "#0284c7" : "#cbd5e1"}`,
                    }}
                  >
                    {isDone ? "Выполнено" : "Начать"}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              backgroundColor: "#ffffff",
              borderRadius: "24px",
              color: "#64748b",
              border: "1px dashed #cbd5e1",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: "16px",
                color: "#0f172a",
              }}
            >
              В демо-материале пока нет заданий
            </div>
            <p style={{ marginTop: "8px", fontSize: "14px" }}>
              Ожидайте, пока администратор заполнит этот раздел.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}