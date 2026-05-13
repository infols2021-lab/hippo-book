"use client";

import React from "react";
import type { ReviewItem } from "../lib/types";
import MediaRenderer from "./MediaRenderer";
import { ImageMapRenderer } from "./QuestionImageMap";

// Форматирование баллов
function fmtPoints(x: number) {
  if (x % 1 === 0) return x.toString();
  return x.toFixed(2);
}

// Конфигурация статусов
function getStatusConfig(item: ReviewItem) {
  if (item.isSkipped)
    return { key: "skipped", label: "Пропущен", color: "#94a3b8", bg: "#f8fafc" };
  if (item.isCorrect)
    return { key: "correct", label: "Правильно", color: "#10b981", bg: "#f0fdf4" };
  if (item.pointsEarned > 0)
    return { key: "partial", label: "Частично", color: "#f59e0b", bg: "#fffbeb" };
  return { key: "incorrect", label: "Неправильно", color: "#ef4444", bg: "#fef2f2" };
}

/** Маленькая карточка для одного поля ввода (fill/sentence) */
function FillRow({
  index,
  userAnswer,
  correctAnswer,
  isCorrect,
}: {
  index: number;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "48px 1fr 1fr",
        gap: "12px",
        alignItems: "flex-start",
        padding: "12px 16px",
        borderBottom: "1px solid rgba(0,0,0,0.04)",
        background: isCorrect ? "rgba(16, 185, 129, 0.03)" : "rgba(239, 68, 68, 0.03)",
      }}
    >
      <div
        style={{
          fontWeight: 800,
          color: isCorrect ? "#10b981" : "#cbd5e1",
          fontSize: "14px",
          lineHeight: "1.4",
          paddingTop: "2px",
        }}
      >
        {index + 1}
      </div>
      <div
        style={{
          fontWeight: 700,
          color: isCorrect ? "#1e293b" : "#ef4444",
          wordBreak: "break-word",
          lineHeight: "1.5",
          fontSize: "14px",
        }}
      >
        {userAnswer || "—"}
      </div>
      <div
        style={{
          fontWeight: 700,
          color: "#10b981",
          wordBreak: "break-word",
          lineHeight: "1.5",
          fontSize: "14px",
        }}
      >
        {correctAnswer}
      </div>
    </div>
  );
}

