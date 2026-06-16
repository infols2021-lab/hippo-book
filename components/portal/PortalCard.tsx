"use client";

import Link from "next/link";
import type { ProjectConfig } from "@/app/(app)/portal/PortalClient"; // Импортируем тип, который создали в клиенте

type PortalCardProps = {
  project: ProjectConfig;
  index?: number;
  className?: string;
};

export default function PortalCard({ project, index = 0, className = "" }: PortalCardProps) {
  // Достаем цвета ветки с безопасными фоллбэками
  const primaryColor = project.theme?.primaryColor || "#3b82f6";
  const secondaryColor = project.theme?.secondaryColor || "#1d4ed8";

  // Автоматически подбираем иконку (эмодзи) на основе индекса, если у нас нет загруженных обложек
  const icons = ["🚀", "🎓", "🧩", "💡", "🔬", "📚", "🏆", "🌟"];
  const icon = icons[index % icons.length];

  return (
    <Link
      href={`/projects/${project.slug}`}
      className={`group relative flex flex-col bg-gray-800/40 hover:bg-gray-800/60 border border-gray-700/50 rounded-3xl overflow-hidden backdrop-blur-md transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl ${className}`}
      aria-label={`Перейти в раздел ${project.name}`}
    >
      {/* 1. Декоративная рамка-свечение при наведении */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom right, ${primaryColor}30, transparent, transparent)`,
        }}
      />

      {/* 2. Визуальная шапка (Градиент + Иконка) */}
      <div
        className="h-40 relative flex items-center justify-center overflow-hidden border-b border-gray-700/50"
        style={{
          background: `linear-gradient(135deg, ${primaryColor}22, ${secondaryColor}22)`,
        }}
      >
        {/* Опережающее свечение внутри шапки */}
        <div
          className="absolute inset-0 opacity-40 group-hover:opacity-80 transition-opacity duration-700 mix-blend-screen"
          style={{
            background: `radial-gradient(circle at center, ${primaryColor}60 0%, transparent 70%)`,
          }}
        />
        {/* Иконка с эффектом зума */}
        <span className="text-6xl drop-shadow-xl transform group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500 relative z-10">
          {icon}
        </span>
      </div>

      {/* 3. Контентная часть */}
      <div className="p-6 flex flex-col flex-grow relative z-10">
        
        {/* Бейджик */}
        <div className="flex items-center justify-between mb-4">
          <span
            className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-gray-900/80 border backdrop-blur-sm"
            style={{
              color: primaryColor,
              borderColor: `${primaryColor}40`,
            }}
          >
            Ветка: /{project.slug}
          </span>
        </div>

        {/* Название */}
        <h2 
          className="text-2xl font-extrabold text-white mb-3 group-hover:text-transparent group-hover:bg-clip-text transition-all duration-300"
          style={{ backgroundImage: `linear-gradient(to right, #ffffff, ${primaryColor})` }}
        >
          {project.name}
        </h2>

        {/* Описание */}
        <p className="text-gray-400 text-sm leading-relaxed mb-8 flex-grow">
          {project.description || "Уникальный образовательный раздел с материалами, тестами и системой достижений."}
        </p>

        {/* Кнопка действия */}
        <div 
          className="flex items-center gap-2 mt-auto font-bold text-sm transition-transform group-hover:translate-x-2"
          style={{ color: primaryColor }}
        >
          <span>Открыть пространство</span>
          <span className="text-lg leading-none opacity-80 group-hover:opacity-100 transition-opacity">→</span>
        </div>

      </div>
    </Link>
  );
}