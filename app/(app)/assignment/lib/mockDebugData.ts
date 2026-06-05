/**
 * app/(app)/assignment/lib/mockDebugData.ts
 *
 * Эталонные моковые данные для дебага движка заданий.
 * Все структуры строго совместимы с scoring.ts и types.ts.
 *
 * КАК РАБОТАЮТ ПРАВИЛЬНЫЕ ОТВЕТЫ:
 *
 *  test   (single)  → number           — индекс верного варианта (0-based)
 *  test   (multi)   → number[]         — массив индексов верных вариантов
 *  fill             → string[]         — по одной строке на каждый пропуск
 *  sentence         → string[]         — по одной строке на каждый ___ в q.sentence
 *  matching         → Record<id,id>    — { pairId: pairId } (каждая пара на себя)
 *  imagemap         → Record<id,id>    — { answerId: pointId }
 *  crossword        → string[][]       — 2D сетка букв (регистр не важен)
 *  reading/complex  → any[]            — массив ответов по subQuestions[i]
 */

// ─────────────────────────────────────────────────────────────────────────────
// ПУЛ ВОПРОСОВ
// ─────────────────────────────────────────────────────────────────────────────

const allQuestionTypes = [

  // ── 0. TEST: одиночный выбор ─────────────────────────────────────────────
  // correct: [2]  →  индекс "2026" = 2
  {
    id: "q_test_single",
    type: "test",
    q: "Какой сейчас год?",
    multiple: false,
    options: [
      { id: "o1", text: "2024" },
      { id: "o2", text: "2025" },
      { id: "o3", text: "2026" }, // ← верный (индекс 2)
    ],
    correct: [2],
    points: 1,
  },

  // ── 1. TEST: множественный выбор + медиа ─────────────────────────────────
  // correct: [0, 2]  →  "2" (idx 0) и "4" (idx 2)
  {
    id: "q_test_multi",
    type: "test",
    q: "Выберите все чётные числа:",
    multiple: true,
    media: [
      { id: "m1", type: "image", url: "https://placehold.co/600x120/4f46e5/ffffff?text=Multi+Select" },
    ],
    options: [
      { id: "o1", text: "2" },  // ← верный (индекс 0)
      { id: "o2", text: "3" },
      { id: "o3", text: "4" },  // ← верный (индекс 2)
      { id: "o4", text: "5" },
    ],
    correct: [0, 2],
    points: 2,
  },

  // ── 2. FILL: несколько пропусков ─────────────────────────────────────────
  // q.answers[i] = массив принимаемых вариантов для i-го пропуска
  // normalizeText: lowercase + trim  →  "London" и "london" — одно и то же
  {
    id: "q_fill",
    type: "fill",
    q: "Впишите названия столиц:",
    media: [
      { id: "m2", type: "image", url: "https://placehold.co/600x150/0f172a/ffffff?text=Fill+Question" },
    ],
    answers: [
      ["Лондон", "London"],   // пропуск 0
      ["Париж",  "Paris"],    // пропуск 1
      ["Берлин", "Berlin"],   // пропуск 2
    ],
    points: 3,
  },

  // ── 3. SENTENCE: вставка в предложение ───────────────────────────────────
  // q.sentence: шаблон с ___ (ровно три подчёркивания)
  // q.answers[i] = массив принимаемых вариантов для i-го ___
  // scoring считает гэпы через: (q.sentence.match(/___/g) || []).length
  {
    id: "q_sentence",
    type: "sentence",
    q: "Заполните пропуски в предложении:",
    sentence: "The quick brown ___ jumps over the lazy ___, and then ___ away.",
    answers: [
      ["fox"],    // гэп 0
      ["dog"],    // гэп 1
      ["runs"],   // гэп 2
    ],
    points: 3,
  },

  // ── 4. MATCHING: соединялки ───────────────────────────────────────────────
  // scoring: correctMatches[pair.id] = pair.id  (пара отображается сама на себя)
  // user answer: { pairId: pairId }  →  выбрать правый элемент той же пары
  {
    id: "q_matching",
    type: "matching",
    q: "Соедините слова с их переводами:",
    pairs: [
      { id: "p1", left: { text: "Apple" }, right: { text: "Яблоко" } },
      { id: "p2", left: { text: "Dog"   }, right: { text: "Собака" } },
      { id: "p3", left: { text: "Cat"   }, right: { text: "Кошка"  } },
    ],
    points: 3,
  },

  // ── 5. IMAGEMAP: точки на картинке ───────────────────────────────────────
  // point.correctAnswerId ↔ answer.id  →  scoring строит correctMatches[ans.id] = point.id
  // user answer: { answerId: pointId }
  // Важно: поле points здесь — массив точек (не баллы!); баллы = 1 (дефолт scoring)
  {
    id: "q_imagemap",
    type: "imagemap",
    q: "Соедините метки на картинке с подписями:",
    image: "https://placehold.co/600x400/f1f5f9/1e293b?text=Image+Map+(3+points)",
    points: [
      { id: "pt1", x: 25, y: 20, correctAnswerId: "a1", label: "Верх"   },
      { id: "pt2", x: 50, y: 50, correctAnswerId: "a2", label: "Центр"  },
      { id: "pt3", x: 75, y: 80, correctAnswerId: "a3", label: "Низ"    },
    ],
    answers: [
      { id: "a1", text: "Верх"   },
      { id: "a2", text: "Центр"  },
      { id: "a3", text: "Низ"    },
    ],
  },

  // ── 6. CROSSWORD: кроссворд ───────────────────────────────────────────────
  // grid:  эталонная 2D сетка (заглавные буквы)
  // words: {number, word, direction, start:{row,col}, length}
  //
  //   C A T        ← слово 1: CAT →  (row0, col0), length 3
  //       A        ← слово 2: TAG ↓  (row0, col2), length 3
  //   D O G        ← слово 3: DOG →  (row2, col0), length 3
  //
  // scoring проверяет посимвольно, регистр-нечувствительно
  {
    id: "q_crossword",
    type: "crossword",
    q: "Разгадайте кроссворд (3 слова):",
    image: "https://placehold.co/600x120/8b5cf6/ffffff?text=1%E2%86%92+CAT+%7C+2%E2%86%93+TAG+%7C+3%E2%86%92+DOG",
    grid: [
      ["C", "A", "T", ""],
      ["",  "",  "A", ""],
      ["D", "O", "G", ""],
    ],
    words: [
      { number: 1, word: "CAT", direction: "across", start: { row: 0, col: 0 }, length: 3 },
      { number: 2, word: "TAG", direction: "down",   start: { row: 0, col: 2 }, length: 3 },
      { number: 3, word: "DOG", direction: "across", start: { row: 2, col: 0 }, length: 3 },
    ],
    blocks: [],
    cellNumbers: { "0,0": 1, "0,2": 2, "2,0": 3 },
    points: 3,
  },

  // ── 7. READING: текст + подвопросы ────────────────────────────────────────
  // q.text:         читаемый текст
  // q.subQuestions: массив подвопросов; scoring использует именно это поле
  // user answer: массив ответов, subAnswers[i] → subQuestions[i]
  {
    id: "q_reading",
    type: "reading",
    q: "Прочитайте текст и ответьте на вопросы:",
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
        options: [
          { id: "ro1", text: "10%" },
          { id: "ro2", text: "20%" }, // ← верный (индекс 1)
          { id: "ro3", text: "30%" },
        ],
        correct: [1],
        points: 1,
      },
      {
        id: "rq2",
        type: "test",
        q: "What threats does the Amazon face? (Select all that apply)",
        multiple: true,
        options: [
          { id: "ro4", text: "Deforestation" },  // ← верный (индекс 0)
          { id: "ro5", text: "Overfishing" },
          { id: "ro6", text: "Climate change" }, // ← верный (индекс 2)
        ],
        correct: [0, 2],
        points: 2,
      },
    ],
    points: 3,
  },

  // ── 8. COMPLEX: составное задание ─────────────────────────────────────────
  // q.subQuestions: mix из test + fill
  // user answer: [ответ_cq1, ответ_cq2]
  //   cq1 (test single): число-индекс
  //   cq2 (fill):        string[] по числу пропусков
  {
    id: "q_complex",
    type: "complex",
    q: "Выполните все подзадания:",
    media: [
      { id: "cm1", type: "image", url: "https://placehold.co/600x200/ec4899/ffffff?text=Complex+Task" },
    ],
    subQuestions: [
      {
        id: "cq1",
        type: "test",
        q: "Сколько будет 2 + 2?",
        multiple: false,
        options: [
          { id: "co1", text: "3" },
          { id: "co2", text: "4" }, // ← верный (индекс 1)
          { id: "co3", text: "5" },
        ],
        correct: [1],
        points: 1,
      },
      {
        id: "cq2",
        type: "fill",
        q: "Впишите столицу России:",
        // answers[0] = варианты для 1-го пропуска
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

/**
 * ВСЕ ПРАВИЛЬНО — ожидаемый score = 100%
 *
 * Формат по типам:
 *   0  test single  → number          (индекс варианта)
 *   1  test multi   → number[]        (индексы вариантов)
 *   2  fill         → string[]        (по одной строке на пропуск)
 *   3  sentence     → string[]        (по одной строке на ___)
 *   4  matching     → {id:id,...}     (pairId → pairId)
 *   5  imagemap     → {id:id,...}     (answerId → pointId)
 *   6  crossword    → string[][]      (2D сетка букв)
 *   7  reading      → [ans0, ans1]    (по subQuestions[i])
 *   8  complex      → [ans0, ans1]    (по subQuestions[i])
 */
const answersAllCorrect: Record<number, any> = {
  0: 2,
  1: [0, 2],
  2: ["Лондон", "Париж", "Берлин"],
  3: ["fox", "dog", "runs"],
  4: { p1: "p1", p2: "p2", p3: "p3" },
  5: { a1: "pt1", a2: "pt2", a3: "pt3" },
  6: [
    ["C", "A", "T", ""],
    ["",  "",  "A", ""],
    ["D", "O", "G", ""],
  ],
  7: [
    1,       // rq1 test single  → индекс "20%"
    [0, 2],  // rq2 test multi   → индексы [Deforestation, Climate change]
  ],
  8: [
    1,           // cq1 test single  → индекс "4"
    ["Москва"],  // cq2 fill         → 1 пропуск
  ],
};

/**
 * СМЕШАННЫЕ ОТВЕТЫ — для тестирования Review Panel
 * Часть правильных, часть нет, чтобы видеть все статусы:
 * ✅ Правильно  ⚠️ Частично  ❌ Неправильно  — Пропущен
 *
 * Итоговый балл ~40-50%
 */
const answersMixed: Record<number, any> = {
  // ❌ test single: выбран индекс 0 ("2024"), правильный — 2 ("2026")
  0: 0,

  // ❌ test multi: [0,1] — один верный (0) и один неверный (1)
  //    scoring: max(0, correctSelected - wrongSelected) / total = max(0, 1-1)/2 = 0
  1: [0, 1],

  // ⚠️ fill: пропуск 1 неверный ("Рим" вместо "Париж")
  2: ["Лондон", "Рим", "Берлин"],

  // ⚠️ sentence: гэп 1 неверный ("cat" вместо "dog")
  3: ["fox", "cat", "runs"],

  // ⚠️ matching: p1 верно, p2 и p3 перепутаны (1/3 пар)
  4: { p1: "p1", p2: "p3", p3: "p2" },

  // ⚠️ imagemap: a1 верно, a2 и a3 перепутаны (1/3 пар)
  5: { a1: "pt1", a2: "pt3", a3: "pt2" },

  // ⚠️ crossword: слово 1 (CAT → COT) неверно, TAG и DOG верны (2/3 слов)
  6: [
    ["C", "O", "T", ""],  // COT ≠ CAT  ❌
    ["",  "",  "A", ""],  // TAG ↓ ✓
    ["D", "O", "G", ""],  // DOG ✓
  ],

  // ⚠️ reading: rq1 неверно (индекс 0 = "10%"), rq2 частично ([0,1] вместо [0,2])
  7: [
    0,       // rq1: выбран "10%" ❌
    [0, 1],  // rq2: Deforestation ✓ + Overfishing ❌ → fraction=0
  ],

  // ❌ complex: оба подзадания неверны
  8: [
    0,            // cq1: выбран "3" ❌
    ["Питер"],    // cq2 fill: неверная столица ❌
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ЭКСПОРТЫ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Сценарий 1 — Чистое прохождение (прогресса нет).
 * Показывает все 9 типов вопросов «с нуля».
 */
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

/**
 * Сценарий 2 — Review Panel со смешанными ответами.
 * Сразу открывает экран разбора ошибок с разными статусами карточек.
 */
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

/**
 * Сценарий 3 — Review Panel с отличным результатом (100%).
 * Все карточки зелёные — проверяем «happy path».
 */
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

/**
 * Сценарий 4 — Повторное прохождение.
 * Есть сохранённый прогресс → показывает ModeChoice («Начать заново» / «Посмотреть ответы»).
 */
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

/**
 * Сценарий 5 — Тема Gatehouse + рекомендация уровня.
 * branch_type = "gatehouse", target_levels = ["B2"] → recommendGatehouseLevel запустится.
 */
export const mockDebugGatehouse = {
  ok: true,
  assignment: {
    ...baseAssignment,
    id: "debug-gatehouse",
    title: "🏰 ЛАБ: Gatehouse (тема + рекомендация уровня)",
    branch_type: "gatehouse",
    materials: [
      {
        ...baseMaterial,
        branch_type: "gatehouse",
        target_levels: ["B2"],
      },
    ],
    content: { questions: allQuestionTypes.slice(0, 4) }, // test×2 + fill + sentence
  },
  progress: null,
};

/**
 * Сценарий 6 — Одиночный вопрос каждого типа для изолированного дебага.
 * Меняй индекс allQuestionTypes[N] под нужный тип.
 *
 *   N=0  test single
 *   N=1  test multi
 *   N=2  fill
 *   N=3  sentence
 *   N=4  matching
 *   N=5  imagemap
 *   N=6  crossword
 *   N=7  reading
 *   N=8  complex
 */
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
