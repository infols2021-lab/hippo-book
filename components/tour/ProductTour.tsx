// components/tour/ProductTour.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ACTIONS, EVENTS, STATUS } from "react-joyride";
import type { EventData, Controls } from "react-joyride";

import CustomTooltip from "./CustomTooltip";
import type { CustomTourStep } from "./TourSteps";
import { useTour } from "./TourProvider";
import { TOUR_STAGES, isTourStageActiveOnPath } from "@/lib/tour/tourConfig";
import { getResolvedTourSteps } from "@/lib/tour/resolveTourSteps";
import {
  dispatchCloseMobileMenu,
  dispatchOpenMobileMenu,
  isMobileViewport,
  setTourSheetActive,
} from "@/lib/tour/tourMobile";
import { isPortalTourStage } from "@/lib/tour/tourConfig";
import { scrollPortalCardIntoView, setPortalTourActive } from "@/lib/tour/tourPortal";
import { visiblePortalCard } from "@/lib/tour/tourTargets";

const Joyride = dynamic(
  () => import("react-joyride").then((mod) => mod.Joyride),
  { ssr: false }
);

const MAX_TARGET_RETRIES = 12;
const TARGET_RETRY_DELAY_MS = 400;
const DOM_SETTLE_MS = 350;
const MOBILE_MENU_SETTLE_MS = 500;

export default function ProductTour() {
  const { stage, advanceTour, finishTour } = useTour();
  const pathname = usePathname();

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  const targetRetryCount = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  const steps = useMemo(() => {
    if (isMobile === null) return [];
    return getResolvedTourSteps(stage, isMobile);
  }, [stage, isMobile]);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (isPortalTourStage(stage)) {
      setPortalTourActive(true);
    } else {
      setPortalTourActive(false);
    }
    return () => setPortalTourActive(false);
  }, [stage]);

  useEffect(() => {
    const step = steps[stepIndex] as CustomTourStep | undefined;
    if (!step?.scrollPortalCard) return;

    const timer = setTimeout(() => {
      const card = visiblePortalCard();
      if (card) scrollPortalCardIntoView(card);
    }, 360);

    return () => clearTimeout(timer);
  }, [stepIndex, stage, steps]);

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

  const prepareStepEnvironment = useCallback(
    (index: number, stepList: CustomTourStep[]) => {
      const step = stepList[index];
      if (!step) {
        setTourSheetActive(false);
        dispatchCloseMobileMenu();
        return;
      }

      if (step.requiresMobileMenu) {
        setTourSheetActive(true);
        dispatchOpenMobileMenu();
      } else {
        setTourSheetActive(false);
        dispatchCloseMobileMenu();
      }
    },
    []
  );

  useEffect(() => {
    clearRetryTimer();
    targetRetryCount.current = 0;
    setStepIndex(0);

    if (stage === "finished") {
      setRun(false);
      setTourSheetActive(false);
      setPortalTourActive(false);
      dispatchCloseMobileMenu();
      return;
    }

    if (isTourStageActiveOnPath(stage, pathname)) {
      setRun(false);
      prepareStepEnvironment(0, steps);
      scheduleRun();
    } else {
      setRun(false);
      setTourSheetActive(false);
    }

    return clearRetryTimer;
  }, [stage, pathname, clearRetryTimer, scheduleRun, prepareStepEnvironment, steps]);

  useEffect(() => {
    if (stage === "finished") return;
    const step = steps[stepIndex];
    if (step?.requiresMobileMenu) {
      setTourSheetActive(true);
      dispatchOpenMobileMenu();
    }
  }, [stepIndex, stage, steps]);

  useEffect(() => {
    return () => {
      setTourSheetActive(false);
      setPortalTourActive(false);
      dispatchCloseMobileMenu();
    };
  }, []);

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
    const { status, type, action, index, step } = data;
    const currentStageSteps = getResolvedTourSteps(stageRef.current, isMobileViewport());

    if (type === EVENTS.TARGET_NOT_FOUND) {
      const failedStep = currentStageSteps[index ?? stepIndex] as CustomTourStep | undefined;
      if (failedStep?.requiresMobileMenu) {
        dispatchOpenMobileMenu();
        setTourSheetActive(true);
      }

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

      const isLastStep = index === currentStageSteps.length - 1;
      const customStep = step as CustomTourStep;

      if (action === ACTIONS.NEXT || action === ACTIONS.PREV) {
        const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);

        if (customStep.openMobileMenuOnNext && action === ACTIONS.NEXT) {
          setRun(false);
          dispatchOpenMobileMenu();
          setTourSheetActive(true);
          clearRetryTimer();
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            setStepIndex(nextIndex);
            scheduleRun(MOBILE_MENU_SETTLE_MS);
          }, MOBILE_MENU_SETTLE_MS);
          return;
        }

        if (action === ACTIONS.PREV) {
          const prevStep = currentStageSteps[nextIndex];
          if (!prevStep?.requiresMobileMenu) {
            setTourSheetActive(false);
            dispatchCloseMobileMenu();
          }
        }

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
          if (currentStageSteps[nextIndex]?.requiresMobileMenu) {
            setRun(false);
            scheduleRun(MOBILE_MENU_SETTLE_MS);
          }
        }
      }
    }

    if (status === STATUS.FINISHED) {
      setTourSheetActive(false);
      dispatchCloseMobileMenu();
      const config = TOUR_STAGES[stageRef.current];
      if (config && config.type === "advanceOnNext" && config.nextStage) {
        advanceTour(config.nextStage);
      } else if (stageRef.current === "rewards_tour") {
        advanceTour("finished");
      } else {
        setRun(false);
      }
    }

    if (status === STATUS.SKIPPED) {
      setRun(false);
      setTourSheetActive(false);
      setPortalTourActive(false);
      dispatchCloseMobileMenu();
      finishTour();
    }
  };

  if (!isMounted || isMobile === null || stage === "finished" || !steps.length) {
    return null;
  }

  const joyrideWidth = isMobile ? 320 : 380;
  const menuStepActive = Boolean(steps[stepIndex]?.requiresMobileMenu);
  const portalTourActive = isPortalTourStage(stage);
  const portalMobileTour = portalTourActive && isMobile;
  const currentStep = steps[stepIndex] as CustomTourStep | undefined;
  const portalDock = Boolean(currentStep?.portalMobileDock);

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      scrollToFirstStep={false}
      onEvent={handleJoyrideEvent}
      tooltipComponent={CustomTooltip}
      continuous={true}
      options={{
        zIndex: menuStepActive ? 10020 : portalTourActive ? 10050 : 10000,
        overlayColor: portalMobileTour ? "rgba(3, 7, 18, 0.82)" : portalTourActive ? "rgba(0, 0, 0, 0.78)" : "rgba(0, 0, 0, 0.65)",
        overlayClickAction: false,
        spotlightPadding: portalMobileTour ? 4 : isMobile ? 6 : 10,
        targetWaitTimeout: menuStepActive ? 5000 : 3000,
        width: joyrideWidth,
        scrollOffset: portalMobileTour ? 0 : isMobile ? 100 : 80,
      }}
      styles={
        portalDock
          ? {
              tooltip: {
                marginTop: 0,
                marginBottom: 8,
              },
              tooltipContainer: {
                textAlign: "left",
              },
            }
          : undefined
      }
    />
  );
}
