"use client";

import React, { useState } from "react";

export type ReferralStats = {
  count: number;
  materials_purchased: number;
};

export type ReferralMilestone = {
  id: string;
  purchases_required: number;
  reward?: {
    id: string;
    title: string;
    type: string;
    asset_url?: string;
  };
  is_unlocked: boolean;
};

type Props = {
  link: string;
  stats: ReferralStats;
  track: ReferralMilestone[];
};

export default function ReferralTrack({ link, stats, track }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!track || track.length === 0) return null;

  const maxPurchases = Math.max(...track.map((t) => t.purchases_required), 1);
  const currentPurchases = stats.materials_purchased;
  
  // Вычисляем процент заполнения шкалы (с ограничением 100%)
  const progressPercent = Math.min((currentPurchases / maxPurchases) * 100, 100);

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid rgba(0,0,0,0.06)",
        borderRadius: "24px",
        padding: "24px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.02)",
        marginBottom: "32px",
      }}
    >
      {/* Шапка: Статистика и ссылка */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "20px",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: "24px",
        }}
      >
        <div style={{ flex: 1, minWidth: "250px" }}>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
            Твоя личная ссылка
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "#f1f5f9",
              borderRadius: "12px",
              padding: "6px 6px 6px 14px",
              border: "1px solid #e2e8f0",
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: "14px",
                fontWeight: 600,
                color: "#334155",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                marginRight: "10px",
              }}
            >
              {link}
            </span>
            <button
              onClick={handleCopy}
              style={{
                background: copied ? "#10b981" : "var(--project-primary, #6366f1)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 800,
                cursor: "pointer",
                transition: "background 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              {copied ? "✓ Скопировано" : "Копировать"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "16px" }}>
          <div style={{ textAlign: "center", background: "#f8fafc", padding: "10px 16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "20px", fontWeight: 900, color: "#1e293b", lineHeight: 1 }}>{stats.count}</div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginTop: "4px" }}>Друзей</div>
          </div>
          <div style={{ textAlign: "center", background: "#f8fafc", padding: "10px 16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "20px", fontWeight: 900, color: "var(--project-primary, #6366f1)", lineHeight: 1 }}>{stats.materials_purchased}</div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginTop: "4px" }}>Покупок</div>
          </div>
        </div>
      </div>

      {/* Дорожка наград */}
      <div style={{ position: "relative", paddingTop: "10px", paddingBottom: "10px", overflowX: "auto", scrollbarWidth: "none" }}>
        <div style={{ minWidth: "500px", position: "relative", height: "80px" }}>
          
          {/* Фон полосы */}
          <div
            style={{
              position: "absolute",
              top: "30px",
              left: "20px",
              right: "20px",
              height: "8px",
              background: "#e2e8f0",
              borderRadius: "4px",
            }}
          />
          
          {/* Заполнение полосы */}
          <div
            style={{
              position: "absolute",
              top: "30px",
              left: "20px",
              height: "8px",
              background: "var(--project-primary, #6366f1)",
              borderRadius: "4px",
              width: `calc((100% - 40px) * ${progressPercent / 100})`,
              transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />

          {/* Отметки (Награды) */}
          {track.map((milestone) => {
            const posPercent = (milestone.purchases_required / maxPurchases) * 100;
            const isReached = currentPurchases >= milestone.purchases_required;
            
            return (
              <div
                key={milestone.id}
                style={{
                  position: "absolute",
                  left: `calc(20px + (100% - 40px) * ${posPercent / 100})`,
                  top: "14px",
                  transform: "translateX(-50%)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                {/* Кружок / Иконка */}
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: isReached ? "var(--project-primary, #6366f1)" : "#f1f5f9",
                    border: `3px solid ${isReached ? "#fff" : "#cbd5e1"}`,
                    boxShadow: isReached ? "0 4px 10px rgba(0,0,0,0.15)" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    color: isReached ? "#fff" : "#94a3b8",
                    transition: "all 0.4s",
                    zIndex: 2,
                  }}
                  title={milestone.reward?.title || "Секретная награда"}
                >
                  {milestone.is_unlocked ? "✓" : milestone.reward?.type === "title" ? "🏷️" : milestone.reward?.type === "base" ? "🎭" : "🎁"}
                </div>
                
                {/* Подпись количества */}
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "12px",
                    fontWeight: 800,
                    color: isReached ? "var(--project-primary, #6366f1)" : "#94a3b8",
                  }}
                >
                  {milestone.purchases_required}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}