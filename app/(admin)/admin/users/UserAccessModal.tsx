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
  materials: Array<{ id: string; title: string; project_tab_id: string | null; target_levels: string[] | null; class_levels: string[] | null }>;
  projects: Array<{ id: string; name: string; slug: string }>;
  project_tabs: Array<{ id: string; title: string; project_id: string }>;
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

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [materials, setMaterials] = useState<AccessLoad["materials"]>([]);
  const [projects, setProjects] = useState<AccessLoad["projects"]>([]);
  const [tabs, setTabs] = useState<AccessLoad["project_tabs"]>([]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedTabId, setSelectedTabId] = useState<string>("");

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

        setMaterials(data.materials ?? []);
        setProjects(data.projects ?? []);
        setTabs(data.project_tabs ?? []);

        setMaterialChecked(new Set((data.selectedMaterialIds ?? []).map(String)));

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

  const currentTabMaterials = materials.filter(m => m.project_tab_id === selectedTabId);
  const currentProjectTabs = tabs.filter(t => t.project_id === selectedProjectId);

  /* ================= render ================= */

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={960}>
      {loading ? <LoadingBlock text="Загружаем доступы..." /> : null}
      {err ? <ErrorBox message={err} retryMode="none" /> : null}

      {/* =========== НОВАЯ АРХИТЕКТУРА (ПРОЕКТЫ И ТАБЫ) =========== */}
      {!loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontWeight: 800, fontSize: 13, color: "#1e293b", marginBottom: 6 }}>
                1. Выберите ветку (Проект):
              </label>
              <select 
                className="input" 
                value={selectedProjectId} 
                onChange={e => setSelectedProjectId(e.target.value)}
                style={{ width: "100%", background: "#ffffff", color: "#0f172a" }}
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 800, fontSize: 13, color: "#1e293b", marginBottom: 6 }}>
                2. Выберите вкладку (Таб):
              </label>
              <select 
                className="input" 
                value={selectedTabId} 
                onChange={e => setSelectedTabId(e.target.value)}
                style={{ width: "100%", background: "#ffffff", color: "#0f172a" }}
                disabled={currentProjectTabs.length === 0}
              >
                {currentProjectTabs.length === 0 && <option value="">Нет вкладок</option>}
                {currentProjectTabs.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 15, fontWeight: 800, color: "#0f172a" }}>
              Доступные материалы:
            </h3>
            
            <div style={{ display: "grid", gap: 10, maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
              {currentTabMaterials.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", background: "#f8fafc", borderRadius: 12, border: "1px dashed #cbd5e1", color: "#64748b", fontWeight: 600, fontSize: 13 }}>
                  В этом табе пока нет материалов.
                </div>
              ) : (
                currentTabMaterials.map((m) => {
                  const id = String(m.id);
                  const checked = materialChecked.has(id);
                  const levels = [...(m.target_levels || []), ...(m.class_levels || [])];

                  return (
                    <label 
                      key={id} 
                      className={`access-item ${checked ? "active" : ""}`}
                      style={{
                        display: "flex", 
                        gap: 12, 
                        alignItems: "center", 
                        padding: "12px 14px",
                        borderRadius: 12, 
                        border: checked ? "1px solid #0ea5e9" : "1px solid #e2e8f0",
                        background: checked ? "#f0f9ff" : "#f8fafc", 
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        style={{ width: 18, height: 18, accentColor: "#0ea5e9" }}
                        onChange={(e) => {
                          setMaterialChecked((prev) => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(id) : next.delete(id);
                            return next;
                          });
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 800, color: checked ? "#0284c7" : "#0f172a", fontSize: 14 }}>
                          {m.title}
                        </div>
                        <div className="small-muted" style={{ fontSize: 12, marginTop: 2 }}>
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

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: 10 }}>
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