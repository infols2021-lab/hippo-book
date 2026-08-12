// components/tour/ProductTour.tsx
"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { STATUS, EVENTS, ACTIONS } from "react-joyride";

// Ультимативный фикс для Typescript и next/dynamic:
// Забираем модуль "как есть" и жестко приводим к any, чтобы TS забыл про проверки
const Joyride = dynamic(
  () => import("react-joyride").then((mod: any) => mod.default || mod),
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
    
    // Индекс 3 — это шаг с кнопкой #tour-rewards-btn
    if (stepIndex === 3) {
      const rewardsBtn = document.querySelector("#tour-rewards-btn");
      
      const handleClick = () => {
        // Устанавливаем задержку, чтобы модалка успела отрендериться в DOM
        setTimeout(() => setStepIndex(4), 450);
      };
      
      if (rewardsBtn) rewardsBtn.addEventListener("click", handleClick);
      return () => {
        if (rewardsBtn) rewardsBtn.removeEventListener("click", handleClick);
      };
    }
  }, [stepIndex, run]);

  // Приводим data к any для полной совместимости
  const handleJoyrideCallback = async (data: any) => {
    const { status, type, action, index } = data;

    // Переключение шагов
    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      if (index === 3 && action === ACTIONS.NEXT) {
        return; 
      }
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
    }

    // Завершение или пропуск тура
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      setStepIndex(0);

      // Отправляем запрос на сервер для сохранения статуса
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

  if (typeof window === "undefined") return null;

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
          overlayColor: "rgba(0, 0, 0, 0.65)", // Темный блюр-эффект
        },
      }}
    />
  );
}