// Общий пул из всех возможных сценариев и типов вопросов
const allQuestionTypes = [
  // 0. ТЕСТ: Классика (без медиа, один ответ)
  {
    id: "q_test_vanilla",
    type: "test",
    q: "Какой сейчас год?",
    multiple: false,
    options: [
      { id: "opt1", text: "2025" },
      { id: "opt2", text: "2026", isCorrect: true }, // Правильный
      { id: "opt3", text: "2027" },
    ],
  },

  // 1. ТЕСТ: Множественный выбор + Легаси картинка (image) + Картинки в ответах
  {
    id: "q_test_media_hell",
    type: "test",
    q: "Выберите все логотипы, содержащие красный цвет (легаси image):",
    multiple: true,
    image: "https://placehold.co/600x200/4f46e5/ffffff?text=Legacy+Image+Field",
    options: [
      { id: "o1", text: "Вариант 1", media: [{ type: "image", url: "https://placehold.co/100x100/ef4444/ffffff?text=Red" }], isCorrect: true },
      { id: "o2", text: "Вариант 2", media: [{ type: "image", url: "https://placehold.co/100x100/10b981/ffffff?text=Green" }] },
      { id: "o3", text: "Вариант 3", media: [{ type: "image", url: "https://placehold.co/100x100/b91c1c/ffffff?text=Dark+Red" }], isCorrect: true },
    ],
  },

  // 2. FILL: Несколько пропусков (исправлено на структуру items)
  {
    id: "q_fill_multi",
    type: "fill",
    q: "Впишите пропущенные слова:",
    media: [
      { type: "image", url: "https://placehold.co/600x150/334155/ffffff?text=Modern+Media+Array" },
      { type: "image", url: "https://placehold.co/600x150/0f172a/ffffff?text=Second+Media+Item" }
    ],
    // Теперь компонент найдет свой массив items и не будет писать "Количество ответов: 0"
    items: [
      {
        id: "fill_item_1",
        parts: [
          { type: "text", text: "Столица Великобритании — " },
          { type: "input", correct: "Лондон", id: "input_1" },
          { type: "text", text: ". А Франции — " },
          { type: "input", correct: "Париж", id: "input_2" },
        ]
      }
    ]
  },

  // 3. SENTENCE: Сборка предложения
  {
    id: "q_sentence_long",
    type: "sentence",
    q: "Соберите очень длинное предложение, чтобы проверить переносы строк:",
    sentenceTemplate: "The quick brown ___ jumps over the lazy ___, and then ___ away.",
    template: "The quick brown ___ jumps over the lazy ___, and then ___ away.",
    correctAnswers: ["fox", "dog", "runs"],
    words: ["runs", "dog", "fox", "cat"] // Добавили слова для перетаскивания
  },

  // 4. MATCHING: Соединялки (исправлена структура для отрисовки линий)
  {
    id: "q_matching_basic",
    type: "matching",
    q: "Соедините слова с их переводами:",
    // Разделили на независимые массивы left и right, чтобы логика линий заработала
    left: [
      { id: "l1", text: "Apple" },
      { id: "l2", text: "Dog" },
      { id: "l3", text: "Cat" },
    ],
    right: [
      { id: "r1", text: "Яблоко" },
      { id: "r2", text: "Собака" },
      { id: "r3", text: "Кошка" },
    ],
    // Pairs хранит только правильные связи
    pairs: [
      { leftId: "l1", rightId: "r1" },
      { leftId: "l2", rightId: "r2" },
      { leftId: "l3", rightId: "r3" },
    ]
  },

  // 5. IMAGEMAP: Точки на картинке
  {
    id: "q_imagemap_visual",
    type: "imagemap",
    q: "Укажите правильные части тела:",
    image: "https://placehold.co/600x400/f8fafc/000000?text=Image+Map+Background",
    points: [
      { id: "p1", x: 20, y: 30, label: "Голова" },
      { id: "p2", x: 50, y: 50, label: "Туловище" },
    ],
    answers: [
      { id: "a1", text: "Голова" },
      { id: "a2", text: "Туловище" },
      { id: "a3", text: "Лишний ответ" },
    ],
  },

  // 6. CROSSWORD: Кроссворд
  {
    id: "q_crossword_mini",
    type: "crossword",
    q: "Разгадайте кроссворд:",
    image: "https://placehold.co/600x200/8b5cf6/ffffff?text=Crossword+Hints",
    grid: [
      ["c", "a", "t", ""],
      ["", "p", "i", "g"],
      ["", "", "g", ""],
    ],
    words: [
      { word: "cat", direction: "across", start: { row: 0, col: 0 }, length: 3, number: 1 },
      { word: "pig", direction: "across", start: { row: 1, col: 1 }, length: 3, number: 2 },
    ],
  },

  // 7. READING: Полотно текста (добавили все варианты ключей для текста)
  {
    id: "q_reading_wall",
    type: "reading",
    q: "Прочитайте текст и ответьте на вопросы:",
    // Бронебойный набор: один из этих ключей компонент точно съест
    passage: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(20),
    article: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(20),
    text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(20),
    items: [
      { id: "rq1", type: "test", q: "О чем текст?", multiple: false, options: [{ id: "ro1", text: "О природе" }, { id: "ro2", text: "О лореме" }] }
    ],
    questions: [
      { id: "rq1", type: "test", q: "О чем текст?", multiple: false, options: [{ id: "ro1", text: "О природе" }, { id: "ro2", text: "О лореме" }] }
    ]
  },

  // 8. COMPLEX: Вложенный ад (исправили вложенный fill)
  {
    id: "q_complex_nested",
    type: "complex",
    q: "Комплексное задание. Ознакомьтесь с материалом и выполните подзадания:",
    media: [{ type: "image", url: "https://placehold.co/600x200/ec4899/ffffff?text=Complex+Parent+Media" }],
    items: [
      { id: "sq1", type: "test", q: "Вложенный тест", multiple: false, options: [{ id: "so1", text: "Да" }, { id: "so2", text: "Нет" }] },
      { 
        id: "sq2", 
        type: "fill", 
        q: "Вложенный fill", 
        items: [
          {
            id: "sq2_item1",
            parts: [{ type: "text", text: "2 + 2 = " }, { type: "input", correct: "4", id: "sq2_in1" }]
          }
        ] 
      }
    ],
    questions: [
      { id: "sq1", type: "test", q: "Вложенный тест", multiple: false, options: [{ id: "so1", text: "Да" }, { id: "so2", text: "Нет" }] },
      { 
        id: "sq2", 
        type: "fill", 
        q: "Вложенный fill", 
        items: [
          {
            id: "sq2_item1",
            parts: [{ type: "text", text: "2 + 2 = " }, { type: "input", correct: "4", id: "sq2_in1" }]
          }
        ] 
      }
    ]
  }
];

