// app/(app)/projects/[slug]/materials/[materialId]/MaterialDetailSwitch.tsx
// Полный доступ к связке «База + PRO»: минималистичный Segmented Control
// в верхней навигации страницы материала. Обе панели смонтированы постоянно,
// поэтому переключение мгновенное и без потери состояния (прогресс/дорожка).
"use client";

import { useState } from "react";
import MaterialClient from "./MaterialClient";
import RoadmapMaterialView from "./RoadmapMaterialView";

type MaterialTab = "base" | "pro";

type BaseAssignment = {
  id: string;
  title: string;
  order_index: number;
  assignment_type: string;
};

type Props = {
  slug: string;
  projectName: string;
  markText: string;
  baseMaterial: {
    id: string;
    title: string;
    description: string | null;
    material_kind: string;
    is_demo?: boolean;
  };
  baseAssignments: BaseAssignment[];
  baseCompletedIds: string[];
  baseProgressPct: number;
  baseCompletedCount: number;
  baseTotalCount: number;
  baseCoverUrl: string;
  proMaterial: { id: string; title: string; description: string | null };
  proCoverUrl: string;
};

export default function MaterialDetailSwitch({
  slug,
  projectName,
  markText,
  baseMaterial,
  baseAssignments,
  baseCompletedIds,
  baseProgressPct,
  baseCompletedCount,
  baseTotalCount,
  baseCoverUrl,
  proMaterial,
  proCoverUrl,
}: Props) {
  // По умолчанию открываем PRO-режим (roadmap-тренажёр).
  const [activeTab, setActiveTab] = useState<MaterialTab>("pro");

  return (
    <div className="material-detail-full">
      <div className="material-detail-container">
        <div className="material-mode-switch" role="tablist" aria-label="Режим материала">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "base"}
            className={`material-mode-switch-item ${activeTab === "base" ? "is-active" : ""}`}
            onClick={() => setActiveTab("base")}
          >
            Базовый
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "pro"}
            className={`material-mode-switch-item ${activeTab === "pro" ? "is-active" : ""}`}
            onClick={() => setActiveTab("pro")}
          >
            PRO
          </button>
        </div>
      </div>

      <div className="material-mode-pane" hidden={activeTab !== "base"}>
        <MaterialClient
          slug={slug}
          projectName={projectName}
          markText={markText}
          material={baseMaterial}
          assignments={baseAssignments}
          completedIds={baseCompletedIds}
          progressPct={baseProgressPct}
          completedCount={baseCompletedCount}
          totalCount={baseTotalCount}
          coverUrl={baseCoverUrl}
          hasAccess
          isDemoMaterial={Boolean(baseMaterial.is_demo)}
        />
      </div>

      <div className="material-mode-pane" hidden={activeTab !== "pro"}>
        <RoadmapMaterialView
          slug={slug}
          projectName={projectName}
          material={proMaterial}
          coverUrl={proCoverUrl}
          hasAccess
        />
      </div>
    </div>
  );
}
