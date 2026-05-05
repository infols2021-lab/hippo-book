import Link from "next/link";
import type { MaterialWithProgress } from "@/lib/materials/types";
import {
  formatGatehouseLevels,
  getMaterialKindIcon,
  getMaterialHref,
} from "@/lib/materials/format";

type GatehouseMaterialCardProps = {
  material: MaterialWithProgress;
  locked?: boolean;
  className?: string;
};

function getProgressLabel(material: MaterialWithProgress): string {
  if (!material.totalAssignments) return "Задания скоро появятся";
  if (!material.completedAssignments) return `0 из ${material.totalAssignments} заданий`;
  return `${material.completedAssignments} из ${material.totalAssignments} заданий`;
}

function getProgressPercent(material: MaterialWithProgress): number {
  if (!material.totalAssignments) return 0;
  const value = Number(material.progress ?? 0);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export default function GatehouseMaterialCard({
  material,
  locked = !material.hasAccess,
  className = "",
}: GatehouseMaterialCardProps) {
  const href = getMaterialHref(material);
  const progress = getProgressPercent(material);
  const levels = formatGatehouseLevels(material.target_levels);
  const icon = getMaterialKindIcon(material.material_kind);

  const cardContent = (
    <>
      <div className="gatehouse-material-card__glow" aria-hidden="true" />

      <div className="gatehouse-material-card__cover" aria-hidden="true">
        {material.cover_image_url ? (
          <img
            className="gatehouse-material-card__image"
            src={material.cover_image_url}
            alt=""
            loading="lazy"
          />
        ) : (
          <div className="gatehouse-material-card__fallback">
            <span className="gatehouse-material-card__fallback-icon">{icon}</span>
          </div>
        )}

        {locked ? (
          <div className="gatehouse-material-card__lock">
            <span aria-hidden="true">🔒</span>
            <span>Нет доступа</span>
          </div>
        ) : (
          <div className="gatehouse-material-card__available">
            <span aria-hidden="true">✓</span>
            <span>Доступно</span>
          </div>
        )}
      </div>

      <div className="gatehouse-material-card__body">
        <div className="gatehouse-material-card__meta">
          <span className="gatehouse-material-card__kind">
            <span aria-hidden="true">{icon}</span>
            <span>Пробный тест</span>
          </span>
          <span className="gatehouse-material-card__levels">{levels}</span>
        </div>

        <h3 className="gatehouse-material-card__title">{material.title}</h3>

        {material.description ? (
          <p className="gatehouse-material-card__description">{material.description}</p>
        ) : (
          <p className="gatehouse-material-card__description gatehouse-material-card__description--muted">
            Пройдите тест, чтобы увидеть результат и рекомендацию уровня.
          </p>
        )}

        <div className="gatehouse-material-card__progress">
          <div className="gatehouse-material-card__progress-top">
            <span>{getProgressLabel(material)}</span>
            <strong>{progress}%</strong>
          </div>

          <div className="gatehouse-material-card__progress-track" aria-hidden="true">
            <div
              className="gatehouse-material-card__progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="gatehouse-material-card__footer">
          <span className="gatehouse-material-card__hint">
            {locked ? "Оформите заявку, чтобы открыть материал" : "Открыть материал"}
          </span>
          <span className="gatehouse-material-card__arrow" aria-hidden="true">
            →
          </span>
        </div>
      </div>
    </>
  );

  const classNames = [
    "gatehouse-material-card",
    locked ? "gatehouse-material-card--locked" : "gatehouse-material-card--available",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (locked) {
    return (
      <article className={classNames} aria-label={`${material.title}. Нет доступа`}>
        {cardContent}
      </article>
    );
  }

  return (
    <Link className={classNames} href={href} aria-label={`Открыть ${material.title}`}>
      {cardContent}
    </Link>
  );
}