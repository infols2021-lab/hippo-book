"use client";

import React from "react";
import type { QuestionReading as QuestionReadingType, QuestionTest as QuestionTestType } from "../lib/types";
import MediaRenderer from "./MediaRenderer";
import QuestionTestComponent from "./QuestionTest";

type Props = {
  question: QuestionReadingType;
  value: any[]; // массив ответов на подвопросы
  onChange: (val: any[]) => void;
  disabled?: boolean;
};

export default function QuestionReading({
  question,
  value = [],
  onChange,
  disabled,
}: Props) {
  const subQuestions: QuestionTestType[] = Array.isArray(question.subQuestions)
    ? question.subQuestions
    : [];

  function handleSubChange(index: number, subVal: any) {
    if (disabled) return;
    const next = [...(Array.isArray(value) ? value : [])];
    while (next.length <= index) next.push(null);
    next[index] = subVal;
    onChange(next);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "32px",
      }}
    >
      {/* Текст и медиа берутся из самого вопроса (q и media), поэтому отдельный блок не нужен */}
      {subQuestions.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {subQuestions.map((sq, idx) => {
            const subValue = Array.isArray(value) ? value[idx] : undefined;

            return (
              <div
                key={sq.id || idx}
                style={{
                  background: "#ffffff",
                  border: "1px solid rgba(0,0,0,0.06)",
                  borderRadius: "16px",
                  padding: "16px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                }}
              >
                {/* Заголовок подвопроса */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "16px",
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      background: "#007bff",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "13px",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </div>
                  {sq.q && (
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 600,
                        color: "#1e293b",
                        lineHeight: 1.4,
                        flex: 1,
                      }}
                    >
                      {sq.q}
                    </div>
                  )}
                </div>

                {/* Тестовые варианты */}
                <QuestionTestComponent
                  question={sq}
                  value={subValue}
                  onChange={(v: any) => handleSubChange(idx, v)}
                  disabled={disabled}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}