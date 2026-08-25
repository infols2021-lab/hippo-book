/**
 * app/(app)/assignment/lib/mockDebugData.ts
 *
 * Эталонные моковые данные для дебага движка заданий и ПЕСОЧНИЦЫ (Sandbox).
 * Все структуры строго совместимы с scoring.ts и types.ts.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 🌟 ПЕСОЧНИЦА (ДЛЯ СТРАНИЦЫ ВХОДА)
// ─────────────────────────────────────────────────────────────────────────────

export const SANDBOX_MOCKS = {
  test: {
    id: "sandbox-test",
    type: "test",
    q: "Выберите правильный вариант для завершения предложения:\n\nIf it rains tomorrow, we ___ at home.",
    multiple: false,
    layout: "vertical",
    media: [],
    options: [
      { id: "o1", text: "will stay", media: [] }, // ← верный (индекс 0)
      { id: "o2", text: "would stay", media: [] },
      { id: "o3", text: "stayed", media: [] },
    ],
    correct: [0],
    points: 1,
  },

  fill: {
    id: "sandbox-fill",
    type: "fill",
    q: "Впишите правильную форму глагола 'to be' (можно сокращенную):\n\nThey ___ good friends.",
    media: [],
    answers: [
      ["are", "'re", "are "], // Поддержка нескольких вариантов одного ответа
    ],
    points: 1,
  },

  crossword: {
    id: "sandbox-crossword",
    type: "crossword",
    q: "Разгадайте мини-кроссворд на тему животных и цветов:",
    media: [],
    metadata: { rows: 3, cols: 3 },
    // Сетка 3x3:
    // C A T
    // A . .
    // R E D
    grid: [
      ["C", "A", "T"],
      ["A", "",  ""],
      ["R", "E", "D"],
    ],
    words: [
      { id: "w1", number: 1, word: "CAT", direction: "across", start: { row: 0, col: 0 }, length: 3 },
      { id: "w2", number: 1, word: "CAR", direction: "down",   start: { row: 0, col: 0 }, length: 3 },
      { id: "w3", number: 2, word: "RED", direction: "across", start: { row: 2, col: 0 }, length: 3 },
    ],
    blocks: [],
    cellNumbers: { "0,0": 1, "2,0": 2 },
    points: 3,
  },

  matching: {
    id: "sandbox-matching",
    type: "matching",
    q: "Соедините английские слова с их правильным переводом:",
    media: [],
    pairs: [
      { id: "p1", left: { text: "Knowledge", media: [] }, right: { text: "Знание", media: [] } },
      { id: "p2", left: { text: "Skill", media: [] },     right: { text: "Навык", media: [] } },
      { id: "p3", left: { text: "Success", media: [] },   right: { text: "Успех", media: [] } },
    ],
    points: 3,
  },

  audio: {
    id: "sandbox-audio",
    type: "test",
    q: "Прослушайте аудиозапись и выберите правильное утверждение:",
    multiple: false,
    layout: "vertical",
    media: [
      // Используем публичный сэмпл звука дождя для демо
      { id: "m-audio", type: "audio", url: "https://actions.google.com/sounds/v1/weather/rain_heavy_loud.ogg" },
    ],
    options: [
      { id: "ao1", text: "The sun is shining brightly", media: [] },
      { id: "ao2", text: "It is snowing outside", media: [] },
      { id: "ao3", text: "It is raining heavily", media: [] }, // ← верный (индекс 2)
    ],
    correct: [2],
    points: 1,
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ПУЛ ВОПРОСОВ ДЛЯ СИСТЕМНОГО ДЕБАГА
// ─────────────────────────────────────────────────────────────────────────────

const allQuestionTypes = [
  SANDBOX_MOCKS.test,
  
  // TEST: множественный выбор + картинка
  {
    id: "q_test_multi",
    type: "test",
    q: "Выберите все чётные числа:",
    multiple: true,
    layout: "horizontal",
    media: [
      { id: "m1", type: "image", url: "https://placehold.co/600x120/0ea5e9/ffffff?text=Multi+Select" },
    ],
    options: [
      { id: "o1", text: "2", media: [] },  // ← верный (индекс 0)
      { id: "o2", text: "3", media: [] },
      { id: "o3", text: "4", media: [] },  // ← верный (индекс 2)
      { id: "o4", text: "5", media: [] },
    ],
    correct: [0, 2],
    points: 2,
  },

  SANDBOX_MOCKS.fill,

  // SENTENCE: вставка в предложение
  {
    id: "q_sentence",
    type: "sentence",
    q: "Заполните пропуски в предложении:",
    sentence: "The quick brown ___ jumps over the lazy ___, and then ___ away.",
    media: [],
    answers: [
      ["fox"],    // гэп 0
      ["dog"],    // гэп 1
      ["runs"],   // гэп 2
    ],
    points: 3,
  },

  SANDBOX_MOCKS.matching,

  // IMAGEMAP: точки на картинке
  {
    id: "q_imagemap",
    type: "imagemap",
    q: "Соедините метки на картинке с подписями:",
    image: "https://placehold.co/600x400/f8fafc/0f172a?text=Image+Map+(3+points)",
    media: [],
    points: [
      { id: "pt1", x: 25, y: 20, correctAnswerId: "a1", label: "Верх"   },
      { id: "pt2", x: 50, y: 50, correctAnswerId: "a2", label: "Центр"  },
      { id: "pt3", x: 75, y: 80, correctAnswerId: "a3", label: "Низ"    },
    ],
    answers: [
      { id: "a1", text: "Верх", media: []   },
      { id: "a2", text: "Центр", media: []  },
      { id: "a3", text: "Низ", media: []    },
    ],
  },

  SANDBOX_MOCKS.crossword,
  SANDBOX_MOCKS.audio,

  // READING: текст + подвопросы
  {
    id: "q_reading",
    type: "reading",
    q: "Прочитайте текст и ответьте на вопросы:",
    media: [],
    text:
      "The Amazon rainforest, often called 'the lungs of the Earth', " +
      "produces around 20% of the world's oxygen. It covers over " +
      "5.5 million square kilometres and is home to approximately 10% " +
      "of all known species on the planet. Despite its importance, the " +
      "Amazon faces serious threats from deforestation and climate change. " +
      "Scientists warn that the forest may be approaching a critical tipping point " +
      "from which recovery would be almost impossible.",
    subQuestions: [
      {
        id: "rq1",
        type: "test",
        q: "What percentage of the world's oxygen does the Amazon produce?",
        multiple: false,
        layout: "vertical",
        media: [],
        options: [
          { id: "ro1", text: "10%", media: [] },
          { id: "ro2", text: "20%", media: [] }, // ← верный (индекс 1)
          { id: "ro3", text: "30%", media: [] },
        ],
        correct: [1],
        points: 1,
      },
    ],
    points: 1,
  },

  // COMPLEX: составное задание
  {
    id: "q_complex",
    type: "complex",
    q: "Выполните все подзадания:",
    media: [
      { id: "cm1", type: "image", url: "https://placehold.co/600x200/10b981/ffffff?text=Complex+Task" },
    ],
    subQuestions: [
      {
        id: "cq1",
        type: "test",
        q: "Сколько будет 2 + 2?",
        multiple: false,
        layout: "horizontal",
        media: [],
        options: [
          { id: "co1", text: "3", media: [] },
          { id: "co2", text: "4", media: [] }, // ← верный (индекс 1)
          { id: "co3", text: "5", media: [] },
        ],
        correct: [1],
        points: 1,
      },
      {
        id: "cq2",
        type: "fill",
        q: "Впишите столицу России:",
        media: [],
        answers: [
          ["Москва", "Moscow"],
        ],
        points: 1,
      },
    ],
    points: 2,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// BASE DB ROW
// ─────────────────────────────────────────────────────────────────────────────

const baseMaterial = {
  id: "mock-material-uuid",
  title: "Mock Material",
  branch_type: "olympiad",
  material_kind: "test",
  is_active: true,
  is_available: true,
  target_levels: ["B1"],
  class_levels: ["11"],
};

const baseAssignment = {
  id: "debug-base",
  textbook_id: null,
  crossword_id: null,
  order_index: 0,
  created_at: new Date().toISOString(),
  created_by: "system",
  branch_type: "olympiad",
  material_id: baseMaterial.id,
  materials: [baseMaterial],
};

// ─────────────────────────────────────────────────────────────────────────────
// ЭТАЛОННЫЕ ОТВЕТЫ
// ─────────────────────────────────────────────────────────────────────────────

const answersAllCorrect: Record<number, any> = {
  0: 0,
  1: [0, 2],
  2: ["are"],
  3: ["fox", "dog", "runs"],
  4: { p1: "p1", p2: "p2", p3: "p3" },
  5: { a1: "pt1", a2: "pt2", a3: "pt3" },
  6: [
    ["C", "A", "T"],
    ["A", "",  ""],
    ["R", "E", "D"],
  ],
  7: 2,
  8: [1],
  9: [1, ["Москва"]],
};

const answersMixed: Record<number, any> = {
  0: 1, // Ошибка
  1: [0, 1], // Ошибка (частично)
  2: ["is"], // Ошибка
  3: ["fox", "cat", "runs"], // Ошибка
  4: { p1: "p1", p2: "p3", p3: "p2" }, // Ошибка
  5: { a1: "pt1", a2: "pt3", a3: "pt2" }, // Ошибка
  6: [
    ["C", "O", "T"], // COT ≠ CAT 
    ["",  "",  ""], 
    ["R", "E", "D"],
  ],
  7: 0,
  8: [0],
  9: [0, ["Питер"]],
};

// ─────────────────────────────────────────────────────────────────────────────
// ЭКСПОРТЫ
// ─────────────────────────────────────────────────────────────────────────────

export const mockDebugAll = {
  ok: true,
  assignment: {
    ...baseAssignment,
    id: "debug-all",
    title: "🧪 ЛАБ: все типы вопросов (с нуля)",
    content: { questions: allQuestionTypes },
  },
  progress: null,
};

export const mockDebugReview = {
  ok: true,
  assignment: {
    ...baseAssignment,
    id: "debug-review",
    title: "🔍 ЛАБ: Review Panel (смешанные ответы)",
    content: { questions: allQuestionTypes },
  },
  progress: {
    is_completed: true,
    score: 45,
    completed_at: new Date().toISOString(),
    answers: answersMixed,
  },
};

export const mockDebugPerfect = {
  ok: true,
  assignment: {
    ...baseAssignment,
    id: "debug-perfect",
    title: "✅ ЛАБ: 100% правильных ответов",
    content: { questions: allQuestionTypes },
  },
  progress: {
    is_completed: true,
    score: 100,
    completed_at: new Date().toISOString(),
    answers: answersAllCorrect,
  },
};

export const mockDebugModeChoice = {
  ok: true,
  assignment: {
    ...baseAssignment,
    id: "debug-mode-choice",
    title: "↶ ЛАБ: экран выбора режима",
    content: { questions: allQuestionTypes },
  },
  progress: {
    is_completed: true,
    score: 67,
    completed_at: new Date().toISOString(),
    answers: answersMixed,
  },
};

export const mockDebugSingle = (questionIndex = 3) => ({
  ok: true,
  assignment: {
    ...baseAssignment,
    id: `debug-single-${questionIndex}`,
    title: `🎯 ЛАБ: одиночка [${allQuestionTypes[questionIndex]?.type ?? "?"}]`,
    content: { questions: [allQuestionTypes[questionIndex]] },
  },
  progress: null,
});