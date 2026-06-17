// app/(admin)/admin/assignments/builder/types.ts

// 1. Делаем "мост": экспортируем ВСЕ типы из нашего нового глобального ядра.
// Благодаря этому ни один из компонентов админки не сломается!
export * from "@/lib/assignments/types";

// 2. Импортируем нужные типы для локальных фабрик (функций создания)
import type {
  BlockType,
  InfoBlock,
  TextSectionBlock,
  QuestionType,
  Question
} from "@/lib/assignments/types";

// Специфичный тип только для админки (режим редактора)
export type EditorMode = "visual" | "json";

// ==========================================
// ФУНКЦИИ-ХЕЛПЕРЫ (FACTORY)
// ==========================================

export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

// Хелпер для создания новых блоков ознакомительного режима
export function newBlock(type: BlockType): InfoBlock {
  const id = crypto.randomUUID();

  switch (type) {
    case "hero":
      return {
        id,
        type: "hero",
        data: { title: "Новый заголовок", badge: "", subtitle: "", pills: [] },
      };
    case "text_section":
      return {
        id,
        type: "text_section",
        data: { label: "", title: "", content: "Текст блока..." },
      };
    case "alert":
      return {
        id,
        type: "alert",
        data: { theme: "info", icon: "ℹ️", content: "Обратите внимание..." },
      };
    case "video":
      return {
        id,
        type: "video",
        data: { url: "", caption: "Название видео", subCaption: "" },
      };
    case "cards_grid":
      return {
        id,
        type: "cards_grid",
        data: {
          columns: 2,
          items: [
            { id: crypto.randomUUID(), title: "Карточка 1", content: "Описание", theme: "default" },
            { id: crypto.randomUUID(), title: "Карточка 2", content: "Описание", theme: "default" },
          ],
        },
      };
    case "accordion":
      return {
        id,
        type: "accordion",
        data: {
          items: [
            { id: crypto.randomUUID(), title: "Новый вопрос/задание", content: "Описание", tag: "" },
          ],
        },
      };
    case "downloads":
      return {
        id,
        type: "downloads",
        data: {
          files: [
            {
              id: crypto.randomUUID(),
              name: "Новый файл",
              url: "",
              fileType: "PDF",
              theme: "default",
              icon: "📄",
            },
          ],
        },
      };
    default:
      // Фолбэк на базовый текст, если что-то пошло не так
      return { id, type: "text_section", data: { content: "" } } as TextSectionBlock;
  }
}

// Хелпер для создания новых вопросов
export function newQuestion(type: QuestionType): Question {
  const id = crypto.randomUUID();

  if (type === "test") {
    return {
      id,
      type: "test",
      q: "",
      multiple: false,
      media: [],
      layout: "vertical",
      options: [
        { id: crypto.randomUUID(), text: "", media: [] },
        { id: crypto.randomUUID(), text: "", media: [] },
      ],
      correct: [0],
    };
  }

  if (type === "fill") {
    return {
      id,
      type: "fill",
      q: "",
      media: [],
      answers: [[""]],
    };
  }

  if (type === "sentence") {
    return {
      id,
      type: "sentence",
      q: "",
      media: [],
      sentence: "",
      answers: [],
    };
  }

  if (type === "complex") {
    return {
      id,
      type: "complex",
      q: "",
      media: [],
      subQuestions: [],
    };
  }

  if (type === "matching") {
    return {
      id,
      type: "matching",
      q: "",
      media: [],
      pairs: [
        {
          id: crypto.randomUUID(),
          left: { text: "", media: [] },
          right: { text: "", media: [] },
        },
      ],
    };
  }

  if (type === "imagemap") {
    const firstPointId = crypto.randomUUID();
    const firstAnswerId = crypto.randomUUID();
    return {
      id,
      type: "imagemap",
      q: "",
      image: "",
      media: [],
      points: [
        { id: firstPointId, x: 50, y: 50, correctAnswerId: firstAnswerId, label: "Точка 1" },
      ],
      answers: [
        { id: firstAnswerId, text: "Ответ 1", media: [] },
      ],
    };
  }

  if (type === "reading") {
    const subId = crypto.randomUUID();
    return {
      id,
      type: "reading",
      q: "",
      media: [],
      text: "",
      subQuestions: [
        {
          id: subId,
          type: "test",
          q: "",
          multiple: false,
          media: [],
          layout: "vertical",
          options: [
            { id: crypto.randomUUID(), text: "", media: [] },
            { id: crypto.randomUUID(), text: "", media: [] },
          ],
          correct: [0],
        },
      ],
    };
  }

  return {
    id,
    type: "crossword",
    q: "",
    media: [],
    grid: Array.from({ length: 15 }, () => Array.from({ length: 15 }, () => "")),
    words: [],
    blocks: [],
    cellNumbers: {},
    metadata: {
      rows: 15,
      cols: 15,
      nextWordNumber: 1,
      placingWord: null,
      deleteMode: false,
    },
  };
}