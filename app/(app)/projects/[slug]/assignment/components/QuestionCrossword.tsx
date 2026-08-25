"use client";

import { useMemo, useRef, useState } from "react";
import { getImageUrl } from "@/lib/assignments/image";
import MediaRenderer from "./MediaRenderer";

type Dir = "across" | "down";

type Word = {
  number?: number;
  direction?: Dir;
  length?: number;
  text?: string;
  start?: { row: number; col: number };
};

type Props = {
  question: any;
  value: string[][] | undefined;
  disabled?: boolean;
  onChange: (grid: string[][]) => void;
  onOpenImage?: (src: string) => void;
};

// ============================================================================
// Read-only компонент для отображения сетки кроссворда (разбор)
// ============================================================================

export type CrosswordGridReadOnlyProps = {
  title?: string;
  grid: string[][];           // эталонная сетка (правильные буквы)
  userGrid?: string[][];      // сетка пользователя
  cellNumbers: Record<string, number>;
  blocks: { row: number; col: number }[];
  words: Word[];
  rows: number;
  cols: number;
  sizeClass?: string;
};

export function getCrosswordSizeClass(rows: number, cols: number): string {
  if (rows > 15 || cols > 15) return "size-large";
  if (rows > 12 || cols > 12) return "size-medium";
  if (rows > 8 || cols > 8) return "size-normal";
  return "size-small";
}

