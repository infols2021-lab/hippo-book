"use client";

import React, { useState, useEffect } from "react";
import type { StreakLeaderboardEntry } from "@/lib/rewards/types";

interface StreakLeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StreakLeaderboardModal({
  isOpen,
  onClose,
}: StreakLeaderboardModalProps) {
  const [leaderboard, setLeaderboard] = useState<StreakLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadLeaderboard();
    }
  }, [isOpen]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/streaks/leaderboard");
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data.leaderboard || []);
      }
    } catch (e) {
      console.error("Ошибка при загрузке лидерборда:", e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95">
        {/* Шапка модалки */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Топ по сериям
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Информационный баннер (Анонимность) */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3.5 text-xs text-blue-700 dark:text-blue-300 font-medium">
          Здесь нет имён — только место в рейтинге, текущая серия и максимальная серия.
        </div>

        {/* Заголовок списка */}
        <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
          Топ 20 по максимальной серии
        </div>

        {/* Список участников */}
        <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Загрузка рейтинга...
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              Рейтинг пока пуст
            </div>
          ) : (
            leaderboard.map((item) => (
              <div
                key={item.user_id}
                className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                  item.is_current_user
                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-900 dark:text-emerald-300 shadow-sm"
                    : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`font-black text-sm min-w-[32px] ${
                      item.rank === 1
                        ? "text-amber-500"
                        : item.rank === 2
                        ? "text-slate-400"
                        : item.rank === 3
                        ? "text-amber-700"
                        : "text-slate-500"
                    }`}
                  >
                    {item.is_current_user ? "Вы" : ""} #{item.rank}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold">
                  <div>
                    Текущая:{" "}
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {item.current_streak}
                    </span>
                  </div>
                  <div>
                    Максимум:{" "}
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {item.max_streak}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}