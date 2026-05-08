"use client";

import React from "react";
import type { ReviewItem, ReviewPart } from "../lib/types";
import MediaRenderer from "./MediaRenderer";

// Форматирование баллов (убираем лишние нули, если число целое)
function fmtPoints(x: number) {
  if (x % 1 === 0) return x.toString();
  return x.toFixed(2);
}

// Конфигурация статусов
function getStatusConfig(item: ReviewItem) {
  if (item.isSkipped) return { key: "skipped", label: "Пропущен", color: "#94a3b8", bg: "#f8fafc" };
  if (item.isCorrect) return { key: "correct", label: "Правильно", color: "#10b981", bg: "#f0fdf4" };
  if (item.pointsEarned > 0) return { key: "partial", label: "Частично", color: "#f59e0b", bg: "#fffbeb" };
  return { key: "incorrect", label: "Неправильно", color: "#ef4444", bg: "#fef2f2" };
}

export default function ReviewPanel({ items }: { items: ReviewItem[] }) {
  
  // Рендер отдельной карточки (вынесен в функцию для поддержки вложенности Complex)
  function renderItem(r: ReviewItem, idx?: number) {
    const status = getStatusConfig(r);
    const scorePercent = (r.pointsEarned / r.pointsTotal) * 100;

    return (
      <div 
        key={idx}
        className={`review-card-premium status-${status.key}`}
        style={{
          background: "#fff",
          borderRadius: "24px",
          padding: "24px",
          marginBottom: "24px",
          border: `1px solid rgba(0,0,0,0.06)`,
          boxShadow: "0 10px 30px rgba(0,0,0,0.02)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {/* Акцентная полоса слева */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "6px", background: status.color }} />

        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", marginBottom: "20px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: 900, color: status.color, textTransform: "uppercase", letterSpacing: "1px" }}>
                {idx !== undefined ? `Вопрос ${idx + 1}` : "Подвопрос"}
              </span>
              <span style={{ padding: "2px 8px", borderRadius: "6px", background: status.bg, color: status.color, fontSize: "11px", fontWeight: 700 }}>
                {status.label}
              </span>
            </div>
            <h4 style={{ fontSize: "17px", fontWeight: 700, color: "#1e293b", margin: 0, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
              {r.questionText}
            </h4>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "16px", fontWeight: 900, color: "#1e293b" }}>
              <span style={{ color: status.color }}>{fmtPoints(r.pointsEarned)}</span>
              <span style={{ opacity: 0.3, fontWeight: 400 }}> / {r.pointsTotal}</span>
            </div>
            <div style={{ width: "80px", height: "4px", background: "rgba(0,0,0,0.05)", borderRadius: "2px", marginTop: "8px", overflow: "hidden", marginLeft: "auto" }}>
              <div style={{ width: `${scorePercent}%`, height: "100%", background: status.color, transition: "width 0.6s ease" }} />
            </div>
          </div>
        </header>

        {/* --- ТЕСТ --- */}
        {r.type === "test" && (
          <div className="review-details-box">
            <div className="ans-row">
              <span className="ans-label">Ваш выбор:</span>
              <div className={`ans-val ${r.isCorrect ? "col-ok" : "col-bad"}`}>
                {Array.isArray(r.userLabel) ? r.userLabel.join(", ") : r.userLabel || "—"}
              </div>
            </div>
            {!r.isCorrect && (
              <div className="ans-row">
                <span className="ans-label">Правильно:</span>
                <div className="ans-val col-ok">
                  {Array.isArray(r.correctLabel) ? r.correctLabel.join(", ") : r.correctLabel}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- ВПИСЫВАНИЕ (FILL / SENTENCE) --- */}
        {(r.type === "fill" || r.type === "sentence") && (
          <div className="review-table-wrap">
            <table className="review-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Ваш ответ</th>
                  <th>Верно</th>
                </tr>
              </thead>
              <tbody>
                {r.parts.map((p, pI) => (
                  <tr key={pI} className={p.isCorrect ? "row-ok" : "row-bad"}>
                    <td width="30" style={{ opacity: 0.4, fontWeight: 700 }}>{pI + 1}</td>
                    <td style={{ fontWeight: 600 }}>{p.user || "—"}</td>
                    <td style={{ fontWeight: 600 }}>{p.correct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- МАТЧИНГ (СОПОСТАВЛЕНИЕ) --- */}
        {r.type === "matching" && (
          <div className="review-details-box">
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
              {Object.entries(r.correctMatches).map(([leftId, correctId], mI) => {
                const isPairOk = r.userMatches[leftId] === correctId;
                return (
                  <div key={mI} style={{ 
                    padding: "10px 16px", borderRadius: "12px", border: "1px solid",
                    borderColor: isPairOk ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
                    background: isPairOk ? "#f0fdf4" : "#fef2f2",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <span style={{ fontSize: "14px", fontWeight: 500 }}>Связь #{mI + 1}</span>
                    <span style={{ fontSize: "12px", fontWeight: 800, color: isPairOk ? "#10b981" : "#ef4444" }}>
                      {isPairOk ? "✅ ВЕРНО" : "❌ ОШИБКА"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- КОМПЛЕКСНЫЙ (ВЛОЖЕННОСТЬ) --- */}
        {r.type === "complex" && (
          <div style={{ marginTop: "24px", padding: "20px", background: "rgba(0,0,0,0.02)", borderRadius: "20px", border: "1px dashed rgba(0,0,0,0.1)" }}>
            {r.subReviews.map((sr, srI) => renderItem(sr, srI))}
          </div>
        )}

        {/* --- КРОССВОРД --- */}
        {r.type === "crossword" && (
          <div className="review-details-box">
             <div style={{ fontSize: "14px", marginBottom: "8px" }}>{r.note}</div>
             <div style={{ display: "flex", gap: "10px" }}>
                <span className="badge-small">Заполнено: {r.crosswordStats.filled}/{r.crosswordStats.total}</span>
                <span className="badge-small">Точность: {r.crosswordStats.percent}%</span>
             </div>
          </div>
        )}

        {/* --- ПРИМЕЧАНИЕ --- */}
        {r.type === "other" && r.note && (
          <div className="review-details-box">{r.note}</div>
        )}
      </div>
    );
  }

  return (
    <section className="review-panel-root animate-in">
      <div style={{ margin: "40px 0 24px", display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ 
          width: "44px", height: "44px", background: "#6366f1", borderRadius: "14px", 
          display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(99,102,241,0.2)"
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <div>
          <h3 style={{ fontSize: "22px", fontWeight: 800, margin: 0, color: "#1e293b" }}>Разбор ошибок</h3>
          <p style={{ margin: 0, fontSize: "13px", opacity: 0.5, fontWeight: 600 }}>Проверьте свои ответы и изучите правильные варианты</p>
        </div>
      </div>

      <div className="review-list">
        {items.map((r, idx) => renderItem(r, idx))}
      </div>

      <style jsx>{`
        .review-details-box {
          background: #f8fafc;
          padding: 16px 20px;
          border-radius: 16px;
          border: 1px solid rgba(0,0,0,0.03);
        }
        .ans-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
        }
        .ans-row:not(:last-child) {
          border-bottom: 1px solid rgba(0,0,0,0.05);
        }
        .ans-label {
          font-size: 13px;
          font-weight: 600;
          opacity: 0.5;
        }
        .ans-val {
          font-size: 15px;
          font-weight: 700;
        }
        .col-ok { color: #10b981; }
        .col-bad { color: #ef4444; }

        .review-table-wrap {
          border: 1px solid rgba(0,0,0,0.05);
          border-radius: 16px;
          overflow: hidden;
        }
        .review-table {
          width: 100%;
          border-collapse: collapse;
          background: #fff;
        }
        .review-table th {
          background: #f8fafc;
          text-align: left;
          padding: 12px 15px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          opacity: 0.5;
        }
        .review-table td {
          padding: 14px 15px;
          font-size: 14px;
          border-top: 1px solid rgba(0,0,0,0.04);
        }
        .row-ok { background: rgba(16, 185, 129, 0.03); }
        .row-bad { background: rgba(239, 68, 68, 0.03); }

        .badge-small {
          font-size: 11px;
          font-weight: 800;
          background: rgba(0,0,0,0.05);
          padding: 4px 10px;
          border-radius: 8px;
          opacity: 0.7;
        }

        .animate-in {
          animation: slideUp 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}