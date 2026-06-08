"use client";

import Link from "next/link";
import { useMemo } from "react";
import GatehouseHeader from "@/components/gatehouse/GatehouseHeader";
import type { MaterialDbRow } from "@/lib/materials/types";
import { formatGatehouseLevels, getAssignmentHref } from "@/lib/materials/format";

export type GatehouseAssignmentPreview = {
  id: string;
  title: string;
  order_index: number;
  questionsCount: number;
  isCompleted: boolean;
  score: number | null;
  completedAt: string | null;
  assignment_type?: string | null; // Добавлено для проверки типа задания
  content?: any; // Добавлено на случай, если сервер прокидывает контент
};

export type GatehouseMaterialPageData = {
  material: MaterialDbRow;
  assignments: GatehouseAssignmentPreview[];
  hasAccess: boolean;
  progress: number;
  completedAssignments: number;
  totalAssignments: number;
};

type GatehouseMaterialClientProps = {
  initialData: GatehouseMaterialPageData | null;
  initialError: string | null;
};

function formatScore(score: number | null): string {
  if (typeof score !== "number" || !Number.isFinite(score)) return "—";
  return `${Math.max(0, Math.min(100, Math.round(score)))}%`;
}

// Универсальная проверка готовности задания
function checkIsReady(assignment: GatehouseAssignmentPreview): boolean {
  const isIntro = assignment.assignment_type === "intro" || assignment.content?.mode === "informational";
  const hasQuestions = assignment.questionsCount > 0 || (Array.isArray(assignment.content?.questions) && assignment.content.questions.length > 0);
  const hasBlocks = Array.isArray(assignment.content?.blocks) && assignment.content.blocks.length > 0;

  // Если это ознакомительное задание:
  if (isIntro) {
    // Если сервер передал content, строго проверяем наличие блоков
    if (assignment.content) return hasBlocks;
    // Если content не передан в превью, считаем задание готовым (доверяем флагу intro)
    return true;
  }

  // Для обычных тестов:
  return hasQuestions;
}

function getAssignmentStatusLabel(assignment: GatehouseAssignmentPreview): string {
  const isReady = checkIsReady(assignment);
  
  if (assignment.isCompleted) return "Пройдено";
  if (!isReady) return "Скоро будет доступно";
  
  const isIntro = assignment.assignment_type === "intro" || assignment.content?.mode === "informational";
  if (isIntro) return "Ознакомительный материал";

  const qCount = assignment.questionsCount > 0 ? assignment.questionsCount : (assignment.content?.questions?.length || 0);
  return `${qCount} вопросов`;
}

function getAssignmentIcon(assignment: GatehouseAssignmentPreview): string {
  const isReady = checkIsReady(assignment);
  
  if (assignment.isCompleted) return "✓";
  if (!isReady) return "⏳";
  
  const isIntro = assignment.assignment_type === "intro" || assignment.content?.mode === "informational";
  if (isIntro) return "📖";
  
  return "📝";
}

