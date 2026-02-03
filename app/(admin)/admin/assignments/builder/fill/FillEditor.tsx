"use client";

import { useEffect, useState } from "react";
import type { FillQuestion } from "../types";

type Props = {
  value: FillQuestion;
  onChange: (next: FillQuestion) => void;
  disabled?: boolean;
};

function normalizeAnswers(raw: unknown): string[][] {
  if (!Array.isArray(raw)) return [[""]];
  const res = raw.map((g) => (Array.isArray(g) ? g.map(String) : [String(g ?? "")]));
  return res.length ? res : [[""]];
}

function answersToRawLines(ans: string[][]): string[] {
  return (ans.length ? ans : [[""]]).map((g) => {
    const cleaned = Array.isArray(g) ? g.map((x) => String(x ?? "")).filter((x) => x !== "") : [];
    return cleaned.join("; ");
  });
}

function parseRawLine(line: string): string[] {
  const parts = String(line ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length ? parts : [""];
}

export default function FillEditor({ value, onChange, disabled }: Props) {
  const answers = normalizeAnswers(value.answers);

  // raw-строки для инпутов (не ломают пробелы/курсор)
  const [rawLines, setRawLines] = useState<string[]>(() => answersToRawLines(answers));

  useEffect(() => {
    setRawLines(answersToRawLines(normalizeAnswers(value.answers)));
  }, [value.id]); // при смене вопроса

  function patchAnswers(nextRawLines: string[]) {
    setRawLines(nextRawLines);

    const parsed = nextRawLines.map(parseRawLine);
    onChange({ ...value, answers: parsed });
  }

  return (
    <div>
      <div className="form-group">
        <label>Правильные ответы:</label>

        <div className="fill-inputs-container">
          {rawLines.map((line, idx) => (
            <div key={idx} className="fill-input-item">
              <div className="fill-input-number">{idx + 1}</div>

              <input
                className="input"
                type="text"
                disabled={disabled}
                value={line}
                placeholder="Варианты ответа через ; (например: ежик;кошка)"
                onChange={(e) => {
                  const next = rawLines.slice();
                  next[idx] = e.target.value; // как есть
                  patchAnswers(next);
                }}
              />

              <button
                type="button"
                className="remove-input-btn"
                disabled={disabled || rawLines.length <= 1}
                onClick={() => {
                  const next = rawLines.slice();
                  next.splice(idx, 1);
                  patchAnswers(next.length ? next : [""]);
                }}
                title="Удалить ответ"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="add-input-btn"
          disabled={disabled}
          onClick={() => patchAnswers([...rawLines, ""])}
          style={{ marginTop: 8 }}
        >
          ➕ Добавить ответ
        </button>

        <div className="input-count" style={{ marginTop: 6 }}>
          Количество ответов: {rawLines.length}
        </div>

        <div className="small-muted" style={{ marginTop: 6 }}>
          Можно вводить несколько вариантов через <b>;</b> и с пробелами — всё сохранится нормально.
        </div>
      </div>
    </div>
  );
}
