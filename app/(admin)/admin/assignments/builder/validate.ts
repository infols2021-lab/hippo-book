// app/(admin)/admin/assignments/builder/validate.ts
import type { Question } from "./types";

export type ValidationIssue = {
  index: number; // -1 для общих ошибок
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  issues: ValidationIssue[];
};

export function validateQuestions(questions: Question[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!questions.length) {
    issues.push({ index: -1, message: "Нет ни одного вопроса" });
    return { ok: false, issues };
  }

  questions.forEach((q, index) => {
    // Текст или медиа обязательны (кроме кроссворда и imagemap)
    if (q.type !== "crossword" && q.type !== "imagemap" && !q.q?.trim() && (!q.media || q.media.length === 0)) {
      issues.push({ index, message: "Добавьте текст вопроса или прикрепите медиа-файл" });
    }

    if (q.type === "test") {
      if (!q.options?.length || q.options.length < 2) {
        issues.push({ index, message: "Минимум 2 варианта ответа" });
      }
      
      if (!q.correct || q.correct.length === 0) {
        issues.push({ index, message: "Выберите хотя бы один правильный ответ" });
      }

      if (!q.multiple && q.correct && q.correct.length > 1) {
        issues.push({ index, message: "Для одиночного выбора должен быть только 1 правильный ответ" });
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

    if (q.type === "complex") {
      if (!q.subQuestions?.length) {
        issues.push({ index, message: "Комплексный вопрос должен содержать хотя бы один подвопрос" });
      } else {
        const subRes = validateQuestions(q.subQuestions);
        if (!subRes.ok) {
          issues.push({ index, message: "Ошибки в подвопросах комплексного вопроса" });
        }
      }
    }

    if (q.type === "matching") {
      if (!q.pairs?.length || q.pairs.length < 2) {
        issues.push({ index, message: "Добавьте минимум 2 пары для сопоставления" });
      }
    }

    if (q.type === "imagemap") {
      // Проверка наличия центральной картинки
      if (!q.image || !String(q.image).trim()) {
        issues.push({ index, message: "Загрузите центральное изображение для карты" });
      }

      // Проверка наличия точек
      if (!q.points || q.points.length === 0) {
        issues.push({ index, message: "Добавьте хотя бы одну точку на изображении" });
      }

      // Проверка наличия ответов
      if (!q.answers || q.answers.length === 0) {
        issues.push({ index, message: "Добавьте хотя бы один вариант ответа" });
      }

      // Проверка, что каждая точка ссылается на существующий ответ
      if (q.points && q.answers) {
        const answerIds = new Set(q.answers.map(a => a.id));
        for (const point of q.points) {
          if (!point.correctAnswerId) {
            issues.push({ index, message: `Точка "${point.label || point.id}" не связана с ответом` });
          } else if (!answerIds.has(point.correctAnswerId)) {
            issues.push({ index, message: `Точка "${point.label || point.id}" ссылается на несуществующий ответ` });
          }
        }

        // Проверка 1:1 (дублирование)
        const pointToAnswer = new Map<string, string>();
        for (const point of q.points) {
          if (point.correctAnswerId) {
            const existing = pointToAnswer.get(point.correctAnswerId);
            if (existing) {
              issues.push({
                index,
                message: `Ответ "${q.answers.find(a => a.id === point.correctAnswerId)?.text || point.correctAnswerId}" используется несколькими точками. Лучше 1:1.`,
              });
              break;
            }
            pointToAnswer.set(point.correctAnswerId, point.id);
          }
        }
      }
    }
  });

  return { ok: issues.length === 0, issues };
}