"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import LoadingBlock from "@/components/LoadingBlock";
import ErrorBox from "@/components/ErrorBox";
import type { UserRow } from "./UsersTab";

/* ================= helpers ================= */

type ApiOk<T> = { ok: true } & T;
type ApiErr = { ok: false; error: string; code?: string };

async function safeJson(res: Response) {
  const txt = await res.text();
  if (!txt) return null;
  try { return JSON.parse(txt); } catch { return null; }
}

async function apiGet<T>(url: string): Promise<ApiOk<T>> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await safeJson(res);
  if (!res.ok || !json?.ok) throw new Error((json as ApiErr | null)?.error || `HTTP ${res.status}`);
  return json as ApiOk<T>;
}

async function apiPost<T>(url: string, body: any): Promise<ApiOk<T>> {
  const res = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await safeJson(res);
  if (!res.ok || !json?.ok) throw new Error((json as ApiErr | null)?.error || `HTTP ${res.status}`);
  return json as ApiOk<T>;
}

/* ================= types ================= */

type AccessLoad = {
  textbooks: Array<{ id: string; title: string; class_level: string[] | null }>;
  crosswords: Array<{ id: string; title: string; class_level: string[] | null }>;
  materials: Array<{ id: string; title: string; project_tab_id: string | null; target_levels: string[] | null; class_levels: string[] | null }>;
  projects: Array<{ id: string; name: string; slug: string }>;
  project_tabs: Array<{ id: string; title: string; project_id: string }>;
  selectedTextbookIds: string[];
  selectedCrosswordIds: string[];
  selectedMaterialIds: string[];
};

type Props = {
  open: boolean;
  user: UserRow | null;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
};

/* ================= component ================= */

