// ===== Modes =====
export type EditorMode = "visual" | "json";

// ===== Question types =====
export type QuestionType =
  | "test"
  | "fill"
  | "sentence"
  | "crossword"
  | "complex"
  | "matching"
  | "imagemap"
  | "reading";

// ===== Media =====
export type MediaType = "image" | "audio" | "pdf";

export type MediaAttachment = {
  id: string;
  url: string;
  type: MediaType;
  name?: string; // Имя файла (особенно полезно для PDF)
};

// ===== Base =====
export type BaseQuestion = {
  id: string;
  type: QuestionType;
  q?: string;
  image?: string; // Устаревшее (оставлено для совместимости старых данных) — также используется для imagemap
  media?: MediaAttachment[]; // Новый массив медиа-файлов
};

// ===== Test =====
export type TestOption = {
  id: string;
  text: string;
  media?: MediaAttachment[];
};

export type TestQuestion = BaseQuestion & {
  type: "test";
  multiple?: boolean; // Чекбокс для множественного выбора
  options: TestOption[]; // Обновленная структура опций с поддержкой медиа
  correct: number[]; // Массив индексов правильных ответов (даже если один)
  layout?: "vertical" | "horizontal"; // раскладка вариантов: вертикально (по умолчанию) или сеткой до 3 в ряд
};

// ===== Fill =====
export type FillQuestion = BaseQuestion & {
  type: "fill";
  answers: string[][];
};

// ===== Sentence =====
export type SentenceQuestion = BaseQuestion & {
  type: "sentence";
  sentence: string;
  answers: string[][];
};

// ===== Complex =====
export type ComplexQuestion = BaseQuestion & {
  type: "complex";
  subQuestions: Question[]; // Вложенные вопросы
};

// ===== Matching =====
export type MatchingItem = {
  text?: string;
  media?: MediaAttachment[];
};

export type MatchingPair = {
  id: string;
  left: MatchingItem;
  right: MatchingItem;
};

export type MatchingQuestion = BaseQuestion & {
  type: "matching";
  centerImage?: MediaAttachment; // То самое "центральное изображение"
  pairs: MatchingPair[];
};

// ===== Reading =====
export type ReadingQuestion = BaseQuestion & {
  type: "reading";
  /** общий текст или инструкция */
  text?: string;
  /** серия тестовых подвопросов */
  subQuestions: TestQuestion[];
};

// ===== Crossword (editor helpers) =====
export type WordDir = "across" | "down";

export type CWWord = {
  id: string;
  number: number; // 1..N
  text: string; // UPPER
  direction: WordDir;
  start: { row: number; col: number };
  length: number;
};

export type CWBlock = { row: number; col: number };

// В metadata мы храним и “сохранённые” вещи, и состояние редактора (placing/deleteMode)
export type CrosswordMetadata = {
  rows: number;
  cols: number;
  nextWordNumber?: number;

  // editor-state (не критично для ученика, но нужно админу)
  placingWord?: {
    text: string;
    direction: WordDir;
    number: number;
  } | null;

  deleteMode?: boolean;
};

// ===== Crossword =====
export type CrosswordQuestion = BaseQuestion & {
  type: "crossword";
  grid: string[][]; // letters (admin view)
  words: CWWord[];
  blocks?: CWBlock[];
  cellNumbers?: Record<string, number>; // "r,c" -> number
  metadata: CrosswordMetadata;
};

// ===== Image Map =====
export type ImageMapPoint = {
  id: string;
  x: number; // 0..100 (% от ширины)
  y: number; // 0..100 (% от высоты)
  correctAnswerId: string;
  label?: string; // вспомогательная подпись для админа/ученика
};

export type ImageMapAnswer = {
  id: string;
  text?: string;
  media?: MediaAttachment[];   // может быть картинкой
};

export type ImageMapQuestion = BaseQuestion & {
  type: "imagemap";
  image: string;               // URL центральной картинки (обязателен)
  points: ImageMapPoint[];
  answers: ImageMapAnswer[];
};

// ===== Union =====
export type Question =
  | TestQuestion
  | FillQuestion
  | SentenceQuestion
  | CrosswordQuestion
  | ComplexQuestion
  | MatchingQuestion
  | ImageMapQuestion
  | ReadingQuestion;

// ===== Helpers =====
export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

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
      correct: [0], // По умолчанию первый вариант верный
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
        {
          id: firstPointId,
          x: 50,
          y: 50,
          correctAnswerId: firstAnswerId,
          label: "Точка 1",
        },
      ],
      answers: [
        {
          id: firstAnswerId,
          text: "Ответ 1",
          media: [],
        },
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

  // crossword
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