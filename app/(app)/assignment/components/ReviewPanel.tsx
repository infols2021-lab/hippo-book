"use client";

import React from "react";
import type { ReviewItem, QuestionAny, QuestionTest, TestOption } from "../lib/types";
import MediaRenderer from "./MediaRenderer";
import { getImageUrl } from "../lib/image";

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

/** Отображает все варианты тестового подвопроса (для reading/complex) */
function TestOptionsReview({
  question,
  userAnswer,
  isMultiple,
}: {
  question: QuestionTest;
  userAnswer: number | number[];
  isMultiple: boolean;
}) {
  const options = (question.options || []) as TestOption[];
  const correctIndices = Array.isArray(question.correct)
    ? question.correct
    : typeof question.correct === "number"
      ? [question.correct]
      : [];

  const selectedIndices = Array.isArray(userAnswer)
    ? userAnswer
    : typeof userAnswer === "number" || typeof userAnswer === "string"
      ? [Number(userAnswer)]
      : [];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "12px",
        marginTop: "12px",
      }}
    >
      {options.map((opt, idx) => {
        const isSelected = selectedIndices.includes(idx);
        const isCorrectOption = correctIndices.includes(idx);
        let borderColor = "#e2e8f0";
        let bgColor = "#fff";
        if (isSelected && isCorrectOption) {
          borderColor = "#22c55e";
          bgColor = "#f0fdf4";
        } else if (isSelected && !isCorrectOption) {
          borderColor = "#ef4444";
          bgColor = "#fef2f2";
        } else if (!isSelected && isCorrectOption) {
          borderColor = "#22c55e";
          bgColor = "#f0fdf4";
        }
        return (
          <div
            key={opt.id || idx}
            style={{
              border: `2px solid ${borderColor}`,
              borderRadius: "16px",
              padding: "12px",
              background: bgColor,
              transition: "all 0.2s",
            }}
          >
            {opt.media && opt.media.length > 0 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: "8px",
                }}
              >
                <img
                  src={getImageUrl(opt.media[0].url)}
                  alt=""
                  style={{
                    maxWidth: "120px",
                    maxHeight: "120px",
                    objectFit: "contain",
                    borderRadius: "8px",
                  }}
                />
              </div>
            )}
            {opt.text && (
              <div
                style={{
                  fontWeight: 600,
                  textAlign: "center",
                  color: "#1e293b",
                }}
              >
                {opt.text}
              </div>
            )}
            <div
              style={{
                fontSize: "12px",
                marginTop: "8px",
                textAlign: "center",
                fontWeight: 700,
                color: isSelected ? (isCorrectOption ? "#15803d" : "#b91c1c") : "#64748b",
              }}
            >
              {isSelected ? (isCorrectOption ? "✅ Верно" : "❌ Неверно") : isCorrectOption ? "✔️ Правильный ответ" : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ReviewPanel({ items, questions }: { items: ReviewItem[]; questions: QuestionAny[] }) {
  function renderItem(r: ReviewItem, idx: number, parentType?: string) {
    const status = getStatusConfig(r);
    const scorePercent = r.pointsTotal > 0 ? (r.pointsEarned / r.pointsTotal) * 100 : 0;
    const itemMedia = r.media;

    // Для обычного test (не подвопроса) используем старый краткий разбор
    if (r.type === "test" && parentType !== "reading" && parentType !== "complex") {
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "18px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: 800, color: status.color, textTransform: "uppercase" }}>
                  {parentType === "reading" ? "Подвопрос" : `Вопрос ${idx + 1}`}
                </span>
                <span style={{ padding: "3px 10px", borderRadius: "8px", background: status.bg, color: status.color, fontSize: "12px", fontWeight: 800 }}>
                  {status.label}
                </span>
              </div>
              <h4 style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b", margin: 0 }}>{r.questionText}</h4>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: "16px", fontWeight: 900 }}>
                <span style={{ color: status.color }}>{fmtPoints(r.pointsEarned)}</span>
                <span style={{ opacity: 0.3 }}> / {r.pointsTotal}</span>
              </div>
              <div style={{ width: "80px", height: "5px", background: "rgba(0,0,0,0.05)", borderRadius: "10px", marginTop: "8px", overflow: "hidden" }}>
                <div style={{ width: `${scorePercent}%`, height: "100%", background: status.color }} />
              </div>
            </div>
          </div>
          {itemMedia && itemMedia.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <MediaRenderer media={itemMedia} />
            </div>
          )}
          <div style={{ background: "#f8fafc", borderRadius: "16px", padding: "16px" }}>
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#64748b" }}>ВАШ ОТВЕТ</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: r.isCorrect ? "#10b981" : "#ef4444" }}>
                {Array.isArray(r.userLabel) ? r.userLabel.join(", ") : r.userLabel || "—"}
              </div>
            </div>
            {!r.isCorrect && (
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#64748b" }}>ПРАВИЛЬНЫЙ ОТВЕТ</div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#10b981" }}>
                  {Array.isArray(r.correctLabel) ? r.correctLabel.join(", ") : r.correctLabel}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Основная карточка для всех типов (включая test-подвопросы, которые будут обработаны отдельно ниже)
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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "18px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: 800, color: status.color, textTransform: "uppercase" }}>
                {parentType === "reading" ? "Подвопрос" : `Вопрос ${idx + 1}`}
              </span>
              <span style={{ padding: "3px 10px", borderRadius: "8px", background: status.bg, color: status.color, fontSize: "12px", fontWeight: 800 }}>
                {status.label}
              </span>
            </div>
            <h4 style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b", margin: 0 }}>{r.questionText}</h4>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: "16px", fontWeight: 900 }}>
              <span style={{ color: status.color }}>{fmtPoints(r.pointsEarned)}</span>
              <span style={{ opacity: 0.3 }}> / {r.pointsTotal}</span>
            </div>
            <div style={{ width: "80px", height: "5px", background: "rgba(0,0,0,0.05)", borderRadius: "10px", marginTop: "8px", overflow: "hidden" }}>
              <div style={{ width: `${scorePercent}%`, height: "100%", background: status.color }} />
            </div>
          </div>
        </div>

        {itemMedia && itemMedia.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <MediaRenderer media={itemMedia} />
          </div>
        )}

        {/* ===== ТЕСТ (подвопрос внутри reading/complex) ===== */}
        {r.type === "test" && (parentType === "reading" || parentType === "complex") && (
          (() => {
            const originalQuestion = questions?.[idx] as QuestionTest;
            if (!originalQuestion || originalQuestion.type !== "test") return null;
            const userAnswerVal = (r as any).userLabel;
            const isMultiple = originalQuestion.multiple || false;
            let userIndices: number[] = [];
            if (isMultiple && Array.isArray(userAnswerVal)) {
              const opts = originalQuestion.options as TestOption[];
              userIndices = (userAnswerVal as string[]).map(text => opts.findIndex(opt => opt.text === text)).filter(i => i !== -1);
            } else if (!isMultiple && typeof userAnswerVal === "string") {
              const opts = originalQuestion.options as TestOption[];
              const idxFound = opts.findIndex(opt => opt.text === userAnswerVal);
              if (idxFound !== -1) userIndices = [idxFound];
            }
            return <TestOptionsReview question={originalQuestion} userAnswer={userIndices} isMultiple={isMultiple} />;
          })()
        )}

        {/* ===== ТЕСТ (обычный, не подвопрос) – уже обработан выше, сюда не попадает ===== */}

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

        {/* ===== IMAGEMAP ===== */}
        {r.type === "imagemap" && (
          <div
            style={{
              background: "#f8fafc",
              borderRadius: "16px",
              padding: "16px",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#64748b", marginBottom: "12px" }}>
              РЕЗУЛЬТАТЫ КАРТЫ ИЗОБРАЖЕНИЯ
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {Object.entries(r.correctMatches).map(([answerId, correctPointId], mI) => {
                const userPointId = r.userMatches?.[answerId];
                const isCorrect = userPointId === correctPointId;
                const answerLabel = r.answerLabels?.[answerId] || `Ответ`;
                const pointLabel = r.pointLabels?.[correctPointId] || `Точка`;
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
                      <span style={{ fontWeight: 700 }}>
                        {r.pointLabels?.[userPointId] || "—"}
                      </span>
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
                  {renderItem(sr, srI, r.type)}
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