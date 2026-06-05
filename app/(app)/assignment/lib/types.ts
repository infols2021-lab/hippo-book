// app/(app)/assignment/lib/types.ts

export type AssignmentBranchType = "olympiad" | "gatehouse";

export type AssignmentSource =
  | "textbook"
  | "crossword"
  | "materials"
  | "login"
  | "profile"
  | "gatehouse"
  | "gatehouse-material";

// ===== Новые типы для медиа =====
export type MediaType = "image" | "audio" | "pdf";

export type MediaAttachment = {
  id: string;
  url: string;
  type: MediaType;
  name?: string;
};

export type QuestionBase = {
  id: string;
  q?: string;
  image?: string; // Устаревшее
  media?: MediaAttachment[]; // Новое
  type?: string;
};

export type TestOption = {
  id: string;
  text: string;
  media?: MediaAttachment[];
};

export type QuestionTest = QuestionBase & {
  type: "test";
  multiple?: boolean;
  options?: TestOption[] | string[]; // Совместимость со старым форматом
  correct?: number[] | number; // Массив индексов (или число для старых)
  layout?: "vertical" | "horizontal"; // раскладка вариантов
};

export type QuestionFill = QuestionBase & {
  type: "fill";
  answers?: (string[] | string)[];
};

export type QuestionSentence = QuestionBase & {
  type: "sentence";
  sentence?: string;
  answers?: (string[] | string)[];
};

export type QuestionCrossword = QuestionBase & {
  type: "crossword";
  grid?: string[][];
  words?: any[];
  blocks?: any[];
  cellNumbers?: Record<string, number>;
  metadata?: { rows?: number; cols?: number };
};

export type QuestionComplex = QuestionBase & {
  type: "complex";
  subQuestions?: QuestionAny[];
};

export type MatchingItem = {
  text?: string;
  media?: MediaAttachment[];
};

export type MatchingPair = {
  id: string;
  left: MatchingItem;
  right: MatchingItem;
};

export type QuestionMatching = QuestionBase & {
  type: "matching";
  centerImage?: MediaAttachment;
  pairs?: MatchingPair[];
};

// ==================== Image Map Types ====================

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

export type QuestionImageMap = QuestionBase & {
  type: "imagemap";
  image: string;              // URL центральной картинки
  points: ImageMapPoint[];
  answers: ImageMapAnswer[];
};

// ==================== Reading Type ====================

export type QuestionReading = QuestionBase & {
  type: "reading";
  /** общий текст для чтения */
  text?: string;
  /** тестовые подвопросы */
  subQuestions?: QuestionTest[];
};

// ==================== Updated Any Type ====================

export type QuestionAny =
  | QuestionTest
  | QuestionFill
  | QuestionSentence
  | QuestionCrossword
  | QuestionComplex
  | QuestionMatching
  | QuestionImageMap
  | QuestionReading
  | (QuestionBase & Record<string, any>);

export type Progress = {
  is_completed: boolean;
  score: number | null;
  completed_at: string | null;
  answers: Record<string, any>; // ИЗМЕНЕНО: вместо any, чтобы хранить по question.id (Баг #3)
};

export type ReviewPart = {
  index: number;
  user: string;
  correct: string;
  isCorrect: boolean;
};

export type ReviewBase = {
  questionText: string;
  isCorrect: boolean;
  isSkipped: boolean;
  pointsEarned: number;
  pointsTotal: number;
  media?: MediaAttachment[]; // поддержка медиа в ревью
};

