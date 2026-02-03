import { normalizeText } from "./normalize";
import type { FinalStats, QuestionAny, ReviewItem } from "./types";

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
        Array.isArray(a) && a.length >= correctCount && a.every((x: any) => String(x ?? "").trim() !== "");
      if (!has) return { ok: false as const, index: i };
    } else if (q.type === "sentence") {
      const gaps = (String(q.sentence || "").match(/___/g) || []).length;
      const has =
        Array.isArray(a) && a.length >= gaps && a.every((x: any) => String(x ?? "").trim() !== "");
      if (!has) return { ok: false as const, index: i };
    }
  }
  return { ok: true as const, index: -1 };
}

export function calcAndBuildReview(questions: QuestionAny[], answers: any): { stats: FinalStats; review: ReviewItem[] } {
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;

  const review: ReviewItem[] = [];

  questions.forEach((q: any, i) => {
    const questionText = String(q?.q ?? "").trim() || `Вопрос ${i + 1}`;
    const a = answers[i];

    // TEST
    if (q.type === "test") {
      const opts: string[] = Array.isArray(q.options) ? q.options.map(String) : [];
      const correctIdx = Number(q.correct);
      const correctLabel = Number.isFinite(correctIdx) && opts[correctIdx] ? opts[correctIdx] : "—";

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
        });
        return;
      }

      const userIdx = Number(a);
      const userLabel = Number.isFinite(userIdx) && opts[userIdx] ? opts[userIdx] : String(a);
      const isCorrect = userIdx === correctIdx;

      if (isCorrect) correct++;
      else incorrect++;

      review.push({
        type: "test",
        questionText,
        isCorrect,
        isSkipped: false,
        userLabel,
        correctLabel,
      });
      return;
    }

    // FILL
    if (q.type === "fill") {
      const correctAnswers = Array.isArray(q.answers) ? q.answers : [];
      const answered =
        Array.isArray(a) &&
        a.length >= correctAnswers.length &&
        a.every((x: any) => String(x ?? "").trim() !== "");

      const correctText = correctAnswers.map((variants: any) =>
        (Array.isArray(variants) ? variants : [variants]).map(String).join(" или ")
      );

      if (!answered) {
        skipped++;
        review.push({
          type: "fill",
          questionText,
          isCorrect: false,
          isSkipped: true,
          userAnswers: Array.isArray(a) ? a.map((x: any) => String(x ?? "")) : [],
          correctAnswers: correctText,
        });
        return;
      }

      const userArr: string[] = (a as any[]).map((x) => String(x ?? ""));
      const ok = correctAnswers.every((variants: any, idx: number) => {
        const user = normalizeText(userArr[idx]);
        const vars = (Array.isArray(variants) ? variants : [variants]).map(normalizeText);
        return vars.some((v) => v === user);
      });

      if (ok) correct++;
      else incorrect++;

      review.push({
        type: "fill",
        questionText,
        isCorrect: ok,
        isSkipped: false,
        userAnswers: userArr,
        correctAnswers: correctText,
      });
      return;
    }

    // SENTENCE
    if (q.type === "sentence") {
      const gaps = (String(q.sentence || "").match(/___/g) || []).length;
      const correctAnswers = Array.isArray(q.answers) ? q.answers : [];

      const correctText = correctAnswers.map((variants: any) =>
        (Array.isArray(variants) ? variants : [variants]).map(String).join(" или ")
      );

      const answered =
        Array.isArray(a) && a.length >= gaps && a.every((x: any) => String(x ?? "").trim() !== "");

      if (!answered) {
        skipped++;
        review.push({
          type: "sentence",
          questionText,
          isCorrect: false,
          isSkipped: true,
          userAnswers: Array.isArray(a) ? a.map((x: any) => String(x ?? "")) : [],
          correctAnswers: correctText,
        });
        return;
      }

      const userArr: string[] = (a as any[]).slice(0, gaps).map((x) => String(x ?? ""));
      const ok = correctAnswers.every((variants: any, idx: number) => {
        const user = normalizeText(userArr[idx]);
        const vars = (Array.isArray(variants) ? variants : [variants]).map(normalizeText);
        return vars.some((v) => v === user);
      });

      if (ok) correct++;
      else incorrect++;

      review.push({
        type: "sentence",
        questionText,
        isCorrect: ok,
        isSkipped: false,
        userAnswers: userArr,
        correctAnswers: correctText,
      });
      return;
    }

    // OTHER
    skipped++;
    review.push({
      type: "other",
      questionText,
      isCorrect: false,
      isSkipped: true,
      note: "Тип вопроса пока не поддержан (добавим позже).",
    });
  });

  const total = correct + incorrect + skipped;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  return {
    stats: { score, correct, incorrect, skipped, total },
    review,
  };
}
