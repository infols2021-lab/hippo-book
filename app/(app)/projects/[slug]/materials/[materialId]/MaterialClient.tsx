"use client";

import { useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";

type Props = {
  slug: string;
  project: any;
  material: any;
  assignments: any[];
  completedIds: string[];
  progressPct: number;
  completedCount: number;
  totalCount: number;
  coverUrl: string;
  hasAccess: boolean;
};

export default function MaterialClient({
  slug, project, material, assignments, completedIds, progressPct, completedCount, totalCount, coverUrl, hasAccess
}: Props) {
  
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!hasAccess) {
    return (
      <div className="container" style={{ textAlign: "center", paddingTop: 100 }}>
        <div className="card" style={{ maxWidth: "500px", margin: "0 auto", padding: "40px" }}>
          <h2 style={{ color: "var(--project-text)", margin: "0 0 16px 0", fontWeight: 800 }}>
            У вас нет доступа к этому материалу 🔒
          </h2>
          <Link href={`/projects/${slug}/materials`} className="btn ghost">
            Вернуться назад
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: "60px" }}>
      <AppHeader
        nav={[
          { kind: "link", href: `/projects/${slug}/materials`, label: "К материалам", className: "btn ghost" },
          { kind: "link", href: `/projects/${slug}/profile`, label: "Профиль", className: "btn secondary" },
        ]}
      />

      <div className="container" style={{ maxWidth: "840px" }}>
        
        <Link 
          href={`/projects/${slug}/materials`} 
          style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: "8px", 
            marginBottom: "24px", 
            color: "var(--project-primary)", 
            textDecoration: "none", 
            fontWeight: 800,
            fontSize: "14px",
            textTransform: "uppercase",
            letterSpacing: "0.05em"
          }}
        >
          ← Назад к материалам
        </Link>

        {/* Главная карточка материала */}
        <div className="card" style={{ 
          display: "flex", 
          gap: "24px", 
          marginBottom: "32px",
          flexWrap: "wrap",
          padding: "32px",
          borderRadius: "28px"
        }}>
          <div style={{ 
            flexShrink: 0, 
            width: "160px", 
            height: "160px", 
            borderRadius: "20px", 
            overflow: "hidden", 
            backgroundColor: "color-mix(in srgb, var(--project-text) 4%, transparent)",
            border: "1px solid color-mix(in srgb, var(--project-text) 6%, transparent)",
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center" 
          }}>
            {coverUrl ? (
              <img src={coverUrl} alt={material.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: "3.5rem", opacity: 0.3 }}>📄</span>
            )}
          </div>

          <div style={{ flex: 1, minWidth: "250px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <h1 style={{ margin: "0 0 12px 0", fontSize: "28px", fontWeight: 900, color: "var(--project-text)", lineHeight: 1.2 }}>
              {material.title}
            </h1>
            <p style={{ color: "color-mix(in srgb, var(--project-text) 60%, transparent)", margin: "0 0 24px 0", lineHeight: 1.5, fontSize: "15px", fontWeight: 500 }}>
              {material.description || "Учебные материалы и задания для изучения"}
            </p>
            
            {/* Прогресс-бар */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ 
                flex: 1, 
                height: "8px", 
                backgroundColor: "color-mix(in srgb, var(--project-text) 8%, transparent)", 
                borderRadius: "999px", 
                overflow: "hidden" 
              }}>
                <div style={{ 
                  width: `${progressPct}%`, 
                  height: "100%", 
                  backgroundColor: "var(--project-primary)", 
                  transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                  borderRadius: "999px"
                }} />
              </div>
              <span style={{ 
                fontWeight: 900, 
                fontSize: "16px", 
                color: "var(--project-primary)",
                minWidth: "44px",
                textAlign: "right"
              }}>
                {progressPct}%
              </span>
            </div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "color-mix(in srgb, var(--project-text) 50%, transparent)", marginTop: "10px" }}>
              Выполнено {completedCount} из {totalCount} заданий
            </div>
          </div>
        </div>

        {/* Заголовок списка заданий */}
        <div style={{ 
          marginBottom: "20px", 
          fontSize: "14px", 
          textTransform: "uppercase", 
          letterSpacing: "0.05em", 
          fontWeight: 800, 
          color: "color-mix(in srgb, var(--project-text) 50%, transparent)",
          paddingLeft: "8px"
        }}>
          Задания учебника
        </div>
        
        {/* Список заданий */}
        {assignments.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {assignments.map((a, index) => {
              const isDone = completedIds.includes(a.id);
              const assignTypeLabel = a.assignment_type === 'intro' ? 'ОЗНАКОМИТЕЛЬНОЕ' : 'ТЕСТ';
              const isHovered = hoveredId === a.id;
              
              return (
                <Link
                  key={a.id}
                  href={`/projects/${slug}/assignment?id=${a.id}`}
                  onMouseEnter={() => setHoveredId(a.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "20px 24px",
                    backgroundColor: "var(--project-card-bg)",
                    borderRadius: "20px",
                    textDecoration: "none",
                    color: "inherit",
                    border: `1px solid ${isHovered ? "color-mix(in srgb, var(--project-primary) 40%, transparent)" : "var(--glass-border)"}`,
                    transform: isHovered ? "translateY(-3px)" : "translateY(0)",
                    boxShadow: isHovered 
                      ? "0 12px 32px -8px color-mix(in srgb, var(--project-text) 12%, transparent)" 
                      : "0 4px 12px -4px color-mix(in srgb, var(--project-text) 5%, transparent)",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                    <div style={{
                      width: "48px", 
                      height: "48px", 
                      flexShrink: 0, 
                      borderRadius: "14px",
                      backgroundColor: "color-mix(in srgb, var(--project-primary) 10%, transparent)",
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      fontSize: "22px"
                    }}>
                      📝
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ fontWeight: 800, fontSize: "16px", color: "var(--project-text)" }}>
                        {index + 1}. {a.title || "Задание без названия"}
                      </div>
                      <div style={{ 
                        fontSize: "12px", 
                        fontWeight: 800, 
                        color: "color-mix(in srgb, var(--project-text) 50%, transparent)", 
                        letterSpacing: "0.05em" 
                      }}>
                        {assignTypeLabel}
                      </div>
                    </div>
                  </div>
                  
                  {/* Кнопка-статус */}
                  <div style={{
                    display: "inline-flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    padding: "8px 20px", 
                    borderRadius: "99px", 
                    fontWeight: 800, 
                    fontSize: "13px", 
                    whiteSpace: "nowrap", 
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    background: isDone 
                      ? "color-mix(in srgb, #10b981 12%, transparent)" 
                      : (isHovered ? "var(--project-primary)" : "color-mix(in srgb, var(--project-text) 4%, transparent)"),
                    color: isDone 
                      ? "#059669" 
                      : (isHovered ? "#fff" : "var(--project-text)"),
                    border: isDone 
                      ? "1px solid color-mix(in srgb, #10b981 25%, transparent)" 
                      : `1px solid ${isHovered ? "var(--project-primary)" : "color-mix(in srgb, var(--project-text) 8%, transparent)"}`,
                    boxShadow: (isHovered && !isDone) ? "inset 0 1px 1px rgba(255,255,255,0.3)" : "none"
                  }}>
                    {isDone ? "✅ Выполнено" : "▶ Начать"}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div style={{ 
            padding: "60px 20px", 
            textAlign: "center", 
            backgroundColor: "var(--glass-bg)",
            backdropFilter: "var(--glass-blur)",
            borderRadius: "24px", 
            color: "color-mix(in srgb, var(--project-text) 60%, transparent)", 
            border: "1px dashed var(--glass-border)" 
          }}>
            <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "16px", opacity: 0.8 }}>📭</span>
            <div style={{ fontWeight: 800, fontSize: "16px", color: "var(--project-text)" }}>В этом материале пока нет заданий</div>
            <p style={{ marginTop: "8px", fontSize: "14px" }}>Ожидайте, когда они будут добавлены администратором.</p>
          </div>
        )}
      </div>
    </div>
  );
}