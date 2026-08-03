"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import RewardsCatalogManager from "./RewardsCatalogManager";
import StreakConfigManager from "./StreakConfigManager";
import PromocodeManager from "./PromocodeManager";

type TabType = "catalog" | "streaks" | "promocodes";

export default function AdminRewardsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("catalog");

  return (
    <div className="admin-container">
      {/* Верхняя шапка в стиле главной админки */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 900, display: "flex", alignItems: "center", gap: "10px" }}>
              <span>🎭</span> Центр Наград и Маскота
            </h1>
            <div className="small-muted" style={{ marginTop: 4 }}>
              Управление предметами гардероба, титулами, настройка серии входа и промокодов.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              className="btn small secondary"
              type="button"
              onClick={() => router.push("/admin")}
            >
              ← Назад в админку
            </button>
            <button
              className="btn small"
              type="button"
              onClick={() => router.push("/portal")}
            >
              🏠 Портал
            </button>
          </div>
        </div>

        {/* Переключатель табов */}
        <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setActiveTab("catalog")}
            className={`btn ${activeTab === "catalog" ? "" : "ghost"}`}
            style={{ borderRadius: 14, fontWeight: 900 }}
          >
            🎨 Каталог Наград
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("streaks")}
            className={`btn ${activeTab === "streaks" ? "" : "ghost"}`}
            style={{ borderRadius: 14, fontWeight: 900 }}
          >
            🔥 Дорожка Стриков
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("promocodes")}
            className={`btn ${activeTab === "promocodes" ? "" : "ghost"}`}
            style={{ borderRadius: 14, fontWeight: 900 }}
          >
            🎁 Промокоды & Логи
          </button>
        </div>
      </div>

      {/* Контент активного таба */}
      <div className="card">
        {activeTab === "catalog" && <RewardsCatalogManager />}
        {activeTab === "streaks" && <StreakConfigManager />}
        {activeTab === "promocodes" && <PromocodeManager />}
      </div>
    </div>
  );
}