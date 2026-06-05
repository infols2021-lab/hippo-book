"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createPortal } from "react-dom";

// === КОМПОНЕНТЫ ВОПРОСОВ ===
import QuestionCrossword from "./components/QuestionCrossword";
import QuestionTest from "./components/QuestionTest";
import QuestionFill from "./components/QuestionFill";
import QuestionSentence from "./components/QuestionSentence";
import QuestionMatching from "./components/QuestionMatching";
import QuestionComplex from "./components/QuestionComplex";
import QuestionImageMap from "./components/QuestionImageMap";
import QuestionReading from "./components/QuestionReading";
import MediaRenderer from "./components/MediaRenderer";
import ReviewPanel from "./components/ReviewPanel";
import ImageModal from "./components/ImageModal";

// === ЛОГИКА И ТИПЫ ===
import { getImageUrl } from "./lib/image";
import type { FinalStats, ReviewItem, QuestionAny } from "./lib/types";
import { validateAllAnswered, calcAndBuildReview } from "./lib/scoring";

import {
  recommendGatehouseLevel,
  getGatehouseRecommendationBadge,
  type GatehouseRecommendation,
} from "@/lib/exams/recommendLevel";

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

// ===================== ЖЕЛЕЗОБЕТОННЫЙ ПОРТАЛ =====================
// Эта обертка вырывает модалку из любых контейнеров и обходит баги CSS (transform/filter),
// гарантируя 100% покрытие экрана поверх всего сайта с блокировкой скролла.
function IroncladModalPortal({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const div = document.createElement("div");
    div.id = "ironclad-modal-root";
    div.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 2147483647 !important;
      pointer-events: none;
      visibility: hidden;
      margin: 0 !important;
      padding: 0 !important;
      transform: none !important;
      filter: none !important;
      background: transparent !important;
    `;
    document.body.appendChild(div);
    setEl(div);

    return () => {
      document.body.removeChild(div);
    };
  }, []);

  useEffect(() => {
    if (!el) return;
    if (open) {
      el.style.pointerEvents = "auto";
      el.style.visibility = "visible";
      document.body.style.overflow = "hidden"; // Блокируем скролл фона
    } else {
      el.style.pointerEvents = "none";
      el.style.visibility = "hidden";
      document.body.style.overflow = "";
    }

    return () => { document.body.style.overflow = ""; };
  }, [open, el]);

  if (!el) return null;
  return createPortal(children, el);
}

// ===================== HELPERS =====================
function normalizeQuestions(qs: unknown): QuestionAny[] {
  if (!Array.isArray(qs)) return [];
  return qs.map((q) => {
    const base = q && typeof q === "object" ? q : { q: String(q ?? "") };
    if (!base.id) base.id = crypto.randomUUID();
    return base as QuestionAny;
  });
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function getAssignmentMaterialLevels(assignment: any): string[] {
  const direct = normalizeStringArray(assignment?.target_levels);
  if (direct.length) return direct;

  const material = Array.isArray(assignment?.materials) ? assignment.materials[0] : assignment?.materials;
  const materialLevels = normalizeStringArray(material?.target_levels);
  if (materialLevels.length) return materialLevels;

  const material2 = Array.isArray(assignment?.material) ? assignment.material[0] : assignment?.material;
  return normalizeStringArray(material2?.target_levels);
}

// Проверяет заполнен ли ответ на вопрос (для прогресс-бара)
function isQuestionAnswered(q: QuestionAny, answer: any): boolean {
  if (answer === undefined || answer === null) return false;
  switch (q.type) {
    case "test":
      return (q as any).multiple
        ? Array.isArray(answer) && answer.length > 0
        : answer !== "" && answer !== null && answer !== undefined;
    case "fill":
    case "sentence": {
      const arr = Array.isArray(answer) ? answer : [];
      return arr.length > 0 && arr.some((x: any) => String(x ?? "").trim() !== "");
    }
    case "matching":
    case "imagemap":
      return typeof answer === "object" && Object.keys(answer).length > 0;
    case "crossword": {
      const userGrid: string[][] = Array.isArray(answer) ? answer : [];
      const correctGrid: string[][] = Array.isArray((q as any).grid) ? (q as any).grid : [];
      const words: any[] = Array.isArray((q as any).words) ? (q as any).words : [];

      const activeCells = new Set<string>();
      for (const w of words) {
        const len = Number(w?.length ?? 0);
        if (!w?.start || !w?.direction || len <= 0) continue;
        for (let step = 0; step < len; step++) {
          const r = w.direction === "across" ? w.start.row : w.start.row + step;
          const c = w.direction === "across" ? w.start.col + step : w.start.col;
          activeCells.add(`${r},${c}`);
        }
      }
      
      if (activeCells.size === 0) {
        correctGrid.forEach((row: string[], r: number) =>
          row.forEach((ch: string, c: number) => {
            if (String(ch ?? "").trim()) activeCells.add(`${r},${c}`);
          })
        );
      }

      if (activeCells.size === 0) return false;

      for (const key of activeCells) {
        const [r, c] = key.split(",").map(Number);
        if (!String(userGrid?.[r]?.[c] ?? "").trim()) return false;
      }
      return true;
    }
    case "complex":
    case "reading": {
      const arr = Array.isArray(answer) ? answer : [];
      return arr.some((a: any) => a !== null && a !== undefined);
    }
    default:
      return !!answer;
  }
}

// ===================== COMPONENT =====================
export default function AssignmentClient({ assignmentId, source, sourceId }: Props) {
  const router = useRouter();

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [assignment, setAssignment] = useState<any>(null);
  const [questions, setQuestions] = useState<QuestionAny[]>([]);

  const [previousProgress, setPreviousProgress] = useState<ApiOk["progress"]>(null);

  const [showChoice, setShowChoice] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);

  const [answers, setAnswers] = useState<any>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const [completedScreen, setCompletedScreen] = useState(false);
  const [finalStats, setFinalStats] = useState<FinalStats | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [gatehouseRecommendation, setGatehouseRecommendation] = useState<GatehouseRecommendation | null>(null);

  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [modalSrc, setModalSrc] = useState<string>("");

  const saveBusyRef = useRef(false);

  // --- PRELOAD следующего вопроса ---
  useEffect(() => {
    const nextIndex = currentIndex + 1;
    if (!questions[nextIndex]) return;
    
    const nextQ = questions[nextIndex];
    const urls: string[] = [];
    
    if (Array.isArray(nextQ.media)) {
      for (const m of nextQ.media) {
        if (
          m?.url &&
          (m.type === "image" || m.url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i))
        ) {
          urls.push(getImageUrl(m.url));
        }
      }
    }
    
    if ((nextQ as any).image) urls.push(getImageUrl((nextQ as any).image));
    
    if (nextQ.type === "test" && Array.isArray((nextQ as any).options)) {
      for (const opt of (nextQ as any).options) {
        if (Array.isArray(opt?.media)) {
          for (const m of opt.media) {
            if (m?.url) urls.push(m.url);
          }
        }
      }
    }
    
    const imgs = urls.map((src) => {
      const img = new window.Image();
      img.src = src;
      return img;
    });
    
    return () => {
      imgs.forEach((img) => { img.src = ""; });
    };
  }, [currentIndex, questions]);

  // --- THEME LOGIC ---
  const isGatehouse = useMemo(() => {
    const s = String(source ?? "").trim().toLowerCase();
    return s.includes("gatehouse") || assignment?.branch_type === "gatehouse";
  }, [assignment, source]);

  const theme = useMemo(() => {
    if (isGatehouse) {
      return {
        primary: "#6366f1",
        accent: "#a855f7",
        bg: "linear-gradient(135deg, #f5f3ff 0%, #e0e7ff 100%)",
        cardBg: "rgba(255, 255, 255, 0.95)",
        text: "#1e1b4b",
        buttonText: "#ffffff",
        badge: "PROFICIENCY TEST"
      };
    }
    return {
      primary: "#0ea5e9",
      accent: "#f59e0b",
      bg: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
      cardBg: "#ffffff",
      text: "#0c4a6e",
      buttonText: "#ffffff",
      badge: "OLYMPIAD"
    };
  }, [isGatehouse]);

  const back = useMemo(() => {
    const s = String(source ?? "").trim().toLowerCase();
    const id = String(sourceId ?? "").trim();

    if (s === "textbook" && id) {
      return { href: `/textbook/${encodeURIComponent(id)}`, headerLabel: "← Назад в учебник", actionLabel: "Вернуться в учебник" };
    }
    if (s === "crossword" && id) {
      return { href: `/crossword/${encodeURIComponent(id)}`, headerLabel: "← Назад в кроссворд", actionLabel: "Вернуться в кроссворд" };
    }
    if ((s === "gatehouse-material" || s === "gatehouse") && id) {
      return { href: `/gatehouse/material/${encodeURIComponent(id)}`, headerLabel: "← Назад к тесту", actionLabel: "Вернуться к тесту" };
    }
    if (s === "gatehouse-material" || s === "gatehouse") {
      return { href: "/gatehouse/materials", headerLabel: "← К экзаменам", actionLabel: "К экзаменам" };
    }
    return { href: "/materials", headerLabel: "← К материалам", actionLabel: "К материалам" };
  }, [source, sourceId]);

  // --- ACTIONS ---
  async function load() {
    try {
      setLoading(true);
      setErr(null);

      const res = await fetch(`/api/assignment-data/${encodeURIComponent(assignmentId)}`, { cache: "no-store" });
      const json = (await res.json()) as Api;

      if (!res.ok || !("ok" in json) || json.ok !== true) {
        throw new Error((json as ApiErr).error || "Не удалось загрузить задание");
      }

      setAssignment(json.assignment);
      const qs = normalizeQuestions(json.assignment?.content?.questions);
      setQuestions(qs);
      setPreviousProgress(json.progress);

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
      setGatehouseRecommendation(null);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setErr(e?.message || "Ошибка загрузки задания");
    }
  }

  useEffect(() => { load(); }, [assignmentId]);

  function openImage(src: string) {
    setModalSrc(src);
    setImageModalOpen(true);
  }

  function closeImage() {
    setImageModalOpen(false);
    setModalSrc("");
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && imageModalOpen) closeImage(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [imageModalOpen]);

  function setAnswerForQuestion(qIndex: number, value: any) {
    setAnswers((prev: any) => ({ ...prev, [qIndex]: value }));
  }

  function startFresh() {
    setIsViewMode(false);
    setAnswers({});
    setShowChoice(false);
    setCurrentIndex(0);
    setCompletedScreen(false);
  }

  function viewPrevious() {
    setIsViewMode(true);
    setShowChoice(false);
    setCurrentIndex(0);
    setCompletedScreen(false);
  }

  function switchMode() {
    if (!previousProgress?.is_completed) return;
    setShowChoice(true);
    setCompletedScreen(false);
    setFinalStats(null);
    setReviewItems([]);
    setGatehouseRecommendation(null);
  }

  async function saveProgress(score: number) {
    if (saveBusyRef.current) return;
    saveBusyRef.current = true;
    try {
      const payload = {
        assignmentId,
        answers,
        isCompleted: true,
        score,
        source,
        sourceId,
        branchType: isGatehouse ? "gatehouse" : "olympiad",
      };
      console.log("[DEBUG] Sending to API:", payload);
      const res = await fetch("/api/assignment-progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        console.log("[DEBUG] Progress saved successfully, score:", score);
        window.dispatchEvent(new Event(isGatehouse ? "gatehouse-profile-progress-refresh" : "profile-streak-refresh"));
      } else {
        console.error("[DEBUG] Failed to save progress:", json);
      }
    } finally {
      saveBusyRef.current = false;
    }
  }

  async function finish() {
    if (isViewMode) return;

    console.log("[DEBUG] === FINISH ===");
    console.log("[DEBUG] Answers object:", answers);

    // --- Общая проверка заполненности ---
    const v = validateAllAnswered(questions, answers);
    if (!v.ok) {
      alert(`❌ Заполните вопрос №${v.index + 1}`);
      setCurrentIndex(v.index);
      return;
    }

    // --- Дополнительная проверка кроссворда ---
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (q?.type !== "crossword") continue;

      const userGrid: string[][] = answers[i] ?? [];
      const correctGrid: string[][] = Array.isArray((q as any).grid) ? (q as any).grid : [];
      const words: any[] = Array.isArray((q as any).words) ? (q as any).words : [];

      const activeCells = new Set<string>();
      for (const w of words) {
        const len = Number(w?.length ?? 0);
        const dir = w?.direction;
        const start = w?.start;
        if (!start || !dir || !Number.isFinite(len) || len <= 0) continue;
        for (let step = 0; step < len; step++) {
          const r = dir === "across" ? start.row : start.row + step;
          const c = dir === "across" ? start.col + step : start.col;
          activeCells.add(`${r},${c}`);
        }
      }
      
      if (activeCells.size === 0) {
        correctGrid.forEach((row, r) =>
          row.forEach((ch, c) => {
            if (String(ch ?? "").trim()) activeCells.add(`${r},${c}`);
          })
        );
      }

      let hasEmpty = false;
      for (const key of activeCells) {
        const [r, c] = key.split(",").map(Number);
        if (!String(userGrid?.[r]?.[c] ?? "").trim()) {
          hasEmpty = true;
          break;
        }
      }

      if (hasEmpty) {
        alert(`❌ Заполните все ячейки кроссворда в вопросе №${i + 1}`);
        setCurrentIndex(i);
        return;
      }
    }

    const { stats, review } = calcAndBuildReview(questions, answers);
    console.log("[DEBUG] Stats from scoring:", stats);
    console.log("[DEBUG] Review from scoring:", review);

    if (isGatehouse) {
      const recommendation = recommendGatehouseLevel({
        score: stats.score,
        maxScore: 100,
        percent: stats.score,
        materialLevels: getAssignmentMaterialLevels(assignment),
      });
      setGatehouseRecommendation(recommendation);
    }

    setFinalStats(stats);
    setReviewItems(review);
    setCompletedScreen(true);
    await saveProgress(stats.score);
  }

  function renderQuestionComponent(q: QuestionAny, index: number) {
    const val = answers[index];
    const sharedProps = { 
      disabled: isViewMode, 
      onChange: (v: any) => setAnswerForQuestion(index, v) 
    };

    switch (q.type) {
      case "test": return <QuestionTest question={q as any} value={val} {...sharedProps} />;
      case "fill": return <QuestionFill question={q as any} value={val} {...sharedProps} />;
      case "sentence": return <QuestionSentence question={q as any} value={val} {...sharedProps} />;
      case "matching": return <QuestionMatching question={q as any} value={val} {...sharedProps} />;
      case "complex": return <QuestionComplex question={q as any} value={val} {...sharedProps} />;
      case "imagemap": return <QuestionImageMap question={q as any} value={val || {}} {...sharedProps} />;
      case "reading": return <QuestionReading question={q as any} value={val || []} {...sharedProps} />;
      case "crossword":
        return (
          <QuestionCrossword
            question={q as any}
            value={val}
            disabled={isViewMode}
            onOpenImage={openImage}
            onChange={sharedProps.onChange}
          />
        );
      default: return <div className="error-message">Тип "{q.type}" не поддерживается</div>;
    }
  }

  const answeredCount = questions.filter((q, i) => isQuestionAnswered(q, answers[i])).length;

  if (loading) return (
    <div className="loader-container" style={{ background: theme.bg }}>
      <div className="premium-spinner" style={{ borderColor: theme.primary, borderTopColor: "transparent" }} />
      <p style={{ color: theme.primary, fontWeight: 600, marginTop: "20px" }}>Загружаем материалы...</p>
    </div>
  );

  if (err) return (
    <div className="loader-container" style={{ background: theme.bg }}>
      <div className="error-card">{err}</div>
      <button onClick={() => window.location.reload()} className="btn-premium primary" style={{ background: theme.primary, marginTop: "20px" }}>Попробовать снова</button>
    </div>
  );

  return (
    <div className="assignment-page" style={{ 
      background: theme.bg, 
      minHeight: "100vh", 
      color: theme.text,
      fontFamily: "var(--font-geist-sans), 'Inter', sans-serif"
    }}>
      {/* HEADER */}
      <header className="premium-header">
        <div className="header-content">
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="back-button" onClick={() => router.push(back.href)}>
              {back.headerLabel}
            </button>

            {previousProgress?.is_completed && !showChoice && !completedScreen && (
               <button className="mode-switch-button" onClick={switchMode}>
                 ↶ Сменить режим
               </button>
            )}
          </div>

          <div className="assignment-badge" style={{ background: theme.primary }}>
            {theme.badge}
          </div>
        </div>
      </header>

      <main className="premium-main">
        {/* ЭКРАН ВЫБОРА РЕЖИМА */}
        {showChoice && (
          <div className="premium-card animate-in" style={{ background: theme.cardBg }}>
            <h2 className="card-title">Предыдущий результат</h2>
            <p className="card-subtitle">У вас уже есть сохраненный прогресс. Хотите начать с чистого листа или просто посмотреть ошибки?</p>
            <div className="button-group">
              <button className="btn-premium primary" style={{ background: theme.primary }} onClick={startFresh}>Начать заново</button>
              <button className="btn-premium secondary" onClick={viewPrevious}>Посмотреть ответы</button>
            </div>
          </div>
        )}

        {/* ЭКРАН РЕЗУЛЬТАТОВ */}
        {completedScreen && finalStats && (
          <div className="premium-card animate-in" style={{ background: theme.cardBg }}>
            <div className="score-circle" style={{ borderColor: theme.primary }}>
              <span className="score-value" style={{ color: theme.primary }}>{finalStats.score}%</span>
              <span className="score-label">Ваш балл</span>
            </div>

            {gatehouseRecommendation && (
              <div className="recommendation-box">
                <h3>Рекомендация: {gatehouseRecommendation.recommendedLevelLabel}</h3>
                <p>{gatehouseRecommendation.message}</p>
                <div className="badge-wrap">{getGatehouseRecommendationBadge(gatehouseRecommendation.band)}</div>
              </div>
            )}

            <div className="stats-grid">
              <div className="stat-item"><span>Всего вопросов:</span> <b>{finalStats.total}</b></div>
              <div className="stat-item"><span>Набрано баллов:</span> <b>{finalStats.pointsEarned.toFixed(2)} / {finalStats.pointsTotal}</b></div>
              <div className="stat-item"><span>Правильно:</span> <b style={{color: '#10b981'}}>{finalStats.correct}</b></div>
              <div className="stat-item"><span>Ошибки:</span> <b style={{color: '#ef4444'}}>{finalStats.incorrect}</b></div>
            </div>

            <div className="review-section">
              <ReviewPanel items={reviewItems} questions={questions} />
            </div>

            <div className="button-group" style={{ marginTop: "40px" }}>
              <button className="btn-premium primary" style={{ flex: 1, background: theme.primary }} onClick={() => router.push(back.href)}>К списку материалов</button>
              <button className="btn-premium secondary" style={{ flex: 1 }} onClick={() => window.location.reload()}>Пройти еще раз</button>
            </div>
          </div>
        )}

        {/* ПРОЦЕСС ВЫПОЛНЕНИЯ ЗАДАНИЯ */}
        {!showChoice && !completedScreen && assignment && questions.length > 0 && (
          <div className="assignment-layout animate-in">
            {/* ====== ПРОГРЕСС-БАР ====== */}
            {questions.length > 1 && (
              <div className="progress-container">
                <div className="progress-dots">
                  {questions.map((q, i) => {
                    const isCurrent  = i === currentIndex;
                    const answered   = isQuestionAnswered(q, answers[i]);
                    const dotSize    = questions.length > 25 ? 8 : questions.length > 15 ? 10 : 13;
                    return (
                      <button
                        key={i}
                        onClick={() => setCurrentIndex(i)}
                        title={`Вопрос ${i + 1}${answered ? " ✓" : ""}`}
                        style={{
                          width:  dotSize,
                          height: dotSize,
                          minWidth: dotSize,
                          borderRadius: "50%",
                          border: isCurrent
                            ? `2px solid ${theme.primary}`
                            : "2px solid transparent",
                          background: isCurrent
                            ? theme.primary
                            : answered
                            ? `${theme.primary}66`
                            : "rgba(0,0,0,0.1)",
                          cursor: "pointer",
                          padding: 0,
                          transition: "all 0.2s ease",
                          transform: isCurrent ? "scale(1.4)" : "scale(1)",
                          boxShadow: isCurrent
                            ? `0 0 0 3px ${theme.primary}22`
                            : "none",
                          flexShrink: 0,
                        }}
                      />
                    );
                  })}
                </div>
                
                <div className="progress-bar-bg">
                  <div className="progress-fill" style={{ 
                    width: `${((currentIndex + 1) / questions.length) * 100}%`, 
                    background: theme.primary 
                  }} />
                </div>
                <div className="progress-info">
                  <span>Вопрос {currentIndex + 1} из {questions.length}</span>
                  <span style={{ fontSize: "12px", opacity: 0.45 }}>
                    {answeredCount} / {questions.length} заполнено
                  </span>
                  {isViewMode && <span className="view-mode-tag">РЕЖИМ ПРОСМОТРА</span>}
                </div>
              </div>
            )}

            {questions[currentIndex] && (
              <div key={currentIndex} className="premium-card active-question" style={{ background: theme.cardBg }}>
                {/* ======== ЗАГОЛОВОК ВОПРОСА ======== */}
                {questions[currentIndex]!.q && (
                  <h2 className="question-title">
                    {questions.length > 1 ? `${currentIndex + 1}. ` : ""}{questions[currentIndex]!.q}
                  </h2>
                )}

                {/* ======== МАТЕРИАЛЫ К ВОПРОСУ ======== */}
                {((questions[currentIndex]!.media?.length ?? 0) > 0 || (questions[currentIndex]!.image && questions[currentIndex]!.type !== 'crossword' && questions[currentIndex]!.type !== 'imagemap')) && (
                  <div className="materials-block">
                    <div className="materials-label">МАТЕРИАЛЫ К ВОПРОСУ</div>
                    {(questions[currentIndex]!.media?.length ?? 0) > 0 && (
                      <MediaRenderer media={questions[currentIndex]!.media} />
                    )}
                    {!(questions[currentIndex]!.media?.length ?? 0) && questions[currentIndex]!.image && questions[currentIndex]!.type !== 'crossword' && questions[currentIndex]!.type !== 'imagemap' && (
                      <div className="optimized-image-wrapper" onClick={() => openImage(getImageUrl(questions[currentIndex]!.image!))}>
                        <Image
                          src={getImageUrl(questions[currentIndex]!.image!)}
                          alt="task-media"
                          width={800}
                          height={600}
                          priority={true}
                          unoptimized={true}
                          style={{
                            width: "100%",
                            height: "auto",
                            borderRadius: "20px",
                            cursor: "zoom-in",
                            objectFit: "contain",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.05)"
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* ======== СОДЕРЖИМОЕ ВОПРОСА ======== */}
                <div className="answer-block">
                  {((questions[currentIndex]!.media?.length ?? 0) > 0 || (questions[currentIndex]!.image && questions[currentIndex]!.type !== 'crossword' && questions[currentIndex]!.type !== 'imagemap') || questions[currentIndex]!.q) ? (
                    <div className="answer-label">СОДЕРЖИМОЕ ЗАДАНИЯ</div>
                  ) : null}
                  <div className="question-content">
                    {renderQuestionComponent(questions[currentIndex]!, currentIndex)}
                  </div>
                </div>

                <div className="navigation-footer">
                  <button 
                    className="nav-btn" 
                    disabled={currentIndex === 0} 
                    onClick={() => setCurrentIndex(i => i - 1)}
                    style={{ opacity: currentIndex === 0 ? 0.3 : 1 }}
                  >
                    Назад
                  </button>
                  
                  {currentIndex < questions.length - 1 ? (
                    <button className="btn-premium primary" style={{ flex: 1, background: theme.primary }} onClick={() => setCurrentIndex(i => i + 1)}>
                      Далее
                    </button>
                  ) : (
                    !isViewMode && (
                      <button className="btn-premium finish" style={{ flex: 1 }} onClick={finish}>
                        Завершить и проверить
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ЖЕЛЕЗОБЕТОННЫЙ ПОРТАЛ ЗУМА ИЗОБРАЖЕНИЙ */}
      <IroncladModalPortal open={imageModalOpen}>
        <ImageModal
          open={imageModalOpen}
          src={modalSrc}
          onClose={closeImage}
        />
      </IroncladModalPortal>

      {/* CSS STYLES */}
      <style jsx>{`
        .premium-header { padding: 30px 20px; }
        .header-content { max-width: 900px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
        
        .back-button, .mode-switch-button { 
          background: rgba(255,255,255,0.7); border: none; padding: 12px 24px; border-radius: 16px; 
          cursor: pointer; font-weight: 700; color: inherit; backdrop-filter: blur(10px); 
          box-shadow: 0 4px 15px rgba(0,0,0,0.05); transition: all 0.2s;
        }
        .mode-switch-button { background: rgba(0,0,0,0.05); color: #6366f1; }
        .back-button:hover, .mode-switch-button:hover { transform: translateY(-2px); background: #fff; }

        .assignment-badge { color: #fff; padding: 8px 16px; border-radius: 12px; font-size: 11px; font-weight: 900; letter-spacing: 1.5px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
        
        .premium-main { max-width: 850px; margin: 0 auto; padding: 0 20px 60px; }
        .premium-card { border-radius: 40px; padding: 40px; box-shadow: 0 30px 60px rgba(0,0,0,0.08); border: 1px solid rgba(255,255,255,0.8); }
        .card-title { font-size: 32px; font-weight: 800; margin-bottom: 16px; text-align: center; }
        .card-subtitle { text-align: center; opacity: 0.6; margin-bottom: 40px; line-height: 1.5; }
        
        /* === ПРОГРЕСС === */
        .progress-container { margin-bottom: 30px; }
        .progress-dots {
          display: flex;
          gap: 5px;
          margin-bottom: 10px;
          flex-wrap: nowrap;
          overflow-x: auto;
          padding: 10px 4px;
          margin-top: -10px;
          scrollbar-width: none;
        }
        .progress-dots::-webkit-scrollbar { display: none; }
        .progress-bar-bg { height: 6px; background: rgba(0,0,0,0.05); border-radius: 20px; overflow: hidden; margin-bottom: 10px; }
        .progress-fill { height: 100%; border-radius: 20px; transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .progress-info { display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 800; opacity: 0.5; gap: 8px; }
        .view-mode-tag { color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 2px 8px; border-radius: 6px; }

        .question-title { font-size: 24px; font-weight: 800; line-height: 1.4; margin-bottom: 30px; color: #111827; }
        .media-section { margin-bottom: 35px; border-radius: 24px; overflow: hidden; }
        .optimized-image-wrapper { width: 100%; position: relative; }

        .materials-block {
          background: #f8fafc;
          border: 1px solid rgba(0,0,0,0.04);
          border-radius: 20px;
          padding: 20px;
          margin-bottom: 28px;
        }
        .materials-label, .answer-label {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.2px;
          color: #94a3b8;
          margin-bottom: 16px;
          text-transform: uppercase;
        }
        .answer-block {
          background: #ffffff;
          border: 1px solid rgba(0,0,0,0.04);
          border-radius: 24px;
          padding: 24px;
          box-shadow: 0 6px 24px rgba(0,0,0,0.03);
        }
        .answer-block .answer-label {
          margin-bottom: 12px;
        }
        .question-content {
          padding: 0;
        }

        .navigation-footer { display: flex; gap: 20px; margin-top: 50px; padding-top: 35px; border-top: 2px solid rgba(0,0,0,0.03); }
        .nav-btn { background: rgba(0,0,0,0.03); border: none; font-weight: 800; cursor: pointer; padding: 16px 25px; border-radius: 18px; color: inherit; transition: all 0.2s; }
        .nav-btn:hover:not(:disabled) { background: rgba(0,0,0,0.06); }
        
        .btn-premium { padding: 18px 35px; border-radius: 20px; border: none; font-weight: 800; font-size: 17px; cursor: pointer; transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .btn-premium.primary { color: #fff; box-shadow: 0 10px 25px rgba(0,0,0,0.15); }
        .btn-premium.secondary { background: rgba(0,0,0,0.05); color: inherit; }
        .btn-premium.finish { background: #10b981; color: #fff; box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3); }
        .btn-premium:hover { transform: translateY(-3px); filter: brightness(1.05); }

        .button-group { display: flex; gap: 15px; justify-content: center; }

        .score-circle { width: 180px; height: 180px; border: 10px solid; border-radius: 50%; margin: 0 auto 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; animation: scaleIn 0.5s ease-out; }
        .score-value { font-size: 56px; font-weight: 900; }
        .score-label { font-size: 14px; font-weight: 800; opacity: 0.4; text-transform: uppercase; margin-top: -5px; }

        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }
        .stat-item { background: rgba(0,0,0,0.02); padding: 20px; border-radius: 24px; display: flex; flex-direction: column; gap: 6px; border: 1px solid rgba(0,0,0,0.02); }
        .stat-item span { font-size: 13px; opacity: 0.5; font-weight: 600; }

        .recommendation-box { background: rgba(99, 102, 241, 0.05); padding: 30px; border-radius: 30px; border: 2px solid rgba(99, 102, 241, 0.1); margin-bottom: 40px; text-align: center; }
        
        .loader-container { height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .premium-spinner { width: 60px; height: 60px; border: 6px solid; border-radius: 50%; animation: spin 1s linear infinite; }
        
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-in { animation: fadeIn 0.7s cubic-bezier(0.23, 1, 0.32, 1) forwards; }

        @media (max-width: 768px) {
          .premium-header { padding: 18px 12px; }
          .header-content { flex-direction: column; align-items: flex-start; gap: 12px; }
          .assignment-badge { align-self: flex-end; }

          .premium-main { max-width: 100%; padding: 0 10px 40px; }
          .premium-card { border-radius: 28px; padding: 24px 16px; }
          .card-title { font-size: 26px; }
          .card-subtitle { font-size: 14px; margin-bottom: 24px; }

          .progress-container { margin-bottom: 20px; }
          .progress-dots { gap: 4px; }
          .progress-bar-bg { height: 5px; }
          .progress-info { font-size: 12px; }

          .question-title { font-size: 20px; margin-bottom: 20px; }

          .materials-block {
            border-radius: 16px;
            padding: 14px;
            margin-bottom: 18px;
          }
          .materials-label, .answer-label {
            font-size: 11px;
            margin-bottom: 10px;
          }
          .answer-block {
            border-radius: 20px;
            padding: 16px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.02);
          }

          .navigation-footer {
            flex-direction: column;
            gap: 12px;
            margin-top: 30px;
            padding-top: 25px;
          }
          .nav-btn {
            width: 100%;
            text-align: center;
            padding: 14px 20px;
            font-size: 16px;
            border-radius: 14px;
          }
          .btn-premium {
            padding: 16px 24px;
            font-size: 16px;
            width: 100%;
            text-align: center;
            border-radius: 16px;
          }
          .btn-premium.primary,
          .btn-premium.secondary,
          .btn-premium.finish {
            width: 100%;
            flex: none;
          }

          .score-circle { width: 140px; height: 140px; margin-bottom: 24px; }
          .score-value { font-size: 44px; }

          .stats-grid { grid-template-columns: 1fr; gap: 12px; }
          .stat-item { padding: 16px; border-radius: 18px; }

          .button-group { flex-direction: column; gap: 12px; }
          .button-group .btn-premium { width: 100%; }

          .recommendation-box { padding: 20px; border-radius: 24px; }
        }

        @media (max-width: 480px) {
          .premium-card { padding: 18px 12px; }
          .question-title { font-size: 18px; }
          .btn-premium { padding: 14px 18px; font-size: 15px; }
          .nav-btn { padding: 12px 16px; font-size: 15px; }
        }
      `}</style>
    </div>
  );
}