// components/tour/ProductTour.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ACTIONS, EVENTS, STATUS } from "react-joyride";
import type { EventData, Controls } from "react-joyride";

import CustomTooltip from "./CustomTooltip";
import { TOUR_STEPS } from "./TourSteps";
import { useTour } from "./TourProvider";
import { TOUR_STAGES, isTourStageActiveOnPath } from "@/lib/tour/tourConfig";

const Joyride = dynamic(
  () => import("react-joyride").then((mod) => mod.Joyride),
  { ssr: false }
);

const MAX_TARGET_RETRIES = 8;
const TARGET_RETRY_DELAY_MS = 400;
const DOM_SETTLE_MS = 350;

export default function ProductTour() {
  const { stage, advanceTour } = useTour();
  const pathname = usePathname();

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  const targetRetryCount = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  useEffect(() => setIsMounted(true), []);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const scheduleRun = useCallback(
    (delay = DOM_SETTLE_MS) => {
      clearRetryTimer();
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        if (
          stageRef.current !== "finished" &&
          isTourStageActiveOnPath(stageRef.current, pathname)
        ) {
          setRun(true);
        }
      }, delay);
    },
    [clearRetryTimer, pathname]
  );

  // Запуск / пауза при смене стадии или роута
  useEffect(() => {
    clearRetryTimer();
    targetRetryCount.current = 0;

    if (stage === "finished") {
      setRun(false);
      return;
    }

    setStepIndex(0);

    if (isTourStageActiveOnPath(stage, pathname)) {
      setRun(false);
      scheduleRun();
    } else {
      setRun(false);
    }

    return clearRetryTimer;
  }, [stage, pathname, clearRetryTimer, scheduleRun]);

  // Переключение вкладок в модалке наград
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

    if (type === EVENTS.TARGET_NOT_FOUND) {
      setRun(false);
      targetRetryCount.current += 1;

      if (
        targetRetryCount.current <= MAX_TARGET_RETRIES &&
        isTourStageActiveOnPath(stageRef.current, pathname)
      ) {
        scheduleRun(TARGET_RETRY_DELAY_MS);
      } else if (targetRetryCount.current > MAX_TARGET_RETRIES) {
        console.warn(
          `[ProductTour] Target not found for stage "${stageRef.current}" after ${MAX_TARGET_RETRIES} attempts.`
        );
      }
    }

    if (type === EVENTS.STEP_AFTER) {
      targetRetryCount.current = 0;

      const currentStageSteps = TOUR_STEPS[stageRef.current] || [];
      const isLastStep = index === currentStageSteps.length - 1;

      if (action === ACTIONS.NEXT || action === ACTIONS.PREV) {
        const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);

        if (isLastStep && action === ACTIONS.NEXT) {
          const config = TOUR_STAGES[stageRef.current];
          if (config.type === "advanceOnNext" && config.nextStage) {
            advanceTour(config.nextStage);
          } else if (config.nextStage) {
            advanceTour(config.nextStage);
          } else {
            setRun(false);
          }
        } else {
          setStepIndex(nextIndex);
        }
      }
    }

    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      const config = TOUR_STAGES[stageRef.current];
      if (config && config.type === "advanceOnNext" && config.nextStage) {
        advanceTour(config.nextStage);
      } else if (stageRef.current === "rewards_tour") {
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
        targetWaitTimeout: 2500,
        width: 380,
        scrollOffset: 80,
      }}
    />
  );
}
