"use client";

import React from "react";
import type { ReviewItem, ReviewPart } from "../lib/types";
import MediaRenderer from "./MediaRenderer";

// Форматирование баллов
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
  
  function renderItem(r: ReviewItem, idx?: number) {
    const status = getStatusConfig(r);
    const scorePercent = (r.pointsEarned / r.pointsTotal) * 100;
    
    // Приводим к any, чтобы TS не ругался на отсутствие media в ReviewItem, 
    // пока ты не обновил lib/types.ts
    const itemMedia = (r as any).media;

    return (
      <div 
        key={idx}
        className={`review-card-premium status-${status.key} animate-in`}
        style={{
          background: "#fff",
          borderRadius: "28px",
          padding: "24px",
          marginBottom: "24px",
          border: `1px solid rgba(0,0,0,0.06)`,
          boxShadow: "0 10px 30px rgba(0,0,0,0.02)",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "6px", background: status.color }} />

        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", marginBottom: "20px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 900, color: status.color, textTransform: "uppercase", letterSpacing: "1px" }}>
                {idx !== undefined ? `Вопрос ${idx + 1}` : "Подвопрос"}
              </span>
              <span style={{ padding: "3px 10px", borderRadius: "8px", background: status.bg, color: status.color, fontSize: "11px", fontWeight: 800 }}>
                {status.label}
              </span>
            </div>
            <h4 style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b", margin: 0, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
              {r.questionText}
            </h4>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "16px", fontWeight: 900, color: "#1e293b" }}>
              <span style={{ color: status.color }}>{fmtPoints(r.pointsEarned)}</span>
              <span style={{ opacity: 0.3, fontWeight: 400 }}> / {r.pointsTotal}</span>
            </div>
            <div style={{ width: "80px", height: "5px", background: "rgba(0,0,0,0.05)", borderRadius: "10px", marginTop: "8px", overflow: "hidden", marginLeft: "auto" }}>
              <div style={{ width: `${scorePercent}%`, height: "100%", background: status.color, transition: "width 0.8s ease" }} />
            </div>
          </div>
        </header>

        {/* --- КОНТЕКСТ (МЕДИА) --- */}
        {itemMedia && itemMedia.length > 0 && (
          <div style={{ marginBottom: "20px", borderRadius: "16px", overflow: "hidden", border: "1px solid rgba(0,0,0,0.03)" }}>
            <MediaRenderer media={itemMedia} />
          </div>
        )}

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
                  {/* ФИКС ОШИБКИ: width задается через style */}
                  <th style={{ width: "50px" }}>№</th>
                  <th>Ваш ответ</th>
                  <th>Верно</th>
                </tr>
              </thead>
              <tbody>
                {r.parts.map((p, pI) => (
                  <tr key={pI} className={p.isCorrect ? "row-ok" : "row-bad"}>
                    <td className="cell-num">{pI + 1}</td>
                    <td className="cell-ans">{p.user || "—"}</td>
                    <td className="cell-corr">{p.correct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- МАТЧИНГ (СОПОСТАВЛЕНИЕ) --- */}
        {r.type === "matching" && (
          <div className="review-details-box">
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px" }}>
              {Object.entries(r.correctMatches).map(([leftId, correctId], mI) => {
                const isPairOk = r.userMatches[leftId] === correctId;
                return (
                  <div key={mI} style={{ 
                    padding: "12px 18px", borderRadius: "16px", border: "1px solid",
                    borderColor: isPairOk ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
                    background: isPairOk ? "#f0fdf4" : "#fef2f2",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#475569" }}>Пара #{mI + 1}</span>
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
          <div style={{ marginTop: "24px", padding: "20px", background: "#f8fafc", borderRadius: "24px", border: "1px dashed rgba(0,0,0,0.1)" }}>
            <div style={{ fontSize: "12px", fontWeight: 800, opacity: 0.4, marginBottom: "20px", textAlign: "center", textTransform: "uppercase" }}>Вложенные задания</div>
            {r.subReviews.map((sr, srI) => renderItem(sr, srI))}
          </div>
        )}

        {/* --- КРОССВОРД --- */}
        {r.type === "crossword" && (
          <div className="review-details-box">
             <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "12px", color: "#334155" }}>{r.note}</div>
             <div style={{ display: "flex", gap: "12px" }}>
                <span className="badge-pill">Заполнено: <b>{r.crosswordStats.filled}/{r.crosswordStats.total}</b></span>
                <span className="badge-pill">Точность: <b>{r.crosswordStats.percent}%</b></span>
             </div>
          </div>
        )}

        {/* --- ПРИМЕЧАНИЕ --- */}
        {r.type === "other" && r.note && (
          <div className="review-details-box" style={{ fontStyle: "italic", opacity: 0.7 }}>{r.note}</div>
        )}
      </div>
    );
  }

  return (
    <section className="review-panel-root">
      <div className="review-header-main">
        <div className="review-icon-wrap">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <div>
          <h3 style={{ fontSize: "24px", fontWeight: 800, margin: 0, color: "#1e293b" }}>Разбор прохождения</h3>
          <p style={{ margin: "4px 0 0", fontSize: "14px", opacity: 0.5, fontWeight: 600 }}>Изучите свои ошибки, чтобы улучшить результат в следующий раз</p>
        </div>
      </div>

      <div className="review-list">
        {items.map((r, idx) => renderItem(r, idx))}
      </div>

      <style jsx>{`
        .review-panel-root {
          margin-top: 50px;
        }
        .review-header-main {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 32px;
        }
        .review-icon-wrap {
          width: 52px;
          height: 52px;
          background: #6366f1;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 20px rgba(99,102,241,0.25);
        }

        .review-details-box {
          background: #f8fafc;
          padding: 20px;
          border-radius: 20px;
          border: 1px solid rgba(0,0,0,0.03);
        }
        .ans-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
        }
        .ans-row:not(:last-child) {
          border-bottom: 1px solid rgba(0,0,0,0.05);
        }
        .ans-label {
          font-size: 13px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .ans-val {
          font-size: 16px;
          font-weight: 700;
        }
        .col-ok { color: #10b981; }
        .col-bad { color: #ef4444; }

        .review-table-wrap {
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 20px;
          overflow: hidden;
          background: #fff;
        }
        .review-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        .review-table th {
          background: #f8fafc;
          text-align: left;
          padding: 14px 20px;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          color: #64748b;
          letter-spacing: 0.5px;
        }
        .review-table td {
          padding: 16px 20px;
          font-size: 15px;
          border-top: 1px solid rgba(0,0,0,0.04);
          word-break: break-word;
        }
        
        .cell-num { font-weight: 800; color: #cbd5e1; }
        .cell-ans { font-weight: 700; color: #1e293b; }
        .cell-corr { font-weight: 700; color: #10b981; }
        
        .row-ok { background: rgba(16, 185, 129, 0.02); }
        .row-bad { background: rgba(239, 68, 68, 0.02); }
        .row-bad .cell-ans { color: #ef4444; }

        .badge-pill {
          font-size: 12px;
          font-weight: 700;
          background: #fff;
          padding: 6px 14px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          color: #475569;
        }

        .animate-in {
          animation: slideUp 0.7s cubic-bezier(0.23, 1, 0.32, 1) forwards;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}