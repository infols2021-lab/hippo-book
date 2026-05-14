"use client";

import React from "react";
import type { ReviewItem, QuestionAny, TestOption } from "../lib/types";
import MediaRenderer from "./MediaRenderer";
import { ImageMapRenderer } from "./QuestionImageMap";
import { CrosswordGridReadOnly } from "./QuestionCrossword";
import { MatchingLinesRenderer } from "./QuestionMatching";

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

/** Маленькая карточка для одного поля ввода (fill) */
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
          fontWeight: 900,
          color: isCorrect ? "#10b981" : "#ef4444", // Зеленый если верно, красный если ошибка
          wordBreak: "break-word",
          lineHeight: "1.5",
          fontSize: "15px",
        }}
      >
        {userAnswer || "—"} {userAnswer ? (isCorrect ? "✓" : "✗") : ""}
      </div>
      <div
        style={{
          fontWeight: 900,
          color: "#10b981", // Правильный ответ всегда зеленый
          wordBreak: "break-word",
          lineHeight: "1.5",
          fontSize: "15px",
        }}
      >
        {correctAnswer}
      </div>
    </div>
  );
}

/** Визуализация вариантов теста (сетка с галочками и крестиками) */
function TestOptionsReview({
  options,
  userSelectedIndices,
  correctIndices,
  isMultiple,
}: {
  options: TestOption[];
  userSelectedIndices: number[];
  correctIndices: number[];
  isMultiple: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "16px",
        marginTop: "12px",
      }}
    >
      {options.map((opt, idx) => {
        const isUserSelected = userSelectedIndices.includes(idx);
        const isCorrect = correctIndices.includes(idx);
        
        let borderColor = "#e2e8f0";
        let bgColor = "#fff";
        let icon = null;

        if (isCorrect) {
          // Правильный ответ всегда обводим зеленым и ставим галочку
          borderColor = "#10b981";
          bgColor = "#f0fdf4";
          icon = (
            <div
              style={{
                position: "absolute",
                top: "-10px",
                right: "-10px",
                width: "26px",
                height: "26px",
                borderRadius: "13px",
                background: "#10b981",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: "bold",
                zIndex: 2,
                boxShadow: "0 2px 4px rgba(16,185,129,0.3)"
              }}
            >
              ✓
            </div>
          );
        } else if (isUserSelected) {
          // Неправильный выбор пользователя обводим красным и ставим крестик
          borderColor = "#ef4444";
          bgColor = "#fef2f2";
          icon = (
            <div
              style={{
                position: "absolute",
                top: "-10px",
                right: "-10px",
                width: "26px",
                height: "26px",
                borderRadius: "13px",
                background: "#ef4444",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: "bold",
                zIndex: 2,
                boxShadow: "0 2px 4px rgba(239,68,68,0.3)"
              }}
            >
              ✗
            </div>
          );
        }

        return (
          <div
            key={opt.id}
            style={{
              border: `2px solid ${borderColor}`,
              borderRadius: "16px",
              padding: "16px",
              background: bgColor,
              position: "relative",
              opacity: (!isCorrect && !isUserSelected) ? 0.6 : 1, // Немного гасим невыбранные неверные варианты
            }}
          >
            {icon}
            {opt.text && (
              <div style={{ fontWeight: 900, color: "#000", marginBottom: "8px", fontSize: "15px" }}>
                {opt.text}
              </div>
            )}
            {opt.media && opt.media.length > 0 && (
              <div style={{ marginTop: "8px", display: "flex", justifyContent: "flex-start" }}>
                {opt.media[0].url?.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || opt.media[0].type?.startsWith("image") ? (
                  <img
                    src={opt.media[0].url}
                    alt=""
                    style={{
                      maxWidth: "120px",
                      maxHeight: "120px",
                      objectFit: "contain",
                      borderRadius: "8px",
                    }}
                  />
                ) : (
                  <div style={{ maxWidth: "200px" }}>
                    <MediaRenderer media={opt.media} />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Заполненное предложение (вставка ответов пользователя) */
function FilledSentence({
  template,
  userAnswers,
  correctAnswers,
}: {
  template: string;
  userAnswers: string[];
  correctAnswers: string[];
}) {
  const parts = template.split("___");
  return (
    <div style={{ lineHeight: "2.4", fontSize: "16px", color: "#1e293b" }}>
      {parts.map((part, idx) => {
        const uAns = userAnswers[idx]?.trim().toLowerCase();
        const cAns = correctAnswers[idx]?.trim().toLowerCase();
        const isCorrect = uAns === cAns;

        return (
          <span key={idx}>
            {part}
            {idx < userAnswers.length && (
              <span
                style={{
                  display: "inline-block",
                  margin: "0 8px",
                  padding: "4px 12px",
                  borderRadius: "12px",
                  background: isCorrect ? "#dcfce7" : "#fee2e2",
                  border: "2px solid",
                  borderColor: isCorrect ? "#22c55e" : "#ef4444",
                  fontWeight: 900,
                  color: isCorrect ? "#166534" : "#991b1b",
                }}
              >
                {userAnswers[idx] || "—"} {isCorrect ? "✓" : "✗"}
              </span>
            )}
          </span>
        );
      })}
      {correctAnswers.length > 0 && (
        <div
          style={{
            marginTop: "20px",
            padding: "16px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "12px",
            fontSize: "15px",
          }}
        >
          <span style={{ fontWeight: 800, color: "#166534" }}>Правильные ответы: </span>
          {correctAnswers.map((ans, i) => (
            <span key={i} style={{ marginRight: "16px", fontWeight: 900, color: "#000" }}>
              {i + 1}. <span style={{ color: "#10b981" }}>{ans}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReviewPanel({
  items,
  questions,
}: {
  items: ReviewItem[];
  questions: QuestionAny[];
}) {
  function renderItem(r: ReviewItem, idx: number, parentType?: string) {
    const status = getStatusConfig(r);
    const scorePercent =
      r.pointsTotal > 0 ? (r.pointsEarned / r.pointsTotal) * 100 : 0;
    const itemMedia = r.media;

    // Для imagemap берём данные из вопроса
    let imageUrl = "";
    let points: any[] = [];
    let answers: any[] = [];
    let userMatches: Record<string, string> = {};
    let correctMatches: Record<string, string> = {};

    if (r.type === "imagemap") {
      const q = questions[idx];
      if (q && q.type === "imagemap") {
        imageUrl = q.image || "";
        points = q.points || [];
        answers = q.answers || [];
        userMatches = (r as any).userMatches || {};
        correctMatches = (r as any).correctMatches || {};
      }
    }

    // Для test вычисляем правильные индексы и индексы выбранных пользователем
    let userIndices: number[] = [];
    let correctIndices: number[] = [];
    if (r.type === "test" && r.options) {
      const options = r.options;
      if (Array.isArray(r.correctLabel)) {
        correctIndices = (r.correctLabel as string[])
          .map((text) => options.findIndex((opt) => opt.text === text))
          .filter((i) => i !== -1);
      } else if (typeof r.correctLabel === "string") {
        const idxFound = options.findIndex((opt) => opt.text === r.correctLabel);
        if (idxFound !== -1) correctIndices = [idxFound];
      }
      if (Array.isArray(r.userLabel)) {
        userIndices = (r.userLabel as string[])
          .map((text) => options.findIndex((opt) => opt.text === text))
          .filter((i) => i !== -1);
      } else if (typeof r.userLabel === "string" && r.userLabel !== "Не отвечено") {
        const idxFound = options.findIndex((opt) => opt.text === r.userLabel);
        if (idxFound !== -1) userIndices = [idxFound];
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "6px",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: status.color,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {parentType === "reading" ? "Подвопрос" : `Вопрос ${idx + 1}`}
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

        {/* Медиа вопроса */}
        {itemMedia && itemMedia.length > 0 && (
          <div
            style={{
              marginBottom: "20px",
              borderRadius: "14px",
              overflow: "hidden",
            }}
          >
            <MediaRenderer media={itemMedia} />
          </div>
        )}

        {/* ===== ТЕСТ (сетка вариантов) ===== */}
        {r.type === "test" && r.options && (
          <div
            style={{
              background: "#f8fafc",
              borderRadius: "16px",
              padding: "16px",
            }}
          >
            <TestOptionsReview
              options={r.options}
              userSelectedIndices={userIndices}
              correctIndices={correctIndices}
              isMultiple={r.isMultiple || false}
            />
          </div>
        )}

        {/* ===== FILL ===== */}
        {r.type === "fill" && (
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

        {/* ===== SENTENCE ===== */}
        {r.type === "sentence" && r.sentenceTemplate && (
          <div
            style={{
              background: "#f8fafc",
              borderRadius: "16px",
              padding: "20px",
            }}
          >
            <FilledSentence
              template={r.sentenceTemplate}
              userAnswers={r.userAnswers || []}
              correctAnswers={r.correctAnswers || []}
            />
          </div>
        )}

        {/* ===== MATCHING ===== */}
        {r.type === "matching" && r.pairs && r.leftLabels && r.rightLabels && (
          <div
            style={{
              background: "#f8fafc",
              borderRadius: "16px",
              padding: "16px",
            }}
          >
            <div style={{ display: "grid", gap: "24px" }}>
              <MatchingLinesRenderer
                title="Ваши ответы"
                pairs={r.pairs}
                matches={r.userMatches || {}}
                leftLabels={r.leftLabels}
                rightLabels={r.rightLabels}
                correctMatches={r.correctMatches}
              />
              <MatchingLinesRenderer
                title="Правильные ответы"
                pairs={r.pairs}
                matches={r.correctMatches}
                leftLabels={r.leftLabels}
                rightLabels={r.rightLabels}
              />
            </div>
          </div>
        )}

        {/* ===== IMAGEMAP ===== */}
        {r.type === "imagemap" && imageUrl && (
          <div
            style={{
              background: "#f8fafc",
              borderRadius: "16px",
              padding: "16px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px",
              }}
            >
              <div>
                <div style={{ fontWeight: 800, marginBottom: "12px", color: "#1e293b", textAlign: "center" }}>
                  Ваши ответы
                </div>
                <ImageMapRenderer
                  imageUrl={imageUrl}
                  points={points}
                  answers={answers}
                  matches={userMatches}
                  correctMatches={correctMatches}
                  pointColorConnected="#ef4444"
                  pointColorUnconnected="#94a3b8"
                  lineColorCorrect="#10b981"
                  lineColorIncorrect="#ef4444"
                  pointSize={20}
                  showLabels
                />
              </div>
              <div>
                <div style={{ fontWeight: 800, marginBottom: "12px", color: "#1e293b", textAlign: "center" }}>
                  Правильные ответы
                </div>
                <ImageMapRenderer
                  imageUrl={imageUrl}
                  points={points}
                  answers={answers}
                  matches={correctMatches}
                  correctMatches={correctMatches}
                  pointColorConnected="#10b981"
                  pointColorUnconnected="#94a3b8"
                  lineColorCorrect="#10b981"
                  lineColorIncorrect="#ef4444"
                  pointSize={20}
                  showLabels
                />
              </div>
            </div>
          </div>
        )}

        {/* ===== CROSSWORD ===== */}
        {r.type === "crossword" && r.grid && r.userGrid && (
          <div
            style={{
              background: "#f8fafc",
              borderRadius: "16px",
              padding: "16px",
            }}
          >
            {r.note && (
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: "12px",
                }}
              >
                {r.note}
              </div>
            )}
            {r.crosswordStats && (
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginBottom: "20px",
                  flexWrap: "wrap",
                }}
              >
                <span className="badge-pill">
                  Заполнено клеток:{" "}
                  <b>
                    {r.crosswordStats.filled}/{r.crosswordStats.total}
                  </b>
                </span>
                <span className="badge-pill">
                  Точность заполнения: <b>{r.crosswordStats.percent}%</b>
                </span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "32px",
                marginTop: "16px",
              }}
            >
              <div>
                <CrosswordGridReadOnly
                  title="Ваше заполнение"
                  grid={r.grid}
                  userGrid={r.userGrid}
                  cellNumbers={r.cellNumbers || {}}
                  blocks={r.blocks || []}
                  words={r.words || []}
                  rows={r.grid.length}
                  cols={r.grid[0]?.length || 0}
                  sizeClass="size-normal"
                />
              </div>
              <div>
                <CrosswordGridReadOnly
                  title="Правильное решение"
                  grid={r.grid}
                  cellNumbers={r.cellNumbers || {}}
                  blocks={r.blocks || []}
                  words={r.words || []}
                  rows={r.grid.length}
                  cols={r.grid[0]?.length || 0}
                  sizeClass="size-normal"
                />
              </div>
            </div>
            {r.wordReview && (
              <div style={{ marginTop: "20px" }}>
                {r.wordReview.correct.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#166534",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                      }}
                    >
                      Правильные слова ({r.wordReview.correct.length})
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
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
                          <span
                            style={{
                              fontWeight: 800,
                              color: "#10b981",
                              minWidth: "28px",
                            }}
                          >
                            ✓
                          </span>
                          <span
                            style={{
                              fontWeight: 700,
                              color: "#1e293b",
                              minWidth: "80px",
                            }}
                          >
                            №{w.number} {w.direction === "across" ? "→" : "↓"}
                          </span>
                          <span
                            style={{
                              fontWeight: 900,
                              color: "#000",
                              wordBreak: "break-word",
                            }}
                          >
                            {w.word}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {r.wordReview.wrong.length > 0 && (
                  <div style={{ marginTop: "12px" }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#991b1b",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                      }}
                    >
                      Неправильные слова ({r.wordReview.wrong.length})
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
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
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 800,
                                color: "#ef4444",
                                minWidth: "28px",
                              }}
                            >
                              ✗
                            </span>
                            <span
                              style={{
                                fontWeight: 700,
                                color: "#1e293b",
                                minWidth: "80px",
                              }}
                            >
                              №{w.number}{" "}
                              {w.direction === "across" ? "→" : "↓"}
                            </span>
                            <span
                              style={{
                                fontWeight: 900,
                                color: "#000",
                                wordBreak: "break-word",
                              }}
                            >
                              Ваш ответ: {w.user}
                            </span>
                          </div>
                          <div
                            style={{
                              marginLeft: "40px",
                              color: "#000",
                              fontWeight: 900,
                            }}
                          >
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

        {/* ===== READING (текст) ===== */}
        {r.type === "reading" && (r as any).readingText && (
          <div
            style={{
              background: "#f8fafc",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                color: "#64748b",
                marginBottom: "8px",
              }}
            >
              ТЕКСТ ДЛЯ ЧТЕНИЯ
            </div>
            <div
              style={{
                background: "#fff",
                padding: "16px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                whiteSpace: "pre-wrap",
                lineHeight: 1.6,
                color: "#000",
                fontWeight: 600,
              }}
            >
              {(r as any).readingText}
            </div>
          </div>
        )}

        {/* ===== COMPLEX / READING (вложенные) ===== */}
        {(r.type === "complex" || r.type === "reading") && r.subReviews && (
          <div style={{ marginTop: "16px" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {r.subReviews.map((sr, srI) => (
                <div
                  key={srI}
                  style={{
                    paddingLeft: "12px",
                    borderLeft: "3px solid rgba(99,102,241,0.2)",
                  }}
                >
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
          marginBottom: "20px",
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
          <h3
            style={{
              fontSize: "24px",
              fontWeight: 800,
              margin: 0,
              color: "#1e293b",
            }}
          >
            Разбор прохождения
          </h3>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "14px",
              color: "#94a3b8",
              fontWeight: 600,
            }}
          >
            Изучите свои ошибки, чтобы улучшить результат в следующий раз
          </p>
        </div>
      </div>

      {/* ГЛОБАЛЬНАЯ ЛЕГЕНДА ЦВЕТОВ */}
      <div 
        style={{ 
          display: "flex", 
          flexWrap: "wrap",
          gap: "24px", 
          marginBottom: "32px", 
          padding: "20px", 
          background: "#f8fafc", 
          borderRadius: "16px", 
          border: "2px solid #e2e8f0" 
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "15px", fontWeight: 800, color: "#1e293b" }}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", borderRadius: "13px", background: "#10b981", color: "#fff", fontSize: "14px", boxShadow: "0 2px 4px rgba(16,185,129,0.3)" }}>✓</span>
          Зеленым цветом выделены правильные ответы
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "15px", fontWeight: 800, color: "#1e293b" }}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", borderRadius: "13px", background: "#ef4444", color: "#fff", fontSize: "14px", boxShadow: "0 2px 4px rgba(239,68,68,0.3)" }}>✗</span>
          Красным цветом выделены ваши ошибки
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