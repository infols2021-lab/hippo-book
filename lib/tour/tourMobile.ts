import type { TourStage } from "@/lib/tour/tourConfig";

export const TOUR_MOBILE_MENU_OPEN = "tour:open-mobile-menu";
export const TOUR_MOBILE_MENU_CLOSE = "tour:close-mobile-menu";
export const TOUR_BURGER_CLICKED = "tour:burger-clicked";
export const TOUR_PAGE_READY = "tour:page-ready";
export const TOUR_REWARDS_MODAL_READY = "tour:rewards-modal-ready";
export const TOUR_SHEET_ACTIVE_CLASS = "tour-sheet-active";

export function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches;
}

/** Стадии, где на мобилке цель — пункт в bottom sheet после бургера. */
export const MOBILE_MENU_GATE_STAGES: TourStage[] = [
  "profile_requests_gate",
  "materials_gate",
  "rewards_gate",
];

export function isMobileMenuGateStage(stage: TourStage): boolean {
  return MOBILE_MENU_GATE_STAGES.includes(stage);
}

export function dispatchOpenMobileMenu() {
  window.dispatchEvent(new Event(TOUR_MOBILE_MENU_OPEN));
}

export function dispatchCloseMobileMenu() {
  window.dispatchEvent(new Event(TOUR_MOBILE_MENU_CLOSE));
}

export function dispatchBurgerClicked() {
  window.dispatchEvent(new Event(TOUR_BURGER_CLICKED));
}

export function dispatchTourPageReady() {
  window.dispatchEvent(new Event(TOUR_PAGE_READY));
}

export function dispatchTourRewardsModalReady() {
  window.dispatchEvent(new Event(TOUR_REWARDS_MODAL_READY));
}

export function dispatchTourRewardsForceTab(tab: "wardrobe" | "streaks" | "referral" | "promos") {
  window.dispatchEvent(new CustomEvent("tour:show-reward-tab", { detail: tab }));
}

export function setTourSheetActive(active: boolean) {
  document.body.classList.toggle(TOUR_SHEET_ACTIVE_CLASS, active);
}
