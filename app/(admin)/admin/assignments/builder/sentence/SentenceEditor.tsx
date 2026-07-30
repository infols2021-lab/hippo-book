"use client";

import { useEffect, useMemo, useState } from "react";
import type { SentenceQuestion } from "../types";

type Props = {
  value: SentenceQuestion;
  onChange: (next: SentenceQuestion) => void;
  disabled?: boolean;
};

function countBlanks(text: string): number {
  if (!text) return 0;
  return (text.match(/___/g) || []).length;
}

function normalizeAnswers(raw: unknown, blanks: number): string[][] {
  const base: string[][] = Array.isArray(raw)
    ? raw.map((g) => (Array.isArray(g) ? g.map(String) : [String(g ?? "")]))
    : [];

  const res = base.slice(0, blanks);
  while (res.length < blanks) res.push([""]);
  return res;
}

function answersToRawLines(ans: string[][]): string[] {
  return ans.map((g) => {
    const cleaned = Array.isArray(g)
      ? g.map((x) => String(x ?? "")).filter((x) => x !== "")
      : [];
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

export default function SentenceEditor({ value, onChange, disabled }: Props) {
  const sentence = typeof value.sentence === "string" ? value.sentence : "";
  const blanks = useMemo(() => countBlanks(sentence), [sentence]);

  const [rawLines, setRawLines] = useState<string[]>(() => {
    const normalized = normalizeAnswers(value.answers, blanks);
    return answersToRawLines(normalized);
  });

  // При смене выбранного вопроса — инициализируем строки ответов заново
  useEffect(() => {
    const normalized = normalizeAnswers(value.answers, blanks);
    setRawLines(answersToRawLines(normalized));
  }, [value.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // При изменении количества пропусков (добавление/удаление ___ в предложении)
  useEffect(() => {
    setRawLines((prev) => {
      if (prev.length === blanks) return prev;
      const next = prev.slice(0, blanks);
      while (next.length < blanks) next.push("");
      return next;
    });
  }, [blanks]);

  function patch(p: Partial<SentenceQuestion>) {
    onChange({ ...value, ...p });
  }

  function patchAnswerLines(nextRaw: string[]) {
    setRawLines(nextRaw);
    const parsed = nextRaw.map(parseRawLine);
    patch({ answers: parsed });
  }

  function handleSentenceChange(newSentence: string) {
    const newBlanks = countBlanks(newSentence);
    const updatedRawLines = rawLines.slice(0, newBlanks);
    while (updatedRawLines.length < newBlanks) {
      updatedRawLines.push("");
    }

    setRawLines(updatedRawLines);
    onChange({
      ...value,
      sentence: newSentence,
      answers: updatedRawLines.map(parseRawLine),
    });
  }

  return (
    <div>
      <div className="form-group">
        <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>
          Предложение (используй ___ для пропусков):
        </label>
        <textarea
          className="input"
          rows={4}
          disabled={disabled}
          placeholder="I ___ to school every ___ ."
          value={sentence}
          onChange={(e) => handleSentenceChange(e.target.value)}
        />

        <div className="small-muted" style={{ marginTop: 6 }}>
          Количество пропусков: <b>{blanks}</b>
        </div>
      </div>

      {/* Предпросмотр */}
      <div className="form-group">
        <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>
          Предпросмотр:
        </label>
        <div className="sentence-preview">
          {sentence.split("___").map((part, idx) => (
            <span key={idx}>
              {part}
              {idx < blanks && (
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    margin: "0 6px",
                    borderRadius: 8,
                    background: "rgba(78,205,196,0.14)",
                    border: "1px solid rgba(78,205,196,0.35)",
                    fontWeight: 800,
                  }}
                >
                  [{idx + 1}]
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>
          Ответы для пропусков:
        </label>

        {blanks === 0 ? (
          <div className="small-muted">Добавь хотя бы один ___ в предложение</div>
        ) : (
          <div className="sentence-answers" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rawLines.map((line, idx) => (
              <div key={idx} className="fill-input-item">
                <div className="fill-input-number">{idx + 1}</div>

                <input
                  className="input"
                  type="text"
                  disabled={disabled}
                  placeholder="Варианты через ; (например: go;went)"
                  value={line}
                  onChange={(e) => {
                    const next = rawLines.slice();
                    next[idx] = e.target.value;
                    patchAnswerLines(next);
                  }}
                />
              </div>
            ))}
          </div>
        )}

        <div className="small-muted" style={{ marginTop: 6 }}>
          Несколько вариантов разделяй через <b>;</b>. Пробелы можно — всё сохранится корректно.
        </div>
      </div>
    </div>
  );
}