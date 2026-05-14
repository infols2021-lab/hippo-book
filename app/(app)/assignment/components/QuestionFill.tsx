"use client";

import React from "react";
import type { QuestionFill } from "../lib/types";

type Props = {
  question: QuestionFill;
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
};

export default function QuestionFill({ question, value = [], onChange, disabled }: Props) {
  const answersCount = (question.answers || []).length;

  const handleInputChange = (index: number, text: string) => {
    if (disabled) return;
    const next = [...(Array.isArray(value) ? value : [])];
    // Заполняем массив до нужной длины, если он пустой
    while (next.length < answersCount) next.push("");
    next[index] = text;
    onChange(next);
  };

  return (
    <div className="fill-container" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div className="fill-inputs-container" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {(question.answers || []).map((_, idx) => (
          <div 
            className="fill-input-item" 
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              background: "#f8fafc",
              padding: "12px 16px",
              borderRadius: "16px",
              border: "1px solid #e2e8f0",
              opacity: disabled ? 0.7 : 1,
            }}
          >
            <div 
              className="fill-input-number"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "#007bff",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "14px",
                flexShrink: 0
              }}
            >
              {idx + 1}
            </div>
            <input
              type="text"
              disabled={disabled}
              value={String(value?.[idx] ?? "")}
              onChange={(e) => handleInputChange(idx, e.target.value)}
              placeholder={`Введите ответ ${idx + 1}...`}
              autoComplete="off"
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: "16px",
                fontWeight: 900, // Максимально жирный шрифт для читаемости
                color: "#000",   // Чисто черный цвет
                padding: "4px 0",
              }}
            />
          </div>
        ))}
      </div>
      <div 
        className="fill-input-count" 
        style={{ 
          marginTop: "4px", 
          fontSize: "13px", 
          fontWeight: 600, 
          color: "#64748b" 
        }}
      >
        Количество ответов: {answersCount}
      </div>
    </div>
  );
}