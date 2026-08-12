// components/tour/TourProvider.tsx
"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { TourStage } from "@/lib/tour/tourConfig";

type TourContextType = {
  stage: TourStage;
  advanceTour: (nextStage: TourStage) => void;
  setStage: (stage: TourStage) => void;
};

const TourContext = createContext<TourContextType | null>(null);

export function TourProvider({ 
  children, 
  initialStage 
}: { 
  children: React.ReactNode;
  initialStage: TourStage;
}) {
  const [stage, setStageState] = useState<TourStage>(initialStage);

  const setStage = useCallback((newStage: TourStage) => {
    setStageState(newStage);
    
    // Тихое сохранение прогресса в БД при каждой смене стадии
    if (newStage !== initialStage) {
      fetch("/api/profile/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          tour_stage: newStage, 
          has_seen_tour: newStage === "finished" 
        }),
      }).catch(console.error);
    }
  }, [initialStage]);

  const advanceTour = useCallback((nextStage: TourStage) => {
    setStage(nextStage);
  }, [setStage]);

  return (
    <TourContext.Provider value={{ stage, advanceTour, setStage }}>
      {children}
    </TourContext.Provider>
  );
}

export const useTour = () => {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
};