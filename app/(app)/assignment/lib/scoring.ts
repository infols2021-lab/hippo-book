import { normalizeText } from "./normalize";
import type { FinalStats, QuestionAny, ReviewItem } from "./types";

export function validateAllAnswered(
  questions: QuestionAny[],
  answers: any
): { ok: boolean; index: number; subIndex?: number } {
  for (let i = 0; i < questions.length; i++) {
    const q: any = questions[i];
    const a = answers[i];

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
      const has = a && typeof a === "object" && Object.keys(a).length === pairs.length;
      if (!has) return { ok: false, index: i };
    }
  }
  return { ok: true, index: -1 };
}

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

export function calcAndBuildReview(
  questions: QuestionAny[],
  answers: any
): { stats: FinalStats; review: ReviewItem[] } {
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
    const questionText = String(q?.q ?? "").trim() || `Вопрос ${idxText}`;
    const pointsTotal = getPointsTotal(q);

    // COMPLEX - Обработка "матрешки"
    if (q.type === "complex") {
      const subQs = q.subQuestions || [];
      const subAns = Array.isArray(a) ? a : [];

      const subReviews: ReviewItem[] = [];
      let complexEarned = 0;
      let complexTotal = 0;
      let complexAllSkipped = true;
      let complexAllCorrect = true;

      subQs.forEach((sq: any, subI: number) => {
        const sr = processQ(sq, subAns[subI], `${idxText}.${subI + 1}`);
        subReviews.push(sr);
        complexEarned += sr.pointsEarned;
        complexTotal += sr.pointsTotal;
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

    // === БАЗОВЫЕ ВОПРОСЫ (Добавляются в статистику) ===
    statsSum.total++;
    statsSum.pointsTotal += pointsTotal;

    // TEST
    if (q.type === "test") {
      const isMultiple = !!q.multiple;
      const opts: any[] = Array.isArray(q.options) ? q.options : [];
      
      const getOptText = (idx: number) => {
        const opt = opts[idx];
        if (!opt) return "—";
        return typeof opt === "string" ? opt : (opt.text || `Вариант ${idx + 1}`);
      };

      const correctArr = Array.isArray(q.correct) ? q.correct : (typeof q.correct === "number" ? [q.correct] : []);
      const correctLabels = correctArr.map((c: any) => getOptText(Number(c)));

      const answered = isMultiple 
        ? (Array.isArray(a) && a.length > 0)
        : (a !== undefined && a !== null && a !== "");

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

        // Дробный подсчет с защитой от "прокликивания" всех вариантов
        const totalCorrect = correctSet.size || 1;
        fraction = Math.max(0, correctSelected - wrongSelected) / totalCorrect;
        isCorrect = fraction === 1;
      } else {
        const userIdx = Number(a);
        userLabels = getOptText(userIdx) as string;
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

    // FILL
    if (q.type === "fill") {
      const correctAnswers = Array.isArray(q.answers) ? q.answers : [];
      const totalCount = correctAnswers.length;
      const answered = Array.isArray(a) && a.length >= totalCount && a.every((x: any) => String(x ?? "").trim() !== "");
      const correctStrings = buildCorrectStrings(correctAnswers);
      const userArr: string[] = Array.isArray(a) ? (a as any[]).map((x) => String(x ?? "")) : [];

      if (!answered) {
        statsSum.skipped++;
        const parts = buildParts(correctAnswers, userArr, totalCount);
        const correctCount = parts.filter((p) => p.isCorrect).length;
        const percent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

        return {
          type: "fill", questionText, isCorrect: false, isSkipped: true,
          userAnswers: userArr, correctAnswers: correctStrings, parts,
          percent, correctCount, totalCount, pointsEarned: 0, pointsTotal,
        } as ReviewItem;
      }

      const parts = buildParts(correctAnswers, userArr, totalCount);
      const correctCount = parts.filter((p) => p.isCorrect).length;
      const ok = correctCount === totalCount;
      const percent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

      if (ok) {
        statsSum.correct++;
        statsSum.pointsEarned += pointsTotal;
      } else {
        statsSum.incorrect++;
      }

      return {
        type: "fill", questionText, isCorrect: ok, isSkipped: false,
        userAnswers: userArr, correctAnswers: correctStrings, parts,
        percent, correctCount, totalCount, pointsEarned: ok ? pointsTotal : 0, pointsTotal,
      } as ReviewItem;
    }

    // SENTENCE
    if (q.type === "sentence") {
      const gaps = (String(q.sentence || "").match(/___/g) || []).length;
      const correctAnswers = Array.isArray(q.answers) ? q.answers : [];
      const totalCount = gaps;
      const correctStrings = buildCorrectStrings(correctAnswers);
      const answered = Array.isArray(a) && a.length >= gaps && a.every((x: any) => String(x ?? "").trim() !== "");
      const userArr: string[] = Array.isArray(a) ? (a as any[]).slice(0, gaps).map((x) => String(x ?? "")) : [];

      if (!answered) {
        statsSum.skipped++;
        const parts = buildParts(correctAnswers, userArr, totalCount);
        const correctCount = parts.filter((p) => p.isCorrect).length;
        const percent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

        return {
          type: "sentence", questionText, isCorrect: false, isSkipped: true,
          userAnswers: userArr, correctAnswers: correctStrings, parts,
          percent, correctCount, totalCount, pointsEarned: 0, pointsTotal,
        } as ReviewItem;
      }

      const parts = buildParts(correctAnswers, userArr, totalCount);
      const correctCount = parts.filter((p) => p.isCorrect).length;
      const ok = correctCount === totalCount;
      const percent = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

      if (ok) {
        statsSum.correct++;
        statsSum.pointsEarned += pointsTotal;
      } else {
        statsSum.incorrect++;
      }

      return {
        type: "sentence", questionText, isCorrect: ok, isSkipped: false,
        userAnswers: userArr, correctAnswers: correctStrings, parts,
        percent, correctCount, totalCount, pointsEarned: ok ? pointsTotal : 0, pointsTotal,
      } as ReviewItem;
    }

    // MATCHING
    if (q.type === "matching") {
      const pairs = Array.isArray(q.pairs) ? q.pairs : [];
      const totalPairsCount = pairs.length;
      
      const answered = a && typeof a === "object" && Object.keys(a).length > 0;
      
      if (!answered) {
        statsSum.skipped++;
        return {
           type: "matching", questionText, isCorrect: false, isSkipped: true,
           correctPairsCount: 0, totalPairsCount, userMatches: {}, correctMatches: {}, pointsEarned: 0, pointsTotal
        } as ReviewItem;
      }

      let correctPairsCount = 0;
      const userMatches = a;
      const correctMatches: Record<string, string> = {};
      
      pairs.forEach((p: any) => {
        correctMatches[p.id] = p.id;
        // Пользователь в качестве ответа присылает словарь вида: id левого элемента -> id правого элемента
        if (userMatches[p.id] === p.id) {
          correctPairsCount++;
        }
      });

      const fraction = totalPairsCount > 0 ? correctPairsCount / totalPairsCount : 0;
      const pointsEarned = Number((fraction * pointsTotal).toFixed(2));
      const isCorrect = correctPairsCount === totalPairsCount && totalPairsCount > 0;

      statsSum.pointsEarned += pointsEarned;
      if (isCorrect) statsSum.correct++;
      else statsSum.incorrect++;

      return {
        type: "matching", questionText, isCorrect, isSkipped: false,
        correctPairsCount, totalPairsCount, userMatches, correctMatches,
        pointsEarned, pointsTotal
      } as ReviewItem;
    }

    // OTHER (включая crossword)
    statsSum.skipped++;
    return {
      type: "other", questionText, isCorrect: false, isSkipped: true,
      note: "Тип вопроса пока не поддержан в стандартном Review (отрабатывается отдельно).",
      pointsEarned: 0, pointsTotal,
    } as ReviewItem;
  }

  questions.forEach((q, i) => {
    review.push(processQ(q, answers[i], String(i + 1)));
  });

  // Теперь общий процент считается из честных ЗАРАБОТАННЫХ баллов
  const score = statsSum.pointsTotal > 0 
    ? Math.round((statsSum.pointsEarned / statsSum.pointsTotal) * 100) 
    : 0;

  return {
    stats: { 
      score, 
      correct: statsSum.correct, 
      incorrect: statsSum.incorrect, 
      skipped: statsSum.skipped, 
      total: statsSum.total,
      pointsEarned: Number(statsSum.pointsEarned.toFixed(2)),
      pointsTotal: statsSum.pointsTotal
    },
    review,
  };
}