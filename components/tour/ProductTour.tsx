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
  isMobileViewport,
  setTourSheetActive,
  TOUR_BURGER_CLICKED,
  TOUR_PAGE_READY,
  TOUR_REWARDS_MODAL_READY,
} from "@/lib/tour/tourMobile";
import { isPortalTourStage } from "@/lib/tour/tourConfig";
import { scrollPortalCardIntoView, setPortalTourActive } from "@/lib/tour/tourPortal";
import { visiblePortalCard } from "@/lib/tour/tourTargets";
import { saveTourProgress } from "@/lib/tour/tourPersistence";
import { getInitialTourStepIndex, releaseTourUi } from "@/lib/tour/tourRecovery";

const Joyride = dynamic(
  () => import("react-joyride").then((mod) => mod.Joyride),
  { ssr: false }
);

const MAX_TARGET_RETRIES = 8;
const MAX_REWARDS_TARGET_RETRIES = 24;
const TARGET_RETRY_DELAY_MS = 400;
const DOM_SETTLE_MS = 350;
const MOBILE_MENU_SETTLE_MS = 500;

/** Joyride шлёт FINISHED при setRun(false) — не путать с завершением пользователем. */
const abortTourRunRef = { current: false };

export function markTourRunAbort() {
  abortTourRunRef.current = true;
}

