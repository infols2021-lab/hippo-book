"use client";

import { useMemo, useState } from "react";
import GatehouseHeader from "@/components/gatehouse/GatehouseHeader";
import GatehouseMaterialCard from "@/components/gatehouse/GatehouseMaterialCard";
import type { MaterialWithProgress } from "@/lib/materials/types";
import { BRANCH_CONFIGS } from "@/lib/branches/config";

type GatehouseMaterialsClientProps = {
  initialMaterials: MaterialWithProgress[];
  initialError: string | null;
};

type GatehouseMaterialsTab = "mock_tests" | "coming_soon";

function sortMaterials(materials: MaterialWithProgress[]): MaterialWithProgress[] {
  return [...materials].sort((a, b) => {
    const orderDiff = Number(a.order_index ?? 0) - Number(b.order_index ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a.title ?? "").localeCompare(String(b.title ?? ""), "ru");
  });
}

export default function GatehouseMaterialsClient({
  initialMaterials,
  initialError,
}: GatehouseMaterialsClientProps) {
  const [tab, setTab] = useState<GatehouseMaterialsTab>("mock_tests");

  const materials = useMemo(() => sortMaterials(initialMaterials), [initialMaterials]);
  const availableCount = materials.filter((material) => material.hasAccess).length;
  const lockedCount = materials.length - availableCount;

  return (
    <main className="gatehouse-page">
      <div className="gatehouse-container">
        <GatehouseHeader
          title="Материалы Gatehouse Awards"
          description="Пробные тесты используют тот же движок заданий, но отображаются в отдельном экзаменационном пространстве без олимпийских стриков."
          backHref="/gatehouse/profile"
          backLabel="Профиль"
          actions={[
            {
              href: "/gatehouse/requests",
              label: "Заявки",
              icon: "📋",
            },
            {
              href: "/portal",
              label: "Портал",
              icon: "🏠",
            },
          ]}
        >
          <div className="gatehouse-stats" aria-label="Статистика материалов Gatehouse Awards">
            <article className="gatehouse-stat">
              <span className="gatehouse-stat__icon" aria-hidden="true">
                📝
              </span>
              <span className="gatehouse-stat__value">{materials.length}</span>
              <span className="gatehouse-stat__label">пробных тестов</span>
            </article>

            <article className="gatehouse-stat">
              <span className="gatehouse-stat__icon" aria-hidden="true">
                ✨
              </span>
              <span className="gatehouse-stat__value">{availableCount}</span>
              <span className="gatehouse-stat__label">доступно сейчас</span>
            </article>

            <article className="gatehouse-stat">
              <span className="gatehouse-stat__icon" aria-hidden="true">
                🔒
              </span>
              <span className="gatehouse-stat__value">{lockedCount}</span>
              <span className="gatehouse-stat__label">ожидает доступа</span>
            </article>
          </div>
        </GatehouseHeader>

        <section className="gatehouse-profile">
          <div className="gatehouse-card">
            <div className="gatehouse-card__inner">
              <div className="gatehouse-materials-tabs" role="tablist" aria-label="Разделы материалов">
                {BRANCH_CONFIGS.gatehouse.materialTabs.map((item) => (
                  <button
                    key={item.key}
                    className={[
                      "gatehouse-button",
                      tab === item.key ? "" : "gatehouse-button--ghost",
                    ].join(" ")}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.key}
                    onClick={() => setTab(item.key as GatehouseMaterialsTab)}
                  >
                    <span aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              {initialError ? (
                <div className="gatehouse-message gatehouse-message--error">{initialError}</div>
              ) : null}

              {tab === "mock_tests" ? (
                <>
                  {materials.length > 0 ? (
                    <div
                      className="gatehouse-materials-grid"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: 18,
                        marginTop: 22,
                      }}
                    >
                      {materials.map((material) => (
                        <GatehouseMaterialCard
                          key={material.id}
                          material={material}
                          locked={!material.hasAccess}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="gatehouse-empty" style={{ marginTop: 22 }}>
                      <span className="gatehouse-empty__icon" aria-hidden="true">
                        📝
                      </span>
                      <h3 className="gatehouse-empty__title">Пробные тесты пока не добавлены</h3>
                      <p className="gatehouse-empty__text">
                        Когда администратор создаст материалы Gatehouse Awards, они появятся здесь.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="gatehouse-empty" style={{ marginTop: 22 }}>
                  <span className="gatehouse-empty__icon" aria-hidden="true">
                    ✨
                  </span>
                  <h3 className="gatehouse-empty__title">Раздел в разработке</h3>
                  <p className="gatehouse-empty__text">
                    Сейчас доступны пробные тесты. Позже сюда можно будет добавить новые типы
                    экзаменационных материалов без изменения основного движка.
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