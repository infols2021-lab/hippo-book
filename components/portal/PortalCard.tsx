import Link from "next/link";
import type { CSSProperties } from "react";
import type { BranchType, PortalCardConfig } from "@/lib/branches/types";
import { getBranchConfig } from "@/lib/branches/config";

type PortalCardProps = {
  branch: BranchType;
  card?: PortalCardConfig;
  side: "left" | "right";
  className?: string;
};

function getSideLabel(side: PortalCardProps["side"]): string {
  return side === "left" ? "Левая часть портала" : "Правая часть портала";
}

export default function PortalCard({ branch, card, side, className = "" }: PortalCardProps) {
  const branchConfig = getBranchConfig(branch);
  const portalCard = card ?? branchConfig.portalCard;
  const colors = branchConfig.theme.colors;

  const style = {
    "--portal-card-bg": colors.cardBg,
    "--portal-card-bg-soft": colors.cardBgSoft,
    "--portal-card-primary": colors.primary,
    "--portal-card-primary-soft": colors.primarySoft,
    "--portal-card-secondary": colors.secondary,
    "--portal-card-accent": colors.accent,
    "--portal-card-accent-soft": colors.accentSoft,
    "--portal-card-text": colors.text,
    "--portal-card-muted": colors.muted,
    "--portal-card-border": colors.border,
    "--portal-card-glow": colors.glow,
  } as CSSProperties;

  return (
    <Link
      href={portalCard.href}
      className={[
        "portal-card",
        `portal-card--${branch}`,
        `portal-card--${side}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      aria-label={`${portalCard.title}. ${getSideLabel(side)}`}
    >
      <div className="portal-card__glow portal-card__glow--one" />
      <div className="portal-card__glow portal-card__glow--two" />

      <div className="portal-card__media" aria-hidden="true">
        {portalCard.image ? (
          <img
            className="portal-card__image"
            src={portalCard.image.src}
            alt={portalCard.image.alt}
            loading="lazy"
          />
        ) : (
          <div className="portal-card__fallback">
            <div className="portal-card__fallback-orb portal-card__fallback-orb--one" />
            <div className="portal-card__fallback-orb portal-card__fallback-orb--two" />
            <div className="portal-card__fallback-icon">{portalCard.fallbackIcon}</div>
          </div>
        )}
      </div>

      <div className="portal-card__content">
        <div className="portal-card__badge">{portalCard.badge}</div>

        <div>
          <p className="portal-card__subtitle">{portalCard.subtitle}</p>
          <h2 className="portal-card__title">{portalCard.title}</h2>
        </div>

        <p className="portal-card__description">{portalCard.description}</p>

        <div className="portal-card__action">
          <span>Перейти</span>
          <span className="portal-card__arrow" aria-hidden="true">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}