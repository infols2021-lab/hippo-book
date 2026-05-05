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

function getAssignmentStatusLabel(assignment: GatehouseAssignmentPreview): string {
  if (assignment.isCompleted) return "Пройдено";
  if (assignment.questionsCount > 0) return `${assignment.questionsCount} вопросов`;
  return "Скоро будет доступно";
}

function getAssignmentIcon(assignment: GatehouseAssignmentPreview): string {
  if (assignment.isCompleted) return "✓";
  if (assignment.questionsCount > 0) return "📝";
  return "⏳";
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
          <GatehouseHeader
            title="Материал не найден"
            description="Не удалось открыть пробный тест Gatehouse Awards."
            backHref="/gatehouse/materials"
            backLabel="Материалы"
          />

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
        <GatehouseHeader
          title={material.title}
          description={
            material.description ||
            "Пробный тест Gatehouse Awards. Пройдите задания, чтобы увидеть результат и рекомендацию уровня."
          }
          backHref="/gatehouse/materials"
          backLabel="Материалы"
          actions={[
            {
              href: "/gatehouse/profile",
              label: "Профиль",
              icon: "👤",
            },
            {
              href: "/gatehouse/requests",
              label: "Заявки",
              icon: "📋",
            },
          ]}
        >
          <div className="gatehouse-stats" aria-label="Прогресс материала">
            <article className="gatehouse-stat">
              <span className="gatehouse-stat__icon" aria-hidden="true">
                🎯
              </span>
              <span className="gatehouse-stat__value">{levels}</span>
              <span className="gatehouse-stat__label">уровень</span>
            </article>

            <article className="gatehouse-stat">
              <span className="gatehouse-stat__icon" aria-hidden="true">
                📝
              </span>
              <span className="gatehouse-stat__value">{data.totalAssignments}</span>
              <span className="gatehouse-stat__label">заданий</span>
            </article>

            <article className="gatehouse-stat">
              <span className="gatehouse-stat__icon" aria-hidden="true">
                ✨
              </span>
              <span className="gatehouse-stat__value">{data.progress}%</span>
              <span className="gatehouse-stat__label">
                {data.completedAssignments} из {data.totalAssignments} пройдено
              </span>
            </article>
          </div>
        </GatehouseHeader>

        <section className="gatehouse-profile">
          {initialError ? (
            <div className="gatehouse-message gatehouse-message--error">{initialError}</div>
          ) : null}

          {!data.hasAccess ? (
            <div className="gatehouse-card">
              <div className="gatehouse-card__inner">
                <h2 className="gatehouse-card__title">Материал пока закрыт</h2>
                <p className="gatehouse-card__subtitle">
                  Чтобы открыть этот пробный тест, создайте заявку на нужный уровень Gatehouse
                  Awards.
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
                Задания используют общий движок платформы. В экзаменах не начисляются олимпийские
                стрики.
              </p>

              {assignments.length > 0 ? (
                <div className="gatehouse-recent">
                  {assignments.map((assignment, index) => {
                    const disabled = !data.hasAccess || assignment.questionsCount <= 0;
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
                            {assignment.isCompleted ? ` · результат ${formatScore(assignment.score)}` : ""}
                          </p>
                        </div>

                        <div className="gatehouse-recent__score">
                          {assignment.isCompleted ? formatScore(assignment.score) : "→"}
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
                  <span className="gatehouse-empty__icon" aria-hidden="true">
                    📝
                  </span>
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