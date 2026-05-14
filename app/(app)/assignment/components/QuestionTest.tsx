"use client";

import React from "react";
import type { QuestionTest, TestOption } from "../lib/types";
import MediaRenderer from "./MediaRenderer";

type Props = {
  question: QuestionTest;
  value: any;
  onChange: (val: any) => void;
  disabled?: boolean;
};

export default function QuestionTest({ question, value, onChange, disabled }: Props) {
  const isMultiple = !!question.multiple;

  // Нормализуем варианты ответов (для поддержки старых строк и новых объектов)
  const options: TestOption[] = Array.isArray(question.options)
    ? question.options.map((opt: any, index: number) => {
        if (typeof opt === "string") {
          return { id: `opt-${index}`, text: opt, media: [] };
        }
        return opt as TestOption;
      })
    : [];

  // Текущее значение (массив для множественного, строка/число для одиночного)
  const selectedIndices: number[] = Array.isArray(value)
    ? value.map(Number)
    : typeof value !== "undefined" && value !== null && value !== ""
    ? [Number(value)]
    : [];

  function handleToggle(index: number) {
    if (disabled) return;

    if (isMultiple) {
      if (selectedIndices.includes(index)) {
        onChange(selectedIndices.filter((i) => i !== index));
      } else {
        onChange([...selectedIndices, index]);
      }
    } else {
      onChange([index]);
    }
  }

  const layout = question.layout ?? "vertical"; // по умолчанию вертикально

  if (options.length === 0) {
    return (
      <div style={{ color: "rgba(0,0,0,0.5)", fontStyle: "italic" }}>
        Нет вариантов ответа
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      {isMultiple && (
        <div style={{ fontSize: "13px", color: "rgba(0,0,0,0.5)", marginBottom: "4px" }}>
          Выберите все подходящие варианты (множественный выбор)
        </div>
      )}

      <div
        style={
          layout === "horizontal"
            ? {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "12px",
              }
            : undefined
        }
      >
        {options.map((opt, index) => {
          const isSelected = selectedIndices.includes(index);

          return (
            <label
              key={opt.id || index}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "16px",
                padding: "16px",
                borderRadius: "16px",
                background: isSelected ? "rgba(0, 123, 255, 0.04)" : "#fff",
                border: `2px solid ${
                  isSelected ? "#007bff" : "rgba(0,0,0,0.08)"
                }`,
                cursor: disabled ? "default" : "pointer",
                transition: "all 0.2s ease",
                boxShadow: isSelected
                  ? "0 4px 12px rgba(0, 123, 255, 0.1)"
                  : "0 2px 4px rgba(0,0,0,0.02)",
                opacity: disabled && !isSelected ? 0.7 : 1,
                height: layout === "horizontal" ? "100%" : undefined,
              }}
            >
              <div style={{ paddingTop: "2px" }}>
                <input
                  type={isMultiple ? "checkbox" : "radio"}
                  checked={isSelected}
                  onChange={() => handleToggle(index)}
                  disabled={disabled}
                  style={{
                    width: "20px",
                    height: "20px",
                    cursor: disabled ? "default" : "pointer",
                    accentColor: "#007bff",
                  }}
                />
              </div>

              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {opt.text && (
                  <div
                    style={{
                      fontSize: "16px",
                      color: "#000",
                      lineHeight: 1.4,
                      fontWeight: isSelected ? 800 : 600,
                    }}
                  >
                    {opt.text}
                  </div>
                )}

                {/* Ограничиваем размер картинок до 120px, как в ReviewPanel */}
                {opt.media && opt.media.length > 0 && (
                  <div style={{ marginTop: opt.text ? "4px" : "0", display: "flex", justifyContent: "flex-start" }}>
                    {opt.media[0].url?.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || opt.media[0].type?.startsWith("image") ? (
                      <img
                        src={opt.media[0].url}
                        alt=""
                        style={{
                          maxWidth: "120px",
                          maxHeight: "120px",
                          objectFit: "contain",
                          borderRadius: "8px",
                        }}
                      />
                    ) : (
                      <div style={{ maxWidth: "300px" }}>
                        <MediaRenderer media={opt.media} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}