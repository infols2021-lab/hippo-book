"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CWWord, CrosswordQuestion, WordDir } from "../types";

type Props = {
  value: CrosswordQuestion;
  onChange: (next: CrosswordQuestion) => void;
  disabled?: boolean;
};

function normWord(s: string) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function getNextAutoNumber(words: CWWord[]) {
  const maxN = words.reduce((m, w) => Math.max(m, Number(w.number) || 0), 0);
  return clampInt(maxN + 1, 1, 999);
}

export default function WordsEditor({ value, onChange, disabled }: Props) {
  const words: CWWord[] = Array.isArray(value.words) ? value.words : [];

  const [text, setText] = useState("");
  const [dir, setDir] = useState<WordDir>("across");

  const autoNum = useMemo(() => getNextAutoNumber(words), [words]);
  const [numText, setNumText] = useState(String(autoNum));

  const lastAutoRef = useRef<number>(autoNum);

  useEffect(() => {
    const cur = Number(numText || 0);
    const lastAuto = lastAutoRef.current;

    const shouldAutofill = !numText || cur === lastAuto;
    if (shouldAutofill) {
      setNumText(String(autoNum));
      lastAutoRef.current = autoNum;
    } else {
      lastAutoRef.current = autoNum;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoNum]);

  const placing = useMemo(() => {
    const w = normWord(text);
    const n = clampInt(Number(numText || autoNum), 1, 999);
    return { w, n, dir };
  }, [text, numText, dir, autoNum]);

  function patch(p: Partial<CrosswordQuestion>) {
    onChange({ ...(value as any), ...(p as any) });
  }

  function startPlacing() {
    if (disabled) return;

    const w = placing.w;
    if (!w) return alert("Введите слово");
    if (w.length < 2) return alert("Слишком короткое слово");

    const exists = words.some((x) => x.number === placing.n && x.direction === placing.dir);
    if (exists) {
      alert("Слово с таким номером и направлением уже есть. Удали его или выбери другой номер.");
      return;
    }

    patch({
      metadata: {
        ...(value.metadata || ({} as any)),
        placingWord: { text: w, direction: placing.dir, number: placing.n },
        deleteMode: false,
      },
    } as any);
  }

  function toggleDeleteMode() {
    if (disabled) return;
    const cur = Boolean((value?.metadata as any)?.deleteMode);
    patch({
      metadata: {
        ...(value.metadata || ({} as any)),
        deleteMode: !cur,
        placingWord: null,
      },
    } as any);
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 200px 140px auto auto",
          gap: 10,
          alignItems: "end",
        }}
      >
        <div>
          <label className="small-muted">Новое слово:</label>
          <input
            className="input"
            value={text}
            disabled={disabled}
            placeholder="ВВЕДИТЕ СЛОВО"
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <div>
          <label className="small-muted">Направление:</label>
          <select
            className="input"
            value={dir}
            disabled={disabled}
            onChange={(e) => setDir(e.target.value === "down" ? "down" : "across")}
          >
            <option value="across">→ По горизонтали</option>
            <option value="down">↓ По вертикали</option>
          </select>
        </div>

        <div>
          <label className="small-muted">Номер слова:</label>
          <input
            className="input"
            inputMode="numeric"
            value={numText}
            disabled={disabled}
            onChange={(e) => setNumText(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={() => {
              const next = clampInt(Number(numText || autoNum), 1, 999);
              setNumText(String(next));
            }}
          />
        </div>

        <button className="btn" type="button" onClick={startPlacing} disabled={disabled}>
          Разместить слово
        </button>

        <button
          className={`btn ${(value?.metadata as any)?.deleteMode ? "" : "btn-danger"}`}
          type="button"
          onClick={toggleDeleteMode}
          disabled={disabled}
          title="Режим удаления: клик по слову на сетке"
        >
          🗑️ Удалить слово
        </button>
      </div>

      <div style={{ height: 10 }} />

      <div className="small-muted">
        Размещённые слова: <b>{words.length}</b>{" "}
        {(value?.metadata as any)?.placingWord ? (
          <>
            · Режим: <b>размещение</b>
          </>
        ) : (value?.metadata as any)?.deleteMode ? (
          <>
            · Режим: <b>удаление</b>
          </>
        ) : null}
      </div>
    </div>
  );
}