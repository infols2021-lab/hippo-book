"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// === КОМПОНЕНТЫ ВОПРОСОВ ===
import QuestionCrossword from "./components/QuestionCrossword";
import QuestionTest from "./components/QuestionTest";
import QuestionFill from "./components/QuestionFill";
import QuestionSentence from "./components/QuestionSentence";
import QuestionMatching from "./components/QuestionMatching";
import QuestionComplex from "./components/QuestionComplex";
import MediaRenderer from "./components/MediaRenderer";
import ReviewPanel from "./components/ReviewPanel";

// === ЛОГИКА И ТИПЫ ===
import { getImageUrl } from "./lib/image";
import { normalizeText } from "./lib/normalize";
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

// ===================== HELPERS (ORIGINAL LOGIC) =====================
function normalizeQuestions(qs: unknown): QuestionAny[] {
  if (!Array.isArray(qs)) return [];
  return qs.map((q) => {
    const base = q && typeof q === "object" ? q : { q: String(q ?? "") };
    if (!base.id) base.id = crypto.randomUUID();
    return base as QuestionAny;
  });
}

function ensureGrid(rows: number, cols: number, prev?: string[][]) {
  const g: string[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => prev?.[r]?.[c] ?? ""),
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
  const [zoom, setZoom] = useState(1);

  const saveBusyRef = useRef(false);

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
    setZoom(1);
    setImageModalOpen(true);
  }

  function closeImage() {
    setImageModalOpen(false);
    setModalSrc("");
    setZoom(1);
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
      const res = await fetch("/api/assignment-progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          answers,
          isCompleted: true,
          score,
          source,
          sourceId,
          branchType: isGatehouse ? "gatehouse" : "olympiad",
        }),
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        window.dispatchEvent(new Event(isGatehouse ? "gatehouse-profile-progress-refresh" : "profile-streak-refresh"));
      }
    } finally {
      saveBusyRef.current = false;
    }
  }

  async function finish() {
    if (isViewMode) return;
    
    const v = validateAllAnswered(questions, answers);
    if (!v.ok) {
      alert(`❌ Заполните вопрос №${v.index + 1}`);
      setCurrentIndex(v.index);
      return;
    }

    const { stats, review } = calcAndBuildReview(questions, answers);

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

            {/* КНОПКА СМЕНЫ РЕЖИМА ПРЯМО ВО ВРЕМЯ ПРОХОЖДЕНИЯ */}
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
        {/* ЭКРАН ВЫБОРА РЕЖИМА (ЕСЛИ УЖЕ ПРОЙДЕНО) */}
        {showChoice && (
          <div className="premium-card animate-in" style={{ background: theme.cardBg }}>
            <h2 className="card-title">📊 Предыдущий результат</h2>
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
                <h3>🎯 Рекомендация: {gatehouseRecommendation.recommendedLevelLabel}</h3>
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
        {!showChoice && !completedScreen && assignment && (
          <div className="assignment-layout animate-in">
            {/* PROGRESS BAR */}
            <div className="progress-container">
              <div className="progress-bar-bg">
                <div className="progress-fill" style={{ 
                  width: `${((currentIndex + 1) / questions.length) * 100}%`, 
                  background: theme.primary 
                }} />
              </div>
              <div className="progress-info">
                <span>Вопрос {currentIndex + 1} из {questions.length}</span>
                {isViewMode && <span className="view-mode-tag">👀 РЕЖИМ ПРОСМОТРА</span>}
              </div>
            </div>

            <div key={currentIndex} className="premium-card active-question" style={{ background: theme.cardBg }}>
              <h2 className="question-title">{currentIndex + 1}. {questions[currentIndex]?.q}</h2>

              <div className="media-section">
                <MediaRenderer media={questions[currentIndex]?.media} />
                {!questions[currentIndex]?.media?.length && questions[currentIndex]?.image && questions[currentIndex]?.type !== 'crossword' && (
                  <img 
                    className="legacy-image" 
                    src={getImageUrl(questions[currentIndex].image!)} 
                    alt="task-media" 
                    onClick={() => openImage(getImageUrl(questions[currentIndex].image!))} 
                  />
                )}
              </div>

              <div className="question-content">
                {renderQuestionComponent(questions[currentIndex], currentIndex)}
              </div>

              <div className="navigation-footer">
                <button 
                  className="nav-btn" 
                  disabled={currentIndex === 0} 
                  onClick={() => setCurrentIndex(i => i - 1)}
                  style={{ opacity: currentIndex === 0 ? 0.3 : 1 }}
                >
                  ← Назад
                </button>
                
                {currentIndex < questions.length - 1 ? (
                  <button className="btn-premium primary" style={{ flex: 1, background: theme.primary }} onClick={() => setCurrentIndex(i => i + 1)}>
                    Далее →
                  </button>
                ) : (
                  !isViewMode && (
                    <button className="btn-premium finish" style={{ flex: 1 }} onClick={finish}>
                      Завершить и проверить ✨
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* МОДАЛКА ЗУМА ИЗОБРАЖЕНИЙ */}
      {imageModalOpen && (
        <div className="modal-overlay" onClick={closeImage}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeImage}>×</button>
            <div className="modal-scroll-wrap">
               <img src={modalSrc} style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s ease' }} alt="Zoomed" />
            </div>
            <div className="modal-controls">
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}>−</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(4, z + 0.2))}>+</button>
              <button onClick={() => setZoom(1)}>⟲</button>
            </div>
          </div>
        </div>
      )}

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
        
        .progress-container { margin-bottom: 30px; }
        .progress-bar-bg { height: 12px; background: rgba(0,0,0,0.05); border-radius: 20px; overflow: hidden; margin-bottom: 12px; }
        .progress-fill { height: 100%; border-radius: 20px; transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .progress-info { display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; opacity: 0.5; }
        .view-mode-tag { color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 2px 8px; border-radius: 6px; }

        .question-title { font-size: 24px; font-weight: 800; line-height: 1.4; margin-bottom: 30px; color: #111827; }
        .media-section { margin-bottom: 35px; border-radius: 24px; overflow: hidden; }
        .legacy-image { width: 100%; border-radius: 20px; cursor: zoom-in; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }

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

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.92); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 30px; backdrop-filter: blur(10px); }
        .modal-content { position: relative; max-width: 95%; max-height: 90%; display: flex; flex-direction: column; align-items: center; }
        .modal-close { position: absolute; top: -60px; right: 0; background: rgba(255,255,255,0.1); border: none; color: #fff; width: 44px; height: 44px; border-radius: 50%; font-size: 30px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .modal-scroll-wrap { overflow: auto; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
        .modal-controls { margin-top: 25px; display: flex; gap: 25px; align-items: center; color: #fff; background: rgba(255,255,255,0.1); padding: 10px 30px; border-radius: 30px; }
        .modal-controls button { width: 44px; height: 44px; border-radius: 50%; border: 2px solid #fff; background: none; color: #fff; font-size: 22px; cursor: pointer; transition: all 0.2s; }
      `}</style>
    </div>
  );
}