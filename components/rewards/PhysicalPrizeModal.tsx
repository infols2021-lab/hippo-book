"use client";

import React from "react";
import type { CustomPhysicalPrize } from "@/lib/rewards/types";

interface PhysicalPrizeModalProps {
  isOpen: boolean;
  prize: CustomPhysicalPrize;
  onClose: () => void;
}

export default function PhysicalPrizeModal({
  isOpen,
  prize,
  onClose,
}: PhysicalPrizeModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
    >
      <div
        className="rounded-[32px] max-w-md w-full p-6 text-center space-y-6 relative overflow-hidden shadow-2xl border transition-all"
        style={{
          backgroundColor: "var(--project-card-bg, #ffffff)",
          color: "var(--project-text, #0f172a)",
          borderColor: "var(--glass-border, rgba(15,23,42,0.12))",
        }}
      >
        <div className="text-6xl animate-bounce my-2">🎉</div>

        <div className="space-y-2">
          <h2
            className="text-xl font-black uppercase tracking-wider"
            style={{ color: "var(--project-primary, #0ea5e9)" }}
          >
            {prize.title || "Поздравляем со специальным призом!"}
          </h2>
          <p className="text-xs font-medium leading-relaxed opacity-75 max-w-xs mx-auto">
            {prize.text}
          </p>
        </div>

        {/* Картинка приза (если есть) */}
        {prize.image_url && (
          <div
            className="w-full h-44 rounded-2xl overflow-hidden flex items-center justify-center p-2 border"
            style={{
              backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 3%, transparent)",
              borderColor: "var(--glass-border, rgba(15,23,42,0.08))",
            }}
          >
            <img
              src={prize.image_url}
              alt={prize.title}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg active:scale-95"
          style={{
            backgroundColor: "var(--project-primary, #0ea5e9)",
            color: "#ffffff",
          }}
        >
          Замечательно!
        </button>
      </div>
    </div>
  );
}
