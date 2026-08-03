"use client";

import React, { useState, useEffect } from "react";
import type { RewardItem, StreakConfigItem } from "@/lib/rewards/types";

export default function StreakConfigManager() {
  const [streakConfig, setStreakConfig] = useState<StreakConfigItem[]>([]);
  const [rewardsCatalog, setRewardsCatalog] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dayNumber, setDayNumber] = useState<number>(1);
  const [selectedRewardId, setSelectedRewardId] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [streaksRes, rewardsRes] = await Promise.all([
        fetch("/api/admin/streaks"),
        fetch("/api/admin/rewards"),
      ]);

      const streaksData = await streaksRes.json();
      const rewardsData = await rewardsRes.json();

      if (streaksRes.ok) setStreakConfig(streaksData.streakConfig || []);
      if (rewardsRes.ok) setRewardsCatalog(rewardsData.rewards || []);
    } catch (e) {
      console.error("Failed to load streak config:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dayNumber || !selectedRewardId) {
      alert("Заполните номер дня и выберите награду");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/streaks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayNumber, rewardId: selectedRewardId }),
      });

      if (res.ok) {
        loadData();
        setSelectedRewardId("");
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка сохранения");
      }
    } catch (e) {
      alert("Ошибка сети");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDay = async (targetDay: number) => {
    if (!confirm(`Удалить награду за день ${targetDay}?`)) return;

    try {
      const res = await fetch(`/api/admin/streaks?dayNumber=${targetDay}`, {
        method: "DELETE",
      });
      if (res.ok) loadData();
    } catch (e) {
      alert("Ошибка при удалении");
    }
  };

  return (
    <div className="space-y-6">
      {/* Форма добавления/редактирования дня */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span>🔥</span> Назначить награду за день серии
        </h2>

        <form onSubmit={handleSaveDay} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Номер дня серии (1, 2, 3, 7, 14, 30...)
            </label>
            <input
              type="number"
              min={1}
              required
              value={dayNumber}
              onChange={(e) => setDayNumber(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white font-bold focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Выбрать награду из каталога
            </label>
            <select
              required
              value={selectedRewardId}
              onChange={(e) => setSelectedRewardId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              <option value="">-- Выберите награду --</option>
              {rewardsCatalog.map((r) => (
                <option key={r.id} value={r.id}>
                  [{r.type}] {r.title}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-amber-600/20 disabled:opacity-50"
          >
            {saving ? "Сохранение..." : "Привязать день"}
          </button>
        </form>
      </div>

      {/* Список настроенных дней серии */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-base font-bold text-white mb-4">
          Текущая дорожка наград ({streakConfig.length} шагов)
        </h3>

        {loading ? (
          <div className="text-center py-8 text-slate-500">Загрузка дорожки...</div>
        ) : streakConfig.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            Ни один день серии пока не настроен
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {streakConfig.map((item) => (
              <div
                key={item.day_number}
                className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between relative group hover:border-amber-500/50 transition-all"
              >
                <button
                  onClick={() => handleDeleteDay(item.day_number)}
                  className="absolute top-3 right-3 p-1 text-slate-500 hover:text-red-400 rounded-lg text-xs transition-colors"
                  title="Удалить день"
                >
                  ✕
                </button>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-black text-amber-500 text-base">
                    {item.day_number}d
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">
                      День серии
                    </div>
                    <div className="text-sm font-bold text-white">
                      День {item.day_number}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-2.5 flex items-center gap-2">
                  {item.reward?.asset_url ? (
                    <img
                      src={item.reward.asset_url}
                      alt=""
                      className="w-8 h-8 object-contain"
                    />
                  ) : (
                    <span className="text-base">🎁</span>
                  )}
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-slate-200 truncate">
                      {item.reward?.title || "Неизвестная награда"}
                    </div>
                    <div className="text-[10px] text-slate-400 capitalize">
                      {item.reward?.type || "предмет"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}