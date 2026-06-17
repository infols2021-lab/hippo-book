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
  const primaryColor = project.theme?.colors?.primary || project.theme?.primaryColor || project.theme_color || "#3b82f6";

  if (!hasAccess) {
    return (
      <div className="container" style={{ textAlign: "center", paddingTop: 100 }}>
        <div className="card">
          <h2 style={{ color: "var(--project-text)" }}>У вас нет доступа к этому материалу 🔒</h2>
          <Link href={`/projects/${slug}/materials`} className="btn ghost" style={{ marginTop: 16 }}>
            Вернуться назад
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "var(--project-bg)", color: "var(--project-text)", minHeight: "100vh", paddingBottom: "60px" }}>
      <AppHeader
        themeColor={primaryColor}
        nav={[
          { kind: "link", href: `/projects/${slug}/materials`, label: "К материалам", className: "btn ghost" },
          { kind: "link", href: `/projects/${slug}/profile`, label: "Профиль", className: "btn secondary" },
        ]}
      />

      <div style={{ maxWidth: 840, margin: "0 auto", padding: "0 20px" }}>
        
        <Link 
          href={`/projects/${slug}/materials`} 
          style={{ display: "inline-block", marginBottom: 20, color: "var(--project-primary)", textDecoration: "none", fontWeight: 700 }}
        >
          ← Назад к материалам
        </Link>

        {/* Карточка материала (Шапка) */}
        <div style={{ 
          display: "flex", gap: 24, padding: 24, 
          backgroundColor: "var(--project-card-bg)", 
          border: "1px solid var(--project-border)",
          borderRadius: 20, 
          boxShadow: "0 4px 20px var(--project-glow)", 
          marginBottom: 32,
          flexWrap: "wrap" 
        }}>
          <div style={{ 
            flexShrink: 0, width: 140, height: 140, borderRadius: 16, overflow: "hidden", 
            backgroundColor: "var(--project-bg)", 
            border: "1px solid var(--project-border)",
            display: "flex", alignItems: "center", justifyContent: "center" 
          }}>
            {coverUrl ? (
              <img src={coverUrl} alt={material.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: "3.5rem", opacity: 0.5 }}>📄</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 250, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <h1 style={{ margin: "0 0 8px 0", fontSize: 26, fontWeight: 900, color: "var(--project-text)" }}>
              {material.title}
            </h1>
            <p style={{ color: "var(--project-muted)", margin: "0 0 20px 0", lineHeight: 1.5, fontSize: "15px" }}>
              {material.description || "Учебные материалы и задания"}
            </p>
            
            {/* Полоска прогресса */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1, height: 10, backgroundColor: "var(--project-border)", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ width: `${progressPct}%`, height: "100%", backgroundColor: "var(--project-primary)", transition: "width 0.5s ease-out" }} />
              </div>
              <span style={{ fontWeight: 800, fontSize: "15px", color: "var(--project-primary)" }}>{progressPct}%</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--project-muted)", marginTop: 8 }}>
              Выполнено {completedCount} из {totalCount} заданий
            </div>
          </div>
        </div>

        {/* Список заданий */}
        <div style={{ marginBottom: 16, fontSize: 13, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 800, color: "var(--project-muted)" }}>
          Задания учебника
        </div>
        
        {assignments.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                    padding: "14px 18px",
                    backgroundColor: "var(--project-card-bg)",
                    borderRadius: "16px",
                    textDecoration: "none",
                    color: "inherit",
                    border: `1px solid ${isHovered ? "var(--project-primary)" : "var(--project-border)"}`,
                    transform: isHovered ? "translateY(-2px)" : "translateY(0)",
                    boxShadow: isHovered ? "0 8px 24px var(--project-glow)" : "none",
                    transition: "transform 0.2s, border-color 0.2s, box-shadow 0.2s"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{
                      width: 42, height: 42, flexShrink: 0, borderRadius: 12,
                      backgroundColor: "color-mix(in srgb, var(--project-primary) 12%, transparent)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20
                    }}>
                      📝
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ fontWeight: 800, fontSize: 15, color: "var(--project-text)" }}>
                        {index + 1}. {a.title || "Задание без названия"}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--project-muted)", letterSpacing: "0.5px" }}>
                        {assignTypeLabel}
                      </div>
                    </div>
                  </div>
                  
                  {/* Кнопка-статус */}
                  <div style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    padding: "6px 16px", borderRadius: 999, fontWeight: 800, fontSize: 12, whiteSpace: "nowrap", transition: "all 0.2s",
                    background: isDone ? "color-mix(in srgb, #10b981 15%, transparent)" : (isHovered ? "var(--project-primary)" : "transparent"),
                    color: isDone ? "#10b981" : (isHovered ? "#fff" : "var(--project-text)"),
                    border: isDone ? "1px solid color-mix(in srgb, #10b981 30%, transparent)" : `1px solid ${isHovered ? "var(--project-primary)" : "color-mix(in srgb, var(--project-text) 20%, transparent)"}`
                  }}>
                    {isDone ? "✅ Выполнено" : "▶ Начать"}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div style={{ 
            padding: 40, textAlign: "center", backgroundColor: "var(--project-card-bg)", 
            borderRadius: 16, color: "var(--project-muted)", border: "1px solid var(--project-border)" 
          }}>
            <span style={{ fontSize: "2rem", display: "block", marginBottom: 12 }}>📭</span>
            <div style={{ fontWeight: 600 }}>В этом материале пока нет заданий</div>
          </div>
        )}
      </div>
    </div>
  );
}