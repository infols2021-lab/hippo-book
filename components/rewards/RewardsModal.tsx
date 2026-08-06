"use client";

import React, { useState, useEffect } from "react";
import MascotViewer from "../mascot/MascotViewer";
import StreakTimeline from "./StreakTimeline";
import MaterialChoiceModal, {
  MaterialChoiceSuccessResult,
} from "./MaterialChoiceModal";
import PhysicalPrizeModal from "./PhysicalPrizeModal";
import RewardUnboxModal, { UnboxedRewardItem } from "./RewardUnboxModal";

import type {
  MascotSettings,
  RewardType,
  StreakConfigItem,
  StreakStats,
  UserInventoryItem,
  CustomPhysicalPrize,
  UserPromocodeHistoryItem,
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

  const [activeTab, setActiveTab] = useState<"wardrobe" | "streaks" | "promocode">(
    () => normalizeTab(initialTab || defaultTab)
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

  const [promoHistory, setPromoHistory] = useState<UserPromocodeHistoryItem[]>([]);

  const [unboxModalOpen, setUnboxModalOpen] = useState(false);
  const [unboxedItems, setUnboxedItems] = useState<UnboxedRewardItem[]>([]);
  const [pendingUnboxItems, setPendingUnboxItems] = useState<UnboxedRewardItem[]>([]);

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

      if (mascotRes.ok) {
        const mascotData = await mascotRes.json();
        setMascot(mascotData.mascot || null);
        setInventory(mascotData.inventory || []);
      }

      if (streaksRes.ok) {
        const streaksData = await streaksRes.json();
        const stats = streaksData.stats || {};

        setStreakStats({
          currentStreak: Number(stats.currentStreak ?? 0),
          maxStreak: Number(stats.maxStreak ?? 0),
          completedToday: Boolean(stats.completedToday ?? false),
          lastCompletedAt: stats.lastCompletedAt ?? null,
        });

        setStreakPath(streaksData.path || []);
      }

      try {
        const promoHistoryRes = await fetch("/api/promocodes/history");
        if (promoHistoryRes.ok) {
          const promoHistoryData = await promoHistoryRes.json();
          setPromoHistory(promoHistoryData.history || []);
        }
      } catch (historyErr) {
        console.warn("Error loading promo history:", historyErr);
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
        const data = await res.json();
        if (data.reward) {
          setUnboxedItems([
            {
              id: data.reward.id || String(dayNumber),
              title: data.reward.title || `Награда за День ${dayNumber}`,
              type: data.reward.type || "hat",
              description: data.reward.description || `Награда за ${dayNumber} дн. серии`,
              asset_url: data.reward.asset_url,
              meta: data.reward.meta,
            },
          ]);
          setUnboxModalOpen(true);
        }
        await loadData();
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка получения награды");
      }
    } catch (e) {
      alert("Ошибка сети");
    }
  };

  const processRedeemResult = (data: {
    physicalPrize?: CustomPhysicalPrize | null;
    grantedRewards?: any[];
  }) => {
    const rewardItems: UnboxedRewardItem[] = Array.isArray(data.grantedRewards)
      ? data.grantedRewards.map((r: any) => ({
          id: r.id,
          title: r.title,
          type: r.type,
          description: r.description,
          asset_url: r.asset_url,
          meta: r.meta,
        }))
      : [];

    if (data.physicalPrize) {
      setPhysicalPrizeState({ isOpen: true, prize: data.physicalPrize });
      setPendingUnboxItems(rewardItems);
    } else if (rewardItems.length > 0) {
      setUnboxedItems(rewardItems);
      setUnboxModalOpen(true);
    } else {
      setPromoSuccessMsg("Промокод успешно активирован!");
    }

    void loadData();
  };

  const handleMaterialChoiceSuccess = (result: MaterialChoiceSuccessResult) => {
    setMaterialChoiceState((prev) => ({ ...prev, isOpen: false }));

    if (result.physicalPrize) {
      setPhysicalPrizeState({ isOpen: true, prize: result.physicalPrize });
      setPendingUnboxItems(result.unboxItems as UnboxedRewardItem[]);
    } else if (result.unboxItems.length > 0) {
      setUnboxedItems(result.unboxItems as UnboxedRewardItem[]);
      setUnboxModalOpen(true);
    } else {
      setPromoSuccessMsg("Материалы успешно разблокированы!");
    }

    void loadData();
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
      } else if (data.requiresMaterialChoice) {
        setMaterialChoiceState({
          isOpen: true,
          code: promoCodeInput.trim().toUpperCase(),
          remainingCount: data.remainingMaterialChoices || 1,
        });
        setPromoCodeInput("");
      } else {
        processRedeemResult(data);
        setPromoCodeInput("");
      }
    } catch (e) {
      setPromoError("Ошибка сети при активации");
    } finally {
      setRedeeming(false);
    }
  };

  const closePhysicalPrizeModal = () => {
    setPhysicalPrizeState({ isOpen: false, prize: null });

    if (pendingUnboxItems.length > 0) {
      setUnboxedItems(pendingUnboxItems);
      setPendingUnboxItems([]);
      setUnboxModalOpen(true);
    }

    void loadData();
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
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 overflow-y-auto"
        style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
      >
        <div
          className="rounded-t-[32px] sm:rounded-[32px] max-w-4xl w-full h-[90vh] sm:h-[88vh] flex flex-col shadow-2xl overflow-hidden relative border transition-all"
          style={{
            backgroundColor: "var(--project-card-bg, #ffffff)",
            color: "var(--project-text, #0f172a)",
            borderColor: "var(--glass-border, rgba(15,23,42,0.12))",
          }}
        >
          {/* Индикатор для свайпа на мобильных */}
          <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto sm:hidden mt-2 -mb-2" />

          {/* Шапка модалки */}
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 border-b gap-3"
            style={{
              borderColor: "var(--glass-border, rgba(15,23,42,0.08))",
              backgroundColor: "var(--project-card-bg, #ffffff)",
            }}
          >
            <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: "var(--project-primary, #0ea5e9)" }}
                />
                <h2 className="text-base sm:text-xl font-black tracking-wide uppercase">Центр наград</h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 font-bold text-xs rounded-xl transition-all border sm:hidden"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 6%, transparent)",
                  borderColor: "var(--glass-border, rgba(15,23,42,0.1))",
                  color: "var(--project-text, #0f172a)",
                }}
              >
                Закрыть
              </button>
            </div>

            {/* Табы */}
            <div
              className="flex gap-1 p-1 rounded-2xl border overflow-x-auto no-scrollbar w-full sm:w-auto"
              style={{
                backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 4%, transparent)",
                borderColor: "var(--glass-border, rgba(15,23,42,0.1))",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab("wardrobe")}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-black tracking-wide uppercase whitespace-nowrap transition-all"
                style={{
                  backgroundColor:
                    activeTab === "wardrobe" ? "var(--project-primary, #0ea5e9)" : "transparent",
                  color: activeTab === "wardrobe" ? "#ffffff" : "var(--project-text, #0f172a)",
                }}
              >
                Гардероб
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("streaks")}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-black tracking-wide uppercase whitespace-nowrap transition-all"
                style={{
                  backgroundColor:
                    activeTab === "streaks" ? "var(--project-primary, #0ea5e9)" : "transparent",
                  color: activeTab === "streaks" ? "#ffffff" : "var(--project-text, #0f172a)",
                }}
              >
                Серия ({streakStats.currentStreak} дн.)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("promocode")}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-black tracking-wide uppercase whitespace-nowrap transition-all"
                style={{
                  backgroundColor:
                    activeTab === "promocode" ? "var(--project-primary, #0ea5e9)" : "transparent",
                  color: activeTab === "promocode" ? "#ffffff" : "var(--project-text, #0f172a)",
                }}
              >
                Промокод
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="hidden sm:block px-3.5 py-1.5 font-bold text-xs rounded-xl transition-all border"
              style={{
                backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 6%, transparent)",
                borderColor: "var(--glass-border, rgba(15,23,42,0.1))",
                color: "var(--project-text, #0f172a)",
              }}
            >
              Закрыть
            </button>
          </div>

          {/* Контент модалки */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {loading ? (
              <div className="h-full flex items-center justify-center font-bold text-xs sm:text-sm uppercase tracking-wider opacity-60">
                Загрузка данных...
              </div>
            ) : (
              <>
                {/* Вкладка 1: ГАРДЕРОБ */}
                {activeTab === "wardrobe" && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 h-full">
                    <div
                      className="md:col-span-5 border rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col items-center justify-center relative shadow-sm"
                      style={{
                        backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 2%, transparent)",
                        borderColor: "var(--glass-border, rgba(15,23,42,0.08))",
                      }}
                    >
                      <MascotViewer mascotSettings={mascot} size={180} />
                      <div className="text-[11px] font-extrabold uppercase tracking-wider mt-2 sm:mt-4 text-center opacity-60">
                        Предпросмотр маскота
                      </div>
                    </div>

                    <div className="md:col-span-7 flex flex-col space-y-3 sm:space-y-4">
                      <div
                        className="flex gap-2 border-b pb-2.5 overflow-x-auto no-scrollbar"
                        style={{ borderColor: "var(--glass-border, rgba(15,23,42,0.08))" }}
                      >
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
                            onClick={() => setWardrobeCategory(cat.type as RewardType)}
                            className="px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border"
                            style={{
                              backgroundColor:
                                wardrobeCategory === cat.type
                                  ? "var(--project-primary, #0ea5e9)"
                                  : "color-mix(in srgb, var(--project-text, #0f172a) 4%, transparent)",
                              borderColor:
                                wardrobeCategory === cat.type
                                  ? "var(--project-primary, #0ea5e9)"
                                  : "var(--glass-border, rgba(15,23,42,0.1))",
                              color:
                                wardrobeCategory === cat.type
                                  ? "#ffffff"
                                  : "var(--project-text, #0f172a)",
                            }}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      <div
                        className={`flex-1 overflow-y-auto pr-1 ${
                          wardrobeCategory === "title"
                            ? "flex flex-col gap-2.5"
                            : "grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3"
                        }`}
                      >
                        {filteredInventory.length === 0 ? (
                          <div
                            className="col-span-full py-12 sm:py-16 text-center border rounded-2xl p-6"
                            style={{
                              backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 2%, transparent)",
                              borderColor: "var(--glass-border, rgba(15,23,42,0.08))",
                            }}
                          >
                            <div className="text-xs sm:text-sm font-bold uppercase tracking-wider mb-1">
                              Предметы отсутствуют
                            </div>
                            <div className="text-[11px] sm:text-xs font-medium opacity-60">
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
                                    handleEquip(wardrobeCategory, equipped ? null : item.reward!.id)
                                  }
                                  className="w-full border rounded-2xl p-3.5 sm:p-4 flex items-center justify-between cursor-pointer transition-all"
                                  style={{
                                    backgroundColor: equipped
                                      ? "color-mix(in srgb, var(--project-primary, #0ea5e9) 10%, transparent)"
                                      : "color-mix(in srgb, var(--project-text, #0f172a) 2%, transparent)",
                                    borderColor: equipped
                                      ? "var(--project-primary, #0ea5e9)"
                                      : "var(--glass-border, rgba(15,23,42,0.08))",
                                  }}
                                >
                                  <div className="min-w-0 pr-3">
                                    <span
                                      className="font-black text-xs sm:text-sm px-3 py-1 rounded-lg border inline-block truncate max-w-full uppercase tracking-wider"
                                      style={{
                                        borderColor:
                                          item.reward.meta?.color || "var(--project-primary, #0ea5e9)",
                                        color:
                                          item.reward.meta?.color || "var(--project-primary, #0ea5e9)",
                                        backgroundColor: `${
                                          item.reward.meta?.color || "var(--project-primary, #0ea5e9)"
                                        }18`,
                                      }}
                                    >
                                      «{item.reward.title}»
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    className="text-[11px] sm:text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-xl flex-shrink-0 transition-colors"
                                    style={{
                                      backgroundColor: equipped
                                        ? "var(--project-primary, #0ea5e9)"
                                        : "color-mix(in srgb, var(--project-text, #0f172a) 8%, transparent)",
                                      color: equipped ? "#ffffff" : "var(--project-text, #0f172a)",
                                    }}
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
                                  handleEquip(wardrobeCategory, equipped ? null : item.reward!.id)
                                }
                                className="border rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-between cursor-pointer transition-all min-h-[110px]"
                                style={{
                                  backgroundColor: equipped
                                    ? "color-mix(in srgb, var(--project-primary, #0ea5e9) 10%, transparent)"
                                    : "color-mix(in srgb, var(--project-text, #0f172a) 2%, transparent)",
                                  borderColor: equipped
                                    ? "var(--project-primary, #0ea5e9)"
                                    : "var(--glass-border, rgba(15,23,42,0.08))",
                                }}
                              >
                                {equipped && (
                                  <span
                                    className="self-end text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider"
                                    style={{
                                      backgroundColor: "var(--project-primary, #0ea5e9)",
                                      color: "#ffffff",
                                    }}
                                  >
                                    Надето
                                  </span>
                                )}

                                <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center my-2">
                                  {item.reward.asset_url ? (
                                    <img
                                      src={item.reward.asset_url}
                                      alt=""
                                      className="max-h-12 max-w-12 sm:max-h-14 sm:max-w-14 object-contain"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold opacity-40">
                                      N/A
                                    </div>
                                  )}
                                </div>

                                <div className="text-center w-full">
                                  <div className="font-bold text-[11px] sm:text-xs truncate">{item.reward.title}</div>
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
                  <div className="max-w-xl mx-auto py-2 sm:py-4 space-y-6">
                    <div className="text-center space-y-1.5">
                      <h3 className="text-base sm:text-lg font-black uppercase tracking-wider">
                        Активация промокода
                      </h3>
                      <p className="text-xs font-medium opacity-60">
                        Введите персональный код для получения наград или доступа к материалам.
                      </p>
                    </div>

                    <form onSubmit={handleRedeemPromo} className="space-y-4 max-w-md mx-auto">
                      <div>
                        <input
                          type="text"
                          placeholder="ВВЕДИТЕ КОД"
                          value={promoCodeInput}
                          onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                          className="w-full border-2 rounded-2xl p-3.5 sm:p-4 text-center text-base sm:text-lg font-mono font-black uppercase tracking-widest focus:outline-none transition-colors"
                          style={{
                            backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 3%, transparent)",
                            borderColor: "var(--glass-border, rgba(15,23,42,0.12))",
                            color: "var(--project-primary, #0ea5e9)",
                          }}
                        />
                      </div>

                      {promoError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 text-center font-bold">
                          {promoError}
                        </div>
                      )}

                      {promoSuccessMsg && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-600 text-center font-bold">
                          {promoSuccessMsg}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={redeeming || !promoCodeInput.trim()}
                        className="w-full py-3.5 sm:py-4 font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg disabled:opacity-50"
                        style={{
                          backgroundColor: "var(--project-primary, #0ea5e9)",
                          color: "#ffffff",
                        }}
                      >
                        {redeeming ? "Активация..." : "Активировать"}
                      </button>
                    </form>

                    {/* История активированных промокодов */}
                    <div
                      className="border-t pt-6"
                      style={{ borderColor: "var(--glass-border, rgba(15,23,42,0.08))" }}
                    >
                      <h4 className="text-xs font-black uppercase tracking-wider mb-4 text-center opacity-70">
                        История ваших промокодов
                      </h4>

                      {promoHistory.length === 0 ? (
                        <div
                          className="text-center py-6 border rounded-2xl p-4 text-xs font-bold opacity-50"
                          style={{
                            backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 2%, transparent)",
                            borderColor: "var(--glass-border, rgba(15,23,42,0.08))",
                          }}
                        >
                          Вы пока не активировали ни одного промокода
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                          {promoHistory.map((item) => (
                            <div
                              key={item.id}
                              className="border rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition-all"
                              style={{
                                backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 2%, transparent)",
                                borderColor: "var(--glass-border, rgba(15,23,42,0.08))",
                              }}
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className="font-mono font-black px-2.5 py-1 rounded-xl text-xs uppercase tracking-wider"
                                  style={{
                                    backgroundColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 12%, transparent)",
                                    color: "var(--project-primary, #0ea5e9)",
                                    border: "1px solid color-mix(in srgb, var(--project-primary, #0ea5e9) 30%, transparent)",
                                  }}
                                >
                                  {item.code}
                                </span>
                                <span className="text-[11px] font-medium opacity-50 whitespace-nowrap">
                                  {new Date(item.redeemed_at).toLocaleDateString("ru-RU", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-1.5 justify-start sm:justify-end">
                                {item.granted_reward_titles?.map((title, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20"
                                  >
                                    Предмет: {title}
                                  </span>
                                ))}
                                {item.granted_material_titles?.map((title, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20"
                                  >
                                    Материал: {title}
                                  </span>
                                ))}
                                {item.physical_prize && (
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                    Приз: {item.physical_prize.title}
                                  </span>
                                )}
                                {!item.granted_reward_titles?.length &&
                                  !item.granted_material_titles?.length &&
                                  !item.physical_prize && (
                                    <span className="text-[10px] font-medium opacity-50">
                                      Доступ активирован
                                    </span>
                                  )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Модалка демонстрации выданных предметов */}
      {unboxModalOpen && (
        <RewardUnboxModal
          isOpen={unboxModalOpen}
          items={unboxedItems}
          onClose={() => {
            setUnboxModalOpen(false);
            setUnboxedItems([]);
          }}
        />
      )}

      {/* Выбор материала по промокоду */}
      {materialChoiceState.isOpen && (
        <MaterialChoiceModal
          isOpen={materialChoiceState.isOpen}
          promocodeCode={materialChoiceState.code}
          requiredChoiceCount={materialChoiceState.remainingCount}
          onClose={() => {
            setMaterialChoiceState({ ...materialChoiceState, isOpen: false });
          }}
          onSuccess={handleMaterialChoiceSuccess}
        />
      )}

      {/* Физический приз */}
      {physicalPrizeState.isOpen && physicalPrizeState.prize && (
        <PhysicalPrizeModal
          isOpen={physicalPrizeState.isOpen}
          prize={physicalPrizeState.prize}
          onClose={closePhysicalPrizeModal}
        />
      )}
    </>
  );
}