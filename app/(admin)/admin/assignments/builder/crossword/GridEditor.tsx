"use client";

import { useMemo, useRef, useState } from "react";
import type { CWBlock, CWWord, CrosswordQuestion, WordDir } from "../types";

type Props = {
  value: CrosswordQuestion;
  onChange: (next: CrosswordQuestion) => void;
  disabled?: boolean;
};

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function keyRC(r: number, c: number) {
  return `${r},${c}`;
}

function ensureGrid(rows: number, cols: number, prev?: unknown): string[][] {
  const old = Array.isArray(prev) ? (prev as any[]) : [];
  const out: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const rowOld = Array.isArray(old[r]) ? (old[r] as any[]) : [];
    const row: string[] = [];
    for (let c = 0; c < cols; c++) row.push(typeof rowOld[c] === "string" ? rowOld[c] : "");
    out.push(row);
  }
  return out;
}

function isBlocked(blocks: CWBlock[], r: number, c: number) {
  return blocks.some((b) => b.row === r && b.col === c);
}

function rebuildGridFromWords(rows: number, cols: number, blocks: CWBlock[], words: CWWord[]) {
  const grid = ensureGrid(rows, cols, undefined);
  const blocked = new Set(blocks.map((b) => keyRC(b.row, b.col)));

  for (const w of words) {
    const text = String(w.text || "").toUpperCase();
    const dr = w.direction === "down" ? 1 : 0;
    const dc = w.direction === "across" ? 1 : 0;

    for (let i = 0; i < w.length; i++) {
      const r = w.start.row + dr * i;
      const c = w.start.col + dc * i;
      if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
      if (blocked.has(keyRC(r, c))) continue;
      grid[r][c] = text[i] ?? "";
    }
  }

  return grid;
}

function wordsAtCell(words: CWWord[], r: number, c: number) {
  const res: CWWord[] = [];
  for (const w of words) {
    const dr = w.direction === "down" ? 1 : 0;
    const dc = w.direction === "across" ? 1 : 0;
    for (let i = 0; i < w.length; i++) {
      const rr = w.start.row + dr * i;
      const cc = w.start.col + dc * i;
      if (rr === r && cc === c) {
        res.push(w);
        break;
      }
    }
  }
  return res;
}

function cellsOfWord(w: CWWord) {
  const res: { row: number; col: number }[] = [];
  const dr = w.direction === "down" ? 1 : 0;
  const dc = w.direction === "across" ? 1 : 0;
  for (let i = 0; i < w.length; i++) {
    res.push({ row: w.start.row + dr * i, col: w.start.col + dc * i });
  }
  return res;
}

// ✅ если номер в клетке больше никем не используется — убираем
function cleanupCellNumbers(cellNumbers: Record<string, number>, words: CWWord[]) {
  const used = new Set<number>();
  for (const w of words) used.add(Number(w.number) || 0);

  const next: Record<string, number> = {};
  for (const k of Object.keys(cellNumbers || {})) {
    const n = Number((cellNumbers as any)[k] || 0);
    if (used.has(n)) next[k] = n;
  }
  return next;
}

function validatePlacement(
  grid: string[][],
  blocks: CWBlock[],
  word: { text: string; direction: WordDir; number: number },
  start: { row: number; col: number }
) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  const text = String(word.text || "").toUpperCase();
  const len = text.length;

  const dr = word.direction === "down" ? 1 : 0;
  const dc = word.direction === "across" ? 1 : 0;

  const endR = start.row + dr * (len - 1);
  const endC = start.col + dc * (len - 1);
  if (endR < 0 || endC < 0 || endR >= rows || endC >= cols) {
    return { ok: false as const, error: "Слово не помещается в сетку" };
  }

  for (let i = 0; i < len; i++) {
    const r = start.row + dr * i;
    const c = start.col + dc * i;

    if (isBlocked(blocks, r, c)) return { ok: false as const, error: "В пути слова есть заблокированная клетка" };

    const existing = String(grid[r]?.[c] ?? "");
    const ch = text[i] ?? "";
    if (existing && existing !== ch) {
      return { ok: false as const, error: `Конфликт букв в клетке [${r},${c}] "${existing}" vs "${ch}"` };
    }
  }

  return { ok: true as const };
}

function makeWordId() {
  return crypto.randomUUID();
}

function isEditableTarget() {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (el.isContentEditable) return true;
  return false;
}

