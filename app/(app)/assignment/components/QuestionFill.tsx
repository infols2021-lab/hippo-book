"use client";

import React from "react";
import type { QuestionFill } from "../lib/types";

type Props = {
  question: QuestionFill;
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
};

// Функция для безопасного извлечения текста ответа (на случай, если из базы пришел объект)
function extractCorrectValue(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("text" in v && v.text) return String(v.text);
    if ("value" in v && v.value) return String(v.value);
    if ("answer" in v && v.answer) return String(v.answer);
    if ("label" in v && v.label) return String(v.label);
    if ("word" in v && v.word) return String(v.word);
    if ("correct" in v && v.correct) return String(v.correct);
    return JSON.stringify(v);
  }
  return String(v);
}

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

  // Вытаскиваем правильный ответ для конкретного поля
  const getCorrectString = (index: number) => {
    const variants = question.answers?.[index];
    if (!variants) return "";
    const vArr = Array.isArray(variants) ? variants : [variants];
    return vArr.map(extractCorrectValue).filter(Boolean).join(" или ");
  };

  return (
    <div className="fill-container" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div className="fill-inputs-container" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {(question.answers || []).map((_, idx) => {
          const uAns = String(value?.[idx] ?? "").trim();
          const cAns = getCorrectString(idx);
          
          // Проверка правильности: разбиваем правильные ответы по " или " и ищем точное совпадение (без учета регистра)
          const validOptions = cAns.toLowerCase().split(" или ");
          const isCorrect = uAns.length > 0 && validOptions.includes(uAns.toLowerCase());

          return (
            <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div 
                className="fill-input-item" 
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  // Если disabled, красим фон в зависимости от правильности
                  background: disabled ? (uAns ? (isCorrect ? "#f0fdf4" : "#fef2f2") : "#f8fafc") : "#f8fafc",
                  padding: "12px 16px",
                  borderRadius: "16px",
                  borderStyle: "solid",
                  borderWidth: disabled ? "2px" : "1px",
                  borderColor: disabled ? (uAns ? (isCorrect ? "#10b981" : "#ef4444") : "#e2e8f0") : "#e2e8f0",
                  opacity: 1,
                }}
              >
                <div 
                  className="fill-input-number"
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: disabled ? (uAns ? (isCorrect ? "#10b981" : "#ef4444") : "#94a3b8") : "#007bff",
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
                  value={uAns}
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
                    color: disabled ? (uAns ? (isCorrect ? "#166534" : "#991b1b") : "#000") : "#000",
                    padding: "4px 0",
                  }}
                />
                {/* Галочка или крестик для пользователя */}
                {disabled && uAns && (
                  <div style={{ fontWeight: "bold", color: isCorrect ? "#10b981" : "#ef4444", fontSize: "16px" }}>
                    {isCorrect ? "✓" : "✗"}
                  </div>
                )}
              </div>
              
              {/* === ПРАВИЛЬНЫЙ ОТВЕТ (ПОКАЗЫВАЕТСЯ ТОЛЬКО ПРИ DISABLED ИЛИ В РАЗБОРЕ) === */}
              {disabled && (
                <div style={{ paddingLeft: "56px", fontSize: "15px", fontWeight: 900, color: "#10b981" }}>
                  Правильный ответ: {cAns}
                </div>
              )}
            </div>
          );
        })}
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