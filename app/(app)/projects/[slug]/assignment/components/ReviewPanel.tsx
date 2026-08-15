"use client";

import React, { useState } from "react";
import type { ReviewItem, TestOption, ReviewPart } from "@/lib/assignments/types";
import { isVariantMatch } from "@/lib/assignments/scoring";
import QuestionRichText from "./QuestionRichText";
import MediaRenderer from "./MediaRenderer";
import { ImageMapRenderer } from "./QuestionImageMap";
import { CrosswordGridReadOnly, getCrosswordSizeClass } from "./QuestionCrossword";
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

  // РЕШЕНИЕ БАГА #7: Подсказка для тестов, если человек угадал часть, но получил штраф за лишний клик
  if (
    item.type === "test" &&
    item.isMultiple &&
    item.pointsEarned === 0 &&
    Array.isArray(item.userIndices) &&
    item.userIndices.length > 0
  ) {
    const hasCorrect = item.userIndices.some((i: number) => item.correctIndices?.includes(i));
    if (hasCorrect) {
      return { key: "penalty", label: "Штраф (лишний вариант)", color: "#f59e0b", bg: "#fffbeb" };
    }
  }

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
    <div className={`review-fill-row ${isCorrect ? "is-correct" : "is-incorrect"}`}>
      <div className="review-fill-idx" style={{ color: isCorrect ? "#10b981" : "#cbd5e1" }}>
        {index + 1}
      </div>
      <div className="review-fill-answers">
        <div className="review-fill-answer" style={{ color: isCorrect ? "#10b981" : "#ef4444" }}>
          <span className="review-fill-label">Ваш ответ</span>
          {userAnswer || "—"} {userAnswer ? (isCorrect ? "✓" : "✗") : ""}
        </div>
        {!isCorrect && (
          <div className="review-fill-answer review-fill-correct-mobile" style={{ color: "#10b981" }}>
            <span className="review-fill-label">Верный ответ</span>
            {correctAnswer}
          </div>
        )}
      </div>
      <div className="review-fill-answer review-fill-correct-desktop" style={{ color: "#10b981" }}>
        <span className="review-fill-label">Верный ответ</span>
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
}: {
  options: TestOption[];
  userSelectedIndices: number[];
  correctIndices: number[];
}) {
  return (
    <div className="review-test-grid">
      {options.map((opt, idx: number) => {
        const isUserSelected = userSelectedIndices.includes(idx);
        const isCorrect = correctIndices.includes(idx);

        let borderColor = "#e2e8f0";
        let bgColor = "#fff";
        let icon = null;

        if (isCorrect) {
          borderColor = "#10b981";
          bgColor = "#f0fdf4";
          icon = (
            <div
              style={{
                position: "absolute",
                top: "-8px",
                right: "-8px",
                width: "24px",
                height: "24px",
                borderRadius: "12px",
                background: "#10b981",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
                fontWeight: "bold",
                zIndex: 2,
                boxShadow: "0 2px 4px rgba(16,185,129,0.3)",
              }}
            >
              ✓
            </div>
          );
        } else if (isUserSelected) {
          borderColor = "#ef4444";
          bgColor = "#fef2f2";
          icon = (
            <div
              style={{
                position: "absolute",
                top: "-8px",
                right: "-8px",
                width: "24px",
                height: "24px",
                borderRadius: "12px",
                background: "#ef4444",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
                fontWeight: "bold",
                zIndex: 2,
                boxShadow: "0 2px 4px rgba(239,68,68,0.3)",
              }}
            >
              ✗
            </div>
          );
        }

        return (
          <div
            key={opt.id}
            className="review-test-option"
            style={{
              border: `2px solid ${borderColor}`,
              background: bgColor,
              opacity: !isCorrect && !isUserSelected ? 0.6 : 1,
            }}
          >
            {icon}
            {opt.text && <div className="review-test-option-text">{opt.text}</div>}
            {opt.media && opt.media.length > 0 && (
              <div style={{ marginTop: "8px", display: "flex", justifyContent: "flex-start" }}>
                {opt.media[0].url?.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) ||
                opt.media[0].type?.startsWith("image") ? (
                  <img
                    src={opt.media[0].url}
                    alt=""
                    style={{
                      maxWidth: "100px",
                      maxHeight: "100px",
                      objectFit: "contain",
                      borderRadius: "8px",
                    }}
                  />
                ) : (
                  <div style={{ maxWidth: "100%" }}>
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
  parts,
}: {
  template: string;
  userAnswers: string[];
  correctAnswers: string[];
  parts?: ReviewPart[];
}) {
  const isBlankCorrect = (idx: number) => {
    if (parts?.[idx]) return parts[idx].isCorrect;
    const userRaw = userAnswers[idx] ?? "";
    const variants = correctAnswers[idx];
    if (!variants) return false;
    return isVariantMatch(userRaw, variants);
  };

  let gapIndex = 0;
  const paragraphs = template.split("\n").map((line) => {
    if (!line.trim()) return { isEmpty: true as const, chunks: [] as Array<{ kind: "text"; text: string } | { kind: "gap"; gapIndex: number }> };
    const lineParts = line.split("___");
    const chunks: Array<{ kind: "text"; text: string } | { kind: "gap"; gapIndex: number }> = [];
    lineParts.forEach((part, partIndex) => {
      if (part) chunks.push({ kind: "text", text: part });
      if (partIndex < lineParts.length - 1) {
        chunks.push({ kind: "gap", gapIndex });
        gapIndex += 1;
      }
    });
    return { isEmpty: false as const, chunks };
  });

  return (
    <div className="review-sentence-cloze sentence-cloze">
      {paragraphs.map((paragraph, paragraphIndex) => {
        if (paragraph.isEmpty) {
          return <div key={paragraphIndex} className="sentence-cloze-spacer" aria-hidden="true" />;
        }

        return (
          <p key={paragraphIndex} className="sentence-cloze-paragraph">
            {paragraph.chunks.map((chunk, chunkIndex) => {
              if (chunk.kind === "text") {
                return (
                  <QuestionRichText
                    key={`${paragraphIndex}-t-${chunkIndex}`}
                    as="span"
                    text={chunk.text}
                    className="sentence-cloze-text"
                  />
                );
              }

              const isCorrect = isBlankCorrect(chunk.gapIndex);
              const answer = userAnswers[chunk.gapIndex] || "—";

              return (
                <span
                  key={`${paragraphIndex}-g-${chunkIndex}`}
                  className={`review-sentence-chip ${isCorrect ? "is-correct" : "is-incorrect"}`}
                >
                  <span className="sentence-gap-num">{chunk.gapIndex + 1}</span>
                  {answer} {isCorrect ? "✓" : "✗"}
                </span>
              );
            })}
          </p>
        );
      })}

      {correctAnswers.length > 0 && (
        <div
          style={{
            marginTop: "16px",
            padding: "14px 16px",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "12px",
            fontSize: "14px",
            display: "flex",
            flexDirection: "column",
            gap: "6px"
          }}
        >
          <span style={{ fontWeight: 800, color: "#166534" }}>Правильные ответы: </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {correctAnswers.map((ans, i: number) => (
              <span key={i} style={{ fontWeight: 800, color: "#000", background: "rgba(255,255,255,0.6)", padding: "4px 8px", borderRadius: "6px" }}>
                {i + 1}. <span style={{ color: "#10b981" }}>{ans}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CrosswordReviewSection({
  grid,
  userGrid,
  cellNumbers,
  blocks,
  words,
  rows,
  cols,
}: {
  grid: string[][];
  userGrid: string[][];
  cellNumbers: Record<string, number>;
  blocks: { row: number; col: number }[];
  words: any[];
  rows: number;
  cols: number;
}) {
  const [activeTab, setActiveTab] = useState<"user" | "correct">("user");
  const sizeClass = getCrosswordSizeClass(rows, cols);

  return (
    <>
      <div className="review-crossword-tabs">
        <button
          type="button"
          className={`review-crossword-tab ${activeTab === "user" ? "is-active" : ""}`}
          onClick={() => setActiveTab("user")}
        >
          Ваше заполнение
        </button>
        <button
          type="button"
          className={`review-crossword-tab ${activeTab === "correct" ? "is-active" : ""}`}
          onClick={() => setActiveTab("correct")}
        >
          Правильное решение
        </button>
      </div>
      <div className="review-crossword-panels">
        <div className={`review-crossword-panel ${activeTab !== "user" ? "is-hidden-mobile" : ""}`}>
          <CrosswordGridReadOnly
            title="Ваше заполнение"
            grid={grid}
            userGrid={userGrid}
            cellNumbers={cellNumbers}
            blocks={blocks}
            words={words}
            rows={rows}
            cols={cols}
            sizeClass={sizeClass}
          />
        </div>
        <div className={`review-crossword-panel ${activeTab !== "correct" ? "is-hidden-mobile" : ""}`}>
          <CrosswordGridReadOnly
            title="Правильное решение"
            grid={grid}
            cellNumbers={cellNumbers}
            blocks={blocks}
            words={words}
            rows={rows}
            cols={cols}
            sizeClass={sizeClass}
          />
        </div>
      </div>
    </>
  );
}

export default function ReviewPanel({ items }: { items: ReviewItem[] }) {
  function renderItem(r: ReviewItem, idx: number, parentType?: string) {
    const status = getStatusConfig(r);
    const scorePercent = r.pointsTotal > 0 ? (r.pointsEarned / r.pointsTotal) * 100 : 0;
      
    const mediaToRender = r.media;

    let imageUrl = "";
    let points: any[] = [];
    let answers: any[] = [];
    let userMatches: Record<string, string> = {};
    let correctMatches: Record<string, string> = {};

    if (r.type === "imagemap") {
      imageUrl = r.imageUrl || "";
      points = r.points || [];
      answers = r.answers || [];
      userMatches = r.userMatches || {};
      correctMatches = r.correctMatches || {};
    }

    let userIndices: number[] = Array.isArray((r as any).userIndices) ? (r as any).userIndices : [];
    let correctIndices: number[] = Array.isArray((r as any).correctIndices) ? (r as any).correctIndices : [];

    // Fallback для совместимости со старыми записями
    if (r.type === "test" && r.options && correctIndices.length === 0) {
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
      <div key={idx} className="review-card review-card-inner">
        <div className="review-card-accent" style={{ background: status.color }} />

        <div className="review-card-top">
          <div className="review-card-meta">
            <div className="review-card-badges">
              <span className="review-card-qnum" style={{ color: status.color }}>
                {parentType === "reading" ? "Подвопрос" : `Вопрос ${idx + 1}`}
              </span>
              <span
                className="review-card-status"
                style={{ background: status.bg, color: status.color }}
              >
                {status.label}
              </span>
            </div>
            <QuestionRichText
              as="h4"
              className="review-question-title"
              text={r.questionText}
            />
            {r.explanation ? (
              <div
                className="review-explanation"
                style={{
                  marginTop: 12,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "rgba(14, 165, 233, 0.08)",
                  border: "1px solid rgba(14, 165, 233, 0.18)",
                  color: "#0f172a",
                  fontSize: 14,
                  lineHeight: 1.55,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "#0369a1", marginBottom: 6 }}>
                  Разбор
                </div>
                {r.explanation}
              </div>
            ) : null}
          </div>

          <div className="review-score-block">
            <div className="review-score-value">
              <span style={{ color: status.color }}>{fmtPoints(r.pointsEarned)}</span>
              <span style={{ opacity: 0.3, fontWeight: 500 }}> / {r.pointsTotal}</span>
            </div>
            <div className="review-score-bar">
              <div
                className="review-score-fill"
                style={{ width: `${scorePercent}%`, background: status.color }}
              />
            </div>
          </div>
        </div>

        {mediaToRender && mediaToRender.length > 0 && (
          <div
            style={{
              marginBottom: "20px",
              borderRadius: "14px",
              overflow: "hidden",
              background: "#f8fafc",
              border: "1px solid rgba(0,0,0,0.04)",
              padding: "16px",
            }}
          >
            <MediaRenderer media={mediaToRender} />
          </div>
        )}

        {/* ===== ТЕСТ ===== */}
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
            {(r.parts ?? []).map((p, pI: number) => (
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
              parts={r.parts}
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
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                gap: "20px",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 800,
                    marginBottom: "12px",
                    color: "#1e293b",
                    textAlign: "center",
                  }}
                >
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
                <div
                  style={{
                    fontWeight: 800,
                    marginBottom: "12px",
                    color: "#1e293b",
                    textAlign: "center",
                  }}
                >
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
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {r.wordReview.correct.map((w, i: number) => (
                        <div
                          key={i}
                          style={{
                            padding: "8px 12px",
                            background: "#f0fdf4",
                            border: "1px solid rgba(16,185,129,0.2)",
                            borderRadius: "10px",
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "12px",
                            fontSize: "14px",
                          }}
                        >
                          <span style={{ fontWeight: 800, color: "#10b981", minWidth: "20px" }}>✓</span>
                          <span style={{ fontWeight: 700, color: "#1e293b", minWidth: "70px" }}>
                            №{w.number} {w.direction === "across" ? "→" : "↓"}
                          </span>
                          <span style={{ fontWeight: 900, color: "#000", wordBreak: "break-word" }}>
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
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {r.wordReview.wrong.map((w, i: number) => (
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
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
                            <span style={{ fontWeight: 800, color: "#ef4444", minWidth: "20px" }}>✗</span>
                            <span style={{ fontWeight: 700, color: "#1e293b", minWidth: "70px" }}>
                              №{w.number} {w.direction === "across" ? "→" : "↓"}
                            </span>
                            <span style={{ fontWeight: 900, color: "#000", wordBreak: "break-word" }}>
                              Ваш ответ: {w.user}
                            </span>
                          </div>
                          <div style={{ marginLeft: "32px", color: "#000", fontWeight: 900 }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {r.subReviews.map((sr, srI: number) => (
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
          flexWrap: "wrap",
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
            flexShrink: 0
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
          border: "2px solid #e2e8f0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "15px",
            fontWeight: 800,
            color: "#1e293b",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "26px",
              height: "26px",
              borderRadius: "13px",
              background: "#10b981",
              color: "#fff",
              fontSize: "14px",
              boxShadow: "0 2px 4px rgba(16,185,129,0.3)",
              flexShrink: 0
            }}
          >
            ✓
          </span>
          Зеленым цветом выделены правильные ответы
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "15px",
            fontWeight: 800,
            color: "#1e293b",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "26px",
              height: "26px",
              borderRadius: "13px",
              background: "#ef4444",
              color: "#fff",
              fontSize: "14px",
              boxShadow: "0 2px 4px rgba(239,68,68,0.3)",
              flexShrink: 0
            }}
          >
            ✗
          </span>
          Красным цветом выделены ваши ошибки
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((r, idx: number) => renderItem(r, idx))}
      </div>
    </section>
  );
}