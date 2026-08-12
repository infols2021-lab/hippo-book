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

  // Определяем, центрирован ли тултип (для первого шага на портале)
  // ВАЖНО: `placement` находится в `step`, а не в `tooltipProps`
  const isCentered = step.placement === "center";

  return (
    <div
      {...tooltipProps}
      // Жестко ограничиваем ширину, чтобы не вылезало за экран на мобилках
      className={`relative flex flex-col ${isCentered ? 'sm:flex-col items-center text-center' : 'sm:flex-row'} gap-4 sm:gap-6 p-5 sm:p-7 rounded-[32px] border shadow-2xl w-[calc(100vw-24px)] max-w-lg animate-in fade-in zoom-in-95 duration-300`}
      style={{
        backgroundColor: "var(--project-card-bg, #ffffff)",
        borderColor: "var(--glass-border, rgba(15, 23, 42, 0.12))",
        color: "var(--project-text, #0f172a)",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
      }}
    >
      {/* Изображение маскота */}
      {customStep.mascotImage && (
        <div className={`flex-shrink-0 flex justify-center pointer-events-none drop-shadow-xl z-10 ${
          isCentered 
            ? "-mt-16 sm:-mt-20" // Если по центру, маскот торчит сверху
            : "-mt-16 sm:-mt-10 sm:-ml-12" // Если сбоку, маскот торчит слева-сверху
        }`}>
          <div className="relative w-32 h-32 sm:w-40 sm:h-40">
            <Image
              src={customStep.mascotImage}
              alt="Mascot Guide"
              fill
              priority={true}
              className="object-contain"
            />
          </div>
        </div>
      )}

      {/* Контентная часть */}
      <div className="flex-1 flex flex-col justify-center w-full">
        {step.title && (
          <div className="mb-2">
            <span 
              className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md mb-1.5"
              style={{ backgroundColor: "color-mix(in srgb, var(--project-primary) 15%, transparent)", color: "var(--project-primary)" }}
            >
              Инструктаж
            </span>
            <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight">
              {step.title}
            </h3>
          </div>
        )}
        
        <div
          className="text-sm font-medium leading-relaxed mb-6"
          style={{ color: "color-mix(in srgb, var(--project-text) 75%, transparent)" }}
        >
          {step.content}
        </div>

        {/* Панель кнопок */}
        <div 
          className="flex items-center justify-between mt-auto pt-4 border-t w-full" 
          style={{ borderColor: "var(--glass-border, rgba(15, 23, 42, 0.08))" }}
        >
          <button
            {...skipProps}
            className="text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-colors hover:opacity-70 px-2 py-2"
            style={{ color: "color-mix(in srgb, var(--project-text) 50%, transparent)" }}
          >
            Закрыть тур
          </button>

          <div className="flex items-center gap-2">
            {index > 0 && !isCentered && (
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
            
            {/* Если шаг требует реального клика по элементу, скрываем кнопку "Далее" */}
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