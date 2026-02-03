"use client";

import type { FinalStats, ReviewItem } from "../lib/types";
import ReviewPanel from "./ReviewPanel";

export default function CompletionScreen({
  stats,
  reviewItems,
}: {
  stats: FinalStats;
  reviewItems: ReviewItem[];
}) {
  const showReview = stats.incorrect > 0 || stats.skipped > 0;

  return (
    <div id="completionScreen" className="completion-message" style={{ display: "block" }}>
      <div className="card">
        <h2>🎉 Задание завершено!</h2>
        <div className="score-display" id="finalScore">
          {stats.score}%
        </div>

        <p id="completionMessage">
          {stats.score >= 90
            ? "Отличный результат! Вы прекрасно справились с заданием!"
            : stats.score >= 70
              ? "Хороший результат! Вы хорошо усвоили материал."
              : stats.score >= 50
                ? "Неплохой результат! Есть над чем поработать."
                : "Попробуйте пройти задание ещё раз для лучшего результата."}
        </p>

        <div className="completion-details">
          <h3>📊 Детали результатов</h3>
          <div className="result-item">
            <span>Всего вопросов:</span>
            <span>{stats.total}</span>
          </div>
          <div className="result-item">
            <span>Правильных ответов:</span>
            <span>{stats.correct}</span>
          </div>
          <div className="result-item">
            <span>Неправильных ответов:</span>
            <span>{stats.incorrect}</span>
          </div>
          <div className="result-item">
            <span>Пропущено вопросов:</span>
            <span>{stats.skipped}</span>
          </div>
        </div>

        {showReview ? <ReviewPanel items={reviewItems} /> : null}

        <div style={{ marginTop: 30 }}>
          <button className="btn" onClick={() => (location.href = "/materials")} type="button">
            Вернуться к материалам
          </button>
          <button className="btn secondary" onClick={() => location.reload()} style={{ marginLeft: 10 }} type="button">
            Пройти заново
          </button>
        </div>
      </div>
    </div>
  );
}
