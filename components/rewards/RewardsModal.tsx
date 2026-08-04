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
  const showModal = Boolean(isOpen ?? open);

  const normalizeTab = (tab?: RewardsTabType): "wardrobe" | "streaks" | "promocode" => {
    const raw = tab || initialTab || defaultTab;
    if (raw === "timeline") return "streaks";
    return raw === "promocode" || raw === "streaks" ? raw : "wardrobe";
  };

  const [activeTab, setActiveTab] = useState<"wardrobe" | "streaks" | "promocode">(() =>
    normalizeTab(initialTab || defaultTab)
  );

  const [loading, setLoading] = useState(true);

  const [mascot, setMascot] = useState<MascotSettings | null>(null);
  const [inventory, setInventory] = useState<UserInventoryItem[]>([]);
  const [streakStats, setStreakStats] = useState<StreakStats>({
    currentStreak: 0,
    maxStreak: 0,
    completedToday: false,
    lastCompletedAt: null,
  });
  const [streakPath, setStreakPath] = useState<StreakConfigItem[]>([]);

  const [wardrobeCategory, setWardrobeCategory] = useState<RewardType>("hat");

  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccessMsg, setPromoSuccessMsg] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);

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
        const curr =
          streaksData.streak?.currentStreak ??
          streaksData.stats?.currentStreak ??
          streaksData.currentStreak ??
          0;
        const max =
          streaksData.streak?.longestStreak ??
          streaksData.stats?.longestStreak ??
          streaksData.stats?.maxStreak ??
          streaksData.longestStreak ??
          0;
        const done =
          streaksData.streak?.doneToday ??
          streaksData.stats?.doneToday ??
          streaksData.stats?.completedToday ??
          false;

        setStreakStats({
          currentStreak: Number(curr),
          maxStreak: Number(max),
          completedToday: Boolean(done),
          lastCompletedAt: null,
        });

        setStreakPath(streaksData.path || []);
      }
    } catch (e) {
      console.error("Error loading rewards data:", e);
    } finally {
      setLoading(false);
    }
  };

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
          setPromoSuccessMsg("Промокод успешно активирован!");
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

  const filteredInventory = inventory.filter(
    (item) => item.reward?.type === wardrobeCategory
  );

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
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        <div
          className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full h-[88vh] flex flex-col shadow-2xl overflow-hidden relative"
          style={{
            backgroundColor: "var(--project-card-bg, #0f172a)",
            color: "var(--project-text, #ffffff)",
          }}
        >
          {/* Шапка модалки */}
          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800 bg-slate-900/90">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <h2 className="text-xl font-black text-white tracking-wide uppercase">
                Центр наград
              </h2>
            </div>

            {/* Сегментированные табы */}
            <div className="flex gap-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab("wardrobe")}
                className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide uppercase transition-all ${
                  activeTab === "wardrobe"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Гардероб
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("streaks")}
                className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide uppercase transition-all ${
                  activeTab === "streaks"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Серия ({streakStats.currentStreak} дн.)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("promocode")}
                className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide uppercase transition-all ${
                  activeTab === "promocode"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Промокод
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Закрыть
            </button>
          </div>

          {/* Контент модалки */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-900">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm uppercase tracking-wider">
                Загрузка данных...
              </div>
            ) : (
              <>
                {/* Вкладка 1: ГАРДЕРОБ */}
                {activeTab === "wardrobe" && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">
                    {/* Левая панель: Примерка */}
                    <div className="md:col-span-5 bg-slate-950 border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center relative shadow-inner">
                      <MascotViewer mascotSettings={mascot} size={230} />
                      <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-4 text-center">
                        Предпросмотр комбинации
                      </div>
                    </div>

                    {/* Правая панель: Инвентарь */}
                    <div className="md:col-span-7 flex flex-col space-y-4">
                      {/* Селектор категорий */}
                      <div className="flex gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
                        {[
                          { type: "hat", label: "Шляпы" },
                          { type: "aura", label: "Ауры" },
                          { type: "emotion", label: "Эмоции" },
                          { type: "base", label: "Базы" },
                          { type: "title", label: "Титулы" },
                        ].map((cat) => (
                          <button
                            key={cat.type}
                            type="button"
                            onClick={() =>
                              setWardrobeCategory(cat.type as RewardType)
                            }
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                              wardrobeCategory === cat.type
                                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                                : "bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white"
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {/* Сетка предметов */}
                      <div
                        className={`flex-1 overflow-y-auto pr-1 ${
                          wardrobeCategory === "title"
                            ? "flex flex-col gap-2.5"
                            : "grid grid-cols-2 sm:grid-cols-3 gap-3"
                        }`}
                      >
                        {filteredInventory.length === 0 ? (
                          <div className="col-span-full py-16 text-center bg-slate-950 border border-slate-800 rounded-2xl p-6">
                            <div className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-1">
                              Предметы отсутствуют
                            </div>
                            <div className="text-xs text-slate-500 font-medium">
                              Продлевайте ежедневную серию или активируйте промокоды для получения наград.
                            </div>
                          </div>
                        ) : (
                          filteredInventory.map((item) => {
                            if (!item.reward) return null;
                            const equipped = isItemEquipped(item.reward.id);

                            if (wardrobeCategory === "title") {
                              return (
                                <div
                                  key={item.id}
                                  onClick={() =>
                                    handleEquip(
                                      wardrobeCategory,
                                      equipped ? null : item.reward!.id
                                    )
                                  }
                                  className={`w-full border rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all ${
                                    equipped
                                      ? "border-blue-500 bg-blue-950/40 shadow-md shadow-blue-500/10"
                                      : "border-slate-800 bg-slate-950 hover:border-slate-700"
                                  }`}
                                >
                                  <div className="min-w-0 pr-3">
                                    <span
                                      className="font-black text-xs sm:text-sm px-3 py-1 rounded-lg border inline-block truncate max-w-full uppercase tracking-wider"
                                      style={{
                                        borderColor:
                                          item.reward.meta?.color || "#3b82f6",
                                        color:
                                          item.reward.meta?.color || "#3b82f6",
                                        backgroundColor: "rgba(15, 23, 42, 0.8)",
                                      }}
                                    >
                                      «{item.reward.title}»
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    className={`text-xs font-black uppercase tracking-wider px-4 py-2 rounded-xl flex-shrink-0 transition-colors ${
                                      equipped
                                        ? "bg-blue-600 text-white"
                                        : "bg-slate-800 text-slate-300 group-hover:bg-blue-600 group-hover:text-white"
                                    }`}
                                  >
                                    {equipped ? "Надето" : "Надеть"}
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={item.id}
                                onClick={() =>
                                  handleEquip(
                                    wardrobeCategory,
                                    equipped ? null : item.reward!.id
                                  )
                                }
                                className={`border rounded-2xl p-4 flex flex-col items-center justify-between cursor-pointer transition-all bg-slate-950 ${
                                  equipped
                                    ? "border-blue-500 bg-blue-950/30 shadow-md shadow-blue-500/10"
                                    : "border-slate-800 hover:border-slate-700"
                                }`}
                              >
                                {equipped && (
                                  <span className="self-end text-[10px] bg-blue-600 text-white font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                                    Надето
                                  </span>
                                )}

                                <div className="w-16 h-16 flex items-center justify-center my-3">
                                  {item.reward.asset_url ? (
                                    <img
                                      src={item.reward.asset_url}
                                      alt=""
                                      className="max-h-14 max-w-14 object-contain"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                                      N/A
                                    </div>
                                  )}
                                </div>

                                <div className="text-center w-full">
                                  <div className="font-bold text-xs text-white truncate">
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

                {/* Вкладка 2: ДОРОЖКА СЕРИИ */}
                {activeTab === "streaks" && (
                  <StreakTimeline
                    stats={streakStats}
                    path={streakPath}
                    onClaimReward={handleClaimStreak}
                  />
                )}

                {/* Вкладка 3: ПРОМОКОД */}
                {activeTab === "promocode" && (
                  <div className="max-w-md mx-auto py-12 space-y-6">
                    <div className="text-center space-y-2">
                      <h3 className="text-lg font-black text-white uppercase tracking-wider">
                        Активация промокода
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">
                        Введите персональный код для получения наград или доступа к материалам.
                      </p>
                    </div>

                    <form onSubmit={handleRedeemPromo} className="space-y-4">
                      <div>
                        <input
                          type="text"
                          placeholder="ВВЕДИТЕ КОД"
                          value={promoCodeInput}
                          onChange={(e) =>
                            setPromoCodeInput(e.target.value.toUpperCase())
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center text-lg font-mono font-black text-emerald-400 uppercase tracking-widest focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
                        />
                      </div>

                      {promoError && (
                        <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-400 text-center font-bold">
                          {promoError}
                        </div>
                      )}

                      {promoSuccessMsg && (
                        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-400 text-center font-bold">
                          {promoSuccessMsg}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={redeeming || !promoCodeInput.trim()}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                      >
                        {redeeming ? "Активация..." : "Активировать"}
                      </button>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Выбор материала по промокоду */}
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

      {/* Физический приз */}
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