// app/(app)/projects/[slug]/materials/MaterialsClient.tsx
"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTour } from "@/components/tour/TourProvider";
import { dispatchTourPageReady } from "@/lib/tour/tourMobile";
import { rewriteSupabasePublicStorageUrl } from "@/lib/storage/publicUrl";
import type { MaterialWithProgress } from "@/lib/materials/types";
import ProjectHeader from "@/components/projects/ProjectHeader";

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

  useEffect(() => {
    dispatchTourPageReady();
  }, []);

  useEffect(() => {
    if (stage === "materials_demo" || stage === "materials_profile_gate") {
      dispatchTourPageReady();
    }
  }, [stage]);

  const materials = [...availableMats, ...lockedMats];

  return (
    <div className={`materials-page ${stage === "materials_demo" ? "materials-tour-demo-active" : ""}`}>
      <div className="materials-container">
        
        {/* ========================================================= */}
        {/* DESKTOP HEADER (единая шапка со всеми страницами)          */}
        {/* ========================================================= */}
        <ProjectHeader
          slug={slug}
          projectName={projectName}
          markText={markText}
          subtitle="Материалы"
        />

        {/* ========================================================= */}
        {/* MOBILE HEADER (Компактный заголовок без бургера)            */}
        {/* ========================================================= */}
        <div className="md:hidden flex items-center gap-3 mb-5 mt-2 px-1">
          <div
            className="flex items-center justify-center rounded-[12px] font-black text-sm flex-shrink-0"
            style={{
              width: "40px", height: "40px",
              background: "var(--project-primary)",
              color: "#ffffff",
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.3), 0 4px 10px -2px color-mix(in srgb, var(--project-primary) 50%, transparent)",
            }}
          >
            {markText}
          </div>
          <div className="min-w-0 flex flex-col">
            <h3 className="text-[16px] font-black leading-tight truncate" style={{ color: "var(--project-text)" }}>
              {projectName}
            </h3>
            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "color-mix(in srgb, var(--project-text) 50%, transparent)", marginTop: "2px" }}>
              Материалы
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* TABS & CONTENT                                              */}
        {/* ========================================================= */}
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
                  const isDemo = Boolean((m as { is_demo?: boolean }).is_demo);

                  return (
                    <Link
                      key={m.id}
                      href={`/projects/${slug}/materials/${m.id}`}
                      className={`material-card ${isSecret ? "secret-unlocked" : ""} ${isDemo ? "material-card--demo" : ""}`}
                      data-tour={isDemo ? "demo-material-card" : undefined}
                      onClick={() => {
                        if (stage === "materials_demo" && isDemo) {
                          advanceTour("demo_material");
                        }
                      }}
                    >
                      <div className="material-cover">
                        {coverUrl ? (
                          <img src={coverUrl} alt={m.title || "Обложка"} loading="lazy" decoding="async" />
                        ) : (
                          <div className="material-cover-placeholder">{isSecret ? "🎁" : "📄"}</div>
                        )}
                        {isDemo && <span className="material-demo-badge">Демо</span>}
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