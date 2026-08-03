"use client";

import React, { useState, useEffect } from "react";
import MascotViewer from "../mascot/MascotViewer";
import MaterialChoiceModal from "./MaterialChoiceModal";
import PhysicalPrizeModal from "./PhysicalPrizeModal";
import type {
  MascotSettings,
  RewardItem,
  RewardType,
  StreakConfigItem,
  UserInventoryItem,
  CustomPhysicalPrize,
} from "@/lib/rewards/types";

interface RewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "wardrobe" | "streaks" | "promocode";
}

export default function RewardsModal({
  isOpen,
  onClose,
  defaultTab = "wardrobe",
}: RewardsModalProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [loading, setLoading] = useState(true);

  // Данные
  const [mascot, setMascot] = useState<MascotSettings | null>(null);
  const [inventory, setInventory] = useState<UserInventoryItem[]>([]);
  const [streakPath, setStreakPath] = useState<StreakConfigItem[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);

  // Категория гардероба
  const [wardrobeCategory, setWardrobeCategory] = useState<RewardType>("hat");
  const [equipping, setEquipping] = useState(false);

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
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

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
        setCurrentStreak(streaksData.currentStreak || 0);
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
    setEquipping(true);
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
    } finally {
      setEquipping(false);
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
        loadData(); // Перезагружаем стрик и инвентарь
      } else {
        const err = await res.json();
        alert(err.error || "Ошибка получения награды");
      }
    } catch (e) {
      alert(" Ошибка сети");
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
        // Успех! Проверяем, нужны ли дополнительные шаги
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
          loadData();
        }
      }
    } catch (e) {
      setPromoError("Ошибка сети при активации");
    } finally {
      setRedeeming(false);
    }
  };

  if (!isOpen) return null;

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
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden relative animate-in fade-in zoom-in-95">
          {/* Шапка модалки */}
          <div className="flex items-center justify-between p-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎭</span>
              <h2 className="text-xl font-black text-white">Центр Наград</h2>
            </div>

            {/* Табы */}
            <div className="flex gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setActiveTab("wardrobe")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "wardrobe"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                👕 Гардероб
              </button>
              <button
                onClick={() => setActiveTab("streaks")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "streaks"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🔥 Серия ({currentStreak}d)
              </button>
              <button
                onClick={() => setActiveTab("promocode")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "promocode"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                🎁 Промокод
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              ✕
            </button>
          </div>

          {/* ТЕЛО МОДАЛКИ */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-500 font-semibold">
                Загрузка Центра Наград...
              </div>
            ) : (
              <>
                {/* TAB 1: ГАРДЕРОБ */}
                {activeTab === "wardrobe" && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-full">
                    {/* Слева: Предпросмотр Маскота */}
                    <div className="md:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center relative">
                      <MascotViewer mascotSettings={mascot} size={240} />
                      <div className="text-xs text-slate-500 font-medium mt-4">
                        Кликайте по предметам справа для примерки
                      </div>
                    </div>

                    {/* Справа: Категории и Сетка Инвентаря */}
                    <div className="md:col-span-7 flex flex-col space-y-4">
                      {/* Селектор категорий */}
                      <div className="flex gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
                        {[
                          { type: "hat", label: "👑 Шляпы" },
                          { type: "aura", label: "✨ Ауры" },
                          { type: "emotion", label: "😄 Эмоции" },
                          { type: "base", label: "☁️ Базы" },
                          { type: "title", label: "🏷️ Титулы" },
                        ].map((cat) => (
                          <button
                            key={cat.type}
                            onClick={() =>
                              setWardrobeCategory(cat.type as RewardType)
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                              wardrobeCategory === cat.type
                                ? "bg-slate-800 text-indigo-400 border border-indigo-500/30"
                                : "text-slate-400 hover:bg-slate-800/50"
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {/* Сетка разблокированных предметов */}
                      <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 pr-1">
                        {filteredInventory.length === 0 ? (
                          <div className="col-span-full py-12 text-center text-slate-500 text-xs">
                            У вас пока нет предметов в этой категории.
                            <br />
                            Заходите каждый день или активируйте промокоды!
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
                                className={`bg-slate-950 border rounded-2xl p-3 flex flex-col items-center justify-between cursor-pointer transition-all relative group ${
                                  equipped
                                    ? "border-indigo-500 bg-indigo-950/20 shadow-lg shadow-indigo-500/10"
                                    : "border-slate-800 hover:border-slate-700"
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
                                        borderColor: item.reward.meta?.color || "#8b5cf6",
                                        color: item.reward.meta?.color || "#8b5cf6",
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

                {/* TAB 2: ДОРОЖКА СЕРИИ (СТРИКИ) */}
                {activeTab === "streaks" && (
                  <div className="space-y-6 max-w-2xl mx-auto py-4">
                    <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl text-center space-y-2">
                      <div className="text-4xl font-black text-amber-500 flex items-center justify-center gap-2">
                        <span>🔥</span> {currentStreak} D
                      </div>
                      <p className="text-xs text-slate-400">
                        Ваша текущая серия входа. Не пропускайте дни, чтобы забирать эксклюзивные награды!
                      </p>
                    </div>

                    <div className="space-y-3">
                      {streakPath.map((item) => (
                        <div
                          key={item.day_number}
                          className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                            item.is_claimed
                              ? "bg-slate-950/50 border-slate-800/60 opacity-60"
                              : item.is_available
                              ? "bg-amber-950/20 border-amber-500/50 shadow-lg shadow-amber-500/10"
                              : "bg-slate-950 border-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-black text-amber-500 text-lg">
                              {item.day_number}d
                            </div>
                            <div>
                              <div className="font-bold text-sm text-white">
                                {item.reward?.title || `День ${item.day_number}`}
                              </div>
                              <div className="text-xs text-slate-500 capitalize">
                                {item.reward?.type || "Награда"}
                              </div>
                            </div>
                          </div>

                          <div>
                            {item.is_claimed ? (
                              <span className="text-xs font-bold text-slate-500 px-3 py-1.5 bg-slate-900 rounded-xl border border-slate-800">
                                Забрано ✓
                              </span>
                            ) : item.is_available ? (
                              <button
                                onClick={() => handleClaimStreak(item.day_number)}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-600/30"
                              >
                                Забрать награду!
                              </button>
                            ) : (
                              <span className="text-xs font-semibold text-slate-600 px-3 py-1.5 bg-slate-900/50 rounded-xl">
                                Закрыто 🔒
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: ПРОМОКОД */}
                {activeTab === "promocode" && (
                  <div className="max-w-md mx-auto py-12 space-y-6">
                    <div className="text-center space-y-2">
                      <div className="text-4xl">🎁</div>
                      <h3 className="text-lg font-black text-white">
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
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center text-lg font-mono font-bold text-emerald-400 uppercase tracking-widest focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      </div>

                      {promoError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 text-center font-semibold">
                          {promoError}
                        </div>
                      )}

                      {promoSuccessMsg && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 text-center font-semibold">
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
            loadData();
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
            loadData();
          }}
        />
      )}
    </>
  );
}