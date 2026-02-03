import { normalizeText } from "./normalize";
import type { FinalStats, QuestionAny, ReviewItem } from "./types";

/**
 * В твоих типах ReviewItem для fill/sentence ожидается:
 * - correctAnswers: string[]
 * - userAnswers: string[]
 * - parts: ReviewPart[]
 * - percent, correctCount, totalCount
 * - pointsEarned, pointsTotal
 *
 * Для test — userLabel/correctLabel и тоже points*
 */

export function validateAllAnswered(questions: QuestionAny[], answers: any) {
  for (let i = 0; i < questions.length; i++) {
    const q: any = questions[i];
    const a = answers[i];

    if (q.type === "test") {
      const has = a !== undefined && a !== null && a !== "";
      if (!has) return { ok: false as const, index: i };
    } else if (q.type === "fill") {
      const correctCount = (q.answers || []).length;
      const has =
        Array.isArray(a) &&
        a.length >= correctCount &&
        a.every((x: any) => String(x ?? "").trim() !== "");
      if (!has) return { ok: false as const, index: i };
    } else if (q.type === "sentence") {
      const gaps = (String(q.sentence || "").match(/___/g) || []).length;
      const has =
        Array.isArray(a) &&
        a.length >= gaps &&
        a.every((x: any) => String(x ?? "").trim() !== "");
      if (!has) return { ok: false as const, index: i };
    }
  }
  return { ok: true as const, index: -1 };
}

// строим "правильные ответы" как string[] (каждый элемент "a or b")
function buildCorrectStrings(arr: any[]): string[] {
  return (arr || []).map((variants: any) =>
    (Array.isArray(variants) ? variants : [variants]).map(String).join(" или ")
  );
}

// универсальный pointsTotal (если нет — 1)
function getPointsTotal(q: any): number {
  const p = Number(q?.points);
  return Number.isFinite(p) && p > 0 ? p : 1;
}

// parts для fill/sentence: на каждую ячейку
function buildParts(correctAnswers: any[], userArr: string[], totalCount: number) {
  // ReviewPart тип импортировать не надо — TS выведет из ReviewItem["parts"][number]
  // поэтому делаем как any и не ломаем типы проекта
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

export function calcAndBuildReview(
  questions: QuestionAny[],
  answers: any
): { stats: FinalStats; review: ReviewItem[] } {
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;

  let pointsTotalSum = 0;
  let pointsEarnedSum = 0;

  const review: ReviewItem[] = [];

  questions.forEach((q: any, i) => {
    const questionText = String(q?.q ?? "").trim() || `Вопрос ${i + 1}`;
    const a = answers[i];

    const pointsTotal = getPointsTotal(q);

    // TEST
    if (q.type === "test") {
      pointsTotalSum += pointsTotal;

      const opts: string[] = Array.isArray(q.options) ? q.options.map(String) : [];
      const correctIdx = Number(q.correct);
      const correctLabel =
        Number.isFinite(correctIdx) && opts[correctIdx] ? opts[correctIdx] : "—";

      const answered = a !== undefined && a !== null && a !== "";
      if (!answered) {
        skipped++;
        review.push({
          type: "test",
          questionText,
          isCorrect: false,
          isSkipped: true,
          userLabel: "Не отвечено",
          correctLabel,
          pointsEarned: 0,
          pointsTotal,
        } as ReviewItem);
        return;
      }

      const userIdx = Number(a);
      const userLabel = Number.isFinite(userIdx) && opts[userIdx] ? opts[userIdx] : String(a);
      const isCorrect = userIdx === correctIdx;

      if (isCorrect) {
        correct++;
        pointsEarnedSum += pointsTotal;
      } else {
        incorrect++;
      }

      review.push({
        type: "test",
        questionText,
        isCorrect,
        isSkipped: false,
        userLabel,
        correctLabel,
        pointsEarned: isCorrect ? pointsTotal : 0,
        pointsTotal,
      } as ReviewItem);
      return;
    }

    // FILL
    if (q.type === "fill") {
      pointsTotalSum += pointsTotal;

      const correctAnswers = Array.isArray(q.answers) ? q.answers : [];
      const totalCount = correctAnswers.length;

      const answered =
        Array.isArray(a) &&
        a.length >= totalCount &&
        a.every((x: any) => String(x ?? "").trim() !== "");

      const correctStrings = buildCorrectStrings(correctAnswers);

      // user answers (строки)
      const userArr: string[] = Array.isArray(a) ? (a as any[]).map((x) => String(x ?? "")) : [];

      if (!answered) {
        skipped++;

        const parts = buildParts(correctAnswers, userArr, totalCount);
        const correctCount = parts.filter((p) => p.isCorrect).length;
        const percent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

        review.push({
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
        } as ReviewItem);
        return;
      }

      const parts = buildParts(correctAnswers, userArr, totalCount);
      const correctCount = parts.filter((p) => p.isCorrect).length;
      const ok = correctCount === totalCount;

      const percent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

      if (ok) {
        correct++;
        pointsEarnedSum += pointsTotal;
      } else {
        incorrect++;
      }

      review.push({
        type: "fill",
        questionText,
        isCorrect: ok,
        isSkipped: false,
        userAnswers: userArr,
        correctAnswers: correctStrings,
        parts,
        percent,
        correctCount,
        totalCount,
        pointsEarned: ok ? pointsTotal : 0,
        pointsTotal,
      } as ReviewItem);
      return;
    }

    // SENTENCE
    if (q.type === "sentence") {
      pointsTotalSum += pointsTotal;

      const gaps = (String(q.sentence || "").match(/___/g) || []).length;
      const correctAnswers = Array.isArray(q.answers) ? q.answers : [];
      const totalCount = gaps;

      const correctStrings = buildCorrectStrings(correctAnswers);

      const answered =
        Array.isArray(a) &&
        a.length >= gaps &&
        a.every((x: any) => String(x ?? "").trim() !== "");

      const userArr: string[] = Array.isArray(a)
        ? (a as any[]).slice(0, gaps).map((x) => String(x ?? ""))
        : [];

      if (!answered) {
        skipped++;

        const parts = buildParts(correctAnswers, userArr, totalCount);
        const correctCount = parts.filter((p) => p.isCorrect).length;
        const percent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

        review.push({
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
        } as ReviewItem);
        return;
      }

      const parts = buildParts(correctAnswers, userArr, totalCount);
      const correctCount = parts.filter((p) => p.isCorrect).length;
      const ok = correctCount === totalCount;

      const percent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

      if (ok) {
        correct++;
        pointsEarnedSum += pointsTotal;
      } else {
        incorrect++;
      }

      review.push({
        type: "sentence",
        questionText,
        isCorrect: ok,
        isSkipped: false,
        userAnswers: userArr,
        correctAnswers: correctStrings,
        parts,
        percent,
        correctCount,
        totalCount,
        pointsEarned: ok ? pointsTotal : 0,
        pointsTotal,
      } as ReviewItem);
      return;
    }

    // OTHER
    pointsTotalSum += pointsTotal;
    skipped++;
    review.push({
      type: "other",
      questionText,
      isCorrect: false,
      isSkipped: true,
      note: "Тип вопроса пока не поддержан (добавим позже).",
      pointsEarned: 0,
      pointsTotal,
    } as ReviewItem);
  });

  const total = correct + incorrect + skipped;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  // ✅ НЕ трогаю твой FinalStats тип — кладу только базовые поля
  // (points* уже есть в review, а общий подсчет если нужен — можно добавить в types.ts)
  return {
    stats: { score, correct, incorrect, skipped, total } as FinalStats,
    review,
  };
}
