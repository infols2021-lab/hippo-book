// components/tour/ProductTour.tsx
"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ACTIONS, EVENTS, STATUS } from "react-joyride";
import type { EventData, Controls } from "react-joyride";

import CustomTooltip from "./CustomTooltip";
import { TOUR_STEPS } from "./TourSteps";
import { useTour } from "./TourProvider";
import { TOUR_STAGES } from "@/lib/tour/tourConfig";

const Joyride = dynamic(
  () => import("react-joyride").then((mod) => mod.Joyride),
  { ssr: false }
);

export default function ProductTour() {
  const { stage, advanceTour } = useTour();
  const pathname = usePathname();
  
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);

  // Синхронизация запуска тура со стадией
  useEffect(() => {
    if (stage === "finished") {
      setRun(false);
      return;
    }
    setStepIndex(0);
    setRun(true);
  }, [stage]);

  // Восстановление тура при смене роута (если тур ждал перехода на нужную страницу)
  useEffect(() => {
    if (stage !== "finished" && !run) {
      const t = setTimeout(() => setRun(true), 600); // Даем DOM отрендериться
      return () => clearTimeout(t);
    }
  }, [pathname, stage, run]);

  // Интеграция с модалкой наград: шлем события для переключения вкладок
  useEffect(() => {
    if (stage === "rewards_tour" && run) {
      const tabMap = ["wardrobe", "streaks", "referral", "promos"];
      const currentTab = tabMap[stepIndex];
      if (currentTab) {
        window.dispatchEvent(new CustomEvent("tour:show-reward-tab", { detail: currentTab }));
      }
    }
  }, [stepIndex, stage, run]);

  const handleJoyrideEvent = (data: EventData, _controls: Controls) => {
    const { status, type, action, index } = data;

    // Элемента нет на текущей странице (или еще не отрендерился)
    if (type === EVENTS.TARGET_NOT_FOUND) {
      setRun(false); 
      // Пытаемся перезапуститься через секунду (вдруг страница еще грузится)
      setTimeout(() => { if (stage !== "finished") setRun(true); }, 1000);
    }

    if (type === EVENTS.STEP_AFTER) {
      const currentStageSteps = TOUR_STEPS[stage] || [];
      const isLastStep = index === currentStageSteps.length - 1;

      if (action === ACTIONS.NEXT || action === ACTIONS.PREV) {
        const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);
        
        if (isLastStep && action === ACTIONS.NEXT) {
          // Конец текущей стадии
          const config = TOUR_STAGES[stage];
          if (config.type === "advanceOnNext" && config.nextStage) {
            advanceTour(config.nextStage); // Автоматом переходим на следующую
          } else {
            setRun(false); // Ждем действия пользователя (клик/переход)
          }
        } else {
          setStepIndex(nextIndex); // Листаем шаги внутри одной стадии
        }
      }
    }

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      const config = TOUR_STAGES[stage];
      if (config && config.type === "advanceOnNext" && config.nextStage) {
        advanceTour(config.nextStage);
      } else if (stage === "rewards_tour") {
        advanceTour("finished");
      } else {
        setRun(false);
      }
    }
  };

  if (!isMounted || stage === "finished" || !TOUR_STEPS[stage]) {
    return null;
  }

  return (
    <Joyride
      steps={TOUR_STEPS[stage]!}
      run={run}
      stepIndex={stepIndex}
      onEvent={handleJoyrideEvent}
      tooltipComponent={CustomTooltip}
      continuous={true}
      options={{
        zIndex: 10000,
        overlayColor: "rgba(0, 0, 0, 0.65)",
        overlayClickAction: false,
        spotlightPadding: 10,
      }}
    />
  );
}