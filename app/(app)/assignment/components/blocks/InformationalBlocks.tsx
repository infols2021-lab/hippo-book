"use client";

import React, { useState } from "react";
import type { 
  HeroBlock, TextSectionBlock, AlertBlock, 
  VideoBlock, CardsGridBlock, AccordionBlock, DownloadsBlock 
} from "@/app/(admin)/admin/assignments/builder/types";

// ==========================================
// ЦВЕТОВЫЕ ТЕМЫ
// ==========================================
export const THEMES = {
  blue: { bg: "#dbeeff", border: "#93c5fd", text: "#0d3d6e", dot: "#2176c7" },
  green: { bg: "#d4f5e8", border: "#6ee7b7", text: "#0d5c3f", dot: "#1a9e6e" },
  orange: { bg: "#fde8d4", border: "#fdba74", text: "#7a3208", dot: "#e06b20" },
  purple: { bg: "#ede8ff", border: "#c4b5fd", text: "#2e1d6e", dot: "#6b4fcf" },
  gold: { bg: "#fef3d0", border: "#fcd34d", text: "#6b4800", dot: "#c48a0a" },
  red: { bg: "#fde8e6", border: "#fca5a5", text: "#7a1a12", dot: "#d93a2b" },
  default: { bg: "#f1f5f9", border: "#cbd5e1", text: "#334155", dot: "#64748b" }
};

// ==========================================
// РЕНДЕРЕРЫ ОТДЕЛЬНЫХ БЛОКОВ
// ==========================================

export function HeroView({ data }: { data: HeroBlock["data"] }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #0f2444 0%, #1a3a6b 60%, #0d5c3f 100%)",
      padding: "56px 24px 64px",
      textAlign: "center",
      borderRadius: "16px",
      marginBottom: "40px",
      boxShadow: "0 10px 30px rgba(13, 61, 110, 0.15)",
      position: "relative",
      overflow: "hidden"
    }}>
      {data.badge && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "999px", padding: "6px 16px", fontSize: "12px",
          fontWeight: 700, letterSpacing: "0.08em", color: "#a8f0d0",
          textTransform: "uppercase", marginBottom: "20px"
        }}>
          ✦ {data.badge}
        </div>
      )}
      <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: "16px", letterSpacing: "-0.02em" }}>
        {data.title}
      </h1>
      {data.subtitle && (
        <p style={{ fontSize: "17px", color: "rgba(255,255,255,0.8)", maxWidth: "540px", margin: "0 auto 32px", fontWeight: 400, lineHeight: 1.6 }}>
          {data.subtitle}
        </p>
      )}
      {data.pills && data.pills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
          {data.pills.map((pill, i) => {
            const colors = ["#4ade9a", "#fcd34d", "#93c5fd", "#f9a8d4"];
            const dotColor = colors[i % colors.length];
            return (
              <div key={i} style={{
                background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: "999px", padding: "8px 18px", fontSize: "13px",
                fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: "7px"
              }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: dotColor }} />
                {pill}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TextSectionView({ data }: { data: TextSectionBlock["data"] }) {
  return (
    <div style={{ marginTop: "48px", marginBottom: "24px" }}>
      {data.label && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "11px",
          fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#6b7280", marginBottom: "14px"
        }}>
          <span style={{ display: "inline-block", width: "24px", height: "2px", background: "#e5e7eb", borderRadius: "1px" }} />
          {data.label}
          <span style={{ display: "inline-block", width: "24px", height: "2px", background: "#e5e7eb", borderRadius: "1px" }} />
        </div>
      )}
      {data.title && (
        <h2 style={{ fontSize: "clamp(22px, 3.5vw, 30px)", fontWeight: 900, color: "#111827", letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: "16px" }}>
          {data.title}
        </h2>
      )}
      <div 
        style={{ fontSize: "16px", color: "#374151", lineHeight: 1.75, maxWidth: "720px", whiteSpace: "pre-wrap" }}
        dangerouslySetInnerHTML={{ __html: data.content }} 
      />
    </div>
  );
}

export function AlertView({ data }: { data: AlertBlock["data"] }) {
  const styles = {
    teacher: { bg: "#fffbeb", border: "#fcd34d", text: "#78350f" },
    info: { bg: "#eff6ff", border: "#93c5fd", text: "#1e3a5f" },
    warning: { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" }
  }[data.theme || "info"];

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: "12px",
      background: styles.bg, border: `1.5px solid ${styles.border}`,
      borderRadius: "12px", padding: "16px 20px", margin: "24px 0"
    }}>
      {data.icon && <div style={{ fontSize: "20px", flexShrink: 0, marginTop: "2px" }}>{data.icon}</div>}
      <div style={{ fontSize: "14px", lineHeight: 1.65, color: styles.text, fontWeight: 500, whiteSpace: "pre-wrap" }}>
        {data.content}
      </div>
    </div>
  );
}

