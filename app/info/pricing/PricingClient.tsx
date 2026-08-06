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

// Хелпер для ссылок на картинки
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
  // Состояния фильтров
  const [activeProjectId, setActiveProjectId] = useState<string>(projects[0]?.id || "");
  const [activeTabId, setActiveTabId] = useState<string>("all");

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    if (source) q.set("source", source);
    if (sourceId) q.set("sourceId", sourceId);
    const s = q.toString();
    return s ? `?${s}` : "";
  }, [source, sourceId]);

  // Выборка табов для текущего проекта
  const currentProjectTabs = useMemo(() => {
    return tabs.filter(t => t.project_id === activeProjectId);
  }, [tabs, activeProjectId]);

  // Смена проекта (сбрасываем таб на "all")
  const handleProjectChange = (pid: string) => {
    setActiveProjectId(pid);
    setActiveTabId("all");
  };

  // Фильтрация материалов
  const filteredMaterials = useMemo(() => {
    return materials.filter(m => {
      // Поддержка legacy (если проект = olympiad, показываем старые захардкоженные заглушки, 
      // но в идеале они тоже будут браться из базы по project_id)
      if (m.project_id !== activeProjectId) return false;
      if (activeTabId !== "all" && m.tab_id !== activeTabId) return false;
      return true;
    });
  }, [materials, activeProjectId, activeTabId]);

  const activeProject = projects.find(p => p.id === activeProjectId);
  const projectColor = activeProject?.theme?.primaryColor || activeProject?.theme_color || "#4ecdc4";

  return (
    <div className="info-wrap">
      <div className="info-shell">
        <section className="info-hero">
          <div className="info-topbar">
            <div className="info-badge">
              <span className="info-badge-dot" style={{ background: projectColor, boxShadow: `0 0 0 6px ${projectColor}30` }} />
              <div className="info-badge-text">
                <strong>Прайс актуален на</strong>
                <span>{lastUpdateDate}</span>
              </div>
            </div>
            <div className="info-note">
              Оплата по QR в заявке. Проверяем вручную и выдаём доступ в течение 24 часов.
            </div>
          </div>

          <h1 className="info-title">Каталог материалов</h1>
          <p className="info-subtitle">
            Выберите интересующее вас направление и раздел ниже, чтобы ознакомиться с доступными материалами и их стоимостью.
          </p>

          {/* 1. ФИЛЬТР: ПРОЕКТЫ */}
          {projects.length > 0 && (
            <div className="premium-filter-group" style={{ marginTop: 24 }}>
              <div className="filter-label">Направление:</div>
              <div className="filter-chips">
                {projects.map(p => {
                  const isActive = p.id === activeProjectId;
                  const color = p.theme?.primaryColor || p.theme_color || "#4ecdc4";
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleProjectChange(p.id)}
                      className={`filter-chip ${isActive ? "active" : ""}`}
                      style={isActive ? { background: color, borderColor: color } : {}}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. ФИЛЬТР: ТАБЫ (Отображается только если у проекта есть табы) */}
          {currentProjectTabs.length > 0 && (
            <div className="premium-filter-group">
              <div className="filter-label">Раздел:</div>
              <div className="filter-chips">
                <button
                  onClick={() => setActiveTabId("all")}
                  className={`filter-chip ${activeTabId === "all" ? "active" : ""}`}
                  style={activeTabId === "all" ? { background: projectColor, borderColor: projectColor } : {}}
                >
                  Все материалы
                </button>
                {currentProjectTabs.map(t => {
                  const isActive = t.id === activeTabId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTabId(t.id)}
                      className={`filter-chip ${isActive ? "active" : ""}`}
                      style={isActive ? { background: projectColor, borderColor: projectColor } : {}}
                    >
                      {t.icon} {t.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. СЕТКА МАТЕРИАЛОВ */}
          <div className="pricing-wrap" style={{ marginTop: 24 }}>
            {filteredMaterials.length === 0 ? (
              <div className="empty-materials">
                <span className="empty-icon">📭</span>
                В этом разделе пока нет добавленных материалов.
              </div>
            ) : (
              <div className="premium-materials-grid">
                {filteredMaterials.map(m => {
                  const price = m.price || 1000;
                  const cover = toStorageProxyUrl(m.cover_image_url);
                  return (
                    <div key={m.id} className="pmc-card">
                      <div className="pmc-cover">
                        {cover ? (
                          <img src={cover} alt={m.title} loading="lazy" />
                        ) : (
                          <div className="pmc-cover-placeholder">📚</div>
                        )}
                        <div className="pmc-price-badge">{price} ₽</div>
                      </div>
                      <div className="pmc-body">
                        <div className="pmc-title" title={m.title}>{m.title}</div>
                        <div className="pmc-meta">Доступ после проверки оплаты</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 4. ИНФОБЛОКИ (КАК РАБОТАЕТ И КЛАССЫ) */}
            <div className="info-split-grid" style={{ marginTop: 40 }}>
              
              {/* Левый блок: Инструкция */}
              <div className="section-card premium-info-box">
                <div className="section-head">
                  <h2>Как оформить доступ</h2>
                  <div className="pill" style={{ color: projectColor, background: `${projectColor}15`, borderColor: `${projectColor}30` }}>важно</div>
                </div>
                <div className="steps-list">
                  <div className="step-item">
                    <div className="step-number" style={{ background: projectColor }}>1</div>
                    <div className="step-text">Создайте заявку в личном кабинете и выберите нужные материалы. Вы получите <strong>QR-код</strong> для оплаты.</div>
                  </div>
                  <div className="step-item">
                    <div className="step-number" style={{ background: projectColor }}>2</div>
                    <div className="step-text">Оплатите по QR-коду через мобильное приложение любого банка (СБП).</div>
                  </div>
                  <div className="step-item">
                    <div className="step-number" style={{ background: projectColor }}>3</div>
                    <div className="step-text">Мы вручную проверяем поступление средств. Доступ открывается в течение <strong>24 часов</strong>.</div>
                  </div>
                </div>
              </div>

              {/* Правый блок: Соответствие */}
              <div className="section-card premium-info-box">
                <div className="section-head">
                  <h2>Материалы по классам</h2>
                  <div className="pill">автовыдача</div>
                </div>
                <p style={{ fontSize: 13, color: "#64748b", margin: "10px 0 16px" }}>
                  Система автоматически подбирает учебник и проверочный кроссворд в зависимости от указанного в заявке класса.
                </p>
                <div className="classes-grid">
                  <div className="class-row">
                    <div className="class-age">1–2 класс</div>
                    <div className="class-mats">Учебник: <strong>Baby Hippo</strong><br/>Кроссворд: <strong>Below Scale</strong></div>
                  </div>
                  <div className="class-row">
                    <div className="class-age">3–4 класс</div>
                    <div className="class-mats">Учебник: <strong>Little Hippo</strong><br/>Кроссворд: <strong>CEFR A1</strong></div>
                  </div>
                  <div className="class-row">
                    <div className="class-age">5–6 класс</div>
                    <div className="class-mats">Учебник: <strong>Hippo 1</strong><br/>Кроссворд: <strong>CEFR A2</strong></div>
                  </div>
                  <div className="class-row">
                    <div className="class-age">7 класс</div>
                    <div className="class-mats">Учебник: <strong>Hippo 2</strong><br/>Кроссворд: <strong>CEFR B1</strong></div>
                  </div>
                  <div className="class-row">
                    <div className="class-age">8–9 класс</div>
                    <div className="class-mats">Учебник: <strong>Hippo 3</strong><br/>Кроссворд: <strong>CEFR B2</strong></div>
                  </div>
                  <div className="class-row">
                    <div className="class-age">10–11 класс</div>
                    <div className="class-mats">Учебник: <strong>Hippo 4</strong><br/>Кроссворд: <strong>CEFR C1</strong></div>
                  </div>
                </div>
              </div>

            </div>

            <div className="back-row" style={{ marginTop: 24, textAlign: "center" }}>
              <Link className="back-link" href={`/info${qs}`}>
                ← Назад к информации
              </Link>
            </div>
            
          </div>
        </section>
      </div>
    </div>
  );
}