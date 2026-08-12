// components/tour/TourSteps.ts
import { Step } from "react-joyride";
import { TourStage } from "@/lib/tour/tourConfig";
import { BASE_TOUR_STEPS } from "@/lib/tour/resolveTourSteps";

export interface CustomTourStep extends Step {
  mascotImage?: string;
  skipBeacon?: boolean;
  blockTargetInteraction?: boolean;
  overlayClickAction?: false | "close" | "next" | "replay";
  hideNextButton?: boolean;
  primaryLabel?: string;
  /** После «Далее» открыть мобильное меню. @deprecated — используйте waitForBurgerClick */
  openMobileMenuOnNext?: boolean;
  /** Ждём нажатия на ☰, без кнопки в тултипе. */
  waitForBurgerClick?: boolean;
  /** Шаг подсвечивает пункт в уже открытом bottom sheet. */
  requiresMobileMenu?: boolean;
  /** Шаг «листайте карусель» на портале (пропускается при одном направлении). */
  isPortalSwipeStep?: boolean;
  /** Перед подсветкой центрировать карточку в карусели. */
  scrollPortalCard?: boolean;
  /** Не скроллить страницу к таргету (react-joyride). */
  skipScroll?: boolean;
  /** Тултип в стиле тёмного портала. */
  portalTheme?: boolean;
  /** Компактный док внизу экрана (мобильный портал). */
  portalMobileDock?: boolean;
}

export const TOUR_STEPS: Partial<Record<TourStage, CustomTourStep[]>> = BASE_TOUR_STEPS;
