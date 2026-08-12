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
  // Приводим базовый шаг к нашему расширенному типу для доступа к mascotImage
  const customStep = step as CustomTourStep;

  return (
    <div
      {...tooltipProps}
      className="relative flex flex-col sm:flex-row gap-2 sm:gap-6 p-5 sm:p-7 rounded-[32px] border shadow-2xl max-w-lg w-full animate-in fade-in zoom-in-95 duration-300"
      style={{
        backgroundColor: "var(--project-card-bg, #ffffff)",
        borderColor: "var(--glass-border, rgba(15, 23, 42, 0.12))",
        color: "var(--project-text, #0f172a)",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
      }}
    >
      {/* Изображение маскота */}
      {customStep.mascotImage && (
        <div className="flex-shrink-0 flex justify-center sm:justify-start -mt-20 sm:-mt-10 sm:-ml-16 pointer-events-none drop-shadow-xl z-10">
          <div className="relative w-36 h-36 sm:w-48 sm:h-48">
            <Image
              src={customStep.mascotImage}
              alt="Mascot"
              fill
              priority={true} // Ключевой флаг для моментальной отрисовки
              className="object-contain"
            />
          </div>
        </div>
      )}

      {/* Контентная часть */}
      <div className="flex-1 flex flex-col justify-center mt-2 sm:mt-0">
        {step.title && (
          <h3 className="text-base sm:text-lg font-black uppercase tracking-wider mb-2.5">
            {step.title}
          </h3>
        )}
        <div
          className="text-sm font-medium leading-relaxed mb-6"
          style={{ color: "color-mix(in srgb, var(--project-text) 75%, transparent)" }}
        >
          {step.content}
        </div>

        {/* Панель кнопок */}
        <div 
          className="flex items-center justify-between mt-auto pt-4 border-t" 
          style={{ borderColor: "var(--glass-border, rgba(15, 23, 42, 0.08))" }}
        >
          <button
            {...skipProps}
            className="text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-colors hover:opacity-70 px-2 py-2"
            style={{ color: "color-mix(in srgb, var(--project-text) 50%, transparent)" }}
          >
            Пропустить
          </button>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                {...backProps}
                className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border hover:brightness-95"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--project-text) 4%, transparent)",
                  borderColor: "var(--glass-border, rgba(15, 23, 42, 0.12))",
                }}
              >
                Назад
              </button>
            )}
            
            {/* Скрываем кнопку "Далее", если шаг требует клика по самой мишени */}
            {!customStep.hideNextButton && (
              <button
                {...primaryProps}
                className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md hover:brightness-110 active:scale-[0.98]"
                style={{
                  backgroundColor: "var(--project-primary, #0ea5e9)",
                  color: "#ffffff",
                  boxShadow: "0 8px 20px -4px color-mix(in srgb, var(--project-primary) 50%, transparent)",
                }}
              >
                {isLastStep ? "Завершить" : "Далее"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}