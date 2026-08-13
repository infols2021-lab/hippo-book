"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import RoadmapClient from "./RoadmapClient";
import "../../assignment/assignment.css";
import "./material-detail.css";
import "./roadmap.css";

type Props = {
  slug: string;
  projectName: string;
  material: {
    id: string;
    title: string;
    description?: string | null;
  };
  coverUrl: string;
  hasAccess: boolean;
};

function RoadmapShell({
  slug,
  projectName,
  material,
  coverUrl,
  children,
}: {
  slug: string;
  projectName: string;
  material: Props["material"];
  coverUrl: string;
  children: ReactNode;
}) {
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

        <Link href={`/projects/${slug}/materials`} className="material-detail-back-btn">
          ← Назад к материалам
        </Link>

        <div className="card material-detail-hero">
          <div className="material-detail-cover">
            {coverUrl ? (
              <img src={coverUrl} alt={material.title} />
            ) : (
              <span className="material-detail-cover-placeholder">RM</span>
            )}
          </div>
          <div className="material-detail-info">
            <h1 className="material-detail-title">{material.title}</h1>
            <p className="material-detail-description">
              {material.description || "Roadmap-курс с блоками, экзаменами и сертификатом"}
            </p>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

export default function RoadmapMaterialView({ slug, projectName, material, coverUrl, hasAccess }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roadmap, setRoadmap] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/roadmap/${material.id}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const payload = json?.data ?? json;

        if (!res.ok || json?.ok === false) {
          throw new Error(payload?.error || json?.error || `HTTP ${res.status}`);
        }

        if (!cancelled) {
          setRoadmap(payload?.roadmap ?? null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(String(err?.message || err || "Не удалось загрузить roadmap"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (hasAccess) {
      void load();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [hasAccess, material.id]);

  if (!hasAccess) {
    return (
      <div className="material-detail-page">
        <div className="material-detail-container material-detail-no-access">
          <div className="card material-detail-no-access-card">
            <h2 style={{ color: "var(--project-text)", margin: "0 0 16px 0", fontWeight: 800 }}>
              Доступ ограничен
            </h2>
            <p style={{ margin: "0 0 16px 0", lineHeight: 1.6, color: "#64748b" }}>
              Этот roadmap-курс доступен после одобрения заявки или покупки материала.
            </p>
            <Link href={`/projects/${slug}/materials`} className="material-detail-back-btn">
              ← Назад к материалам
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <RoadmapShell slug={slug} projectName={projectName} material={material} coverUrl={coverUrl}>
        <div className="roadmap-status-card">Загрузка дорожки курса...</div>
      </RoadmapShell>
    );
  }

  if (error || !roadmap) {
    return (
      <RoadmapShell slug={slug} projectName={projectName} material={material} coverUrl={coverUrl}>
        <div className="roadmap-status-card is-error">
          <h2>Roadmap недоступен</h2>
          <p>{error || "Курс еще не настроен в админке"}</p>
        </div>
      </RoadmapShell>
    );
  }

  return (
    <RoadmapClient
      slug={slug}
      materialId={material.id}
      materialTitle={material.title}
      materialDescription={material.description}
      projectName={projectName}
      coverUrl={coverUrl}
      roadmap={roadmap}
    />
  );
}
