"use client";

import { useEffect, useState } from "react";
import type { TestQuestion } from "../types";

type Props = {
  value: TestQuestion;
  onChange: (next: TestQuestion) => void;
  disabled?: boolean;
};

function optionsToRaw(options: unknown): string {
  const arr = Array.isArray(options) ? options.map((x) => String(x ?? "")) : [];
  // если всё пустое — пусть будет "", чтобы placeholder работал
  const hasAny = arr.some((s) => s.trim().length > 0);
  return hasAny ? arr.join("\n") : "";
}

export default function TestEditor({ value, onChange, disabled }: Props) {
  const [raw, setRaw] = useState<string>(() => optionsToRaw(value.options));

  useEffect(() => {
    setRaw(optionsToRaw(value.options));
  }, [value.id]); // только при смене вопроса

  const correct = typeof value.correct === "number" ? value.correct : 0;

  function patch(p: Partial<TestQuestion>) {
    onChange({ ...value, ...p });
  }

  return (
    <div>
      <div className="form-group">
        <label>Варианты ответов (каждый с новой строки):</label>
        <textarea
          className="input"
          rows={4}
          value={raw}
          disabled={disabled}
          placeholder={"Вариант 1\nВариант 2\nВариант 3"}
          onChange={(e) => {
            const nextRaw = e.target.value;
            setRaw(nextRaw);
            // сохраняем строками как есть (без trim/filter) — чтобы ввод не ломался
            patch({ options: nextRaw.split("\n") });
          }}
        />
      </div>

      <div className="form-group">
        <label>Правильный ответ (номер варианта, начиная с 1):</label>
        <input
          className="input"
          type="number"
          min={1}
          max={Math.max(1, (value.options ?? []).length)}
          value={Math.max(1, correct + 1)}
          disabled={disabled}
          onChange={(e) => {
            const n = Number(e.target.value);
            const idx = Number.isFinite(n) ? Math.max(1, n) - 1 : 0;
            patch({ correct: idx });
          }}
        />
      </div>
    </div>
  );
}
