"use client";

import React, { useState, useEffect, useRef, DragEvent, ChangeEvent } from "react";
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

  // Состояния для Drag-and-Drop загрузки
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    void fetchRewards();
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
    setUploadError(null);
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

  // Загрузка файла в Яндекс / Supabase Storage
  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("Пожалуйста, загружайте только изображения (PNG, WEBP, SVG, JPG)");
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      const bodyData = new FormData();
      bodyData.append("file", file);
      bodyData.append("bucket", "question-images"); // Дефолтный бакет загрузки

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: bodyData,
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Ошибка при загрузке файла");
      }

      const uploadedUrl = data.publicUrl || data.url || "";
      setFormData((prev) => ({ ...prev, asset_url: uploadedUrl }));
    } catch (err: any) {
      setUploadError(err.message || "Не удалось загрузить изображение");
    } finally {
      setUploading(false);
    }
  };

  // Drag-and-Drop события
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (uploading) return;

    const file = e.dataTransfer.files[0];
    if (file) void handleFileUpload(file);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && !uploading) {
      void handleFileUpload(file);
    }
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
        void fetchRewards();
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
        void fetchRewards();
      }
    } catch (e) {
      alert("Ошибка при удалении");
    }
  };

  const filteredRewards =
    filterType === "all" ? rewards : rewards.filter((r) => r.type === filterType);

  return (
    <div className="space-y-6">
      {/* Панель фильтров и создания */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50 border border-gray-200 p-4 rounded-2xl">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterType === "all"
                ? "bg-gray-900 text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            Все ({rewards.length})
          </button>
          {REWARD_TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => setFilterType(t.type)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                filterType === t.type
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label.split(" / ")[0]}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => handleOpenModal()}
          className="px-4 py-2.5 bg-gray-900 hover:bg-black text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2"
        >
          <span className="text-base leading-none">+</span> Создать награду
        </button>
      </div>

      {/* Сетка предметов */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 font-bold text-sm">Загрузка каталога...</div>
      ) : filteredRewards.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-2xl text-gray-500 font-bold text-sm">
          Предметы не найдены
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRewards.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-gray-200 hover:border-gray-300 rounded-2xl p-4 flex flex-col justify-between transition-all shadow-sm hover:shadow-md"
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-3">
                  <span className="text-[11px] font-extrabold px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-lg text-gray-700">
                    {REWARD_TYPES.find((t) => t.type === item.type)?.icon} {item.type}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenModal(item)}
                      className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-lg text-xs transition-colors"
                      title="Редактировать"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-lg text-xs transition-colors"
                      title="Удалить"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Превью ассета или титула */}
                <div className="w-full h-32 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center mb-3 overflow-hidden relative">
                  {item.type === "title" ? (
                    <span
                      className="font-black text-xs px-3 py-1.5 rounded-full border shadow-sm"
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

                <h3 className="font-extrabold text-gray-900 text-base leading-tight mb-1">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="text-xs text-gray-500 font-medium line-clamp-2 mb-2">
                    {item.description}
                  </p>
                )}
              </div>

              {item.type !== "title" && (
                <div className="text-[10px] text-gray-400 font-mono font-bold mt-2 pt-2 border-t border-gray-100 flex justify-between">
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-black text-gray-900">
                {formData.id ? "Редактировать награду" : "Создать награду"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 font-bold p-1 rounded-lg text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Тип предмета
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as RewardType })
                  }
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
                >
                  {REWARD_TYPES.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.icon} {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
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
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Описание
                </label>
                <textarea
                  rows={2}
                  placeholder="Краткое описание предмета..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {formData.type === "title" ? (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Цвет титула (HEX)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className="h-10 w-12 bg-gray-50 border-2 border-gray-200 rounded-xl p-1 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-xl p-2.5 text-xs font-mono font-bold text-gray-800"
                    />
                  </div>
                </div>
              ) : (
                <>
                  {/* Drag and Drop зона для изображений */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Изображение предмета (PNG / SVG / WEBP)
                    </label>

                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => !uploading && fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all ${
                        isDragging
                          ? "border-blue-500 bg-blue-50/50 scale-[1.01]"
                          : "border-gray-200 bg-gray-50 hover:bg-gray-100/60"
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={uploading}
                      />

                      {formData.asset_url ? (
                        <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-gray-200">
                          <img
                            src={formData.asset_url}
                            alt="Превью"
                            className="w-12 h-12 object-contain rounded-lg border bg-gray-50"
                          />
                          <div className="flex-1 text-left min-w-0">
                            <div className="text-[11px] font-extrabold text-green-700 truncate">
                              ✅ Изображение прикреплено
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono truncate">
                              {formData.asset_url}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFormData({ ...formData, asset_url: "" });
                            }}
                            className="text-xs font-bold text-red-500 hover:text-red-700 p-1"
                          >
                            ✖
                          </button>
                        </div>
                      ) : (
                        <div className="py-2">
                          <div className="text-2xl mb-1">{uploading ? "⚡" : "📦"}</div>
                          <div className="text-xs font-bold text-gray-800">
                            {uploading ? "Загружаем картинку в Storage..." : "Перетащите сюда изображение"}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            или кликните для выбора файла
                          </div>
                        </div>
                      )}
                    </div>

                    {uploadError && (
                      <div className="text-[11px] font-bold text-red-600 mt-1">
                        ⚠️ {uploadError}
                      </div>
                    )}

                    {/* Поле прямого ввода ссылки на всякий случай */}
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="Или вставьте прямую ссылку..."
                        value={formData.asset_url}
                        onChange={(e) =>
                          setFormData({ ...formData, asset_url: e.target.value })
                        }
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2 text-[11px] font-mono text-gray-700 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">
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
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-2 text-xs font-bold text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">
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
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-2 text-xs font-bold text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1">
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
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-2 text-xs font-bold text-gray-800"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl disabled:opacity-50 transition-colors shadow-sm"
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