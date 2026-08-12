// components/tour/TourProvider.tsx
"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { TourStage } from "@/lib/tour/tourConfig";
import { clearTourProgress } from "@/lib/tour/tourPersistence";

type TourContextType = {
  stage: TourStage;
  advanceTour: (nextStage: TourStage) => void;
  setStage: (stage: TourStage) => void;
  finishTour: () => void;
};

const TourContext = createContext<TourContextType | null>(null);

function persistTourStage(newStage: TourStage) {
  fetch("/api/profile/update", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tour_stage: newStage,
      has_seen_tour: newStage === "finished",
    }),
  }).catch(console.error);
}

export function TourProvider({
  children,
  initialStage,
}: {
  children: React.ReactNode;
  initialStage: TourStage;
}) {
  const [stage, setStageState] = useState<TourStage>(initialStage);

  const setStage = useCallback((newStage: TourStage) => {
    setStageState(newStage);
    persistTourStage(newStage);
    if (newStage === "finished") {
      clearTourProgress();
    }
  }, []);

  const advanceTour = useCallback(
    (nextStage: TourStage) => {
      setStage(nextStage);
    },
    [setStage]
  );

  const finishTour = useCallback(() => {
    clearTourProgress();
    setStage("finished");
  }, [setStage]);

  useEffect(() => {
    const restartTour = () => setStage("profile_stats");
    window.addEventListener("start-product-tour", restartTour);
    return () => window.removeEventListener("start-product-tour", restartTour);
  }, [setStage]);

  return (
    <TourContext.Provider value={{ stage, advanceTour, setStage, finishTour }}>
      {children}
    </TourContext.Provider>
  );
}

export const useTour = () => {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
};
