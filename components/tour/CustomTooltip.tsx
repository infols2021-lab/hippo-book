// components/tour/CustomTooltip.tsx
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { TooltipRenderProps } from "react-joyride";
import { CustomTourStep } from "./TourSteps";
import { useTour } from "./TourProvider";

export default function CustomTooltip({
  index,
  step,
  skipProps,
  primaryProps,
  backProps,
  tooltipProps,
  isLastStep,
}: TooltipRenderProps) {
  const { finishTour } = useTour();
  const [confirmClose, setConfirmClose] = useState(false);
  const customStep = step as CustomTourStep;
  const isCentered = step.placement === "center";
  const portalTheme = Boolean(customStep.portalTheme);

  const cardBg = portalTheme ? "rgba(15, 23, 42, 0.97)" : "var(--project-card-bg, #ffffff)";
  const textColor = portalTheme ? "#f8fafc" : "var(--project-text, #0f172a)";
  const mutedColor = portalTheme
    ? "rgba(248, 250, 252, 0.72)"
    : "color-mix(in srgb, var(--project-text) 75%, transparent)";
  const borderColor = portalTheme
    ? "rgba(255, 255, 255, 0.12)"
    : "var(--glass-border, rgba(15, 23, 42, 0.12))";
  const accent = portalTheme ? "#38bdf8" : "var(--project-primary, #0ea5e9)";
  const subtleBg = portalTheme
    ? "rgba(255, 255, 255, 0.08)"
    : "color-mix(in srgb, var(--project-text) 4%, transparent)";

  useEffect(() => {
    setConfirmClose(false);
  }, [index, step.title]);

  const handleConfirmClose = (e: React.MouseEvent<HTMLButtonElement>) => {
    skipProps.onClick?.(e as unknown as React.MouseEvent<HTMLElement>);
    finishTour();
  };

  return (
    <div
      {...tooltipProps}
      className="tour-tooltip flex flex-col gap-3 p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] border shadow-2xl w-[min(calc(100vw-20px),380px)] max-h-[min(88dvh,520px)]"
      style={{
        backgroundColor: cardBg,
        borderColor,
        color: textColor,
        boxShadow: portalTheme
          ? "0 25px 60px -12px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255,255,255,0.06)"
          : "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
      }}
    >
      {confirmClose ? (
        <div className="flex flex-1 flex-col w-full">
          <div className="mb-1.5 w-full">
            <span
              className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mb-1"
              style={{
                backgroundColor: `color-mix(in srgb, ${accent} 18%, transparent)`,
                color: accent,
              }}
            >
              Инструктаж
            </span>
            <h3 className="text-sm sm:text-base font-black tracking-tight leading-snug">
              Закрыть гайд?
            </h3>
          </div>

          <p
            className="text-xs sm:text-sm font-medium leading-relaxed mb-4"
            style={{ color: mutedColor }}
          >
            Вы всегда сможете вернуться к гайду: на компьютере — кнопка «?» в профиле, на
            телефоне — пункт «? Помощь по платформе» в меню ☰.
          </p>

          <div
            className="flex items-center justify-end gap-2 mt-auto pt-3 border-t w-full shrink-0"
            style={{ borderColor: portalTheme ? "rgba(255,255,255,0.1)" : "var(--glass-border, rgba(15, 23, 42, 0.08))" }}
          >
            <button
              type="button"
              className="px-3 py-2 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border hover:brightness-95"
              style={{
                backgroundColor: subtleBg,
                borderColor,
              }}
              onClick={() => setConfirmClose(false)}
            >
              Продолжить
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all shadow-md hover:brightness-110 active:scale-[0.98]"
              style={{
                backgroundColor: accent,
                color: "#ffffff",
                boxShadow: `0 8px 20px -4px color-mix(in srgb, ${accent} 50%, transparent)`,
              }}
              onClick={handleConfirmClose}
            >
              Завершить
            </button>
          </div>
        </div>
      ) : (
        <>
          {customStep.mascotImage && (
            <div className="flex justify-center shrink-0 pt-0.5">
              <div
                className="relative h-[72px] w-[72px] sm:h-[80px] sm:w-[80px] rounded-full overflow-hidden shrink-0"
                style={{
                  border: "3px solid #ffffff",
                  boxShadow:
                    "0 0 0 1px color-mix(in srgb, var(--project-primary) 25%, transparent), 0 10px 28px rgba(15, 23, 42, 0.18)",
                  backgroundColor: "color-mix(in srgb, var(--project-primary) 10%, #ffffff)",
                }}
              >
                <Image
                  src={customStep.mascotImage}
                  alt="Маскот"
                  fill
                  priority
                  sizes="80px"
                  className="object-cover object-center"
                />
              </div>
            </div>
          )}

          <div
            className={`flex flex-1 flex-col min-h-0 overflow-y-auto w-full ${
              isCentered ? "text-center items-center" : ""
            }`}
          >
            {step.title && (
              <div className={`mb-1.5 w-full ${isCentered ? "text-center" : ""}`}>
                <span
                  className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mb-1"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${accent} 18%, transparent)`,
                    color: accent,
                  }}
                >
                  Инструктаж
                </span>
                <h3 className="text-sm sm:text-base font-black tracking-tight leading-snug">{step.title}</h3>
              </div>
            )}

            <div
              className="text-xs sm:text-sm font-medium leading-relaxed mb-3"
              style={{ color: mutedColor }}
            >
              {step.content}
            </div>

            <div
              className="flex items-center justify-between mt-auto pt-3 border-t w-full shrink-0"
              style={{ borderColor: portalTheme ? "rgba(255,255,255,0.1)" : "var(--glass-border, rgba(15, 23, 42, 0.08))" }}
            >
              <button
                type="button"
                className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-colors hover:opacity-70 px-1 py-1.5"
                style={{ color: portalTheme ? "rgba(248,250,252,0.5)" : "color-mix(in srgb, var(--project-text) 50%, transparent)" }}
                onClick={() => setConfirmClose(true)}
              >
                Закрыть
              </button>

              <div className="flex items-center gap-1.5">
                {index > 0 && (
                  <button
                    {...backProps}
                    className="px-3 py-2 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border hover:brightness-95"
                    style={{
                      backgroundColor: subtleBg,
                      borderColor,
                    }}
                  >
                    Назад
                  </button>
                )}

                {!customStep.hideNextButton && (
                  <button
                    {...primaryProps}
                    className="px-4 py-2 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all shadow-md hover:brightness-110 active:scale-[0.98]"
                    style={{
                      backgroundColor: accent,
                      color: "#ffffff",
                      boxShadow: `0 8px 20px -4px color-mix(in srgb, ${accent} 50%, transparent)`,
                    }}
                  >
                    {customStep.primaryLabel || (isLastStep ? "Завершить" : "Далее")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
