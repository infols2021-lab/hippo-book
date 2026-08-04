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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
    >
      <div
        className="rounded-[32px] max-w-lg w-full p-6 space-y-5 shadow-2xl relative border transition-all"
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

        {/* Информационный баннер (Анонимность) */}
        <div
          className="rounded-2xl p-3.5 text-xs font-bold border"
          style={{
            backgroundColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 10%, transparent)",
            borderColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 25%, transparent)",
            color: "var(--project-primary, #0ea5e9)",
          }}
        >
          Здесь нет имён — только место в рейтинге, текущая и максимальная серия.
        </div>

        {/* Заголовок списка */}
        <div className="text-xs font-extrabold uppercase tracking-wider opacity-60">
          Топ 20 по максимальной серии
        </div>

        {/* Список участников */}
        <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="text-center py-8 opacity-60 text-xs font-bold uppercase tracking-wider">
              Загрузка рейтинга...
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-8 opacity-60 text-xs font-bold uppercase tracking-wider">
              Рейтинг пока пуст
            </div>
          ) : (
            leaderboard.map((item) => (
              <div
                key={item.user_id}
                className="p-3.5 rounded-2xl border flex items-center justify-between transition-all"
                style={{
                  backgroundColor: item.is_current_user
                    ? "color-mix(in srgb, var(--project-primary, #0ea5e9) 12%, transparent)"
                    : "color-mix(in srgb, var(--project-text, #0f172a) 2%, transparent)",
                  borderColor: item.is_current_user
                    ? "var(--project-primary, #0ea5e9)"
                    : "var(--glass-border, rgba(15,23,42,0.08))",
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="font-black text-sm min-w-[36px]"
                    style={{
                      color:
                        item.rank === 1
                          ? "#f59e0b"
                          : item.rank === 2
                          ? "#94a3b8"
                          : item.rank === 3
                          ? "#d97706"
                          : "var(--project-text, #0f172a)",
                    }}
                  >
                    {item.is_current_user ? "Вы " : ""}#{item.rank}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold">
                  <div>
                    Текущая:{" "}
                    <span
                      className="font-bold"
                      style={{ color: "var(--project-primary, #0ea5e9)" }}
                    >
                      {item.current_streak} дн.
                    </span>
                  </div>
                  <div>
                    Максимум:{" "}
                    <span className="font-bold">
                      {item.max_streak} дн.
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
