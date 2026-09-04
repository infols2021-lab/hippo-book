"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTour } from "@/components/tour/TourProvider";
import { dispatchTourPageReady } from "@/lib/tour/tourMobile";

import "../../profile/profile.css";
import "../../assignment/assignment.css";
import "./material-detail.css";

type Props = {
  slug: string;
  projectName: string;
  markText: string;
  material: MaterialView;
  assignments: AssignmentPreview[];
  completedIds: string[];
  progressPct: number;
  completedCount: number;
  totalCount: number;
  coverUrl: string;
  hasAccess: boolean;
  isDemoMaterial?: boolean;
};

type MaterialView = {
  id: string;
  title: string;
  description?: string | null;
  material_kind?: string;
  is_demo?: boolean;
};

type AssignmentPreview = {
  id: string;
  title: string;
  order_index: number;
  assignment_type: string;
};

function assignmentSource(material: MaterialView): "textbook" | "crossword" {
  return material?.material_kind === "crossword" ? "crossword" : "textbook";
}

function assignmentHref(slug: string, assignmentId: string, material: MaterialView): string {
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

  useEffect(() => {
    dispatchTourPageReady();
  }, []);

  useEffect(() => {
    if (stage === "demo_material" || stage === "material_return_gate") {
      dispatchTourPageReady();
    }
  }, [stage]);

  const handleBackToMaterials = () => {
    if (stage === "material_return_gate") {
      advanceTour("materials_profile_gate");
    }
  };

  const sectionLabel =
    material?.material_kind === "crossword" ? "Задания кроссворда" : "Задания учебника";

  if (!hasAccess) {
    return (
      <div className="material-detail-page">
        <div className="material-detail-container material-detail-no-access">
          <div className="card material-detail-no-access-card">
            <h2 style={{ color: "var(--project-text)", margin: "0 0 16px 0", fontWeight: 800 }}>
              У вас нет доступа к этому материалу
            </h2>
            <Link href={`/projects/${slug}/materials`} className="material-detail-back-btn">
              ← Назад к материалам
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="material-detail-page">
      <div className="material-detail-container">
        <div className="material-detail-header-row">
          <div className="material-detail-topline">
            <div className="material-detail-brand-mark">{projectName.slice(0, 2).toUpperCase()}</div>
            <div className="material-detail-topline-text">
              <div className="material-detail-topline-kicker">{projectName}</div>
              <div className="material-detail-topline-title">{material.title}</div>
            </div>
          </div>
          <span className="skills-wordmark material-detail-wordmark">skilLS</span>
        </div>

        <Link
          href={`/projects/${slug}/materials`}
          className="material-detail-back-btn"
          data-tour="material-back-btn"
          onClick={handleBackToMaterials}
        >
          ← Назад к материалам
        </Link>

        <div className="card material-detail-hero">
          <div className="material-detail-cover">
            {coverUrl ? (
              <img src={coverUrl} alt={material.title} />
            ) : (
              <span className="material-detail-cover-placeholder" aria-hidden="true" />
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
          <div className="material-detail-assignments" data-tour="demo-assignments-list">
            {assignments.map((a, index) => {
              const isDone = completedIds.includes(a.id);
              const assignTypeLabel = a.assignment_type === "intro" ? "ОЗНАКОМИТЕЛЬНОЕ" : "ТЕСТ";

              return (
                <Link
                  key={a.id}
                  href={assignmentHref(slug, a.id, material)}
                  className="material-detail-assignment"
                  data-tour={isDemoMaterial ? "demo-assignment-link" : undefined}
                  onClick={() => {
                    if (isDemoMaterial && stage === "demo_material") {
                      advanceTour("demo_assignment");
                    }
                  }}
                >
                  <div className="material-detail-assignment-main">
                    <div className="material-detail-assignment-icon" aria-hidden="true" />
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
                    {isDone ? "Выполнено" : "Начать"}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="material-detail-empty">
            <span className="material-detail-empty-icon" aria-hidden="true" />
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
