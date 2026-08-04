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
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-500 mb-1">
              Серия
            </div>
            <div className="text-2xl font-black text-white">
              {stats.currentStreak} дн.
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5">
              Текущая серия
            </div>
          </div>
          <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold rounded-lg uppercase tracking-wider">
            Активна
          </div>
        </div>

        {/* Карточка 2: Рекорд */}
        <div
          onClick={() => setIsLeaderboardOpen(true)}
          className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-blue-500/50 transition-all group"
        >
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-blue-400 mb-1">
              Рекорд
            </div>
            <div className="text-2xl font-black text-white">
              {stats.maxStreak} дн.
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5">
              Максимум за всё время
            </div>
          </div>
          <span className="text-xs font-extrabold text-blue-400 uppercase tracking-wider bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
            Топ-20
          </span>
        </div>

        {/* Карточка 3: Статус за сегодня */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
              Статус дня
            </div>
            <div
              className={`text-lg font-black uppercase tracking-wider ${
                stats.completedToday ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {stats.completedToday ? "Засчитано" : "Не засчитано"}
            </div>
            <div className="text-xs font-medium text-slate-400 mt-0.5">
              {stats.completedToday
                ? "Задание выполнено"
                : "Сделайте задание сегодня"}
            </div>
          </div>
          <div
            className={`w-3 h-3 rounded-full ${
              stats.completedToday ? "bg-emerald-500 shadow-md shadow-emerald-500/50" : "bg-rose-500"
            }`}
          />
        </div>
      </div>

      {/* 2. БАННЕР СЛЕДУЮЩЕЙ НАГРАДЫ */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5">
        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">
          Следующая награда
        </h4>
        {nextUpcomingReward ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-base font-black text-white uppercase tracking-wider">
                {nextUpcomingReward.reward?.title || "Награда"} — День{" "}
                {nextUpcomingReward.day_number}
              </div>
              <div className="text-xs font-medium text-slate-400 mt-1">
                Осталось дней серии:{" "}
                <span className="font-bold text-white">
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
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all flex-shrink-0"
              >
                {claimingDay === nextUpcomingReward.day_number
                  ? "Получение..."
                  : "Забрать награду"}
              </button>
            )}
          </div>
        ) : (
          <div className="text-xs font-black text-emerald-400 uppercase tracking-wider">
            Все награды в текущей дорожке уже разблокированы
          </div>
        )}
      </div>

      {/* 3. ТАЙМЛАЙН / ДОРОЖКА НАГРАД */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 relative">
        <div className="text-center mb-8">
          <h3 className="text-lg font-black text-white uppercase tracking-wider">
            Дорожка наград
          </h3>
          <p className="text-xs font-medium text-slate-400 mt-1">
            Титулы слева • Предметы и иконки справа
          </p>
        </div>

        {path.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs font-bold uppercase tracking-wider">
            Дорожка наград пока не настроена
          </div>
        ) : (
          <div className="relative py-4">
            {/* Центральная линия */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-800 -translate-x-1/2 z-0" />

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
                        className={`w-10 h-10 rounded-full border-2 font-black text-xs flex items-center justify-center uppercase tracking-wider transition-all ${
                          isClaimed
                            ? "bg-emerald-600 border-emerald-400 text-white"
                            : isAvailable
                            ? "bg-amber-500 border-amber-300 text-white shadow-lg shadow-amber-500/20"
                            : "bg-slate-900 border-slate-800 text-slate-500"
                        }`}
                      >
                        {item.day_number}d
                      </div>
                    </div>

                    {/* ЛЕВАЯ СТОРОНА: ТИТУЛЫ */}
                    <div className="pr-6">
                      {isTitle && (
                        <div
                          className={`p-4 rounded-2xl border transition-all ${
                            isClaimed
                              ? "bg-slate-900/50 border-slate-800/80 opacity-70"
                              : isAvailable
                              ? "bg-slate-900 border-blue-500 shadow-md shadow-blue-500/10"
                              : "bg-slate-900 border-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-400 tracking-wider">
                              Титул
                            </span>
                            <span
                              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                isClaimed
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : isAvailable
                                  ? "bg-amber-950 text-amber-400 border border-amber-800"
                                  : "text-slate-500"
                              }`}
                            >
                              {isClaimed
                                ? "Открыт"
                                : isAvailable
                                ? "Доступен"
                                : "Закрыт"}
                            </span>
                          </div>

                          <div className="font-bold text-sm text-white mb-1">
                            «{item.reward?.title}»
                          </div>
                          {item.reward?.description && (
                            <p className="text-xs text-slate-400 font-medium line-clamp-2">
                              {item.reward.description}
                            </p>
                          )}

                          {isAvailable && (
                            <button
                              type="button"
                              onClick={() => handleClaim(item.day_number)}
                              disabled={claimingDay === item.day_number}
                              className="mt-3 w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-amber-600/20 disabled:opacity-50"
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
                          className={`p-4 rounded-2xl border transition-all ${
                            isClaimed
                              ? "bg-slate-900/50 border-slate-800/80 opacity-70"
                              : isAvailable
                              ? "bg-slate-900 border-blue-500 shadow-md shadow-blue-500/10"
                              : "bg-slate-900 border-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-950 border border-blue-800 text-blue-400 tracking-wider">
                              Предмет
                            </span>
                            <span
                              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                isClaimed
                                  ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                  : isAvailable
                                  ? "bg-amber-950 text-amber-400 border border-amber-800"
                                  : "text-slate-500"
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
                              <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                                N/A
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-sm text-white">
                                {item.reward?.title || "Награда"}
                              </div>
                              <div className="text-[10px] text-slate-400 uppercase font-black tracking-wider">
                                {item.reward?.type || "предмет"}
                              </div>
                            </div>
                          </div>

                          {isAvailable && (
                            <button
                              type="button"
                              onClick={() => handleClaim(item.day_number)}
                              disabled={claimingDay === item.day_number}
                              className="mt-2 w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-amber-600/20 disabled:opacity-50"
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