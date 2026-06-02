// app/(app)/gatehouse/materials/GatehouseMaterialsClient.tsx
"use client";

import { useMemo, useState } from "react";
import GatehouseHeader from "@/components/gatehouse/GatehouseHeader";
import GatehouseMaterialCard from "@/components/gatehouse/GatehouseMaterialCard";
import type { MaterialWithProgress } from "@/lib/materials/types";

type GatehouseMaterialsClientProps = {
  initialMaterials: MaterialWithProgress[];
  initialError: string | null;
};

type GatehouseMaterialsTab = "mock_tests" | "advanced";

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

  return (
    <main className="gatehouse-page" style={{ minHeight: '100vh', padding: '24px 0', background: 'linear-gradient(135deg, #0f172a, #1e1b4b)', color: '#f8fafc' }}>
      <div className="gatehouse-container" style={{ width: '95%', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* ИСПОЛЬЗУЕМ НАШ НОВЫЙ ЕДИНЫЙ ХЕДЕР */}
        <GatehouseHeader />

        {/* ЗАГОЛОВОК И ТАБЫ */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'inline-block', padding: '6px 12px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderRadius: '8px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px', border: '1px solid rgba(99,102,241,0.2)' }}>
            Gatehouse Awards
          </div>
          <h1 style={{ margin: '0 0 24px 0', fontSize: 'clamp(32px, 5vw, 48px)', fontWeight: 950, letterSpacing: '-0.04em', color: '#f8fafc' }}>
            Экзаменационные материалы
          </h1>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setTab("mock_tests")}
              style={{
                padding: '12px 20px',
                borderRadius: '14px',
                fontSize: '14px',
                fontWeight: 800,
                cursor: 'pointer',
                border: tab === "mock_tests" ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.05)',
                background: tab === "mock_tests" ? 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))' : 'rgba(30,41,59,0.5)',
                color: tab === "mock_tests" ? '#f8fafc' : '#94a3b8',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: tab === "mock_tests" ? '0 8px 20px rgba(99,102,241,0.15)' : 'none'
              }}
            >
              <span>📝</span> Пробные тесты
            </button>
            <button
              onClick={() => setTab("advanced")}
              style={{
                padding: '12px 20px',
                borderRadius: '14px',
                fontSize: '14px',
                fontWeight: 800,
                cursor: 'pointer',
                border: tab === "advanced" ? '1px solid rgba(34,211,238,0.5)' : '1px solid rgba(255,255,255,0.05)',
                background: tab === "advanced" ? 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(99,102,241,0.15))' : 'rgba(30,41,59,0.5)',
                color: tab === "advanced" ? '#f8fafc' : '#94a3b8',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: tab === "advanced" ? '0 8px 20px rgba(34,211,238,0.15)' : 'none'
              }}
            >
              <span>🚀</span> Углубленная подготовка (в разработке)
            </button>
          </div>
        </div>

        {/* СТЕКЛЯННАЯ ПОДЛОЖКА ДЛЯ КАРТОЧЕК */}
        <section style={{ background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '28px', padding: 'clamp(20px, 4vw, 40px)', backdropFilter: 'blur(24px)' }}>
          
          {initialError && (
            <div className="gatehouse-message gatehouse-message--error" style={{ marginBottom: '24px' }}>
              {initialError}
            </div>
          )}

          {tab === "mock_tests" ? (
            <>
              {materials.length > 0 ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
                  {materials.map((material) => (
                    <GatehouseMaterialCard
                      key={material.id}
                      material={material}
                      locked={!material.hasAccess}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.8 }}>📝</div>
                  <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#f8fafc', marginBottom: '8px' }}>Пробные тесты пока не добавлены</h3>
                  <p style={{ fontSize: '15px', maxWidth: '400px', margin: '0 auto', lineHeight: 1.5 }}>
                    Когда администратор создаст материалы Gatehouse Awards, они появятся здесь.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.8 }}>✨</div>
              <h3 style={{ fontSize: '20px', fontWeight: 900, color: '#f8fafc', marginBottom: '8px' }}>Раздел в разработке</h3>
              <p style={{ fontSize: '15px', maxWidth: '440px', margin: '0 auto', lineHeight: 1.5 }}>
                Сейчас доступны только пробные тесты. Скоро здесь появятся новые типы материалов для углубленной подготовки к экзаменам.
              </p>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}