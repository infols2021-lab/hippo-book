"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
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
  const [mounted, setMounted] = useState(false);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!isOpen || !mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-hidden overscroll-none animate-in fade-in duration-200"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.85)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-leaderboard-title"
    >
      <div
        className="rounded-3xl max-w-lg w-full max-h-[min(90vh,640px)] flex flex-col shadow-2xl relative border transition-all overflow-hidden"
        style={{
          backgroundColor: "var(--project-card-bg, #ffffff)",
          color: "var(--project-text, #0f172a)",
          borderColor: "var(--glass-border, rgba(15,23,42,0.12))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 p-5 sm:p-6 pb-4 space-y-4">
          <div
            className="flex items-center justify-between pb-3 border-b"
            style={{ borderColor: "var(--glass-border, rgba(15,23,42,0.08))" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl flex-shrink-0">🏆</span>
              <h3
                id="streak-leaderboard-title"
                className="text-base sm:text-lg font-black uppercase tracking-wider truncate"
              >
                Топ по сериям
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 opacity-60 hover:opacity-100 rounded-xl transition-colors font-bold flex-shrink-0"
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>

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

          <div className="text-xs font-extrabold uppercase tracking-wider opacity-60">
            Топ 20 по максимальной серии
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-6 pb-5 sm:pb-6 custom-scrollbar">
          <div className="space-y-2 pr-1">
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
                const max =
                  item.max_streak ??
                  (item as any).longest_streak ??
                  (item as any).maxStreak ??
                  0;
                const rank = item.rank ?? idx + 1;

                return (
                  <div
                    key={item.user_id || idx}
                    className="p-3 sm:p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all"
                    style={{
                      backgroundColor: item.is_current_user
                        ? "color-mix(in srgb, var(--project-primary, #0ea5e9) 15%, transparent)"
                        : "color-mix(in srgb, var(--project-text, #0f172a) 3%, transparent)",
                      borderColor: item.is_current_user
                        ? "var(--project-primary, #0ea5e9)"
                        : "var(--glass-border, rgba(15,23,42,0.08))",
                    }}
                  >
                    <span
                      className={`font-black text-sm min-w-[36px] flex-shrink-0 ${
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

                    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[11px] sm:text-xs font-semibold min-w-0">
                      <div className="whitespace-nowrap">
                        Текущая:{" "}
                        <span
                          className="font-bold"
                          style={{ color: "var(--project-primary, #0ea5e9)" }}
                        >
                          {current}
                        </span>
                      </div>
                      <div className="whitespace-nowrap">
                        Макс.:{" "}
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
    </div>
  );

  return createPortal(modal, document.body);
}
