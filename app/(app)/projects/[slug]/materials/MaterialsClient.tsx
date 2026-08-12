"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import LogoutButton from "@/components/LogoutButton";
import { useTour } from "@/components/tour/TourProvider";
import { useTourMobileMenu } from "@/hooks/useTourMobileMenu";
import { dispatchBurgerClicked, dispatchTourPageReady } from "@/lib/tour/tourMobile";
import { PORTAL_MOBILE_MQ } from "@/lib/tour/tourPortal";
import { rewriteSupabasePublicStorageUrl } from "@/lib/storage/publicUrl";
import type { MaterialWithProgress } from "@/lib/materials/types";

import "../profile/profile.css";
import "./materials.css";

type ProjectTab = {
  id: string;
  slug: string;
  title: string;
  icon: string | null;
};

type Props = {
  slug: string;
  projectName: string;
  markText: string;
  tabs: ProjectTab[];
  activeTab: ProjectTab;
  availableMats: MaterialWithProgress[];
  lockedMats: MaterialWithProgress[];
};

function toCoverUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith("/api/storage/public/") || value.startsWith("data:")) return value;
  return rewriteSupabasePublicStorageUrl(value);
}

function materialsNav(slug: string) {
  return [
    {
      kind: "link" as const,
      href: `/projects/${slug}/profile`,
      label: "Профиль",
      className: "btn ghost",
      tourId: "profile-link",
    },
    { kind: "logout" as const, label: "Выйти", className: "btn secondary" },
  ];
}

export default function MaterialsClient({
  slug,
  projectName,
  markText,
  tabs,
  activeTab,
  availableMats,
  lockedMats,
}: Props) {
  const { stage, advanceTour } = useTour();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { handleOverlayClick: handleTourOverlayClick } = useTourMobileMenu(
    mobileMenuOpen,
    setMobileMenuOpen
  );

  useEffect(() => {
    const mq = window.matchMedia(PORTAL_MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const handleProfileNav = () => {
    if (stage === "materials_overview") advanceTour("rewards_gate");
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    if (stage === "materials_overview") {
      dispatchTourPageReady();
    }
  }, [stage]);

  const toggleMobileMenu = () => {
    const opening = !mobileMenuOpen;
    setMobileMenuOpen(opening);
    if (opening) dispatchBurgerClicked();
  };

  const materials = [...availableMats, ...lockedMats];

  return (
    <div className="materials-page">
      <div className="materials-container">
        {isMobile ? (
          <>
            {mobileMenuOpen && (
              <>
                <div className="mobile-bottom-sheet-overlay" onClick={handleTourOverlayClick} />
                <div className="mobile-bottom-sheet">
                  <div className="sheet-handle" />
                  <div className="sheet-title">Навигация</div>
                  <div className="sheet-menu-list">
                    <Link
                      className="sheet-item"
                      data-tour="profile-link"
                      href={`/projects/${slug}/profile`}
                      onClick={handleProfileNav}
                    >
                      Профиль
                    </Link>
                    <Link className="sheet-item" href="/portal" onClick={() => setMobileMenuOpen(false)}>
                      Главный портал
                    </Link>
                    <LogoutButton className="sheet-item sheet-item--danger w-full text-left">
                      Выйти
                    </LogoutButton>
                  </div>
                </div>
              </>
            )}

            <div className="mobile-header-bar">
              <div className="mobile-header-left">
                <div className="brand-mark">{markText}</div>
                <div className="mobile-user-info">
                  <div className="mobile-user-name">{projectName}</div>
                  <div className="mobile-streak-pill">Материалы</div>
                </div>
              </div>
              <button
                type="button"
                className="mobile-burger-btn"
                data-tour="mobile-burger-btn"
                onClick={toggleMobileMenu}
                aria-label="Открыть меню"
                aria-expanded={mobileMenuOpen}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <AppHeader markText={markText} title={projectName} subtitle="Материалы" nav={materialsNav(slug)} />
        )}

        {tabs.length > 0 && (
          <div className="materials-tabs" role="tablist" aria-label="Материалы">
            {tabs.map((tab) => {
              const isActive = tab.slug === activeTab.slug;
              return (
                <Link
                  key={tab.id}
                  href={`/projects/${slug}/materials?tab=${tab.slug}`}
                  className={`material-tab ${isActive ? "active" : ""}`}
                  role="tab"
                  aria-selected={isActive}
                >
                  {tab.icon || ""} {tab.title}
                </Link>
              );
            })}
          </div>
        )}

        <div className="materials-section active">
          <div className="materials-panel">
            <h3 className="materials-title">{activeTab.title}</h3>
            <p className="materials-subtitle">Выберите материал для изучения и выполнения заданий</p>

            {materials.length > 0 ? (
              <div className="materials-grid">
                {availableMats.map((m) => {
                  const coverUrl = toCoverUrl(m.cover_image_url);
                  const isSecret = (m as { is_secret?: boolean }).is_secret === true;

                  return (
                    <Link
                      key={m.id}
                      href={`/projects/${slug}/materials/${m.id}`}
                      className={`material-card ${isSecret ? "secret-unlocked" : ""}`}
                    >
                      <div className="material-cover">
                        {coverUrl ? (
                          <img src={coverUrl} alt={m.title || "Обложка"} loading="lazy" decoding="async" />
                        ) : (
                          <div className="material-cover-placeholder">{isSecret ? "🎁" : "📄"}</div>
                        )}
                        {isSecret && (
                          <span className="material-secret-badge">★ Секретный</span>
                        )}
                      </div>
                      <div className="material-title">{m.title || "Без названия"}</div>
                      <div className="material-description">
                        {m.description || "Материалы и задания для выполнения"}
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${m.progress}%` }} />
                      </div>
                      <div className="material-stats">
                        <span>
                          {m.completedAssignments}/{m.totalAssignments} заданий
                        </span>
                        <span className="pct">{m.progress}%</span>
                      </div>
                    </Link>
                  );
                })}

                {lockedMats.map((m) => {
                  const coverUrl = toCoverUrl(m.cover_image_url);
                  return (
                    <div key={m.id} className="material-card locked">
                      <div className="material-cover">
                        {coverUrl ? (
                          <img src={coverUrl} alt={m.title || "Обложка"} loading="lazy" decoding="async" />
                        ) : (
                          <div className="material-cover-placeholder">📄</div>
                        )}
                      </div>
                      <div className="material-title">{m.title || "Без названия"}</div>
                      <div className="material-description">
                        {m.description || "Материал временно недоступен"}
                      </div>
                      <div className="locked-overlay">
                        <span className="locked-badge">🔒 Недоступен</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="materials-empty card">
                <p>📭 В этом разделе пока пусто</p>
                <p className="materials-subtitle" style={{ margin: 0 }}>
                  Ожидайте, когда администратор загрузит сюда материалы.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
