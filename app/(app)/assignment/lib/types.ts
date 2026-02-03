export type QuestionBase = {
  q?: string;
  image?: string;
  type?: string;
};

export type QuestionTest = QuestionBase & {
  type: "test";
  options?: string[];
  correct?: number;
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

export type QuestionAny =
  | QuestionTest
  | QuestionFill
  | QuestionSentence
  | QuestionCrossword
  | (QuestionBase & Record<string, any>);

export type Progress = {
  is_completed: boolean;
  score: number | null;
  completed_at: string | null;
  answers: any;
};

export type ReviewPart = {
  index: number; // 1-based
  user: string;
  correct: string;
  isCorrect: boolean;
};

export type ReviewBase = {
  questionText: string;
  isCorrect: boolean; // 100% correct (для "Правильных ответов (100%)")
  isSkipped: boolean;
  pointsEarned: number; // может быть дробным (fill/sentence/crossword)
  pointsTotal: number; // обычно 1
};

export type ReviewItem =
  | (ReviewBase & {
      type: "test";
      userLabel: string;
      correctLabel: string;
    })
  | (ReviewBase & {
      type: "fill" | "sentence";
      userAnswers: string[];
      correctAnswers: string[]; // "вариант1 или вариант2"
      parts: ReviewPart[];
      percent: number; // 0..100
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
      type: "other";
      note: string;
    });

export type FinalStats = {
  score: number; // итоговый % по баллам
  correct: number; // сколько вопросов 100% правильные
  incorrect: number; // сколько вопросов не 100% правильные (но отвечены)
  skipped: number; // сколько пропущено
  total: number;

  pointsEarned: number; // набрано баллов (может быть дробным)
  pointsTotal: number; // максимум баллов (обычно = total)
};
