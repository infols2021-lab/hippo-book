// ===== Modes =====
export type EditorMode = "visual" | "json";
export type AssignmentMode = "interactive" | "informational"; // НОВЫЙ: Режим задания

// ===== Assignment Root Content =====
// Это описывает, как данные будут лежать в колонке content (JSONB) в базе данных
export type InteractiveContent = {
  mode?: "interactive"; // Опционально для обратной совместимости со старыми заданиями
  questions: Question[];
};

export type InformationalContent = {
  mode: "informational";
  blocks: InfoBlock[];
};

export type AssignmentContent = InteractiveContent | InformationalContent;


// ==========================================
// БЛОК 1: ОЗНАКОМИТЕЛЬНЫЙ РЕЖИМ (БЛОКИ)
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

// 1. Hero (Обложка)
export type HeroBlock = BaseBlock & {
  type: "hero";
  data: {
    badge?: string;
    title: string;
    subtitle?: string;
    pills?: string[];
  };
};

// 2. Text Section (Текстовый блок)
export type TextSectionBlock = BaseBlock & {
  type: "text_section";
  data: {
    label?: string; // Маленькая надпись сверху (например, "Знакомство")
    title?: string; // Заголовок секции
    content: string; // Основной текст
  };
};

// 3. Alert (Предупреждение/Сноска)
export type AlertBlock = BaseBlock & {
  type: "alert";
  data: {
    theme: "teacher" | "info" | "warning"; // Желтый, Синий, Оранжевый
    icon?: string; // Эмодзи, например 🎓 или ℹ️
    content: string;
  };
};

// 4. Video (Видео)
export type VideoBlock = BaseBlock & {
  type: "video";
  data: {
    url: string; // YouTube или Vimeo embed url
    caption?: string; // Подпись (Как играть в Speaking)
    subCaption?: string; // Длительность
  };
};

// 5. Cards Grid (Сетка карточек / Шаги)
export type CardItem = {
  id: string;
  title: string;
  content: string;
  theme?: "blue" | "green" | "orange" | "purple" | "default";
  icon?: string;
};

export type CardsGridBlock = BaseBlock & {
  type: "cards_grid";
  data: {
    columns: number; // Обычно 2 или 3
    items: CardItem[];
  };
};

// 6. Accordion (Спойлеры / Задания / FAQ)
export type AccordionItem = {
  id: string;
  title: string;
  content: string;
  tag?: string; // Тег справа (например, "Лексика")
  tagTheme?: "blue" | "green" | "orange" | "purple" | "gold" | "default";
};

export type AccordionBlock = BaseBlock & {
  type: "accordion";
  data: {
    items: AccordionItem[];
  };
};

// 7. Downloads (Материалы для скачивания)
export type DownloadFile = {
  id: string;
  name: string;
  url: string;
  fileType: string; // Например "DOCX" или "PDF"
  description?: string;
  theme?: "blue" | "green" | "orange" | "purple" | "red" | "gold" | "default";
  icon?: string; // Эмодзи, например 📋
};

export type DownloadsBlock = BaseBlock & {
  type: "downloads";
  data: {
    files: DownloadFile[];
  };
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
// БЛОК 2: ИНТЕРАКТИВНЫЙ РЕЖИМ (ВОПРОСЫ)
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

export type MediaType = "image" | "audio" | "pdf";

export type MediaAttachment = {
  id: string;
  url: string;
  type: MediaType;
  name?: string;
};

export type BaseQuestion = {
  id: string;
  type: QuestionType;
  q?: string;
  image?: string;
  media?: MediaAttachment[];
};

export type TestOption = {
  id: string;
  text: string;
  media?: MediaAttachment[];
};

export type TestQuestion = BaseQuestion & {
  type: "test";
  multiple?: boolean;
  options: TestOption[];
  correct: number[];
  layout?: "vertical" | "horizontal";
};

export type FillQuestion = BaseQuestion & {
  type: "fill";
  answers: string[][];
};

export type SentenceQuestion = BaseQuestion & {
  type: "sentence";
  sentence: string;
  answers: string[][];
};

export type ComplexQuestion = BaseQuestion & {
  type: "complex";
  subQuestions: Question[];
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

export type MatchingQuestion = BaseQuestion & {
  type: "matching";
  centerImage?: MediaAttachment;
  pairs: MatchingPair[];
};

export type ReadingQuestion = BaseQuestion & {
  type: "reading";
  text?: string;
  subQuestions: TestQuestion[];
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
  placingWord?: {
    text: string;
    direction: WordDir;
    number: number;
  } | null;
  deleteMode?: boolean;
};

export type CrosswordQuestion = BaseQuestion & {
  type: "crossword";
  grid: string[][];
  words: CWWord[];
  blocks?: CWBlock[];
  cellNumbers?: Record<string, number>;
  metadata: CrosswordMetadata;
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

export type ImageMapQuestion = BaseQuestion & {
  type: "imagemap";
  image: string;
  points: ImageMapPoint[];
  answers: ImageMapAnswer[];
};

export type Question =
  | TestQuestion
  | FillQuestion
  | SentenceQuestion
  | CrosswordQuestion
  | ComplexQuestion
  | MatchingQuestion
  | ImageMapQuestion
  | ReadingQuestion;


// ==========================================
// БЛОК 3: ФУНКЦИИ-ХЕЛПЕРЫ (FACTORY)
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

// Хелпер для создания новых вопросов (оставлен без изменений)
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