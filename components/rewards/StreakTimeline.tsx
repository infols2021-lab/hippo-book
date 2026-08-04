"use client";

import React, { useState } from "react";
import type { StreakConfigItem, StreakStats } from "@/lib/rewards/types";
import StreakLeaderboardModal from "./StreakLeaderboardModal";

interface StreakTimelineProps {
  stats: StreakStats;
  path: StreakConfigItem[];
  onClaimReward: (dayNumber: number) => Promise<void>;
}

export default function StreakTimeline({
  stats,
  path,
  onClaimReward,
}: StreakTimelineProps) {
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [claimingDay, setClaimingDay] = useState<number | null>(null);

  const handleClaim = async (dayNumber: number) => {
    setClaimingDay(dayNumber);
    try {
      await onClaimReward(dayNumber);
    } finally {
      setClaimingDay(null);
    }
  };

  const nextUpcomingReward = path.find((item) => !item.is_claimed);

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* 1. ВЕРХНИЕ КАРТОЧКИ СТАТИСТИКИ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Карточка 1: Текущая серия */}
        <div
          className="border rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all"
          style={{
            backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 3%, transparent)",
            borderColor: "var(--glass-border, rgba(15,23,42,0.1))",
          }}
        >
          <div>
            <div
              className="text-[10px] font-black uppercase tracking-wider mb-1"
              style={{ color: "var(--project-primary, #0ea5e9)" }}
            >
              Серия
            </div>
            <div className="text-2xl font-black">{stats.currentStreak} дн.</div>
            <div
              className="text-xs font-medium mt-0.5"
              style={{ color: "color-mix(in srgb, var(--project-text, #0f172a) 60%, transparent)" }}
            >
              Текущая серия
            </div>
          </div>
          <div
            className="px-3 py-1 text-xs font-bold rounded-lg uppercase tracking-wider border"
            style={{
              backgroundColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 12%, transparent)",
              borderColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 25%, transparent)",
              color: "var(--project-primary, #0ea5e9)",
            }}
          >
            Активна
          </div>
        </div>

        {/* Карточка 2: Рекорд */}
        <div
          onClick={() => setIsLeaderboardOpen(true)}
          className="border rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all shadow-sm group hover:-translate-y-0.5"
          style={{
            backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 3%, transparent)",
            borderColor: "var(--glass-border, rgba(15,23,42,0.1))",
          }}
        >
          <div>
            <div
              className="text-[10px] font-black uppercase tracking-wider mb-1"
              style={{ color: "var(--project-primary, #0ea5e9)" }}
            >
              Рекорд
            </div>
            <div className="text-2xl font-black">{stats.maxStreak} дн.</div>
            <div
              className="text-xs font-medium mt-0.5"
              style={{ color: "color-mix(in srgb, var(--project-text, #0f172a) 60%, transparent)" }}
            >
              Максимум за всё время
            </div>
          </div>
          <span
            className="text-xs font-extrabold uppercase tracking-wider border px-3 py-2 rounded-xl transition-all"
            style={{
              backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 5%, transparent)",
              borderColor: "var(--glass-border, rgba(15,23,42,0.1))",
              color: "var(--project-primary, #0ea5e9)",
            }}
          >
            Топ-20
          </span>
        </div>

        {/* Карточка 3: Статус за сегодня */}
        <div
          className="border rounded-2xl p-4 flex items-center justify-between shadow-sm"
          style={{
            backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 3%, transparent)",
            borderColor: "var(--glass-border, rgba(15,23,42,0.1))",
          }}
        >
          <div>
            <div
              className="text-[10px] font-black uppercase tracking-wider mb-1 opacity-60"
            >
              Статус дня
            </div>
            <div
              className={`text-lg font-black uppercase tracking-wider ${
                stats.completedToday ? "text-emerald-600" : "text-rose-500"
              }`}
            >
              {stats.completedToday ? "Засчитано" : "Не засчитано"}
            </div>
            <div
              className="text-xs font-medium mt-0.5"
              style={{ color: "color-mix(in srgb, var(--project-text, #0f172a) 60%, transparent)" }}
            >
              {stats.completedToday
                ? "Задание выполнено"
                : "Сделайте задание сегодня"}
            </div>
          </div>
          <div
            className={`w-3.5 h-3.5 rounded-full ${
              stats.completedToday ? "bg-emerald-500 shadow-md shadow-emerald-500/50" : "bg-rose-500"
            }`}
          />
        </div>
      </div>

      {/* 2. БАННЕР СЛЕДУЮЩЕЙ НАГРАДЫ */}
      <div
        className="border rounded-2xl p-5 shadow-sm"
        style={{
          backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 3%, transparent)",
          borderColor: "var(--glass-border, rgba(15,23,42,0.1))",
        }}
      >
        <h4 className="text-[10px] font-black uppercase tracking-wider opacity-60 mb-3">
          Следующая награда
        </h4>
        {nextUpcomingReward ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-base font-black uppercase tracking-wider">
                {nextUpcomingReward.reward?.title || "Награда"} — День{" "}
                {nextUpcomingReward.day_number}
              </div>
              <div
                className="text-xs font-medium mt-1"
                style={{ color: "color-mix(in srgb, var(--project-text, #0f172a) 60%, transparent)" }}
              >
                Осталось дней серии:{" "}
                <span className="font-bold">
                  {Math.max(
                    0,
                    nextUpcomingReward.day_number - stats.currentStreak
                  )}
                </span>
              </div>
            </div>

            {nextUpcomingReward.is_available && (
              <button
                type="button"
                onClick={() => handleClaim(nextUpcomingReward.day_number)}
                disabled={claimingDay === nextUpcomingReward.day_number}
                className="px-5 py-2.5 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md disabled:opacity-50 transition-all flex-shrink-0"
                style={{
                  backgroundColor: "var(--project-primary, #0ea5e9)",
                }}
              >
                {claimingDay === nextUpcomingReward.day_number
                  ? "Получение..."
                  : "Забрать награду"}
              </button>
            )}
          </div>
        ) : (
          <div
            className="text-xs font-black uppercase tracking-wider"
            style={{ color: "var(--project-primary, #0ea5e9)" }}
          >
            Все награды в текущей дорожке уже разблокированы
          </div>
        )}
      </div>

      {/* 3. ТАЙМЛАЙН / ДОРОЖКА НАГРАД */}
      <div
        className="border rounded-3xl p-6 relative shadow-sm"
        style={{
          backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 2%, transparent)",
          borderColor: "var(--glass-border, rgba(15,23,42,0.1))",
        }}
      >
        <div className="text-center mb-8">
          <h3 className="text-lg font-black uppercase tracking-wider">
            Дорожка наград
          </h3>
          <p
            className="text-xs font-medium mt-1"
            style={{ color: "color-mix(in srgb, var(--project-text, #0f172a) 60%, transparent)" }}
          >
            Титулы слева • Предметы и иконки справа
          </p>
        </div>

        {path.length === 0 ? (
          <div className="text-center py-12 opacity-60 text-xs font-bold uppercase tracking-wider">
            Дорожка наград пока не настроена
          </div>
        ) : (
          <div className="relative py-4">
            {/* Центральная линия */}
            <div
              className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 z-0"
              style={{ backgroundColor: "var(--glass-border, rgba(15,23,42,0.12))" }}
            />

            <div className="space-y-8 relative z-10">
              {path.map((item) => {
                const isTitle = item.reward?.type === "title";
                const isClaimed = item.is_claimed;
                const isAvailable = item.is_available;

                return (
                  <div
                    key={item.day_number}
                    className="grid grid-cols-2 gap-4 items-center relative"
                  >
                    {/* ЦЕНТРАЛЬНАЯ МЕТКА ДНЯ */}
                    <div className="absolute left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                      <div
                        className="w-10 h-10 rounded-full border-2 font-black text-xs flex items-center justify-center uppercase tracking-wider transition-all"
                        style={{
                          backgroundColor: isClaimed
                            ? "#10b981"
                            : isAvailable
                            ? "var(--project-primary, #0ea5e9)"
                            : "var(--project-card-bg, #ffffff)",
                          borderColor: isClaimed
                            ? "#10b981"
                            : isAvailable
                            ? "var(--project-primary, #0ea5e9)"
                            : "var(--glass-border, rgba(15,23,42,0.2))",
                          color: isClaimed || isAvailable ? "#ffffff" : "var(--project-text, #0f172a)",
                        }}
                      >
                        {item.day_number}d
                      </div>
                    </div>

                    {/* ЛЕВАЯ СТОРОНА: ТИТУЛЫ */}
                    <div className="pr-6">
                      {isTitle && (
                        <div
                          className="p-4 rounded-2xl border transition-all shadow-sm"
                          style={{
                            backgroundColor: isClaimed
                              ? "color-mix(in srgb, var(--project-text, #0f172a) 2%, transparent)"
                              : "var(--project-card-bg, #ffffff)",
                            borderColor: isAvailable
                              ? "var(--project-primary, #0ea5e9)"
                              : "var(--glass-border, rgba(15,23,42,0.1))",
                            opacity: isClaimed ? 0.7 : 1,
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className="text-[10px] font-black uppercase px-2 py-0.5 rounded border tracking-wider"
                              style={{
                                backgroundColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 12%, transparent)",
                                borderColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 25%, transparent)",
                                color: "var(--project-primary, #0ea5e9)",
                              }}
                            >
                              Титул
                            </span>
                            <span
                              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                isClaimed
                                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                  : isAvailable
                                  ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                  : "opacity-50"
                              }`}
                            >
                              {isClaimed
                                ? "Открыт"
                                : isAvailable
                                ? "Доступен"
                                : "Закрыт"}
                            </span>
                          </div>

                          <div className="font-bold text-sm mb-1">
                            «{item.reward?.title}»
                          </div>
                          {item.reward?.description && (
                            <p
                              className="text-xs font-medium line-clamp-2"
                              style={{ color: "color-mix(in srgb, var(--project-text, #0f172a) 60%, transparent)" }}
                            >
                              {item.reward.description}
                            </p>
                          )}

                          {isAvailable && (
                            <button
                              type="button"
                              onClick={() => handleClaim(item.day_number)}
                              disabled={claimingDay === item.day_number}
                              className="mt-3 w-full py-2 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md disabled:opacity-50"
                              style={{
                                backgroundColor: "var(--project-primary, #0ea5e9)",
                              }}
                            >
                              {claimingDay === item.day_number
                                ? "Забор..."
                                : "Забрать титул"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ПРАВАЯ СТОРОНА: ИКОНКИ / ПРЕДМЕТЫ / ШМОТКИ */}
                    <div className="pl-6">
                      {!isTitle && (
                        <div
                          className="p-4 rounded-2xl border transition-all shadow-sm"
                          style={{
                            backgroundColor: isClaimed
                              ? "color-mix(in srgb, var(--project-text, #0f172a) 2%, transparent)"
                              : "var(--project-card-bg, #ffffff)",
                            borderColor: isAvailable
                              ? "var(--project-primary, #0ea5e9)"
                              : "var(--glass-border, rgba(15,23,42,0.1))",
                            opacity: isClaimed ? 0.7 : 1,
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className="text-[10px] font-black uppercase px-2 py-0.5 rounded border tracking-wider"
                              style={{
                                backgroundColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 12%, transparent)",
                                borderColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 25%, transparent)",
                                color: "var(--project-primary, #0ea5e9)",
                              }}
                            >
                              Предмет
                            </span>
                            <span
                              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                isClaimed
                                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                  : isAvailable
                                  ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                  : "opacity-50"
                              }`}
                            >
                              {isClaimed
                                ? "Открыт"
                                : isAvailable
                                ? "Доступен"
                                : "Закрыт"}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 my-2">
                            {item.reward?.asset_url ? (
                              <img
                                src={item.reward.asset_url}
                                alt=""
                                className="w-10 h-10 object-contain"
                              />
                            ) : (
                              <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold opacity-50"
                                style={{ backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 6%, transparent)" }}
                              >
                                N/A
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-sm">
                                {item.reward?.title || "Награда"}
                              </div>
                              <div className="text-[10px] uppercase font-black tracking-wider opacity-60">
                                {item.reward?.type || "предмет"}
                              </div>
                            </div>
                          </div>

                          {isAvailable && (
                            <button
                              type="button"
                              onClick={() => handleClaim(item.day_number)}
                              disabled={claimingDay === item.day_number}
                              className="mt-2 w-full py-2 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md disabled:opacity-50"
                              style={{
                                backgroundColor: "var(--project-primary, #0ea5e9)",
                              }}
                            >
                              {claimingDay === item.day_number
                                ? "Забор..."
                                : "Забрать награду"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* МОДАЛКА ТОП-20 ЛИДЕРБОРДА */}
      <StreakLeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
      />
    </div>
  );
}
