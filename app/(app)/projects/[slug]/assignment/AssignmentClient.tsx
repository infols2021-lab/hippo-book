"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
import BlockRenderer from "./components/BlockRenderer";

import { getImageUrl } from "@/lib/assignments/image";
import {
  ensureMediaPreconnect,
  getQuestionMediaUrls,
  warmAssignmentMediaCache,
} from "@/lib/assignments/mediaPreload";
import type { FinalStats, ReviewItem, QuestionAny, AssignmentData, MaterialData } from "@/lib/assignments/types";
import type { InfoBlock } from "@/app/(admin)/admin/assignments/builder/types";
import { validateAllAnswered, calcAndBuildReview, isQuestionAnswered } from "@/lib/assignments/scoring";

import {
  recommendGatehouseLevel,
  getGatehouseRecommendationBadge,
  type GatehouseRecommendation,
} from "@/lib/exams/recommendLevel";

import "./assignment.css";

type ApiOk = {
  ok: true;
  assignment: AssignmentData & { assignment_type?: string }; 
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
  projectSlug: string;
  guestMode?: boolean;
};

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

function getAssignmentMaterial(assignment: AssignmentData | null): MaterialData | null {
  if (!assignment) return null;

  const materials = assignment.materials || assignment.material;
  const material = Array.isArray(materials) ? materials[0] : materials;
  return material ?? null;
}

function getAssignmentMaterialLevels(assignment: AssignmentData | null): string[] {
  if (!assignment) return [];
  const direct = normalizeStringArray(assignment.target_levels);
  if (direct.length) return direct;

  return normalizeStringArray(getAssignmentMaterial(assignment)?.target_levels);
}

function getFeedbackMessage(score: number, ranges?: any[]): string {
  if (Array.isArray(ranges) && ranges.length > 0) {
    const match = ranges.find(
      (r) => score >= (r.minPercent ?? 0) && score <= (r.maxPercent ?? 100) && r.text?.trim()
    );
    if (match) return match.text.trim();
  }

  if (score >= 90) return "Отличный результат! Вы прекрасно справились с заданием!";
  if (score >= 70) return "Хороший результат! Вы хорошо усвоили материал.";
  if (score >= 50) return "Неплохой результат! Есть над чем поработать.";
  return "Попробуйте пройти задание ещё раз для лучшего результата.";
}

// Отмечает демо-задание как пройденное в localStorage — читается на странице
// списка демо-материала (app/demo/DemoMaterialClient.tsx) для прогресс-бара.
function markDemoCompleted(assignmentId: string) {
  try {
    const raw = localStorage.getItem("demo_completed");
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[assignmentId] = true;
    localStorage.setItem("demo_completed", JSON.stringify(parsed));
  } catch (e) {}
}

