"use client";

import React from "react";
import type { QuestionSentence } from "../lib/types";

type Props = {
  question: QuestionSentence;
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
};

export default function QuestionSentence({
  question,
  value = [],
  onChange,
  disabled,
}: Props) {
  const sentence = question.sentence || "";
  // разбиваем по маркеру ___ и сохраняем пустые строки для корректного отображения
  const parts = sentence.split("___");
  const gapsCount = parts.length - 1;

  const handleInputChange = (index: number, text: string) => {
    if (disabled) return;
    const next = [...(Array.isArray(value) ? value : [])];
    // гарантируем, что массив имеет нужную длину
    while (next.length < gapsCount) next.push("");
    next[index] = text;
    onChange(next);
  };

  if (!sentence) {
    return (
      <div
        style={{
          padding: "16px",
          background: "#fff5f5",
          color: "#c62828",
          borderRadius: "12px",
          border: "1px solid #ffcdd2",
          fontSize: "14px",
          fontWeight: 600,
        }}
      >
        Ошибка: текст предложения не задан.
      </div>
    );
  }

  return (
    <div
      className="sentence-container"
      style={{
        background: "#ffffff",
        borderRadius: "16px",
        padding: "20px",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
        lineHeight: "2.4",
      }}
    >
      <div
        style={{
          display: "inline",
          wordBreak: "break-word",
        }}
      >
        {parts.map((part, idx) => (
          <React.Fragment key={idx}>
            <span
              style={{
                whiteSpace: "pre-wrap",
                fontSize: "16px",
                fontWeight: 500,
                color: "#1e293b",
              }}
            >
              {part}
            </span>
            {idx < gapsCount && (
              <span
                style={{
                  display: "inline-block",
                  margin: "0 6px",
                  verticalAlign: "middle",
                }}
              >
                <input
                  type="text"
                  disabled={disabled}
                  value={String(value?.[idx] ?? "")}
                  onChange={(e) => handleInputChange(idx, e.target.value)}
                  placeholder={`[${idx + 1}]`}
                  autoComplete="off"
                  style={{
                    width: "130px",
                    padding: "6px 10px",
                    fontSize: "16px",
                    fontWeight: 900, // Максимально жирный шрифт для ответа
                    textAlign: "center",
                    border: "none",
                    borderBottom: "3px solid #cbd5e1",
                    borderRadius: "4px 4px 0 0",
                    background: disabled ? "#f1f5f9" : "#ffffff",
                    color: disabled ? "#94a3b8" : "#000", // Черный цвет для ответа
                    outline: "none",
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                    boxShadow: "none",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderBottomColor = "#6366f1";
                    e.target.style.boxShadow = "0 2px 0 0 #6366f1";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderBottomColor = "#cbd5e1";
                    e.target.style.boxShadow = "none";
                  }}
                />
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}