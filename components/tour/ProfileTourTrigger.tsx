"use client";

import { useEffect } from "react";
import { useTour } from "./TourProvider";

/** Синхронизирует стадию тура при переходе с портала в профиль. */
export function ProfileTourTrigger() {
  const { stage, advanceTour } = useTour();

  useEffect(() => {
    if (stage === "direction_gate") {
      advanceTour("profile_stats");
    }
  }, [stage, advanceTour]);

  return null;
}