export default function AssignmentClient({ assignmentId, source, sourceId, projectSlug, guestMode = false }: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  
  const [assignmentMode, setAssignmentMode] = useState<"interactive" | "informational">("interactive");
  const [questions, setQuestions] = useState<QuestionAny[]>([]);
  const [blocks, setBlocks] = useState<InfoBlock[]>([]);

  const [previousProgress, setPreviousProgress] = useState<ApiOk["progress"]>(null);
  const [showChoice, setShowChoice] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedScreen, setCompletedScreen] = useState(false);
  const [finalStats, setFinalStats] = useState<FinalStats | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [gatehouseRecommendation, setGatehouseRecommendation] = useState<GatehouseRecommendation | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [modalSrc, setModalSrc] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [showCtaModal, setShowCtaModal] = useState(false);
  const saveBusyRef = useRef(false);

  useEffect(() => {
    ensureMediaPreconnect();
  }, []);

  useEffect(() => {
    if (loading || err) return;

    if (assignmentMode === "interactive" && questions.length > 0) {
      const current = questions[currentIndex];
      const next = questions[currentIndex + 1];
      warmAssignmentMediaCache(
        { questions },
        { priorityUrls: [...getQuestionMediaUrls(current), ...getQuestionMediaUrls(next)] }
      );
      return;
    }

    if (assignmentMode === "informational" && blocks.length > 0) {
      warmAssignmentMediaCache({ blocks });
    }
  }, [assignmentMode, blocks, currentIndex, err, loading, questions]);

  useEffect(() => {
    if (assignmentMode !== "interactive") return;
    const upcoming = questions.slice(currentIndex + 1, currentIndex + 3);
    if (!upcoming.length) return;
    warmAssignmentMediaCache({ questions: upcoming });
  }, [assignmentMode, currentIndex, questions]);

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
        badge: "PROFICIENCY TEST",
      };
    }
    return {
      primary: "#0ea5e9",
      accent: "#f59e0b",
      bg: "linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)",
      cardBg: "#ffffff",
      text: "#0c4a6e",
      buttonText: "#ffffff",
      badge: "OLYMPIAD",
    };
  }, [isGatehouse]);

  const back = useMemo(() => {
    if (guestMode) {
      return { href: "/login", headerLabel: "На страницу входа", actionLabel: "На страницу входа" };
    }

    let s = String(source ?? "").trim().toLowerCase();
    let id = String(sourceId ?? "").trim();
    const basePath = `/projects/${projectSlug}/materials`;

    if (!id && assignment) {
      const mat = getAssignmentMaterial(assignment);
      id = String(assignment.material_id || mat?.id || "").trim();
      if (!s && mat?.material_kind) {
        s = mat.material_kind === "crossword" ? "crossword" : "textbook";
      }
    }

    if (s === "textbook" && id) {
      return { href: `${basePath}/${encodeURIComponent(id)}`, headerLabel: "Назад к материалу", actionLabel: "Вернуться к материалу" };
    }
    if (s === "crossword" && id) {
      return { href: `${basePath}/${encodeURIComponent(id)}`, headerLabel: "Назад к кроссворду", actionLabel: "Вернуться к кроссворду" };
    }
    return { href: basePath, headerLabel: "К материалам", actionLabel: "К материалам" };
  }, [source, sourceId, projectSlug, guestMode, assignment]);

  async function load() {
    try {
      setLoading(true);
      setErr(null);

      const res = await fetch(`/api/assignment-data/${encodeURIComponent(assignmentId)}`, { cache: "no-store" });
      const json = (await res.json()) as Api;

      if (!res.ok || !("ok" in json) || json.ok !== true) {
        throw new Error((json as ApiErr).error || "Не удалось загрузить задание");
      }

      const data = json.assignment as any;
      setAssignment(data);

      const isIntro = data?.assignment_type === "intro" || data?.content?.mode === "informational";

      if (isIntro) {
        setAssignmentMode("informational");
        const nextBlocks = data?.content?.blocks || [];
        setBlocks(nextBlocks);
        warmAssignmentMediaCache({ blocks: nextBlocks });
      } else {
        setAssignmentMode("interactive");
        const nextQuestions = normalizeQuestions(data?.content?.questions);
        setQuestions(nextQuestions);
        warmAssignmentMediaCache({ questions: nextQuestions });
      }

      if (guestMode) {
        try {
          const savedAnswers = localStorage.getItem("demo_answers");
          if (savedAnswers) setAnswers(JSON.parse(savedAnswers));
        } catch (e) {}
        setPreviousProgress(null);
        setShowChoice(false);
      } else {
        setPreviousProgress(json.progress);

        if (json.progress?.is_completed) {
          setAnswers(json.progress.answers ?? {});
          setShowChoice(true);
        } else {
          setAnswers({});
          setShowChoice(false);
        }
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

  useEffect(() => {
    load();
  }, [assignmentId]);

  function openImage(src: string) {
    setModalSrc(src);
    setImageModalOpen(true);
  }

  function closeImage() {
    setImageModalOpen(false);
    setModalSrc("");
  }

  function setAnswerForQuestion(qIndex: number, value: any) {
    const qId = questions[qIndex]?.id || qIndex;
    setAnswers((prev: any) => {
      const next = { ...prev, [qId]: value };
      if (guestMode) {
        try {
          localStorage.setItem("demo_answers", JSON.stringify(next));
        } catch (e) {}
      }
      return next;
    });
  }

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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function viewPrevious() {
    setIsViewMode(true);
    setShowChoice(false);
    setCurrentIndex(0);
    setCompletedScreen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function switchMode() {
    if (!previousProgress?.is_completed) return;
    setShowChoice(true);
    setCompletedScreen(false);
    setFinalStats(null);
    setReviewItems([]);
    setGatehouseRecommendation(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finishInformational() {
    if (guestMode) {
      markDemoCompleted(assignmentId);
      setCompletedScreen(true);
      setShowCtaModal(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (saveBusyRef.current) return;
    saveBusyRef.current = true;
    setIsSaving(true);

    try {
      const payload = {
        assignmentId,
        answers: {},
        isCompleted: true,
        score: null,
        source,
        sourceId,
        branchType: isGatehouse ? "gatehouse" : "olympiad",
      };

      const res = await fetch("/api/assignment-progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setCompletedScreen(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
        window.dispatchEvent(new Event(isGatehouse ? "gatehouse-profile-progress-refresh" : "profile-streak-refresh"));
      } else {
        alert("Ошибка при сохранении результатов");
      }
    } catch (e) {
      alert("Сетевая ошибка при сохранении прогресса");
    } finally {
      saveBusyRef.current = false;
      setIsSaving(false);
    }
  }

  async function saveProgressAndShowResults(clientStats: FinalStats, review: ReviewItem[]) {
    if (guestMode) {
      markDemoCompleted(assignmentId);
      setFinalStats(clientStats);
      setReviewItems(review);
      setCompletedScreen(true);
      setShowCtaModal(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (saveBusyRef.current) return;
    saveBusyRef.current = true;
    setIsSaving(true);

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
        const serverScore = json.score !== undefined ? json.score : clientStats.score;
        const finalStatsToDisplay = { ...clientStats, score: serverScore };

        if (isGatehouse && json.recommendation) {
          setGatehouseRecommendation(json.recommendation);
        } else if (isGatehouse) {
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
        window.scrollTo({ top: 0, behavior: "smooth" });
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

    const v = validateAllAnswered(questions, answers);
    if (!v.ok) {
      alert(`Заполните вопрос №${v.index + 1}`);
      setCurrentIndex(v.index);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const { stats, review } = calcAndBuildReview(questions, answers);
    await saveProgressAndShowResults(stats, review);
  }

  function renderQuestionComponent(q: QuestionAny, index: number) {
    const val = getAnswerForQuestion(index);
    const sharedProps = {
      disabled: isViewMode,
      onChange: (v: any) => setAnswerForQuestion(index, v),
    };

    switch (q.type) {
      case "test":
        return <QuestionTest question={q as any} value={val} {...sharedProps} />;
      case "fill":
        return <QuestionFill question={q as any} value={val} {...sharedProps} />;
      case "sentence":
        return <QuestionSentence question={q as any} value={val} {...sharedProps} />;
      case "matching":
        return <QuestionMatching question={q as any} value={val} {...sharedProps} />;
      case "complex":
        return <QuestionComplex question={q as any} value={val} {...sharedProps} />;
      case "imagemap":
        return <QuestionImageMap question={q as any} value={val || {}} {...sharedProps} />;
      case "reading":
        return <QuestionReading question={q as any} value={val || []} {...sharedProps} />;
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
      default:
        return <div className="error-message">Тип "{(q as any).type}" не поддерживается</div>;
    }
  }

  const answeredCount = questions.filter((q, i) => isQuestionAnswered(q, getAnswerForQuestion(i))).length;

  if (loading)
    return (
      <div className="loader-container" style={{ background: theme.bg }}>
        <div className="premium-spinner" style={{ borderColor: theme.primary, borderTopColor: "transparent" }} />
        <p style={{ color: theme.primary, fontWeight: 600, marginTop: "20px" }}>Загружаем материалы...</p>
      </div>
    );

  if (err)
    return (
      <div className="loader-container" style={{ background: theme.bg }}>
        <div className="error-card">{err}</div>
        <button onClick={load} className="btn-premium primary" style={{ background: theme.primary, marginTop: "20px" }}>
          Попробовать снова
        </button>
      </div>
    );

  return (
    <div
      className="assignment-page"
      style={{
        background: theme.bg,
        minHeight: "100vh",
        color: theme.text,
      }}
    >
      <header className="premium-header">
        <div className="header-content">
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="back-button" onClick={() => router.push(back.href)}>
              {back.headerLabel}
            </button>

            {previousProgress?.is_completed && !showChoice && !completedScreen && (
              <button className="mode-switch-button" onClick={switchMode}>
                Сменить режим
              </button>
            )}
          </div>

          <div className="assignment-badge" style={{ background: theme.primary }}>
            {guestMode ? "DEMO MODE" : assignmentMode === "informational" ? "GUIDE" : theme.badge}
          </div>
        </div>
      </header>

      <main className="premium-main">
        {showChoice && (
          <div className="premium-card animate-in" style={{ background: theme.cardBg }}>
            <h2 className="card-title">
              {assignmentMode === "informational" ? "Материал уже изучен" : "Предыдущий результат"}
            </h2>
            <p className="card-subtitle">
              {assignmentMode === "informational" 
                ? "Вы уже ознакомились с этим гайдом. Хотите просмотреть его снова?" 
                : "У вас уже есть сохраненный прогресс. Хотите начать с чистого листа или просто посмотреть ошибки?"}
            </p>
            <div className="button-group">
              <button className="btn-premium primary" style={{ background: theme.primary }} onClick={startFresh}>
                {assignmentMode === "informational" ? "Изучить заново" : "Начать заново"}
              </button>
              <button className="btn-premium secondary" onClick={viewPrevious}>
                {assignmentMode === "informational" ? "Перейти к материалу" : "Посмотреть ответы"}
              </button>
            </div>
          </div>
        )}

        {completedScreen && assignmentMode === "interactive" && finalStats && (
          <div className="premium-card animate-in" style={{ background: theme.cardBg }}>
            <div className="score-circle" style={{ borderColor: theme.primary }}>
              <span className="score-value" style={{ color: theme.primary }}>
                {finalStats.score}%
              </span>
              <span className="score-label">Ваш балл</span>
            </div>

            <p 
              className="card-subtitle" 
              style={{ 
                fontSize: "16px", 
                fontWeight: 600, 
                marginTop: "16px", 
                marginBottom: "20px", 
                textAlign: "center",
                color: theme.text 
              }}
            >
              {getFeedbackMessage(finalStats.score, assignment?.content?.feedbackRanges)}
            </p>

            {gatehouseRecommendation && (
              <div className="recommendation-box">
                <h3>Рекомендация: {gatehouseRecommendation.recommendedLevelLabel}</h3>
                <p>{gatehouseRecommendation.message}</p>
                <div className="badge-wrap">{getGatehouseRecommendationBadge(gatehouseRecommendation.band)}</div>
              </div>
            )}

            <div className="stats-grid">
              <div className="stat-item">
                <span>Всего вопросов:</span> <b>{finalStats.total}</b>
              </div>
              <div className="stat-item">
                <span>Набрано баллов:</span>{" "}
                <b>
                  {finalStats.pointsEarned.toFixed(2)} / {finalStats.pointsTotal}
                </b>
              </div>
              <div className="stat-item">
                <span>Правильно:</span> <b style={{ color: "#10b981" }}>{finalStats.correct}</b>
              </div>
              <div className="stat-item">
                <span>Ошибки:</span> <b style={{ color: "#ef4444" }}>{finalStats.incorrect}</b>
              </div>
            </div>

            <div className="review-section">
              <ReviewPanel items={reviewItems} />
            </div>

            <div className="button-group" style={{ marginTop: "40px" }}>
              <button
                className="btn-premium primary"
                style={{ flex: 1, background: theme.primary }}
                onClick={() => router.push(back.href)}
              >
                {back.actionLabel}
              </button>
              <button className="btn-premium secondary" style={{ flex: 1 }} onClick={() => {
                window.scrollTo({ top: 0, behavior: "smooth" });
                window.location.reload();
              }}>
                Пройти еще раз
              </button>
            </div>
          </div>
        )}

        {completedScreen && assignmentMode === "informational" && (
          <div className="premium-card animate-in" style={{ background: theme.cardBg, textAlign: "center", padding: "60px 20px" }}>
            <h2 className="card-title" style={{ fontSize: "28px" }}>Материал успешно изучен</h2>
            <p className="card-subtitle" style={{ fontSize: "16px", marginTop: "12px" }}>
              Вы ознакомились со всеми файлами и правилами из этого раздела. 
            </p>
            <div style={{ marginTop: "40px", display: "flex", justifyContent: "center" }}>
              <button
                className="btn-premium primary"
                style={{ background: theme.primary, minWidth: "250px" }}
                onClick={() => router.push(back.href)}
              >
                Вернуться к списку
              </button>
            </div>
          </div>
        )}

        {!showChoice && !completedScreen && assignment && (
          <div className="assignment-layout animate-in">
            {assignmentMode === "informational" ? (
              <BlockRenderer 
                blocks={blocks} 
                onComplete={finishInformational} 
                disabled={isViewMode} 
                isSaving={isSaving} 
              />
            ) : (
              questions.length > 0 && (
                <>
                  {questions.length > 1 && (
                    <div className="progress-container">
                      <div className="progress-dots">
                        {questions.map((q, i) => {
                          const isCurrent = i === currentIndex;
                          const answered = isQuestionAnswered(q, getAnswerForQuestion(i));
                          const dotSize = questions.length > 25 ? 8 : questions.length > 15 ? 10 : 13;
                          return (
                            <button
                              key={i}
                              onClick={() => {
                                setCurrentIndex(i);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              title={`Вопрос ${i + 1}${answered ? " (заполнено)" : ""}`}
                              style={{
                                width: dotSize,
                                height: dotSize,
                                minWidth: dotSize,
                                borderRadius: "50%",
                                border: isCurrent ? `2px solid ${theme.primary}` : "2px solid transparent",
                                background: isCurrent
                                  ? theme.primary
                                  : answered
                                  ? `${theme.primary}66`
                                  : "rgba(0,0,0,0.1)",
                                cursor: "pointer",
                                padding: 0,
                                transition: "all 0.2s ease",
                                transform: isCurrent ? "scale(1.4)" : "scale(1)",
                                boxShadow: isCurrent ? `0 0 0 3px ${theme.primary}22` : "none",
                                flexShrink: 0,
                              }}
                            />
                          );
                        })}
                      </div>

                      <div className="progress-bar-bg">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${((currentIndex + 1) / questions.length) * 100}%`,
                            background: theme.primary,
                          }}
                        />
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
                      {questions[currentIndex]!.q && (
                        <h2 className="question-title">
                          {questions.length > 1 ? `${currentIndex + 1}. ` : ""}
                          {questions[currentIndex]!.q}
                        </h2>
                      )}

                      {questions[currentIndex]!.type !== "complex" && questions[currentIndex]!.type !== "reading" && (
                        ((questions[currentIndex]!.media?.length ?? 0) > 0 ||
                          (questions[currentIndex]!.image &&
                            questions[currentIndex]!.type !== "crossword" &&
                            questions[currentIndex]!.type !== "imagemap")) && (
                          <div className="materials-block">
                            <div className="materials-label">МАТЕРИАЛЫ К ВОПРОСУ</div>
                            {(questions[currentIndex]!.media?.length ?? 0) > 0 && (
                              <MediaRenderer media={questions[currentIndex]!.media} priority />
                            )}
                            {!(questions[currentIndex]!.media?.length ?? 0) &&
                              questions[currentIndex]!.image &&
                              questions[currentIndex]!.type !== "crossword" &&
                              questions[currentIndex]!.type !== "imagemap" && (
                                <div
                                  className="optimized-image-wrapper"
                                  onClick={() => openImage(getImageUrl(questions[currentIndex]!.image!))}
                                >
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
                                      boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
                                    }}
                                  />
                                </div>
                              )}
                          </div>
                        )
                      )}

                      <div className="answer-block">
                        {((questions[currentIndex]!.media?.length ?? 0) > 0 ||
                          (questions[currentIndex]!.image &&
                            questions[currentIndex]!.type !== "crossword" &&
                            questions[currentIndex]!.type !== "imagemap") ||
                          questions[currentIndex]!.q) ? (
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
                          onClick={() => {
                            setCurrentIndex((i) => i - 1);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          style={{ opacity: currentIndex === 0 ? 0.3 : 1 }}
                        >
                          Назад
                        </button>

                        {currentIndex < questions.length - 1 ? (
                          <button
                            className="btn-premium primary"
                            style={{ flex: 1, background: theme.primary }}
                            disabled={isSaving}
                            onClick={() => {
                              setCurrentIndex((i) => i + 1);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            Далее
                          </button>
                        ) : (
                          !isViewMode && (
                            <button
                              className="btn-premium finish"
                              style={{ flex: 1, opacity: isSaving ? 0.7 : 1 }}
                              disabled={isSaving}
                              onClick={finish}
                            >
                              {isSaving ? "Сохраняем..." : "Завершить и проверить"}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </>
              )
            )}
          </div>
        )}
      </main>

      {guestMode && showCtaModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl space-y-6">
            <h2 className="text-2xl font-black text-gray-900">Демо-задание пройдено</h2>
            <p className="text-gray-600 text-sm leading-relaxed">
              Зарегистрируйтесь, чтобы получить полный доступ ко всем курсам, сохранять историю и отслеживать свой прогресс.
            </p>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={() => router.push("/register")}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-3.5 rounded-xl transition-all shadow-lg"
              >
                Зарегистрироваться
              </button>
              <button
                onClick={() => router.push("/login")}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3.5 rounded-xl transition-all"
              >
                Войти в аккаунт
              </button>
              <button
                onClick={() => setShowCtaModal(false)}
                className="text-xs font-bold text-gray-500 hover:text-gray-700 mt-2"
              >
                Посмотреть результаты
              </button>
            </div>
          </div>
        </div>
      )}

      <ImageModal open={imageModalOpen} src={modalSrc} onClose={closeImage} />
    </div>
  );
}