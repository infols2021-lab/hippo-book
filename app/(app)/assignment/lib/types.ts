export type AssignmentBranchType = "olympiad" | "gatehouse";

export type AssignmentSource =
  | "textbook"
  | "crossword"
  | "materials"
  | "login"
  | "profile"
  | "gatehouse"
  | "gatehouse-material";

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