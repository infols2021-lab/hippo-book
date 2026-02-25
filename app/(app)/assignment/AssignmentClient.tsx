"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QuestionCrossword from "./components/QuestionCrossword";
import ReviewPanel from "./components/ReviewPanel";
import { getImageUrl } from "./lib/image";
import { normalizeText } from "./lib/normalize";
import type { FinalStats, ReviewItem } from "./lib/types";

// ===================== TYPES =====================
type ApiOk = {
  ok: true;
  assignment: any;
  progress: null | {
    is_completed: boolean;
    score: number | null;
    completed_at: string | null;
    answers: any;
  };
};

type ApiErr = { ok: false; error: string };
type Api = ApiOk | ApiErr;

type Props = {
  assignmentId: string;
  source?: string;
  sourceId?: string;
};

// ===================== HELPERS =====================
function normalizeQuestions(qs: unknown): any[] {
  if (!Array.isArray(qs)) return [];
  return qs.map((q) => (q && typeof q === "object" ? q : { q: String(q ?? "") }));
}

function ensureGrid(rows: number, cols: number, prev?: string[][]) {
  const g: string[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => prev?.[r]?.[c] ?? "")
  );
  return g;
}

function getCrosswordActiveCells(question: any) {
  const words: any[] = Array.isArray(question?.words) ? question.words : [];
  const active = new Set<string>();

  for (const w of words) {
    const len = Number(w?.length ?? 0);
    const dir = w?.direction;
    const start = w?.start;
    if (!start || !Number.isFinite(len)) continue;

    for (let i = 0; i < len; i++) {
      const r = dir === "across" ? start.row : start.row + i;
      const c = dir === "across" ? start.col + i : start.col;
      active.add(`${r},${c}`);
    }
  }
  return active;
}

// percent = правильные активные клетки / активные клетки
function scoreCrossword(question: any, userGrid?: string[][]) {
  const grid: string[][] = Array.isArray(question?.grid) ? question.grid : [];
  const rows = Number(question?.metadata?.rows ?? grid.length ?? 0);
  const cols = Number(question?.metadata?.cols ?? (grid?.[0]?.length ?? 0));

  const activeCells = getCrosswordActiveCells(question);
  const u = ensureGrid(rows, cols, userGrid);

  let total = 0;
  let correct = 0;
  let filled = 0;

  activeCells.forEach((key) => {
    const [rS, cS] = key.split(",");
    const r = Number(rS);
    const c = Number(cS);

    const correctLetter = String(grid?.[r]?.[c] ?? "").toUpperCase().trim();
    const userLetter = String(u?.[r]?.[c] ?? "").toUpperCase().trim();

    total++;
    if (userLetter) filled++;
    if (userLetter && correctLetter && userLetter === correctLetter) correct++;
  });

  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const allCorrect = total > 0 && correct === total;

  return { total, correct, filled, percent, allCorrect };
}

// ✅ разбор слов по номеру и направлению (across/down)
function buildCrosswordWordReview(question: any, userGrid?: string[][]) {
  const words: any[] = Array.isArray(question?.words) ? question.words : [];
  const cellNumbers: Record<string, number> = (question?.cellNumbers as any) || {};
  const grid: string[][] = Array.isArray(question?.grid) ? question.grid : [];
  const rows = Number(question?.metadata?.rows ?? grid.length ?? 0);
  const cols = Number(question?.metadata?.cols ?? (grid?.[0]?.length ?? 0));
  const u = ensureGrid(rows, cols, userGrid);

  function wordAt(w: any, from: string[][]) {
    const len = Number(w?.length ?? 0);
    const dir: "across" | "down" = w?.direction === "down" ? "down" : "across";
    const start = w?.start;
    if (!start || !len) return "";
    let s = "";
    for (let i = 0; i < len; i++) {
      const r = dir === "across" ? start.row : start.row + i;
      const c = dir === "across" ? start.col + i : start.col;
      s += String(from?.[r]?.[c] ?? "").toUpperCase();
    }
    return s;
  }

  const wrong: Array<{ number: number; direction: "across" | "down"; user: string; correct: string }> = [];
  const correct: Array<{ number: number; direction: "across" | "down"; word: string }> = [];

  for (const w of words) {
    const start = w?.start;
    if (!start) continue;
    const dir: "across" | "down" = w?.direction === "down" ? "down" : "across";
    const key = `${start.row}-${start.col}`;
    const number = Number(cellNumbers[key] ?? w?.number ?? 0);

    const userWord = wordAt(w, u).trim();
    const corrWord = wordAt(w, grid).trim();

    // если слово вообще не заполнено — пусть будет "wrong"
    if (!userWord || userWord.includes(" ")) {
      wrong.push({ number, direction: dir, user: userWord || "—", correct: corrWord || "—" });
      continue;
    }

    if (userWord === corrWord && corrWord) correct.push({ number, direction: dir, word: corrWord });
    else wrong.push({ number, direction: dir, user: userWord || "—", correct: corrWord || "—" });
  }

  // сортируем: по номеру, потом across перед down
  const dirOrder = (d: "across" | "down") => (d === "across" ? 0 : 1);
  wrong.sort((a, b) => a.number - b.number || dirOrder(a.direction) - dirOrder(b.direction));
  correct.sort((a, b) => a.number - b.number || dirOrder(a.direction) - dirOrder(b.direction));

  return { wrong, correct };
}

