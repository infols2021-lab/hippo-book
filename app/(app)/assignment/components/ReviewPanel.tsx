import type { ReviewItem } from "../lib/types";

function fmtPoints(x: number) {
  return Number.isFinite(x) ? x.toFixed(2) : "0.00";
}

function getStatus(item: ReviewItem) {
  if (item.isSkipped) return { key: "skipped" as const, label: "Пропущен" };
  if (item.isCorrect) return { key: "correct" as const, label: "Правильно" };
  if (item.pointsEarned > 0) return { key: "partial" as const, label: "Частично" };
  return { key: "incorrect" as const, label: "Неправильно" };
}

export default function ReviewPanel({ items }: { items: ReviewItem[] }) {
  return (
    <section className="review-panel" aria-label="Разбор ответов">
      <div className="review-head">
        <h3 className="review-title">🔍 Разбор ответов</h3>
        <div className="review-subtitle">Каждый вопрос отделён, ответы структурированы и читаемы.</div>
      </div>

      <div className="review-list">
        {items.map((r, idx) => {
          const status = getStatus(r);

          return (
            <article
              key={idx}
              className={`review-card review-${status.key}`}
              aria-label={`Разбор вопроса ${idx + 1}`}
            >
              <header className="review-card-head">
                <div className="review-q">
                  <div className="review-qnum">Вопрос {idx + 1}</div>
                  <div className="review-qtext">{r.questionText}</div>
                </div>

                <div className="review-badges">
                  <span className={`review-badge review-badge-${status.key}`}>{status.label}</span>
                  <span className="review-badge review-badge-points">
                    {fmtPoints(r.pointsEarned)} / {r.pointsTotal}
                  </span>
                </div>
              </header>

              {/* TEST */}
              {r.type === "test" ? (
                <div className="review-body">
                  <div className="review-block">
                    <div className="review-label">Ваш ответ</div>
                    <div className="review-value">{r.userLabel}</div>
                  </div>

                  <div className="review-divider" />

                  <div className="review-block">
                    <div className="review-label">Правильный ответ</div>
                    <div className="review-value">{r.correctLabel}</div>
                  </div>
                </div>
              ) : null}

              {/* FILL / SENTENCE */}
              {r.type === "fill" || r.type === "sentence" ? (
                <div className="review-body">
                  <div className="review-metrics">
                    <span className="review-metric">
                      ✅ Верно: <strong>{r.correctCount}</strong> / {r.totalCount}
                    </span>
                    <span className="review-metric">
                      🎯 Процент: <strong>{r.percent}%</strong>
                    </span>
                  </div>

                  <div className="review-grid">
                    <div className="review-grid-head">
                      <div>#</div>
                      <div>Ваш ответ</div>
                      <div>Правильный</div>
                    </div>

                    {r.parts.map((p) => (
                      <div
                        key={p.index}
                        className={`review-grid-row ${p.isCorrect ? "row-ok" : "row-bad"}`}
                      >
                        <div className="review-part-idx">{p.index}</div>
                        <div className="review-part-user">{p.user || "—"}</div>
                        <div className="review-part-correct">{p.correct || "—"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* CROSSWORD */}
              {r.type === "crossword" ? (
                <div className="review-body">
                  <div className="review-block">
                    <div className="review-label">Кроссворд</div>
                    <div className="review-value">{r.note}</div>
                  </div>

                  <div className="review-metrics">
                    <span className="review-metric">
                      🎯 Процент: <strong>{r.crosswordStats.percent}%</strong>
                    </span>
                    <span className="review-metric">
                      ✍️ Заполнено: <strong>{r.crosswordStats.filled}</strong> / {r.crosswordStats.total}
                    </span>
                  </div>

                  {r.wordReview ? (
                    <div className="crossword-review-box">
                      <div className="crossword-review-head">
                        <div className="crossword-review-title">🧩 Разбор слов</div>
                        <div className="crossword-review-stats">
                          ✅ {r.wordReview.correct.length} / ❌ {r.wordReview.wrong.length}
                        </div>
                      </div>

                      <div className="crossword-review-columns">
                        <div className="crossword-review-col">
                          <h5>✅ Правильные</h5>
                          {r.wordReview.correct.length ? (
                            r.wordReview.correct.map((w, i2) => (
                              <div className="crossword-word-row" key={`ok-${i2}`}>
                                <div className="crossword-word-badge">
                                  #{w.number} {w.direction}
                                </div>
                                <div className="crossword-word-lines">
                                  <div>
                                    <strong>{w.word}</strong>
                                  </div>
                                  <div className="muted">Совпадает полностью</div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="crossword-word-lines muted">Нет правильных слов.</div>
                          )}
                        </div>

                        <div className="crossword-review-col">
                          <h5>❌ Ошибки</h5>
                          {r.wordReview.wrong.length ? (
                            r.wordReview.wrong.map((w, i2) => (
                              <div className="crossword-word-row" key={`bad-${i2}`}>
                                <div className="crossword-word-badge bad">
                                  #{w.number} {w.direction}
                                </div>
                                <div className="crossword-word-lines">
                                  <div>
                                    <span className="muted">Ваше:</span> <strong>{w.user}</strong>
                                  </div>
                                  <div>
                                    <span className="muted">Правильно:</span> <strong>{w.correct}</strong>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="crossword-word-lines muted">Ошибок нет.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* OTHER */}
              {r.type === "other" ? (
                <div className="review-body">
                  <div className="review-block">
                    <div className="review-label">Примечание</div>
                    <div className="review-value">{r.note}</div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