export function VideoView({ data }: { data: VideoBlock["data"] }) {
  return (
    <div style={{ marginTop: "24px", marginBottom: "32px" }}>
      <div style={{
        borderRadius: "14px", overflow: "hidden", border: "1.5px solid #e5e7eb",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)", background: "#0f2444",
        position: "relative", aspectRatio: "16/9", width: "100%"
      }}>
        {data.url ? (
          <iframe 
            src={data.url} 
            allowFullScreen 
            style={{ width: "100%", height: "100%", border: "none", display: "block" }} 
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "white", opacity: 0.5 }}>
            Нет ссылки на видео
          </div>
        )}
      </div>
      {(data.caption || data.subCaption) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", padding: "0 4px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>{data.caption}</div>
          <div style={{ fontSize: "13px", color: "#6b7280", fontWeight: 500 }}>{data.subCaption}</div>
        </div>
      )}
    </div>
  );
}

export function CardsGridView({ data }: { data: CardsGridBlock["data"] }) {
  const gridTemplateColumns = `repeat(auto-fit, minmax(${data.columns > 2 ? "200px" : "280px"}, 1fr))`;

  return (
    <div style={{ display: "grid", gridTemplateColumns, gap: "16px", marginTop: "24px", marginBottom: "32px" }}>
      {data.items.map((item) => {
        const theme = THEMES[item.theme as keyof typeof THEMES] || THEMES.default;
        
        return (
          <div key={item.id} style={{
            background: "#ffffff", border: `1.5px solid ${theme.border}`,
            borderRadius: "14px", padding: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
            display: "flex", flexDirection: "column", gap: "12px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {item.icon && (
                <div style={{
                  width: "44px", height: "44px", borderRadius: "12px", background: theme.bg,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"
                }}>
                  {item.icon}
                </div>
              )}
              <h3 style={{ fontSize: "16px", fontWeight: 800, color: theme.text, margin: 0, lineHeight: 1.3 }}>
                {item.title}
              </h3>
            </div>
            {item.content && (
              <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                {item.content}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AccordionView({ data }: { data: AccordionBlock["data"] }) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(openIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpenIds(next);
  };

  return (
    <div style={{ marginTop: "24px", marginBottom: "32px", display: "flex", flexDirection: "column", gap: "12px" }}>
      {data.items.map((item, i) => {
        const isOpen = openIds.has(item.id);
        const theme = THEMES[item.tagTheme as keyof typeof THEMES] || THEMES.default;

        return (
          <div key={item.id} style={{
            background: "#ffffff", border: "1.5px solid #e5e7eb",
            borderRadius: "14px", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            transition: "all 0.2s"
          }}>
            <div 
              onClick={() => toggle(item.id)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                padding: "16px 20px", cursor: "pointer", userSelect: "none",
                background: isOpen ? "#f8fafc" : "#ffffff"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{
                  width: "32px", height: "32px", borderRadius: "8px", background: theme.bg, color: theme.text,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 800
                }}>
                  {i + 1}
                </div>
                <div style={{ fontSize: "15px", fontWeight: 700, color: "#111827" }}>{item.title}</div>
                {item.tag && (
                  <span style={{
                    fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px",
                    background: theme.bg, color: theme.text, letterSpacing: "0.04em", textTransform: "uppercase"
                  }}>
                    {item.tag}
                  </span>
                )}
              </div>
              <div style={{ color: "#94a3b8", transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>
                ▼
              </div>
            </div>
            
            {isOpen && (
              <div
              style={{
                    borderTop: "1.5px solid #e5e7eb", padding: "20px",
                  fontSize: "14.5px", color: "#374151", lineHeight: 1.75,
                }}
                dangerouslySetInnerHTML={{ __html: item.content }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DownloadsView({ data }: { data: DownloadsBlock["data"] }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: "16px", marginTop: "24px", marginBottom: "32px"
    }}>
      {data.files.map((file) => {
        const theme = THEMES[file.theme as keyof typeof THEMES] || THEMES.default;
        
        return (
          <div key={file.id} style={{
            background: "#ffffff", border: "1.5px solid #e5e7eb", borderRadius: "14px",
            padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
            display: "flex", flexDirection: "column", gap: "12px", transition: "transform 0.15s"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{
                width: "46px", height: "46px", borderRadius: "12px", background: theme.bg,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px"
              }}>
                {file.icon || "📄"}
              </div>
              {file.fileType && (
                <span style={{
                  background: theme.bg, color: theme.text, fontSize: "10px", fontWeight: 800,
                  letterSpacing: "0.06em", padding: "3px 8px", borderRadius: "6px", textTransform: "uppercase"
                }}>
                  {file.fileType}
                </span>
              )}
            </div>
            
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#111827", margin: "0 0 4px 0", lineHeight: 1.3 }}>
                {file.name}
              </h3>
              {file.description && (
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0, lineHeight: 1.5 }}>
                  {file.description}
                </p>
              )}
            </div>

            <a 
              href={file.url} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                padding: "10px 0", borderRadius: "8px", background: theme.text, color: "#fff",
                fontSize: "13px", fontWeight: 800, textDecoration: "none", marginTop: "8px"
              }}
            >
              ⬇ Скачать
            </a>
          </div>
        );
      })}
    </div>
  );
}