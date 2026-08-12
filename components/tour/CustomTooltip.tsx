// components/tour/CustomTooltip.tsx
"use client";

import React from "react";
import Image from "next/image";
import { TooltipRenderProps } from "react-joyride";
import { CustomTourStep } from "./TourSteps";

export default function CustomTooltip({
  index,
  step,
  skipProps,
  primaryProps,
  backProps,
  tooltipProps,
  isLastStep,
}: TooltipRenderProps) {
  const customStep = step as CustomTourStep;
  const isCentered = step.placement === "center";

  return (
    <div
      {...tooltipProps}
      className={`tour-tooltip relative flex flex-col ${
        isCentered ? "items-center text-center" : "sm:flex-row"
      } gap-3 sm:gap-4 p-4 sm:p-5 rounded-[24px] sm:rounded-[28px] border shadow-2xl w-[min(calc(100vw-20px),380px)] max-h-[min(88dvh,520px)] overflow-hidden`}
      style={{
        backgroundColor: "var(--project-card-bg, #ffffff)",
        borderColor: "var(--glass-border, rgba(15, 23, 42, 0.12))",
        color: "var(--project-text, #0f172a)",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
      }}
    >
      {customStep.mascotImage && (
        <div
          className={`flex-shrink-0 flex justify-center pointer-events-none z-10 ${
            isCentered ? "-mt-12 sm:-mt-14" : "-mt-10 sm:-mt-8 sm:-ml-4"
          }`}
        >
          <div className="relative w-20 h-20 sm:w-24 sm:h-24">
            <Image
              src={customStep.mascotImage}
              alt="Маскот"
              fill
              priority
              className="object-contain"
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 w-full overflow-y-auto">
        {step.title && (
          <div className="mb-1.5">
            <span
              className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mb-1"
              style={{
                backgroundColor: "color-mix(in srgb, var(--project-primary) 15%, transparent)",
                color: "var(--project-primary)",
              }}
            >
              Инструктаж
            </span>
            <h3 className="text-sm sm:text-base font-black tracking-tight leading-snug">{step.title}</h3>
          </div>
        )}

        <div
          className="text-xs sm:text-sm font-medium leading-relaxed mb-3"
          style={{ color: "color-mix(in srgb, var(--project-text) 75%, transparent)" }}
        >
          {step.content}
        </div>

        <div
          className="flex items-center justify-between mt-auto pt-3 border-t w-full shrink-0"
          style={{ borderColor: "var(--glass-border, rgba(15, 23, 42, 0.08))" }}
        >
          <button
            {...skipProps}
            className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-colors hover:opacity-70 px-1 py-1.5"
            style={{ color: "color-mix(in srgb, var(--project-text) 50%, transparent)" }}
          >
            Закрыть
          </button>

          <div className="flex items-center gap-1.5">
            {index > 0 && !isCentered && (
              <button
                {...backProps}
                className="px-3 py-2 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all border hover:brightness-95"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--project-text) 4%, transparent)",
                  borderColor: "var(--glass-border, rgba(15, 23, 42, 0.12))",
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
                  backgroundColor: "var(--project-primary, #0ea5e9)",
                  color: "#ffffff",
                  boxShadow: "0 8px 20px -4px color-mix(in srgb, var(--project-primary) 50%, transparent)",
                }}
              >
                {customStep.primaryLabel || (isLastStep ? "Завершить" : "Далее")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
