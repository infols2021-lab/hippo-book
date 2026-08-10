"use client";

import React, { useState, useEffect } from "react";
import type { RewardItem } from "@/lib/rewards/types";

type ReferralMilestone = {
  id: string;
  purchases_required: number;
  reward_id: string | null;
};

export default function ReferralConfigManager() {
  const [milestones, setMilestones] = useState<ReferralMilestone[]>([]);
  const [catalog, setCatalog] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [catRes, confRes] = await Promise.all([
        fetch("/api/admin/rewards"),
        fetch("/api/admin/rewards/referral-config"),
      ]);

      const catData = await catRes.json();
      const confData = await confRes.json();

      if (!catRes.ok) throw new Error(catData.error || "Ошибка загрузки каталога");
      if (!confRes.ok) throw new Error(confData.error || "Ошибка загрузки настроек");

      setCatalog(catData.rewards || []);
      
      const sortedMilestones = (confData.milestones || []).sort(
        (a: ReferralMilestone, b: ReferralMilestone) => a.purchases_required - b.purchases_required
      );
      setMilestones(sortedMilestones);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleAdd() {
    const maxPurchases = milestones.length > 0 
      ? Math.max(...milestones.map(m => m.purchases_required)) 
      : 0;
    
    setMilestones([
      ...milestones,
      {
        id: crypto.randomUUID(),
        purchases_required: maxPurchases + 1,
        reward_id: null,
      },
    ]);
  }

  function handleRemove(id: string) {
    if (!window.confirm("Удалить этот этап?")) return;
    setMilestones(milestones.filter((m) => m.id !== id));
  }

  function handleChange(id: string, field: keyof ReferralMilestone, value: any) {
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        return { ...m, [field]: value };
      }).sort((a, b) => a.purchases_required - b.purchases_required)
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    // Валидация на дубликаты
    const counts = new Set();
    for (const m of milestones) {
      if (counts.has(m.purchases_required)) {
        setError(`Ошибка: количество покупок "${m.purchases_required}" дублируется.`);
        setSaving(false);
        return;
      }
      counts.add(m.purchases_required);
    }

    try {
      const res = await fetch("/api/admin/rewards/referral-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestones }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка при сохранении");

      setSuccessMsg("✅ Настройки реферальной дорожки сохранены!");
      setTimeout(() => setSuccessMsg(null), 3000);
      
      const sortedMilestones = (data.milestones || []).sort(
        (a: ReferralMilestone, b: ReferralMilestone) => a.purchases_required - b.purchases_required
      );
      setMilestones(sortedMilestones);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", fontWeight: 800, color: "#64748b" }}>Загрузка настроек...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: 20, fontWeight: 900 }}>🤝 Настройка дорожки рефералов</h2>
        <div className="small-muted">
          Установите количество купленных материалов, необходимое для получения награды рефоводом.
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", color: "#991b1b", padding: "12px 16px", borderRadius: 12, marginBottom: 20, fontWeight: 700, border: "1px solid #fecdd3" }}>
          {error}
        </div>
      )}

      {successMsg && (
        <div style={{ background: "#f0fdf4", color: "#166534", padding: "12px 16px", borderRadius: 12, marginBottom: 20, fontWeight: 700, border: "1px solid #bbf7d0" }}>
          {successMsg}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {milestones.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", background: "#f8fafc", borderRadius: 16, border: "2px dashed #cbd5e1", color: "#64748b", fontWeight: 700 }}>
            Дорожка пока пуста. Нажмите «Добавить этап».
          </div>
        ) : (
          milestones.map((m) => (
            <div
              key={m.id}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr auto",
                gap: 16,
                alignItems: "center",
                background: "#f8fafc",
                padding: "16px 20px",
                borderRadius: 16,
                border: "1px solid #e2e8f0",
              }}
            >
              <div>
                <label className="small-muted" style={{ display: "block", marginBottom: 6 }}>Покупок материалов</label>
                <input
                  type="number"
                  className="input"
                  min="1"
                  value={m.purchases_required}
                  onChange={(e) => handleChange(m.id, "purchases_required", parseInt(e.target.value) || 1)}
                  style={{ fontWeight: 900, fontSize: 16 }}
                />
              </div>

              <div>
                <label className="small-muted" style={{ display: "block", marginBottom: 6 }}>Награда из каталога</label>
                <select
                  className="input"
                  value={m.reward_id || ""}
                  onChange={(e) => handleChange(m.id, "reward_id", e.target.value || null)}
                  style={{ fontWeight: 700 }}
                >
                  <option value="">-- Без награды --</option>
                  {catalog.map((r) => (
                    <option key={r.id} value={r.id}>
                      [{r.type.toUpperCase()}] {r.title}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="btn small ghost"
                onClick={() => handleRemove(m.id)}
                style={{ color: "#ef4444", alignSelf: "flex-end", marginBottom: 4 }}
                title="Удалить этап"
              >
                ✖
              </button>
            </div>
          ))
        )}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button type="button" className="btn secondary" onClick={handleAdd} disabled={saving}>
          ➕ Добавить этап
        </button>
        <button type="button" className="btn" onClick={handleSave} disabled={saving}>
          {saving ? "Сохранение..." : "💾 Сохранить дорожку"}
        </button>
      </div>
    </div>
  );
}