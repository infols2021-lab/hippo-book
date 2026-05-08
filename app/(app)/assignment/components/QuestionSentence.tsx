"use client";

import React from "react";
import type { QuestionSentence } from "../lib/types";

type Props = {
  question: QuestionSentence;
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
};

export default function QuestionSentence({ question, value = [], onChange, disabled }: Props) {
  const sentence = question.sentence || "";
  const parts = sentence.split("___");
  const gapsCount = parts.length - 1;

  const handleInputChange = (index: number, text: string) => {
    if (disabled) return;
    const next = [...(Array.isArray(value) ? value : [])];
    while (next.length < gapsCount) next.push("");
    next[index] = text;
    onChange(next);
  };

  if (!sentence) {
    return <div style={{ color: "red" }}>Ошибка: Текст предложения не задан</div>;
  }

  return (
    <div className="sentence-container">
      <div className="sentence-text" style={{ lineHeight: "2.2" }}>
        {parts.map((part, idx) => (
          <React.Fragment key={idx}>
            <span style={{ whiteSpace: "pre-line" }}>{part}</span>
            {idx < gapsCount && (
              <span className="sentence-gap" style={{ display: "inline-block", margin: "0 4px" }}>
                <input
                  className="sentence-input"
                  type="text"
                  disabled={disabled}
                  value={String(value?.[idx] ?? "")}
                  onChange={(e) => handleInputChange(idx, e.target.value)}
                  placeholder={`(${idx + 1})`}
                  autoComplete="off"
                  style={{
                    width: "140px",
                    textAlign: "center",
                    borderBottom: "2px solid #007bff",
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