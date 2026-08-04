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
      void loadLeaderboard();
    }
  }, [isOpen]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/streaks/leaderboard");
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
          : data.leaderboard || data.data || data.items || [];
        setLeaderboard(list);
      }
    } catch (e) {
      console.error("Ошибка при загрузке лидерборда:", e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
    >
      <div
        className="rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative border transition-all"
        style={{
          backgroundColor: "var(--project-card-bg, #ffffff)",
          color: "var(--project-text, #0f172a)",
          borderColor: "var(--glass-border, rgba(15,23,42,0.12))",
        }}
      >
        {/* Шапка модалки */}
        <div
          className="flex items-center justify-between pb-3 border-b"
          style={{ borderColor: "var(--glass-border, rgba(15,23,42,0.08))" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <h3 className="text-lg font-black uppercase tracking-wider">
              Топ по сериям
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 opacity-60 hover:opacity-100 rounded-xl transition-colors font-bold"
          >
            ✕
          </button>
        </div>

        {/* Анонимность */}
        <div
          className="p-3.5 rounded-2xl text-xs font-medium border"
          style={{
            backgroundColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 10%, transparent)",
            borderColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 25%, transparent)",
            color: "var(--project-primary, #0ea5e9)",
          }}
        >
          Здесь нет имён — только место в рейтинге, текущая серия и максимальный рекорд.
        </div>

        {/* Заголовок списка */}
        <div className="text-xs font-extrabold uppercase tracking-wider opacity-60">
          Топ 20 по максимальной серии
        </div>

        {/* Список участников */}
        <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="text-center py-8 text-xs font-bold uppercase tracking-wider opacity-60">
              Загрузка рейтинга...
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-8 text-xs font-bold uppercase tracking-wider opacity-60">
              Рейтинг пока пуст
            </div>
          ) : (
            leaderboard.map((item, idx) => {
              const current = item.current_streak ?? (item as any).currentStreak ?? 0;
              const max = item.max_streak ?? (item as any).longest_streak ?? (item as any).maxStreak ?? 0;
              const rank = item.rank ?? idx + 1;

              return (
                <div
                  key={item.user_id || idx}
                  className="p-3.5 rounded-2xl border flex items-center justify-between transition-all"
                  style={{
                    backgroundColor: item.is_current_user
                      ? "color-mix(in srgb, var(--project-primary, #0ea5e9) 15%, transparent)"
                      : "color-mix(in srgb, var(--project-text, #0f172a) 3%, transparent)",
                    borderColor: item.is_current_user
                      ? "var(--project-primary, #0ea5e9)"
                      : "var(--glass-border, rgba(15,23,42,0.08))",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-black text-sm min-w-[32px] ${
                        rank === 1
                          ? "text-amber-500"
                          : rank === 2
                          ? "text-slate-400"
                          : rank === 3
                          ? "text-amber-700"
                          : "opacity-60"
                      }`}
                    >
                      {item.is_current_user ? "Вы " : ""}#{rank}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <div>
                      Текущая:{" "}
                      <span
                        className="font-bold"
                        style={{ color: "var(--project-primary, #0ea5e9)" }}
                      >
                        {current}
                      </span>
                    </div>
                    <div>
                      Максимум:{" "}
                      <span
                        className="font-bold"
                        style={{ color: "var(--project-primary, #0ea5e9)" }}
                      >
                        {max}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}