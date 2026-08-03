"use client";

import React, { useState, useEffect } from "react";
import type { PromocodeItem, PromocodeRedemption, RewardItem } from "@/lib/rewards/types";

export default function PromocodeManager() {
  const [promocodes, setPromocodes] = useState<PromocodeItem[]>([]);
  const [redemptions, setRedemptions] = useState<PromocodeRedemption[]>([]);
  const [rewardsCatalog, setRewardsCatalog] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState<"constructor" | "logs">("constructor");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Поля формы промокода
  const [formId, setFormId] = useState<string | undefined>(undefined);
  const [code, setCode] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Ограничения
  const [hasMaxUses, setHasMaxUses] = useState(false);
  const [maxUses, setMaxUses] = useState<number>(1);
  const [hasExpiresAt, setHasExpiresAt] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string>("");

  // Начинка (rewards_bundle)
  const [selectedRewardIds, setSelectedRewardIds] = useState<string[]>([]);
  const [specificMaterialIdsText, setSpecificMaterialIdsText] = useState("");
  const [materialChoiceCount, setMaterialChoiceCount] = useState<number>(0);

  // Физический приз
  const [hasPhysicalPrize, setHasPhysicalPrize] = useState(false);
  const [physicalTitle, setPhysicalTitle] = useState("");
  const [physicalText, setPhysicalText] = useState("");
  const [physicalImageUrl, setPhysicalImageUrl] = useState("");

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [promosRes, rewardsRes] = await Promise.all([
        fetch("/api/admin/promocodes"),
        fetch("/api/admin/rewards"),
      ]);

      const promosData = await promosRes.json();
      const rewardsData = await rewardsRes.json();

      if (promosRes.ok) {
        setPromocodes(promosData.promocodes || []);
        setRedemptions(promosData.redemptions || []);
      }
      if (rewardsRes.ok) {
        setRewardsCatalog(rewardsData.rewards || []);
      }
    } catch (e) {
      console.error("Failed to load promocodes or rewards:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item?: PromocodeItem) => {
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
      setSpecificMaterialIdsText((bundle.specific_material_ids || []).join(", "));
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
      setSpecificMaterialIdsText("");
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

  const handleSavePromocode = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const specificMaterialIds = specificMaterialIdsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      id: formId,
      code,
      is_active: isActive,
      max_uses: hasMaxUses ? maxUses : null,
      expires_at: hasExpiresAt && expiresAt ? new Date(expiresAt).toISOString() : null,
      rewards_bundle: {
        reward_ids: selectedRewardIds,
        specific_material_ids: specificMaterialIds,
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
        loadAllData();
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
    if (!confirm("Удалить этот промокод? Ученики больше не смогут его вводить.")) return;

    try {
      const res = await fetch(`/api/admin/promocodes?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        loadAllData();
      }
    } catch (e) {
      alert("Ошибка при удалении промокода");
    }
  };

  return (
    <div className="space-y-6">
      {/* Подтабы: Список & Логи */}
      <div className="flex justify-between items-center bg-slate-900 p-4 border border-slate-800 rounded-2xl">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab("constructor")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeSubTab === "constructor"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📋 Список Промокодов ({promocodes.length})
          </button>
          <button
            onClick={() => setActiveSubTab("logs")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              activeSubTab === "logs"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📊 История Активаций ({redemptions.length})
          </button>
        </div>

        {activeSubTab === "constructor" && (
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
          >
            <span>+</span> Создать Промокод
          </button>
        )}
      </div>

      {/* Вкладка 1: Список Промокодов */}
      {activeSubTab === "constructor" && (
        <>
          {loading ? (
            <div className="text-center py-12 text-slate-500">Загрузка промокодов...</div>
          ) : promocodes.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/50 border border-slate-800 rounded-2xl text-slate-400">
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
                    className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all ${
                      !promo.is_active || isExpired || isLimitReached
                        ? "border-slate-800 opacity-60"
                        : "border-slate-800 hover:border-emerald-500/50"
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <span className="font-mono font-black text-lg text-emerald-400 tracking-wider px-3 py-1 bg-emerald-950/60 border border-emerald-800/60 rounded-xl">
                          {promo.code}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleOpenModal(promo)}
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs"
                            title="Редактировать"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeletePromocode(promo.id)}
                            className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg text-xs"
                            title="Удалить"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Статусы и ограничения */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            promo.is_active
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}
                        >
                          {promo.is_active ? "Активен" : "Выключен"}
                        </span>

                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-800 text-slate-300 rounded-md">
                          Использовано: {promo.current_uses}{" "}
                          {promo.max_uses !== null ? `/ ${promo.max_uses}` : "(безлимит)"}
                        </span>

                        {promo.expires_at && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                              isExpired
                                ? "bg-red-500/10 text-red-400"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            До: {new Date(promo.expires_at).toLocaleDateString("ru-RU")}
                          </span>
                        )}
                      </div>

                      {/* Начинка промокода */}
                      <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950 p-3 rounded-xl border border-slate-800/80">
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
                          <div className="flex items-center gap-1.5 text-amber-400">
                            <span>🧸</span>
                            <span className="truncate">
                              Приз: <b>{bundle.custom_physical.title}</b>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-[10px] text-slate-500 pt-3 mt-3 border-t border-slate-800/60">
                      Создан: {new Date(promo.created_at).toLocaleDateString("ru-RU")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Вкладка 2: Таблица Логов Активаций */}
      {activeSubTab === "logs" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 overflow-hidden">
          <h2 className="text-lg font-bold text-white mb-4">История ввода промокодов</h2>

          {loading ? (
            <div className="text-center py-8 text-slate-500">Загрузка истории...</div>
          ) : redemptions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Пока ни один ученик не активировал промокод
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Дата / Время</th>
                    <th className="p-3">Ученик</th>
                    <th className="p-3">Промокод</th>
                    <th className="p-3">Выбранные материалы</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {redemptions.map((log: PromocodeRedemption) => (
                    <tr key={log.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-mono text-slate-400">
                        {new Date(log.redeemed_at).toLocaleString("ru-RU")}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-white">{log.user_full_name}</div>
                        <div className="text-[10px] text-slate-500">{log.user_email}</div>
                      </td>
                      <td className="p-3">
                        <span className="font-mono font-bold text-emerald-400 px-2 py-0.5 bg-emerald-950/60 border border-emerald-800/60 rounded-lg">
                          {log.promocode_code}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[10px] text-slate-400">
                        {log.chosen_material_ids && log.chosen_material_ids.length > 0 ? (
                          <span className="text-indigo-400">
                            IDs: {log.chosen_material_ids.join(", ")}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
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

      {/* Модалка Конструктора Промокода */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white">
              {formId ? "Редактировать промокод" : "Конструктор промокода"}
            </h2>

            <form onSubmit={handleSavePromocode} className="space-y-6">
              {/* Основные настройки */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Промокод (слово)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Например: ОХАЕШЕЧКИ"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 uppercase"
                  />
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-300">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-emerald-600 focus:ring-0"
                    />
                    <span>Промокод активен</span>
                  </label>
                </div>
              </div>

              {/* Ограничения */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Ограничения (необязательно)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Лимит использования */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                      <input
                        type="checkbox"
                        checked={hasMaxUses}
                        onChange={(e) => setHasMaxUses(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-emerald-600"
                      />
                      <span>Лимит кол-ва активаций</span>
                    </label>

                    {hasMaxUses && (
                      <input
                        type="number"
                        min={1}
                        value={maxUses}
                        onChange={(e) => setMaxUses(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white"
                        placeholder="Количество (например: 50)"
                      />
                    )}
                  </div>

                  {/* Ограничение по дате */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                      <input
                        type="checkbox"
                        checked={hasExpiresAt}
                        onChange={(e) => setHasExpiresAt(e.target.checked)}
                        className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-emerald-600"
                      />
                      <span>Ограничение по времени</span>
                    </label>

                    {hasExpiresAt && (
                      <input
                        type="datetime-local"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Бандл Наград */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Начинка промокода (выберите призы)
                </h3>

                {/* 1. Предметы из каталога */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    🎽 Награды из каталога (шмотки, базы, титулы)
                  </label>
                  <div className="max-h-36 overflow-y-auto bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                    {rewardsCatalog.length === 0 ? (
                      <div className="text-xs text-slate-600">Каталог пуст</div>
                    ) : (
                      rewardsCatalog.map((r: RewardItem) => (
                        <label
                          key={r.id}
                          className="flex items-center gap-2 cursor-pointer hover:bg-slate-900 p-1.5 rounded-lg text-xs text-slate-200"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRewardIds.includes(r.id)}
                            onChange={() => handleToggleReward(r.id)}
                            className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-800 text-emerald-600"
                          />
                          <span>
                            [{r.type}] <b>{r.title}</b>
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. Конкретные и секретные материалы */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    📚 Конкретные / Секретные материалы (UUID через запятую)
                  </label>
                  <input
                    type="text"
                    placeholder="uuid-1, uuid-2"
                    value={specificMaterialIdsText}
                    onChange={(e) => setSpecificMaterialIdsText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* 3. Материал на выбор ученика */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    🎓 Сколько материалов ученик выбирает САМ
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={materialChoiceCount}
                    onChange={(e) => setMaterialChoiceCount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* 4. Физический подарок */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-amber-400">
                    <input
                      type="checkbox"
                      checked={hasPhysicalPrize}
                      onChange={(e) => setHasPhysicalPrize(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-amber-600"
                    />
                    <span>🧸 Добавить физический подарок / Поздравление</span>
                  </label>

                  {hasPhysicalPrize && (
                    <div className="space-y-3 pt-2">
                      <input
                        type="text"
                        required={hasPhysicalPrize}
                        placeholder="Заголовок (например: 🎉 Ты выиграл плюшевую тучку!)"
                        value={physicalTitle}
                        onChange={(e) => setPhysicalTitle(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white"
                      />

                      <textarea
                        rows={2}
                        required={hasPhysicalPrize}
                        placeholder="Инструкция для ученика (например: Покажи этот экран администратору в центре...)"
                        value={physicalText}
                        onChange={(e) => setPhysicalText(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white"
                      />

                      <input
                        type="text"
                        placeholder="Ссылка на картинку подарка (опционально)"
                        value={physicalImageUrl}
                        onChange={(e) => setPhysicalImageUrl(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-white font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Кнопки */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
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
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl disabled:opacity-50"
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