export default function ReviewPanel({ items }: { items: ReviewItem[] }) {
  function renderItem(r: ReviewItem, idx?: number) {
    const status = getStatusConfig(r);
    const scorePercent =
      r.pointsTotal > 0 ? (r.pointsEarned / r.pointsTotal) * 100 : 0;
    const itemMedia = r.media;

    // Для imagemap готовим правильные и пользовательские соответствия
    let correctMatchesMap: Record<string, string> = {};
    let userMatchesMap: Record<string, string> = {};
    let answerLabelsMap: Record<string, string> = {};
    let pointLabelsMap: Record<string, string> = {};
    let imageUrl = "";
    let points: any[] = [];
    let answers: any[] = [];

    if (r.type === "imagemap") {
      correctMatchesMap = (r as any).correctMatches || {};
      userMatchesMap = (r as any).userMatches || {};
      answerLabelsMap = (r as any).answerLabels || {};
      pointLabelsMap = (r as any).pointLabels || {};
      imageUrl = (r as any).imageUrl || "";
      points = (r as any).points || [];
      answers = (r as any).answers || [];

      // Отладка – если нет точек или ответов, выводим предупреждение
      if (imageUrl && (points.length === 0 || answers.length === 0)) {
        console.warn("[ReviewPanel] Imagemap data incomplete", { points, answers });
      }
    }

    return (
      <div
        key={idx}
        className="review-card"
        style={{
          background: "#ffffff",
          borderRadius: "24px",
          padding: "24px",
          marginBottom: "20px",
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.02)",
          position: "relative",
        }}
      >
        {/* Цветная полоса слева */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "5px",
            background: status.color,
            borderRadius: "24px 0 0 24px",
          }}
        />

        {/* Заголовок */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            marginBottom: "18px",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: status.color,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {idx !== undefined ? `Вопрос ${idx + 1}` : "Подвопрос"}
              </span>
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: "8px",
                  background: status.bg,
                  color: status.color,
                  fontSize: "12px",
                  fontWeight: 800,
                }}
              >
                {status.label}
              </span>
            </div>
            <h4
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "#1e293b",
                margin: 0,
                lineHeight: 1.35,
                whiteSpace: "pre-wrap",
              }}
            >
              {r.questionText}
            </h4>
          </div>

          {/* Баллы */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: "16px", fontWeight: 900, color: "#1e293b" }}>
              <span style={{ color: status.color }}>{fmtPoints(r.pointsEarned)}</span>
              <span style={{ opacity: 0.3, fontWeight: 500 }}>
                {" "}
                / {r.pointsTotal}
              </span>
            </div>
            <div
              style={{
                width: "80px",
                height: "5px",
                background: "rgba(0,0,0,0.05)",
                borderRadius: "10px",
                marginTop: "8px",
                overflow: "hidden",
                marginLeft: "auto",
              }}
            >
              <div
                style={{
                  width: `${scorePercent}%`,
                  height: "100%",
                  background: status.color,
                  borderRadius: "10px",
                  transition: "width 0.6s ease",
                }}
              />
            </div>
          </div>
        </div>

        {/* Медиа (если есть) */}
        {itemMedia && itemMedia.length > 0 && (
          <div style={{ marginBottom: "20px", borderRadius: "14px", overflow: "hidden" }}>
            <MediaRenderer media={itemMedia} />
          </div>
        )}

        {/* ===== ТЕСТ ===== */}
        {r.type === "test" && (
          <div
            style={{
              background: "#f8fafc",
              borderRadius: "16px",
              padding: "16px",
              minWidth: 0,
            }}
          >
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>
                ВАШ ОТВЕТ
              </div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: r.isCorrect ? "#10b981" : "#ef4444",
                  wordBreak: "break-word",
                }}
              >
                {Array.isArray(r.userLabel) ? r.userLabel.join(", ") : r.userLabel || "—"}
              </div>
            </div>
            {!r.isCorrect && (
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#64748b", marginBottom: "4px" }}>
                  ПРАВИЛЬНЫЙ ОТВЕТ
                </div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#10b981", wordBreak: "break-word" }}>
                  {Array.isArray(r.correctLabel) ? r.correctLabel.join(", ") : r.correctLabel}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== FILL / SENTENCE ===== */}
        {(r.type === "fill" || r.type === "sentence") && (
          <div
            style={{
              border: "1px solid rgba(0,0,0,0.06)",
              borderRadius: "18px",
              overflow: "hidden",
              background: "#ffffff",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "48px 1fr 1fr",
                gap: "12px",
                padding: "10px 16px",
                background: "#f8fafc",
                borderBottom: "1px solid rgba(0,0,0,0.06)",
                fontSize: "12px",
                fontWeight: 800,
                textTransform: "uppercase",
                color: "#64748b",
                letterSpacing: "0.3px",
              }}
            >
              <div>№</div>
              <div>Ваш ответ</div>
              <div>Верный ответ</div>
            </div>
            {(r.parts ?? []).map((p, pI) => (
              <FillRow
                key={pI}
                index={pI}
                userAnswer={p.user || ""}
                correctAnswer={p.correct}
                isCorrect={p.isCorrect}
              />
            ))}
          </div>
        )}

        {/* ===== MATCHING ===== */}
        {r.type === "matching" && (
          <div
            style={{
              background: "#f8fafc",
              borderRadius: "16px",
              padding: "16px",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#64748b", marginBottom: "12px" }}>
              РЕЗУЛЬТАТЫ СОПОСТАВЛЕНИЯ
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {Object.entries(r.correctMatches).map(([leftId, correctRightId], mI) => {
                const userRightId = r.userMatches?.[leftId];
                const isCorrect = userRightId === correctRightId;
                const rightText = r.rightLabels?.[correctRightId] || `Элемент ${correctRightId}`;
                const userRightText = userRightId
                  ? r.rightLabels?.[userRightId] || `Элемент ${userRightId}`
                  : "—";
                return (
                  <div
                    key={mI}
                    style={{
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: `1px solid ${isCorrect ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                      background: isCorrect ? "#f0fdf4" : "#fef2f2",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div style={{ fontSize: "13px", fontWeight: 700, color: isCorrect ? "#166534" : "#991b1b" }}>
                      Пара {mI + 1}: {isCorrect ? "✅ Верно" : "❌ Ошибка"}
                    </div>
                    <div style={{ fontSize: "14px", color: "#1e293b" }}>
                      Ваш выбор:{" "}
                      <span style={{ fontWeight: 700 }}>{userRightText}</span>
                    </div>
                    {!isCorrect && (
                      <div style={{ fontSize: "14px", color: "#10b981" }}>
                        Правильно:{" "}
                        <span style={{ fontWeight: 700 }}>{rightText}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== IMAGEMAP с визуализацией (исправлено) ===== */}
        {r.type === "imagemap" && imageUrl && (
          <div
            style={{
              background: "#f8fafc",
              borderRadius: "16px",
              padding: "16px",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#64748b", marginBottom: "16px" }}>
              ВИЗУАЛИЗАЦИЯ КАРТЫ
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              {/* Ваш результат */}
              <div>
                <div style={{ fontWeight: 800, marginBottom: "8px", color: "#1e293b" }}>Ваши ответы</div>
                <ImageMapRenderer
                  imageUrl={imageUrl}
                  points={points}
                  answers={answers}
                  matches={userMatchesMap}
                  pointColorConnected="#ef4444"
                  pointColorUnconnected="#94a3b8"
                  pointSize={20}
                  showLabels
                />
                <div style={{ fontSize: "12px", marginTop: "8px", color: "#64748b", textAlign: "center" }}>
                  🟢 Зелёные точки — правильные связи (если они совпадают с правильными),<br />
                  🔴 Красные — неправильные (или отсутствие связи)
                </div>
              </div>

              {/* Правильные ответы */}
              <div>
                <div style={{ fontWeight: 800, marginBottom: "8px", color: "#1e293b" }}>Правильные ответы</div>
                <ImageMapRenderer
                  imageUrl={imageUrl}
                  points={points}
                  answers={answers}
                  matches={correctMatchesMap}
                  pointColorConnected="#10b981"
                  pointColorUnconnected="#94a3b8"
                  pointSize={20}
                  showLabels
                />
              </div>
            </div>

            {/* Текстовый список связей (как было) */}
            <div style={{ marginTop: "20px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#64748b", marginBottom: "12px" }}>
                РЕЗУЛЬТАТЫ КАРТЫ ИЗОБРАЖЕНИЯ
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {Object.entries(correctMatchesMap).map(([answerId, correctPointId], mI) => {
                  const userPointId = userMatchesMap[answerId];
                  const isCorrect = userPointId === correctPointId;
                  const answerLabel = answerLabelsMap[answerId] || `Ответ ${answerId.slice(0,4)}`;
                  const pointLabel = pointLabelsMap[correctPointId] || `Точка ${correctPointId.slice(0,4)}`;
                  return (
                    <div
                      key={mI}
                      style={{
                        padding: "12px 16px",
                        borderRadius: "12px",
                        border: `1px solid ${isCorrect ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                        background: isCorrect ? "#f0fdf4" : "#fef2f2",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      <div style={{ fontSize: "13px", fontWeight: 700, color: isCorrect ? "#166534" : "#991b1b" }}>
                        Связь {mI + 1}: {isCorrect ? "✅ Верно" : "❌ Ошибка"}
                      </div>
                      <div style={{ fontSize: "14px", color: "#1e293b" }}>
                        {answerLabel} → указана точка:{" "}
                        <span style={{ fontWeight: 700 }}>{pointLabelsMap[userPointId] || "—"}</span>
                      </div>
                      {!isCorrect && (
                        <div style={{ fontSize: "14px", color: "#10b981" }}>
                          Правильно: {answerLabel} → {pointLabel}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===== CROSSWORD ===== */}
        {r.type === "crossword" && (
          <div
            style={{
              background: "#f8fafc",
              borderRadius: "16px",
              padding: "16px",
            }}
          >
            {r.note && (
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#334155", marginBottom: "12px" }}>
                {r.note}
              </div>
            )}

            {r.crosswordStats && (
              <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
                <span className="badge-pill">
                  Заполнено клеток: <b>{r.crosswordStats.filled}/{r.crosswordStats.total}</b>
                </span>
                <span className="badge-pill">
                  Точность заполнения: <b>{r.crosswordStats.percent}%</b>
                </span>
              </div>
            )}

            {r.wordReview && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {r.wordReview.correct.length > 0 && (
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#166534", marginBottom: "8px", textTransform: "uppercase" }}>
                      Правильные слова ({r.wordReview.correct.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {r.wordReview.correct.map((w, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "8px 12px",
                            background: "#f0fdf4",
                            border: "1px solid rgba(16,185,129,0.2)",
                            borderRadius: "10px",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            fontSize: "14px",
                          }}
                        >
                          <span style={{ fontWeight: 800, color: "#10b981", minWidth: "28px" }}>✓</span>
                          <span style={{ fontWeight: 700, color: "#1e293b", minWidth: "80px" }}>
                            №{w.number} {w.direction === "across" ? "→" : "↓"}
                          </span>
                          <span style={{ fontWeight: 700, color: "#10b981", wordBreak: "break-word" }}>
                            {w.word}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {r.wordReview.wrong.length > 0 && (
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#991b1b", marginBottom: "8px", textTransform: "uppercase" }}>
                      Неправильные слова ({r.wordReview.wrong.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {r.wordReview.wrong.map((w, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "10px 12px",
                            background: "#fef2f2",
                            border: "1px solid rgba(239,68,68,0.2)",
                            borderRadius: "10px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            fontSize: "14px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span style={{ fontWeight: 800, color: "#ef4444", minWidth: "28px" }}>✗</span>
                            <span style={{ fontWeight: 700, color: "#1e293b", minWidth: "80px" }}>
                              №{w.number} {w.direction === "across" ? "→" : "↓"}
                            </span>
                            <span style={{ fontWeight: 700, color: "#ef4444", wordBreak: "break-word" }}>
                              Ваш ответ: {w.user}
                            </span>
                          </div>
                          <div style={{ marginLeft: "40px", color: "#166534", fontWeight: 700 }}>
                            Правильно: {w.correct}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== COMPLEX / READING ===== */}
        {(r.type === "complex" || r.type === "reading") && r.subReviews && (
          <div style={{ marginTop: "16px" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 800,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "16px",
                textAlign: "center",
              }}
            >
              {r.type === "complex" ? "Вложенные задания" : "Результаты по подвопросам"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {r.subReviews.map((sr, srI) => (
                <div key={srI} style={{ paddingLeft: "12px", borderLeft: "3px solid rgba(99,102,241,0.2)" }}>
                  {renderItem(sr, srI)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== OTHER ===== */}
        {r.type === "other" && r.note && (
          <div
            style={{
              background: "#f8fafc",
              borderRadius: "16px",
              padding: "16px",
              fontStyle: "italic",
              color: "#64748b",
            }}
          >
            {r.note}
          </div>
        )}
      </div>
    );
  }

  return (
    <section style={{ marginTop: "40px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            width: "52px",
            height: "52px",
            background: "#6366f1",
            borderRadius: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 20px rgba(99,102,241,0.25)",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
        <div>
          <h3 style={{ fontSize: "24px", fontWeight: 800, margin: 0, color: "#1e293b" }}>
            Разбор прохождения
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#94a3b8", fontWeight: 600 }}>
            Изучите свои ошибки, чтобы улучшить результат в следующий раз
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((r, idx) => renderItem(r, idx))}
      </div>

      <style jsx>{`
        .badge-pill {
          font-size: 12px;
          font-weight: 700;
          background: #ffffff;
          padding: 6px 12px;
          border-radius: 12px;
          border: 1px solid rgba(0, 0, 0, 0.04);
          color: #475569;
        }
        @media (max-width: 640px) {
          .review-card {
            padding: 16px;
            margin-bottom: 16px;
          }
        }
      `}</style>
    </section>
  );
}