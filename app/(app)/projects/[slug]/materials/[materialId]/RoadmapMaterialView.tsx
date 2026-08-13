"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RoadmapClient from "./RoadmapClient";
import "./roadmap.css";

type Props = {
  slug: string;
  material: {
    id: string;
    title: string;
    description?: string | null;
  };
  hasAccess: boolean;
};

export default function RoadmapMaterialView({ slug, material, hasAccess }: Props) {
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
      <div className="roadmap-page">
        <div className="roadmap-segment">
          <h1 className="roadmap-segment-title">Доступ ограничен</h1>
          <p style={{ color: "#64748b", lineHeight: 1.6 }}>
            Этот roadmap-курс доступен после одобрения заявки или покупки материала.
          </p>
          <Link href={`/projects/${slug}/materials`} style={{ fontWeight: 800, color: "#0369a1" }}>
            Вернуться к материалам
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="roadmap-page">
        <div className="roadmap-segment">Загрузка roadmap...</div>
      </div>
    );
  }

  if (error || !roadmap) {
    return (
      <div className="roadmap-page">
        <div className="roadmap-segment">
          <h1 className="roadmap-segment-title">Roadmap недоступен</h1>
          <p style={{ color: "#64748b" }}>{error || "Курс еще не настроен"}</p>
          <Link href={`/projects/${slug}/materials`} style={{ fontWeight: 800, color: "#0369a1" }}>
            Вернуться к материалам
          </Link>
        </div>
      </div>
    );
  }

  return (
    <RoadmapClient
      slug={slug}
      materialId={material.id}
      materialTitle={material.title}
      roadmap={roadmap}
    />
  );
}
