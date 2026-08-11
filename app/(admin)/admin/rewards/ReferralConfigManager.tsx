"use client";

import React, { useState, useEffect } from "react";
import type { RewardItem } from "@/lib/rewards/types";

type RewardsBundle = {
  rewards: string[];
  materials: string[];
  choice_count: number;
  has_physical: boolean;
  max_price: number;
};

type ReferralMilestone = {
  id: string;
  purchases_required: number;
  rewards_bundle: RewardsBundle;
};

const defaultBundle: RewardsBundle = {
  rewards: [],
  materials: [],
  choice_count: 0,
  has_physical: false,
  max_price: 0,
};

export default function ReferralConfigManager() {
  const [milestones, setMilestones] = useState<ReferralMilestone[]>([]);
  const [welcomeBundle, setWelcomeBundle] = useState<RewardsBundle>(defaultBundle);
  
  const [catalog, setCatalog] = useState<RewardItem[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [editingWelcome, setEditingWelcome] = useState<boolean>(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [catRes, matRes, confRes] = await Promise.all([
        fetch("/api/admin/rewards"),
        fetch("/api/admin/materials"),
        fetch("/api/admin/rewards/referral-config"),
      ]);

      const catData = await catRes.json();
      const matData = await matRes.json();
      const confData = await confRes.json();

      setCatalog(catData.rewards || []);
      setMaterials(matData.materials || matData.items || []); 
      
      const sortedMilestones = (confData.milestones || []).map((m: any) => ({
        ...m,
        rewards_bundle: m.rewards_bundle || { ...defaultBundle }
      })).sort(
        (a: ReferralMilestone, b: ReferralMilestone) => a.purchases_required - b.purchases_required
      );
      setMilestones(sortedMilestones);
      
      if (confData.welcome_bundle) {
        setWelcomeBundle({ ...defaultBundle, ...confData.welcome_bundle });
      }
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
      rewards_bundle: { ...defaultBundle }
    };

    setMilestones([...milestones, newMilestone]);
    setEditingMilestoneId(newMilestone.id);
    setEditingWelcome(false);
  }

  function handleRemove(id: string) {
    if (!window.confirm("Удалить этот этап?")) return;
    setMilestones(milestones.filter((m) => m.id !== id));
    if (editingMilestoneId === id) setEditingMilestoneId(null);
  }

  function updateMilestone(id: string, updates: Partial<ReferralMilestone>) {
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m).sort(
      (a, b) => a.purchases_required - b.purchases_required
    ));
  }

  function updateBundle(id: string, bundleUpdates: Partial<RewardsBundle>) {
    setMilestones(prev => prev.map(m => {
      if (m.id !== id) return m;
      return { ...m, rewards_bundle: { ...m.rewards_bundle, ...bundleUpdates } };
    }));
  }

  function updateWelcomeBundle(updates: Partial<RewardsBundle>) {
    setWelcomeBundle(prev => ({ ...prev, ...updates }));
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
        body: JSON.stringify({ 
          milestones,
          welcome_bundle: welcomeBundle
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка при сохранении");

      setSuccessMsg("Настройки реферальной системы сохранены");
      setTimeout(() => setSuccessMsg(null), 3000);
      
      const sortedMilestones = (data.milestones || []).sort(
        (a: ReferralMilestone, b: ReferralMilestone) => a.purchases_required - b.purchases_required
      );
      setMilestones(sortedMilestones);
      
      if (data.welcome_bundle) {
        setWelcomeBundle({ ...defaultBundle, ...data.welcome_bundle });
      }

      setEditingMilestoneId(null);
      setEditingWelcome(false);
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
        <h2 style={{ margin: "0 0 8px 0", fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
          Настройка реферальной программы
        </h2>
        <div className="small-muted">
          Управление приветственными бонусами для новичков и этапами наград для приглашающих.
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

      {/* ПРИВЕТСТВЕННЫЙ БОНУС */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: "#334155", marginBottom: 12 }}>Приветственный бонус</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 16,
            alignItems: "center",
            background: editingWelcome ? "#eff6ff" : "#f8fafc",
            padding: "16px 20px",
            borderRadius: 16,
            border: `2px solid ${editingWelcome ? "#3b82f6" : "#e2e8f0"}`,
            cursor: "pointer",
            transition: "all 0.2s"
          }}
          onClick={() => {
            setEditingWelcome(true);
            setEditingMilestoneId(null);
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: "#334155", marginBottom: 4 }}>Выдается новичку при вводе кода</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              {welcomeBundle.rewards.length + welcomeBundle.materials.length + (welcomeBundle.has_physical ? 1 : 0) === 0 
                ? "Бонус отключен (пусто)" 
                : `Элементов в бонусе: ${welcomeBundle.rewards.length + welcomeBundle.materials.length + (welcomeBundle.has_physical ? 1 : 0)}`
              }
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: editingWelcome ? "#3b82f6" : "#64748b" }}>
            Настроить
          </div>
        </div>
      </div>

      {/* ЭТАПЫ (ДОРОЖКА) */}
      <h3 style={{ fontSize: 16, fontWeight: 800, color: "#334155", marginBottom: 12 }}>Дорожка наград для рефоводов</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {milestones.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", background: "#f8fafc", borderRadius: 16, border: "2px dashed #cbd5e1", color: "#64748b", fontWeight: 700 }}>
            Дорожка пока пуста.
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
                onClick={() => {
                  setEditingMilestoneId(m.id);
                  setEditingWelcome(false);
                }}
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
                  <div style={{ fontWeight: 700, color: "#334155", marginBottom: 4 }}>Начинка этапа</div>
                  <div style={{ fontSize: 13, color: "#64748b" }}>
                    {itemsCount === 0 ? "Пусто" : `Выбрано элементов: ${itemsCount} ${b.choice_count > 0 ? `(выбор ${b.choice_count})` : ''}`}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn small ghost"
                  onClick={(e) => { e.stopPropagation(); handleRemove(m.id); }}
                  style={{ color: "#ef4444" }}
                >
                  Удалить
                </button>
              </div>
            );
          })
        )}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button type="button" className="btn secondary" onClick={handleAdd} disabled={saving}>
          + Добавить этап
        </button>
        <button type="button" className="btn" onClick={handleSave} disabled={saving}>
          {saving ? "Сохранение..." : "Сохранить изменения"}
        </button>
      </div>

      {/* ПАНЕЛЬ НАСТРОЙКИ НАЧИНКИ (Общая для этапа и приветственного бонуса) */}
      {(activeMilestone || editingWelcome) && (
        <div style={{ marginTop: 24, padding: 24, background: "#fff", borderRadius: 16, border: "2px solid #3b82f6", boxShadow: "0 10px 25px rgba(59, 130, 246, 0.15)" }}>
          <h3 style={{ margin: "0 0 20px 0", color: "#1e3a8a", fontSize: 18, fontWeight: 900 }}>
            {editingWelcome ? "Конструктор приветственного бонуса" : `Конструктор этапа (${activeMilestone?.purchases_required} покупок)`}
          </h3>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* Каталог наград */}
            <div style={{ background: "#f8fafc", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <label style={{ fontWeight: 800, display: "block", marginBottom: 12, color: "#334155" }}>
                Награды из каталога ({(editingWelcome ? welcomeBundle : activeMilestone!.rewards_bundle).rewards.length} выбр.)
              </label>
              <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #cbd5e1", borderRadius: 8, padding: 8, background: "#fff" }}>
                {catalog.length === 0 ? <div className="small-muted">Каталог пуст</div> : catalog.map(r => {
                  const isChecked = editingWelcome 
                    ? welcomeBundle.rewards.includes(r.id)
                    : activeMilestone!.rewards_bundle.rewards.includes(r.id);

                  return (
                    <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                      <input 
                        type="checkbox" 
                        style={{ width: 16, height: 16 }}
                        checked={isChecked}
                        onChange={(e) => {
                          const currentArr = editingWelcome ? welcomeBundle.rewards : activeMilestone!.rewards_bundle.rewards;
                          const newArr = e.target.checked ? [...currentArr, r.id] : currentArr.filter(id => id !== r.id);
                          if (editingWelcome) updateWelcomeBundle({ rewards: newArr });
                          else updateBundle(activeMilestone!.id, { rewards: newArr });
                        }}
                      />
                      <span style={{ fontSize: 12, color: "#64748b", background: "#f1f5f9", padding: "2px 6px", borderRadius: 4 }}>{r.type}</span>
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>{r.title}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Конкретные материалы */}
            <div style={{ background: "#f8fafc", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0" }}>
              <label style={{ fontWeight: 800, display: "block", marginBottom: 12, color: "#334155" }}>
                Материалы ({(editingWelcome ? welcomeBundle : activeMilestone!.rewards_bundle).materials.length} выбр.)
              </label>
              <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #cbd5e1", borderRadius: 8, padding: 8, background: "#fff" }}>
                {materials.length === 0 ? <div className="small-muted">Нет материалов в базе</div> : materials.map(m => {
                  const isChecked = editingWelcome 
                    ? welcomeBundle.materials.includes(m.id)
                    : activeMilestone!.rewards_bundle.materials.includes(m.id);

                  return (
                    <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, cursor: "pointer", borderBottom: "1px solid #f1f5f9" }}>
                      <input 
                        type="checkbox" 
                        style={{ width: 16, height: 16 }}
                        checked={isChecked}
                        onChange={(e) => {
                          const currentArr = editingWelcome ? welcomeBundle.materials : activeMilestone!.rewards_bundle.materials;
                          const newArr = e.target.checked ? [...currentArr, m.id] : currentArr.filter(id => id !== m.id);
                          if (editingWelcome) updateWelcomeBundle({ materials: newArr });
                          else updateBundle(activeMilestone!.id, { materials: newArr });
                        }}
                      />
                      <span style={{ fontWeight: 600, color: "#1e293b" }}>{m.title || m.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Настройки выбора и цены */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ background: "#f8fafc", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <label style={{ fontWeight: 800, display: "block", marginBottom: 8, color: "#334155" }}>Лимит выбора учеником</label>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                  Сколько материалов из списка выше ученик может выбрать сам. 0 — выдается всё автоматически.
                </div>
                <input 
                  type="number" 
                  className="input" 
                  min="0"
                  style={{ width: "100%", fontWeight: 800 }}
                  value={(editingWelcome ? welcomeBundle : activeMilestone!.rewards_bundle).choice_count}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    if (editingWelcome) updateWelcomeBundle({ choice_count: val });
                    else updateBundle(activeMilestone!.id, { choice_count: val });
                  }}
                />
              </div>

              <div style={{ background: "#f8fafc", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <label style={{ fontWeight: 800, display: "block", marginBottom: 8, color: "#334155" }}>Максимальная цена (₽)</label>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
                  Лимит стоимости материала, который ученик может выбрать. 0 — без ограничений по цене.
                </div>
                <input 
                  type="number" 
                  className="input" 
                  min="0"
                  style={{ width: "100%", fontWeight: 800 }}
                  value={(editingWelcome ? welcomeBundle : activeMilestone!.rewards_bundle).max_price}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    if (editingWelcome) updateWelcomeBundle({ max_price: val });
                    else updateBundle(activeMilestone!.id, { max_price: val });
                  }}
                />
              </div>
            </div>

            {/* Физический подарок */}
            <label style={{ display: "flex", alignItems: "center", gap: 12, background: "#fffbeb", padding: "16px 20px", borderRadius: 12, border: "1px solid #fde68a", cursor: "pointer", transition: "background 0.2s" }}>
              <input 
                type="checkbox" 
                style={{ width: 20, height: 20, accentColor: "#d97706" }}
                checked={(editingWelcome ? welcomeBundle : activeMilestone!.rewards_bundle).has_physical}
                onChange={(e) => {
                  const val = e.target.checked;
                  if (editingWelcome) updateWelcomeBundle({ has_physical: val });
                  else updateBundle(activeMilestone!.id, { has_physical: val });
                }}
              />
              <span style={{ fontWeight: 800, color: "#92400e", fontSize: 15 }}>Добавить физический подарок</span>
            </label>

            {/* Кнопка Готово */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button 
                type="button" 
                onClick={() => {
                  setEditingMilestoneId(null);
                  setEditingWelcome(false);
                }}
                style={{
                  background: "#0f172a",
                  color: "#fff",
                  border: "none",
                  borderRadius: "12px",
                  padding: "10px 24px",
                  fontWeight: 800,
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "opacity 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
              >
                Готово (Свернуть)
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}