// Расширенные типы для каждого подтипа
export type ReviewItem =
  | (ReviewBase & {
      type: "test";
      userLabel: string | string[];
      correctLabel: string | string[];
      userIndices: number[];      // <--- ДОБАВИТЬ ЭТО
      correctIndices: number[];   // <--- И ЭТО
      fraction?: number; 
      isMultiple?: boolean;
      options: TestOption[];
    })
  | (ReviewBase & {
      type: "fill";
      userAnswers: string[];
      correctAnswers: string[];
      parts: ReviewPart[];
      percent: number;
      correctCount: number;
      totalCount: number;
      // ДОБАВЛЕНО: текст вопроса (может быть пустым)
      questionText?: string;
    })
  | (ReviewBase & {
      type: "sentence";
      userAnswers: string[];
      correctAnswers: string[];
      parts: ReviewPart[];
      percent: number;
      correctCount: number;
      totalCount: number;
      // ДОБАВЛЕНО: оригинальный шаблон с ___
      sentenceTemplate: string;
    })
  | (ReviewBase & {
      type: "crossword";
      note: string;
      crosswordStats: { filled: number; total: number; percent: number };
      wordReview?: {
        wrong: Array<{
          number: number;
          direction: "across" | "down";
          user: string;
          correct: string;
        }>;
        correct: Array<{
          number: number;
          direction: "across" | "down";
          word: string;
        }>;
      };
      // ДОБАВЛЕНО: данные сеток для визуализации
      grid: string[][];
      userGrid: string[][];
      cellNumbers: Record<string, number>;
      blocks: any[];
      words: any[];
    })
  | (ReviewBase & {
      type: "matching";
      correctPairsCount: number;
      totalPairsCount: number;
      userMatches: Record<string, string>;
      correctMatches: Record<string, string>;
      /** Читаемые названия правых элементов (ключ – ID элемента, значение – текст). */
      rightLabels?: Record<string, string>;
      // ДОБАВЛЕНО: для визуализации линий и левых элементов
      leftLabels: Record<string, string>;
      pairs: MatchingPair[];
    })
  | (ReviewBase & {
      type: "imagemap";
      correctPairsCount: number;
      totalPairsCount: number;
      userMatches: Record<string, string>;
      correctMatches: Record<string, string>;
      /** Читаемые названия ответов/точек, например { answerId: "Apple" }, { pointId: "Точка 1" } */
      answerLabels?: Record<string, string>;
      pointLabels?: Record<string, string>;
      // === Дополнительные поля для визуализации карты ===
      imageUrl: string;               // URL изображения
      points: ImageMapPoint[];        // исходные точки (с координатами и правильными ответами)
      answers: ImageMapAnswer[];      // исходные ответы
    })
  | (ReviewBase & {
      type: "complex" | "reading";
      subReviews: ReviewItem[]; // Результаты по каждому подвопросу
      // ДОБАВЛЕНО: для reading – текст самого задания (чтение)
      readingText?: string;
    })
  | (ReviewBase & {
      type: "other";
      note: string;
    });

export type FinalStats = {
  score: number;
  correct: number;
  incorrect: number;
  skipped: number;
  total: number;
  pointsEarned: number;
  pointsTotal: number;
};

export type AssignmentProgressRequestBody = {
  assignmentId: string;
  answers: Record<string, any>; // ИЗМЕНЕНО: вместо any, чтобы хранить по question.id (Баг #3)
  isCompleted: boolean;
  score: number;
  source?: AssignmentSource | string;
  sourceId?: string;
  branchType?: AssignmentBranchType | string;
};

// ==================== НОВЫЕ ТИПЫ ДЛЯ РЕШЕНИЯ БАГОВ ====================

// Для решения бага #15 (assignment в state как any) и бага #10 (уровни)
export type MaterialData = {
  id?: string;
  title?: string;
  target_levels?: string[] | string;
  branch_type?: AssignmentBranchType | string;
  [key: string]: any;
};

export type AssignmentContent = {
  questions: QuestionAny[];
  [key: string]: any;
};

export type AssignmentData = {
  id: string;
  title?: string;
  branch_type?: AssignmentBranchType | string;
  target_levels?: string[] | string;
  materials?: MaterialData[]; // Основной массив материалов
  material?: MaterialData[];  // Возможный алиас (встречается в легаси/апи)
  content: AssignmentContent; // Распакованный JSON задания
  [key: string]: any;
};