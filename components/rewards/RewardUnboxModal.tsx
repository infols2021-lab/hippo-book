"use client";

import React, { useState } from "react";
import type { RewardType, RewardMeta } from "@/lib/rewards/types";

export interface UnboxedRewardItem {
  id: string;
  title: string;
  type: RewardType | string;
  description?: string | null;
  asset_url?: string | null;
  meta?: RewardMeta;
}

interface RewardUnboxModalProps {
  isOpen: boolean;
  items: UnboxedRewardItem[];
  onClose: () => void;
}

export default function RewardUnboxModal({
  isOpen,
  items,
  onClose,
}: RewardUnboxModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!isOpen || !items || items.length === 0) return null;

  const currentItem = items[currentIndex] || items[0];
  const isLast = currentIndex >= items.length - 1;

  const handleNext = () => {
    if (isLast) {
      setCurrentIndex(0);
      onClose();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "hat":
        return "👑 Головной убор";
      case "aura":
        return "✨ Аура маскота";
      case "emotion":
        return "😄 Эмоция маскота";
      case "base":
        return "☁️ База маскота";
      case "title":
        return "🏷️ Титул профиля";
      default:
        return "🎁 Награда";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.82)" }}
    >
      <div
        className="rounded-[32px] max-w-md w-full p-8 text-center space-y-6 shadow-2xl relative overflow-hidden border transition-all"
        style={{
          backgroundColor: "var(--project-card-bg, #ffffff)",
          color: "var(--project-text, #0f172a)",
          borderColor: "var(--glass-border, rgba(15, 23, 42, 0.12))",
          boxShadow: "var(--glass-shadow, 0 20px 50px rgba(0,0,0,0.3))",
        }}
      >
        {/* Фоновый размытый блик темы */}
        <div
          className="absolute -top-16 -left-16 w-40 h-40 rounded-full blur-3xl pointer-events-none opacity-25"
          style={{ backgroundColor: "var(--project-primary, #0ea5e9)" }}
        />
        <div
          className="absolute -bottom-16 -right-16 w-40 h-40 rounded-full blur-3xl pointer-events-none opacity-25"
          style={{ backgroundColor: "var(--project-secondary, #38bdf8)" }}
        />

        {/* Шапка шагов */}
        <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider opacity-60">
          <span>Новая награда!</span>
          {items.length > 1 && (
            <span>
              {currentIndex + 1} из {items.length}
            </span>
          )}
        </div>

        {/* Анимационный эффект */}
        <div className="text-5xl animate-bounce">🎁</div>

        {/* Карточка самой награды */}
        <div
          className="p-6 rounded-2xl border flex flex-col items-center justify-center space-y-4"
          style={{
            backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 3%, transparent)",
            borderColor: "var(--glass-border, rgba(15, 23, 42, 0.1))",
          }}
        >
          <span
            className="text-xs font-black px-3 py-1 rounded-full border uppercase tracking-wider"
            style={{
              backgroundColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 12%, transparent)",
              color: "var(--project-primary, #0ea5e9)",
              borderColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 25%, transparent)",
            }}
          >
            {getTypeLabel(currentItem.type)}
          </span>

          {/* Титул или Изображение */}
          {currentItem.type === "title" ? (
            <div className="py-4">
              <span
                className="font-black text-lg px-5 py-2 rounded-2xl border inline-block shadow-sm uppercase tracking-wider"
                style={{
                  borderColor: currentItem.meta?.color || "var(--project-primary, #0ea5e9)",
                  color: currentItem.meta?.color || "var(--project-primary, #0ea5e9)",
                  backgroundColor: `${currentItem.meta?.color || "var(--project-primary, #0ea5e9)"}18`,
                }}
              >
                «{currentItem.title}»
              </span>
            </div>
          ) : currentItem.asset_url ? (
            <div className="w-32 h-32 flex items-center justify-center py-2">
              <img
                src={currentItem.asset_url}
                alt={currentItem.title}
                className="max-h-full max-w-full object-contain filter drop-shadow-md"
              />
            </div>
          ) : (
            <div className="text-4xl py-4">✨</div>
          )}

          <div className="space-y-1">
            <h3 className="text-xl font-black">{currentItem.title}</h3>
            {currentItem.description && (
              <p className="text-xs font-medium opacity-70 leading-relaxed">
                {currentItem.description}
              </p>
            )}
          </div>
        </div>

        {/* Кнопка действия */}
        <button
          type="button"
          onClick={handleNext}
          className="w-full py-4 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg hover:brightness-105 active:scale-[0.99]"
          style={{
            backgroundColor: "var(--project-primary, #0ea5e9)",
            boxShadow: "0 10px 25px -4px color-mix(in srgb, var(--project-primary, #0ea5e9) 40%, transparent)",
          }}
        >
          {isLast ? "Отлично, забрать!" : "Далее →"}
        </button>
      </div>
    </div>
  );
}
