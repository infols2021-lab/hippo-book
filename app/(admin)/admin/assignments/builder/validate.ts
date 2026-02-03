import type { Question } from "./types";

export type ValidationIssue = {
  index: number; // -1 для общих ошибок
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  issues: ValidationIssue[]; // ✅ ВСЕГДА ЕСТЬ
};

export function validateQuestions(questions: Question[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!questions.length) {
    issues.push({ index: -1, message: "Нет ни одного вопроса" });
    return { ok: false, issues };
  }

  questions.forEach((q, index) => {
    if (q.type !== "crossword" && !q.q?.trim()) {
      issues.push({ index, message: "Пустой текст вопроса" });
    }

    if (q.type === "test") {
      if (!q.options?.length || q.options.filter(Boolean).length < 2) {
        issues.push({ index, message: "Минимум 2 варианта ответа" });
      }
      if (typeof q.correct !== "number" || q.correct < 0 || q.correct >= (q.options?.length || 0)) {
        issues.push({ index, message: "Некорректный индекс правильного ответа" });
      }
    }

    if (q.type === "fill") {
      if (!q.answers?.length) {
        issues.push({ index, message: "Добавьте хотя бы один правильный ответ" });
      }
    }

    if (q.type === "sentence") {
      const gaps = (q.sentence?.match(/___/g) || []).length;
      if (!q.sentence?.trim() || gaps === 0) {
        issues.push({ index, message: "В предложении должны быть пропуски ___" });
      }
      if (!Array.isArray(q.answers) || q.answers.length !== gaps) {
        issues.push({ index, message: "Ответы не совпадают с количеством пропусков" });
      }
    }

    if (q.type === "crossword") {
      if (!q.words?.length) issues.push({ index, message: "В кроссворде нет слов" });
    }
  });

  return { ok: issues.length === 0, issues };
}
