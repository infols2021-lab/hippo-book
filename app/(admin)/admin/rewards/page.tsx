"use client";

import React, { useState } from "react";
import RewardsCatalogManager from "./RewardsCatalogManager";
import StreakConfigManager from "./StreakConfigManager";
import PromocodeManager from "./PromocodeManager";

type TabType = "catalog" | "streaks" | "promocodes";

export default function AdminRewardsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("catalog");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Шапка */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>🎭</span> Центр Наград и Маскота
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Управление предметами гардероба, титулами, настройка серии входа и промокодов.
            </p>
          </div>
        </div>

        {/* Переключатель табов */}
        <div className="flex gap-2 p-1.5 bg-slate-900/80 border border-slate-800 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab("catalog")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "catalog"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <span>🎨</span> Каталог Наград
          </button>

          <button
            onClick={() => setActiveTab("streaks")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "streaks"
                ? "bg-amber-600 text-white shadow-lg shadow-amber-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <span>🔥</span> Дорожка Стриков
          </button>

          <button
            onClick={() => setActiveTab("promocodes")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "promocodes"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <span>🎁</span> Промокоды & Логи
          </button>
        </div>

        {/* Контент активного таба */}
        <div className="transition-all duration-200">
          {activeTab === "catalog" && <RewardsCatalogManager />}
          {activeTab === "streaks" && <StreakConfigManager />}
          {activeTab === "promocodes" && <PromocodeManager />}
        </div>
      </div>
    </div>
  );
}