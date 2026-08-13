import type { CustomTourStep } from "@/components/tour/TourSteps";
import type { TourStage } from "@/lib/tour/tourConfig";
import { loadTourProgress } from "@/lib/tour/tourPersistence";
import { dispatchCloseMobileMenu, setTourSheetActive } from "@/lib/tour/tourMobile";
import { setPortalTourActive } from "@/lib/tour/tourPortal";

/** Снимает все блокировки UI тура (оверлей, sheet, scroll-lock портала). */
export function releaseTourUi(): void {
  setTourSheetActive(false);
  setPortalTourActive(false);
  dispatchCloseMobileMenu();
}

/**
 * После F5 пункт меню в sheet не виден — откатываемся к шагу «нажмите ☰».
 */
export function resolveResumeStepIndex(
  steps: CustomTourStep[],
  savedIndex: number
): number {
  if (!steps.length) return 0;

  let index = Math.min(Math.max(0, savedIndex), steps.length - 1);
  const step = steps[index];

  if (step?.requiresMobileMenu) {
    for (let i = index - 1; i >= 0; i--) {
      if (steps[i]?.waitForBurgerClick) return i;
    }
    return 0;
  }

  return index;
}

function isMobileBottomSheetOpen(): boolean {
  if (typeof document === "undefined") return false;
  const sheet = document.querySelector<HTMLElement>(".mobile-bottom-sheet");
  if (!sheet) return false;
  const style = window.getComputedStyle(sheet);
  return style.display !== "none" && style.visibility !== "hidden";
}

/** Если шаг меню активен, но sheet закрыт — возвращаемся к бургер-шагу. */
export function resolveMobileMenuResumeIndex(
  steps: CustomTourStep[],
  savedIndex: number
): number {
  const index = resolveResumeStepIndex(steps, savedIndex);
  const step = steps[index];
  if (!step?.requiresMobileMenu || isMobileBottomSheetOpen()) return index;

  for (let i = index - 1; i >= 0; i--) {
    if (steps[i]?.waitForBurgerClick) return i;
  }
  return 0;
}

export function getInitialTourStepIndex(
  stage: TourStage,
  pathname: string,
  steps: CustomTourStep[]
): number {
  const saved = loadTourProgress(stage, pathname);
  if (!saved) return 0;
  return resolveResumeStepIndex(steps, saved.stepIndex);
}
