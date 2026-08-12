import type { TourStage } from "@/lib/tour/tourConfig";
import { isPortalTourStage } from "@/lib/tour/tourConfig";

export const PORTAL_TOUR_ACTIVE_CLASS = "portal-tour-active";

export function setPortalTourActive(active: boolean) {
  document.documentElement.classList.toggle(PORTAL_TOUR_ACTIVE_CLASS, active);
  document.body.classList.toggle(PORTAL_TOUR_ACTIVE_CLASS, active);
}

export function isPortalTourStageActive(stage: TourStage): boolean {
  return isPortalTourStage(stage);
}

export function getPortalProjectCount(): number {
  if (typeof document === "undefined") return 1;
  const raw = document
    .querySelector('[data-tour="portal-carousel-track"]')
    ?.getAttribute("data-project-count");
  const count = Number(raw);
  return Number.isFinite(count) && count > 0 ? count : 1;
}

/** Центрирует видимую карточку в горизонтальной карусели портала. */
export function scrollPortalCardIntoView(card: HTMLElement): void {
  const wrapper = card.closest<HTMLElement>("[data-portal-card-slide]");
  const track = card.closest<HTMLElement>('[data-tour="portal-carousel-track"]');

  if (wrapper && track) {
    const targetLeft =
      wrapper.offsetLeft - (track.clientWidth - wrapper.offsetWidth) / 2;
    track.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
    return;
  }

  card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
}
