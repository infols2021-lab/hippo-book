"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getStoragePublicUrl } from "@/lib/storage/publicUrl";
import "../info.css";

type Project = { id: string; name: string; slug: string; theme_color?: string; theme?: any };
type Tab = { id: string; project_id: string; title: string; icon?: string };
type Material = { id: string; project_id?: string; tab_id?: string; title: string; cover_image_url?: string; price?: number };

type Props = {
  projects: Project[];
  tabs: Tab[];
  materials: Material[];
  lastUpdateDate: string;
  source?: string;
  sourceId?: string;
};

function toStorageProxyUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (!value) return "";
  if (value.startsWith("/api/storage/public/") || value.startsWith("data:") || value.startsWith("http")) return value;

  const marker = "/storage/v1/object/public/";
  const idx = value.indexOf(marker);
  if (idx === -1) return value;
  const rest = value.slice(idx + marker.length).split("?")[0].split("#")[0];
  const parts = rest.split("/").filter(Boolean);
  const bucket = parts.shift();
  const path = parts.join("/");
  if (!bucket || !path) return value;
  return getStoragePublicUrl(bucket, path);
}

export default function PricingClient({ projects, tabs, materials, lastUpdateDate, source, sourceId }: Props) {
  const [activeProjectId, setActiveProjectId] = useState<string>(projects[0]?.id || "");
  const [activeTabId, setActiveTabId] = useState<string>("all");

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    if (source) q.set("source", source);
    if (sourceId) q.set("sourceId", sourceId);
    const s = q.toString();
    return s ? `?${s}` : "";
  }, [source, sourceId]);

  // Табы текущего проекта
  const currentProjectTabs = useMemo(() => {
    return tabs.filter(t => t.project_id === activeProjectId);
  }, [tabs, activeProjectId]);

  const handleProjectChange = (pid: string) => {
    setActiveProjectId(pid);
    setActiveTabId("all");
  };

  // Фильтрация материалов строго по Проекту И Табу
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      // 1. Проверяем проект
      if (m.project_id !== activeProjectId) return false;
      // 2. Проверяем таб (если не выбрано "Все")
      if (activeTabId !== "all" && m.tab_id !== activeTabId) return false;
      return true;
    });
  }, [materials, activeProjectId, activeTabId]);

  const activeProject = projects.find(p => p.id === activeProjectId);
  const projectColor = activeProject?.theme?.primaryColor || activeProject?.theme_color || "#0ea5e9";

  return (
    <div className="info-wrap">
      <div className="info-shell">
        
        <div className="info-main-card">
          
          <div className="info-topbar">
            <Link className="info-back-btn" href={`/info${qs}`}>
              ← Назад
            </Link>
            
            <div className="info-badge">
              <span className="info-badge-dot" style={{ background: projectColor, boxShadow: `0 0 0 4px ${projectColor}30` }} />
              <div className="info-badge-text">
                Обновлено <span>{lastUpdateDate}</span>
              </div>
            </div>
          </div>

          <h1 className="info-title">Каталог материалов</h1>
          <p className="info-subtitle">
            Выберите направление, чтобы посмотреть доступные учебники, кроссворды и тестирования. 
            Оплата происходит безопасно через QR-код.
          </p>

          {/* ФИЛЬТР 1: ПРОЕКТЫ */}
          {projects.length > 0 && (
            <div className="filter-section">
              <div className="filter-label">Направление:</div>
              <div className="filter-chips">
                {projects.map(p => {
                  const isActive = p.id === activeProjectId;
                  const color = p.theme?.primaryColor || p.theme_color || "#0ea5e9";
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleProjectChange(p.id)}
                      className={`chip-main ${isActive ? "active" : ""}`}
                      style={isActive ? { background: color, borderColor: color } : {}}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ФИЛЬТР 2: ТАБЫ */}
          {currentProjectTabs.length > 0 && (
            <div className="filter-section" style={{ marginTop: 12 }}>
              <div className="filter-label">Раздел:</div>
              <div className="filter-chips">
                <button
                  onClick={() => setActiveTabId("all")}
                  className={`chip-sub ${activeTabId === "all" ? "active" : ""}`}
                  style={activeTabId === "all" ? { background: `${projectColor}15`, color: projectColor, borderColor: projectColor } : {}}
                >
                  Все
                </button>
                {currentProjectTabs.map(t => {
                  const isActive = t.id === activeTabId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTabId(t.id)}
                      className={`chip-sub ${isActive ? "active" : ""}`}
                      style={isActive ? { background: `${projectColor}15`, color: projectColor, borderColor: projectColor } : {}}
                    >
                      {t.icon} {t.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* СЕТКА МАТЕРИАЛОВ */}
          <div className="materials-container">
            {filteredMaterials.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">📭</span>
                <h3>Материалов пока нет</h3>
                <p>В этом разделе еще не добавлены материалы. Выберите другой раздел.</p>
              </div>
            ) : (
              <div className="materials-grid">
                {filteredMaterials.map(m => {
                  const price = m.price || 1000;
                  const cover = toStorageProxyUrl(m.cover_image_url);
                  return (
                    <div key={m.id} className="mat-card">
                      <div className="mat-cover">
                        {cover ? (
                          <img src={cover} alt={m.title} loading="lazy" />
                        ) : (
                          <div className="mat-cover-placeholder">📚</div>
                        )}
                        <div className="mat-price">{price} ₽</div>
                      </div>
                      <div className="mat-body">
                        <div className="mat-title" title={m.title}>{m.title}</div>
                        <div className="mat-desc">Доступ выдается администратором</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ИНФОБЛОКИ */}
          <div className="info-split">
            
            {/* Как оплатить */}
            <div className="info-box">
              <div className="info-box-head">
                <h2>Как оформить доступ</h2>
                <div className="info-box-pill" style={{ color: projectColor, background: `${projectColor}15` }}>Оплата</div>
              </div>
              <div className="steps">
                <div className="step">
                  <div className="step-num" style={{ background: projectColor }}>1</div>
                  <div className="step-text">Сформируйте заявку в личном кабинете. Вы получите <strong>QR-код</strong> для оплаты через СБП.</div>
                </div>
                <div className="step">
                  <div className="step-num" style={{ background: projectColor }}>2</div>
                  <div className="step-text">Оплатите по QR-коду в приложении любого банка.</div>
                </div>
                <div className="step">
                  <div className="step-num" style={{ background: projectColor }}>3</div>
                  <div className="step-text">Обычно доступ открывается в течение <strong>24 часов</strong> после проверки.</div>
                </div>
              </div>
            </div>

            {/* Классы */}
            <div className="info-box">
              <div className="info-box-head">
                <h2>Соответствие по классам</h2>
                <div className="info-box-pill">Автовыдача</div>
              </div>
              <p className="info-box-desc">Система автоматически подберет нужный уровень материалов, если он указан в вашей заявке.</p>
              
              <div className="class-table">
                <div className="class-row">
                  <div className="c-age">1–2 класс</div>
                  <div className="c-val">Baby Hippo • Below Scale</div>
                </div>
                <div className="class-row">
                  <div className="c-age">3–4 класс</div>
                  <div className="c-val">Little Hippo • CEFR A1</div>
                </div>
                <div className="class-row">
                  <div className="c-age">5–6 класс</div>
                  <div className="c-val">Hippo 1 • CEFR A2</div>
                </div>
                <div className="class-row">
                  <div className="c-age">7 класс</div>
                  <div className="c-val">Hippo 2 • CEFR B1</div>
                </div>
                <div className="class-row">
                  <div className="c-age">8–9 класс</div>
                  <div className="c-val">Hippo 3 • CEFR B2</div>
                </div>
                <div className="class-row">
                  <div className="c-age">10–11 класс</div>
                  <div className="c-val">Hippo 4 • CEFR C1</div>
                </div>
              </div>
            </div>

          </div>
        </div>
        
      </div>
    </div>
  );
}