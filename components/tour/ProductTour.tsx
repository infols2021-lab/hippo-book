// components/tour/ProductTour.tsx
"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { ACTIONS, EVENTS, STATUS } from "react-joyride";
import type { EventData, Controls } from "react-joyride";

import CustomTooltip from "./CustomTooltip";
import { TOUR_STEPS } from "./TourSteps";

// В V3 Joyride — именованный экспорт (не default), поэтому достаём его вручную
const Joyride = dynamic(
  () => import("react-joyride").then((mod) => mod.Joyride),
  { ssr: false }
);

interface ProductTourProps {
  initialRun?: boolean;
}

export default function ProductTour({ initialRun = false }: ProductTourProps) {
  const [run, setRun] = useState(initialRun);
  const [stepIndex, setStepIndex] = useState(0);
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

  // Хак для шага с открытием модалки наград (ждем реального клика по кнопке)
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

  // В V3: callback -> onEvent, теперь принимает (data, controls)
  const handleJoyrideEvent = async (data: EventData, _controls: Controls) => {
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

  // Защита от ошибки гидратации
  if (!isMounted) return null;

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={run}
      stepIndex={stepIndex}
      onEvent={handleJoyrideEvent}
      tooltipComponent={CustomTooltip}
      continuous={true}
      options={{
        zIndex: 10000,
        overlayColor: "rgba(0, 0, 0, 0.65)",
        overlayClickAction: false, // было disableOverlayClose={true}
        spotlightPadding: 10, // было spotlightPadding={10}
      }}
    />
  );
}