export default function ProductTour() {
  const { stage, advanceTour, finishTour } = useTour();
  const pathname = usePathname();

  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  const targetRetryCount = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rewardsModalReadyRef = useRef(false);
  const rewardsTourBootRef = useRef(false);
  const handledStepAdvanceRef = useRef<string | null>(null);
  const pathnameRef = useRef(pathname);
  const stageRef = useRef(stage);
  const stepIndexRef = useRef(stepIndex);
  const prevStageRef = useRef(stage);
  pathnameRef.current = pathname;
  stageRef.current = stage;
  stepIndexRef.current = stepIndex;

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

  useEffect(() => {
    if (stage !== "requests_info" || stepIndex !== 1) return;
    const timer = setTimeout(() => {
      document
        .querySelector<HTMLElement>('[data-tour="create-request-btn"]')
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 280);
    return () => clearTimeout(timer);
  }, [stage, stepIndex]);

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
          isTourStageActiveOnPath(stageRef.current, pathnameRef.current)
        ) {
          abortTourRunRef.current = false;
          setRun(true);
        }
      }, delay);
    },
    [clearRetryTimer]
  );

  const scheduleRewardsTourRun = useCallback(
    (delay = DOM_SETTLE_MS) => {
      clearRetryTimer();
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        if (
          stageRef.current !== "rewards_tour" ||
          !isTourStageActiveOnPath("rewards_tour", pathnameRef.current)
        ) {
          return;
        }

        if (!rewardsModalReadyRef.current) {
          scheduleRewardsTourRun(180);
          return;
        }

        const tabMap = ["wardrobe", "streaks", "referral", "promos"] as const;
        const currentTab = tabMap[stepIndexRef.current] ?? "wardrobe";
        if (stepIndexRef.current === 0) {
          document.querySelector<HTMLElement>('[data-tour="wardrobe-tab"]')?.scrollIntoView({
            block: "nearest",
            inline: "start",
          });
        }
        window.dispatchEvent(new CustomEvent("tour:show-reward-tab", { detail: currentTab }));
        abortTourRunRef.current = false;
        setRun(true);
      }, delay);
    },
    [clearRetryTimer]
  );

  const stopTourRun = useCallback(() => {
    markTourRunAbort();
    setRun(false);
  }, []);

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
      } else if (step.waitForBurgerClick) {
        setTourSheetActive(false);
        dispatchCloseMobileMenu();
      } else {
        setTourSheetActive(false);
        dispatchCloseMobileMenu();
      }
    },
    []
  );

  useEffect(() => {
    if (stage !== "rewards_tour") {
      rewardsTourBootRef.current = false;
    }
  }, [stage]);

  useEffect(() => {
    clearRetryTimer();
    targetRetryCount.current = 0;
    handledStepAdvanceRef.current = null;

    if (stage === "finished") {
      stopTourRun();
      releaseTourUi();
      return;
    }

    if (!steps.length) {
      stopTourRun();
      releaseTourUi();
      return;
    }

    const activeOnPath = isTourStageActiveOnPath(stage, pathname);

    if (activeOnPath) {
      let resumeIndex = getInitialTourStepIndex(stage, pathname, steps as CustomTourStep[]);
      if (stage === "rewards_tour") {
        if (!rewardsTourBootRef.current) {
          resumeIndex = 0;
          rewardsTourBootRef.current = true;
        } else {
          resumeIndex = stepIndexRef.current;
        }
      }
      prevStageRef.current = stage;
      setStepIndex(resumeIndex);
      stepIndexRef.current = resumeIndex;
      saveTourProgress(stage, resumeIndex, pathname);
      stopTourRun();
      prepareStepEnvironment(resumeIndex, steps as CustomTourStep[]);

      if (stage === "rewards_tour") {
        rewardsModalReadyRef.current = false;
        scheduleRewardsTourRun();
      } else {
        scheduleRun();
      }
    } else {
      stopTourRun();
      releaseTourUi();
    }

    return clearRetryTimer;
  }, [stage, pathname, clearRetryTimer, scheduleRun, scheduleRewardsTourRun, prepareStepEnvironment, steps, stopTourRun]);

  useEffect(() => {
    if (stage === "finished" || !steps.length) return;
    if (!isTourStageActiveOnPath(stage, pathname)) return;

    prepareStepEnvironment(stepIndex, steps as CustomTourStep[]);
  }, [stage, stepIndex, pathname, steps, prepareStepEnvironment]);

  useEffect(() => {
    const onBurgerClick = () => {
      const mobile = isMobileViewport();
      const currentSteps = getResolvedTourSteps(stageRef.current, mobile);
      const idx = stepIndexRef.current;
      const current = currentSteps[idx] as CustomTourStep | undefined;
      if (!current?.waitForBurgerClick) return;

      targetRetryCount.current = 0;
      stopTourRun();
      setTourSheetActive(true);
      clearRetryTimer();

      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        const nextIndex = idx + 1;
        if (nextIndex < currentSteps.length) {
          setStepIndex(nextIndex);
          stepIndexRef.current = nextIndex;
          saveTourProgress(stageRef.current, nextIndex, pathnameRef.current);
          scheduleRun(MOBILE_MENU_SETTLE_MS);
        }
      }, 420);
    };

    window.addEventListener(TOUR_BURGER_CLICKED, onBurgerClick);
    return () => window.removeEventListener(TOUR_BURGER_CLICKED, onBurgerClick);
  }, [clearRetryTimer, scheduleRun, stopTourRun]);

  useEffect(() => {
    const onPageReady = () => {
      if (
        stageRef.current !== "finished" &&
        isTourStageActiveOnPath(stageRef.current, pathnameRef.current)
      ) {
        targetRetryCount.current = 0;
        if (stageRef.current === "rewards_tour") {
          scheduleRewardsTourRun(120);
        } else {
          scheduleRun(120);
        }
      }
    };

    const onRewardsModalReady = () => {
      rewardsModalReadyRef.current = true;
      if (
        stageRef.current === "rewards_tour" &&
        isTourStageActiveOnPath("rewards_tour", pathnameRef.current)
      ) {
        targetRetryCount.current = 0;
        scheduleRewardsTourRun(120);
      }
    };

    window.addEventListener(TOUR_PAGE_READY, onPageReady);
    window.addEventListener(TOUR_REWARDS_MODAL_READY, onRewardsModalReady);
    return () => {
      window.removeEventListener(TOUR_PAGE_READY, onPageReady);
      window.removeEventListener(TOUR_REWARDS_MODAL_READY, onRewardsModalReady);
    };
  }, [scheduleRun, scheduleRewardsTourRun]);

  useEffect(() => {
    return () => {
      releaseTourUi();
    };
  }, []);

  useEffect(() => {
    if (stage !== "rewards_tour" || !run) return;

    const tabMap = ["wardrobe", "streaks", "referral", "promos"] as const;
    const currentTab = tabMap[stepIndex] ?? "wardrobe";
    window.dispatchEvent(new CustomEvent("tour:show-reward-tab", { detail: currentTab }));
  }, [stepIndex, stage, run]);

  const handleJoyrideEvent = (data: EventData, _controls: Controls) => {
    const { status, type, action, index, step } = data;
    const currentStageSteps = getResolvedTourSteps(stageRef.current, isMobileViewport());

    if (type === EVENTS.TARGET_NOT_FOUND) {
      const failedIndex = index ?? stepIndexRef.current;
      const failedStep = currentStageSteps[failedIndex] as CustomTourStep | undefined;

      stopTourRun();
      if (failedStep?.requiresMobileMenu) {
        setTourSheetActive(true);
        dispatchCloseMobileMenu();
      } else {
        releaseTourUi();
      }

      targetRetryCount.current += 1;

      if (!isTourStageActiveOnPath(stageRef.current, pathnameRef.current)) {
        return;
      }

      if (targetRetryCount.current > (stageRef.current === "rewards_tour" ? MAX_REWARDS_TARGET_RETRIES : MAX_TARGET_RETRIES)) {
        if (stageRef.current === "rewards_tour") {
          targetRetryCount.current = 0;
          scheduleRewardsTourRun(TARGET_RETRY_DELAY_MS);
          return;
        }

        targetRetryCount.current = 0;
        const nextIndex = failedIndex + 1;
        if (nextIndex < currentStageSteps.length) {
          setStepIndex(nextIndex);
          stepIndexRef.current = nextIndex;
          saveTourProgress(stageRef.current, nextIndex, pathnameRef.current);
          prepareStepEnvironment(nextIndex, currentStageSteps as CustomTourStep[]);
          scheduleRun(MOBILE_MENU_SETTLE_MS);
        } else {
          releaseTourUi();
        }
        return;
      }

      if (stageRef.current === "rewards_tour") {
        scheduleRewardsTourRun(TARGET_RETRY_DELAY_MS);
      } else {
        scheduleRun(TARGET_RETRY_DELAY_MS);
      }
    }

    if (type === EVENTS.STEP_AFTER) {
      targetRetryCount.current = 0;

      const isLastStep = index === currentStageSteps.length - 1;
      const customStep = step as CustomTourStep;

        if (action === ACTIONS.NEXT || action === ACTIONS.PREV) {
          const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);

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
            handledStepAdvanceRef.current = stageRef.current;
            advanceTour(config.nextStage);
          } else if (config.nextStage) {
            handledStepAdvanceRef.current = stageRef.current;
            advanceTour(config.nextStage);
          } else {
            stopTourRun();
            releaseTourUi();
          }
          } else {
            setStepIndex(nextIndex);
            saveTourProgress(stageRef.current, nextIndex, pathnameRef.current);
            const nextStep = currentStageSteps[nextIndex] as CustomTourStep | undefined;
            if (nextStep?.requiresMobileMenu) {
              stopTourRun();
              scheduleRun(MOBILE_MENU_SETTLE_MS);
            }
          }
      }
    }

    if (status === STATUS.FINISHED) {
      releaseTourUi();
      stopTourRun();

      const finishedStage = stageRef.current;

      if (abortTourRunRef.current) {
        abortTourRunRef.current = false;
        return;
      }

      if (handledStepAdvanceRef.current === finishedStage) {
        handledStepAdvanceRef.current = null;
        return;
      }

      // Переход стадии только через STEP_AFTER (клик «Далее»), не при abort/FINISHED
      if (finishedStage === "rewards_tour") {
        advanceTour("finished");
      }
      handledStepAdvanceRef.current = null;
    }

    if (status === STATUS.SKIPPED) {
      stopTourRun();
      releaseTourUi();
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
