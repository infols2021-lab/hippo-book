"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTour } from "@/components/tour/TourProvider";
import { isTourStageActiveOnPath } from "@/lib/tour/tourConfig";
import { dispatchTourPageReady } from "@/lib/tour/tourMobile";
import { releaseTourUi } from "@/lib/tour/tourRecovery";

/**
 * Глобальный bootstrap: после F5/навигации снимает «залипшие» блокировки
 * и даёт ProductTour сигнал продолжить на подходящей странице.
 */
export default function TourResumeBootstrap() {
  const { stage } = useTour();
  const pathname = usePathname();

  useEffect(() => {
    if (stage === "finished") {
      releaseTourUi();
      return;
    }

    if (isTourStageActiveOnPath(stage, pathname)) {
      dispatchTourPageReady();
    } else {
      releaseTourUi();
    }
  }, [stage, pathname]);

  useEffect(() => {
    const recover = () => {
      if (stage === "finished") {
        releaseTourUi();
        return;
      }
      if (isTourStageActiveOnPath(stage, pathname)) {
        dispatchTourPageReady();
      } else {
        releaseTourUi();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") recover();
    };

    window.addEventListener("pageshow", recover);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pageshow", recover);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [stage, pathname]);

  return null;
}
