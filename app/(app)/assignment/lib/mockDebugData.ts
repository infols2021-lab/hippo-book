// Общий пул из всех возможных извращений над вопросами
const allQuestionTypes = [
  // 0. ТЕСТ: Классика (без медиа, один ответ)
  {
    id: "q_test_vanilla",
    type: "test",
    q: "Какой сейчас год?",
    multiple: false,
    options: [
      { id: "opt1", text: "2025" },
      { id: "opt2", text: "2026" }, // Правильный
      { id: "opt3", text: "2027" },
    ],
  },

  // 1. ТЕСТ: Множественный выбор + Легаси картинка (image) + Картинки в ответах
  {
    id: "q_test_media_hell",
    type: "test",
    q: "Выберите все логотипы, содержащие красный цвет (легаси image):",
    multiple: true,
    image: "https://placehold.co/600x200/4f46e5/white?text=Legacy+Image+Field",
    options: [
      { id: "o1", text: "Вариант 1", media: [{ type: "image", url: "https://placehold.co/100x100/ef4444/white?text=Red" }] },
      { id: "o2", text: "Вариант 2", media: [{ type: "image", url: "https://placehold.co/100x100/10b981/white?text=Green" }] },
      { id: "o3", text: "Вариант 3", media: [{ type: "image", url: "https://placehold.co/100x100/b91c1c/white?text=Dark+Red" }] },
    ],
  },

  // 2. FILL: Несколько пропусков + Новый массив media
  {
    id: "q_fill_multi",
    type: "fill",
    q: "Впишите пропущенные слова:",
    media: [
      { type: "image", url: "https://placehold.co/600x150/334155/white?text=Modern+Media+Array" },
      { type: "image", url: "https://placehold.co/600x150/0f172a/white?text=Second+Media+Item" }
    ],
    parts: [
      { type: "text", text: "Столица Великобритании — " },
      { type: "input", correct: "Лондон" },
      { type: "text", text: ". А Франции — " },
      { type: "input", correct: "Париж" },
    ],
  },

  // 3. SENTENCE: Сборка предложения
  {
    id: "q_sentence_long",
    type: "sentence",
    q: "Соберите очень длинное предложение, чтобы проверить переносы строк:",
    sentenceTemplate: "The quick brown ___ jumps over the lazy ___, and then ___ away.",
    correctAnswers: ["fox", "dog", "runs"],
  },

  // 4. MATCHING: Соединялки
  {
    id: "q_matching_basic",
    type: "matching",
    q: "Соедините слова с их переводами:",
    pairs: [
      { left: { id: "l1", text: "Apple" }, right: { id: "r1", text: "Яблоко" } },
      { left: { id: "l2", text: "Dog" }, right: { id: "r2", text: "Собака" } },
      { left: { id: "l3", text: "Cat" }, right: { id: "r3", text: "Кошка" } },
    ],
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
    image: "https://placehold.co/600x200/8b5cf6/white?text=Crossword+Hints",
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

  // 7. READING: Полотно текста
  {
    id: "q_reading_wall",
    type: "reading",
    q: "Прочитайте текст и ответьте на вопросы (текст должен скроллиться или умещаться красиво):",
    readingText: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(20),
    questions: [
      { id: "rq1", type: "test", q: "О чем текст?", multiple: false, options: [{ id: "ro1", text: "О природе" }, { id: "ro2", text: "О лореме" }] }
    ]
  },

  // 8. COMPLEX: Вложенный ад (Вопрос, внутри которого другие вопросы)
  {
    id: "q_complex_nested",
    type: "complex",
    q: "Комплексное задание. Ознакомьтесь с материалом и выполните подзадания:",
    media: [{ type: "image", url: "https://placehold.co/600x200/ec4899/white?text=Complex+Parent+Media" }],
    subQuestions: [
      { id: "sq1", type: "test", q: "Вложенный тест", multiple: false, options: [{ id: "so1", text: "Да" }, { id: "so2", text: "Нет" }] },
      { id: "sq2", type: "fill", q: "Вложенный fill", parts: [{ type: "text", text: "2 + 2 = " }, { type: "input", correct: "4" }] }
    ]
  }
];

// ==========================================
// ЭКСПОРТЫ ДЛЯ ТВОЕГО API
// ==========================================

// 1. Сценарий: Прохождение с нуля, все вопросы
export const mockDebugAll = {
  ok: true,
  assignment: {
    id: "debug-all",
    title: "🧪 ЛАБОРАТОРИЯ: Все вопросы",
    branch_type: "olympiad",
    materials: [{ target_levels: ["B1"] }],
    content: { questions: allQuestionTypes },
  },
  progress: null, // Нет прогресса, начинаем чисто
};

// 2. Сценарий: Моментальная проверка ReviewPanel (Ошибки, успехи, частичные)
export const mockDebugReview = {
  ok: true,
  assignment: {
    id: "debug-review",
    title: "🚨 ЛАБОРАТОРИЯ: Экран разбора (Review)",
    branch_type: "olympiad",
    materials: [{ target_levels: ["B1"] }],
    content: { questions: allQuestionTypes },
  },
  progress: {
    is_completed: true,
    score: 65, // Условный балл
    answers: {
      0: 1, // test: Правильно (выбрал 2026, индекс 1)
      1: [0, 1], // test_media: Частично/ошибка (выбрал o1 и o2)
      2: ["Лондон", "Рим"], // fill: Одно правильно, одно нет
      3: ["fox", "cat", "runs"], // sentence: Ошибка посередине
      4: { l1: "r1", l2: "r3", l3: "r2" }, // matching: Одно правильно, два перепутаны
      5: { p1: "a1", p2: "a3" }, // imagemap: Одно правильно, одно мимо
      6: [ // crossword: Ошибка в одной букве (c-o-t вместо c-a-t)
        ["c", "o", "t", ""],
        ["", "p", "i", "g"],
        ["", "", "g", ""],
      ],
      7: [1], // reading: Вложенный ответ правильный
      8: [0, ["5"]], // complex: Вложенные ответы (один тест, один fill с ошибкой)
    },
  },
};

// 3. Сценарий: Одиночный вопрос (проверка скрытия точек навигации)
export const mockDebugSingle = {
  ok: true,
  assignment: {
    id: "debug-single",
    title: "🎯 ЛАБОРАТОРИЯ: Одиночка",
    branch_type: "gatehouse",
    materials: [{ target_levels: ["A2"] }],
    content: { questions: [allQuestionTypes[2]] }, // Берем только FILL
  },
  progress: null,
};