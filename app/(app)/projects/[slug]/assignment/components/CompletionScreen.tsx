"use client";

import type { FinalStats, ReviewItem, QuestionAny } from "@/lib/assignments/types";
import ReviewPanel from "./ReviewPanel";

export type FeedbackRange = {
  id?: string;
  minPercent: number;
  maxPercent: number;
  text: string;
};

export default function CompletionScreen({
  stats,
  reviewItems,
  questions,
  feedbackRanges,
}: {
  stats: FinalStats;
  reviewItems: ReviewItem[];
  questions: QuestionAny[];
  feedbackRanges?: FeedbackRange[];
}) {
  const showReview = stats.incorrect > 0 || stats.skipped > 0;

  function getCustomOrFallbackMessage(score: number): string {
    if (Array.isArray(feedbackRanges) && feedbackRanges.length > 0) {
      const match = feedbackRanges.find(
        (r) => score >= r.minPercent && score <= r.maxPercent && r.text?.trim()
      );
      if (match) return match.text.trim();
    }

    if (score >= 90) return "Отличный результат! Вы прекрасно справились с заданием!";
    if (score >= 70) return "Хороший результат! Вы хорошо усвоили материал.";
    if (score >= 50) return "Неплохой результат! Есть над чем поработать.";
    return "Попробуйте пройти задание ещё раз для лучшего результата.";
  }

  return (
    <div id="completionScreen" className="completion-message" style={{ display: "block" }}>
      <div className="card">
        <h2>🎉 Задание завершено!</h2>
        <div className="score-display" id="finalScore">
          {stats.score}%
        </div>

        <p id="completionMessage" style={{ fontSize: "16px", fontWeight: 600, color: "var(--project-text)" }}>
          {getCustomOrFallbackMessage(stats.score)}
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
          <button className="btn" onClick={() => (location.href = "./materials")} type="button">
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