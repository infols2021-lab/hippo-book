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
      <div className="card" style={{ padding: "32px 20px", textAlign: "center", overflow: "hidden" }}>
        <h2 style={{ fontSize: "28px", fontWeight: 900, color: "#1e293b", marginBottom: "16px" }}>
          🎉 Задание завершено!
        </h2>
        
        <div className="score-display" id="finalScore" style={{ margin: "0 auto 20px" }}>
          {stats.score}%
        </div>

        <p id="completionMessage" style={{ fontSize: "16px", fontWeight: 600, color: "#475569", maxWidth: "500px", margin: "0 auto 32px" }}>
          {getCustomOrFallbackMessage(stats.score)}
        </p>

        <div className="completion-details" style={{ textAlign: "left", marginBottom: "32px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#1e293b", marginBottom: "16px" }}>
            📊 Детали результатов
          </h3>
          
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "12px",
            }}
          >
            <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 800, textTransform: "uppercase", marginBottom: "4px" }}>
                Всего
              </div>
              <div style={{ fontSize: "24px", fontWeight: 900, color: "#1e293b" }}>{stats.total}</div>
            </div>
            
            <div style={{ background: "#f0fdf4", padding: "16px", borderRadius: "16px", border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: "12px", color: "#166534", fontWeight: 800, textTransform: "uppercase", marginBottom: "4px" }}>
                Верно
              </div>
              <div style={{ fontSize: "24px", fontWeight: 900, color: "#10b981" }}>{stats.correct}</div>
            </div>
            
            <div style={{ background: "#fef2f2", padding: "16px", borderRadius: "16px", border: "1px solid #fecaca" }}>
              <div style={{ fontSize: "12px", color: "#991b1b", fontWeight: 800, textTransform: "uppercase", marginBottom: "4px" }}>
                Ошибок
              </div>
              <div style={{ fontSize: "24px", fontWeight: 900, color: "#ef4444" }}>{stats.incorrect}</div>
            </div>
            
            <div style={{ background: "#f1f5f9", padding: "16px", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "12px", color: "#475569", fontWeight: 800, textTransform: "uppercase", marginBottom: "4px" }}>
                Пропуск
              </div>
              <div style={{ fontSize: "24px", fontWeight: 900, color: "#64748b" }}>{stats.skipped}</div>
            </div>
          </div>
        </div>

        {showReview ? (
          <div style={{ textAlign: "left" }}>
            <ReviewPanel items={reviewItems} />
          </div>
        ) : null}

        <div 
          style={{ 
            marginTop: "40px", 
            display: "flex", 
            flexWrap: "wrap", 
            gap: "12px", 
            justifyContent: "center" 
          }}
        >
          <button 
            className="btn" 
            onClick={() => (location.href = "./materials")} 
            type="button"
            style={{ flex: "1 1 200px", padding: "14px 24px", fontSize: "16px" }}
          >
            К материалам
          </button>
          <button 
            className="btn secondary" 
            onClick={() => location.reload()} 
            type="button"
            style={{ flex: "1 1 200px", padding: "14px 24px", fontSize: "16px" }}
          >
            Пройти заново
          </button>
        </div>
      </div>
    </div>
  );
}