// components/tour/ProductTour.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
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

// Сколько раз пробуем перезапуститься, если таргет не найден на странице,
// прежде чем сдаться и не долбить бесконечным setTimeout/спиннером.
const MAX_TARGET_RETRIES = 5;
const TARGET_RETRY_DELAY_MS = 1000;

export default function ProductTour() {
  const { stage, advanceTour } = useTour();
  const pathname = usePathname();

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  // Счетчик неудачных попыток найти таргет — сбрасывается при смене стадии/роута
  const targetRetryCount = useRef(0);

  useEffect(() => setIsMounted(true), []);

  // Синхронизация запуска тура со стадией
  useEffect(() => {
    if (stage === "finished") {
      setRun(false);
      return;
    }
    targetRetryCount.current = 0;
    setStepIndex(0);
    setRun(true);
  }, [stage]);

  // Сброс счетчика ретраев при смене роута
  useEffect(() => {
    targetRetryCount.current = 0;
  }, [pathname]);

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

    // Элемента нет на текущей странице (или еще не отрендерился, или таргет-селектор битый)
    if (type === EVENTS.TARGET_NOT_FOUND) {
      setRun(false);

      targetRetryCount.current += 1;

      // Ограничиваем число ретраев, иначе при отсутствующем/переименованном
      // селекторе получаем вечный мигающий цикл run=false -> run=true -> ...
      if (targetRetryCount.current <= MAX_TARGET_RETRIES) {
        setTimeout(() => {
          if (stage !== "finished") setRun(true);
        }, TARGET_RETRY_DELAY_MS);
      } else {
        console.warn(
          `[ProductTour] Target not found for stage "${stage}" after ${MAX_TARGET_RETRIES} attempts. Stopping retries — check the target selector in TourSteps.ts.`
        );
      }
    }

    if (type === EVENTS.STEP_AFTER) {
      targetRetryCount.current = 0;

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
        overlayClickAction: false, // клик по темному фону вокруг спота ничего не делает (валидная опция v3)
        spotlightPadding: 10,
      }}
    />
  );
}