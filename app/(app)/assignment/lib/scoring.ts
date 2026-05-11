// app/(app)/assignment/lib/scoring.ts
import { normalizeText } from "./normalize";
import type { FinalStats, ReviewItem } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCorrectStrings(arr: any[]): string[] {
  return (arr || []).map((variants: any) =>
    (Array.isArray(variants) ? variants : [variants]).map(String).join(" или ")
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

    const varsNorm = (Array.isArray(variants) ? variants : [variants]).map((v: any) =>
      normalizeText(String(v))
    );

    const ok = userNorm.length > 0 && varsNorm.some((v) => v === userNorm);

    parts.push({
      index: idx,
      isCorrect: ok,
      user: userRaw,
      correct: (Array.isArray(variants) ? variants : [variants]).map(String),
    });
  }
  return parts;
}

/**
 * Безопасно клампает финальный score в диапазон 0–100.
 * Защита от NaN / Infinity / отрицательных значений.
 */
function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Безопасно вычисляет долю: earned / total.
 * Возвращает 0 если total <= 0 или результат не конечный.
 */
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
  // Defensive guard: если questions не массив — считаем что всё ок (нечего валидировать)
  if (!Array.isArray(questions)) return { ok: true, index: -1 };

  // Defensive guard: если answers не объект — считаем что ничего не отвечено
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
    } else if (q.type === "matching") {
      const pairs = q.pairs || [];
      const has =
        a && typeof a === "object" && Object.keys(a).length === pairs.length;
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
  // Defensive guard: если пришёл мусор — возвращаем пустой результат
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

  // Defensive guard: answers должен быть объектом (массивом или обычным объектом)
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
    // Defensive guard: если вопрос битый — возвращаем skipped
    if (!q || typeof q !== "object") {
      statsSum.skipped++;
      statsSum.total++;
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
      } as ReviewItem;
    }

    // ---------------------------------------------------------------
    // COUNT TOTALS
    // ---------------------------------------------------------------
    statsSum.total++;
    statsSum.pointsTotal += pointsTotal;

    // ---------------------------------------------------------------
    // TEST
    // ---------------------------------------------------------------
    if (q.type === "test") {
      const isMultiple = !!q.multiple;
      const opts: any[] = Array.isArray(q.options) ? q.options : [];

      const getOptText = (idx: number) => {
        const opt = opts[idx];
        if (!opt) return "—";
        return typeof opt === "string" ? opt : opt.text || `Вариант ${idx + 1}`;
      };

      const correctArr = Array.isArray(q.correct)
        ? q.correct
        : typeof q.correct === "number"
          ? [q.correct]
          : [];
      const correctLabels = correctArr.map((c: any) => getOptText(Number(c)));

      const answered = isMultiple
        ? Array.isArray(a) && a.length > 0
        : a !== undefined && a !== null && a !== "";

      if (!answered) {
        statsSum.skipped++;
        return {
          type: "test",
          questionText,
          isCorrect: false,
          isSkipped: true,
          userLabel: isMultiple ? [] : "Не отвечено",
          correctLabel: isMultiple ? correctLabels : correctLabels[0] || "—",
          isMultiple,
          fraction: 0,
          pointsEarned: 0,
          pointsTotal,
        } as ReviewItem;
      }

      let fraction = 0;
      let isCorrect = false;
      let userLabels: string | string[] = [];

      if (isMultiple) {
        const userArr = Array.isArray(a) ? a.map(Number) : [];
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
        // Дополнительная защита: fraction должен быть в [0, 1]
        fraction = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
        isCorrect = fraction === 1;
      } else {
        const userIdx = Number(a);
        userLabels = getOptText(userIdx);
        const correctIdx = Number(correctArr[0]);
        isCorrect = userIdx === correctIdx;
        fraction = isCorrect ? 1 : 0;
      }

      const pointsEarned = Number((fraction * pointsTotal).toFixed(2));
      statsSum.pointsEarned += pointsEarned;

      if (isCorrect) statsSum.correct++;
      else statsSum.incorrect++;

      return {
        type: "test",
        questionText,
        isCorrect,
        isSkipped: false,
        userLabel: userLabels,
        correctLabel: isMultiple ? correctLabels : correctLabels[0] || "—",
        fraction,
        isMultiple,
        pointsEarned,
        pointsTotal,
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
        } as ReviewItem;
      }

      const parts = buildParts(correctAnswers, userArr, totalCount);
      const correctCount = parts.filter((p) => p.isCorrect).length;
      const fraction = safeFraction(correctCount, totalCount);
      const pointsEarned = Number((fraction * pointsTotal).toFixed(2));

      statsSum.pointsEarned += pointsEarned;

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
        } as ReviewItem;
      }

      const parts = buildParts(correctAnswers, userArr, totalCount);
      const correctCount = parts.filter((p) => p.isCorrect).length;
      const fraction = safeFraction(correctCount, totalCount);
      const pointsEarned = Number((fraction * pointsTotal).toFixed(2));

      statsSum.pointsEarned += pointsEarned;

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
      } as ReviewItem;
    }

    // ---------------------------------------------------------------
    // MATCHING
    // ---------------------------------------------------------------
    if (q.type === "matching") {
      const pairs = Array.isArray(q.pairs) ? q.pairs : [];
      const totalPairsCount = pairs.length;

      const correctMatches: Record<string, string> = {};
      pairs.forEach((p: any) => {
        if (p?.id != null) {
          correctMatches[String(p.id)] = String(p.id);
        }
      });

      const answered =
        a && typeof a === "object" && Object.keys(a).length > 0;

      if (!answered) {
        statsSum.skipped++;
        return {
          type: "matching",
          questionText,
          isCorrect: false,
          isSkipped: true,
          correctPairsCount: 0,
          totalPairsCount,
          userMatches: {},
          correctMatches,
          pointsEarned: 0,
          pointsTotal,
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
        pointsEarned,
        pointsTotal,
      } as ReviewItem;
    }

    // ---------------------------------------------------------------
    // OTHER / CROSSWORD
    // ---------------------------------------------------------------
    statsSum.skipped++;
    return {
      type: "other",
      questionText,
      isCorrect: false,
      isSkipped: true,
      note: "Тип вопроса пока не поддержан в стандартном Review (отрабатывается отдельно).",
      pointsEarned: 0,
      pointsTotal,
    } as ReviewItem;
  }

  // -----------------------------------------------------------------------
  // Process each question
  // -----------------------------------------------------------------------
  questions.forEach((q, i) => {
    review.push(processQ(q, (safeAnswers as any)[i], String(i + 1)));
  });

  // Финальный score клампаем в [0, 100] — защита от деления на 0 и NaN
  const score = clampScore(
    safeFraction(statsSum.pointsEarned, statsSum.pointsTotal) * 100
  );

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