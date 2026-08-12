"use client";

import Link from "next/link";
import type { ProjectConfig } from "@/app/(app)/portal/PortalClient";
import { useTour } from "@/components/tour/TourProvider";

type PortalCardProps = {
  project: ProjectConfig;
  index: number;
  compact?: boolean;
  /** Мобильная «пилюля» — горизонтальная карточка в вертикальном списке */
  pill?: boolean;
};

export default function PortalCard({ project, index, compact = false, pill = false }: PortalCardProps) {
  const { stage, advanceTour } = useTour();
  const pColor = project.theme?.primaryColor || "#3b82f6";
  const isLight = index % 2 === 0;

  const handleClick = () => {
    if (stage === "direction_gate") {
      advanceTour("profile_stats");
    }
  };

  if (pill) {
    return (
      <Link
        href={`/projects/${project.slug}`}
        onClick={handleClick}
        data-tour="direction-card"
        className="group relative flex items-center gap-3 w-full px-4 py-3.5 rounded-[20px] border transition-all duration-300 active:scale-[0.98] overflow-hidden"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${pColor} 18%, #0f172a) 0%, color-mix(in srgb, ${pColor} 8%, #0b0f19) 100%)`,
          borderColor: `color-mix(in srgb, ${pColor} 35%, transparent)`,
          boxShadow: `0 8px 24px -8px color-mix(in srgb, ${pColor} 45%, transparent)`,
        }}
      >
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white/20"
          style={{ backgroundColor: pColor }}
        />
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/45 mb-0.5 truncate">
            {project.slug}
          </div>
          <div className="text-[15px] font-black text-white leading-tight truncate">{project.name}</div>
          {project.description ? (
            <div className="text-[11px] text-white/55 font-medium truncate mt-0.5">{project.description}</div>
          ) : null}
        </div>
        <div
          data-tour="portal-card-cta"
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{
            background: `linear-gradient(135deg, ${pColor}, color-mix(in srgb, ${pColor} 70%, #000))`,
          }}
        >
          →
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/projects/${project.slug}`}
      onClick={handleClick}
      data-tour="direction-card"
      className={`group relative flex flex-col h-full overflow-hidden transition-all duration-500 ${
        compact
          ? "min-h-0 p-5 rounded-[28px] hover:shadow-xl"
          : "min-h-[400px] md:min-h-[460px] p-8 sm:p-10 rounded-[40px] hover:-translate-y-2 hover:shadow-2xl"
      } ${
        isLight
          ? "bg-gradient-to-br from-white/95 to-[#e0f2fe]/95 shadow-[0_0_40px_rgba(255,255,255,0.1)] border border-white/60"
          : "bg-gradient-to-br from-[#1e1b4b]/95 to-[#0f172a]/95 shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10"
      } backdrop-blur-xl`}
    >
      <div
        className={`absolute rounded-full blur-[80px] opacity-40 group-hover:opacity-70 transition-opacity duration-700 pointer-events-none ${
          compact ? "-top-20 -right-20 w-40 h-40" : "-top-32 -right-32 w-64 h-64"
        }`}
        style={{ backgroundColor: pColor }}
      />

      <div className="relative z-10 flex flex-col h-full min-h-0">
        <div className={compact ? "mb-3" : "mb-6"}>
          <span
            className={`inline-block rounded-full font-black uppercase tracking-[0.15em] border ${
              compact ? "px-3 py-1 text-[9px]" : "px-4 py-1.5 text-[10px]"
            } ${
              isLight ? "bg-white/50 border-black/10 text-black/60" : "bg-black/40 border-white/10 text-white/60"
            }`}
          >
            {project.slug}
          </span>
        </div>

        <p
          className={`font-bold uppercase tracking-widest ${
            compact ? "text-[10px] mb-1" : "text-xs mb-2"
          } ${isLight ? "text-black/40" : "text-white/40"}`}
        >
          Текущая платформа
        </p>
        <h2
          className={`font-black tracking-tight leading-none ${
            compact ? "text-[1.75rem] mb-3" : "text-4xl sm:text-5xl md:text-6xl mb-6"
          } ${isLight ? "text-[#0c4a6e]" : "text-white"}`}
        >
          {project.name}
        </h2>

        <p
          className={`font-medium leading-relaxed ${
            compact ? "text-xs line-clamp-2 max-w-none" : "text-sm md:text-base max-w-xs"
          } ${isLight ? "text-slate-600" : "text-slate-300"}`}
        >
          {project.description || "Учебники, кроссворды, задания, прогресс и аналитика."}
        </p>

        <div className={`mt-auto ${compact ? "pt-4" : "pt-16"}`}>
          <div
            data-tour="portal-card-cta"
            className={`inline-flex items-center gap-2 rounded-full font-bold text-white shadow-lg transition-transform group-hover:scale-105 ${
              compact ? "px-4 py-2.5 text-sm" : "px-6 py-3 gap-3"
            }`}
            style={{
              background: `linear-gradient(135deg, ${pColor}, ${pColor}dd)`,
              boxShadow: `0 10px 30px ${pColor}40`,
            }}
          >
            Перейти
            <span
              className={`bg-white/20 rounded-full flex items-center justify-center text-xs ${
                compact ? "w-5 h-5" : "w-6 h-6"
              }`}
            >
              →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
