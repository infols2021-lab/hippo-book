// app/(app)/assignment/lib/scoring.ts
import { normalizeText } from "./normalize";
import type { FinalStats, ReviewItem, TestOption, MatchingPair } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function ensureArray(val: any): any[] {
  if (val === null || val === undefined || val === "") return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === "object" && parsed !== null) {
        return Object.keys(parsed).sort().map(k => parsed[k]);
      }
    } catch (e) {
      return [val];
    }
    return [val];
  }
  if (typeof val === "object") {
    return Object.keys(val).sort().map(k => val[k]);
  }
  return [val];
}

function extractCorrectValue(v: any): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  if (typeof v === "object") {
    if (Array.isArray(v)) {
      return v.map(extractCorrectValue).filter(Boolean).join(" или ");
    }
    if ("text" in v && v.text) return String(v.text);
    if ("value" in v && v.value) return String(v.value);
    if ("answer" in v && v.answer) return String(v.answer);
    if ("label" in v && v.label) return String(v.label);
    if ("word" in v && v.word) return String(v.word);
    if ("correct" in v && v.correct) return String(v.correct);
    if ("variants" in v && v.variants) return extractCorrectValue(v.variants);
    
    return JSON.stringify(v);
  }
  return String(v);
}

function buildCorrectStrings(arr: any[]): string[] {
  return ensureArray(arr).map((variants: any) => {
    const vArr = ensureArray(variants);
    const text = vArr.map(extractCorrectValue).filter(Boolean).join(" или ");
    return text || "Ответ не задан";
  });
}

function getPointsTotal(q: any): number {
  const p = Number(q?.points);
  return Number.isFinite(p) && p > 0 ? p : 1;
}

