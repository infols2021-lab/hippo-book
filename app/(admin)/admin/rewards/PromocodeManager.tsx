"use client";

import React, { useState, useEffect, useRef, DragEvent, ChangeEvent, useMemo } from "react";
import type { PromocodeItem, PromocodeRedemption, RewardItem } from "@/lib/rewards/types";

interface ProjectItem {
  id: string;
  name: string;
  slug: string;
}

interface MaterialCatalogItem {
  id: string;
  title: string;
  is_secret?: boolean;
}

export default function PromocodeManager() {
  const [promocodes, setPromocodes] = useState<PromocodeItem[]>([]);
  const [redemptions, setRedemptions] = useState<PromocodeRedemption[]>([]);
  const [rewardsCatalog, setRewardsCatalog] = useState<RewardItem[]>([]);
  const [materialsCatalog, setMaterialsCatalog] = useState<MaterialCatalogItem[]>([]);
  const [projectsList, setProjectsList] = useState<ProjectItem[]>([]);

  // ✅ Состояние для поиска материалов в селекторе
  const [materialSearch, setMaterialSearch] = useState<string>("");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState<"constructor" | "logs">("constructor");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Drag and Drop
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Поля формы
  const [formId, setFormId] = useState<string | undefined>(undefined);
  const [code, setCode] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Ограничения
  const [hasMaxUses, setHasMaxUses] = useState(false);
  const [maxUses, setMaxUses] = useState<number>(1);
  const [hasExpiresAt, setHasExpiresAt] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string>("");

  // Начинка
  const [selectedRewardIds, setSelectedRewardIds] = useState<string[]>([]);
  const [selectedSpecificMaterialIds, setSelectedSpecificMaterialIds] = useState<string[]>([]);
  const [materialChoiceCount, setMaterialChoiceCount] = useState<number>(0);

  // Физический приз
  const [hasPhysicalPrize, setHasPhysicalPrize] = useState(false);
  const [physicalTitle, setPhysicalTitle] = useState("");
  const [physicalText, setPhysicalText] = useState("");
  const [physicalImageUrl, setPhysicalImageUrl] = useState("");

  useEffect(() => {
    void loadAllData();
  }, []);

  // ✅ Фильтрация материалов по поисковому запросу (без учёта регистра)
  const filteredMaterials = useMemo(() => {
    if (!materialSearch.trim()) return materialsCatalog;
    const search = materialSearch.trim().toLowerCase();
    return materialsCatalog.filter((m) =>
      m.title.toLowerCase().includes(search)
    );
  }, [materialsCatalog, materialSearch]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [promosRes, rewardsRes, projectsRes] = await Promise.all([
        fetch("/api/admin/promocodes"),
        fetch("/api/admin/rewards"),
        fetch("/api/projects"),
      ]);

      const promosData = await promosRes.json();
      const rewardsData = await rewardsRes.json();
      const projectsData = await projectsRes.json();

      if (promosRes.ok) {
        setPromocodes(promosData.promocodes || []);
        setRedemptions(promosData.redemptions || []);
      }
      if (rewardsRes.ok) {
        setRewardsCatalog(rewardsData.rewards || []);
      }
      if (projectsRes.ok) {
        const pList = projectsData.projects || [];
        setProjectsList(pList);

        // ✅ Загружаем материалы через админский эндпоинт, чтобы видеть секретные
        const matPromises = pList.map((p: ProjectItem) =>
          fetch(`/api/admin/projects/${p.id}/materials`).then((r) => r.json())
        );
        const matResults = await Promise.all(matPromises);
        const allMats = matResults.flatMap((mRes) => mRes.materials || mRes.data || []);
        setMaterialsCatalog(allMats);
      }
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item?: PromocodeItem) => {
    setUploadError(null);
    // Сбрасываем поиск при открытии модалки
    setMaterialSearch("");
    if (item) {
      setFormId(item.id);
      setCode(item.code);
      setIsActive(item.is_active);

      setHasMaxUses(item.max_uses !== null);
      setMaxUses(item.max_uses || 1);

      setHasExpiresAt(item.expires_at !== null);
      setExpiresAt(
        item.expires_at ? new Date(item.expires_at).toISOString().slice(0, 16) : ""
      );

      const bundle = item.rewards_bundle || {};
      setSelectedRewardIds(bundle.reward_ids || []);
      setSelectedSpecificMaterialIds(bundle.specific_material_ids || []);
      setMaterialChoiceCount(bundle.material_choice_count || 0);

      const phys = bundle.custom_physical;
      if (phys) {
        setHasPhysicalPrize(true);
        setPhysicalTitle(phys.title || "");
        setPhysicalText(phys.text || "");
        setPhysicalImageUrl(phys.image_url || "");
      } else {
        setHasPhysicalPrize(false);
        setPhysicalTitle("");
        setPhysicalText("");
        setPhysicalImageUrl("");
      }
    } else {
      setFormId(undefined);
      setCode("");
      setIsActive(true);
      setHasMaxUses(false);
      setMaxUses(1);
      setHasExpiresAt(false);
      setExpiresAt("");
      setSelectedRewardIds([]);
      setSelectedSpecificMaterialIds([]);
      setMaterialChoiceCount(0);
      setHasPhysicalPrize(false);
      setPhysicalTitle("");
      setPhysicalText("");
      setPhysicalImageUrl("");
    }
    setIsModalOpen(true);
  };

  const handleToggleReward = (id: string) => {
    setSelectedRewardIds((prev) =>
      prev.includes(id) ? prev.filter((rId) => rId !== id) : [...prev, id]
    );
  };

  const handleToggleSpecificMaterial = (id: string) => {
    setSelectedSpecificMaterialIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError("Пожалуйста, загружайте только изображения");
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      const bodyData = new FormData();
      bodyData.append("file", file);
      bodyData.append("bucket", "question-images");

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: bodyData,
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Ошибка при загрузке файла");
      }

      const uploadedUrl = data.publicUrl || data.url || "";
      setPhysicalImageUrl(uploadedUrl);
    } catch (err: any) {
      setUploadError(err.message || "Не удалось загрузить изображение");
    } finally {
      setUploading(false);
    }
  };

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

  const handleSavePromocode = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      id: formId,
      code,
      is_active: isActive,
      max_uses: hasMaxUses ? maxUses : null,
      expires_at: hasExpiresAt && expiresAt ? new Date(expiresAt).toISOString() : null,
      rewards_bundle: {
        reward_ids: selectedRewardIds,
        specific_material_ids: selectedSpecificMaterialIds,
        material_choice_count: Number(materialChoiceCount) || 0,
        custom_physical: hasPhysicalPrize
          ? {
              title: physicalTitle,
              text: physicalText,
              image_url: physicalImageUrl || null,
            }
          : null,
      },
    };

    try {
      const res = await fetch("/api/admin/promocodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        void loadAllData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка сохранения промокода");
      }
    } catch (e) {
      alert("Ошибка сети при сохранении промокода");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePromocode = async (id: string) => {
    if (!confirm("Удалить этот промокод?")) return;

    try {
      const res = await fetch(`/api/admin/promocodes?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        void loadAllData();
      }
    } catch (e) {
      alert("Ошибка при удалении промокода");
    }
  };

  const handleClearAllLogs = async () => {
    if (!confirm("Вы уверены, что хотите полностью очистить всю историю активаций промокодов?")) return;

    try {
      const res = await fetch("/api/admin/promocodes?clearLogs=true", { method: "DELETE" });
      if (res.ok) {
        void loadAllData();
      } else {
        alert("Не удалось очистить историю логов.");
      }
    } catch (e) {
      alert("Ошибка сети при очистке логов.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Переключатель подтабов */}
      <div className="flex justify-between items-center bg-gray-50 p-4 border border-gray-200 rounded-2xl">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab("constructor")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === "constructor"
                ? "bg-gray-900 text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            📋 Список Промокодов ({promocodes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("logs")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === "logs"
                ? "bg-gray-900 text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            📊 История Активаций ({redemptions.length})
          </button>
        </div>

        {activeSubTab === "constructor" ? (
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2"
          >
            <span className="text-base leading-none">+</span> Создать Промокод
          </button>
        ) : (
          <button
            type="button"
            onClick={handleClearAllLogs}
            disabled={redemptions.length === 0}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2"
          >
            🗑️ Очистить историю логов
          </button>
        )}
      </div>

      {/* Список промокодов */}
      {activeSubTab === "constructor" && (
        <>
          {loading ? (
            <div className="text-center py-12 text-gray-500 font-bold text-sm">Загрузка промокодов...</div>
          ) : promocodes.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 border border-gray-200 rounded-2xl text-gray-500 font-bold text-sm">
              Промокоды еще не созданы
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {promocodes.map((promo) => {
                const bundle = promo.rewards_bundle || {};
                const isExpired = Boolean(
                  promo.expires_at && new Date(promo.expires_at) < new Date()
                );
                const isLimitReached =
                  promo.max_uses !== null && promo.current_uses >= promo.max_uses;

                return (
                  <div
                    key={promo.id}
                    className={`bg-white border rounded-2xl p-5 flex flex-col justify-between transition-all shadow-sm hover:shadow-md ${
                      !promo.is_active || isExpired || isLimitReached
                        ? "border-gray-200 opacity-60"
                        : "border-gray-200 hover:border-emerald-500/50"
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <span className="font-mono font-black text-lg text-emerald-700 tracking-wider px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-xl">
                          {promo.code}
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenModal(promo)}
                            className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-lg text-xs transition-colors"
                            title="Редактировать"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePromocode(promo.id)}
                            className="p-1.5 hover:bg-red-50 text-gray-500 hover:text-red-600 rounded-lg text-xs transition-colors"
                            title="Удалить"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-4">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                            promo.is_active
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}
                        >
                          {promo.is_active ? "Активен" : "Выключен"}
                        </span>

                        <span className="text-[10px] font-extrabold px-2 py-0.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-md">
                          Использовано: {promo.current_uses}{" "}
                          {promo.max_uses !== null ? `/ ${promo.max_uses}` : "(безлимит)"}
                        </span>

                        {promo.expires_at && (
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                              isExpired
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-gray-100 text-gray-700 border border-gray-200"
                            }`}
                          >
                            До: {new Date(promo.expires_at).toLocaleDateString("ru-RU")}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-200">
                        {bundle.reward_ids && bundle.reward_ids.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span>🎽</span>
                            <span>
                              Предметов/титулов: <b>{bundle.reward_ids.length} шт.</b>
                            </span>
                          </div>
                        )}

                        {bundle.specific_material_ids &&
                          bundle.specific_material_ids.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span>📚</span>
                              <span>
                                Конкретные материалы:{" "}
                                <b>{bundle.specific_material_ids.length} шт.</b>
                              </span>
                            </div>
                          )}

                        {bundle.material_choice_count ? (
                          <div className="flex items-center gap-1.5">
                            <span>🎓</span>
                            <span>
                              Ученик выбирает материалов:{" "}
                              <b>{bundle.material_choice_count} шт.</b>
                            </span>
                          </div>
                        ) : null}

                        {bundle.custom_physical && (
                          <div className="flex items-center gap-1.5 text-amber-700 font-bold">
                            <span>🧸</span>
                            <span className="truncate">
                              Приз: <b>{bundle.custom_physical.title}</b>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-[10px] text-gray-400 font-bold pt-3 mt-3 border-t border-gray-100">
                      Создан: {new Date(promo.created_at).toLocaleDateString("ru-RU")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Таблица логов */}
      {activeSubTab === "logs" && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm overflow-hidden">
          <h2 className="text-base font-black text-gray-900 mb-4">История активации промокодов</h2>

          {loading ? (
            <div className="text-center py-8 text-gray-500 font-bold text-sm">Загрузка истории...</div>
          ) : redemptions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 font-bold text-sm">
              Пока ни один ученик не активировал промокод
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-800">
                <thead className="bg-gray-50 text-gray-500 uppercase font-black text-[10px] border-b border-gray-200">
                  <tr>
                    <th className="p-3">Дата / Время</th>
                    <th className="p-3">Ученик</th>
                    <th className="p-3">Промокод</th>
                    <th className="p-3">Выданные награды & Материалы</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {redemptions.map((log: any) => (
                    <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3 font-mono font-bold text-gray-500 whitespace-nowrap">
                        {new Date(log.redeemed_at).toLocaleString("ru-RU")}
                      </td>
                      <td className="p-3">
                        <div className="font-extrabold text-gray-900">{log.user_full_name}</div>
                        <div className="text-[10px] text-gray-400 font-medium">{log.user_email}</div>
                      </td>
                      <td className="p-3">
                        <span className="font-mono font-black text-emerald-700 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                          {log.promocode_code}
                        </span>
                      </td>
                      <td className="p-3 space-y-1">
                        {log.bundle_reward_titles && log.bundle_reward_titles.length > 0 && (
                          <div className="text-[11px] text-purple-700 font-bold">
                            🎽 {log.bundle_reward_titles.join(", ")}
                          </div>
                        )}
                        {log.bundle_material_titles && log.bundle_material_titles.length > 0 && (
                          <div className="text-[11px] text-blue-700 font-bold">
                            📚 {log.bundle_material_titles.join(", ")}
                          </div>
                        )}
                        {log.chosen_material_titles && log.chosen_material_titles.length > 0 && (
                          <div className="text-[11px] text-emerald-700 font-bold">
                            🎓 Выбрано самими: {log.chosen_material_titles.join(", ")}
                          </div>
                        )}
                        {log.physical_title && (
                          <div className="text-[11px] text-amber-700 font-bold">
                            🧸 Физический приз: {log.physical_title}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Модалка Конструктора */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-3xl max-w-2xl w-full p-6 space-y-6 my-8 max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-lg font-black text-gray-900">
                {formId ? "Редактировать промокод" : "Конструктор промокода"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 font-bold p-1 rounded-lg text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePromocode} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Промокод (слово)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Например: HIPPO2026"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-2.5 text-xs font-mono font-black text-emerald-700 focus:outline-none focus:border-emerald-500 uppercase transition-colors"
                  />
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Промокод активен</span>
                  </label>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200 space-y-4">
                <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-wider">
                  Ограничения
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                      <input
                        type="checkbox"
                        checked={hasMaxUses}
                        onChange={(e) => setHasMaxUses(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600"
                      />
                      <span>Лимит кол-ва активаций</span>
                    </label>

                    {hasMaxUses && (
                      <input
                        type="number"
                        min={1}
                        value={maxUses}
                        onChange={(e) => setMaxUses(Number(e.target.value))}
                        className="w-full bg-white border-2 border-gray-200 rounded-xl p-2 text-xs font-bold text-gray-800"
                        placeholder="Количество"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                      <input
                        type="checkbox"
                        checked={hasExpiresAt}
                        onChange={(e) => setHasExpiresAt(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600"
                      />
                      <span>Ограничение по времени</span>
                    </label>

                    {hasExpiresAt && (
                      <input
                        type="datetime-local"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        className="w-full bg-white border-2 border-gray-200 rounded-xl p-2 text-xs font-bold text-gray-800"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-wider">
                  Начинка промокода
                </h3>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    🎽 Награды из каталога
                  </label>
                  <div className="max-h-36 overflow-y-auto bg-gray-50 p-3 rounded-2xl border border-gray-200 space-y-1.5">
                    {rewardsCatalog.length === 0 ? (
                      <div className="text-xs text-gray-400 font-bold">Каталог пуст</div>
                    ) : (
                      rewardsCatalog.map((r: RewardItem) => (
                        <label
                          key={r.id}
                          className="flex items-center gap-2 cursor-pointer hover:bg-white p-1.5 rounded-lg text-xs text-gray-800 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRewardIds.includes(r.id)}
                            onChange={() => handleToggleReward(r.id)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600"
                          />
                          <span>
                            [{r.type}] <b>{r.title}</b>
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Выбор конкретных материалов */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-gray-700">
                      📚 Конкретные материалы ({selectedSpecificMaterialIds.length} выбр.)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPickerOpen(!isPickerOpen);
                        if (!isPickerOpen) setMaterialSearch(""); // сброс поиска при открытии
                      }}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-800"
                    >
                      {isPickerOpen ? "Закрыть селектор" : "Выбрать из каталога"}
                    </button>
                  </div>

                  {isPickerOpen && (
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 space-y-3">
                      {/* Поле поиска */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="🔍 Поиск по названию..."
                          value={materialSearch}
                          onChange={(e) => setMaterialSearch(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-medium text-gray-800 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                        {materialSearch && (
                          <button
                            type="button"
                            onClick={() => setMaterialSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Список материалов с прокруткой */}
                      <div className="max-h-48 overflow-y-auto space-y-1.5">
                        {filteredMaterials.length === 0 ? (
                          <div className="text-xs text-gray-400 font-bold py-4 text-center">
                            {materialSearch ? "Ничего не найдено" : "Материалы не загружены"}
                          </div>
                        ) : (
                          filteredMaterials.map((m) => {
                            const isChecked = selectedSpecificMaterialIds.includes(m.id);
                            return (
                              <label
                                key={m.id}
                                className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
                              >
                                <span className="font-bold text-xs text-gray-800">
                                  {m.title}
                                  {m.is_secret && (
                                    <span className="ml-2 text-[10px] text-purple-600 font-extrabold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                      🔒 Секретный
                                    </span>
                                  )}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleSpecificMaterial(m.id)}
                                  className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                                />
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    🎓 Сколько материалов ученик выбирает САМ
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={materialChoiceCount}
                    onChange={(e) => setMaterialChoiceCount(Number(e.target.value))}
                    className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-200/80 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-extrabold text-amber-900">
                    <input
                      type="checkbox"
                      checked={hasPhysicalPrize}
                      onChange={(e) => setHasPhysicalPrize(e.target.checked)}
                      className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span>🧸 Добавить физический подарок</span>
                  </label>

                  {hasPhysicalPrize && (
                    <div className="space-y-3 pt-2">
                      <input
                        type="text"
                        required={hasPhysicalPrize}
                        placeholder="Заголовок"
                        value={physicalTitle}
                        onChange={(e) => setPhysicalTitle(e.target.value)}
                        className="w-full bg-white border-2 border-amber-200 rounded-xl p-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-amber-500"
                      />

                      <textarea
                        rows={2}
                        required={hasPhysicalPrize}
                        placeholder="Инструкция для ученика"
                        value={physicalText}
                        onChange={(e) => setPhysicalText(e.target.value)}
                        className="w-full bg-white border-2 border-amber-200 rounded-xl p-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:border-amber-500"
                      />

                      <div>
                        <label className="block text-[11px] font-bold text-amber-900 mb-1">
                          Изображение подарка
                        </label>
                        <div
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onClick={() => !uploading && fileInputRef.current?.click()}
                          className={`border-2 border-dashed rounded-2xl p-3 text-center cursor-pointer transition-all ${
                            isDragging
                              ? "border-amber-500 bg-amber-100/50 scale-[1.01]"
                              : "border-amber-200 bg-white hover:bg-amber-50/50"
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

                          {physicalImageUrl ? (
                            <div className="flex items-center justify-between gap-3 bg-amber-50 p-2 rounded-xl border border-amber-200">
                              <img
                                src={physicalImageUrl}
                                alt="Превью"
                                className="w-10 h-10 object-contain rounded-lg border bg-white"
                              />
                              <div className="flex-1 text-left min-w-0">
                                <div className="text-[10px] font-extrabold text-amber-900 truncate">
                                  ✅ Картинка загружена
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPhysicalImageUrl("");
                                }}
                                className="text-xs font-bold text-red-500 hover:text-red-700 p-1"
                              >
                                ✖
                              </button>
                            </div>
                          ) : (
                            <div className="py-1">
                              <div className="text-xl mb-0.5">{uploading ? "⚡" : "🎁"}</div>
                              <div className="text-xs font-bold text-amber-900">
                                {uploading ? "Загрузка..." : "Перетащите картинку приза"}
                              </div>
                            </div>
                          )}
                        </div>

                        {uploadError && (
                          <div className="text-[10px] font-bold text-red-600 mt-1">
                            ⚠️ {uploadError}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl disabled:opacity-50 transition-colors shadow-sm"
                >
                  {saving ? "Сохранение..." : "Сохранить промокод"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}