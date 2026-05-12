"use client";

import type { QuestionType } from "./types";

type Props = {
  value: QuestionType;
  onChange: (t: QuestionType) => void;
  disabled?: boolean;
};

export default function QuestionTypeSwitch({ value, onChange, disabled }: Props) {
  const types: { t: QuestionType; label: string }[] = [
    { t: "test", label: "📝 Тест" },
    { t: "fill", label: "✍️ Вписать" },
    { t: "sentence", label: "📝 Предложение" },
    { t: "matching", label: "🔗 Сопоставление" },
    { t: "imagemap", label: "🗺 Карта" },
    { t: "complex", label: "📚 Комплексный" },
    { t: "crossword", label: "🧩 Кроссворд" },
  ];

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {types.map((x) => {
        const active = x.t === value;
        return (
          <button
            key={x.t}
            type="button"
            className={`btn small ${active ? "" : "ghost"}`}
            onClick={() => onChange(x.t)}
            disabled={disabled}
            style={{ opacity: disabled ? 0.6 : 1 }}
          >
            {x.label}
          </button>
        );
      })}
    </div>
  );
}