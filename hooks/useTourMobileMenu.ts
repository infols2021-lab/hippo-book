"use client";

import { useEffect } from "react";
import { useTour } from "@/components/tour/TourProvider";
import {
  TOUR_MOBILE_MENU_OPEN,
  TOUR_MOBILE_MENU_CLOSE,
  isMobileMenuGateStage,
  isMobileViewport,
} from "@/lib/tour/tourMobile";

/** Слушает события тура и держит bottom sheet открытым на gate-стадиях. */
export function useTourMobileMenu(
  mobileMenuOpen: boolean,
  setMobileMenuOpen: (open: boolean) => void
) {
  const { stage } = useTour();

  useEffect(() => {
    const open = () => setMobileMenuOpen(true);
    const close = () => setMobileMenuOpen(false);

    window.addEventListener(TOUR_MOBILE_MENU_OPEN, open);
    window.addEventListener(TOUR_MOBILE_MENU_CLOSE, close);
    return () => {
      window.removeEventListener(TOUR_MOBILE_MENU_OPEN, open);
      window.removeEventListener(TOUR_MOBILE_MENU_CLOSE, close);
    };
  }, [setMobileMenuOpen]);

  const tourBlocksMenuClose =
    isMobileViewport() && isMobileMenuGateStage(stage) && mobileMenuOpen;

  const handleOverlayClick = () => {
    if (tourBlocksMenuClose) return;
    setMobileMenuOpen(false);
  };

  return { tourBlocksMenuClose, handleOverlayClick };
}
