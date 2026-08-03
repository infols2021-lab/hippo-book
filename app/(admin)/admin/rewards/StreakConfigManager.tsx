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
    void loadData();
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
        void loadData();
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
      if (res.ok) void loadData();
    } catch (e) {
      alert("Ошибка при удалении");
    }
  };

  return (
    <div className="space-y-6">
      {/* Форма добавления/редактирования дня */}
      <div className="bg-gray-50 border border-gray-200 p-6 rounded-2xl space-y-4">
        <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
          <span>🔥</span> Назначить награду за день серии
        </h2>

        <form onSubmit={handleSaveDay} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Номер дня серии (1, 2, 3, 7, 14, 30...)
            </label>
            <input
              type="number"
              min={1}
              required
              value={dayNumber}
              onChange={(e) => setDayNumber(Number(e.target.value))}
              className="w-full bg-white border-2 border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Выбрать награду из каталога
            </label>
            <select
              required
              value={selectedRewardId}
              onChange={(e) => setSelectedRewardId(e.target.value)}
              className="w-full bg-white border-2 border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
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
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm disabled:opacity-50"
          >
            {saving ? "Сохранение..." : "Привязать день"}
          </button>
        </form>
      </div>

      {/* Список настроенных дней серии */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-black text-gray-900">
          Текущая дорожка наград ({streakConfig.length} шагов)
        </h3>

        {loading ? (
          <div className="text-center py-8 text-gray-500 font-bold text-sm">Загрузка дорожки...</div>
        ) : streakConfig.length === 0 ? (
          <div className="text-center py-8 text-gray-500 font-bold text-sm">
            Ни один день серии пока не настроен
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {streakConfig.map((item) => (
              <div
                key={item.day_number}
                className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col justify-between relative group hover:border-amber-400 transition-all shadow-sm hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => handleDeleteDay(item.day_number)}
                  className="absolute top-3 right-3 p-1 text-gray-400 hover:text-red-500 rounded-lg text-xs transition-colors"
                  title="Удалить день"
                >
                  ✕
                </button>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center font-black text-amber-600 text-sm">
                    {item.day_number}d
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-extrabold">
                      День серии
                    </div>
                    <div className="text-sm font-black text-gray-900">
                      День {item.day_number}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 flex items-center gap-2.5">
                  {item.reward?.asset_url ? (
                    <img
                      src={item.reward.asset_url}
                      alt=""
                      className="w-8 h-8 object-contain"
                    />
                  ) : (
                    <span className="text-base">🎁</span>
                  )}
                  <div className="overflow-hidden min-w-0">
                    <div className="text-xs font-extrabold text-gray-900 truncate">
                      {item.reward?.title || "Неизвестная награда"}
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 capitalize">
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