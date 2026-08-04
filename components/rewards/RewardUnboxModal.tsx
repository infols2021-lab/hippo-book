"use client";

import React, { useState } from "react";

export type UnboxedRewardItem = {
  id: string;
  title: string;
  type?: string; // "hat" | "aura" | "emotion" | "base" | "title" | "material" | "physical" | string;
  description?: string | null;
  asset_url?: string | null;
  meta?: any;
};

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
  const [step, setStep] = useState(0);

  if (!isOpen || !items || items.length === 0) return null;

  const currentItem = items[step] || items[0];
  const isLast = step >= items.length - 1;

  const handleNext = () => {
    if (isLast) {
      setStep(0);
      onClose();
    } else {
      setStep((prev) => prev + 1);
    }
  };

  const getTypeLabel = (type?: string) => {
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
      case "material":
        return "📚 Учебный материал";
      case "physical":
        return "🎁 Физический подарок";
      default:
        return "🎁 Награда";
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.75)",
      }}
    >
      <div
        className="w-full max-w-md rounded-[32px] p-6 text-center space-y-6 relative overflow-hidden transition-all shadow-2xl"
        style={{
          backgroundColor: "var(--project-card-bg, #ffffff)",
          color: "var(--project-text, #0f172a)",
          border: "1px solid var(--glass-border, rgba(15,23,42,0.12))",
          boxShadow: "var(--glass-shadow, 0 20px 50px rgba(0,0,0,0.25))",
        }}
      >
        {/* Шаг / Индикатор прогресса */}
        {items.length > 1 && (
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider opacity-70">
            <span>Награда {step + 1} из {items.length}</span>
            <div className="flex gap-1.5">
              {items.map((_, idx) => (
                <div
                  key={idx}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: idx === step ? "20px" : "6px",
                    backgroundColor:
                      idx === step
                        ? "var(--project-primary, #0ea5e9)"
                        : "color-mix(in srgb, var(--project-text, #0f172a) 20%, transparent)",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Анимация праздника */}
        <div className="text-6xl animate-bounce my-2">🎉</div>

        {/* Категория награды */}
        <div className="inline-block">
          <span
            className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--project-primary, #0ea5e9) 12%, transparent)",
              borderColor:
                "color-mix(in srgb, var(--project-primary, #0ea5e9) 30%, transparent)",
              color: "var(--project-primary, #0ea5e9)",
            }}
          >
            {getTypeLabel(currentItem.type)}
          </span>
        </div>

        {/* Заголовок предмета */}
        <div className="space-y-2">
          <h2
            className="text-2xl font-black tracking-tight"
            style={{ color: "var(--project-text, #0f172a)" }}
          >
            {currentItem.type === "title" ? `«${currentItem.title}»` : currentItem.title}
          </h2>
          {currentItem.description && (
            <p
              className="text-xs font-medium leading-relaxed opacity-75 max-w-xs mx-auto"
              style={{ color: "var(--project-text, #0f172a)" }}
            >
              {currentItem.description}
            </p>
          )}
        </div>

        {/* Визуализация предмета */}
        <div
          className="w-full h-48 rounded-2xl flex items-center justify-center p-4 border relative overflow-hidden"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--project-text, #0f172a) 3%, transparent)",
            borderColor: "var(--glass-border, rgba(15,23,42,0.08))",
          }}
        >
          {currentItem.type === "title" ? (
            <span
              className="font-black text-lg px-6 py-2.5 rounded-full border shadow-md uppercase tracking-wider"
              style={{
                borderColor: currentItem.meta?.color || "var(--project-primary, #0ea5e9)",
                color: currentItem.meta?.color || "var(--project-primary, #0ea5e9)",
                backgroundColor: `${
                  currentItem.meta?.color || "var(--project-primary, #0ea5e9)"
                }18`,
              }}
            >
              «{currentItem.title}»
            </span>
          ) : currentItem.asset_url ? (
            <img
              src={currentItem.asset_url}
              alt={currentItem.title}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-6xl">🎁</span>
          )}
        </div>

        {/* Кнопка "Далее" / "Завершить" */}
        <button
          type="button"
          onClick={handleNext}
          className="w-full py-3.5 font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-lg active:scale-95 hover:opacity-90"
          style={{
            backgroundColor: "var(--project-primary, #0ea5e9)",
            color: "#ffffff",
            boxShadow:
              "0 10px 25px color-mix(in srgb, var(--project-primary, #0ea5e9) 35%, transparent)",
          }}
        >
          {isLast ? "Завершить 🎉" : "Далее →"}
        </button>
      </div>
    </div>
  );
}