export function CrosswordGridReadOnly({
  title,
  grid,
  userGrid,
  cellNumbers,
  blocks,
  words,
  rows,
  cols,
  sizeClass = "size-normal",
}: CrosswordGridReadOnlyProps) {
  const blockedSet = useMemo(() => {
    const set = new Set<string>();
    for (const b of blocks) {
      if (b && typeof b === "object") set.add(`${b.row},${b.col}`);
    }
    return set;
  }, [blocks]);

  const activeCells = useMemo(() => {
    const s = new Set<string>();
    for (const w of words) {
      const len = Number(w?.length ?? 0);
      const dir = w?.direction;
      const start = w?.start;
      if (!start || !dir || !Number.isFinite(len) || len <= 0) continue;
      for (let i = 0; i < len; i++) {
        const r = dir === "across" ? start.row : start.row + i;
        const c = dir === "across" ? start.col + i : start.col;
        s.add(`${r},${c}`);
      }
    }
    return s;
  }, [words]);

  const cellKind = (r: number, c: number): "blocked" | "active" | "empty" => {
    if (blockedSet.has(`${r},${c}`)) return "blocked";
    const inWords = activeCells.has(`${r},${c}`);
    const hasCorrect = !!String(grid?.[r]?.[c] ?? "").trim();
    if (inWords || hasCorrect) return "active";
    return "empty";
  };

  const getCellNumber = (r: number, c: number): number | undefined => {
    return (
      cellNumbers[`${r}-${c}`] ??
      cellNumbers[`${r},${c}`] ??
      cellNumbers[`${r}_${c}`] ??
      cellNumbers[`${r}:${c}`] ??
      undefined
    );
  };

  const isUserLetterCorrect = (r: number, c: number): boolean => {
    if (!userGrid || !grid) return true;
    const correctChar = String(grid?.[r]?.[c] ?? "").trim().toUpperCase();
    const userChar = String(userGrid?.[r]?.[c] ?? "").trim().toUpperCase();
    if (!correctChar) return true;
    return userChar === correctChar;
  };

  return (
    <div className="cw-card" style={{ marginBottom: 0 }}>
      {title && (
        <div style={{ fontWeight: 800, marginBottom: 12, textAlign: "center", color: "#1e293b" }}>
          {title}
        </div>
      )}
      <div className="cw-grid-wrap">
        <div className={`cw-grid ${sizeClass}`}>
          {Array.from({ length: rows }).map((_, r) => (
            <div className="cw-row" key={r}>
              {Array.from({ length: cols }).map((__, c) => {
                const kind = cellKind(r, c);
                const n = getCellNumber(r, c);
                const userChar = userGrid?.[r]?.[c] ?? "";
                const correctChar = grid?.[r]?.[c] ?? "";
                const showUser = userGrid !== undefined;
                const displayChar = showUser ? userChar : correctChar;
                const isCorrect = showUser ? isUserLetterCorrect(r, c) : true;

                let cellClassName = `cw-cell ${kind}`;
                if (showUser && kind === "active" && displayChar && !isCorrect) {
                  cellClassName += " cw-cell-error";
                }
                if (showUser && kind === "active" && displayChar && isCorrect && correctChar) {
                  cellClassName += " cw-cell-correct";
                }

                return (
                  <div key={c} className={cellClassName}>
                    {kind === "active" ? (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 900,
                          color: "#000",
                        }}
                      >
                        {String(displayChar).toUpperCase()}
                      </div>
                    ) : null}
                    {kind === "active" && n !== undefined ? (
                      <div className="cw-num">{n}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {(sizeClass === "size-large" || sizeClass === "size-medium") && (
        <div className="cw-scroll-hint">← Прокрутите сетку влево-вправо →</div>
      )}
    </div>
  );
}

// ============================================================================
// Основной интерактивный компонент (с умным UI-фидбеком)
// ============================================================================

function ensureGrid(rows: number, cols: number, prev?: string[][]) {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => prev?.[r]?.[c] ?? "")
  );
}

function inRange(r: number, c: number, rows: number, cols: number) {
  return r >= 0 && c >= 0 && r < rows && c < cols;
}

export default function QuestionCrossword({
  question,
  value,
  disabled,
  onChange,
  onOpenImage,
}: Props) {
  const correctGrid: string[][] = Array.isArray(question?.grid) ? question.grid : [];
  const rows = Number(question?.metadata?.rows ?? correctGrid.length ?? 0);
  const cols = Number(question?.metadata?.cols ?? (correctGrid?.[0]?.length ?? 0));

  const blocks: { row: number; col: number }[] = Array.isArray(question?.blocks)
    ? question.blocks
    : [];
  const words: Word[] = Array.isArray(question?.words) ? question.words : [];
  const cellNumbers: Record<string, number> = question?.cellNumbers || {};

  const sizeClass = useMemo(() => getCrosswordSizeClass(rows, cols), [rows, cols]);

  const activeCells = useMemo(() => {
    const s = new Set<string>();
    for (const w of words) {
      const len = Number(w?.length ?? 0);
      const dir = w?.direction;
      const start = w?.start;
      if (!start || !dir || !Number.isFinite(len) || len <= 0) continue;
      for (let i = 0; i < len; i++) {
        const r = dir === "across" ? start.row : start.row + i;
        const c = dir === "across" ? start.col + i : start.col;
        s.add(`${r},${c}`);
      }
    }
    return s;
  }, [words]);

  const userGrid = useMemo(() => ensureGrid(rows, cols, value), [rows, cols, value]);

  const inputRefs = useRef<(HTMLInputElement | null)[][]>(
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => null))
  );

  const [focused, setFocused] = useState<{ r: number; c: number } | null>(null);
  const [dir, setDir] = useState<Dir>("across");
  const lastClickRef = useRef<{ r: number; c: number; t: number } | null>(null);

  function isHardBlocked(r: number, c: number) {
    return blocks.some((b) => b.row === r && b.col === c);
  }

  function cellKind(r: number, c: number): "blocked" | "active" | "empty" {
    if (isHardBlocked(r, c)) return "blocked";
    const inWords = activeCells.has(`${r},${c}`);
    const hasCorrect = !!String(correctGrid?.[r]?.[c] ?? "").trim();
    if (inWords || hasCorrect) return "active";
    return "empty";
  }

  function getCellNumber(r: number, c: number): number | undefined {
    return (
      cellNumbers[`${r}-${c}`] ??
      cellNumbers[`${r},${c}`] ??
      cellNumbers[`${r}_${c}`] ??
      cellNumbers[`${r}:${c}`] ??
      undefined
    );
  }

  function setCell(r: number, c: number, ch: string) {
    const next = ensureGrid(rows, cols, userGrid);
    next[r][c] = ch;
    onChange(next);
  }

  function focusCell(r: number, c: number) {
    const el = inputRefs.current?.[r]?.[c];
    if (el) {
      el.focus();
      setFocused({ r, c });
    }
  }

  function findWordContainingCell(d: Dir, r: number, c: number): Word | null {
    for (const w of words) {
      if (w?.direction !== d || !w?.start || !w?.length) continue;
      const len = Number(w.length);
      const sr = w.start.row;
      const sc = w.start.col;
      if (d === "across") {
        if (r !== sr) continue;
        if (c >= sc && c < sc + len) return w;
      } else {
        if (c !== sc) continue;
        if (r >= sr && r < sr + len) return w;
      }
    }
    return null;
  }

  function hasWordInDir(d: Dir, r: number, c: number) {
    return !!findWordContainingCell(d, r, c);
  }

  function getNextInWord(d: Dir, r: number, c: number) {
    const w = findWordContainingCell(d, r, c);
    if (!w?.start || !w?.length) return null;
    const len = Number(w.length);
    const sr = w.start.row;
    const sc = w.start.col;
    const idx = d === "across" ? c - sc : r - sr;
    const nextIdx = idx + 1;
    if (nextIdx >= len) return null;
    const nr = d === "across" ? sr : sr + nextIdx;
    const nc = d === "across" ? sc + nextIdx : sc;
    if (!inRange(nr, nc, rows, cols)) return null;
    if (cellKind(nr, nc) !== "active") return null;
    return { r: nr, c: nc };
  }

  function getPrevInWord(d: Dir, r: number, c: number) {
    const w = findWordContainingCell(d, r, c);
    if (!w?.start || !w?.length) return null;
    const sr = w.start.row;
    const sc = w.start.col;
    const idx = d === "across" ? c - sc : r - sr;
    const prevIdx = idx - 1;
    if (prevIdx < 0) return null;
    const nr = d === "across" ? sr : sr + prevIdx;
    const nc = d === "across" ? sc + prevIdx : sc;
    if (!inRange(nr, nc, rows, cols)) return null;
    if (cellKind(nr, nc) !== "active") return null;
    return { r: nr, c: nc };
  }

  function handleTab(e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) {
    e.preventDefault();
    if (e.shiftKey) {
      const prev = getPrevInWord(dir, r, c);
      if (prev) focusCell(prev.r, prev.c);
      return;
    }
    const next = getNextInWord(dir, r, c);
    if (next) focusCell(next.r, next.c);
  }

  function handleCellPointerDown(r: number, c: number) {
    if (disabled) return;
    if (cellKind(r, c) !== "active") return;

    const now = Date.now();
    const prev = lastClickRef.current;
    const hasAcross = hasWordInDir("across", r, c);
    const hasDown = hasWordInDir("down", r, c);
    const isIntersection = hasAcross && hasDown;

    if (isIntersection && prev && prev.r === r && prev.c === c && now - prev.t < 450) {
      setDir((d) => (d === "across" ? "down" : "across"));
    } else {
      setDir((d) => {
        const hasCur = hasWordInDir(d, r, c);
        if (hasCur) return d;
        if (hasAcross) return "across";
        if (hasDown) return "down";
        return d;
      });
    }

    lastClickRef.current = { r, c, t: now };
  }

  return (
    <div className="crossword-container">
      {question?.image && !(question?.media?.length) ? (
        <div className="cw-card cw-image-card">
          <img
            className="cw-image"
            src={getImageUrl(question.image)}
            alt="Изображение к кроссворду"
            onClick={() => onOpenImage?.(getImageUrl(question.image))}
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <div className="cw-image-hint">Нажмите на изображение для увеличения</div>
        </div>
      ) : null}

      <div className="cw-card">
        <div className="cw-grid-wrap">
          <div className={`cw-grid ${sizeClass}`}>
            {Array.from({ length: rows }).map((_, r) => (
              <div className="cw-row" key={r}>
                {Array.from({ length: cols }).map((__, c) => {
                  const kind = cellKind(r, c);
                  const isFocused = focused?.r === r && focused?.c === c;
                  const n = getCellNumber(r, c);
                  
                  // Логика проверки:
                  const userChar = (userGrid?.[r]?.[c] ?? "").toUpperCase();
                  const correctChar = (correctGrid?.[r]?.[c] ?? "").toUpperCase();
                  
                  let displayChar = userChar;
                  let textColor = "#000";
                  let cellBg = "";

                  if (disabled && kind === "active") {
                    if (userChar) {
                      const isCorrect = userChar === correctChar;
                      textColor = isCorrect ? "#166534" : "#991b1b"; // Ярко зеленый или красный
                      cellBg = isCorrect ? "#f0fdf4" : "#fef2f2";
                    } else if (correctChar) {
                      // Юзер пропустил букву — показываем правильную полупрозрачно
                      textColor = "rgba(16, 185, 129, 0.6)"; 
                      displayChar = correctChar;
                    }
                  }

                  return (
                    <div
                      key={c}
                      className={`cw-cell ${kind} ${isFocused ? "focused" : ""}`}
                      onPointerDown={() => handleCellPointerDown(r, c)}
                      style={cellBg ? { background: cellBg } : undefined}
                    >
                      {kind === "active" ? (
                        <input
                          ref={(el) => {
                            if (!inputRefs.current[r]) inputRefs.current[r] = [];
                            inputRefs.current[r][c] = el;
                          }}
                          disabled={disabled}
                          value={displayChar.slice(0, 1)}
                          maxLength={1}
                          inputMode="text"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          style={{ 
                            fontWeight: 900, 
                            color: textColor,
                            background: "transparent" // Чтобы просвечивал cellBg
                          }}
                          onFocus={() => {
                            setFocused({ r, c });
                            setDir((d) => {
                              const hasCur = hasWordInDir(d, r, c);
                              if (hasCur) return d;
                              const hasAcross = hasWordInDir("across", r, c);
                              const hasDown = hasWordInDir("down", r, c);
                              if (hasAcross) return "across";
                              if (hasDown) return "down";
                              return d;
                            });
                          }}
                          onChange={(e) => {
                            if (disabled) return;
                            const v = (e.target.value || "").toUpperCase().slice(0, 1);
                            setCell(r, c, v);
                            if (v) {
                              const next = getNextInWord(dir, r, c);
                              if (next) focusCell(next.r, next.c);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (disabled) return;

                            const focus = (rr: number, cc: number) => {
                              if (!inRange(rr, cc, rows, cols)) return;
                              if (cellKind(rr, cc) !== "active") return;
                              const el = inputRefs.current?.[rr]?.[cc];
                              if (el) {
                                el.focus();
                                setFocused({ r: rr, c: cc });
                              }
                            };

                            if (e.key === "ArrowLeft") { e.preventDefault(); setDir("across"); focus(r, c - 1); return; }
                            if (e.key === "ArrowRight") { e.preventDefault(); setDir("across"); focus(r, c + 1); return; }
                            if (e.key === "ArrowUp") { e.preventDefault(); setDir("down"); focus(r - 1, c); return; }
                            if (e.key === "ArrowDown") { e.preventDefault(); setDir("down"); focus(r + 1, c); return; }

                            if (e.key === "Tab") {
                              handleTab(e, r, c);
                              return;
                            }

                            if (e.key === "Backspace") {
                              const cur = (userGrid?.[r]?.[c] ?? "").trim();
                              if (!cur) {
                                e.preventDefault();
                                const prev = getPrevInWord(dir, r, c);
                                if (prev) {
                                  setCell(prev.r, prev.c, "");
                                  focusCell(prev.r, prev.c);
                                }
                              }
                              return;
                            }
                          }}
                        />
                      ) : null}

                      {kind === "active" && n !== undefined ? (
                        <div className="cw-num">{n}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {(sizeClass === "size-large" || sizeClass === "size-medium") && (
          <div className="cw-scroll-hint">← Прокрутите сетку влево-вправо →</div>
        )}

        {!disabled && (
          <div className="cw-mode">
            Режим ввода: <strong>{dir === "across" ? "→ across" : "↓ down"}</strong>
          </div>
        )}
      </div>
    </div>
  );
}