// Полная имитация строки БД из таблицы assignments
const baseDbAssignment = {
  id: "debug-all",
  textbook_id: null,
  crossword_id: null,
  title: "🧪 ЛАБОРАТОРИЯ",
  order_index: 0,
  created_at: new Date().toISOString(),
  created_by: "system-uuid",
  branch_type: "olympiad",
  material_id: "mock-material-uuid",
  materials: [
    {
      id: "mock-material-uuid",
      title: "Mock Material",
      branch_type: "olympiad",
      material_kind: "test",
      is_active: true,
      is_available: true,
      target_levels: ["B1"],
      class_levels: ["11"]
    }
  ],
};

// ==========================================
// ЭКСПОРТЫ ДЛЯ ТВОЕГО API
// ==========================================

// 1. Сценарий: Прохождение с нуля, все вопросы
export const mockDebugAll = {
  ok: true,
  assignment: {
    ...baseDbAssignment,
    id: "debug-all",
    title: "🧪 ЛАБОРАТОРИЯ: Все вопросы",
    content: { questions: allQuestionTypes },
  },
  progress: null, // Нет прогресса, начинаем чисто
};

// 2. Сценарий: Моментальная проверка ReviewPanel
export const mockDebugReview = {
  ok: true,
  assignment: {
    ...baseDbAssignment,
    id: "debug-review",
    title: "🚨 ЛАБОРАТОРИЯ: Экран разбора (Review)",
    content: { questions: allQuestionTypes },
  },
  progress: {
    is_completed: true,
    score: 65, 
    completed_at: new Date().toISOString(),
    answers: {
      0: 1, // test
      1: [0, 1], // test_media
      2: ["Лондон", "Рим"], // fill (q_fill_multi)
      3: ["fox", "cat", "runs"], // sentence
      4: { l1: "r1", l2: "r3", l3: "r2" }, // matching
      5: { p1: "a1", p2: "a3" }, // imagemap
      6: [ // crossword
        ["c", "o", "t", ""],
        ["", "p", "i", "g"],
        ["", "", "g", ""],
      ],
      7: [1], // reading
      8: [0, ["5"]], // complex
    },
  },
};

// 3. Сценарий: Одиночный вопрос
export const mockDebugSingle = {
  ok: true,
  assignment: {
    ...baseDbAssignment,
    id: "debug-single",
    title: "🎯 ЛАБОРАТОРИЯ: Одиночка",
    branch_type: "gatehouse",
    content: { questions: [allQuestionTypes[2]] }, // Берем FILL
  },
  progress: null,
};