// lib/assignments/types.ts

export type AssignmentBranchType = "olympiad" | "gatehouse";

export type AssignmentSource =
  | "textbook"
  | "crossword"
  | "materials"
  | "login"
  | "profile"
  | "gatehouse"
  | "gatehouse-material";

export type EditorMode = "visual" | "json";
export type AssignmentMode = "interactive" | "informational";

// ===== Медиа =====
export type MediaType = "image" | "audio" | "pdf";

export type MediaAttachment = {
  id: string;
  url: string;
  type: MediaType;
  name?: string;
};

// ==========================================
// БЛОКИ: ОЗНАКОМИТЕЛЬНЫЙ РЕЖИМ (Гайды)
// ==========================================

export type BlockType =
  | "hero"
  | "text_section"
  | "alert"
  | "video"
  | "cards_grid"
  | "accordion"
  | "downloads";

export type BaseBlock = {
  id: string;
  type: BlockType;
};

export type HeroBlock = BaseBlock & {
  type: "hero";
  data: { badge?: string; title: string; subtitle?: string; pills?: string[] };
};

export type TextSectionBlock = BaseBlock & {
  type: "text_section";
  data: { label?: string; title?: string; content: string };
};

export type AlertBlock = BaseBlock & {
  type: "alert";
  data: { theme: "teacher" | "info" | "warning"; icon?: string; content: string };
};

export type VideoBlock = BaseBlock & {
  type: "video";
  data: { url: string; caption?: string; subCaption?: string };
};

export type CardItem = {
  id: string;
  title: string;
  content: string;
  theme?: "blue" | "green" | "orange" | "purple" | "default";
  icon?: string;
};

export type CardsGridBlock = BaseBlock & {
  type: "cards_grid";
  data: { columns: number; items: CardItem[] };
};

export type AccordionItem = {
  id: string;
  title: string;
  content: string;
  tag?: string;
  tagTheme?: "blue" | "green" | "orange" | "purple" | "gold" | "default";
};

export type AccordionBlock = BaseBlock & {
  type: "accordion";
  data: { items: AccordionItem[] };
};

export type DownloadFile = {
  id: string;
  name: string;
  url: string;
  fileType: string;
  description?: string;
  theme?: "blue" | "green" | "orange" | "purple" | "red" | "gold" | "default";
  icon?: string;
};

export type DownloadsBlock = BaseBlock & {
  type: "downloads";
  data: { files: DownloadFile[] };
};

export type InfoBlock =
  | HeroBlock
  | TextSectionBlock
  | AlertBlock
  | VideoBlock
  | CardsGridBlock
  | AccordionBlock
  | DownloadsBlock;

// ==========================================
// ВОПРОСЫ: ИНТЕРАКТИВНЫЙ РЕЖИМ (Тесты)
// ==========================================

export type QuestionType =
  | "test"
  | "fill"
  | "sentence"
  | "crossword"
  | "complex"
  | "matching"
  | "imagemap"
  | "reading";

// БАЗОВЫЙ ИНТЕРФЕЙС (ТУТ БОЛЬШЕ НЕТ type?: string)
export type QuestionBase = {
  id: string;
  q?: string;
  image?: string; // Устаревшее
  media?: MediaAttachment[]; // Новое
};

export type TestOption = {
  id: string;
  text: string;
  media?: MediaAttachment[];
};

