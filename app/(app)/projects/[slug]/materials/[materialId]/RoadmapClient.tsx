"use client";

import Link from "next/link";
import type { RoadmapCourseUiState, RoadmapNodeUiState } from "@/lib/roadmap/types";
import "../../assignment/assignment.css";
import "./material-detail.css";
import "./roadmap.css";

type Props = {
  slug: string;
  materialId: string;
  materialTitle: string;
  materialDescription?: string | null;
  projectName: string;
  coverUrl: string;
  roadmap: RoadmapCourseUiState;
};

function StarsRow({ count }: { count: number }) {
  return (
    <div className="roadmap-stars" aria-label={`${count} из 3 звезд`}>
      {[1, 2, 3].map((star) => (
        <span key={star} className={`roadmap-star ${count >= star ? "is-filled" : ""}`} />
      ))}
    </div>
  );
}

function nodeHref(slug: string, materialId: string, node: RoadmapNodeUiState) {
  if (!node.assignment_id || node.status === "locked") return null;
  const params = new URLSearchParams({
    id: node.assignment_id,
    source: "materials",
    sourceId: materialId,
    roadmapNode: node.id,
  });
  return `/projects/${slug}/assignment?${params.toString()}`;
}

function NodeCard({ slug, materialId, node }: { slug: string; materialId: string; node: RoadmapNodeUiState }) {
  const href = nodeHref(slug, materialId, node);
  const locked = node.status === "locked";
  const completed = node.status === "completed";

  const body = (
    <div className={`roadmap-node ${locked ? "is-locked" : ""} ${completed ? "is-completed" : ""}`}>
      <div className="roadmap-node-top">
        <div className="roadmap-node-index">{node.order_index + 1}</div>
        <div className="roadmap-node-meta">
          <div className="roadmap-node-title">{node.title}</div>
          <div className="roadmap-node-type">
            {node.type === "exam" ? "Экзамен" : "Урок"}
          </div>
        </div>
        {node.type === "lesson" ? <StarsRow count={node.best_stars} /> : null}
        {node.type === "exam" ? (
          <div className={`roadmap-exam-badge ${node.exam_passed ? "is-passed" : ""}`}>
            {node.exam_passed ? "Сдан" : node.exam ? `${node.exam.pass_percent}%` : "Экзамен"}
          </div>
        ) : null}
      </div>
      {locked ? <div className="roadmap-node-lock">Заблокировано</div> : null}
      {!locked && !node.assignment_id ? (
        <div className="roadmap-node-lock">Задание еще не привязано</div>
      ) : null}
    </div>
  );

  if (!href) {
    return body;
  }

  return (
    <Link href={href} className="roadmap-node-link">
      {body}
    </Link>
  );
}

export default function RoadmapClient({
  slug,
  materialId,
  materialTitle,
  materialDescription,
  projectName,
  coverUrl,
  roadmap,
}: Props) {
  const description =
    materialDescription || roadmap.description || "Roadmap-курс с блоками, экзаменами и сертификатом";
  const progressPct =
    roadmap.total_stars_max > 0
      ? Math.round((roadmap.total_stars / roadmap.total_stars_max) * 100)
      : 0;

  return (
    <div className="material-detail-page">
      <div className="material-detail-container">
        <div className="material-detail-header-row">
          <div className="material-detail-topline">
            <div className="material-detail-brand-mark">{projectName.slice(0, 2).toUpperCase()}</div>
            <div className="material-detail-topline-text">
              <div className="material-detail-topline-kicker">{projectName}</div>
              <div className="material-detail-topline-title">{materialTitle}</div>
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
              <img src={coverUrl} alt={materialTitle} />
            ) : (
              <span className="material-detail-cover-placeholder">RM</span>
            )}
          </div>

          <div className="material-detail-info">
            <h1 className="material-detail-title">{materialTitle}</h1>
            <p className="material-detail-description">{description}</p>

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
              Набрано {roadmap.total_stars} из {roadmap.total_stars_max} звезд в блоках
            </div>
          </div>
        </div>

        <div className="material-detail-section-label">Дорожка курса</div>

        <div className="roadmap-track">
          {roadmap.segments.map((segment) => (
            <section
              key={segment.id}
              className={`roadmap-segment ${segment.unlocked ? "is-unlocked" : "is-locked"} ${segment.completed ? "is-completed" : ""}`}
            >
              <div className="roadmap-segment-head">
                <div>
                  <div className="roadmap-segment-kind">
                    {segment.kind === "block"
                      ? "Блок"
                      : segment.kind === "exam"
                        ? "Экзамен"
                        : "Финал"}
                  </div>
                  <h2 className="roadmap-segment-title">{segment.title}</h2>
                </div>
                {segment.kind === "block" ? (
                  <div className="roadmap-segment-progress">
                    <div className="roadmap-segment-progress-value">
                      {segment.stars_earned} / {segment.stars_max}
                    </div>
                    <div className="roadmap-segment-progress-caption">
                      нужно {segment.stars_required ?? 0} для перехода
                    </div>
                  </div>
                ) : null}
              </div>

              {segment.nodes.length > 0 ? (
                <div className="roadmap-node-grid">
                  {segment.nodes.map((node) => (
                    <NodeCard key={node.id} slug={slug} materialId={materialId} node={node} />
                  ))}
                </div>
              ) : segment.kind === "certificate" ? (
                <div className="roadmap-certificate-card">
                  {segment.unlocked ? (
                    <>
                      <div>Сертификат доступен</div>
                      <button
                        type="button"
                        className="roadmap-certificate-download"
                        onClick={() => {
                          window.location.href = `/api/roadmap/${materialId}/certificate`;
                        }}
                      >
                        Скачать PDF
                      </button>
                    </>
                  ) : (
                    "Сертификат будет доступен после выполнения всех условий"
                  )}
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
