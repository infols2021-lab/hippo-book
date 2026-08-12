"use client";

import { useEffect } from "react";
import { useTour } from "./TourProvider";

export function MaterialsTourTrigger() {
  const { stage, advanceTour } = useTour();

  useEffect(() => {
    // Если тур ждет перехода на материалы, мы продвигаем его дальше (возврат к профилю за наградами)
    if (stage === "materials_gate") {
      advanceTour("rewards_gate");
    }
  }, [stage, advanceTour]);

  return null;
}