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
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl max-w-md w-full p-6 text-center space-y-6 shadow-2xl shadow-amber-500/10 relative overflow-hidden animate-in zoom-in-95">
        {/* Декоративное свечение на фоне */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="text-5xl animate-bounce">🎉</div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-amber-400">
            {prize.title || "Вы выиграли подарок!"}
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            {prize.text}
          </p>
        </div>

        {/* Картинка приза (если есть) */}
        {prize.image_url && (
          <div className="w-full h-44 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center p-2">
            <img
              src={prize.image_url}
              alt={prize.title}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm rounded-2xl transition-all shadow-lg shadow-amber-600/30"
        >
          Замечательно!
        </button>
      </div>
    </div>
  );
}