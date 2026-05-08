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
    <div className="fill-container">
      <div className="fill-inputs-container">
        {(question.answers || []).map((_, idx) => (
          <div className="fill-input-item" key={idx}>
            <div className="fill-input-number">{idx + 1}</div>
            <input
              type="text"
              disabled={disabled}
              value={String(value?.[idx] ?? "")}
              onChange={(e) => handleInputChange(idx, e.target.value)}
              placeholder={`Введите ответ ${idx + 1}...`}
              autoComplete="off"
            />
          </div>
        ))}
      </div>
      <div className="fill-input-count" style={{ marginTop: "8px", fontSize: "12px", opacity: 0.6 }}>
        Количество ответов: {answersCount}
      </div>
    </div>
  );
}