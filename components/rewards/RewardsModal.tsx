"use client";

import React, { useState, useEffect, useRef } from "react";
import MascotViewer from "../mascot/MascotViewer";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { dispatchTourRewardsModalReady } from "@/lib/tour/tourMobile";
import StreakTimeline from "./StreakTimeline";
import MaterialChoiceModal, {
  MaterialChoiceSuccessResult,
} from "./MaterialChoiceModal";
import PhysicalPrizeModal from "./PhysicalPrizeModal";
import RewardUnboxModal, { UnboxedRewardItem } from "./RewardUnboxModal";
import ReferralTab from "./ReferralTab";

import type {
  MascotSettings,
  RewardType,
  StreakConfigItem,
  StreakStats,
  UserInventoryItem,
  CustomPhysicalPrize,
  UserPromocodeHistoryItem,
} from "@/lib/rewards/types";

export type RewardsTabType = "wardrobe" | "streaks" | "promocode" | "timeline" | "referrals";

export interface RewardsModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  defaultTab?: RewardsTabType;
  initialTab?: RewardsTabType;
  /** Тур наград активен — вкладки переключает только гайд, стартуем с гардероба. */
  tourMode?: boolean;
  /**
   * `modal` — классическая модалка поверх страницы (по умолчанию).
   * `page` — полноэкранная страница "Центр наград" (без оверлея и блокировки скролла),
   * у которой в шапке вместо кнопки "Закрыть" — кнопка возврата назад.
   */
  variant?: "modal" | "page";
  /** Заголовок страницы (используется только при variant="page"). */
  title?: string;
}

