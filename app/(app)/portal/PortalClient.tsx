"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PortalCard from "@/components/portal/PortalCard";
import LogoutButton from "@/components/LogoutButton";

export type ProjectConfig = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  theme: {
    primaryColor?: string;
    secondaryColor?: string;
  };
};

type PortalClientProps = {
  userName: string;
  userEmail: string;
  isAdmin: boolean;
  projects: ProjectConfig[];
};

export default function PortalClient({ userName, userEmail, isAdmin, projects }: PortalClientProps) {
  const displayName = userName || userEmail || "Ученик";

  // Индекс активной карточки для мобильной карусели (точки-индикаторы)
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || projects.length <= 1) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const cardWidth = track.clientWidth;
        if (cardWidth > 0) {
          const idx = Math.round(track.scrollLeft / cardWidth);
          setActiveIndex(Math.min(Math.max(idx, 0), projects.length - 1));
        }
        ticking = false;
      });
    };

    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [projects.length]);

  const scrollToIndex = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: track.clientWidth * index, behavior: "smooth" });
  };

  return (
    <main className="relative min-h-[100dvh] bg-[#0b0f19] text-white overflow-x-hidden font-sans flex flex-col">

      {/* 1. ДИНАМИЧЕСКИЙ ФОН: Делит экран на N равных частей по количеству проектов */}
      <div className="fixed inset-0 z-0 flex pointer-events-none">
        {projects.length > 0 ? projects.map((p) => {
          const color = p.theme?.primaryColor || "#3b82f6";
          return (
            <div key={`bg-${p.id}`} className="relative flex-1 h-full border-r border-white/[0.02] last:border-r-0 overflow-hidden">
              {/* Верхний градиент заливки */}
              <div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(180deg, ${color}40 0%, transparent 100%)` }} />
              {/* Центральная неоновая сфера для подсветки карточки */}
              <div className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[120px] mix-blend-screen opacity-30" style={{ backgroundColor: color }} />
            </div>
          );
        }) : (
          <div className="flex-1 h-full bg-[#0b0f19]" /> // Фоллбэк если нет проектов
        )}
      </div>

      {/* Паттерн-сетка поверх фона */}
      <div className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

      {/* КОНТЕНТ */}
      <section className="relative z-10 w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col flex-grow min-h-0">

        {/* ШАПКА */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 sm:mb-12 animate-in slide-in-from-top-8 duration-700">
          <div className="max-w-3xl">
            <p className="text-xs font-bold tracking-[0.2em] text-white/50 uppercase mb-3 sm:mb-4">Выберите направление</p>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white mb-4 sm:mb-6 leading-[1.1]">
              Добро пожаловать, <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">{displayName}</span>
            </h1>
            <p className="text-base sm:text-lg text-white/60 font-medium">
              Один аккаунт, {projects.length} пространства: выберите нужную ветку для продолжения работы.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link href="/admin" className="px-5 sm:px-6 py-2.5 bg-transparent border border-white/20 hover:bg-white/10 text-white rounded-full font-bold transition-all text-sm backdrop-blur-md">
                Админка
              </Link>
            )}
            <LogoutButton className="px-5 sm:px-6 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-full font-bold transition-all text-sm backdrop-blur-md" />
          </div>
        </header>

        {projects.length > 0 ? (
          <>
            {/*
              КАРТОЧКИ.
              Десктоп (md и выше): обычный grid, как и было.
              Мобилка (< md): горизонтальная snap-карусель — каждая
              карточка занимает всю ширину экрана, листается свайпом,
              карточки НЕ накладываются друг на друга.
            */}
            <div
              ref={trackRef}
              className={`
                flex-grow items-stretch
                flex md:grid gap-5 md:gap-6
                overflow-x-auto md:overflow-visible
                snap-x snap-mandatory md:snap-none
                -mx-4 px-4 md:mx-0 md:px-0
                [-webkit-overflow-scrolling:touch]
                [scrollbar-width:none]
                [&::-webkit-scrollbar]:hidden
                ${projects.length === 1 ? 'md:grid-cols-1 md:max-w-2xl md:mx-auto' :
                  projects.length === 2 ? 'md:grid-cols-2' :
                  'md:grid-cols-3'}
              `}
            >
              {projects.map((project, index) => (
                <div
                  key={project.id}
                  className="shrink-0 w-full snap-center snap-always md:w-auto md:shrink"
                >
                  <PortalCard project={project} index={index} />
                </div>
              ))}
            </div>

            {/* Точки-индикаторы: показываются только на мобилке при 2+ карточках */}
            {projects.length > 1 && (
              <div className="flex md:hidden items-center justify-center gap-2 pt-4">
                {projects.map((project, index) => (
                  <button
                    key={`dot-${project.id}`}
                    type="button"
                    aria-label={`Показать: ${project.name}`}
                    onClick={() => scrollToIndex(index)}
                    className={`h-1.5 rounded-full transition-all duration-200 ${
                      index === activeIndex ? "w-5 bg-white" : "w-1.5 bg-white/30"
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center p-10 sm:p-16 rounded-3xl bg-white/5 border-2 border-dashed border-white/10 backdrop-blur-md">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-2xl font-bold mb-2 text-center">Платформа настраивается</h3>
            <p className="text-white/50 text-center">Администратор пока не добавил активные ветки обучения.</p>
          </div>
        )}

        {/* ФУТЕР */}
        <footer className="mt-8 sm:mt-12 flex flex-col sm:flex-row justify-center items-center py-4 sm:py-6 bg-black/20 rounded-3xl sm:rounded-full border border-white/5 backdrop-blur-sm mx-auto px-6 sm:px-8 w-fit gap-2 sm:gap-3 text-xs text-white/40 font-medium text-center animate-in fade-in duration-1000">
          <span>Профильные данные общие для всех разделов</span>
          <span className="hidden sm:block w-1.5 h-1.5 rounded-full bg-white/20" />
          <span>Прогресс и материалы разделяются отдельно</span>
        </footer>

      </section>
    </main>
  );
}