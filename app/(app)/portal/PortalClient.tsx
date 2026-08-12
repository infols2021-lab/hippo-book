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
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const splitClass =
    projects.length <= 1
      ? "portal-split portal-split--1"
      : projects.length === 2
      ? "portal-split portal-split--2"
      : "portal-split portal-split--3";

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
    <main className="portal-page">
      <div className="portal-bg" aria-hidden="true">
        <div className="portal-bg__grid" />
        <div className="portal-bg__orb portal-bg__orb--one" />
        <div className="portal-bg__orb portal-bg__orb--two" />
      </div>

      <div className="portal-shell">
        <header className="portal-header">
          <div>
            <p className="portal-eyebrow">Выберите направление</p>
            <h1 className="portal-title">Добро пожаловать, {displayName}</h1>
            <p className="portal-subtitle">
              Один аккаунт, {projects.length || 0} пространства: выберите нужную ветку для продолжения работы.
            </p>
          </div>

          <div className="portal-header__actions">
            {isAdmin && (
              <Link href="/admin" className="portal-header__link portal-header__link--admin">
                Админка
              </Link>
            )}
            <LogoutButton className="portal-header__link portal-header__link--logout">
              🚪 Выйти
            </LogoutButton>
          </div>
        </header>

        {projects.length > 0 ? (
          <>
            <div ref={trackRef} className={splitClass}>
              {projects.map((project, index) => (
                <div key={project.id} className="portal-split__side">
                  <PortalCard project={project} index={index} />
                </div>
              ))}
            </div>

            {projects.length > 1 && (
              <div className="portal-carousel-dots" aria-hidden="true">
                {projects.map((project, index) => (
                  <button
                    key={`dot-${project.id}`}
                    type="button"
                    aria-label={`Показать: ${project.name}`}
                    onClick={() => scrollToIndex(index)}
                    className={`portal-carousel-dots__dot ${
                      index === activeIndex ? "portal-carousel-dots__dot--active" : ""
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="portal-empty">
            <div style={{ fontSize: 56, marginBottom: 12 }}>📭</div>
            <h3>Платформа настраивается</h3>
            <p>Администратор пока не добавил активные ветки обучения.</p>
          </div>
        )}

        <footer className="portal-footer">
          <span>Профильные данные общие для всех разделов</span>
          <span className="portal-footer__dot" />
          <span>Прогресс и материалы разделяются отдельно</span>
        </footer>
      </div>
    </main>
  );
}
