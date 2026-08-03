"use client";

import React, { useState, useEffect } from "react";
import MascotViewer from "../mascot/MascotViewer";
import StreakTimeline from "./StreakTimeline";
import MaterialChoiceModal from "./MaterialChoiceModal";
import PhysicalPrizeModal from "./PhysicalPrizeModal";
import type {
  MascotSettings,
  RewardType,
  StreakConfigItem,
  StreakStats,
  UserInventoryItem,
  CustomPhysicalPrize,
} from "@/lib/rewards/types";

export type RewardsTabType = "wardrobe" | "streaks" | "promocode" | "timeline";

export interface RewardsModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  defaultTab?: RewardsTabType;
  initialTab?: RewardsTabType;
}

export default function RewardsModal({
  isOpen,
  open,
  onClose,
  defaultTab = "wardrobe",
  initialTab,
}: RewardsModalProps) {
  // Флаг открытия (поддержка и isOpen, и open)
  const showModal = Boolean(isOpen ?? open);

  // Нормализация выбранной вкладки ("timeline" -> "streaks")
  const normalizeTab = (tab?: RewardsTabType): "wardrobe" | "streaks" | "promocode" => {
    const raw = tab || initialTab || defaultTab;
    if (raw === "timeline") return "streaks";
    return raw === "promocode" || raw === "streaks" ? raw : "wardrobe";
  };

  const [activeTab, setActiveTab] = useState<"wardrobe" | "streaks" | "promocode">(() =>
    normalizeTab(initialTab || defaultTab)
  );

  const [loading, setLoading] = useState(true);

  // Данные
  const [mascot, setMascot] = useState<MascotSettings | null>(null);
  const [inventory, setInventory] = useState<UserInventoryItem[]>([]);
  const [streakStats, setStreakStats] = useState<StreakStats>({
    currentStreak: 0,
    maxStreak: 0,
    completedToday: false,
    lastCompletedAt: null,
  });
  const [streakPath, setStreakPath] = useState<StreakConfigItem[]>([]);

  // Категория гардероба
  const [wardrobeCategory, setWardrobeCategory] = useState<RewardType>("hat");

  // Промокоды
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccessMsg, setPromoSuccessMsg] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  // Вложенные модалки выбора материала / физ приза
  const [materialChoiceState, setMaterialChoiceState] = useState<{
    isOpen: boolean;
    code: string;
    remainingCount: number;
  }>({ isOpen: false, code: "", remainingCount: 0 });

  const [physicalPrizeState, setPhysicalPrizeState] = useState<{
    isOpen: boolean;
    prize: CustomPhysicalPrize | null;
  }>({ isOpen: false, prize: null });

  useEffect(() => {
    if (showModal) {
      setActiveTab(normalizeTab(initialTab || defaultTab));
      void loadData();
    }
  }, [showModal, initialTab, defaultTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mascotRes, streaksRes] = await Promise.all([
        fetch("/api/mascot"),
        fetch("/api/streaks"),
      ]);

      const mascotData = await mascotRes.json();
      const streaksData = await streaksRes.json();

      if (mascotRes.ok) {
        setMascot(mascotData.mascot || null);
        setInventory(mascotData.inventory || []);
      }
      if (streaksRes.ok) {
        if (streaksData.stats) {
          setStreakStats(streaksData.stats);
        } else {
          setStreakStats((prev) => ({
            ...prev,
            currentStreak: streaksData.currentStreak || 0,
          }));
        }
        setStreakPath(streaksData.path || []);
      }
    } catch (e) {
      console.error("Error loading rewards data:", e);
    } finally {
      setLoading(false);
    }
  };

  // Экипировка / Снятие предмета
  const handleEquip = async (category: RewardType, rewardId: string | null) => {
    try {
      const res = await fetch("/api/mascot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, rewardId }),
      });

      if (res.ok) {
        const data = await res.json();
        setMascot(data.mascot);
      }
    } catch (e) {
      console.error("Failed to equip item:", e);
    }
  };

  // Забор награды за стрик
  const handleClaimStreak = async (dayNumber: number) => {
    try {
      const res = await fetch("/api/streaks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayNumber }),
      });

      if (res.ok) {
        await loadData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка получения награды");
      }
    } catch (e) {
      alert("Ошибка сети");
    }
  };

  // Активация промокода
  const handleRedeemPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCodeInput.trim()) return;

    setRedeeming(true);
    setPromoError(null);
    setPromoSuccessMsg(null);

    try {
      const res = await fetch("/api/promocodes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCodeInput }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPromoError(data.error || "Неверный промокод");
      } else {
        if (data.requiresMaterialChoice) {
          setMaterialChoiceState({
            isOpen: true,
            code: promoCodeInput.trim().toUpperCase(),
            remainingCount: data.remainingMaterialChoices || 1,
          });
        } else if (data.physicalPrize) {
          setPhysicalPrizeState({
            isOpen: true,
            prize: data.physicalPrize,
          });
        } else {
          setPromoSuccessMsg("🎉 Промокод успешно активирован!");
          setPromoCodeInput("");
          void loadData();
        }
      }
    } catch (e) {
      setPromoError("Ошибка сети при активации");
    } finally {
      setRedeeming(false);
    }
  };

  if (!showModal) return null;

  // Фильтрация инвентаря по выбранной категории гардероба
  const filteredInventory = inventory.filter(
    (item) => item.reward?.type === wardrobeCategory
  );

  // Проверка, экипирован ли конкретный предмет
  const isItemEquipped = (rewardId: string) => {
    if (!mascot) return false;
    return (
      mascot.equipped_base_id === rewardId ||
      mascot.equipped_hat_id === rewardId ||
      mascot.equipped_aura_id === rewardId ||
      mascot.equipped_emotion_id === rewardId ||
      mascot.equipped_title_id === rewardId
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        <div
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full h-[88vh] flex flex-col shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95"
          style={{
            backgroundColor: "var(--glass-bg, rgba(15, 23, 42, 0.95))",
            color: "var(--project-text, #ffffff)",
          }}
        >
          {/* Шапка модалки */}
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎭</span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Центр Наград
              </h2>
            </div>

            {/* Переключатель табов */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab("wardrobe")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "wardrobe"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                👕 Гардероб
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("streaks")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "streaks"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                🔥 Серия ({streakStats.currentStreak}d)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("promocode")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === "promocode"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                🎁 Промокод
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              ✕
            </button>
          </div>

          {/* ТЕЛО МОДАЛКИ */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 font-semibold text-sm">
                Загрузка Центра Наград...
              </div>
            ) : (
              <>
                {/* TAB 1: ГАРДЕРОБ */}
                {activeTab === "wardrobe" && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">
                    {/* Слева: Предпросмотр Маскота */}
                    <div className="md:col-span-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center relative shadow-inner">
                      <MascotViewer mascotSettings={mascot} size={230} />
                      <div className="text-xs text-slate-400 font-medium mt-4 text-center">
                        Примеряйте найденные предметы
                      </div>
                    </div>

                    {/* Справа: Категории и Сетка Инвентаря */}
                    <div className="md:col-span-7 flex flex-col space-y-4">
                      {/* Селектор категорий */}
                      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto">
                        {[
                          { type: "hat", label: "👑 Шляпы" },
                          { type: "aura", label: "✨ Ауры" },
                          { type: "emotion", label: "😄 Эмоции" },
                          { type: "base", label: "☁️ Базы" },
                          { type: "title", label: "🏷️ Титулы" },
                        ].map((cat) => (
                          <button
                            key={cat.type}
                            type="button"
                            onClick={() =>
                              setWardrobeCategory(cat.type as RewardType)
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                              wardrobeCategory === cat.type
                                ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
                                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {/* Сетка инвентаря */}
                      <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 pr-1">
                        {filteredInventory.length === 0 ? (
                          <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                            У вас пока нет предметов в этой категории.
                            <br />
                            Держите серию или вводите промокоды!
                          </div>
                        ) : (
                          filteredInventory.map((item) => {
                            if (!item.reward) return null;
                            const equipped = isItemEquipped(item.reward.id);

                            return (
                              <div
                                key={item.id}
                                onClick={() =>
                                  handleEquip(
                                    wardrobeCategory,
                                    equipped ? null : item.reward!.id
                                  )
                                }
                                className={`bg-slate-50 dark:bg-slate-950 border rounded-2xl p-3 flex flex-col items-center justify-between cursor-pointer transition-all relative group ${
                                  equipped
                                    ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
                                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                                }`}
                              >
                                {equipped && (
                                  <span className="absolute top-2 right-2 text-[10px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded-md">
                                    Надето
                                  </span>
                                )}

                                <div className="w-16 h-16 flex items-center justify-center my-2">
                                  {item.reward.type === "title" ? (
                                    <span
                                      className="font-bold text-xs px-2 py-1 rounded-full border truncate max-w-full"
                                      style={{
                                        borderColor:
                                          item.reward.meta?.color || "#8b5cf6",
                                        color:
                                          item.reward.meta?.color || "#8b5cf6",
                                      }}
                                    >
                                      «{item.reward.title}»
                                    </span>
                                  ) : item.reward.asset_url ? (
                                    <img
                                      src={item.reward.asset_url}
                                      alt=""
                                      className="max-h-14 max-w-14 object-contain"
                                    />
                                  ) : (
                                    <span className="text-2xl">🎁</span>
                                  )}
                                </div>

                                <div className="text-center w-full">
                                  <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                    {item.reward.title}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: ДОРОЖКА СЕРИИ */}
                {activeTab === "streaks" && (
                  <StreakTimeline
                    stats={streakStats}
                    path={streakPath}
                    onClaimReward={handleClaimStreak}
                  />
                )}

                {/* TAB 3: ПРОМОКОД */}
                {activeTab === "promocode" && (
                  <div className="max-w-md mx-auto py-12 space-y-6">
                    <div className="text-center space-y-2">
                      <div className="text-5xl">🎁</div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">
                        Активация Промокода
                      </h3>
                      <p className="text-xs text-slate-400">
                        Введите секретный код, полученный за участие в ивентах или от преподавателей.
                      </p>
                    </div>

                    <form onSubmit={handleRedeemPromo} className="space-y-4">
                      <div>
                        <input
                          type="text"
                          placeholder="ВВЕДИТЕ ПРОМОКОД"
                          value={promoCodeInput}
                          onChange={(e) =>
                            setPromoCodeInput(e.target.value.toUpperCase())
                          }
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-center text-lg font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
                        />
                      </div>

                      {promoError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500 dark:text-red-400 text-center font-semibold">
                          {promoError}
                        </div>
                      )}

                      {promoSuccessMsg && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 text-center font-semibold">
                          {promoSuccessMsg}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={redeeming || !promoCodeInput.trim()}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                      >
                        {redeeming ? "Проверка..." : "Активировать"}
                      </button>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Модалка выбора материала по промику */}
      {materialChoiceState.isOpen && (
        <MaterialChoiceModal
          isOpen={materialChoiceState.isOpen}
          promocodeCode={materialChoiceState.code}
          requiredChoiceCount={materialChoiceState.remainingCount}
          onClose={() => {
            setMaterialChoiceState({ ...materialChoiceState, isOpen: false });
            void loadData();
          }}
        />
      )}

      {/* Модалка физического подарка */}
      {physicalPrizeState.isOpen && physicalPrizeState.prize && (
        <PhysicalPrizeModal
          isOpen={physicalPrizeState.isOpen}
          prize={physicalPrizeState.prize}
          onClose={() => {
            setPhysicalPrizeState({ ...physicalPrizeState, isOpen: false });
            void loadData();
          }}
        />
      )}
    </>
  );
}