export default function GatehouseMaterialClient({
  initialData,
  initialError,
}: GatehouseMaterialClientProps) {
  const data = initialData;

  const assignments = useMemo(() => {
    return [...(data?.assignments ?? [])].sort((a, b) => {
      const orderDiff = Number(a.order_index ?? 0) - Number(b.order_index ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return String(a.title ?? "").localeCompare(String(b.title ?? ""), "ru");
    });
  }, [data?.assignments]);

  if (!data) {
    return (
      <main className="gatehouse-page">
        <div className="gatehouse-container">
          <GatehouseHeader />

          <div style={{ marginBottom: "24px" }}>
            <Link
              href="/gatehouse/materials"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                backgroundColor: "#4f46e5",
                color: "white",
                fontSize: "14px",
                fontWeight: 500,
                textDecoration: "none",
                borderRadius: "40px",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 6px rgba(79, 70, 229, 0.3)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 12px rgba(79, 70, 229, 0.4)";
                e.currentTarget.style.backgroundColor = "#6366f1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(79, 70, 229, 0.3)";
                e.currentTarget.style.backgroundColor = "#4f46e5";
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = "translateY(1px)";
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
            >
              <span style={{ fontSize: "18px" }}>←</span>
              <span>Материалы</span>
            </Link>
            <h1 style={{ margin: "12px 0 8px", color: "#f8fafc", fontWeight: 900 }}>
              Материал не найден
            </h1>
            <p style={{ color: "#94a3b8", margin: 0 }}>
              Не удалось открыть пробный тест Gatehouse Awards.
            </p>
          </div>

          <section className="gatehouse-profile">
            <div className="gatehouse-card">
              <div className="gatehouse-card__inner">
                <div className="gatehouse-message gatehouse-message--error">
                  {initialError || "Материал не найден или больше недоступен."}
                </div>
                <div style={{ marginTop: 18 }}>
                  <Link className="gatehouse-button" href="/gatehouse/materials">
                    Вернуться к материалам
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const material = data.material;
  const levels = formatGatehouseLevels(material.target_levels);

  return (
    <main className="gatehouse-page">
      <div className="gatehouse-container">
        <GatehouseHeader />

        <div style={{ marginBottom: "24px" }}>
          {/* Новая стильная кнопка назад */}
          <Link
            href="/gatehouse/materials"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 20px",
              backgroundColor: "#4f46e5",
              color: "white",
              fontSize: "14px",
              fontWeight: 500,
              textDecoration: "none",
              borderRadius: "40px",
              transition: "all 0.2s cubic-bezier(0.2, 0.9, 0.4, 1.1)",
              boxShadow: "0 2px 8px rgba(79, 70, 229, 0.3)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 8px 16px rgba(79, 70, 229, 0.4)";
              e.currentTarget.style.backgroundColor = "#6366f1";
              const arrow = e.currentTarget.querySelector(".back-arrow") as HTMLElement;
              if (arrow) arrow.style.transform = "translateX(-3px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(79, 70, 229, 0.3)";
              e.currentTarget.style.backgroundColor = "#4f46e5";
              const arrow = e.currentTarget.querySelector(".back-arrow") as HTMLElement;
              if (arrow) arrow.style.transform = "translateX(0)";
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = "translateY(1px)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
          >
            <span
              className="back-arrow"
              style={{
                fontSize: "18px",
                transition: "transform 0.2s ease",
                display: "inline-block",
              }}
            >
              ←
            </span>
            <span>Материалы</span>
          </Link>
        </div>

        <div className="gatehouse-stats" aria-label="Прогресс материала">
          <article className="gatehouse-stat">
            <span className="gatehouse-stat__value">{levels}</span>
            <span className="gatehouse-stat__label">уровень</span>
          </article>
          <article className="gatehouse-stat">
            <span className="gatehouse-stat__value">{data.totalAssignments}</span>
            <span className="gatehouse-stat__label">заданий</span>
          </article>
          <article className="gatehouse-stat">
            <span className="gatehouse-stat__value">{data.progress}%</span>
            <span className="gatehouse-stat__label">
              {data.completedAssignments} из {data.totalAssignments} пройдено
            </span>
          </article>
        </div>

        <section className="gatehouse-profile">
          {initialError ? (
            <div className="gatehouse-message gatehouse-message--error">{initialError}</div>
          ) : null}

          {!data.hasAccess ? (
            <div className="gatehouse-card">
              <div className="gatehouse-card__inner">
                <h2 className="gatehouse-card__title">Материал пока закрыт</h2>
                <p className="gatehouse-card__subtitle">
                  Чтобы открыть этот пробный тест, создайте заявку на нужный уровень Gatehouse Awards.
                </p>
                <div style={{ marginTop: 18 }}>
                  <Link className="gatehouse-button" href="/gatehouse/requests">
                    Создать заявку
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          <div className="gatehouse-card">
            <div className="gatehouse-card__inner">
              <h2 className="gatehouse-card__title">Задания пробного теста</h2>
              <p className="gatehouse-card__subtitle">
                Задания используют общий движок платформы. В экзаменах не начисляются олимпийские стрики.
              </p>

              {assignments.length > 0 ? (
                <div className="gatehouse-recent">
                  {assignments.map((assignment, index) => {
                    const isReady = checkIsReady(assignment);
                    const disabled = !data.hasAccess || !isReady;
                    const href = getAssignmentHref("gatehouse", assignment.id);

                    const content = (
                      <>
                        <div>
                          <h3 className="gatehouse-recent__title">
                            <span aria-hidden="true">{getAssignmentIcon(assignment)} </span>
                            {index + 1}. {assignment.title}
                          </h3>
                          <p className="gatehouse-recent__meta">
                            {getAssignmentStatusLabel(assignment)}
                            {assignment.isCompleted && assignment.score !== null
                              ? ` · результат ${formatScore(assignment.score)}`
                              : ""}
                          </p>
                        </div>
                        <div className="gatehouse-recent__score">
                          {assignment.isCompleted && assignment.score !== null ? formatScore(assignment.score) : "→"}
                        </div>
                      </>
                    );

                    if (disabled) {
                      return (
                        <article
                          className="gatehouse-recent__item"
                          key={assignment.id}
                          style={{ opacity: 0.62 }}
                        >
                          {content}
                        </article>
                      );
                    }

                    return (
                      <Link
                        className="gatehouse-recent__item"
                        key={assignment.id}
                        href={href}
                        style={{ color: "inherit", textDecoration: "none" }}
                      >
                        {content}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="gatehouse-empty" style={{ marginTop: 20 }}>
                  <span className="gatehouse-empty__icon" aria-hidden="true">📝</span>
                  <h3 className="gatehouse-empty__title">Заданий пока нет</h3>
                  <p className="gatehouse-empty__text">
                    Администратор уже создал материал, но задания для него ещё не добавлены.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}