// app/(admin)/admin/assignments/builder/validate.ts
import type { Question, TestQuestion, InfoBlock } from "./types";

export type ValidationIssue = {
  index: number; // -1 для общих ошибок
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  issues: ValidationIssue[];
};

// ==========================================
// ВАЛИДАЦИЯ ИНТЕРАКТИВНОГО РЕЖИМА (ВОПРОСЫ)
// ==========================================
export function validateQuestions(questions: Question[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!questions || !questions.length) {
    issues.push({ index: -1, message: "Нет ни одного вопроса" });
    return { ok: false, issues };
  }

  questions.forEach((q, index) => {
    // Текст или медиа обязательны (кроме кроссворда, imagemap и reading)
    if (q.type !== "crossword" && q.type !== "imagemap" && q.type !== "reading" && !q.q?.trim() && (!q.media || q.media.length === 0)) {
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
      if (!q.image || !String(q.image).trim()) {
        issues.push({ index, message: "Загрузите центральное изображение для карты" });
      }

      if (!q.points || q.points.length === 0) {
        issues.push({ index, message: "Добавьте хотя бы одну точку на изображении" });
      }

      if (!q.answers || q.answers.length === 0) {
        issues.push({ index, message: "Добавьте хотя бы один вариант ответа" });
      }

      if (q.points && q.answers) {
        const answerIds = new Set(q.answers.map(a => a.id));
        for (const point of q.points) {
          if (!point.correctAnswerId) {
            issues.push({ index, message: `Точка "${point.label || point.id}" не связана с ответом` });
          } else if (!answerIds.has(point.correctAnswerId)) {
            issues.push({ index, message: `Точка "${point.label || point.id}" ссылается на несуществующий ответ` });
          }
        }

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

    if (q.type === "reading") {
      if (!q.text?.trim() && (!q.media || q.media.length === 0)) {
        issues.push({ index, message: "Добавьте текст для чтения или прикрепите медиа" });
      }

      if (!q.subQuestions?.length) {
        issues.push({ index, message: "Добавьте хотя бы один подвопрос" });
      } else {
        (q.subQuestions as TestQuestion[]).forEach((subQ: TestQuestion, subIdx: number) => {
          if (!subQ.options || subQ.options.length < 2) {
            issues.push({ index, message: `Подвопрос ${subIdx + 1}: минимум 2 варианта ответа` });
          }
          if (!subQ.correct || subQ.correct.length === 0) {
            issues.push({ index, message: `Подвопрос ${subIdx + 1}: выберите хотя бы один правильный ответ` });
          }
        });
      }
    }
  });

  return { ok: issues.length === 0, issues };
}


// ==========================================
// ВАЛИДАЦИЯ ОЗНАКОМИТЕЛЬНОГО РЕЖИМА (БЛОКИ)
// ==========================================
export function validateBlocks(blocks: InfoBlock[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!blocks || !blocks.length) {
    issues.push({ index: -1, message: "Нет ни одного блока. Добавьте хотя бы один." });
    return { ok: false, issues };
  }

  blocks.forEach((block, index) => {
    if (block.type === "hero") {
      if (!block.data.title?.trim()) {
        issues.push({ index, message: "Блок 'Обложка': добавьте заголовок." });
      }
    }

    if (block.type === "text_section") {
      if (!block.data.content?.trim()) {
        issues.push({ index, message: "Блок 'Текст': содержимое не может быть пустым." });
      }
    }

    if (block.type === "alert") {
      if (!block.data.content?.trim()) {
        issues.push({ index, message: "Блок 'Предупреждение': введите текст предупреждения." });
      }
    }

    if (block.type === "video") {
      if (!block.data.url?.trim()) {
        issues.push({ index, message: "Блок 'Видео': укажите ссылку на видео (URL)." });
      }
    }

    if (block.type === "cards_grid") {
      if (!block.data.items || block.data.items.length === 0) {
        issues.push({ index, message: "Блок 'Сетка карточек': добавьте хотя бы одну карточку." });
      } else {
        block.data.items.forEach((item, i) => {
          if (!item.title?.trim()) {
            issues.push({ index, message: `Сетка карточек (Карточка ${i + 1}): укажите заголовок.` });
          }
        });
      }
    }

    if (block.type === "accordion") {
      if (!block.data.items || block.data.items.length === 0) {
        issues.push({ index, message: "Блок 'Спойлеры/FAQ': добавьте хотя бы один пункт." });
      } else {
        block.data.items.forEach((item, i) => {
          if (!item.title?.trim() || !item.content?.trim()) {
            issues.push({ index, message: `Спойлеры (Пункт ${i + 1}): укажите заголовок и содержимое.` });
          }
        });
      }
    }

    if (block.type === "downloads") {
      if (!block.data.files || block.data.files.length === 0) {
        issues.push({ index, message: "Блок 'Файлы': добавьте хотя бы один файл для скачивания." });
      } else {
        block.data.files.forEach((file, i) => {
          if (!file.name?.trim() || !file.url?.trim()) {
            issues.push({ index, message: `Файлы (Файл ${i + 1}): укажите название и прикрепите файл (URL).` });
          }
        });
      }
    }
  });

  return { ok: issues.length === 0, issues };
}