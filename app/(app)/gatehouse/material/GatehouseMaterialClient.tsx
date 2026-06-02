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
  if (typeof score !== "number" || !Number.isFinite(score)) return "-";
  return `${Math.max(0, Math.min(100, Math.round(score)))}%`;
}

function getAssignmentStatusLabel(assignment: GatehouseAssignmentPreview): string {
  if (assignment.isCompleted) return "ройдено";
  if (assignment.questionsCount > 0) return `${assignment.questionsCount} вопросов`;
  return "Скоро будет доступно";
}

function getAssignmentIcon(assignment: GatehouseAssignmentPreview): string {
  if (assignment.isCompleted) return "v";
  if (assignment.questionsCount > 0) return "[]";
  return "...";
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
            <Link href="/gatehouse/materials" style={{ color: "#a5b4fc", fontSize: "14px", textDecoration: "none" }}>
              &larr; атериалы
            </Link>
            <h1 style={{ margin: "12px 0 8px", color: "#f8fafc", fontWeight: 900 }}>
              атериал не найден
            </h1>
            <p style={{ color: "#94a3b8", margin: 0 }}>
              е удалось открыть пробный тест Gatehouse Awards.
            </p>
          </div>

          <section className="gatehouse-profile">
            <div className="gatehouse-card">
              <div className="gatehouse-card__inner">
                <div className="gatehouse-message gatehouse-message--error">
                  {initialError || "атериал не найден или больше недоступен."}
                </div>
                <div style={{ marginTop: 18 }}>
                  <Link className="gatehouse-button" href="/gatehouse/materials">
                    ернуться к материалам
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
          <Link href="/gatehouse/materials" style={{ color: "#a5b4fc", fontSize: "14px", textDecoration: "none" }}>
            &larr; атериалы
          </Link>
          <h1 style={{ margin: "12px 0 8px", color: "#f8fafc", fontWeight: 900 }}>
            {material.title}
          </h1>
          <p style={{ color: "#94a3b8", margin: "0 0 16px" }}>
            {material.description || "робный тест Gatehouse Awards. ройдите задания, чтобы увидеть результат и рекомендацию уровня."}
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link href="/gatehouse/profile" style={{ padding: "6px 14px", background: "rgba(99,102,241,0.15)", color: "#a5b4fc", borderRadius: "8px", textDecoration: "none", fontSize: "13px", fontWeight: 700 }}>
              рофиль
            </Link>
            <Link href="/gatehouse/requests" style={{ padding: "6px 14px", background: "rgba(99,102,241,0.15)", color: "#a5b4fc", borderRadius: "8px", textDecoration: "none", fontSize: "13px", fontWeight: 700 }}>
              аявки
            </Link>
          </div>
        </div>

        <div className="gatehouse-stats" aria-label="рогресс материала">
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
            <span className="gatehouse-stat__label">{data.completedAssignments} из {data.totalAssignments} пройдено</span>
          </article>
        </div>

        <section className="gatehouse-profile">
          {initialError ? (
            <div className="gatehouse-message gatehouse-message--error">{initialError}</div>
          ) : null}

          {!data.hasAccess ? (
            <div className="gatehouse-card">
              <div className="gatehouse-card__inner">
                <h2 className="gatehouse-card__title">атериал пока закрыт</h2>
                <p className="gatehouse-card__subtitle">
                  тобы открыть этот пробный тест, создайте заявку на нужный уровень Gatehouse Awards.
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
              <h2 className="gatehouse-card__title">адания пробного теста</h2>
              <p className="gatehouse-card__subtitle">
                адания используют общий движок платформы.  экзаменах не начисляются олимпийские стрики.
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
                            {getAssignmentIcon(assignment)} {index + 1}. {assignment.title}
                          </h3>
                          <p className="gatehouse-recent__meta">
                            {getAssignmentStatusLabel(assignment)}
                            {assignment.isCompleted ? ` · результат ${formatScore(assignment.score)}` : ""}
                          </p>
                        </div>
                        <div className="gatehouse-recent__score">
                          {assignment.isCompleted ? formatScore(assignment.score) : "->"}
                        </div>
                      </>
                    );

                    if (disabled) {
                      return (
                        <article className="gatehouse-recent__item" key={assignment.id} style={{ opacity: 0.62 }}>
                          {content}
                        </article>
                      );
                    }
                    return (
                      <Link className="gatehouse-recent__item" key={assignment.id} href={href} style={{ color: "inherit", textDecoration: "none" }}>
                        {content}
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="gatehouse-empty" style={{ marginTop: 20 }}>
                  <h3 className="gatehouse-empty__title">аданий пока нет</h3>
                  <p className="gatehouse-empty__text">
                    дминистратор уже создал материал, но задания для него ещё не добавлены.
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