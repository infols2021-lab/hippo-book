"use client";

import React from "react";
import type { MascotSettings, RewardItem } from "@/lib/rewards/types";

interface MascotViewerProps {
  mascotSettings?: MascotSettings | null;
  size?: number;
  className?: string;
  showTitle?: boolean;
}

export default function MascotViewer({
  mascotSettings,
  size = 300,
  className = "",
  showTitle = true,
}: MascotViewerProps) {
  const base = mascotSettings?.equipped_base;
  const hat = mascotSettings?.equipped_hat;
  const aura = mascotSettings?.equipped_aura;
  const emotion = mascotSettings?.equipped_emotion;
  const title = mascotSettings?.equipped_title;

  const getLayerStyle = (item?: RewardItem | null) => {
    if (!item?.meta) return {};
    const { offset_x = 0, offset_y = 0, scale = 1 } = item.meta;
    return {
      transform: `translate(${offset_x}px, ${offset_y}px) scale(${scale})`,
    };
  };

  return (
    <div
      className={`relative flex flex-col items-center justify-center max-w-full ${className}`}
      style={{ width: size, minHeight: size }}
    >
      {/* ТИТУЛ ПРОФИЛЯ */}
      {showTitle && title && (
        <div className="z-20 mb-3 max-w-full px-2 text-center">
          <span
            className="font-black text-[11px] sm:text-xs px-3 py-1 rounded-full border shadow-sm tracking-wide inline-block max-w-full truncate align-middle uppercase"
            style={{
              borderColor: title.meta?.color || "var(--project-primary, #0ea5e9)",
              color: title.meta?.color || "var(--project-primary, #0ea5e9)",
              backgroundColor: `${title.meta?.color || "var(--project-primary, #0ea5e9)"}18`,
              boxShadow: `0 4px 14px ${title.meta?.color || "var(--project-primary, #0ea5e9)"}25`,
            }}
          >
            «{title.title}»
          </span>
        </div>
      )}

      {/* ОСНОВНОЙ ХОЛСТ С АНИМАЦИЕЙ ПОКАЧИВАНИЯ */}
      <div
        className="relative flex items-center justify-center animate-[mascotFloat_4s_ease-in-out_infinite]"
        style={{ width: size, height: size }}
      >
        {/* 1. СЛОЙ 1: Аура / Эффекты сзади */}
        {aura?.asset_url ? (
          <img
            src={aura.asset_url}
            alt={aura.title}
            style={getLayerStyle(aura)}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none z-0 transition-transform duration-300"
          />
        ) : (
          <div
            className="absolute inset-4 rounded-full blur-2xl z-0 opacity-20"
            style={{ backgroundColor: "var(--project-primary, #0ea5e9)" }}
          />
        )}

        {/* 2. СЛОЙ 2: База Маскота */}
        {base?.asset_url ? (
          <img
            src={base.asset_url}
            alt={base.title}
            style={getLayerStyle(base)}
            className="absolute inset-0 w-full h-full object-contain z-10 transition-transform duration-300"
          />
        ) : (
          <div
            className="z-10 w-2/3 h-2/3 rounded-full flex items-center justify-center shadow-2xl border-4"
            style={{
              background: "linear-gradient(135deg, var(--project-primary, #0ea5e9), var(--project-secondary, #38bdf8))",
              borderColor: "color-mix(in srgb, var(--project-primary, #0ea5e9) 40%, transparent)",
            }}
          >
            <div className="w-full h-full relative flex items-center justify-center">
              {!emotion && (
                <div className="flex gap-4">
                  <div className="w-3 h-5 bg-white rounded-full animate-pulse" />
                  <div className="w-3 h-5 bg-white rounded-full animate-pulse" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. СЛОЙ 3: Эмоция / Лицо */}
        {emotion?.asset_url && (
          <img
            src={emotion.asset_url}
            alt={emotion.title}
            style={getLayerStyle(emotion)}
            className="absolute inset-0 w-full h-full object-contain z-20 transition-transform duration-300"
          />
        )}

        {/* 4. СЛОЙ 4: Шляпа / Головной убор */}
        {hat?.asset_url && (
          <img
            src={hat.asset_url}
            alt={hat.title}
            style={getLayerStyle(hat)}
            className="absolute inset-0 w-full h-full object-contain z-30 transition-transform duration-300"
          />
        )}
      </div>

      <style jsx global>{`
        @keyframes mascotFloat {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          50% {
            transform: translateY(-6px) rotate(1deg);
          }
        }
      `}</style>
    </div>
  );
}