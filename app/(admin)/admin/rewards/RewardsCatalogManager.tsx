"use client";

import React, { useState, useEffect } from "react";
import type { RewardItem, RewardType } from "@/lib/rewards/types";

const REWARD_TYPES: { type: RewardType; label: string; icon: string }[] = [
  { type: "hat", label: "Головной убор / Шляпа", icon: "👑" },
  { type: "aura", label: "Аура / Эффект сзади", icon: "✨" },
  { type: "emotion", label: "Эмоция / Лицо", icon: "😄" },
  { type: "base", label: "База Маскота", icon: "☁️" },
  { type: "title", label: "Титул профиля", icon: "🏷️" },
];

export default function RewardsCatalogManager() {
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Форма предмета
  const [formData, setFormData] = useState<{
    id?: string;
    type: RewardType;
    title: string;
    description: string;
    asset_url: string;
    offset_x: number;
    offset_y: number;
    scale: number;
    color: string;
  }>({
    type: "hat",
    title: "",
    description: "",
    asset_url: "",
    offset_x: 0,
    offset_y: 0,
    scale: 1,
    color: "#8b5cf6",
  });

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/rewards");
      const data = await res.json();
      if (res.ok) {
        setRewards(data.rewards || []);
      }
    } catch (e) {
      console.error("Failed to load rewards:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item?: RewardItem) => {
    if (item) {
      setFormData({
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.description || "",
        asset_url: item.asset_url || "",
        offset_x: Number(item.meta?.offset_x || 0),
        offset_y: Number(item.meta?.offset_y || 0),
        scale: Number(item.meta?.scale || 1),
        color: String(item.meta?.color || "#8b5cf6"),
      });
    } else {
      setFormData({
        type: "hat",
        title: "",
        description: "",
        asset_url: "",
        offset_x: 0,
        offset_y: 0,
        scale: 1,
        color: "#8b5cf6",
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      id: formData.id,
      type: formData.type,
      title: formData.title,
      description: formData.description,
      asset_url: formData.asset_url,
      meta: {
        offset_x: formData.offset_x,
        offset_y: formData.offset_y,
        scale: formData.scale,
        color: formData.color,
      },
    };

    try {
      const res = await fetch("/api/admin/rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchRewards();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка сохранения");
      }
    } catch (e) {
      alert("Ошибка сети при сохранении");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Вы уверены, что хотите удалить эту награду из каталога?")) return;

    try {
      const res = await fetch(`/api/admin/rewards?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchRewards();
      }
    } catch (e) {
      alert("Ошибка при удалении");
    }
  };

  const filteredRewards = filterType === "all"
    ? rewards
    : rewards.filter((r) => r.type === filterType);

  return (
    <div className="space-y-6">
      {/* Панель фильтров и действий */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterType === "all"
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:bg-slate-800"
            }`}
          >
            Все ({rewards.length})
          </button>
          {REWARD_TYPES.map((t) => (
            <button
              key={t.type}
              onClick={() => setFilterType(t.type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                filterType === t.type
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:bg-slate-800"
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label.split(" / ")[0]}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
        >
          <span>+</span> Создать награду
        </button>
      </div>

      {/* Сетка предметов */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Загрузка каталога...</div>
      ) : filteredRewards.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-400">
          Предметы не найдены
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRewards.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between transition-all"
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-3">
                  <span className="text-xs font-semibold px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-slate-300">
                    {REWARD_TYPES.find((t) => t.type === item.type)?.icon} {item.type}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenModal(item)}
                      className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs"
                      title="Редактировать"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg text-xs"
                      title="Удалить"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Превью ассета или титула */}
                <div className="w-full h-32 bg-slate-950 border border-slate-800/80 rounded-xl flex items-center justify-center mb-3 overflow-hidden relative">
                  {item.type === "title" ? (
                    <span
                      className="font-bold text-sm px-3 py-1 rounded-full border shadow-sm"
                      style={{
                        borderColor: item.meta?.color || "#8b5cf6",
                        color: item.meta?.color || "#8b5cf6",
                        backgroundColor: `${item.meta?.color || "#8b5cf6"}15`,
                      }}
                    >
                      «{item.title}»
                    </span>
                  ) : item.asset_url ? (
                    <img
                      src={item.asset_url}
                      alt={item.title}
                      className="max-h-24 max-w-24 object-contain"
                    />
                  ) : (
                    <span className="text-3xl opacity-30">🖼️</span>
                  )}
                </div>

                <h3 className="font-bold text-white text-base leading-tight mb-1">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 mb-2">
                    {item.description}
                  </p>
                )}
              </div>

              {item.type !== "title" && (
                <div className="text-[10px] text-slate-500 font-mono mt-2 pt-2 border-t border-slate-800/60 flex justify-between">
                  <span>
                    Off: {item.meta?.offset_x || 0}, {item.meta?.offset_y || 0}
                  </span>
                  <span>Scale: {item.meta?.scale || 1}x</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Модалка создания / редактирования */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-bold text-white">
              {formData.id ? "Редактировать награду" : "Создать награду"}
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Тип предмета
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as RewardType })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {REWARD_TYPES.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.icon} {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Название
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Золотая Корона"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Описание
                </label>
                <textarea
                  rows={2}
                  placeholder="Краткое описание предмета..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {formData.type === "title" ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Цвет титула (HEX)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className="h-10 w-12 bg-slate-950 border border-slate-800 rounded-xl p-1 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white font-mono"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">
                      Ссылка на изображение (PNG / SVG)
                    </label>
                    <input
                      type="text"
                      placeholder="/mascot/hats/crown.png"
                      value={formData.asset_url}
                      onChange={(e) =>
                        setFormData({ ...formData, asset_url: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                        Offset X (px)
                      </label>
                      <input
                        type="number"
                        value={formData.offset_x}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            offset_x: Number(e.target.value),
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                        Offset Y (px)
                      </label>
                      <input
                        type="number"
                        value={formData.offset_y}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            offset_y: Number(e.target.value),
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                        Scale
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.scale}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            scale: Number(e.target.value),
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl disabled:opacity-50"
                >
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}