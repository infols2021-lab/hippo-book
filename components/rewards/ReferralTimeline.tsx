"use client";

import React, { useState } from "react";

export type ReferralMilestone = {
  id: string;
  purchases_required: number;
  reward: { title: string; type: string } | null;
  is_unlocked: boolean;
  is_claimed: boolean;
  max_price: number;
  choice_count: number;
};

export type ReferralStats = {
  count: number;
  materials_purchased: number;
};

interface ReferralTimelineProps {
  link: string;
  stats: ReferralStats;
  track: ReferralMilestone[];
  onClaimMilestone: (milestone: ReferralMilestone) => void;
}

export default function ReferralTimeline({ link, stats, track, onClaimMilestone }: ReferralTimelineProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-full overflow-hidden">
      
      {/* СТАТИСТИКА И ССЫЛКА (Без горизонтального скролла) */}
      <div className="flex flex-col gap-4 mb-12 w-full">
        
        {/* Статистика вынесена наверх */}
        <div className="grid grid-cols-2 gap-4 w-full">
          <div 
            className="border rounded-3xl p-5 sm:p-6 flex flex-col items-center justify-center shadow-sm transition-all"
            style={{ backgroundColor: "var(--project-card-bg, #ffffff)", borderColor: "var(--glass-border)" }}
          >
            <div className="font-black text-4xl" style={{ color: "var(--project-text)" }}>{stats.count}</div>
            <div 
              className="text-[10px] font-bold uppercase tracking-wider mt-2"
              style={{ color: "color-mix(in srgb, var(--project-text) 60%, transparent)" }}
            >
              Друзей
            </div>
          </div>
          <div 
            className="border rounded-3xl p-5 sm:p-6 flex flex-col items-center justify-center shadow-sm transition-all"
            style={{ backgroundColor: "var(--project-card-bg, #ffffff)", borderColor: "var(--glass-border)" }}
          >
            <div className="font-black text-4xl" style={{ color: "var(--project-primary, #0ea5e9)" }}>{stats.materials_purchased}</div>
            <div 
              className="text-[10px] font-bold uppercase tracking-wider mt-2"
              style={{ color: "color-mix(in srgb, var(--project-text) 60%, transparent)" }}
            >
              Покупок
            </div>
          </div>
        </div>

        {/* Ссылка на всю ширину с обрезкой текста */}
        <div 
          className="border rounded-3xl p-5 sm:p-6 shadow-sm w-full min-w-0 transition-all"
          style={{ backgroundColor: "var(--project-card-bg, #ffffff)", borderColor: "var(--glass-border)" }}
        >
          <div 
            className="text-xs font-black uppercase tracking-wider mb-3"
            style={{ color: "color-mix(in srgb, var(--project-text) 60%, transparent)" }}
          >
            Твоя личная ссылка
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full min-w-0">
            <div 
              className="flex-1 border rounded-2xl px-5 py-3.5 text-sm font-medium truncate select-all min-w-0 overflow-hidden transition-all"
              style={{
                backgroundColor: "color-mix(in srgb, var(--project-text) 3%, transparent)",
                borderColor: "var(--glass-border)",
                color: "var(--project-text)"
              }}
            >
              {link}
            </div>
            <button
              onClick={handleCopy}
              className="shrink-0 px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all border flex items-center justify-center gap-2"
              style={{
                backgroundColor: copied ? "#10b981" : "var(--project-primary, #0ea5e9)",
                borderColor: copied ? "#10b981" : "var(--project-primary, #0ea5e9)",
                color: "#ffffff"
              }}
            >
              {copied ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Скопировано
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  Копировать
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Одноколоночный вертикальный таймлайн */}
      <div className="relative max-w-lg mx-auto py-2">
        {/* Вертикальная линия слева */}
        <div 
          className="absolute left-[23px] top-4 bottom-4 w-[2px]"
          style={{ backgroundColor: "color-mix(in srgb, var(--project-text) 10%, transparent)" }}
        />

        {track.map((m) => {
          const isUnlocked = m.is_unlocked;
          const isClaimed = m.is_claimed;
          
          let circleStyle = {};
          let iconStyle = {};
          let buttonStyle = {};

          if (isClaimed) {
            circleStyle = {
              borderColor: "color-mix(in srgb, #10b981 30%, transparent)",
              backgroundColor: "color-mix(in srgb, #10b981 10%, transparent)",
              color: "#10b981"
            };
            iconStyle = {
              backgroundColor: "color-mix(in srgb, #10b981 10%, transparent)",
              color: "#10b981"
            };
            buttonStyle = {
              backgroundColor: "color-mix(in srgb, #10b981 10%, transparent)",
              borderColor: "color-mix(in srgb, #10b981 20%, transparent)",
              color: "#10b981"
            };
          } else if (isUnlocked) {
            circleStyle = {
              borderColor: "var(--project-primary)",
              backgroundColor: "color-mix(in srgb, var(--project-primary) 10%, transparent)",
              color: "var(--project-primary)"
            };
            iconStyle = {
              backgroundColor: "color-mix(in srgb, var(--project-primary) 10%, transparent)",
              color: "var(--project-primary)"
            };
            buttonStyle = {
              backgroundColor: "var(--project-primary)",
              borderColor: "var(--project-primary)",
              color: "#ffffff",
              boxShadow: "0 4px 14px -2px color-mix(in srgb, var(--project-primary) 40%, transparent)"
            };
          } else {
            circleStyle = {
              borderColor: "var(--glass-border)",
              backgroundColor: "var(--project-card-bg)",
              color: "color-mix(in srgb, var(--project-text) 40%, transparent)"
            };
            iconStyle = {
              backgroundColor: "color-mix(in srgb, var(--project-text) 5%, transparent)",
              color: "color-mix(in srgb, var(--project-text) 40%, transparent)"
            };
            buttonStyle = {
              backgroundColor: "color-mix(in srgb, var(--project-text) 5%, transparent)",
              borderColor: "var(--glass-border)",
              color: "color-mix(in srgb, var(--project-text) 40%, transparent)"
            };
          }

          return (
            <div className="relative flex items-center w-full mb-8 last:mb-0" key={m.id}>
              
              {/* Кружок с количеством покупок */}
              <div 
                className="absolute left-0 w-12 h-12 rounded-full border-[3px] flex items-center justify-center font-black text-sm z-10 transition-colors shadow-sm"
                style={circleStyle}
              >
                {m.purchases_required}
              </div>

              {/* Карточка награды */}
              <div 
                className="ml-[72px] w-full rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-shadow border"
                style={{ backgroundColor: "var(--project-card-bg)", borderColor: "var(--glass-border)" }}
              >
                
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors"
                    style={iconStyle}
                  >
                    {m.choice_count > 0 ? (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
                    )}
                  </div>
                  
                  <div>
                    <div className="font-black text-sm sm:text-base" style={{ color: "var(--project-text)" }}>
                      {m.choice_count > 0 ? "Выбор материала" : "Награда"}
                    </div>
                    {m.choice_count > 0 && (
                      <div className="text-xs font-medium mt-1" style={{ color: "color-mix(in srgb, var(--project-text) 60%, transparent)" }}>
                        Доступно {m.choice_count} шт.
                      </div>
                    )}
                  </div>
                </div>
                
                <button
                  disabled={!isUnlocked || isClaimed}
                  onClick={() => onClaimMilestone(m)}
                  className="w-full sm:w-auto shrink-0 px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border hover:brightness-105 active:scale-[0.98]"
                  style={buttonStyle}
                >
                  {isClaimed ? "Получено" : isUnlocked ? "Забрать" : "Закрыто"}
                </button>

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}