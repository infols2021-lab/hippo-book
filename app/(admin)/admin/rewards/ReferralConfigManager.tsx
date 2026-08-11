"use client";

import React, { useState, useEffect } from "react";
import type { RewardItem } from "@/lib/rewards/types";

type RewardsBundle = {
  rewards: string[];
  materials: string[];
  choice_count: number;
  has_physical: boolean;
};

type ReferralMilestone = {
  id: string;
  purchases_required: number;
  rewards_bundle: RewardsBundle;
};

export default function ReferralConfigManager() {
  const [milestones, setMilestones] = useState<ReferralMilestone[]>([]);
  const [catalog, setCatalog] = useState<RewardItem[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Стейт для открытой модалки-конструктора
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [catRes, matRes, confRes] = await Promise.all([
        fetch("/api/admin/rewards"),
        fetch("/api/admin/materials"), // предполагаем, что у тебя есть роут для получения материалов
        fetch("/api/admin/rewards/referral-config"),
      ]);

      const catData = await catRes.json();
      const matData = await matRes.json();
      const confData = await confRes.json();

      setCatalog(catData.rewards || []);
      setMaterials(matData.materials || matData.items || []); // Поддержка разных форматов ответа
      
      const sortedMilestones = (confData.milestones || []).map((m: any) => ({
        ...m,
        rewards_bundle: m.rewards_bundle || { rewards: [], materials: [], choice_count: 0, has_physical: false }
      })).sort(
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
    
    const newMilestone: ReferralMilestone = {
      id: crypto.randomUUID(),
      purchases_required: maxPurchases + 1,
      rewards_bundle: { rewards: [], materials: [], choice_count: 0, has_physical: false }
    };

    setMilestones([...milestones, newMilestone]);
    setEditingMilestoneId(newMilestone.id); // Сразу открываем на редактирование
  }

  function handleRemove(id: string) {
    if (!window.confirm("Удалить этот этап?")) return;
    setMilestones(milestones.filter((m) => m.id !== id));
    if (editingMilestoneId === id) setEditingMilestoneId(null);
  }

  function updateMilestone(id: string, updates: Partial<ReferralMilestone>) {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  }

  function updateBundle(id: string, bundleUpdates: Partial<RewardsBundle>) {
    setMilestones(prev => prev.map(m => {
      if (m.id !== id) return m;
      return { ...m, rewards_bundle: { ...m.rewards_bundle, ...bundleUpdates } };
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

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
      setEditingMilestoneId(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const activeMilestone = milestones.find(m => m.id === editingMilestoneId);

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
          milestones.map((m) => {
            const b = m.rewards_bundle;
            const itemsCount = b.rewards.length + b.materials.length + (b.has_physical ? 1 : 0);
            
            return (
              <div
                key={m.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr auto",
                  gap: 16,
                  alignItems: "center",
                  background: editingMilestoneId === m.id ? "#eff6ff" : "#f8fafc",
                  padding: "16px 20px",
                  borderRadius: 16,
                  border: `2px solid ${editingMilestoneId === m.id ? "#3b82f6" : "#e2e8f0"}`,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onClick={() => setEditingMilestoneId(m.id)}
              >
                <div>
                  <label className="small-muted" style={{ display: "block", marginBottom: 6 }}>Требуется покупок</label>
                  <input
                    type="number"
                    className="input"
                    min="1"
                    value={m.purchases_required}
                    onChange={(e) => updateMilestone(m.id, { purchases_required: parseInt(e.target.value) || 1 })}
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontWeight: 900, fontSize: 16 }}
                  />
                </div>

                <div>
                  <div style={{ fontWeight: 700, color: "#334155", marginBottom: 4 }}>Начинка этапа:</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    {itemsCount === 0 ? "Пусто (нажмите для настройки)" : `Выбрано элементов: ${itemsCount} ${b.choice_count > 0 ? `(можно выбрать ${b.choice_count})` : ''}`}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn small ghost"
                  onClick={(e) => { e.stopPropagation(); handleRemove(m.id); }}
                  style={{ color: "#ef4444" }}
                  title="Удалить этап"
                >
                  ✖
                </button>
              </div>
            );
          })
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

      {/* ПАНЕЛЬ НАСТРОЙКИ НАЧИНКИ (Как в промокодах) */}
      {activeMilestone && (
        <div style={{ marginTop: 24, padding: 20, background: "#fff", borderRadius: 16, border: "2px solid #3b82f6", boxShadow: "0 10px 25px rgba(59, 130, 246, 0.15)" }}>
          <h3 style={{ margin: "0 0 16px 0", color: "#1e3a8a" }}>Настройка награды для {activeMilestone.purchases_required} покупок</h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Каталог наград */}
            <div>
              <label style={{ fontWeight: 700, display: "block", marginBottom: 8 }}>🎭 Награды из каталога ({activeMilestone.rewards_bundle.rewards.length} выбр.)</label>
              <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #cbd5e1", borderRadius: 8, padding: 8, background: "#f8fafc" }}>
                {catalog.map(r => (
                  <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 6, cursor: "pointer" }}>
                    <input 
                      type="checkbox" 
                      checked={activeMilestone.rewards_bundle.rewards.includes(r.id)}
                      onChange={(e) => {
                        const newArr = e.target.checked 
                          ? [...activeMilestone.rewards_bundle.rewards, r.id]
                          : activeMilestone.rewards_bundle.rewards.filter(id => id !== r.id);
                        updateBundle(activeMilestone.id, { rewards: newArr });
                      }}
                    />
                    <span style={{ fontSize: 13, color: "#64748b" }}>[{r.type}]</span>
                    <span style={{ fontWeight: 600 }}>{r.title}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Конкретные материалы */}
            <div>
              <label style={{ fontWeight: 700, display: "block", marginBottom: 8 }}>📚 Конкретные материалы ({activeMilestone.rewards_bundle.materials.length} выбр.)</label>
              <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #cbd5e1", borderRadius: 8, padding: 8, background: "#f8fafc" }}>
                {materials.length === 0 ? <div className="small-muted">Нет материалов в базе</div> : materials.map(m => (
                  <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 6, cursor: "pointer" }}>
                    <input 
                      type="checkbox" 
                      checked={activeMilestone.rewards_bundle.materials.includes(m.id)}
                      onChange={(e) => {
                        const newArr = e.target.checked 
                          ? [...activeMilestone.rewards_bundle.materials, m.id]
                          : activeMilestone.rewards_bundle.materials.filter(id => id !== m.id);
                        updateBundle(activeMilestone.id, { materials: newArr });
                      }}
                    />
                    <span style={{ fontWeight: 600 }}>{m.title || m.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Сколько выбрать САМ */}
            <div>
              <label style={{ fontWeight: 700, display: "block", marginBottom: 8 }}>🎓 Сколько материалов ученик выбирает САМ (0 - выдается всё выбранное выше)</label>
              <input 
                type="number" 
                className="input" 
                min="0"
                value={activeMilestone.rewards_bundle.choice_count}
                onChange={(e) => updateBundle(activeMilestone.id, { choice_count: parseInt(e.target.value) || 0 })}
              />
            </div>

            {/* Физический подарок */}
            <label style={{ display: "flex", alignItems: "center", gap: 10, background: "#fffbeb", padding: 16, borderRadius: 12, border: "1px solid #fde68a", cursor: "pointer" }}>
              <input 
                type="checkbox" 
                style={{ width: 18, height: 18 }}
                checked={activeMilestone.rewards_bundle.has_physical}
                onChange={(e) => updateBundle(activeMilestone.id, { has_physical: e.target.checked })}
              />
              <span style={{ fontWeight: 800, color: "#92400e" }}>🧸 Добавить физический подарок</span>
            </label>

          </div>
        </div>
      )}
    </div>
  );
}