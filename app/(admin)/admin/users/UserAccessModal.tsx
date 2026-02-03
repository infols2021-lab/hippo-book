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
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

async function apiGet<T>(url: string): Promise<ApiOk<T>> {
  const res = await fetch(url, { cache: "no-store" });
  const json = await safeJson(res);
  if (!res.ok || !json?.ok) {
    const msg = (json as ApiErr | null)?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
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
  if (!res.ok || !json?.ok) {
    const msg = (json as ApiErr | null)?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json as ApiOk<T>;
}

/* ================= types ================= */

type AccessLoad = {
  textbooks: Array<{ id: string; title: string; class_level: string[] | null }>;
  crosswords: Array<{ id: string; title: string; class_level: string[] | null }>;
  selectedTextbookIds: string[];
  selectedCrosswordIds: string[];
};

type Props = {
  open: boolean;

  /** 🔥 ВАЖНО: теперь принимаем user как в UsersTab */
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

  const [textbooks, setTextbooks] = useState<AccessLoad["textbooks"]>([]);
  const [crosswords, setCrosswords] = useState<AccessLoad["crosswords"]>([]);
  const [tbChecked, setTbChecked] = useState<Set<string>>(new Set());
  const [cwChecked, setCwChecked] = useState<Set<string>>(new Set());

  const title = useMemo(
    () => `🔐 Управление доступом — ${userName}`,
    [userName]
  );

  /* ================= load ================= */

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!open || !userId) return;

      setLoading(true);
      setErr(null);

      try {
        const data = await apiGet<AccessLoad>(
          `/api/admin/users/${encodeURIComponent(userId)}`
        );
        if (cancelled) return;

        setTextbooks(data.textbooks ?? []);
        setCrosswords(data.crosswords ?? []);
        setTbChecked(new Set((data.selectedTextbookIds ?? []).map(String)));
        setCwChecked(new Set((data.selectedCrosswordIds ?? []).map(String)));
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message || String(e));
        setTextbooks([]);
        setCrosswords([]);
        setTbChecked(new Set());
        setCwChecked(new Set());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, userId]);

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

  /* ================= render ================= */

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={900}>
      {loading ? <LoadingBlock text="Загружаем доступы..." /> : null}
      {err ? <ErrorBox message={err} retryMode="none" /> : null}

      {!loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* ---------- textbooks ---------- */}
          <div>
            <h3 style={{ marginTop: 0 }}>📚 Учебники</h3>

            <div style={{ display: "grid", gap: 8, maxHeight: 380, overflowY: "auto" }}>
              {textbooks.length === 0 ? (
                <div className="small-muted">Нет учебников</div>
              ) : (
                textbooks.map((t) => {
                  const id = String(t.id);
                  const checked = tbChecked.has(id);

                  return (
                    <label
                      key={id}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.08)",
                        background: checked ? "rgba(78,205,196,0.10)" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setTbChecked((prev) => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(id) : next.delete(id);
                            return next;
                          });
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 800 }}>{t.title}</div>
                        <div className="small-muted">
                          {Array.isArray(t.class_level) ? t.class_level.join(", ") : "без класса"}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* ---------- crosswords ---------- */}
          <div>
            <h3 style={{ marginTop: 0 }}>🧩 Кроссворды</h3>

            <div style={{ display: "grid", gap: 8, maxHeight: 380, overflowY: "auto" }}>
              {crosswords.length === 0 ? (
                <div className="small-muted">Нет кроссвордов</div>
              ) : (
                crosswords.map((c) => {
                  const id = String(c.id);
                  const checked = cwChecked.has(id);

                  return (
                    <label
                      key={id}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(0,0,0,0.08)",
                        background: checked ? "rgba(78,205,196,0.10)" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setCwChecked((prev) => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(id) : next.delete(id);
                            return next;
                          });
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 800 }}>{c.title}</div>
                        <div className="small-muted">
                          {Array.isArray(c.class_level) ? c.class_level.join(", ") : "без класса"}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button className="btn secondary" onClick={onClose} type="button">
          ❌ Закрыть
        </button>
        <button className="btn" onClick={() => void save()} type="button" disabled={loading || !userId}>
          💾 Сохранить
        </button>
      </div>
    </Modal>
  );
}
