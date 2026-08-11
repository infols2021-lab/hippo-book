"use client";

import React from "react";
import type { CustomPhysicalPrize } from "@/lib/rewards/types";

// Расширяем локальный интерфейс на случай, если в types.ts еще нет link_url
interface ExtendedPhysicalPrize extends CustomPhysicalPrize {
  link_url?: string;
}

interface PhysicalPrizeModalProps {
  isOpen: boolean;
  prize: ExtendedPhysicalPrize;
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
    >
      <div
        className="rounded-[32px] max-w-md w-full p-6 text-center space-y-6 shadow-2xl relative overflow-hidden border transition-all"
        style={{
          backgroundColor: "var(--project-card-bg, #ffffff)",
          color: "var(--project-text, #0f172a)",
          borderColor: "var(--glass-border, rgba(15, 23, 42, 0.12))",
        }}
      >
        {/* Декоративное свечение */}
        <div
          className="absolute -top-12 -left-12 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-25"
          style={{ backgroundColor: "var(--project-primary, #0ea5e9)" }}
        />
        <div
          className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-25"
          style={{ backgroundColor: "var(--project-secondary, #38bdf8)" }}
        />

        <div className="text-5xl animate-bounce">🎉</div>

        <div className="space-y-2">
          <h2
            className="text-xl font-black"
            style={{ color: "var(--project-primary, #0ea5e9)" }}
          >
            {prize.title || "Вы выиграли подарок!"}
          </h2>
          <p className="text-xs font-medium opacity-80 leading-relaxed">
            {prize.text}
          </p>
        </div>

        {/* Картинка приза */}
        {prize.image_url && (
          <div
            className="w-full h-44 rounded-2xl overflow-hidden flex items-center justify-center p-2 border"
            style={{
              backgroundColor: "color-mix(in srgb, var(--project-text, #0f172a) 3%, transparent)",
              borderColor: "var(--glass-border, rgba(15, 23, 42, 0.1))",
            }}
          >
            <img
              src={prize.image_url}
              alt={prize.title}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        )}

        {/* Кнопки действий */}
        <div className="space-y-3 mt-4">
          {prize.link_url && (
            <a
              href={prize.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full py-3.5 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg hover:brightness-105"
              style={{
                backgroundColor: "var(--project-primary, #0ea5e9)",
              }}
            >
              Перейти по ссылке
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`w-full py-3.5 font-black text-xs uppercase tracking-wider rounded-2xl transition-all ${
              prize.link_url
                ? "bg-gray-100 text-gray-500 hover:bg-gray-200 shadow-sm"
                : "text-white shadow-lg hover:brightness-105"
            }`}
            style={
              !prize.link_url
                ? { backgroundColor: "var(--project-primary, #0ea5e9)" }
                : {}
            }
          >
            {prize.link_url ? "Закрыть" : "Замечательно!"}
          </button>
        </div>
      </div>
    </div>
  );
}