export type QuestionTest = QuestionBase & {
  type: "test";
  multiple?: boolean;
  options?: TestOption[] | string[]; 
  correct?: number[] | number; 
  layout?: "vertical" | "horizontal"; 
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

export type WordDir = "across" | "down";

export type CWWord = {
  id: string;
  number: number;
  text: string;
  direction: WordDir;
  start: { row: number; col: number };
  length: number;
};

export type CWBlock = { row: number; col: number };

export type CrosswordMetadata = {
  rows: number;
  cols: number;
  nextWordNumber?: number;
  placingWord?: { text: string; direction: WordDir; number: number } | null;
  deleteMode?: boolean;
};

export type QuestionCrossword = QuestionBase & {
  type: "crossword";
  grid?: string[][];
  words?: CWWord[] | any[];
  blocks?: CWBlock[] | any[];
  cellNumbers?: Record<string, number>;
  metadata?: CrosswordMetadata | { rows?: number; cols?: number };
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

export type ImageMapPoint = {
  id: string;
  x: number; 
  y: number; 
  correctAnswerId: string;
  label?: string; 
};

export type ImageMapAnswer = {
  id: string;
  text?: string;
  media?: MediaAttachment[];   
};

export type QuestionImageMap = QuestionBase & {
  type: "imagemap";
  image: string;              
  points: ImageMapPoint[];
  answers: ImageMapAnswer[];
};

export type QuestionReading = QuestionBase & {
  type: "reading";
  text?: string;
  subQuestions?: QuestionTest[];
};

// ГЛАВНЫЙ ТИП ВОПРОСА (Только строгие типы, никаких Record<string, any>)
export type QuestionAny =
  | QuestionTest
  | QuestionFill
  | QuestionSentence
  | QuestionCrossword
  | QuestionComplex
  | QuestionMatching
  | QuestionImageMap
  | QuestionReading;

// АЛИАСЫ ДЛЯ АДМИНКИ
export type Question = QuestionAny;
export type TestQuestion = QuestionTest;
export type FillQuestion = QuestionFill;
export type SentenceQuestion = QuestionSentence;
export type CrosswordQuestion = QuestionCrossword;
export type ComplexQuestion = QuestionComplex;
export type MatchingQuestion = QuestionMatching;
export type ImageMapQuestion = QuestionImageMap;
export type ReadingQuestion = QuestionReading;

// ==========================================
// ДАННЫЕ ЗАДАНИЯ И РЕВЬЮ
// ==========================================

export type Progress = {
  is_completed: boolean;
  score: number | null;
  completed_at: string | null;
  answers: Record<string, any>;
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
  media?: MediaAttachment[];
};

export type ReviewItem =
  | (ReviewBase & {
      type: "test";
      userLabel: string | string[];
      correctLabel: string | string[];
      userIndices: number[];      
      correctIndices: number[];   
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
      rightLabels?: Record<string, string>;
      leftLabels: Record<string, string>;
      pairs: MatchingPair[];
    })
  | (ReviewBase & {
      type: "imagemap";
      correctPairsCount: number;
      totalPairsCount: number;
      userMatches: Record<string, string>;
      correctMatches: Record<string, string>;
      answerLabels?: Record<string, string>;
      pointLabels?: Record<string, string>;
      imageUrl: string;               
      points: ImageMapPoint[];        
      answers: ImageMapAnswer[];      
    })
  | (ReviewBase & {
      type: "complex" | "reading";
      subReviews: ReviewItem[]; 
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
  answers: Record<string, any>;
  isCompleted: boolean;
  score: number | null;
  source?: AssignmentSource | string;
  sourceId?: string;
  branchType?: AssignmentBranchType | string;
};

export type MaterialData = {
  id?: string;
  title?: string;
  target_levels?: string[] | string;
  branch_type?: AssignmentBranchType | string;
  [key: string]: any;
};

export type InteractiveContent = {
  mode?: "interactive"; 
  questions: QuestionAny[];
};

export type InformationalContent = {
  mode: "informational";
  blocks: InfoBlock[];
};

export type AssignmentContent = {
  mode?: "interactive" | "informational";
  questions?: QuestionAny[];
  blocks?: InfoBlock[];
  [key: string]: any;
};

export type AssignmentData = {
  id: string;
  title?: string;
  branch_type?: AssignmentBranchType | string;
  target_levels?: string[] | string;
  materials?: MaterialData[]; 
  material?: MaterialData[];  
  content: AssignmentContent; 
  [key: string]: any;
};