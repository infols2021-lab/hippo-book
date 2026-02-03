"use client";

import { useEffect, useMemo, useState } from "react";
import type { CrosswordQuestion } from "../types";
import GridEditor from "./GridEditor";
import WordsEditor from "./WordsEditor";

type Props = {
  value: CrosswordQuestion;
  onChange: (next: CrosswordQuestion) => void;
  disabled?: boolean;
};

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function ensureGrid(rows: number, cols: number, prev?: unknown): string[][] {
  const old = Array.isArray(prev) ? (prev as any[]) : [];
  const out: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const rowOld = Array.isArray(old[r]) ? (old[r] as any[]) : [];
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(typeof rowOld[c] === "string" ? rowOld[c] : "");
    }
    out.push(row);
  }
  return out;
}

function keyRC(r: number, c: number) {
  return `${r},${c}`;
}

function calcStats(q: CrosswordQuestion) {
  const rows = q.metadata.rows;
  const cols = q.metadata.cols;
  const grid = ensureGrid(rows, cols, q.grid);
  const blocks = Array.isArray(q.blocks) ? q.blocks : [];

  const blockedSet = new Set(blocks.map((b) => keyRC(b.row, b.col)));

  let blocked = 0;
  let filled = 0;
  let empty = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (blockedSet.has(keyRC(r, c))) {
        blocked++;
        continue;
      }
      const v = grid[r]?.[c] ?? "";
      if (String(v).trim()) filled++;
      else empty++;
    }
  }

  const total = rows * cols;
  const pct = (x: number) => (total ? Math.round((x / total) * 100) : 0);

  return {
    rows,
    cols,
    blocked,
    filled,
    empty,
    blockedPct: pct(blocked),
    filledPct: pct(filled),
    emptyPct: pct(empty),
  };
}

export default function CrosswordEditor({ value, onChange, disabled }: Props) {
  const rows = clampInt(value?.metadata?.rows ?? 15, 5, 40);
  const cols = clampInt(value?.metadata?.cols ?? 15, 5, 40);

  const blocks = Array.isArray(value.blocks) ? value.blocks : [];
  const words = Array.isArray(value.words) ? value.words : [];
  const cellNumbers = value.cellNumbers && typeof value.cellNumbers === "object" ? value.cellNumbers : {};
  const grid = useMemo(() => ensureGrid(rows, cols, value.grid), [rows, cols, value.grid]);

  const [rowsText, setRowsText] = useState(String(rows));
  const [colsText, setColsText] = useState(String(cols));

  useEffect(() => setRowsText(String(rows)), [rows]);
  useEffect(() => setColsText(String(cols)), [cols]);

  function patch(p: Partial<CrosswordQuestion>) {
    onChange({
      ...(value as any),
      blocks,
      words,
      cellNumbers,
      grid,
      metadata: {
        ...(value.metadata as any),
        rows,
        cols,
      },
      ...(p as any),
    });
  }

  function applySize() {
    if (disabled) return;

    const r = clampInt(Number(rowsText || rows), 5, 40);
    const c = clampInt(Number(colsText || cols), 5, 40);

    const nextGrid = ensureGrid(r, c, grid);

    patch({
      grid: nextGrid,
      metadata: {
        ...(value.metadata || ({} as any)),
        rows: r,
        cols: c,
      },
    } as any);
  }

  function clearAll() {
    if (disabled) return;
    const ok = confirm("Очистить сетку? Удалятся буквы, слова, блоки и номера.");
    if (!ok) return;

    const nextGrid = ensureGrid(rows, cols, undefined);

    patch({
      grid: nextGrid,
      words: [],
      blocks: [],
      cellNumbers: {},
      metadata: {
        ...(value.metadata || ({} as any)),
        rows,
        cols,
        placingWord: null,
        deleteMode: false,
      },
    } as any);
  }

  const stats = useMemo(
    () =>
      calcStats({
        ...(value as any),
        grid,
        blocks,
        words,
        cellNumbers,
        metadata: { ...value.metadata, rows, cols },
      }),
    [value, grid, blocks, words, cellNumbers, rows, cols]
  );

  return (
    <div>
      <div className="card" style={{ padding: 14, background: "rgba(110, 226, 210, 0.12)" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>🧩 Конструктор кроссворда</div>

        <div className="small-muted" style={{ lineHeight: 1.45 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Режим работы:</div>
          <ul style={{ margin: "0 0 10px 18px" }}>
            <li>Размещение слов: введи слово, направление и номер → “Разместить слово” → кликни стартовую клетку</li>
            <li>Блокировка клеток: двойной клик по клетке (чёрная клетка)</li>
            <li>Удаление слов: “Удалить слово” → клик по слову (режим выключится сам)</li>
          </ul>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>📝 Управление словами</div>
        <WordsEditor value={{ ...(value as any), grid, blocks, words, cellNumbers, metadata: { ...value.metadata, rows, cols } }} onChange={onChange} disabled={disabled} />
      </div>

      <div style={{ height: 12 }} />

      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <div>
            <label className="small-muted">Количество строк:</label>
            <input
              className="input"
              inputMode="numeric"
              value={rowsText}
              disabled={disabled}
              onChange={(e) => setRowsText(e.target.value.replace(/[^\d]/g, ""))}
              onBlur={() => setRowsText(String(clampInt(Number(rowsText || rows), 5, 40)))}
            />
          </div>

          <div>
            <label className="small-muted">Количество столбцов:</label>
            <input
              className="input"
              inputMode="numeric"
              value={colsText}
              disabled={disabled}
              onChange={(e) => setColsText(e.target.value.replace(/[^\d]/g, ""))}
              onBlur={() => setColsText(String(clampInt(Number(colsText || cols), 5, 40)))}
            />
          </div>

          <button className="btn" type="button" onClick={applySize} disabled={disabled}>
            Создать сетку
          </button>
        </div>

        <div style={{ height: 10 }} />

        <button className="btn secondary" type="button" onClick={clearAll} disabled={disabled}>
          🗑️ Очистить сетку
        </button>

        <div style={{ height: 14 }} />

        <div style={{ fontWeight: 800, marginBottom: 8 }}>Сетка кроссворда (для администратора):</div>

        <GridEditor value={{ ...(value as any), grid, blocks, words, cellNumbers, metadata: { ...value.metadata, rows, cols } }} onChange={onChange} disabled={disabled} />

        <div style={{ height: 14 }} />

        <div className="small-muted" style={{ lineHeight: 1.6 }}>
          <div>
            Размер: <b>{stats.rows}×{stats.cols}</b>
          </div>
          <div>
            Заблокировано: <b>{stats.blocked}</b> ({stats.blockedPct}%)
          </div>
          <div>
            Заполнено: <b>{stats.filled}</b> ({stats.filledPct}%)
          </div>
          <div>
            Пустых: <b>{stats.empty}</b> ({stats.emptyPct}%)
          </div>
        </div>
      </div>
    </div>
  );
}
