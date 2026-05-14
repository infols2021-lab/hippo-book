// app/(app)/assignment/lib/scoring.ts
import { normalizeText } from "./normalize";
import type { FinalStats, ReviewItem, TestOption, MatchingPair } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// УМНЫЙ ЭКСТРАКТОР: Достает текст из любых объектов, строк или массивов.
// Если структура неизвестна, выводит JSON на экран, чтобы мы поняли, где спрятан текст!
function extractCorrectValue(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  if (typeof v === "object") {
    if ("text" in v && v.text) return String(v.text);
    if ("value" in v && v.value) return String(v.value);
    if ("answer" in v && v.answer) return String(v.answer);
    if ("label" in v && v.label) return String(v.label);
    if ("word" in v && v.word) return String(v.word);
    if ("correct" in v && v.correct) return String(v.correct);
    
    // Если ключа нет в списке выше, возвращаем сам объект в виде строки, 
    // чтобы он отрендерился на экране и мы увидели его структуру!
    return JSON.stringify(v);
  }
  return String(v);
}

function buildCorrectStrings(arr: any[]): string[] {
  return (arr || []).map((variants: any) =>
    (Array.isArray(variants) ? variants : [variants])
      .map(extractCorrectValue)
      .join(" или ")
  );
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

    const variantsArray = Array.isArray(variants) ? variants : [variants];

    const varsNorm = variantsArray.map((v: any) => {
      return normalizeText(extractCorrectValue(v));
    });

    const ok = userNorm.length > 0 && varsNorm.some((v) => v === userNorm);

    // Собираем красивую строку через наш экстрактор
    const correctDisplay = variantsArray
      .map(extractCorrectValue)
      .join(" или ");

    parts.push({
      index: idx,
      isCorrect: ok,
      user: userRaw,
      correct: correctDisplay, 
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
// Validate
// ---------------------------------------------------------------------------

export function validateAllAnswered(
  questions: any[],
  answers: any
): { ok: boolean; index: number; subIndex?: number } {
  if (!Array.isArray(questions)) return { ok: true, index: -1 };

  const safeAnswers = answers && typeof answers === "object" ? answers : {};

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (!q || typeof q !== "object") continue;

    const a = (safeAnswers as any)[i];

    if (q.type === "test") {
      if (q.multiple) {
        const has = Array.isArray(a) && a.length > 0;
        if (!has) return { ok: false, index: i };
      } else {
        const has = a !== undefined && a !== null && a !== "";
        if (!has) return { ok: false, index: i };
      }
    } else if (q.type === "fill") {
      const correctCount = (q.answers || []).length;
      const has =
        Array.isArray(a) &&
        a.length >= correctCount &&
        a.every((x: any) => String(x ?? "").trim() !== "");
      if (!has) return { ok: false, index: i };
    } else if (q.type === "sentence") {
      const gaps = (String(q.sentence || "").match(/___/g) || []).length;
      const has =
        Array.isArray(a) &&
        a.length >= gaps &&
        a.every((x: any) => String(x ?? "").trim() !== "");
      if (!has) return { ok: false, index: i };
    } else if (q.type === "complex") {
      const subQs = q.subQuestions || [];
      const subAns = Array.isArray(a) ? a : [];
      const subRes = validateAllAnswered(subQs, subAns);
      if (!subRes.ok) return { ok: false, index: i, subIndex: subRes.index };
    } else if (q.type === "reading") {
      const subQs = q.subQuestions || [];
      const subAns = Array.isArray(a) ? a : [];
      const subRes = validateAllAnswered(subQs, subAns);
      if (!subRes.ok) return { ok: false, index: i, subIndex: subRes.index };
    } else if (q.type === "matching") {
      const pairs = q.pairs || [];
      const has =
        a && typeof a === "object" && Object.keys(a).length === pairs.length;
      if (!has) return { ok: false, index: i };
    } else if (q.type === "imagemap") {
      const answersCount = (q.answers || []).length;
      const has =
        a && typeof a === "object" && Object.keys(a).length === answersCount;
      if (!has) return { ok: false, index: i };
    }
  }
  return { ok: true, index: -1 };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function calcAndBuildReview(
  questions: any[],
  answers: any
): { stats: FinalStats; review: ReviewItem[] } {
  if (!Array.isArray(questions) || questions.length === 0) {
    return {
      stats: {
        score: 0,
        correct: 0,
        incorrect: 0,
        skipped: 0,
        total: 0,
        pointsEarned: 0,
        pointsTotal: 0,
      },
      review: [],
    };
  }

  const safeAnswers =
    answers !== null && answers !== undefined && typeof answers === "object"
      ? answers
      : {};

  const statsSum = {
    correct: 0,
    incorrect: 0,
    skipped: 0,
    total: 0,
    pointsEarned: 0,
    pointsTotal: 0,
  };

  const review: ReviewItem[] = [];

  function processQ(q: any, a: any, idxText: string): ReviewItem {
    if (!q || typeof q !== "object") {
      statsSum.skipped++;
      statsSum.total++;
      statsSum.pointsTotal += 1;
      return {
        type: "other",
        questionText: `Вопрос ${idxText}`,
        isCorrect: false,
        isSkipped: true,
        note: "Некорректная структура вопроса.",
        pointsEarned: 0,
        pointsTotal: 1,
      } as ReviewItem;
    }

    const questionText = String(q?.q ?? "").trim() || `Вопрос ${idxText}`;
    const pointsTotal = getPointsTotal(q);
    const media = q.media && Array.isArray(q.media) ? q.media : undefined;

    // ---------------------------------------------------------------
    // COMPLEX
    // ---------------------------------------------------------------
    if (q.type === "complex") {
      const subQs = Array.isArray(q.subQuestions) ? q.subQuestions : [];
      const subAns = Array.isArray(a) ? a : [];

      const subReviews: ReviewItem[] = [];
      let complexEarned = 0;
      let complexTotal = 0;
      let complexAllSkipped = true;
      let complexAllCorrect = true;

      subQs.forEach((sq: any, subI: number) => {
        const sr = processQ(sq, subAns[subI], `${idxText}.${subI + 1}`);
        subReviews.push(sr);
        complexEarned += Number.isFinite(sr.pointsEarned) ? sr.pointsEarned : 0;
        complexTotal += Number.isFinite(sr.pointsTotal) ? sr.pointsTotal : 0;
        if (!sr.isSkipped) complexAllSkipped = false;
        if (!sr.isCorrect) complexAllCorrect = false;
      });

      return {
        type: "complex",
        questionText,
        isCorrect: complexTotal > 0 && complexEarned === complexTotal,
        isSkipped: complexAllSkipped,
        pointsEarned: Number(complexEarned.toFixed(2)),
        pointsTotal: complexTotal,
        subReviews,
        media,
      } as ReviewItem;
    }

    // ---------------------------------------------------------------
    // READING
    // ---------------------------------------------------------------
    if (q.type === "reading") {
      const subQs = Array.isArray(q.subQuestions) ? q.subQuestions : [];
      const subAns = Array.isArray(a) ? a : [];

      const subReviews: ReviewItem[] = [];
      let readingEarned = 0;
      let readingTotal = 0;
      let readingAllSkipped = true;
      let readingAllCorrect = true;

      subQs.forEach((sq: any, subI: number) => {
        const sr = processQ(sq, subAns[subI], `${idxText}.${subI + 1}`);
        subReviews.push(sr);
        readingEarned += Number.isFinite(sr.pointsEarned) ? sr.pointsEarned : 0;
        readingTotal += Number.isFinite(sr.pointsTotal) ? sr.pointsTotal : 0;
        if (!sr.isSkipped) readingAllSkipped = false;
        if (!sr.isCorrect) readingAllCorrect = false;
      });

      return {
        type: "reading",
        questionText,
        isCorrect: readingTotal > 0 && readingEarned === readingTotal,
        isSkipped: readingAllSkipped,
        pointsEarned: Number(readingEarned.toFixed(2)),
        pointsTotal: readingTotal,
        subReviews,
        media,
        readingText: q.text || "",
      } as ReviewItem;
    }

    // ---------------------------------------------------------------
    // TEST
    // ---------------------------------------------------------------
    if (q.type === "test") {
      const isMultiple = !!q.multiple;
      let options: TestOption[] = [];
      if (Array.isArray(q.options)) {
        options = q.options.map((opt: any, idx: number) => {
          if (typeof opt === "string") {
            return { id: `opt-${idx}`, text: opt, media: [] };
          }
          return opt as TestOption;
        });
      }

      const getOptText = (idx: number) => {
        const opt = options[idx];
        if (!opt) return "—";
        return opt.text || `Вариант ${idx + 1}`;
      };

      const correctArr = Array.isArray(q.correct)
        ? q.correct
        : typeof q.correct === "number"
          ? [q.correct]
          : [];
      const correctLabels = correctArr.map((c: any) => getOptText(Number(c)));
      const correctIndices = correctArr.map(Number);

      const answered = isMultiple
        ? Array.isArray(a) && a.length > 0
        : a !== undefined && a !== null && a !== "";

      if (!answered) {
        statsSum.skipped++;
        statsSum.total++;
        statsSum.pointsTotal += pointsTotal;
        return {
          type: "test",
          questionText,
          isCorrect: false,
          isSkipped: true,
          userLabel: isMultiple ? [] : "Не отвечено",
          correctLabel: isMultiple ? correctLabels : correctLabels[0] || "—",
          userIndices: [], 
          correctIndices, 
          isMultiple,
          fraction: 0,
          pointsEarned: 0,
          pointsTotal,
          options,
          media,
        } as ReviewItem;
      }

      let fraction = 0;
      let isCorrect = false;
      let userLabels: string | string[] = [];
      let userArrForIndices: number[] = [];

      if (isMultiple) {
        const userArr = Array.isArray(a) ? a.map(Number) : [];
        userArrForIndices = userArr;
        userLabels = userArr.map((c: number) => getOptText(c));

        const correctSet = new Set(correctArr.map(Number));
        const userSet = new Set(userArr);

        let correctSelected = 0;
        let wrongSelected = 0;

        userSet.forEach((val: number) => {
          if (correctSet.has(val)) correctSelected++;
          else wrongSelected++;
        });

        const totalCorrect = correctSet.size || 1;
        fraction = Math.max(0, correctSelected - wrongSelected) / totalCorrect;
        fraction = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
        isCorrect = fraction === 1;
      } else {
        const userIdx = Number(a);
        userArrForIndices = [userIdx];
        userLabels = getOptText(userIdx);
        const correctIdx = Number(correctArr[0]);
        isCorrect = userIdx === correctIdx;
        fraction = isCorrect ? 1 : 0;
      }

      const pointsEarned = Number((fraction * pointsTotal).toFixed(2));
      
      statsSum.pointsEarned += pointsEarned;
      statsSum.pointsTotal += pointsTotal;
      statsSum.total++;
      if (isCorrect) statsSum.correct++;
      else statsSum.incorrect++;

      return {
        type: "test",
        questionText,
        isCorrect,
        isSkipped: false,
        userLabel: userLabels,
        correctLabel: isMultiple ? correctLabels : correctLabels[0] || "—",
        userIndices: userArrForIndices, 
        correctIndices, 
        fraction,
        isMultiple,
        pointsEarned,
        pointsTotal,
        options,
        media,
      } as ReviewItem;
    }

    // ---------------------------------------------------------------
    // FILL
    // ---------------------------------------------------------------
    if (q.type === "fill") {
      const correctAnswers = Array.isArray(q.answers) ? q.answers : [];
      const totalCount = correctAnswers.length;

      if (totalCount === 0) {
        statsSum.skipped++;
        statsSum.total++;
        statsSum.pointsTotal += pointsTotal;
        return {
          type: "fill",
          questionText,
          isCorrect: false,
          isSkipped: true,
          userAnswers: [],
          correctAnswers: [],
          parts: [],
          percent: 0,
          correctCount: 0,
          totalCount: 0,
          pointsEarned: 0,
          pointsTotal,
          media,
        } as ReviewItem;
      }

      const correctStrings = buildCorrectStrings(correctAnswers);
      const userArr: string[] = Array.isArray(a)
        ? (a as any[]).map((x) => String(x ?? ""))
        : [];

      const answered =
        Array.isArray(a) &&
        a.length >= totalCount &&
        a.every((x: any) => String(x ?? "").trim() !== "");

      if (!answered) {
        statsSum.skipped++;
        statsSum.total++;
        statsSum.pointsTotal += pointsTotal;
        
        const parts = buildParts(correctAnswers, userArr, totalCount);
        const correctCount = parts.filter((p) => p.isCorrect).length;
        const percent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

        return {
          type: "fill",
          questionText,
          isCorrect: false,
          isSkipped: true,
          userAnswers: userArr,
          correctAnswers: correctStrings,
          parts,
          percent,
          correctCount,
          totalCount,
          pointsEarned: 0,
          pointsTotal,
          media,
        } as ReviewItem;
      }

      const parts = buildParts(correctAnswers, userArr, totalCount);
      const correctCount = parts.filter((p) => p.isCorrect).length;
      const fraction = safeFraction(correctCount, totalCount);
      const pointsEarned = Number((fraction * pointsTotal).toFixed(2));

      statsSum.pointsEarned += pointsEarned;
      statsSum.pointsTotal += pointsTotal;
      statsSum.total++;

      const isAllCorrect = correctCount === totalCount;
      if (isAllCorrect) statsSum.correct++;
      else statsSum.incorrect++;

      return {
        type: "fill",
        questionText,
        isCorrect: isAllCorrect,
        isSkipped: false,
        userAnswers: userArr,
        correctAnswers: correctStrings,
        parts,
        percent: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
        correctCount,
        totalCount,
        pointsEarned,
        pointsTotal,
        media,
      } as ReviewItem;
    }

    // ---------------------------------------------------------------
    // SENTENCE
    // ---------------------------------------------------------------
    if (q.type === "sentence") {
      const gaps = (String(q.sentence || "").match(/___/g) || []).length;
      const correctAnswers = Array.isArray(q.answers) ? q.answers : [];
      const totalCount = gaps;

      if (totalCount === 0) {
        statsSum.skipped++;
        statsSum.total++;
        statsSum.pointsTotal += pointsTotal;
        return {
          type: "sentence",
          questionText,
          isCorrect: false,
          isSkipped: true,
          userAnswers: [],
          correctAnswers: [],
          parts: [],
          percent: 0,
          correctCount: 0,
          totalCount: 0,
          pointsEarned: 0,
          pointsTotal,
          media,
          sentenceTemplate: String(q.sentence || ""),
        } as ReviewItem;
      }

      const correctStrings = buildCorrectStrings(correctAnswers);
      const userArr: string[] = Array.isArray(a)
        ? (a as any[]).slice(0, gaps).map((x) => String(x ?? ""))
        : [];

      const answered =
        Array.isArray(a) &&
        a.length >= gaps &&
        a.every((x: any) => String(x ?? "").trim() !== "");

      if (!answered) {
        statsSum.skipped++;
        statsSum.total++;
        statsSum.pointsTotal += pointsTotal;
        
        const parts = buildParts(correctAnswers, userArr, totalCount);
        const correctCount = parts.filter((p) => p.isCorrect).length;
        const percent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

        return {
          type: "sentence",
          questionText,
          isCorrect: false,
          isSkipped: true,
          userAnswers: userArr,
          correctAnswers: correctStrings,
          parts,
          percent,
          correctCount,
          totalCount,
          pointsEarned: 0,
          pointsTotal,
          media,
          sentenceTemplate: String(q.sentence || ""),
        } as ReviewItem;
      }

      const parts = buildParts(correctAnswers, userArr, totalCount);
      const correctCount = parts.filter((p) => p.isCorrect).length;
      const fraction = safeFraction(correctCount, totalCount);
      const pointsEarned = Number((fraction * pointsTotal).toFixed(2));

      statsSum.pointsEarned += pointsEarned;
      statsSum.pointsTotal += pointsTotal;
      statsSum.total++;

      const isAllCorrect = correctCount === totalCount;
      if (isAllCorrect) statsSum.correct++;
      else statsSum.incorrect++;

      return {
        type: "sentence",
        questionText,
        isCorrect: isAllCorrect,
        isSkipped: false,
        userAnswers: userArr,
        correctAnswers: correctStrings,
        parts,
        percent: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
        correctCount,
        totalCount,
        pointsEarned,
        pointsTotal,
        media,
        sentenceTemplate: String(q.sentence || ""),
      } as ReviewItem;
    }

    // ---------------------------------------------------------------
    // MATCHING
    // ---------------------------------------------------------------
    if (q.type === "matching") {
      const pairs = Array.isArray(q.pairs) ? q.pairs : [];
      const totalPairsCount = pairs.length;

      const correctMatches: Record<string, string> = {};
      const rightLabels: Record<string, string> = {};
      const leftLabels: Record<string, string> = {};

      pairs.forEach((p: any) => {
        if (p?.id != null) {
          correctMatches[String(p.id)] = String(p.id);

          // left label
          const left = p.left;
          if (left) {
            if (left.text && String(left.text).trim()) {
              leftLabels[String(p.id)] = String(left.text).trim();
            } else if (Array.isArray(left.media) && left.media.length > 0) {
              const firstName = left.media[0]?.name?.trim();
              leftLabels[String(p.id)] = firstName || `Изображение`;
            } else {
              leftLabels[String(p.id)] = `Элемент ${String(p.id)}`;
            }
          }

          // right label
          const right = p.right;
          if (right) {
            if (right.text && String(right.text).trim()) {
              rightLabels[String(p.id)] = String(right.text).trim();
            } else if (Array.isArray(right.media) && right.media.length > 0) {
              const firstName = right.media[0]?.name?.trim();
              rightLabels[String(p.id)] = firstName || `Изображение`;
            } else {
              rightLabels[String(p.id)] = `Элемент ${String(p.id)}`;
            }
          }
        }
      });

      const answered =
        a && typeof a === "object" && Object.keys(a).length > 0;

      if (!answered) {
        statsSum.skipped++;
        statsSum.total++;
        statsSum.pointsTotal += pointsTotal;
        return {
          type: "matching",
          questionText,
          isCorrect: false,
          isSkipped: true,
          correctPairsCount: 0,
          totalPairsCount,
          userMatches: {},
          correctMatches,
          rightLabels,
          leftLabels,
          pairs,
          pointsEarned: 0,
          pointsTotal,
          media,
        } as ReviewItem;
      }

      let correctPairsCount = 0;
      const userMatches = a as Record<string, string>;

      pairs.forEach((p: any) => {
        if (p?.id != null) {
          const key = String(p.id);
          if (userMatches[key] === correctMatches[key]) {
            correctPairsCount++;
          }
        }
      });

      const fraction = safeFraction(correctPairsCount, totalPairsCount);
      const pointsEarned = Number((fraction * pointsTotal).toFixed(2));

      statsSum.pointsEarned += pointsEarned;
      statsSum.pointsTotal += pointsTotal;
      statsSum.total++;

      const isAllCorrect = correctPairsCount === totalPairsCount;
      if (isAllCorrect) statsSum.correct++;
      else statsSum.incorrect++;

      return {
        type: "matching",
        questionText,
        isCorrect: isAllCorrect,
        isSkipped: false,
        correctPairsCount,
        totalPairsCount,
        userMatches,
        correctMatches,
        rightLabels,
        leftLabels,
        pairs,
        pointsEarned,
        pointsTotal,
        media,
      } as ReviewItem;
    }

    // ---------------------------------------------------------------
    // IMAGEMAP
    // ---------------------------------------------------------------
    if (q.type === "imagemap") {
      const answersArr = Array.isArray(q.answers) ? q.answers : [];
      const pointsArr = Array.isArray(q.points) ? q.points : [];
      const totalPairsCount = answersArr.length;

      const correctMatches: Record<string, string> = {};
      const answerLabels: Record<string, string> = {};
      const pointLabels: Record<string, string> = {};

      for (const ans of answersArr) {
        const point = pointsArr.find((p: any) => p.correctAnswerId === ans.id);
        if (point) {
          correctMatches[ans.id] = point.id;
        }
        if (ans.text && String(ans.text).trim()) {
          answerLabels[ans.id] = String(ans.text).trim();
        } else if (Array.isArray(ans.media) && ans.media.length > 0) {
          const firstName = ans.media[0]?.name?.trim();
          answerLabels[ans.id] = firstName || `Ответ`;
        } else {
          answerLabels[ans.id] = `Ответ #${ans.id}`;
        }
      }

      for (const point of pointsArr) {
        pointLabels[point.id] = point.label || `Точка ${point.id}`;
      }

      const userMatches = (a && typeof a === "object" ? a : {}) as Record<string, string>;
      const answered = Object.keys(userMatches).length > 0;

      if (!answered) {
        statsSum.skipped++;
        statsSum.total++;
        statsSum.pointsTotal += pointsTotal;
        return {
          type: "imagemap",
          questionText,
          isCorrect: false,
          isSkipped: true,
          correctPairsCount: 0,
          totalPairsCount,
          userMatches: {},
          correctMatches,
          answerLabels,
          pointLabels,
          imageUrl: q.image || "",
          points: pointsArr,
          answers: answersArr,
          pointsEarned: 0,
          pointsTotal,
          media,
        } as ReviewItem;
      }

      let correctPairsCount = 0;

      for (const ans of answersArr) {
        const userPointId = userMatches[ans.id];
        const correctPointId = correctMatches[ans.id];
        if (userPointId === correctPointId) {
          correctPairsCount++;
        }
      }

      const fraction = safeFraction(correctPairsCount, totalPairsCount);
      const pointsEarned = Number((fraction * pointsTotal).toFixed(2));

      statsSum.pointsEarned += pointsEarned;
      statsSum.pointsTotal += pointsTotal;
      statsSum.total++;

      const isAllCorrect = correctPairsCount === totalPairsCount;
      if (isAllCorrect) statsSum.correct++;
      else statsSum.incorrect++;

      return {
        type: "imagemap",
        questionText,
        isCorrect: isAllCorrect,
        isSkipped: false,
        correctPairsCount,
        totalPairsCount,
        userMatches,
        correctMatches,
        answerLabels,
        pointLabels,
        imageUrl: q.image || "",
        points: pointsArr,
        answers: answersArr,
        pointsEarned,
        pointsTotal,
        media,
      } as ReviewItem;
    }

    // ---------------------------------------------------------------
    // CROSSWORD
    // ---------------------------------------------------------------
    if (q.type === "crossword") {
      const grid: string[][] = Array.isArray(q.grid) ? q.grid as string[][] : [];
      const words: any[] = Array.isArray(q.words) ? q.words : [];
      const blocks: any[] = Array.isArray(q.blocks) ? q.blocks : [];
      const cellNumbers: Record<string, number> = q.cellNumbers || {};
      const userGrid: unknown = a;

      const rows = grid.length;
      const cols = rows > 0 ? Math.max(...grid.map(r => r?.length ?? 0)) : 0;

      const blockedSet = new Set<string>();
      for (const b of blocks) {
        if (b && typeof b === "object") blockedSet.add(`${b.row},${b.col}`);
      }

      const wordCells = new Set<string>();
      for (const w of words) {
        if (!w || typeof w !== "object") continue;
        const len = Number(w.length ?? 0);
        const dir = w.direction as string;
        const start = w.start as { row: number; col: number } | undefined;
        if (!start || !Number.isFinite(len) || len <= 0) continue;

        for (let i = 0; i < len; i++) {
          const r = dir === "across" ? start.row : start.row + i;
          const c = dir === "across" ? start.col + i : start.col;
          wordCells.add(`${r},${c}`);
        }
      }

      let totalActiveCells = 0;
      let filledCells = 0;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const key = `${r},${c}`;
          if (blockedSet.has(key)) continue;
          totalActiveCells++;
          const userLetter = (
            Array.isArray(userGrid) && Array.isArray(userGrid[r])
              ? String(userGrid[r][c] ?? "").trim()
              : ""
          );
          if (userLetter !== "") filledCells++;
        }
      }

      const percent = totalActiveCells > 0 ? Math.round((filledCells / totalActiveCells) * 100) : 0;

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

          const correctLetter = String(grid?.[r]?.[c] ?? "");
          const userLetter = (
            Array.isArray(userGrid) && Array.isArray(userGrid[r])
              ? String(userGrid[r][c] ?? "")
              : ""
          ).trim();

          correctWord += correctLetter;
          userWord += userLetter;
        }

        const isCorrect = userWord.toUpperCase() === correctWord.toUpperCase() && userWord !== "";

        if (isCorrect) {
          correctWords.push({ number, direction: dir, word: correctWord.toUpperCase() });
        } else {
          wrongWords.push({ number, direction: dir, user: userWord || "(пусто)", correct: correctWord.toUpperCase() });
        }
      }

      const answered = filledCells > 0;
      let correctPairsCount = correctWords.length;
      let fraction = safeFraction(correctPairsCount, totalWords);
      const pointsEarned = Number((fraction * pointsTotal).toFixed(2));
      
      statsSum.pointsEarned += pointsEarned;
      statsSum.pointsTotal += pointsTotal;
      statsSum.total++;

      if (correctPairsCount === totalWords && totalWords > 0) {
        statsSum.correct++;
      } else if (answered) {
        statsSum.incorrect++;
      } else {
        statsSum.skipped++;
      }

      return {
        type: "crossword",
        questionText,
        isCorrect: correctPairsCount === totalWords && totalWords > 0,
        isSkipped: !answered,
        pointsEarned,
        pointsTotal,
        note: answered ? `Правильно слов: ${correctPairsCount} из ${totalWords}` : "Кроссворд не заполнен",
        crosswordStats: { filled: filledCells, total: totalActiveCells, percent },
        wordReview: { wrong: wrongWords, correct: correctWords },
        grid,
        userGrid: (userGrid as string[][]) || [],
        cellNumbers,
        blocks,
        words,
        media,
      } as ReviewItem;
    }

    // ---------------------------------------------------------------
    // OTHER
    // ---------------------------------------------------------------
    statsSum.skipped++;
    statsSum.total++;
    statsSum.pointsTotal += pointsTotal;
    
    return {
      type: "other",
      questionText,
      isCorrect: false,
      isSkipped: true,
      note: "Тип вопроса пока не поддержан в стандартном Review (отрабатывается отдельно).",
      pointsEarned: 0,
      pointsTotal,
      media,
    } as ReviewItem;
  }

  questions.forEach((q, i) => {
    review.push(processQ(q, (safeAnswers as any)[i], String(i + 1)));
  });

  const score = clampScore(safeFraction(statsSum.pointsEarned, statsSum.pointsTotal) * 100);

  return {
    stats: {
      score,
      correct: statsSum.correct,
      incorrect: statsSum.incorrect,
      skipped: statsSum.skipped,
      total: statsSum.total,
      pointsEarned: Number(statsSum.pointsEarned.toFixed(2)),
      pointsTotal: statsSum.pointsTotal,
    },
    review,
  };
}