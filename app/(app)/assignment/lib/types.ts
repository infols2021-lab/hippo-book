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

// ==================== Updated Any Type ====================

export type QuestionAny =
  | QuestionTest
  | QuestionFill
  | QuestionSentence
  | QuestionCrossword
  | QuestionComplex
  | QuestionMatching
  | QuestionImageMap
  | (QuestionBase & Record<string, any>);

export type Progress = {
  is_completed: boolean;
  score: number | null;
  completed_at: string | null;
  answers: any;
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
  media?: MediaAttachment[]; // <-- поддержка медиа в ревью
};

export type ReviewItem =
  | (ReviewBase & {
      type: "test";
      userLabel: string | string[];
      correctLabel: string | string[];
      fraction?: number; // 0..1 для дробных баллов
      isMultiple?: boolean;
    })
  | (ReviewBase & {
      type: "fill" | "sentence";
      userAnswers: string[];
      correctAnswers: string[];
      parts: ReviewPart[];
      percent: number;
      correctCount: number;
      totalCount: number;
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
    })
  | (ReviewBase & {
      type: "matching";
      correctPairsCount: number;
      totalPairsCount: number;
      userMatches: Record<string, string>;
      correctMatches: Record<string, string>;
      /** Читаемые названия правых элементов (ключ – ID элемента, значение – текст). */
      rightLabels?: Record<string, string>;
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
    })
  | (ReviewBase & {
      type: "complex";
      subReviews: ReviewItem[]; // Результаты по каждому подвопросу
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
  answers: any;
  isCompleted: boolean;
  score: number;
  source?: AssignmentSource | string;
  sourceId?: string;
  branchType?: AssignmentBranchType | string;
};