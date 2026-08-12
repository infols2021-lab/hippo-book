"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { ProjectConfig } from "@/app/(app)/portal/PortalClient";
import { useTour } from "@/components/tour/TourProvider";

type PortalCardProps = {
  project: ProjectConfig;
  index: number;
};

function getCardModifier(slug: string, index: number): string {
  const normalized = slug.toLowerCase();
  if (normalized === "olympiad") return "portal-card--gatehouse";
  if (normalized === "gatehouse") return "portal-card--olympiad";
  if (normalized.includes("placement")) return "portal-card--olympiad";
  return index % 2 === 0 ? "portal-card--olympiad" : "portal-card--gatehouse";
}

export default function PortalCard({ project, index }: PortalCardProps) {
  const { stage, advanceTour } = useTour();
  const pColor = project.theme?.primaryColor || "#6366f1";
  const modifier = getCardModifier(project.slug, index);

  return (
    <Link
      href={`/projects/${project.slug}`}
      className={`portal-card ${modifier}`}
      style={
        {
          "--portal-card-primary": pColor,
          "--portal-card-glow": `${pColor}66`,
        } as CSSProperties
      }
      onClick={() => {
        if (stage === "direction_gate") {
          advanceTour("profile_stats");
        }
      }}
    >
      <div className="portal-card__glow portal-card__glow--one" aria-hidden="true" />
      <div className="portal-card__glow portal-card__glow--two" aria-hidden="true" />

      <div className="portal-card__fallback" aria-hidden="true">
        <div className="portal-card__fallback-orb portal-card__fallback-orb--one" />
        <div className="portal-card__fallback-orb portal-card__fallback-orb--two" />
      </div>

      <div className="portal-card__content">
        <span className="portal-card__badge">{project.slug}</span>
        <p className="portal-card__subtitle">Текущая платформа</p>
        <h2 className="portal-card__title">{project.name}</h2>
        <p className="portal-card__description">
          {project.description || "Учебники, кроссворды, задания, прогресс и аналитика."}
        </p>
        <div className="portal-card__action">
          Перейти
          <span className="portal-card__arrow" aria-hidden="true">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}