export default function RewardsModal({
  isOpen,
  open,
  onClose,
  defaultTab = "wardrobe",
  initialTab,
  tourMode = false,
  variant = "modal",
  title = "Центр наград",
}: RewardsModalProps) {
  const showModal = Boolean(isOpen ?? open);
  const isPage = variant === "page";
  useBodyScrollLock(showModal && !isPage);

  const normalizeTab = (tab?: RewardsTabType): "wardrobe" | "streaks" | "promocode" | "referrals" => {
    const raw = tab || initialTab || defaultTab;
    if (raw === "timeline") return "streaks";
    return raw === "promocode" || raw === "streaks" || raw === "referrals" ? raw : "wardrobe";
  };

  const [activeTab, setActiveTab] = useState<"wardrobe" | "streaks" | "promocode" | "referrals">(
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

  // 1. По умолчанию открываем "Скины"
  const [wardrobeCategory, setWardrobeCategory] = useState<RewardType>("base");

  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccessMsg, setPromoSuccessMsg] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  const [promoHistory, setPromoHistory] = useState<UserPromocodeHistoryItem[]>([]);
  const [selectedHistoryLog, setSelectedHistoryLog] = useState<UserPromocodeHistoryItem | null>(null);

  const [unboxModalOpen, setUnboxModalOpen] = useState(false);
  const [unboxedItems, setUnboxedItems] = useState<UnboxedRewardItem[]>([]);
  
  // 2. Стейт для отложенного показа физического приза
  const [pendingPhysicalPrize, setPendingPhysicalPrize] = useState<CustomPhysicalPrize | null>(null);

  const [materialChoiceState, setMaterialChoiceState] = useState<{
    isOpen: boolean;
    code: string;
    remainingCount: number;
  }>({ isOpen: false, code: "", remainingCount: 0 });

  const [physicalPrizeState, setPhysicalPrizeState] = useState<{
    isOpen: boolean;
    prize: CustomPhysicalPrize | null;
  }>({ isOpen: false, prize: null });

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tourModeRef = useRef(tourMode);
  tourModeRef.current = tourMode;

  const applyRewardsTab = (mapped: "wardrobe" | "streaks" | "referrals" | "promocode") => {
    setActiveTab(mapped);
    requestAnimationFrame(() => scrollRewardTabIntoView(mapped));
  };

  const selectTab = (tab: "wardrobe" | "streaks" | "promocode" | "referrals") => {
    if (tourModeRef.current) return;
    applyRewardsTab(tab);
  };

  const mapTourTab = (tab: string): "wardrobe" | "streaks" | "referrals" | "promocode" | null => {
    const tabMap: Record<string, "wardrobe" | "streaks" | "referrals" | "promocode"> = {
      wardrobe: "wardrobe",
      streaks: "streaks",
      referral: "referrals",
      promos: "promocode",
    };
    return tabMap[tab] ?? null;
  };

  const scrollRewardTabIntoView = (mapped: "wardrobe" | "streaks" | "referrals" | "promocode") => {
    const container = tabsContainerRef.current;
    if (mapped === "wardrobe" && container) {
      container.scrollLeft = 0;
    }

    const selector =
      mapped === "wardrobe"
        ? '[data-tour="wardrobe-tab"]'
        : mapped === "streaks"
        ? '[data-tour="streaks-tab"]'
        : mapped === "referrals"
        ? '[data-tour="referral-tab"]'
        : '[data-tour="promos-tab"]';

    document.querySelector<HTMLElement>(selector)?.scrollIntoView({
      block: "nearest",
      inline: mapped === "wardrobe" ? "start" : "nearest",
    });
  };

  useEffect(() => {
    const handleTourTab = (e: CustomEvent | Event) => {
      const mapped = mapTourTab(String((e as CustomEvent).detail ?? ""));
      if (mapped) applyRewardsTab(mapped);
    };

    window.addEventListener("tour:show-reward-tab", handleTourTab);
    return () => window.removeEventListener("tour:show-reward-tab", handleTourTab);
  }, []);

  useEffect(() => {
    if (showModal) {
      void loadData();
    }
  }, [showModal]);

  useEffect(() => {
    if (showModal && !loading) {
      requestAnimationFrame(() => dispatchTourRewardsModalReady());
    }
  }, [showModal, loading]);

  useEffect(() => {
    if (!showModal) return;
    if (tourMode) {
      applyRewardsTab("wardrobe");
      return;
    }
    const tab = normalizeTab(initialTab || defaultTab);
    applyRewardsTab(tab);
  }, [showModal, initialTab, defaultTab, tourMode]);

  useEffect(() => {
    if (!showModal || !tourMode) return;
    applyRewardsTab("wardrobe");
  }, [tourMode, showModal]);

  // 3. Параметр silent и жёсткое отключение кэша
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [mascotRes, streaksRes] = await Promise.all([
        fetch("/api/mascot", { cache: "no-store" }),
        fetch("/api/streaks", { cache: "no-store" }),
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
        const promoHistoryRes = await fetch("/api/promocodes/history", { cache: "no-store" });
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
      if (!silent) setLoading(false);
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
              type: data.reward.type || "base",
              description: data.reward.description || `Награда за ${dayNumber} дн. серии`,
              asset_url: data.reward.asset_url,
              meta: data.reward.meta,
            },
          ]);
          setUnboxModalOpen(true);
        }
        await loadData(true); // silent обновление стейта
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка получения награды");
      }
    } catch (e) {
      alert("Ошибка сети");
    }
  };

  // 4. Логика очереди: сначала анбокс цифровых -> потом физический
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

    if (rewardItems.length > 0) {
      setUnboxedItems(rewardItems);
      setUnboxModalOpen(true);
      // Если есть физический приз - кидаем в ожидание
      if (data.physicalPrize) {
        setPendingPhysicalPrize(data.physicalPrize);
      }
    } else if (data.physicalPrize) {
      // Цифровых нет, сразу показываем физику
      setPhysicalPrizeState({ isOpen: true, prize: data.physicalPrize });
    } else {
      setPromoSuccessMsg("Промокод успешно активирован!");
    }

    void loadData(true);
  };

  const handleMaterialChoiceSuccess = (result: MaterialChoiceSuccessResult) => {
    setMaterialChoiceState((prev) => ({ ...prev, isOpen: false }));

    const rewardItems = result.unboxItems as UnboxedRewardItem[];

    if (rewardItems.length > 0) {
      setUnboxedItems(rewardItems);
      setUnboxModalOpen(true);
      if (result.physicalPrize) {
        setPendingPhysicalPrize(result.physicalPrize);
      }
    } else if (result.physicalPrize) {
      setPhysicalPrizeState({ isOpen: true, prize: result.physicalPrize });
    } else {
      setPromoSuccessMsg("Материалы успешно разблокированы!");
    }

    void loadData(true);
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
    void loadData(true);
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
        className={
          isPage
            ? "w-full h-full flex justify-center overflow-hidden"
            : "fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 overflow-hidden overscroll-none"
        }
        style={isPage ? undefined : { backgroundColor: "rgba(0,0,0,0.8)" }}
      >
        <div
          className={
            isPage
              ? "w-full h-full max-w-[56rem] flex flex-col overflow-hidden"
              : "rounded-t-[32px] sm:rounded-[32px] w-full max-w-[min(56rem,100vw)] h-[90vh] sm:h-[88vh] flex flex-col shadow-2xl overflow-hidden relative border transition-all"
          }
          style={
            isPage
              ? { backgroundColor: "var(--project-card-bg, #ffffff)", color: "var(--project-text, #0f172a)" }
              : {
                  backgroundColor: "var(--project-card-bg, #ffffff)",
                  color: "var(--project-text, #0f172a)",
                  borderColor: "var(--glass-border, rgba(15,23,42,0.12))",
                }
          }
        >
          {!isPage && (
            <div className="w-10 h-1 rounded-full mx-auto sm:hidden mt-2 -mb-2" style={{ backgroundColor: "color-mix(in srgb, var(--project-text) 20%, transparent)" }} />
          )}

          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 border-b gap-3"
            style={{
              borderColor: "var(--glass-border, rgba(15,23,42,0.08))",
              backgroundColor: "var(--project-card-bg, #ffffff)",
            }}
          >
            <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto min-w-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: "var(--project-primary, #0ea5e9)" }}
                />
                <h2 className="text-base sm:text-xl font-black tracking-wide uppercase truncate">{title}</h2>
              </div>

              {isPage && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1 font-bold text-xs rounded-xl transition-all border flex items-center gap-1.5 flex-shrink-0"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 6%, transparent)",
                    borderColor: "var(--glass-border, rgba(15,23,42,0.1))",
                    color: "var(--project-text, #0f172a)",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
                  Назад
                </button>
              )}

              {!isPage && (
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
              )}
            </div>

            <div
              ref={tabsContainerRef}
              className="flex gap-1 p-1 rounded-2xl border overflow-x-auto no-scrollbar w-full sm:w-auto min-w-0 max-w-full flex-shrink"
              style={{
                backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 4%, transparent)",
                borderColor: "var(--glass-border, rgba(15,23,42,0.1))",
              }}
            >
              <button
                id="tour-wardrobe"
                data-tour="wardrobe-tab"
                type="button"
                onClick={() => selectTab("wardrobe")}
                className="flex-shrink-0 sm:flex-none px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-black tracking-wide uppercase whitespace-nowrap transition-all"
                style={{
                  backgroundColor:
                    activeTab === "wardrobe" ? "var(--project-primary, #0ea5e9)" : "transparent",
                  color: activeTab === "wardrobe" ? "#ffffff" : "var(--project-text, #0f172a)",
                }}
              >
                Гардероб
              </button>
              <button
                id="tour-streaks"
                data-tour="streaks-tab"
                type="button"
                onClick={() => selectTab("streaks")}
                className="flex-shrink-0 sm:flex-none px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-black tracking-wide uppercase whitespace-nowrap transition-all"
                style={{
                  backgroundColor:
                    activeTab === "streaks" ? "var(--project-primary, #0ea5e9)" : "transparent",
                  color: activeTab === "streaks" ? "#ffffff" : "var(--project-text, #0f172a)",
                }}
              >
                Серия ({streakStats.currentStreak} дн.)
              </button>
              
              <button
                id="tour-referral"
                data-tour="referral-tab"
                type="button"
                onClick={() => selectTab("referrals")}
                className="flex-shrink-0 sm:flex-none px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-black tracking-wide uppercase whitespace-nowrap transition-all"
                style={{
                  backgroundColor:
                    activeTab === "referrals" ? "var(--project-primary, #0ea5e9)" : "transparent",
                  color: activeTab === "referrals" ? "#ffffff" : "var(--project-text, #0f172a)",
                }}
              >
                Рефералка
              </button>

              <button
                id="tour-promos"
                data-tour="promos-tab"
                type="button"
                onClick={() => selectTab("promocode")}
                className="flex-shrink-0 sm:flex-none px-3.5 py-2 rounded-xl text-[11px] sm:text-xs font-black tracking-wide uppercase whitespace-nowrap transition-all"
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
              className={`hidden sm:block px-3.5 py-1.5 font-bold text-xs rounded-xl transition-all border ${isPage ? "sm:hidden" : ""}`}
              style={{
                backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 6%, transparent)",
                borderColor: "var(--glass-border, rgba(15,23,42,0.1))",
                color: "var(--project-text, #0f172a)",
              }}
            >
              Закрыть
            </button>
          </div>

          <div className={`flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 ${isPage ? "pb-36 sm:pb-6" : ""}`}>
            {loading ? (
              <div className="h-full flex items-center justify-center font-bold text-xs sm:text-sm uppercase tracking-wider opacity-60">
                Загрузка данных...
              </div>
            ) : (
              <>
                {activeTab === "wardrobe" && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 min-h-0">
                    <div
                      className="md:col-span-5 border rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col items-center justify-center relative shadow-sm min-h-[220px] md:min-h-[280px] md:max-h-[420px]"
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

                    <div className="md:col-span-7 flex flex-col space-y-3 sm:space-y-4 min-h-0">
                      <div
                        className="flex gap-2 border-b pb-2.5 overflow-x-auto no-scrollbar"
                        style={{ borderColor: "var(--glass-border, rgba(15,23,42,0.08))" }}
                      >
                        {[
                          { type: "base", label: "Скины" },
                          { type: "aura", label: "Ауры" },
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
                        className={`overflow-y-auto overscroll-contain pr-1 min-h-0 max-h-[min(52vh,420px)] sm:max-h-[min(46vh,460px)] ${
                          wardrobeCategory === "title"
                            ? "flex flex-col gap-2.5"
                            : wardrobeCategory === "base"
                            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-2.5 items-start content-start auto-rows-max"
                            : "grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 items-start content-start auto-rows-max"
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

                            if (wardrobeCategory === "base") {
                              return (
                                <div
                                  key={item.id}
                                  onClick={() =>
                                    handleEquip(wardrobeCategory, equipped ? null : item.reward!.id)
                                  }
                                  className="border rounded-xl p-2 sm:p-2.5 flex flex-col items-center gap-1.5 cursor-pointer transition-all w-full"
                                  style={{
                                    backgroundColor: equipped
                                      ? "color-mix(in srgb, var(--project-primary, #0ea5e9) 10%, transparent)"
                                      : "color-mix(in srgb, var(--project-text, #0f172a) 2%, transparent)",
                                    borderColor: equipped
                                      ? "var(--project-primary, #0ea5e9)"
                                      : "var(--glass-border, rgba(15,23,42,0.08))",
                                  }}
                                >
                                  <div
                                    className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0"
                                    style={{
                                      background:
                                        "linear-gradient(145deg, color-mix(in srgb, var(--project-primary, #0ea5e9) 12%, transparent), color-mix(in srgb, var(--project-text, #0f172a) 4%, transparent))",
                                      border: equipped
                                        ? "2px solid var(--project-primary, #0ea5e9)"
                                        : "1px solid var(--glass-border, rgba(15,23,42,0.1))",
                                    }}
                                  >
                                    {item.reward.asset_url ? (
                                      <img
                                        src={item.reward.asset_url}
                                        alt=""
                                        className="w-[85%] h-[85%] object-contain drop-shadow-sm"
                                      />
                                    ) : (
                                      <span className="text-[9px] font-bold opacity-40">N/A</span>
                                    )}
                                    {equipped && (
                                      <span
                                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black"
                                        style={{
                                          backgroundColor: "var(--project-primary, #0ea5e9)",
                                          color: "#ffffff",
                                        }}
                                      >
                                        ✓
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-center w-full min-w-0">
                                    <div className="font-bold text-[10px] sm:text-[11px] truncate leading-tight">
                                      {item.reward.title}
                                    </div>
                                    <div className="text-[9px] font-semibold uppercase tracking-wider opacity-50 mt-0.5">
                                      {equipped ? "Надето" : "База"}
                                    </div>
                                  </div>
                                </div>
                              );
                            }

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
                                className="border rounded-2xl p-3 sm:p-3.5 flex flex-col items-center gap-2 cursor-pointer transition-all w-full"
                                style={{
                                  backgroundColor: equipped
                                    ? "color-mix(in srgb, var(--project-primary, #0ea5e9) 10%, transparent)"
                                    : "color-mix(in srgb, var(--project-text, #0f172a) 2%, transparent)",
                                  borderColor: equipped
                                    ? "var(--project-primary, #0ea5e9)"
                                    : "var(--glass-border, rgba(15,23,42,0.08))",
                                }}
                              >
                                <div className="w-full flex items-start justify-between gap-1 min-h-[18px]">
                                  {equipped ? (
                                    <span
                                      className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ml-auto"
                                      style={{
                                        backgroundColor: "var(--project-primary, #0ea5e9)",
                                        color: "#ffffff",
                                      }}
                                    >
                                      Надето
                                    </span>
                                  ) : (
                                    <span className="w-1" aria-hidden="true" />
                                  )}
                                </div>

                                <div className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center flex-shrink-0">
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

                                <div className="text-center w-full min-w-0">
                                  <div className="font-bold text-[11px] sm:text-xs truncate leading-tight">
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

                {activeTab === "streaks" && (
                  <StreakTimeline
                    stats={streakStats}
                    path={streakPath}
                    onClaimReward={handleClaimStreak}
                  />
                )}

                {activeTab === "referrals" && <ReferralTab />}

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

                    <div className="rounded-2xl border p-4 text-xs font-medium leading-relaxed" style={{ backgroundColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 6%, transparent)", borderColor: "var(--glass-border, rgba(15,23,42,0.08))", color: "var(--project-text, #0f172a)" }}>
                      <div className="font-black uppercase tracking-wider mb-2" style={{ color: "var(--project-primary, #0ea5e9)" }}>Как применить награду</div>
                      <ul className="space-y-1.5 list-disc pl-4">
                        <li>Скины и титулы — вкладка «Гардероб», кнопка «Надеть».</li>
                        <li>Материалы — раздел «Материалы» нужного направления.</li>
                        <li>Физический приз — напишите администратору.</li>
                      </ul>
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
                        <div 
                          className="p-3 border rounded-xl text-xs text-center font-bold"
                          style={{ 
                            backgroundColor: "color-mix(in srgb, #ef4444 10%, transparent)",
                            color: "#ef4444",
                            borderColor: "color-mix(in srgb, #ef4444 30%, transparent)"
                          }}
                        >
                          {promoError}
                        </div>
                      )}

                      {promoSuccessMsg && (
                        <div 
                          className="p-3 border rounded-xl text-xs text-center font-bold"
                          style={{ 
                            backgroundColor: "color-mix(in srgb, #10b981 10%, transparent)",
                            color: "#10b981",
                            borderColor: "color-mix(in srgb, #10b981 30%, transparent)"
                          }}
                        >
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
                        <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                          {promoHistory.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => setSelectedHistoryLog(item)}
                              className="border rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition-all cursor-pointer hover:scale-[1.01]"
                              style={{
                                backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 2%, transparent)",
                                borderColor: "var(--glass-border, rgba(15,23,42,0.08))",
                              }}
                            >
                              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between">
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className="font-mono font-black px-2.5 py-1 rounded-xl text-xs uppercase tracking-wider border"
                                    style={{
                                      backgroundColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 12%, transparent)",
                                      color: "var(--project-primary, #0ea5e9)",
                                      borderColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 30%, transparent)",
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
                                <div className="sm:hidden opacity-40">
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-1.5 justify-start sm:justify-end pr-2 sm:pr-0">
                                {item.granted_reward_titles?.map((title, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold border"
                                    style={{
                                      backgroundColor: "color-mix(in srgb, var(--project-secondary, var(--project-primary)) 10%, transparent)",
                                      color: "var(--project-secondary, var(--project-primary))",
                                      borderColor: "color-mix(in srgb, var(--project-secondary, var(--project-primary)) 20%, transparent)"
                                    }}
                                  >
                                    Предмет: {title}
                                  </span>
                                ))}
                                {item.granted_material_titles?.map((title, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold border"
                                    style={{
                                      backgroundColor: "color-mix(in srgb, var(--project-primary) 10%, transparent)",
                                      color: "var(--project-primary)",
                                      borderColor: "color-mix(in srgb, var(--project-primary) 20%, transparent)"
                                    }}
                                  >
                                    Материал: {title}
                                  </span>
                                ))}
                                {item.physical_prize && (
                                  <span 
                                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold border"
                                    style={{
                                      backgroundColor: "color-mix(in srgb, #f59e0b 10%, transparent)",
                                      color: "#d97706",
                                      borderColor: "color-mix(in srgb, #f59e0b 20%, transparent)"
                                    }}
                                  >
                                    Приз: {(item.physical_prize as any).title}
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

      {selectedHistoryLog && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-hidden overscroll-none animate-in fade-in duration-200"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
          onClick={() => setSelectedHistoryLog(null)}
        >
          <div
            className="rounded-[32px] max-w-md w-full p-6 text-center space-y-6 shadow-2xl relative overflow-hidden border transition-all"
            style={{
              backgroundColor: "var(--project-card-bg, #ffffff)",
              color: "var(--project-text, #0f172a)",
              borderColor: "var(--glass-border, rgba(15, 23, 42, 0.12))",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-25" style={{ backgroundColor: "var(--project-primary, #0ea5e9)" }} />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-25" style={{ backgroundColor: "var(--project-secondary, #38bdf8)" }} />

            <h2 className="text-xl font-black uppercase tracking-wider">Детали награды</h2>
            
            <div className="text-xs font-bold px-3 py-1.5 rounded-xl inline-block mx-auto" style={{ backgroundColor: "color-mix(in srgb, var(--project-text) 5%, transparent)" }}>
              {new Date(selectedHistoryLog.redeemed_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </div>

            <div className="space-y-3 text-left max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              <div className="p-4 rounded-2xl border" style={{ backgroundColor: "color-mix(in srgb, var(--project-primary) 5%, transparent)", borderColor: "color-mix(in srgb, var(--project-primary) 15%, transparent)" }}>
                <div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: "var(--project-primary)" }}>Активированный код</div>
                <div className="font-mono font-black text-lg" style={{ color: "var(--project-primary)" }}>{selectedHistoryLog.code}</div>
              </div>

              {selectedHistoryLog.granted_reward_titles && selectedHistoryLog.granted_reward_titles.length > 0 && (
                <div 
                  className="p-4 rounded-2xl border"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--project-secondary, var(--project-primary)) 8%, transparent)",
                    borderColor: "color-mix(in srgb, var(--project-secondary, var(--project-primary)) 20%, transparent)"
                  }}
                >
                  <div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: "var(--project-secondary, var(--project-primary))" }}>Предметы и титулы</div>
                  <div className="font-bold text-sm" style={{ color: "var(--project-text)" }}>🎽 {selectedHistoryLog.granted_reward_titles.join(", ")}</div>
                </div>
              )}

              {selectedHistoryLog.granted_material_titles && selectedHistoryLog.granted_material_titles.length > 0 && (
                <div 
                  className="p-4 rounded-2xl border"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--project-primary) 8%, transparent)",
                    borderColor: "color-mix(in srgb, var(--project-primary) 20%, transparent)"
                  }}
                >
                  <div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: "var(--project-primary)" }}>Открытые материалы</div>
                  <div className="font-bold text-sm" style={{ color: "var(--project-text)" }}>📚 {selectedHistoryLog.granted_material_titles.join(", ")}</div>
                </div>
              )}

              {selectedHistoryLog.physical_prize && (
                <div 
                  className="p-4 rounded-2xl border text-center flex flex-col items-center"
                  style={{
                    backgroundColor: "color-mix(in srgb, #f59e0b 8%, transparent)",
                    borderColor: "color-mix(in srgb, #f59e0b 20%, transparent)"
                  }}
                >
                  <div className="text-[10px] font-black uppercase tracking-wider mb-3 w-full text-left" style={{ color: "#f59e0b" }}>Особый приз</div>
                  {(selectedHistoryLog.physical_prize as any).image_url && (
                    <img src={(selectedHistoryLog.physical_prize as any).image_url} alt="" className="h-24 object-contain mb-3 drop-shadow-md rounded-xl" />
                  )}
                  <div className="font-black text-base mb-1" style={{ color: "var(--project-text)" }}>🧸 {(selectedHistoryLog.physical_prize as any).title}</div>
                  {(selectedHistoryLog.physical_prize as any).text && (
                    <div className="text-xs font-medium mb-4 px-2" style={{ color: "color-mix(in srgb, var(--project-text) 70%, transparent)" }}>{(selectedHistoryLog.physical_prize as any).text}</div>
                  )}
                  {(selectedHistoryLog.physical_prize as any).link_url && (
                    <a href={(selectedHistoryLog.physical_prize as any).link_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-full py-3 text-white font-black uppercase tracking-wider rounded-xl text-xs transition-all shadow-md hover:shadow-lg active:scale-[0.98]" style={{ backgroundColor: "#f59e0b" }}>
                      🔗 Перейти по ссылке
                    </a>
                  )}
                </div>
              )}

              {!selectedHistoryLog.granted_reward_titles?.length && !selectedHistoryLog.granted_material_titles?.length && !selectedHistoryLog.physical_prize && (
                 <div className="p-4 text-center opacity-50 font-bold text-sm">
                   Награды отсутствуют (возможно, просто открыт доступ)
                 </div>
              )}
            </div>

            <button onClick={() => setSelectedHistoryLog(null)} className="w-full py-3.5 font-black text-xs uppercase tracking-wider rounded-2xl transition-all hover:brightness-95" style={{ backgroundColor: "color-mix(in srgb, var(--project-text) 6%, transparent)" }}>
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* 5. Флоу открытия модалок: сначала Unbox (цифровые), после него - PhysicalPrize */}
      {unboxModalOpen && (
        <RewardUnboxModal
          isOpen={unboxModalOpen}
          items={unboxedItems}
          onClose={() => {
            setUnboxModalOpen(false);
            setUnboxedItems([]);
            // Если есть отложенный физический приз - показываем его сразу после закрытия анбокса
            if (pendingPhysicalPrize) {
              setTimeout(() => {
                setPhysicalPrizeState({ isOpen: true, prize: pendingPhysicalPrize });
                setPendingPhysicalPrize(null);
              }, 300);
            }
          }}
        />
      )}

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