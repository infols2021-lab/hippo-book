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
  /** После «Далее» открыть мобильное меню. */
  openMobileMenuOnNext?: boolean;
  /** Шаг подсвечивает пункт в уже открытом bottom sheet. */
  requiresMobileMenu?: boolean;
}

export const TOUR_STEPS: Partial<Record<TourStage, CustomTourStep[]>> = BASE_TOUR_STEPS;