export default function UserAccessModal({ open, user, onClose, onSaved }: Props) {
  const userId = user?.id ?? null;
  const userName = user?.full_name || user?.email || "Пользователь";

  // Секции: "Новые проекты" или "Старые легаси материалы"
  const [section, setSection] = useState<"projects" | "legacy">("projects");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [textbooks, setTextbooks] = useState<AccessLoad["textbooks"]>([]);
  const [crosswords, setCrosswords] = useState<AccessLoad["crosswords"]>([]);
  const [materials, setMaterials] = useState<AccessLoad["materials"]>([]);
  const [projects, setProjects] = useState<AccessLoad["projects"]>([]);
  const [tabs, setTabs] = useState<AccessLoad["project_tabs"]>([]);

  // Состояния для выпадающих списков
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedTabId, setSelectedTabId] = useState<string>("");

  const [tbChecked, setTbChecked] = useState<Set<string>>(new Set());
  const [cwChecked, setCwChecked] = useState<Set<string>>(new Set());
  const [materialChecked, setMaterialChecked] = useState<Set<string>>(new Set());

  const title = useMemo(() => `🔐 Управление доступом — ${userName}`, [userName]);

  /* ================= load ================= */

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!open || !userId) return;
      setLoading(true);
      setErr(null);

      try {
        const data = await apiGet<AccessLoad>(`/api/admin/users/${encodeURIComponent(userId)}`);
        if (cancelled) return;

        setTextbooks(data.textbooks ?? []);
        setCrosswords(data.crosswords ?? []);
        setMaterials(data.materials ?? []);
        setProjects(data.projects ?? []);
        setTabs(data.project_tabs ?? []);

        setTbChecked(new Set((data.selectedTextbookIds ?? []).map(String)));
        setCwChecked(new Set((data.selectedCrosswordIds ?? []).map(String)));
        setMaterialChecked(new Set((data.selectedMaterialIds ?? []).map(String)));

        // Авто-выбор первого проекта, если они есть
        if (data.projects && data.projects.length > 0) {
          setSelectedProjectId(data.projects[0].id);
        }
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, userId]);

  // Авто-выбор первого таба при смене проекта
  useEffect(() => {
    const projectTabs = tabs.filter(t => t.project_id === selectedProjectId);
    if (projectTabs.length > 0) {
      setSelectedTabId(projectTabs[0].id);
    } else {
      setSelectedTabId("");
    }
  }, [selectedProjectId, tabs]);

  /* ================= save ================= */

  async function save() {
    if (!userId) return;
    setErr(null);
    setLoading(true);

    try {
      const payload = {
        user_id: userId,
        textbook_ids: Array.from(tbChecked),
        crossword_ids: Array.from(cwChecked),
        material_ids: Array.from(materialChecked),
      };

      await apiPost(`/api/admin/users/access`, payload);
      if (onSaved) await onSaved();
      onClose();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // Фильтруем материалы под выбранный таб
  const currentTabMaterials = materials.filter(m => m.project_tab_id === selectedTabId);
  const currentProjectTabs = tabs.filter(t => t.project_id === selectedProjectId);

  /* ================= render ================= */

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={1000}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <button
          className={section === "projects" ? "btn small" : "btn small ghost"}
          type="button"
          onClick={() => setSection("projects")}
        >
          📁 Проекты и Материалы
        </button>
        <button
          className={section === "legacy" ? "btn small" : "btn small ghost"}
          type="button"
          onClick={() => setSection("legacy")}
        >
          🏛️ Легаси (Старые учебники)
        </button>
      </div>

      {loading ? <LoadingBlock text="Загружаем доступы..." /> : null}
      {err ? <ErrorBox message={err} retryMode="none" /> : null}

      {/* =========== НОВАЯ АРХИТЕКТУРА (ПРОЕКТЫ И ТАБЫ) =========== */}
      {!loading && section === "projects" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          
          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: 6 }}>1. Выберите ветку (Проект):</label>
              <select 
                className="input" 
                value={selectedProjectId} 
                onChange={e => setSelectedProjectId(e.target.value)}
                style={{ width: "100%" }}
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: 6 }}>2. Выберите вкладку (Таб):</label>
              <select 
                className="input" 
                value={selectedTabId} 
                onChange={e => setSelectedTabId(e.target.value)}
                style={{ width: "100%" }}
                disabled={currentProjectTabs.length === 0}
              >
                {currentProjectTabs.length === 0 && <option value="">Нет вкладок</option>}
                {currentProjectTabs.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <h3 style={{ margin: "0 0 10px 0" }}>Доступные материалы:</h3>
            <div style={{ display: "grid", gap: 8, maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
              {currentTabMaterials.length === 0 ? (
                <div className="small-muted" style={{ padding: 20, textAlign: "center", background: "#f9fafb", borderRadius: 10 }}>
                  В этом табе пока нет материалов.
                </div>
              ) : (
                currentTabMaterials.map((m) => {
                  const id = String(m.id);
                  const checked = materialChecked.has(id);
                  const levels = [...(m.target_levels || []), ...(m.class_levels || [])];

                  return (
                    <label key={id} style={{
                      display: "flex", gap: 10, alignItems: "center", padding: "10px 12px",
                      borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)",
                      background: checked ? "rgba(99,102,241,0.10)" : "#fff", cursor: "pointer",
                      transition: "all 0.2s"
                    }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setMaterialChecked((prev) => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(id) : next.delete(id);
                            return next;
                          });
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 800 }}>{m.title}</div>
                        <div className="small-muted">
                          {levels.length ? levels.join(", ") : "уровни не указаны"}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========== СТАРАЯ АРХИТЕКТУРА (ЛЕГАСИ) =========== */}
      {!loading && section === "legacy" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <h3 style={{ marginTop: 0 }}>📚 Учебники</h3>
            <div style={{ display: "grid", gap: 8, maxHeight: 380, overflowY: "auto" }}>
              {textbooks.length === 0 ? <div className="small-muted">Нет учебников</div> : textbooks.map((t) => {
                const checked = tbChecked.has(String(t.id));
                return (
                  <label key={t.id} style={{
                    display: "flex", gap: 10, alignItems: "center", padding: "10px 12px",
                    borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)",
                    background: checked ? "rgba(78,205,196,0.10)" : "#fff", cursor: "pointer"
                  }}>
                    <input type="checkbox" checked={checked} onChange={(e) => {
                      setTbChecked(prev => { const n = new Set(prev); e.target.checked ? n.add(t.id) : n.delete(t.id); return n; });
                    }} />
                    <div>
                      <div style={{ fontWeight: 800 }}>{t.title}</div>
                      <div className="small-muted">{t.class_level?.join(", ") || "без класса"}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <div>
            <h3 style={{ marginTop: 0 }}>🧩 Кроссворды</h3>
            <div style={{ display: "grid", gap: 8, maxHeight: 380, overflowY: "auto" }}>
              {crosswords.length === 0 ? <div className="small-muted">Нет кроссвордов</div> : crosswords.map((c) => {
                const checked = cwChecked.has(String(c.id));
                return (
                  <label key={c.id} style={{
                    display: "flex", gap: 10, alignItems: "center", padding: "10px 12px",
                    borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)",
                    background: checked ? "rgba(78,205,196,0.10)" : "#fff", cursor: "pointer"
                  }}>
                    <input type="checkbox" checked={checked} onChange={(e) => {
                      setCwChecked(prev => { const n = new Set(prev); e.target.checked ? n.add(c.id) : n.delete(c.id); return n; });
                    }} />
                    <div>
                      <div style={{ fontWeight: 800 }}>{c.title}</div>
                      <div className="small-muted">{c.class_level?.join(", ") || "без класса"}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button className="btn secondary" onClick={onClose} type="button">
          ❌ Отмена
        </button>
        <button className="btn" onClick={() => void save()} type="button" disabled={loading || !userId}>
          💾 Сохранить доступы
        </button>
      </div>
    </Modal>
  );
}