export default function GridEditor({ value, onChange, disabled }: Props) {
  const rows = clampInt(value?.metadata?.rows ?? 15, 5, 40);
  const cols = clampInt(value?.metadata?.cols ?? 15, 5, 40);

  const blocks: CWBlock[] = Array.isArray(value.blocks) ? value.blocks : [];
  const words: CWWord[] = Array.isArray(value.words) ? value.words : [];
  const cellNumbers = value.cellNumbers && typeof value.cellNumbers === "object" ? value.cellNumbers : {};

  const grid = useMemo(() => {
    const incoming = ensureGrid(rows, cols, value.grid);
    const hasAny = incoming.some((row) => row.some((c) => String(c || "").trim()));
    return hasAny ? incoming : rebuildGridFromWords(rows, cols, blocks, words);
  }, [rows, cols, value.grid, blocks, words]);

  const placing = value?.metadata?.placingWord ?? null;
  const deleteMode = Boolean(value?.metadata?.deleteMode);

  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [pick, setPick] = useState<{ row: number; col: number; items: CWWord[] } | null>(null);

  // ✅ эффекты подсветки клеток
  const [flash, setFlash] = useState<{
    kind: "place" | "remove";
    cells: string[];
    startKey?: string;
    token: number;
  } | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const flashTimer = useRef<number | null>(null);

  function patch(next: Partial<CrosswordQuestion>) {
    onChange({
      ...(value as any),
      metadata: { ...(value.metadata || ({} as any)), rows, cols },
      ...(next as any),
    });
  }

  function runFlash(kind: "place" | "remove", cells: { row: number; col: number }[], start?: { row: number; col: number }) {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    const token = Date.now();
    setFlash({
      kind,
      cells: cells.map((x) => keyRC(x.row, x.col)),
      startKey: start ? keyRC(start.row, start.col) : undefined,
      token,
    });
    flashTimer.current = window.setTimeout(() => {
      setFlash((f) => (f?.token === token ? null : f));
    }, 520);
  }

  function toggleBlock(r: number, c: number) {
    if (disabled) return;

    const exists = blocks.some((b) => b.row === r && b.col === c);
    const nextBlocks = exists ? blocks.filter((b) => !(b.row === r && b.col === c)) : [...blocks, { row: r, col: c }];

    // если блокируем клетку — удаляем слова, проходящие через неё
    const affected = new Set(wordsAtCell(words, r, c).map((w) => w.id));
    const nextWords = affected.size ? words.filter((w) => !affected.has(w.id)) : words;

    const nextGrid = rebuildGridFromWords(rows, cols, nextBlocks, nextWords);
    const nextNums = cleanupCellNumbers(cellNumbers as any, nextWords);

    patch({ blocks: nextBlocks, words: nextWords, grid: nextGrid, cellNumbers: nextNums } as any);
  }

  function placeWordAt(r: number, c: number) {
    if (disabled || !placing) return;

    const text = String(placing.text || "").toUpperCase();
    const dir = placing.direction;
    const number = clampInt(Number(placing.number || 1), 1, 999);

    const vr = validatePlacement(grid, blocks, { text, direction: dir, number }, { row: r, col: c });
    if (!vr.ok) {
      alert("❌ " + vr.error);
      return;
    }

    const newWord: CWWord = {
      id: makeWordId(),
      number,
      text,
      direction: dir,
      start: { row: r, col: c },
      length: text.length,
    };

    const nextWords = [...words, newWord];

    const startKey = keyRC(r, c);
    const nextNums = { ...(cellNumbers as any) };
    if (!nextNums[startKey]) nextNums[startKey] = number;

    const nextGrid = rebuildGridFromWords(rows, cols, blocks, nextWords);

    runFlash("place", cellsOfWord(newWord), { row: r, col: c });

    patch({
      words: nextWords,
      cellNumbers: nextNums,
      grid: nextGrid,
      metadata: { ...(value.metadata || ({} as any)), rows, cols, placingWord: null, deleteMode: false },
    } as any);
  }

  function removeWord(w: CWWord) {
    if (disabled) return;

    const affectedCells = cellsOfWord(w);

    const nextWords = words.filter((x) => x.id !== w.id);
    const nextGrid = rebuildGridFromWords(rows, cols, blocks, nextWords);

    const nextNums = cleanupCellNumbers(cellNumbers as any, nextWords);

    runFlash("remove", affectedCells, w.start);

    patch({
      words: nextWords,
      grid: nextGrid,
      cellNumbers: nextNums,
      metadata: { ...(value.metadata || ({} as any)), rows, cols, deleteMode: false, placingWord: null },
    } as any);
  }

  function handleCellClick(r: number, c: number, shiftKey: boolean) {
    if (disabled) return;

    if (shiftKey) {
      alert(`Координаты: [${r},${c}]`);
      return;
    }

    setSelected({ row: r, col: c });
    requestAnimationFrame(() => wrapRef.current?.focus());

    if (placing) {
      placeWordAt(r, c);
      return;
    }

    if (deleteMode) {
      const hits = wordsAtCell(words, r, c);
      if (hits.length === 0) return;

      if (hits.length === 1) {
        removeWord(hits[0]);
      } else {
        setPick({ row: r, col: c, items: hits });
      }
      return;
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (!selected) return;
    if (pick) return;
    if (isEditableTarget()) return;

    const { row, col } = selected;

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected({ row: Math.max(0, row - 1), col });
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected({ row: Math.min(rows - 1, row + 1), col });
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSelected({ row, col: Math.max(0, col - 1) });
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setSelected({ row, col: Math.min(cols - 1, col + 1) });
      return;
    }

    if (isBlocked(blocks, row, col)) return;

    if (e.key === "Backspace") {
      e.preventDefault();
      const next = grid.map((rr) => rr.slice());
      next[row][col] = "";
      patch({ grid: next } as any);
      return;
    }

    if (e.key.length === 1) {
      const ch = e.key.toUpperCase();
      if (!/^[A-ZА-ЯЁ]$/.test(ch)) return;

      e.preventDefault();
      const next = grid.map((rr) => rr.slice());
      next[row][col] = ch;
      patch({ grid: next } as any);

      if (col + 1 < cols) setSelected({ row, col: col + 1 });
    }
  }

  const blockedSet = useMemo(() => new Set(blocks.map((b) => keyRC(b.row, b.col))), [blocks]);

  // ✅ подсветка всего окна по режиму
  const modeTint =
    placing
      ? { background: "rgba(34, 197, 94, 0.06)", borderColor: "rgba(34, 197, 94, 0.18)" } // зелёный
      : deleteMode
      ? { background: "rgba(239, 68, 68, 0.06)", borderColor: "rgba(239, 68, 68, 0.18)" } // красный
      : { background: "transparent", borderColor: "rgba(0,0,0,0.08)" };

  return (
    <div
      style={{
        border: "1px solid",
        borderColor: modeTint.borderColor,
        background: modeTint.background,
        borderRadius: 16,
        padding: 10,
        transition: "background 140ms ease, border-color 140ms ease",
      }}
    >
      <div className="small-muted" style={{ marginBottom: 8 }}>
        {placing ? (
          <>
            Режим: <b>размещение</b> — кликни стартовую клетку для слова <b>{placing.text}</b>{" "}
            ({placing.direction === "across" ? "→" : "↓"} №{placing.number})
          </>
        ) : deleteMode ? (
          <>
            Режим: <b>удаление</b> — кликни по слову на сетке (после удаления режим выключится сам)
          </>
        ) : (
          <>Клик — выбрать клетку. Двойной клик — блок/разблок. Shift+Click — координаты.</>
        )}
      </div>

      <div
        ref={wrapRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        style={{
          outline: "none",
          overflowX: "auto",
          padding: 6,
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.08)",
          background: "rgba(0,0,0,0.02)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 28px)`,
            gap: 2,
            width: cols * 30,
          }}
        >
          {Array.from({ length: rows }).flatMap((_, r) =>
            Array.from({ length: cols }).map((__, c) => {
              const k = keyRC(r, c);
              const blocked = blockedSet.has(k);
              const sel = selected?.row === r && selected?.col === c;

              const letter = String(grid[r]?.[c] ?? "");
              const num = (value.cellNumbers && (value.cellNumbers as any)[k]) || undefined;

              const isFlashCell = flash?.cells.includes(k);
              const isFlashStart = flash?.startKey === k;

              const flashBg =
                !blocked && isFlashCell
                  ? flash?.kind === "place"
                    ? "rgba(110, 226, 210, 0.28)"
                    : "rgba(255, 90, 90, 0.20)"
                  : undefined;

              const boxShadow =
                !blocked && isFlashStart
                  ? flash?.kind === "place"
                    ? "0 0 0 3px rgba(110, 226, 210, 0.35)"
                    : "0 0 0 3px rgba(255, 90, 90, 0.25)"
                  : undefined;

              return (
                <div
                  key={k}
                  onClick={(e) => handleCellClick(r, c, (e as any).shiftKey)}
                  onDoubleClick={() => toggleBlock(r, c)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: sel ? "2px solid rgba(110, 226, 210, 0.95)" : "1px solid rgba(0,0,0,0.22)",
                    background: blocked ? "#111" : flashBg || "#fff",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    userSelect: "none",
                    cursor: disabled ? "not-allowed" : "pointer",
                    boxSizing: "border-box",
                    transition: "background 120ms ease, box-shadow 120ms ease, transform 120ms ease",
                    boxShadow,
                    transform: isFlashStart ? "scale(1.03)" : "scale(1)",
                  }}
                  title={`[${r},${c}]`}
                >
                  {!blocked && num ? (
                    <div style={{ position: "absolute", top: 1, left: 2, fontSize: 9, opacity: 0.75, fontWeight: 800 }}>
                      {num}
                    </div>
                  ) : null}

                  {!blocked ? <span style={{ fontSize: 14 }}>{letter}</span> : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      {pick ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 14,
          }}
          onClick={() => setPick(null)}
        >
          <div className="card" style={{ padding: 14, width: "100%", maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Выбери слово для удаления</div>
            <div className="small-muted" style={{ marginBottom: 10 }}>
              Клетка [{pick.row},{pick.col}] содержит несколько слов.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pick.items.map((w) => (
                <button
                  key={w.id}
                  className="btn"
                  type="button"
                  onClick={() => {
                    setPick(null);
                    removeWord(w);
                  }}
                >
                  #{w.number} {w.direction === "across" ? "→" : "↓"} {w.text}
                </button>
              ))}
            </div>

            <div style={{ height: 10 }} />
            <button className="btn secondary" type="button" onClick={() => setPick(null)}>
              Отмена
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
