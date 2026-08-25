"use client";

import React from "react";
import type { QuestionFill } from "@/lib/assignments/types";
import { isVariantMatch } from "@/lib/assignments/scoring";

type Props = {
  question: QuestionFill;
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
};

// Функция для безопасного извлечения текста ответа (из строк или объектов)
function extractCorrectValue(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
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
  // ИЩЕМ ОТВЕТЫ ВЕЗДЕ: поддержка старых версий (correct) и новых (answers)
  const rawAnswers: any[] = (Array.isArray(question.answers) && question.answers.length > 0)
    ? question.answers
    : (Array.isArray((question as any).correct) ? (question as any).correct : []);

  const answersCount = rawAnswers.length;

  const handleInputChange = (index: number, text: string) => {
    if (disabled) return;
    const next = [...(Array.isArray(value) ? value : [])];
    // Заполняем массив до нужной длины, если он пустой
    while (next.length < answersCount) next.push("");
    next[index] = text;
    onChange(next);
  };

  if (answersCount === 0) {
    return (
      <div style={{ color: "#64748b", fontWeight: 600, padding: "16px", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
        ⚠️ Нет пропусков для заполнения
      </div>
    );
  }

  return (
    <div className="fill-container" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div className="fill-inputs-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {rawAnswers.map((_: any, idx: number) => {
          const uAns = String(value?.[idx] ?? "").trim();
          const variants = rawAnswers[idx];
          const isCorrect = uAns.length > 0 && isVariantMatch(uAns, variants);
          
          // Формируем красивую строку эталонного ответа
          const cAns = (() => {
            if (!variants) return "Ответ не найден";
            const vArr = Array.isArray(variants) ? variants : [variants];
            return vArr.map(extractCorrectValue).filter(Boolean).join(" или ");
          })();

          // Настраиваем цвета в зависимости от режима (disabled)
          let borderColor = "#e2e8f0";
          let bgColor = "#f8fafc";
          let textColor = "#0f172a";
          let badgeBg = disabled ? "#94a3b8" : "#0ea5e9"; // Синий в активном режиме, серый по дефолту в disabled

          if (disabled) {
            if (uAns) {
              borderColor = isCorrect ? "#10b981" : "#ef4444";
              bgColor = isCorrect ? "#f0fdf4" : "#fef2f2";
              textColor = isCorrect ? "#166534" : "#991b1b";
              badgeBg = isCorrect ? "#10b981" : "#ef4444";
            } else {
              // Если пользователь ничего не ввел
              borderColor = "#cbd5e1";
              bgColor = "#f1f5f9";
              textColor = "#64748b";
            }
          }

          return (
            <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div 
                className="fill-input-wrapper" 
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  background: bgColor,
                  padding: "12px 20px",
                  borderRadius: "16px",
                  border: `2px solid ${borderColor}`,
                  transition: "all 0.2s ease",
                  boxShadow: !disabled ? "inset 0 2px 4px rgba(0,0,0,0.02)" : "none",
                }}
              >
                <div 
                  className="fill-input-badge"
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: badgeBg,
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: "15px",
                    flexShrink: 0,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
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
                    fontSize: "17px",
                    fontWeight: 900,
                    color: textColor,
                    padding: "6px 0",
                    width: "100%",
                  }}
                />

                {/* Галочка или крестик для пользователя */}
                {disabled && uAns && (
                  <div style={{ 
                    fontWeight: "black", 
                    color: isCorrect ? "#10b981" : "#ef4444", 
                    fontSize: "22px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    {isCorrect ? "✓" : "✗"}
                  </div>
                )}
              </div>
              
              {/* === ПРАВИЛЬНЫЙ ОТВЕТ (ПОКАЗЫВАЕТСЯ ТОЛЬКО ПРИ РАЗБОРЕ/ПЕСОЧНИЦЕ) === */}
              {disabled && (
                <div style={{ 
                  paddingLeft: "72px", 
                  fontSize: "14px", 
                  fontWeight: 800, 
                  color: isCorrect ? "#10b981" : "#64748b",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  {!isCorrect && <span style={{ fontSize: "16px" }}>💡</span>}
                  <span>Правильный ответ:</span>
                  <span style={{ color: "#0f172a", background: "#e2e8f0", padding: "3px 10px", borderRadius: "8px" }}>
                    {cAns}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ 
        marginTop: "4px", 
        fontSize: "13px", 
        fontWeight: 700, 
        color: "#94a3b8",
        textAlign: "right"
      }}>
        Всего пропусков: {answersCount}
      </div>
    </div>
  );
}