"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import LogoutButton from "@/components/LogoutButton";
import { useTour } from "@/components/tour/TourProvider";
import { PORTAL_MOBILE_MQ } from "@/lib/tour/tourPortal";
import { dispatchTourPageReady } from "@/lib/tour/tourMobile";

import "../../profile/profile.css";
import "./material-detail.css";

type Props = {
  slug: string;
  projectName: string;
  markText: string;
  material: any;
  assignments: any[];
  completedIds: string[];
  progressPct: number;
  completedCount: number;
  totalCount: number;
  coverUrl: string;
  hasAccess: boolean;
  isDemoMaterial?: boolean;
};

function assignmentSource(material: any): "textbook" | "crossword" {
  return material?.material_kind === "crossword" ? "crossword" : "textbook";
}

function assignmentHref(slug: string, assignmentId: string, material: any): string {
  const source = assignmentSource(material);
  const params = new URLSearchParams({
    id: assignmentId,
    source,
    sourceId: String(material.id),
  });
  return `/projects/${slug}/assignment?${params.toString()}`;
}

export default function MaterialClient({
  slug,
  projectName,
  markText,
  material,
  assignments,
  completedIds,
  progressPct,
  completedCount,
  totalCount,
  coverUrl,
  hasAccess,
  isDemoMaterial = false,
}: Props) {
  const { stage, advanceTour } = useTour();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    dispatchTourPageReady();
  }, []);

  useEffect(() => {
    if (stage === "demo_material") {
      dispatchTourPageReady();
    }
  }, [stage]);

  useEffect(() => {
    const mq = window.matchMedia(PORTAL_MOBILE_MQ);
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const sectionLabel =
    material?.material_kind === "crossword" ? "Задания кроссворда" : "Задания учебника";

  if (!hasAccess) {
    return (
      <div className="material-detail-page">
        <div className="material-detail-container material-detail-no-access">
          <div className="card material-detail-no-access-card">
            <h2 style={{ color: "var(--project-text)", margin: "0 0 16px 0", fontWeight: 800 }}>
              У вас нет доступа к этому материалу 🔒
            </h2>
            <Link href={`/projects/${slug}/materials`} className="btn ghost">
              Вернуться назад
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="material-detail-page">
      {isMobile ? (
        <>
          {mobileMenuOpen && (
            <>
              <div
                className="mobile-bottom-sheet-overlay"
                onClick={() => setMobileMenuOpen(false)}
              />
              <div className="mobile-bottom-sheet">
                <div className="sheet-handle" />
                <div className="sheet-title">Навигация</div>
                <div className="sheet-menu-list">
                  <Link
                    className="sheet-item"
                    href={`/projects/${slug}/materials`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    К материалам
                  </Link>
                  <Link
                    className="sheet-item"
                    href={`/projects/${slug}/profile`}
                    onClick={() => setMobileMenuOpen(false)}
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

          <div className="material-detail-container">
            <div className="mobile-header-bar">
              <div className="mobile-header-left">
                <Link href={`/projects/${slug}/materials`} className="brand-mark" aria-label="К материалам">
                  ←
                </Link>
                <div className="mobile-user-info">
                  <div className="mobile-user-name">{material.title}</div>
                  <div className="mobile-streak-pill">{projectName}</div>
                </div>
              </div>
              <button
                type="button"
                className="mobile-burger-btn"
                onClick={() => setMobileMenuOpen((open) => !open)}
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
          </div>
        </>
      ) : (
        <AppHeader
          nav={[
            { kind: "link", href: `/projects/${slug}/materials`, label: "К материалам", className: "btn ghost" },
            { kind: "link", href: `/projects/${slug}/profile`, label: "Профиль", className: "btn secondary" },
          ]}
        />
      )}

      <div className="material-detail-container">
        <Link href={`/projects/${slug}/materials`} className="material-detail-back">
          ← Назад к материалам
        </Link>

        <div className="card material-detail-hero">
          <div className="material-detail-cover">
            {coverUrl ? (
              <img src={coverUrl} alt={material.title} />
            ) : (
              <span className="material-detail-cover-placeholder">📄</span>
            )}
          </div>

          <div className="material-detail-info">
            <h1 className="material-detail-title">{material.title}</h1>
            <p className="material-detail-description">
              {material.description || "Учебные материалы и задания для изучения"}
            </p>

            <div className="material-detail-progress-row">
              <div className="material-detail-progress-bar">
                <div
                  className="material-detail-progress-fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="material-detail-progress-pct">{progressPct}%</span>
            </div>
            <div className="material-detail-progress-meta">
              Выполнено {completedCount} из {totalCount} заданий
            </div>
          </div>
        </div>

        <div className="material-detail-section-label">{sectionLabel}</div>

        {assignments.length > 0 ? (
          <div className="material-detail-assignments">
            {assignments.map((a, index) => {
              const isDone = completedIds.includes(a.id);
              const assignTypeLabel = a.assignment_type === "intro" ? "ОЗНАКОМИТЕЛЬНОЕ" : "ТЕСТ";
              const isTourDemoLink = isDemoMaterial && index === 0;

              return (
                <Link
                  key={a.id}
                  href={assignmentHref(slug, a.id, material)}
                  className="material-detail-assignment"
                  data-tour={isTourDemoLink ? "demo-assignment-link" : undefined}
                  onClick={() => {
                    if (stage === "demo_material" && isTourDemoLink) {
                      advanceTour("demo_assignment");
                    }
                  }}
                >
                  <div className="material-detail-assignment-main">
                    <div className="material-detail-assignment-icon">📝</div>
                    <div className="material-detail-assignment-text">
                      <div className="material-detail-assignment-title">
                        {index + 1}. {a.title || "Задание без названия"}
                      </div>
                      <div className="material-detail-assignment-type">{assignTypeLabel}</div>
                    </div>
                  </div>

                  <div
                    className={`material-detail-assignment-status ${isDone ? "is-done" : "is-pending"}`}
                  >
                    {isDone ? "✅ Выполнено" : "▶ Начать"}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="material-detail-empty">
            <span className="material-detail-empty-icon">📭</span>
            <div className="material-detail-empty-title">В этом материале пока нет заданий</div>
            <p className="material-detail-empty-text">
              Ожидайте, когда они будут добавлены администратором.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
