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
    <div className="w-full">
      {/* Шапка со статистикой и ссылкой */}
      <div className="flex flex-col md:flex-row gap-4 mb-10">
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-3">
            Твоя личная ссылка
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 truncate select-all">
              {link}
            </div>
            <button
              onClick={handleCopy}
              className="px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border flex items-center gap-2"
              style={{
                backgroundColor: copied ? "#10b981" : "var(--project-primary, #0ea5e9)",
                borderColor: copied ? "#10b981" : "var(--project-primary, #0ea5e9)",
                color: "#ffffff"
              }}
            >
              {copied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Скопировано
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  Копировать
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center min-w-[110px] shadow-sm">
            <div className="font-black text-3xl text-slate-800">{stats.count}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">Друзей</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center min-w-[110px] shadow-sm">
            <div className="font-black text-3xl" style={{ color: "var(--project-primary, #0ea5e9)" }}>{stats.materials_purchased}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-1">Покупок</div>
          </div>
        </div>
      </div>

      <div className="text-center mb-8">
        <h4 className="font-black text-lg uppercase tracking-wider text-slate-800 mb-1">Дорожка наград</h4>
        <div className="text-xs font-medium text-slate-500">Титулы слева • Предметы и иконки справа</div>
      </div>

      {/* Вертикальный таймлайн */}
      <div className="relative max-w-4xl mx-auto py-4">
        {/* Центральная линия (на мобилках сдвинута влево) */}
        <div className="absolute left-[39px] sm:left-1/2 top-0 bottom-0 w-[2px] bg-slate-200 -ml-[1px]"></div>

        {track.map((m) => {
          const isUnlocked = m.is_unlocked;
          const isClaimed = m.is_claimed;
          
          let statusColor = "border-slate-200 bg-slate-100 text-slate-400";
          if (isClaimed) statusColor = "border-emerald-500 bg-emerald-500 text-white";
          else if (isUnlocked) statusColor = "border-blue-500 bg-blue-500 text-white shadow-md shadow-blue-500/30";

          return (
            <div className="relative flex flex-col sm:flex-row items-center sm:gap-8 w-full mb-10" key={m.id}>
              
              {/* ЛЕВАЯ КАРТОЧКА (Описание / Титул) - скрыта на мобилках или перестроена */}
              <div className="w-full sm:w-1/2 flex sm:justify-end pl-[80px] sm:pl-0 pr-0 sm:pr-8 mb-4 sm:mb-0">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 w-full sm:max-w-sm shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-slate-100 text-slate-500 rounded-md">
                      {m.reward?.type === 'title' ? 'Титул' : m.choice_count > 0 ? 'Выбор награды' : 'Награда'}
                    </div>
                    <div className={`text-[10px] font-black uppercase tracking-wider ${isClaimed ? "text-emerald-500" : isUnlocked ? "text-blue-500" : "text-slate-400"}`}>
                      {isClaimed ? "Получено" : isUnlocked ? "Открыто" : "Закрыто"}
                    </div>
                  </div>
                  <div className="font-bold text-sm text-slate-800 leading-tight">
                    {m.reward ? `«${m.reward.title}»` : "Секретный набор наград"}
                  </div>
                  {m.choice_count > 0 && (
                    <div className="text-[11px] font-medium text-slate-500 mt-2 flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                      Можно выбрать материалов: {m.choice_count} шт.
                    </div>
                  )}
                </div>
              </div>

              {/* ЦЕНТРАЛЬНЫЙ УЗЕЛ */}
              <div className={`absolute left-[20px] sm:left-1/2 w-10 h-10 -ml-[20px] rounded-full border-4 flex items-center justify-center font-black text-xs z-10 transition-colors ${statusColor}`}>
                {m.purchases_required}
              </div>

              {/* ПРАВАЯ КАРТОЧКА (Иконка / Кнопка забрать) */}
              <div className="w-full sm:w-1/2 flex sm:justify-start pl-[80px] sm:pl-8">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 w-full sm:max-w-sm flex items-center justify-between gap-4 shadow-sm transition-all hover:shadow-md">
                  <div className="w-12 h-12 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center shrink-0 text-slate-400">
                    {m.reward?.type === 'title' ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                    ) : m.choice_count > 0 ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>
                    )}
                  </div>
                  
                  <button
                    disabled={!isUnlocked || isClaimed}
                    onClick={() => onClaimMilestone(m)}
                    className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                      isClaimed 
                        ? "bg-emerald-50 text-emerald-600 border border-emerald-200" 
                        : isUnlocked 
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20" 
                          : "bg-slate-100 text-slate-400 border border-slate-200"
                    }`}
                  >
                    {isClaimed ? "Получено" : isUnlocked ? "Забрать" : "Закрыто"}
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}