"use client";

import React from "react";
import type { QuestionTest, TestOption } from "@/lib/assignments/types";
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

  // Безопасное извлечение правильных ответов (для режима разбора/песочницы)
  const correctIndices: number[] = Array.isArray(question.correct)
    ? question.correct
    : typeof question.correct === "number"
    ? [question.correct]
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
      <div style={{ color: "#64748b", fontWeight: 600, padding: "16px", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
        ⚠️ Нет вариантов ответа
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {isMultiple && (
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#64748b", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "16px" }}>☑️</span> Выберите все подходящие варианты
        </div>
      )}

      <div
        style={
          layout === "horizontal"
            ? {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "16px",
              }
            : {
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }
        }
      >
        {options.map((opt, index) => {
          const isSelected = selectedIndices.includes(index);
          const isCorrect = correctIndices.includes(index);

          // Логика визуального фидбека для режима проверки (disabled = true)
          let borderColor = isSelected ? "#0ea5e9" : "#e2e8f0";
          let bgColor = isSelected ? "#f0f9ff" : "#ffffff";
          let textColor = "#0f172a";
          let icon = null;

          if (disabled) {
            if (isSelected && isCorrect) {
              borderColor = "#10b981"; // Зеленый (выбрал правильно)
              bgColor = "#f0fdf4";
              textColor = "#166534";
              icon = <span style={{ color: "#10b981", fontWeight: 900, fontSize: "18px" }}>✓</span>;
            } else if (isSelected && !isCorrect) {
              borderColor = "#ef4444"; // Красный (выбрал ошибку)
              bgColor = "#fef2f2";
              textColor = "#991b1b";
              icon = <span style={{ color: "#ef4444", fontWeight: 900, fontSize: "18px" }}>✗</span>;
            } else if (!isSelected && isCorrect) {
              borderColor = "#10b981"; // Пропустил правильный
              bgColor = "#ffffff";
              textColor = "#166534";
              icon = <span style={{ color: "#10b981", fontWeight: 900, fontSize: "18px", opacity: 0.5 }}>✓</span>;
            } else {
              borderColor = "#e2e8f0"; // Серый (не выбрал и он не правильный)
              bgColor = "#f8fafc";
              textColor = "#64748b";
            }
          }

          return (
            <label
              key={opt.id || index}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "16px",
                padding: "16px 20px",
                borderRadius: "16px",
                background: bgColor,
                border: `2px solid ${borderColor}`,
                cursor: disabled ? "default" : "pointer",
                transition: "all 0.2s ease",
                boxShadow: isSelected && !disabled ? "0 4px 12px rgba(14, 165, 233, 0.15)" : "0 2px 4px rgba(0,0,0,0.02)",
                opacity: disabled && !isSelected && !isCorrect ? 0.6 : 1,
                height: layout === "horizontal" ? "100%" : undefined,
              }}
            >
              <div style={{ paddingTop: "2px", display: "flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px" }}>
                {disabled && icon ? (
                  icon
                ) : (
                  <input
                    type={isMultiple ? "checkbox" : "radio"}
                    checked={isSelected}
                    onChange={() => handleToggle(index)}
                    disabled={disabled}
                    style={{
                      width: "22px",
                      height: "22px",
                      cursor: disabled ? "default" : "pointer",
                      accentColor: "#0ea5e9",
                    }}
                  />
                )}
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
                {opt.text && (
                  <div
                    style={{
                      fontSize: "16px",
                      color: textColor,
                      lineHeight: 1.45,
                      fontWeight: isSelected || (disabled && isCorrect) ? 800 : 600,
                    }}
                  >
                    {opt.text}
                  </div>
                )}

                {/* Ограничиваем размер картинок до 120px для UI-стабильности */}
                {opt.media && opt.media.length > 0 && (
                  <div style={{ marginTop: opt.text ? "4px" : "0", display: "flex", justifyContent: "flex-start" }}>
                    {opt.media[0].url?.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i) || opt.media[0].type?.startsWith("image") ? (
                      <img
                        src={opt.media[0].url}
                        alt="Медиавариант"
                        style={{
                          maxWidth: "140px",
                          maxHeight: "140px",
                          objectFit: "contain",
                          borderRadius: "10px",
                          border: "1px solid rgba(0,0,0,0.05)",
                          backgroundColor: "#fff"
                        }}
                      />
                    ) : (
                      <div style={{ maxWidth: "300px", width: "100%" }}>
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