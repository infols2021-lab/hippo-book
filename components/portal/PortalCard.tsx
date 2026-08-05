"use client";

import Link from "next/link";
import type { ProjectConfig } from "@/app/(app)/portal/PortalClient";

type PortalCardProps = {
  project: ProjectConfig;
  index: number;
};

export default function PortalCard({ project, index }: PortalCardProps) {
  const pColor = project.theme?.primaryColor || "#3b82f6";
  
  // Определяем стиль карточки: четные (0, 2) светлые, нечетные (1, 3) темные.
  const isLight = index % 2 === 0;

  return (
    <Link
      href={`/projects/${project.slug}`}
      className={`group relative flex flex-col p-8 sm:p-10 rounded-[40px] overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl ${
        isLight 
          ? 'bg-gradient-to-br from-white/95 to-[#e0f2fe]/95 shadow-[0_0_40px_rgba(255,255,255,0.1)] border border-white/60' 
          : 'bg-gradient-to-br from-[#1e1b4b]/95 to-[#0f172a]/95 shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/10'
      } backdrop-blur-xl`}
    >
      {/* Декоративное свечение внутри самой карточки */}
      <div 
        className="absolute -top-32 -right-32 w-64 h-64 rounded-full blur-[80px] opacity-40 group-hover:opacity-70 transition-opacity duration-700 pointer-events-none"
        style={{ backgroundColor: pColor }}
      />

      <div className="relative z-10 flex flex-col h-full">
        {/* Бейджик */}
        <div className="mb-6">
          <span className={`inline-block px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] border ${
            isLight ? 'bg-white/50 border-black/10 text-black/60' : 'bg-black/40 border-white/10 text-white/60'
          }`}>
            {project.slug}
          </span>
        </div>

        {/* Название */}
        <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isLight ? 'text-black/40' : 'text-white/40'}`}>
          Текущая платформа
        </p>
        <h2 className={`text-5xl sm:text-6xl font-black tracking-tight mb-6 leading-none ${isLight ? 'text-[#0c4a6e]' : 'text-white'}`}>
          {project.name}
        </h2>

        {/* Описание */}
        <p className={`text-sm md:text-base font-medium leading-relaxed max-w-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
          {project.description || "Учебники, кроссворды, задания, прогресс и аналитика."}
        </p>

        {/* Кнопка "Перейти" */}
        <div className="mt-auto pt-16">
          <div 
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full font-bold text-white shadow-lg transition-transform group-hover:scale-105"
            style={{ 
              background: `linear-gradient(135deg, ${pColor}, ${pColor}dd)`,
              boxShadow: `0 10px 30px ${pColor}40`
            }}
          >
            Перейти 
            <span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-xs">→</span>
          </div>
        </div>

      </div>
    </Link>
  );
}