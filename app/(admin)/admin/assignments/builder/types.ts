// ===== Modes =====
export type EditorMode = "visual" | "json";

// ===== Question types =====
export type QuestionType = "test" | "fill" | "sentence" | "crossword";

// ===== Base =====
export type BaseQuestion = {
  id: string;
  type: QuestionType;
  q?: string;
  image?: string;
};

// ===== Test =====
export type TestQuestion = BaseQuestion & {
  type: "test";
  options: string[];
  correct: number;
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

// ===== Union =====
export type Question = TestQuestion | FillQuestion | SentenceQuestion | CrosswordQuestion;

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
      options: ["", ""],
      correct: 0,
    };
  }

  if (type === "fill") {
    return {
      id,
      type: "fill",
      q: "",
      answers: [[""]],
    };
  }

  if (type === "sentence") {
    return {
      id,
      type: "sentence",
      sentence: "",
      answers: [],
    };
  }

  // crossword
  return {
    id,
    type: "crossword",
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