// ===================== COMPONENT =====================
export default function AssignmentClient({ assignmentId, source, sourceId }: Props) {
  const router = useRouter();

  // ✅ ЖЁСТКАЯ навигация "назад в источник"
  const back = useMemo(() => {
    const s = String(source ?? "").trim().toLowerCase();
    const id = String(sourceId ?? "").trim();

    if (s === "textbook" && id) {
      const href = `/textbook/${encodeURIComponent(id)}`;
      return { href, headerLabel: "← Назад в учебник", actionLabel: "Вернуться в учебник" };
    }

    if (s === "crossword" && id) {
      const href = `/crossword/${encodeURIComponent(id)}`;
      return { href, headerLabel: "← Назад в кроссворд", actionLabel: "Вернуться в кроссворд" };
    }

    return { href: "/materials", headerLabel: "← Назад к материалам", actionLabel: "Вернуться к материалам" };
  }, [source, sourceId]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [assignment, setAssignment] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);

  // только завершённый прогресс с бэка
  const [previousProgress, setPreviousProgress] = useState<ApiOk["progress"]>(null);

  // выбор режима
  const [showChoice, setShowChoice] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);

  // ответы (в памяти)
  const [answers, setAnswers] = useState<any>({});

  // навигация
  const [currentIndex, setCurrentIndex] = useState(0);

  // completion
  const [completedScreen, setCompletedScreen] = useState(false);
  const [finalStats, setFinalStats] = useState<FinalStats | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);

  // image modal
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [modalSrc, setModalSrc] = useState<string>("");
  const [zoom, setZoom] = useState(1);

  const saveBusyRef = useRef(false);

  async function load() {
    try {
      setLoading(true);
      setErr(null);

      const res = await fetch(`/api/assignment-data/${encodeURIComponent(assignmentId)}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as Api;

      if (!res.ok || !("ok" in json) || json.ok !== true) {
        throw new Error((json as ApiErr).error || "Не удалось загрузить задание");
      }

      setAssignment(json.assignment);
      const qs = normalizeQuestions(json.assignment?.content?.questions);
      setQuestions(qs);

      setPreviousProgress(json.progress);

      // если есть завершённый прогресс — предлагаем выбор
      if (json.progress?.is_completed) {
        setAnswers(json.progress.answers ?? {});
        setShowChoice(true);
      } else {
        setAnswers({});
        setShowChoice(false);
      }

      setIsViewMode(false);
      setCurrentIndex(0);
      setCompletedScreen(false);
      setFinalStats(null);
      setReviewItems([]);

      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setErr(e?.message || "Ошибка загрузки задания");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  function openImage(src: string) {
    setModalSrc(src);
    setZoom(1);
    setImageModalOpen(true);
  }

  function closeImage() {
    setImageModalOpen(false);
    setModalSrc("");
    setZoom(1);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && imageModalOpen) closeImage();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [imageModalOpen]);

  function setAnswerForQuestion(qIndex: number, value: any) {
    setAnswers((prev: any) => ({ ...prev, [qIndex]: value }));
  }

  function startFresh() {
    // никаких сохранений незавершённых
    setIsViewMode(false);
    setAnswers({});
    setShowChoice(false);
    setCurrentIndex(0);
    setCompletedScreen(false);
    setFinalStats(null);
    setReviewItems([]);
  }

  function viewPrevious() {
    setIsViewMode(true);
    setShowChoice(false);
    setCurrentIndex(0);
    setCompletedScreen(false);
    setFinalStats(null);
    setReviewItems([]);
  }

  function switchMode() {
    if (!previousProgress?.is_completed) return;
    setShowChoice(true);
    setCompletedScreen(false);
    setFinalStats(null);
    setReviewItems([]);
  }

  function notifyProfileStreakRefresh(payload?: unknown) {
    try {
      if (typeof window === "undefined") return;

      // флаг "после выполнения задания обнови стрик"
      sessionStorage.setItem("profile-streak-dirty", "1");

      // опционально сохраним snapshot/ответ (если есть) — на будущее
      if (payload !== undefined) {
        sessionStorage.setItem("profile-streak-last-save-response", JSON.stringify(payload));
      }

      // событие для страниц/компонентов, которые уже открыты и слушают обновление
      window.dispatchEvent(new Event("profile-streak-refresh"));
    } catch {
      // ничего не ломаем, это только UI-синхронизация
    }
  }

  async function saveCompletedProgress(score: number) {
    if (saveBusyRef.current) return;
    saveBusyRef.current = true;

    try {
      const res = await fetch("/api/assignment-progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          answers,
          isCompleted: true,
          score,
        }),
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      // ✅ если сохранение прошло — триггерим обновление стрика в профиле
      if (res.ok && json?.ok) {
        notifyProfileStreakRefresh(json?.streak ?? json);
      }
    } finally {
      saveBusyRef.current = false;
    }
  }

  function validateAllAnswered() {
    for (let i = 0; i < questions.length; i++) {
      const q: any = questions[i];
      const a = answers[i];

      if (q.type === "test") {
        const ok = a !== undefined && a !== null && a !== "";
        if (!ok) return { ok: false as const, index: i };
      }

      if (q.type === "fill") {
        const correctCount = (q.answers || []).length;
        const ok =
          Array.isArray(a) && a.length >= correctCount && a.every((x: any) => String(x ?? "").trim() !== "");
        if (!ok) return { ok: false as const, index: i };
      }

      if (q.type === "sentence") {
        const gaps = (String(q.sentence || "").match(/___/g) || []).length;
        const ok =
          Array.isArray(a) && a.length >= gaps && a.every((x: any) => String(x ?? "").trim() !== "");
        if (!ok) return { ok: false as const, index: i };
      }

      if (q.type === "crossword") {
        // кроссворд должен быть заполнен по активным клеткам
        const active = getCrosswordActiveCells(q);
        const grid: string[][] = Array.isArray(q?.grid) ? q.grid : [];
        const rows = Number(q?.metadata?.rows ?? grid.length ?? 0);
        const cols = Number(q?.metadata?.cols ?? (grid?.[0]?.length ?? 0));
        const u = ensureGrid(rows, cols, a);

        let allFilled = true;
        active.forEach((key) => {
          const [rS, cS] = key.split(",");
          const r = Number(rS);
          const c = Number(cS);
          const v = String(u?.[r]?.[c] ?? "").trim();
          if (!v) allFilled = false;
        });

        if (!allFilled) return { ok: false as const, index: i };
      }
    }

    return { ok: true as const, index: -1 };
  }

  function calcAndBuildReview(): { stats: FinalStats; review: ReviewItem[] } {
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;

    // ✅ баллы
    let pointsEarned = 0;
    let pointsTotal = 0;

    const review: ReviewItem[] = [];

    questions.forEach((q: any, i) => {
      const questionText = String(q?.q ?? "").trim() || `Вопрос ${i + 1}`;
      const a = answers[i];

      // каждый вопрос = 1 балл максимум
      pointsTotal += 1;

      // TEST
      if (q.type === "test") {
        const opts: string[] = Array.isArray(q.options) ? q.options.map(String) : [];
        const correctIdx = Number(q.correct);
        const correctLabel = Number.isFinite(correctIdx) && opts[correctIdx] ? opts[correctIdx] : "—";

        const answered = a !== undefined && a !== null && a !== "";
        if (!answered) {
          skipped++;
          review.push({
            type: "test",
            questionText,
            isCorrect: false,
            isSkipped: true,
            userLabel: "Не отвечено",
            correctLabel,
            pointsEarned: 0,
            pointsTotal: 1,
          });
          return;
        }

        const userIdx = Number(a);
        const userLabel = Number.isFinite(userIdx) && opts[userIdx] ? opts[userIdx] : String(a);
        const isCorrect = userIdx === correctIdx;

        if (isCorrect) {
          correct++;
          pointsEarned += 1;
        } else {
          incorrect++;
        }

        review.push({
          type: "test",
          questionText,
          isCorrect,
          isSkipped: false,
          userLabel,
          correctLabel,
          pointsEarned: isCorrect ? 1 : 0,
          pointsTotal: 1,
        });
        return;
      }

      // FILL (✅ частичный зачёт)
      if (q.type === "fill") {
        const correctAnswers = Array.isArray(q.answers) ? q.answers : [];
        const need = correctAnswers.length;

        const correctText = correctAnswers.map((variants: any) =>
          (Array.isArray(variants) ? variants : [variants]).map(String).join(" или ")
        );

        const answered =
          Array.isArray(a) &&
          a.length >= need &&
          a.slice(0, need).every((x: any) => String(x ?? "").trim() !== "");

        if (!answered) {
          skipped++;
          review.push({
            type: "fill",
            questionText,
            isCorrect: false,
            isSkipped: true,
            userAnswers: Array.isArray(a) ? a.map((x: any) => String(x ?? "")) : [],
            correctAnswers: correctText,
            parts: Array.from({ length: need }).map((_, idx) => ({
              index: idx + 1,
              user: String((Array.isArray(a) ? a[idx] : "") ?? ""),
              correct: correctText[idx] ?? "—",
              isCorrect: false,
            })),
            percent: 0,
            correctCount: 0,
            totalCount: need,
            pointsEarned: 0,
            pointsTotal: 1,
          });
          return;
        }

        const userArr: string[] = (a as any[]).slice(0, need).map((x) => String(x ?? ""));
        let correctCount = 0;

        const parts = correctAnswers.map((variants: any, idx: number) => {
          const user = normalizeText(userArr[idx]);
          const vars = (Array.isArray(variants) ? variants : [variants]).map(normalizeText);
          const ok = vars.some((v) => v === user);
          if (ok) correctCount++;

          return {
            index: idx + 1,
            user: userArr[idx] ?? "",
            correct: correctText[idx] ?? "—",
            isCorrect: ok,
          };
        });

        const ratio = need > 0 ? correctCount / need : 0;
        const percent = Math.round(ratio * 100);

        // ✅ дробные баллы
        pointsEarned += ratio;

        const fullyCorrect = need > 0 && correctCount === need;

        if (fullyCorrect) correct++;
        else incorrect++;

        review.push({
          type: "fill",
          questionText,
          isCorrect: fullyCorrect,
          isSkipped: false,
          userAnswers: userArr,
          correctAnswers: correctText,
          parts,
          percent,
          correctCount,
          totalCount: need,
          pointsEarned: ratio,
          pointsTotal: 1,
        });
        return;
      }

      // SENTENCE (✅ частичный зачёт)
      if (q.type === "sentence") {
        const gaps = (String(q.sentence || "").match(/___/g) || []).length;
        const correctAnswers = Array.isArray(q.answers) ? q.answers : [];
        const need = gaps;

        const correctText = correctAnswers.map((variants: any) =>
          (Array.isArray(variants) ? variants : [variants]).map(String).join(" или ")
        );

        const answered =
          Array.isArray(a) &&
          a.length >= need &&
          a.slice(0, need).every((x: any) => String(x ?? "").trim() !== "");

        if (!answered) {
          skipped++;
          review.push({
            type: "sentence",
            questionText,
            isCorrect: false,
            isSkipped: true,
            userAnswers: Array.isArray(a) ? a.map((x: any) => String(x ?? "")) : [],
            correctAnswers: correctText,
            parts: Array.from({ length: need }).map((_, idx) => ({
              index: idx + 1,
              user: String((Array.isArray(a) ? a[idx] : "") ?? ""),
              correct: correctText[idx] ?? "—",
              isCorrect: false,
            })),
            percent: 0,
            correctCount: 0,
            totalCount: need,
            pointsEarned: 0,
            pointsTotal: 1,
          });
          return;
        }

        const userArr: string[] = (a as any[]).slice(0, need).map((x) => String(x ?? ""));
        let correctCount = 0;

        const parts = correctAnswers.slice(0, need).map((variants: any, idx: number) => {
          const user = normalizeText(userArr[idx]);
          const vars = (Array.isArray(variants) ? variants : [variants]).map(normalizeText);
          const ok = vars.some((v) => v === user);
          if (ok) correctCount++;

          return {
            index: idx + 1,
            user: userArr[idx] ?? "",
            correct: correctText[idx] ?? "—",
            isCorrect: ok,
          };
        });

        const ratio = need > 0 ? correctCount / need : 0;
        const percent = Math.round(ratio * 100);

        pointsEarned += ratio;

        const fullyCorrect = need > 0 && correctCount === need;

        if (fullyCorrect) correct++;
        else incorrect++;

        review.push({
          type: "sentence",
          questionText,
          isCorrect: fullyCorrect,
          isSkipped: false,
          userAnswers: userArr,
          correctAnswers: correctText,
          parts,
          percent,
          correctCount,
          totalCount: need,
          pointsEarned: ratio,
          pointsTotal: 1,
        });
        return;
      }

      // CROSSWORD (НЕ трогаем логику)
      if (q.type === "crossword") {
        const userGrid = a as string[][] | undefined;
        const scored = scoreCrossword(q, userGrid);

        const answered = scored.filled > 0;

        if (!answered) {
          skipped++;
          review.push({
            type: "crossword",
            questionText,
            isCorrect: false,
            isSkipped: true,
            note: "Кроссворд не заполнен",
            crosswordStats: { filled: scored.filled, total: scored.total, percent: scored.percent },
            wordReview: buildCrosswordWordReview(q, userGrid),
            pointsEarned: 0,
            pointsTotal: 1,
          });
          return;
        }

        // ✅ частичный балл за кроссворд
        const ratio = scored.percent / 100;
        pointsEarned += ratio;

        if (scored.allCorrect) correct++;
        else incorrect++;

        review.push({
          type: "crossword",
          questionText,
          isCorrect: scored.allCorrect,
          isSkipped: false,
          note: `Правильность по клеткам: ${scored.correct}/${scored.total}`,
          crosswordStats: { filled: scored.filled, total: scored.total, percent: scored.percent },
          wordReview: buildCrosswordWordReview(q, userGrid),
          pointsEarned: ratio,
          pointsTotal: 1,
        });
        return;
      }

      // OTHER
      skipped++;
      review.push({
        type: "other",
        questionText,
        isCorrect: false,
        isSkipped: true,
        note: "Тип вопроса пока не поддержан.",
        pointsEarned: 0,
        pointsTotal: 1,
      });
    });

    const total = correct + incorrect + skipped;

    // ✅ итоговый процент по баллам
    const score = pointsTotal > 0 ? Math.round((pointsEarned / pointsTotal) * 100) : 0;

    return {
      stats: {
        score,
        correct,
        incorrect,
        skipped,
        total,
        pointsEarned,
        pointsTotal,
      },
      review,
    };
  }

  async function finish() {
    if (isViewMode) return;

    const v = validateAllAnswered();
    if (!v.ok) {
      alert(`❌ Не все вопросы заполнены! Ответьте на вопрос ${v.index + 1}`);
      setCurrentIndex(v.index);
      return;
    }

    const { stats, review } = calcAndBuildReview();

    await saveCompletedProgress(stats.score);

    setFinalStats(stats);
    setReviewItems(review);
    setCompletedScreen(true);
  }

  const q = questions[currentIndex] || null;

  const showReview = useMemo(() => {
    if (!finalStats) return false;
    return finalStats.incorrect > 0 || finalStats.skipped > 0;
  }, [finalStats]);

  // ===================== RENDER =====================
  return (
    <div className="container">
      <header className="header">
        <div className="header-buttons">
          {/* ✅ вместо BackToSourceButton: жёстко уходим в источник */}
          <button className="btn secondary" type="button" onClick={() => router.push(back.href)}>
            {back.headerLabel}
          </button>

          <button
            className="mode-switch-btn"
            onClick={switchMode}
            style={{ display: previousProgress?.is_completed ? "block" : "none" }}
            type="button"
          >
            ↶ Сменить режим
          </button>
        </div>
        <h1>Задание</h1>
      </header>

      {loading ? (
        <div id="loading" className="loading">
          <div className="spinner"></div>
          <p>Загружаем задание...</p>
        </div>
      ) : null}

      {err ? <div id="errorMessage" className="error-message">{err}</div> : null}

      {!loading && !err && assignment ? (
        <>
          {/* выбор режима */}
          {showChoice ? (
            <div className="assignment-container">
              <div className="restart-container" style={{ display: "block" }}>
                <h3>📊 У вас есть предыдущий результат</h3>
                <p>Вы можете просмотреть свои прошлые ответы или начать заново с чистыми полями</p>
                <div>
                  <button className="restart-btn" onClick={startFresh} type="button">
                    Начать заново
                  </button>
                  <button className="btn secondary" onClick={viewPrevious} type="button">
                    Просмотреть прошлые ответы
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* экран завершения */}
          {completedScreen && finalStats ? (
            <div id="completionScreen" className="completion-message" style={{ display: "block" }}>
              <div className="card">
                <h2>🎉 Задание завершено!</h2>

                <div className="score-display" id="finalScore">
                  {finalStats.score}%
                </div>

                <p id="completionMessage">
                  {finalStats.score >= 90
                    ? "Отличный результат! Вы прекрасно справились с заданием!"
                    : finalStats.score >= 70
                    ? "Хороший результат! Вы хорошо усвоили материал."
                    : finalStats.score >= 50
                    ? "Неплохой результат! Есть над чем поработать."
                    : "Попробуйте пройти задание ещё раз для лучшего результата."}
                </p>

                <div className="completion-details">
                  <h3>📊 Детали результатов</h3>

                  <div className="result-item">
                    <span>Всего вопросов:</span>
                    <span>{finalStats.total}</span>
                  </div>

                  <div className="result-item">
                    <span>Правильных ответов (100%):</span>
                    <span>{finalStats.correct}</span>
                  </div>

                  <div className="result-item">
                    <span>Неправильных ответов:</span>
                    <span>{finalStats.incorrect}</span>
                  </div>

                  <div className="result-item">
                    <span>Пропущено вопросов:</span>
                    <span>{finalStats.skipped}</span>
                  </div>

                  <div className="result-item">
                    <span>Набрано баллов:</span>
                    <span>
                      {Number(finalStats.pointsEarned ?? 0).toFixed(2)} /{" "}
                      {finalStats.pointsTotal ?? finalStats.total}
                    </span>
                  </div>
                </div>

                {showReview ? <ReviewPanel items={reviewItems} /> : null}

                <div style={{ marginTop: 30 }}>
                  {/* ✅ возвращаемся в источник */}
                  <button className="btn" onClick={() => router.push(back.href)} type="button">
                    {back.actionLabel}
                  </button>

                  <button
                    className="btn secondary"
                    onClick={() => location.reload()}
                    style={{ marginLeft: 10 }}
                    type="button"
                  >
                    Пройти заново
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* основной экран */}
          {!showChoice && !completedScreen ? (
            <div id="assignmentContent" style={{ display: "block" }}>
              <div className="assignment-container">
                <div className="card" id="questionsCard" style={{ display: "block" }}>
                  <h2 id="assignmentTitle">{assignment.title}</h2>

                  <div
                    id="viewModeNotice"
                    className="view-mode-notice"
                    style={{ display: isViewMode ? "block" : "none" }}
                  >
                    <strong>👀 Режим просмотра</strong>
                    <br />
                    <small>Вы просматриваете свои предыдущие ответы</small>
                  </div>

                  <div className="question-counter">
                    Вопрос <span id="currentQuestion">{currentIndex + 1}</span> из{" "}
                    <span id="totalQuestions">{questions.length}</span>
                  </div>

                  <div id="questionsContainer">
                    {q ? (
                      <div className="question-card">
                        <div className="question-number">
                          Вопрос {currentIndex + 1} из {questions.length}
                        </div>

                        <div className="question-text">{q.q || "Вопрос без текста"}</div>

                        {/* Общая картинка вопроса (для test/fill/sentence), кроссворд сам покажет своё */}
                        {q.image && q.type !== "crossword" ? (
                          <img
                            className="question-image"
                            src={getImageUrl(q.image)}
                            alt="Изображение к вопросу"
                            onClick={() => openImage(getImageUrl(q.image))}
                            onError={(e) => (e.currentTarget.style.display = "none")}
                          />
                        ) : null}

                        {/* TEST */}
                        {q.type === "test" && Array.isArray(q.options) ? (
                          <div className="options-container">
                            {q.options.map((opt: string, optIdx: number) => {
                              const selected = Number(answers[currentIndex]) === optIdx;

                              return (
                                <label key={optIdx} className={`option-label ${selected ? "selected" : ""}`}>
                                  <input
                                    className="option-radio"
                                    type="radio"
                                    name={`q-${currentIndex}`}
                                    disabled={isViewMode}
                                    checked={selected}
                                    onChange={() => setAnswerForQuestion(currentIndex, optIdx)}
                                  />
                                  {opt}
                                </label>
                              );
                            })}
                          </div>
                        ) : null}

                        {/* FILL */}
                        {q.type === "fill" ? (
                          <>
                            <div className="fill-inputs-container">
                              {(q.answers || []).map((_variants: any, idx: number) => (
                                <div className="fill-input-item" key={idx}>
                                  <div className="fill-input-number">{idx + 1}</div>
                                  <input
                                    disabled={isViewMode}
                                    value={(answers[currentIndex]?.[idx] ?? "") as string}
                                    onChange={(e) => {
                                      const arr = Array.isArray(answers[currentIndex]) ? [...answers[currentIndex]] : [];
                                      arr[idx] = e.target.value;
                                      setAnswerForQuestion(currentIndex, arr);
                                    }}
                                    placeholder={`Введите ответ ${idx + 1}...`}
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="fill-input-count">Количество ответов: {(q.answers || []).length}</div>
                          </>
                        ) : null}

                        {/* SENTENCE */}
                        {q.type === "sentence" ? (
                          <div className="sentence-container">
                            <div className="sentence-text">
                              {(() => {
                                const parts = String(q.sentence || "").split("___");
                                const gaps = parts.length - 1;
                                const arr = Array.isArray(answers[currentIndex]) ? answers[currentIndex] : [];

                                return (
                                  <>
                                    {parts.map((part: string, idx: number) => (
                                      <span key={idx}>
                                        <span style={{ whiteSpace: "pre-line" }}>{part}</span>
                                        {idx < gaps ? (
                                          <span className="sentence-gap">
                                            <input
                                              className="sentence-input"
                                              disabled={isViewMode}
                                              value={arr[idx] ?? ""}
                                              placeholder={`Ответ ${idx + 1}`}
                                              onChange={(e) => {
                                                const next = Array.isArray(arr) ? [...arr] : [];
                                                next[idx] = e.target.value;
                                                setAnswerForQuestion(currentIndex, next);
                                              }}
                                            />
                                          </span>
                                        ) : null}
                                      </span>
                                    ))}
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        ) : null}

                        {/* CROSSWORD */}
                        {q.type === "crossword" ? (
                          <QuestionCrossword
                            question={q}
                            value={answers[currentIndex] as string[][] | undefined}
                            disabled={isViewMode}
                            onOpenImage={(src) => openImage(src)}
                            onChange={(grid) => setAnswerForQuestion(currentIndex, grid)}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="navigation">
                    <button
                      className="btn secondary"
                      id="prevBtn"
                      style={{ display: currentIndex > 0 ? "block" : "none" }}
                      onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                      type="button"
                    >
                      ← Назад
                    </button>

                    <button
                      className="btn"
                      id="nextBtn"
                      style={{ display: currentIndex < questions.length - 1 ? "block" : "none" }}
                      onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                      type="button"
                    >
                      Далее →
                    </button>

                    {!isViewMode ? (
                      <button
                        className="btn-finish"
                        id="finishBtn"
                        style={{ display: currentIndex === questions.length - 1 ? "block" : "none" }}
                        onClick={() => void finish()}
                        type="button"
                      >
                        Завершить задание
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {/* IMAGE MODAL */}
      <div
        id="imageModal"
        className="image-modal"
        style={{ display: imageModalOpen ? "block" : "none" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeImage();
        }}
      >
        <span className="image-modal-close" onClick={closeImage}>
          &times;
        </span>

        <img
          className="image-modal-content"
          id="modalImage"
          src={modalSrc}
          alt=""
          style={{ transform: `translate(-50%, -50%) scale(${zoom})` }}
        />

        <div className="image-modal-controls">
          <button
            className="image-modal-btn"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            type="button"
          >
            −
          </button>
          <div className="image-modal-zoom-info">{Math.round(zoom * 100)}%</div>
          <button
            className="image-modal-btn"
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
            type="button"
          >
            +
          </button>
          <button className="image-modal-btn" onClick={() => setZoom(1)} type="button">
            ⟲
          </button>
        </div>

        <div className="image-modal-hint" style={{ display: zoom > 1 ? "block" : "none" }}>
          🔍 Масштабирование
        </div>
      </div>
    </div>
  );
}