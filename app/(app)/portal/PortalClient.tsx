"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PortalCard from "@/components/portal/PortalCard";
import LogoutButton from "@/components/LogoutButton";
import { useTour } from "@/components/tour/TourProvider";
import { isPortalTourStage } from "@/lib/tour/tourConfig";
import { PORTAL_MOBILE_MQ } from "@/lib/tour/tourPortal";
import { dispatchTourPageReady } from "@/lib/tour/tourMobile";

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
  const { stage } = useTour();
  const displayName = userName || userEmail || "Ученик";

  const [isMobile, setIsMobile] = useState(false);

  const portalTourMobile = isMobile && isPortalTourStage(stage);
  const activeProject = projects[0];
  const activeColor = activeProject?.theme?.primaryColor || "#3b82f6";

  useEffect(() => {
    dispatchTourPageReady();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(PORTAL_MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <main
      className={`relative min-h-[100dvh] bg-[#0b0f19] text-white overflow-x-hidden md:overflow-y-auto font-sans flex flex-col ${
        portalTourMobile ? "portal-tour-mobile" : ""
      }`}
    >
      {/* Фон: на мобилке — один градиент, на десктопе — колонки по направлениям */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0 md:hidden transition-colors duration-500"
          style={{
            background: `linear-gradient(165deg, ${activeColor}35 0%, #0b0f19 38%, #0b0f19 100%)`,
          }}
        />
        <div
          className="absolute top-[30%] left-1/2 -translate-x-1/2 w-[320px] h-[320px] rounded-full blur-[100px] mix-blend-screen opacity-25 md:hidden transition-colors duration-500"
          style={{ backgroundColor: activeColor }}
        />

        <div className="hidden md:flex absolute inset-0">
          {projects.length > 0 ? (
            projects.map((p) => {
              const color = p.theme?.primaryColor || "#3b82f6";
              return (
                <div
                  key={`bg-${p.id}`}
                  className="relative flex-1 h-full border-r border-white/[0.02] last:border-r-0 overflow-hidden"
                >
                  <div
                    className="absolute inset-0 opacity-20"
                    style={{ background: `linear-gradient(180deg, ${color}40 0%, transparent 100%)` }}
                  />
                  <div
                    className="absolute top-[40%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[120px] mix-blend-screen opacity-30"
                    style={{ backgroundColor: color }}
                  />
                </div>
              );
            })
          ) : (
            <div className="flex-1 h-full bg-[#0b0f19]" />
          )}
        </div>
      </div>

      <div
        className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}
      />

      <section
        data-tour="portal-shell"
        className={`relative z-10 w-full max-w-[1400px] mx-auto flex flex-col flex-1 ${
          portalTourMobile
            ? "px-3 pt-4 pb-3 gap-3 min-h-0"
            : "px-4 sm:px-6 py-8 sm:py-10 pb-12 gap-6 min-h-0"
        }`}
      >
        <header
          data-tour="portal-hero"
          className={`flex flex-col md:flex-row md:items-end justify-between ${
            portalTourMobile ? "gap-3 mb-0 shrink-0" : "gap-6 mb-8 sm:mb-12"
          } animate-in slide-in-from-top-8 duration-700`}
        >
          <div className={portalTourMobile ? "max-w-full" : "max-w-3xl"}>
            <p
              className={`font-bold tracking-[0.2em] text-white/50 uppercase ${
                portalTourMobile ? "text-[10px] mb-1.5" : "text-xs mb-3 sm:mb-4"
              }`}
            >
              Выберите направление
            </p>
            <h1
              className={`font-black tracking-tight text-white leading-[1.1] ${
                portalTourMobile
                  ? "text-[1.65rem] mb-1.5"
                  : "text-4xl sm:text-5xl md:text-6xl mb-4 sm:mb-6"
              }`}
            >
              {portalTourMobile ? (
                <>
                  Привет,{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                    {displayName}
                  </span>
                </>
              ) : (
                <>
                  Добро пожаловать, <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
                    {displayName}
                  </span>
                </>
              )}
            </h1>
            <p
              className={`text-white/60 font-medium ${
                portalTourMobile ? "text-xs leading-snug" : "text-base sm:text-lg"
              }`}
            >
              {portalTourMobile
                ? `${projects.length} направления — выберите ветку ниже`
                : `Один аккаунт, ${projects.length} пространства: выберите нужную ветку для продолжения работы.`}
            </p>
          </div>

          <div className={`flex items-center gap-2 shrink-0 ${portalTourMobile ? "flex-wrap" : "gap-3"}`}>
            {isAdmin && (
              <Link
                href="/admin"
                className={`bg-transparent border border-white/20 hover:bg-white/10 text-white rounded-full font-bold transition-all backdrop-blur-md ${
                  portalTourMobile ? "px-3.5 py-1.5 text-xs" : "px-5 sm:px-6 py-2.5 text-sm"
                }`}
              >
                Админка
              </Link>
            )}
            <LogoutButton
              className={`bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-full font-bold transition-all backdrop-blur-md ${
                portalTourMobile ? "px-3.5 py-1.5 text-xs" : "px-5 sm:px-6 py-2.5 text-sm"
              }`}
            />
          </div>
        </header>

        {projects.length > 0 ? (
          <div className={`flex flex-col min-h-0 ${portalTourMobile ? "flex-1 gap-2" : "flex-1 md:min-h-0"}`}>
            {/* Мобилка: вертикальный список «пилюль» */}
            <div
              data-tour="portal-carousel-track"
              data-project-count={projects.length}
              className={`md:hidden flex flex-col gap-2.5 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                portalTourMobile ? "pb-1" : "pb-2"
              }`}
            >
              {projects.map((project, index) => (
                <PortalCard key={project.id} project={project} index={index} pill />
              ))}
            </div>

            {/* Десктоп: сетка карточек (без изменений) */}
            <div
              className={`
                hidden md:grid items-stretch min-h-0 flex-1 gap-5 md:gap-6
                ${
                  projects.length === 1
                    ? "md:grid-cols-1 md:max-w-2xl md:mx-auto"
                    : projects.length === 2
                    ? "md:grid-cols-2"
                    : "md:grid-cols-3"
                }
              `}
            >
              {projects.map((project, index) => (
                <div key={project.id} data-portal-card-slide className="h-full">
                  <PortalCard project={project} index={index} />
                </div>
              ))}
            </div>

            {projects.length > 1 && !portalTourMobile && (
              <div
                data-tour="portal-carousel-dots"
                className="hidden"
              />
            )}
          </div>
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center p-10 sm:p-16 rounded-3xl bg-white/5 border-2 border-dashed border-white/10 backdrop-blur-md">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-2xl font-bold mb-2 text-center">Платформа настраивается</h3>
            <p className="text-white/50 text-center">
              Администратор пока не добавил активные ветки обучения.
            </p>
          </div>
        )}

        {!portalTourMobile && (
          <footer className="mt-6 shrink-0 flex flex-col sm:flex-row justify-center items-center py-4 sm:py-6 bg-black/20 rounded-3xl sm:rounded-full border border-white/5 backdrop-blur-sm mx-auto px-6 sm:px-8 w-fit gap-2 sm:gap-3 text-xs text-white/40 font-medium text-center animate-in fade-in duration-1000">
            <span>Профильные данные общие для всех разделов</span>
            <span className="hidden sm:block w-1.5 h-1.5 rounded-full bg-white/20" />
            <span>Прогресс и материалы разделяются отдельно</span>
          </footer>
        )}
      </section>
    </main>
  );
}
