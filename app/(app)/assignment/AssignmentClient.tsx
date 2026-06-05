"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
// БАГ #15: Типизация assignment
import type { FinalStats, ReviewItem, QuestionAny, AssignmentData } from "./lib/types";
// БАГ #4, #9: Единая логика из scoring.ts
import { validateAllAnswered, calcAndBuildReview, isQuestionAnswered } from "./lib/scoring";

import {
  recommendGatehouseLevel,
  getGatehouseRecommendationBadge,
  type GatehouseRecommendation,
} from "@/lib/exams/recommendLevel";

// Подключаем вынесенные стили (Баг #14)
import "./assignment.css";

// ===================== TYPES =====================
type ApiOk = {
  ok: true;
  assignment: AssignmentData;
  progress: null | {
    is_completed: boolean;
    score: number | null;
    completed_at: string | null;
    answers: Record<string, any>;
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

// Баг #10: Единая логика уровней (совпадает с сервером)
function getAssignmentMaterialLevels(assignment: AssignmentData | null): string[] {
  if (!assignment) return [];
  const direct = normalizeStringArray(assignment.target_levels);
  if (direct.length) return direct;

  const materials = assignment.materials || assignment.material;
  const material = Array.isArray(materials) ? materials[0] : materials;
  return normalizeStringArray(material?.target_levels);
}

// ===================== COMPONENT =====================
export default function AssignmentClient({ assignmentId, source, sourceId }: Props) {
  const router = useRouter();

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // БАГ #15: Строгая типизация вместо any
  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [questions, setQuestions] = useState<QuestionAny[]>([]);

  const [previousProgress, setPreviousProgress] = useState<ApiOk["progress"]>(null);

  const [showChoice, setShowChoice] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);

  // БАГ #3: Ответы хранятся по ID, но state поддерживает Record
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const [completedScreen, setCompletedScreen] = useState(false);
  const [finalStats, setFinalStats] = useState<FinalStats | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [gatehouseRecommendation, setGatehouseRecommendation] = useState<GatehouseRecommendation | null>(null);

  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [modalSrc, setModalSrc] = useState<string>("");

  // БАГ #6: Визуальный state для сохранения
  const [isSaving, setIsSaving] = useState(false);
  const saveBusyRef = useRef(false);

  // --- PRELOAD следующего вопроса (БАГ #13: Поддержка аудио и PDF) ---
  useEffect(() => {
    const nextIndex = currentIndex + 1;
    if (!questions[nextIndex]) return;
    
    const nextQ = questions[nextIndex];
    const urls: { type: string; url: string }[] = [];
    
    if (Array.isArray(nextQ.media)) {
      for (const m of nextQ.media) {
        if (m?.url) urls.push({ type: m.type || "unknown", url: getImageUrl(m.url) });
      }
    }
    
    if ((nextQ as any).image) {
      urls.push({ type: "image", url: getImageUrl((nextQ as any).image) });
    }
    
    if (nextQ.type === "test" && Array.isArray((nextQ as any).options)) {
      for (const opt of (nextQ as any).options) {
        if (Array.isArray(opt?.media)) {
          for (const m of opt.media) {
            if (m?.url) urls.push({ type: m.type || "unknown", url: m.url });
          }
        }
      }
    }
    
    const preloads = urls.map(({ type, url }) => {
      // Изображения
      if (type.startsWith("image") || url.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)) {
        const img = new window.Image();
        img.src = url;
        return { cleanup: () => { img.src = ""; } };
      }
      // Аудио
      if (type.startsWith("audio") || url.match(/\.(mp3|wav|ogg)$/i)) {
        const audio = new window.Audio();
        audio.preload = "auto";
        audio.src = url;
        return { cleanup: () => { audio.src = ""; } };
      }
      // PDF (Делаем HEAD запрос чтобы браузер закешировал файл)
      if (type.startsWith("pdf") || url.match(/\.pdf$/i)) {
        const controller = new AbortController();
        fetch(url, { method: 'HEAD', signal: controller.signal }).catch(() => {});
        return { cleanup: () => controller.abort() };
      }
      return { cleanup: () => {} };
    });
    
    return () => {
      preloads.forEach(p => p.cleanup());
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

  // Баг #3: Сохраняем ответы по ID вопроса, а не по индексу
  function setAnswerForQuestion(qIndex: number, value: any) {
    const qId = questions[qIndex]?.id || qIndex;
    setAnswers((prev: any) => ({ ...prev, [qId]: value }));
  }

  // Вспомогательная функция для получения ответа (поддерживает и ID, и индексы для старых прохождений)
  function getAnswerForQuestion(qIndex: number) {
    const qId = questions[qIndex]?.id;
    if (qId && answers[qId] !== undefined) return answers[qId];
    return answers[qIndex];
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

  // БАГ #1: Ждем ответа от сервера перед показом результатов
  async function saveProgressAndShowResults(clientStats: FinalStats, review: ReviewItem[]) {
    if (saveBusyRef.current) return;
    saveBusyRef.current = true;
    setIsSaving(true); // БАГ #6: Блокировка UI

    try {
      const payload = {
        assignmentId,
        answers,
        isCompleted: true,
        score: clientStats.score,
        source,
        sourceId,
        branchType: isGatehouse ? "gatehouse" : "olympiad",
      };
      
      const res = await fetch("/api/assignment-progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (res.ok && json?.ok) {
        // БАГ #1: Сервер прислал СВОЙ посчитанный балл! Используем его!
        const serverScore = json.score !== undefined ? json.score : clientStats.score;
        const finalStatsToDisplay = { ...clientStats, score: serverScore };
        
        if (isGatehouse && json.recommendation) {
          setGatehouseRecommendation(json.recommendation);
        } else if (isGatehouse) {
          // Фолбэк на случай если сервер не прислал рекомендацию
          const recommendation = recommendGatehouseLevel({
            score: serverScore,
            maxScore: 100,
            percent: serverScore,
            materialLevels: getAssignmentMaterialLevels(assignment),
          });
          setGatehouseRecommendation(recommendation);
        }

        setFinalStats(finalStatsToDisplay);
        setReviewItems(review);
        setCompletedScreen(true);
        window.dispatchEvent(new Event(isGatehouse ? "gatehouse-profile-progress-refresh" : "profile-streak-refresh"));
      } else {
        alert(json.error || "Ошибка при сохранении результатов");
      }
    } catch (e) {
      alert("Сетевая ошибка при отправке результатов");
    } finally {
      saveBusyRef.current = false;
      setIsSaving(false);
    }
  }

  async function finish() {
    if (isViewMode || isSaving) return;

    // --- Общая проверка заполненности (БАГ #4: Единая логика из scoring.ts) ---
    const v = validateAllAnswered(questions, answers);
    if (!v.ok) {
      alert(`❌ Заполните вопрос №${v.index + 1}`);
      setCurrentIndex(v.index);
      return;
    }

    // БАГ #9: Из finish удален гигантский 40-строчный дубль логики проверки кроссворда
    // Функция validateAllAnswered уже сделала это внутри!

    // Считаем черновик на клиенте
    const { stats, review } = calcAndBuildReview(questions, answers);
    
    // БАГ #1: Вызываем сохранение и ДОЖИДАЕМСЯ ответа перед тем как показать экран
    await saveProgressAndShowResults(stats, review);
  }

  function renderQuestionComponent(q: QuestionAny, index: number) {
    const val = getAnswerForQuestion(index);
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

  const answeredCount = questions.filter((q, i) => isQuestionAnswered(q, getAnswerForQuestion(i))).length;

  if (loading) return (
    <div className="loader-container" style={{ background: theme.bg }}>
      <div className="premium-spinner" style={{ borderColor: theme.primary, borderTopColor: "transparent" }} />
      <p style={{ color: theme.primary, fontWeight: 600, marginTop: "20px" }}>Загружаем материалы...</p>
    </div>
  );

  if (err) return (
    <div className="loader-container" style={{ background: theme.bg }}>
      <div className="error-card">{err}</div>
      {/* Баг #8: retry вызывает load() без жесткой перезагрузки страницы */}
      <button onClick={load} className="btn-premium primary" style={{ background: theme.primary, marginTop: "20px" }}>Попробовать снова</button>
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
              <ReviewPanel items={reviewItems} />
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
                    const answered   = isQuestionAnswered(q, getAnswerForQuestion(i));
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
                    disabled={currentIndex === 0 || isSaving} 
                    onClick={() => setCurrentIndex(i => i - 1)}
                    style={{ opacity: currentIndex === 0 ? 0.3 : 1 }}
                  >
                    Назад
                  </button>
                  
                  {currentIndex < questions.length - 1 ? (
                    <button className="btn-premium primary" style={{ flex: 1, background: theme.primary }} disabled={isSaving} onClick={() => setCurrentIndex(i => i + 1)}>
                      Далее
                    </button>
                  ) : (
                    !isViewMode && (
                      // БАГ #6: Блокировка кнопки и смена текста при сохранении
                      <button className="btn-premium finish" style={{ flex: 1, opacity: isSaving ? 0.7 : 1 }} disabled={isSaving} onClick={finish}>
                        {isSaving ? "Сохраняем..." : "Завершить и проверить"}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* АБСОЛЮТНО ЧИСТЫЙ ВЫЗОВ МОДАЛКИ (БЕЗ ДВОЙНЫХ ПОРТАЛОВ) */}
      <ImageModal
        open={imageModalOpen}
        src={modalSrc}
        onClose={closeImage}
      />
    </div>
  );
}