function buildParts(correctAnswers: any[], userArr: string[], totalCount: number) {
  const parts: any[] = [];
  for (let idx = 0; idx < totalCount; idx++) {
    const variants = correctAnswers[idx];
    const userRaw = String(userArr[idx] ?? "");
    const userNorm = normalizeText(userRaw);

    const variantsArray = ensureArray(variants);

    const varsNorm = variantsArray.map((v: any) => {
      return normalizeText(extractCorrectValue(v));
    });

    const ok = userNorm.length > 0 && varsNorm.some((v) => v === userNorm);

    const correctDisplay = variantsArray
      .map(extractCorrectValue)
      .filter(Boolean)
      .join(" или ");

    parts.push({
      index: idx,
      isCorrect: ok,
      user: userRaw,
      correct: correctDisplay || "Ответ не задан", 
    });
  }
  return parts;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function safeFraction(earned: number, total: number): number {
  if (total <= 0 || !Number.isFinite(earned) || !Number.isFinite(total)) return 0;
  const f = earned / total;
  return Number.isFinite(f) ? Math.max(0, Math.min(1, f)) : 0;
}

// ---------------------------------------------------------------------------
// Shared Logic (Решение багов #2, #4, #9)
// ---------------------------------------------------------------------------

// Единая логика расчета заполненности кроссворда
export function getCrosswordStats(q: any, a: any) {
  const grid = ensureArray(q.grid);
  const blocks = ensureArray(q.blocks);
  const words = ensureArray(q.words); // Берем слова из вопроса
  const userGrid = ensureArray(a);

  // 1. Сначала узнаем, какие клетки реально участвуют в словах
  const activeCells = new Set<string>();
  for (const w of words) {
    const len = Number(w?.length ?? 0);
    const dir = w?.direction;
    const start = w?.start;
    if (!start || !dir || !Number.isFinite(len) || len <= 0) continue;
    for (let step = 0; step < len; step++) {
      const r = dir === "across" ? start.row : start.row + step;
      const c = dir === "across" ? start.col + step : start.col;
      activeCells.add(`${r},${c}`);
    }
  }

  // 2. Считаем только те клетки, которые входят в activeCells
  let totalActiveCells = activeCells.size;
  let filledCells = 0;

  for (const key of activeCells) {
    const [r, c] = key.split(",").map(Number);
    const userLetter = String(userGrid?.[r]?.[c] ?? "").trim();
    if (userLetter !== "") filledCells++;
  }

  const percent = totalActiveCells > 0 ? Math.round((filledCells / totalActiveCells) * 100) : 0;
  return { totalActiveCells, filledCells, percent };
}

// Единая логика проверки "отвечен ли вопрос" (для UI и Сервера)
export function isQuestionAnswered(q: any, a: any): boolean {
  if (!q || typeof q !== "object") return false;

  if (q.type === "test") {
    if (q.multiple) return ensureArray(a).length > 0;
    return a !== undefined && a !== null && String(a).trim() !== "";
  } 
  
  if (q.type === "fill") {
    let correctAnswers = ensureArray(q.answers);
    if (correctAnswers.length === 0) correctAnswers = ensureArray(q.correct);
    const correctCount = correctAnswers.length;
    const arrA = ensureArray(a);
    return arrA.length >= correctCount && arrA.every((x: any) => String(x ?? "").trim() !== "");
  } 
  
  if (q.type === "sentence") {
    const gaps = (String(q.sentence || "").match(/___/g) || []).length;
    const arrA = ensureArray(a);
    return arrA.length >= gaps && arrA.every((x: any) => String(x ?? "").trim() !== "");
  } 
  
  if (q.type === "complex" || q.type === "reading") {
    const subQs = ensureArray(q.subQuestions);
    const subAns = a && typeof a === "object" ? a : {};
    if (subQs.length === 0) return true;
    return subQs.every((sq, idx) => {
      // Поддержка и ID, и индексов для вложенных вопросов
      const subA = subAns[sq.id] !== undefined ? subAns[sq.id] : subAns[idx];
      return isQuestionAnswered(sq, subA);
    });
  } 
  
  if (q.type === "matching") {
    const pairs = ensureArray(q.pairs);
    return a && typeof a === "object" && Object.keys(a).length === pairs.length;
  } 
  
  if (q.type === "imagemap") {
    const answersCount = ensureArray(q.answers).length;
    return a && typeof a === "object" && Object.keys(a).length === answersCount;
  }

  if (q.type === "crossword") {
    const stats = getCrosswordStats(q, a);
    return stats.totalActiveCells > 0 && stats.filledCells === stats.totalActiveCells;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

export function validateAllAnswered(
  questions: any[],
  answers: any
): { ok: boolean; index: number; subIndex?: number } {
  const qs = ensureArray(questions);
  if (qs.length === 0) return { ok: true, index: -1 };

  const safeAnswers = answers && typeof answers === "object" ? answers : {};

  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    if (!q || typeof q !== "object") continue;

    // Решение бага #3: Приоритет ответа по ID, фолбэк на индекс (для старых прохождений)
    const a = safeAnswers[q.id] !== undefined ? safeAnswers[q.id] : safeAnswers[i];

    if (q.type === "complex" || q.type === "reading") {
      const subQs = ensureArray(q.subQuestions);
      const subRes = validateAllAnswered(subQs, a);
      if (!subRes.ok) return { ok: false, index: i, subIndex: subRes.index };
    } else {
      if (!isQuestionAnswered(q, a)) {
        return { ok: false, index: i };
      }
    }
  }
  return { ok: true, index: -1 };
}

// ---------------------------------------------------------------------------
// Main Scoring Engine
// ---------------------------------------------------------------------------

export function calcAndBuildReview(
  questions: any[],
  answers: any
): { stats: FinalStats; review: ReviewItem[] } {
  const qs = ensureArray(questions);

  if (qs.length === 0) {
    return {
      stats: { score: 0, correct: 0, incorrect: 0, skipped: 0, total: 0, pointsEarned: 0, pointsTotal: 0 },
      review: [],
    };
  }

  const safeAnswers = answers !== null && answers !== undefined && typeof answers === "object" ? answers : {};
  const statsSum = { correct: 0, incorrect: 0, skipped: 0, total: 0, pointsEarned: 0, pointsTotal: 0 };
  const review: ReviewItem[] = [];

  function processQ(q: any, a: any, idxText: string): ReviewItem {
    if (!q || typeof q !== "object") {
      statsSum.skipped++; statsSum.total++; statsSum.pointsTotal += 1;
      return { type: "other", questionText: `Вопрос ${idxText}`, isCorrect: false, isSkipped: true, pointsEarned: 0, pointsTotal: 1 } as ReviewItem;
    }

    const questionText = String(q?.q ?? "").trim() || `Вопрос ${idxText}`;
    const pointsTotal = getPointsTotal(q);
    const media = ensureArray(q.media).length > 0 ? ensureArray(q.media) : undefined;

    // ---------------------------------------------------------------
    // COMPLEX / READING
    // ---------------------------------------------------------------
    if (q.type === "complex" || q.type === "reading") {
      const subQs = ensureArray(q.subQuestions);
      const subAns = a && typeof a === "object" ? a : {};

      const subReviews: ReviewItem[] = [];
      let earned = 0;
      let total = 0;
      let allSkipped = true;

      subQs.forEach((sq: any, subI: number) => {
        // Поддержка ID и индекса во вложенных вопросах
        const subA = subAns[sq.id] !== undefined ? subAns[sq.id] : subAns[subI];
        const sr = processQ(sq, subA, `${idxText}.${subI + 1}`);
        subReviews.push(sr);
        earned += Number.isFinite(sr.pointsEarned) ? sr.pointsEarned : 0;
        total += Number.isFinite(sr.pointsTotal) ? sr.pointsTotal : 0;
        if (!sr.isSkipped) allSkipped = false;
      });

      return {
        type: q.type,
        questionText,
        isCorrect: total > 0 && earned >= total,
        isSkipped: allSkipped,
        pointsEarned: Number(earned.toFixed(2)),
        pointsTotal: total,
        subReviews,
        media,
        readingText: q.type === "reading" ? (q.text || "") : undefined
      } as ReviewItem;
    }

    // ---------------------------------------------------------------
    // TEST
    // ---------------------------------------------------------------
    if (q.type === "test") {
      const isMultiple = !!q.multiple;
      const optionsArr = ensureArray(q.options);
      
      const options: TestOption[] = optionsArr.map((opt: any, idx: number) => {
        if (typeof opt === "string") return { id: `opt-${idx}`, text: opt, media: [] };
        return opt as TestOption;
      });

      const getOptText = (idx: number) => {
        const opt = options[idx];
        return opt ? (opt.text || `Вариант ${idx + 1}`) : "—";
      };

      let correctArr = ensureArray(q.correct);
      if (correctArr.length === 0) correctArr = ensureArray(q.answer);

      const correctLabels = correctArr.map((c: any) => getOptText(Number(c)));
      const correctIndices = correctArr.map(Number);
      const answered = isMultiple ? ensureArray(a).length > 0 : (a !== undefined && a !== null && a !== "");

      if (!answered) {
        statsSum.skipped++; statsSum.total++; statsSum.pointsTotal += pointsTotal;
        return {
          type: "test", questionText, isCorrect: false, isSkipped: true,
          userLabel: isMultiple ? [] : "Не отвечено", correctLabel: isMultiple ? correctLabels : correctLabels[0] || "—",
          userIndices: [], correctIndices, isMultiple, fraction: 0, pointsEarned: 0, pointsTotal, options, media,
        } as ReviewItem;
      }

      let fraction = 0;
      let userLabels: string | string[] = [];
      let userArrForIndices: number[] = [];

      if (isMultiple) {
        const userArr = ensureArray(a).map(Number);
        userArrForIndices = userArr;
        userLabels = userArr.map((c: number) => getOptText(c));

        const correctSet = new Set(correctIndices);
        const userSet = new Set(userArr);
        let correctSelected = 0, wrongSelected = 0;

        userSet.forEach((val: number) => {
          if (correctSet.has(val)) correctSelected++;
          else wrongSelected++;
        });

        const totalCorrect = correctSet.size || 1;
        // Решение бага #7 (Документирование): 
        // Формула жестко штрафует за выбор неправильных вариантов, чтобы предотвратить угадывание "выберу все".
        // Если correctSelected = 1, wrongSelected = 1 -> fraction = 0.
        // ReviewPanel будет опираться на это, чтобы показать подсказку.
        fraction = Math.max(0, correctSelected - wrongSelected) / totalCorrect;
        fraction = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
      } else {
        const userIdx = Number(a);
        userArrForIndices = [userIdx];
        userLabels = getOptText(userIdx);
        fraction = userIdx === correctIndices[0] ? 1 : 0;
      }

      const pointsEarned = Number((fraction * pointsTotal).toFixed(2));
      const isCorrect = pointsEarned === pointsTotal;
      
      statsSum.pointsEarned += pointsEarned; statsSum.pointsTotal += pointsTotal; statsSum.total++;
      if (isCorrect) statsSum.correct++; else statsSum.incorrect++;

      return {
        type: "test", questionText, isCorrect, isSkipped: false, userLabel: userLabels,
        correctLabel: isMultiple ? correctLabels : correctLabels[0] || "—",
        userIndices: userArrForIndices, correctIndices, fraction, isMultiple, pointsEarned, pointsTotal, options, media,
      } as ReviewItem;
    }

    // ---------------------------------------------------------------
    // FILL & SENTENCE 
    // (Логика идентична, кроме поля sentenceTemplate)
    // ---------------------------------------------------------------
    if (q.type === "fill" || q.type === "sentence") {
      let correctAnswers = ensureArray(q.answers);
      if (correctAnswers.length === 0) correctAnswers = ensureArray(q.correct);

      const isSentence = q.type === "sentence";
      const totalCount = isSentence 
        ? (String(q.sentence || "").match(/___/g) || []).length 
        : correctAnswers.length;

      const userArr: string[] = ensureArray(a).slice(0, totalCount).map((x) => String(x ?? ""));
      const isSkipped = userArr.length === 0 || userArr.every(x => !x.trim());

      const baseResult = {
        type: q.type, questionText, pointsTotal, media,
        sentenceTemplate: isSentence ? String(q.sentence || "") : undefined
      };

      if (totalCount === 0 || isSkipped) {
        if (totalCount === 0) statsSum.incorrect++; else statsSum.skipped++;
        statsSum.total++; statsSum.pointsTotal += pointsTotal;
        return {
          ...baseResult, isCorrect: false, isSkipped: totalCount > 0,
          userAnswers: userArr, correctAnswers: buildCorrectStrings(correctAnswers),
          parts: [], percent: 0, correctCount: 0, totalCount, pointsEarned: 0,
        } as ReviewItem;
      }

      const parts = buildParts(correctAnswers, userArr, totalCount);
      const correctCount = parts.filter((p) => p.isCorrect).length;
      const fraction = safeFraction(correctCount, totalCount);
      const pointsEarned = Number((fraction * pointsTotal).toFixed(2));

      statsSum.pointsEarned += pointsEarned; statsSum.pointsTotal += pointsTotal; statsSum.total++;

      const isAllCorrect = correctCount === totalCount;
      if (isAllCorrect) statsSum.correct++; else statsSum.incorrect++;

      return {
        ...baseResult, isCorrect: isAllCorrect, isSkipped: false,
        userAnswers: userArr, correctAnswers: buildCorrectStrings(correctAnswers),
        parts, percent: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
        correctCount, totalCount, pointsEarned,
      } as ReviewItem;
    }

    // ---------------------------------------------------------------
    // MATCHING
    // ---------------------------------------------------------------
    if (q.type === "matching") {
      const pairs = ensureArray(q.pairs);
      const totalPairsCount = pairs.length;
      const correctMatches: Record<string, string> = {};
      const rightLabels: Record<string, string> = {};
      const leftLabels: Record<string, string> = {};

      pairs.forEach((p: any) => {
        if (p?.id != null) {
          correctMatches[String(p.id)] = String(p.id);
          const getLabel = (item: any) => {
            if (item?.text && String(item.text).trim()) return String(item.text).trim();
            if (ensureArray(item?.media).length > 0) return item.media[0]?.name?.trim() || `Изображение`;
            return `Элемент ${String(p.id)}`;
          };
          leftLabels[String(p.id)] = getLabel(p.left);
          rightLabels[String(p.id)] = getLabel(p.right);
        }
      });

      const answered = a && typeof a === "object" && Object.keys(a).length > 0;

      if (!answered) {
        statsSum.skipped++; statsSum.total++; statsSum.pointsTotal += pointsTotal;
        return {
          type: "matching", questionText, isCorrect: false, isSkipped: true,
          correctPairsCount: 0, totalPairsCount, userMatches: {}, correctMatches,
          rightLabels, leftLabels, pairs, pointsEarned: 0, pointsTotal, media,
        } as ReviewItem;
      }

      let correctPairsCount = 0;
      const userMatches = a as Record<string, string>;

      pairs.forEach((p: any) => {
        if (p?.id != null) {
          const key = String(p.id);
          if (userMatches[key] === correctMatches[key]) correctPairsCount++;
        }
      });

      const fraction = safeFraction(correctPairsCount, totalPairsCount);
      const pointsEarned = Number((fraction * pointsTotal).toFixed(2));

      statsSum.pointsEarned += pointsEarned; statsSum.pointsTotal += pointsTotal; statsSum.total++;
      if (correctPairsCount === totalPairsCount) statsSum.correct++; else statsSum.incorrect++;

      return {
        type: "matching", questionText, isCorrect: correctPairsCount === totalPairsCount, isSkipped: false,
        correctPairsCount, totalPairsCount, userMatches, correctMatches,
        rightLabels, leftLabels, pairs, pointsEarned, pointsTotal, media,
      } as ReviewItem;
    }

    // ---------------------------------------------------------------
    // IMAGEMAP
    // ---------------------------------------------------------------
    if (q.type === "imagemap") {
      const answersArr = ensureArray(q.answers);
      const pointsArr = ensureArray(q.points);
      const totalPairsCount = answersArr.length;

      const correctMatches: Record<string, string> = {};
      const answerLabels: Record<string, string> = {};
      const pointLabels: Record<string, string> = {};

      for (const ans of answersArr) {
        const point = pointsArr.find((p: any) => p.correctAnswerId === ans.id);
        if (point) correctMatches[ans.id] = point.id;
        
        if (ans.text && String(ans.text).trim()) answerLabels[ans.id] = String(ans.text).trim();
        else if (ensureArray(ans.media).length > 0) answerLabels[ans.id] = ans.media[0]?.name?.trim() || `Ответ`;
        else answerLabels[ans.id] = `Ответ #${ans.id}`;
      }

      for (const point of pointsArr) {
        pointLabels[point.id] = point.label || `Точка ${point.id}`;
      }

      const userMatches = (a && typeof a === "object" ? a : {}) as Record<string, string>;
      const answered = Object.keys(userMatches).length > 0;

      if (!answered) {
        statsSum.skipped++; statsSum.total++; statsSum.pointsTotal += pointsTotal;
        return {
          type: "imagemap", questionText, isCorrect: false, isSkipped: true,
          correctPairsCount: 0, totalPairsCount, userMatches: {}, correctMatches,
          answerLabels, pointLabels, imageUrl: q.image || "", points: pointsArr, answers: answersArr,
          pointsEarned: 0, pointsTotal, media,
        } as ReviewItem;
      }

      let correctPairsCount = 0;
      for (const ans of answersArr) {
        if (userMatches[ans.id] === correctMatches[ans.id]) correctPairsCount++;
      }

      const fraction = safeFraction(correctPairsCount, totalPairsCount);
      const pointsEarned = Number((fraction * pointsTotal).toFixed(2));

      statsSum.pointsEarned += pointsEarned; statsSum.pointsTotal += pointsTotal; statsSum.total++;
      if (correctPairsCount === totalPairsCount) statsSum.correct++; else statsSum.incorrect++;

      return {
        type: "imagemap", questionText, isCorrect: correctPairsCount === totalPairsCount, isSkipped: false,
        correctPairsCount, totalPairsCount, userMatches, correctMatches,
        answerLabels, pointLabels, imageUrl: q.image || "", points: pointsArr, answers: answersArr,
        pointsEarned, pointsTotal, media,
      } as ReviewItem;
    }

    // ---------------------------------------------------------------
    // CROSSWORD
    // ---------------------------------------------------------------
    if (q.type === "crossword") {
      const grid: string[][] = ensureArray(q.grid);
      const words: any[] = ensureArray(q.words);
      const blocks: any[] = ensureArray(q.blocks);
      const cellNumbers: Record<string, number> = q.cellNumbers || {};
      const userGrid = ensureArray(a);

      // Использование единого хелпера (Решение багов #2 и #9)
      const stats = getCrosswordStats(q, a);

      const correctWords: Array<{ number: number; direction: string; word: string }> = [];
      const wrongWords: Array<{ number: number; direction: string; user: string; correct: string }> = [];
      let totalWords = words.length;

      for (const w of words) {
        if (!w || typeof w !== "object") continue;
        const number = Number(w.number ?? 0);
        const dir = String(w.direction ?? "");
        const start = w.start as { row: number; col: number } | undefined;
        const len = Number(w.length ?? 0);

        if (!start || !Number.isFinite(len) || len <= 0) continue;

        let correctWord = "";
        let userWord = "";

        for (let i = 0; i < len; i++) {
          const r = dir === "across" ? start.row : start.row + i;
          const c = dir === "across" ? start.col + i : start.col;

          correctWord += String(ensureArray(grid[r])[c] ?? "");
          userWord += String(ensureArray(userGrid[r])[c] ?? "").trim();
        }

        const isCorrect = userWord.toUpperCase() === correctWord.toUpperCase() && userWord !== "";

        if (isCorrect) {
          correctWords.push({ number, direction: dir, word: correctWord.toUpperCase() });
        } else {
          wrongWords.push({ number, direction: dir, user: userWord || "(пусто)", correct: correctWord.toUpperCase() });
        }
      }

      const answered = stats.filledCells > 0;
      let correctPairsCount = correctWords.length;
      let fraction = safeFraction(correctPairsCount, totalWords);
      const pointsEarned = Number((fraction * pointsTotal).toFixed(2));
      
      statsSum.pointsEarned += pointsEarned; statsSum.pointsTotal += pointsTotal; statsSum.total++;

      if (correctPairsCount === totalWords && totalWords > 0) statsSum.correct++;
      else if (answered) statsSum.incorrect++;
      else statsSum.skipped++;

      return {
        type: "crossword", questionText, isCorrect: correctPairsCount === totalWords && totalWords > 0, isSkipped: !answered,
        pointsEarned, pointsTotal, note: answered ? `Правильно слов: ${correctPairsCount} из ${totalWords}` : "Кроссворд не заполнен",
        crosswordStats: { filled: stats.filledCells, total: stats.totalActiveCells, percent: stats.percent },
        wordReview: { wrong: wrongWords, correct: correctWords },
        grid, userGrid: (userGrid as string[][]) || [], cellNumbers, blocks, words, media,
      } as ReviewItem;
    }

    // ---------------------------------------------------------------
    // OTHER
    // ---------------------------------------------------------------
    statsSum.skipped++; statsSum.total++; statsSum.pointsTotal += pointsTotal;
    
    return {
      type: "other", questionText, isCorrect: false, isSkipped: true,
      note: "Тип вопроса пока не поддержан в стандартном Review.",
      pointsEarned: 0, pointsTotal, media,
    } as ReviewItem;
  }

  qs.forEach((q, i) => {
    // Решение бага #3: маппинг по ID с фолбеком на индекс
    const userAns = safeAnswers[q.id] !== undefined ? safeAnswers[q.id] : safeAnswers[i];
    review.push(processQ(q, userAns, String(i + 1)));
  });

  const score = clampScore(safeFraction(statsSum.pointsEarned, statsSum.pointsTotal) * 100);

  return {
    stats: {
      score, correct: statsSum.correct, incorrect: statsSum.incorrect, skipped: statsSum.skipped,
      total: statsSum.total, pointsEarned: Number(statsSum.pointsEarned.toFixed(2)), pointsTotal: statsSum.pointsTotal,
    },
    review,
  };
}