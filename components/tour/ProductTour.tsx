// components/tour/ProductTour.tsx
"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { STATUS, EVENTS, ACTIONS } from "react-joyride";

// 1. Правильный фикс для TypeScript и Next.js.
// Просто кастуем сам import к any, не трогая внутренности модуля.
// Это убьет ошибку React #306 (белый экран).
const Joyride = dynamic(
  () => import("react-joyride") as any,
  { ssr: false }
) as any;

import CustomTooltip from "./CustomTooltip";
import { TOUR_STEPS } from "./TourSteps";

interface ProductTourProps {
  initialRun?: boolean; 
}

export default function ProductTour({ initialRun = false }: ProductTourProps) {
  const [run, setRun] = useState(initialRun);
  const [stepIndex, setStepIndex] = useState(0);
  
  // 2. Защита от ошибки гидратации (React error #418)
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Слушатель для запуска тура вручную
  useEffect(() => {
    const startTour = () => {
      setStepIndex(0);
      setRun(true);
    };
    
    window.addEventListener("start-product-tour", startTour);
    return () => window.removeEventListener("start-product-tour", startTour);
  }, []);

  // Хак для шага с открытием модалки наград (ждем реального клика)
  useEffect(() => {
    if (!run) return;
    
    if (stepIndex === 3) {
      const rewardsBtn = document.querySelector("#tour-rewards-btn");
      
      const handleClick = () => {
        setTimeout(() => setStepIndex(4), 450);
      };
      
      if (rewardsBtn) rewardsBtn.addEventListener("click", handleClick);
      return () => {
        if (rewardsBtn) rewardsBtn.removeEventListener("click", handleClick);
      };
    }
  }, [stepIndex, run]);

  const handleJoyrideCallback = async (data: any) => {
    const { status, type, action, index } = data;

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      if (index === 3 && action === ACTIONS.NEXT) {
        return; 
      }
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
    }

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      setStepIndex(0);

      try {
        await fetch("/api/profile/update", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ has_seen_tour: true }),
        });
      } catch (e) {
        console.error("Не удалось обновить статус тура", e);
      }
    }
  };

  // 3. Отдаем пустоту, пока клиент не смонтирован. 
  // Это 100% защита от несовпадения HTML сервера и браузера
  if (!isMounted) return null;

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={run}
      stepIndex={stepIndex}
      callback={handleJoyrideCallback}
      tooltipComponent={CustomTooltip} 
      continuous={true}
      disableOverlayClose={true} 
      spotlightPadding={10}
      styles={{
        options: {
          zIndex: 10000,
          overlayColor: "rgba(0, 0, 0, 0.65)", 
        },
      }}
    />
  );
}