"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LoadingBlock from "@/components/LoadingBlock";
import ErrorBox from "@/components/ErrorBox";
import ProcessingModal from "./ProcessingModal";

type RequestRow = {
  id: string;
  user_id: string;
  request_number: string | null;
  created_at: string | null;
  processed_at: string | null;
  is_processed: boolean | null;
  full_name: string | null;
  email: string | null;
  class_level: any;
  textbook_types: any;
};

type Stats = { total: number; pending: number; processed: number };

type ApiOkList = { ok: true; requests: RequestRow[]; materialsByUser: Record<string, string[]> };
type ApiOkStats = { ok: true; stats: Stats };
type ApiErr = { ok: false; error: string; code?: string };

async function safeJson(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function fmtDate(v: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return v;
  }
}

function renderClassLevels(class_level: any) {
  const map: Record<string, string> = {
    "1-2": "1-2",
    "3-4": "3-4",
    "5-6": "5-6",
    "7": "7",
    "8-9": "8-9",
    "10-11": "10-11",
    "12": "12",
  };

  const arr = Array.isArray(class_level) ? class_level : class_level ? [class_level] : [];
  if (!arr.length) return <span className="small-muted">—</span>;

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {arr.map((c: any, i: number) => (
        <span
          key={i}
          className="badge"
          style={{
            fontSize: 12,
            padding: "4px 8px",
            background: "rgba(78,205,196,0.14)",
            color: "var(--accent2)",
          }}
        >
          {map[String(c)] ?? String(c)}
        </span>
      ))}
    </div>
  );
}

function renderTypes(textbook_types: any) {
  const arr = Array.isArray(textbook_types) ? textbook_types : textbook_types ? [textbook_types] : [];
  if (!arr.length) return <span className="small-muted">—</span>;

  const map: Record<string, string> = { учебник: "📚 Учебник", кроссворд: "🧩 Кроссворд" };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {arr.map((t: any, i: number) => (
        <span key={i} className="small-muted" style={{ fontWeight: 900 }}>
          {map[String(t).toLowerCase()] ?? String(t)}
        </span>
      ))}
    </div>
  );
}

export default function RequestsTab({ onPendingChanged }: { onPendingChanged?: (pending: number) => void }) {
  const [tab, setTab] = useState<"all" | "pending" | "processed">("all");

  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, processed: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsErr, setStatsErr] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<RequestRow[]>([]);
  const [materialsByUser, setMaterialsByUser] = useState<Record<string, string[]>>({});

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectionRef = useRef(selected);
  selectionRef.current = selected;

  // ✅ модалка процесса (обработка/возврат)
  const [processingOpen, setProcessingOpen] = useState(false);
  const [processingMode, setProcessingMode] = useState<"process" | "unprocess">("process");

  const tabs = useMemo(
    () => [
      { key: "all" as const, label: "📋 Все заявки" },
      { key: "pending" as const, label: "⏳ Ожидающие" },
      { key: "processed" as const, label: "✅ Обработанные" },
    ],
    []
  );

  async function loadStats() {
    setStatsLoading(true);
    setStatsErr(null);

    try {
      const res = await fetch("/api/admin/requests/stats", { cache: "no-store" });
      const json = (await safeJson(res)) as ApiOkStats | ApiErr | null;
      if (!res.ok || !json) throw new Error(`HTTP ${res.status}`);
      if (!json.ok) throw new Error((json as ApiErr).error || "Не удалось загрузить статистику заявок");

      setStats(json.stats);
      onPendingChanged?.(json.stats.pending);
    } catch (e: any) {
      setStatsErr(e?.message || String(e));
      setStats({ total: 0, pending: 0, processed: 0 });
      onPendingChanged?.(0);
    } finally {
      setStatsLoading(false);
    }
  }

  async function loadList() {
    setLoading(true);
    setErr(null);

    try {
      const qs = new URLSearchParams();
      qs.set("status", tab);
      if (name.trim()) qs.set("name", name.trim());
      if (email.trim()) qs.set("email", email.trim());
      if (tab === "processed") qs.set("includeMaterials", "1");

      const res = await fetch(`/api/admin/requests?${qs.toString()}`, { cache: "no-store" });
      const json = (await safeJson(res)) as ApiOkList | ApiErr | null;
      if (!res.ok || !json) throw new Error(`HTTP ${res.status}`);
      if (!json.ok) throw new Error((json as ApiErr).error || "Не удалось загрузить заявки");

      setRows(json.requests ?? []);
      setMaterialsByUser(json.materialsByUser ?? {});
      setSelected(new Set());
    } catch (e: any) {
      setErr(e?.message || String(e));
      setRows([]);
      setMaterialsByUser({});
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  }

  async function patchRequests(ids: string[], is_processed: boolean, confirmBulk: boolean) {
    if (!ids.length) return;

    if (confirmBulk) {
      const ok = window.confirm(
        is_processed
          ? `Обработать выбранные заявки: ${ids.length}? (выдаст доступы)`
          : `Вернуть выбранные заявки в ожидание: ${ids.length}? (откатит доступы, выданные вами)`
      );
      if (!ok) return;
    }

    // ✅ показываем модалку процесса
    setProcessingMode(is_processed ? "process" : "unprocess");
    setProcessingOpen(true);

    setLoading(true);
    setErr(null);

    try {
      const res = await fetch("/api/admin/requests", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids, is_processed }),
      });
      const json = (await safeJson(res)) as { ok: boolean; error?: string } | null;

      if (!res.ok || !json) throw new Error(`HTTP ${res.status}`);
      if (!json.ok) throw new Error(json.error || "Не удалось обновить заявки");

      await Promise.all([loadStats(), loadList()]);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
      // ✅ скрываем модалку процесса ТОЛЬКО после завершения
      setProcessingOpen(false);
    }
  }

  // single action: БЕЗ доп-меню/confirm
  async function oneUpdate(id: string, is_processed: boolean) {
    await patchRequests([id], is_processed, false);
  }

  // bulk actions (confirm оставляем)
  async function bulkProcess() {
    const ids = Array.from(selectionRef.current);
    await patchRequests(ids, true, true);
  }

  async function bulkUnprocess() {
    const ids = Array.from(selectionRef.current);
    await patchRequests(ids, false, true);
  }

  useEffect(() => {
    void loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // debounce
  useEffect(() => {
    const t = setTimeout(() => void loadList(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, email]);

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (checked) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  const allChecked = rows.length > 0 && selected.size === rows.length;

  // bulk bar buttons by tab
  const showBulkProcess = tab === "all" || tab === "pending";
  const showBulkUnprocess = tab === "all" || tab === "processed";

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ marginTop: 0 }}>📋 Управление заявками</h3>
          <div className="small-muted">Заявки на доступ к материалам (учебники / кроссворды).</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn small" type="button" onClick={() => void Promise.all([loadStats(), loadList()])}>
            🔄 Обновить
          </button>
        </div>
      </div>

      <div style={{ height: 12 }} />

      {statsLoading ? <LoadingBlock text="Загружаем статистику заявок..." /> : null}
      {statsErr ? <ErrorBox message={statsErr} /> : null}

      {!statsLoading && !statsErr ? (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="admin-stat" style={{ flex: "1 1 160px" }}>
            <div className="num">{stats.total}</div>
            <div className="lbl">Всего заявок</div>
          </div>
          <div className="admin-stat" style={{ flex: "1 1 160px", borderLeftColor: "var(--accent)" }}>
            <div className="num" style={{ color: "var(--accent)" }}>
              {stats.pending}
            </div>
            <div className="lbl">Ожидают</div>
          </div>
          <div className="admin-stat" style={{ flex: "1 1 160px" }}>
            <div className="num">{stats.processed}</div>
            <div className="lbl">Обработано</div>
          </div>
        </div>
      ) : null}

      <div style={{ height: 14 }} />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? "btn" : "btn ghost"}
            onClick={() => setTab(t.key)}
            style={{ fontWeight: 900 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ height: 14 }} />

      {/* bulk bar */}
      {selected.size ? (
        <div
          className="card"
          style={{
            background: "rgba(78,205,196,0.10)",
            border: "1px solid rgba(78,205,196,0.22)",
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900 }}>
              Выбрано: <span style={{ color: "var(--accent2)" }}>{selected.size}</span>
            </div>

            {showBulkProcess ? (
              <button className="btn small" type="button" onClick={() => void bulkProcess()} disabled={loading}>
                ✅ Обработать выделенные
              </button>
            ) : null}

            {showBulkUnprocess ? (
              <button className="btn small" type="button" onClick={() => void bulkUnprocess()} disabled={loading}>
                ↩️ Вернуть в необработанные
              </button>
            ) : null}

            <button
              className="btn small secondary"
              type="button"
              onClick={() => setSelected(new Set())}
              disabled={loading}
            >
              ❌ Отменить выделение
            </button>
          </div>
        </div>
      ) : null}

      {/* filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <div className="form-group" style={{ marginBottom: 0, flex: "1 1 260px" }}>
          <label>Поиск по имени</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ФИО..." />
        </div>

        <div className="form-group" style={{ marginBottom: 0, flex: "1 1 260px" }}>
          <label>Поиск по email</label>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email..." />
        </div>

        <button
          className="btn small secondary"
          type="button"
          onClick={() => {
            setName("");
            setEmail("");
          }}
        >
          🗑️ Очистить
        </button>
      </div>

      <div style={{ height: 14 }} />

      {loading ? <LoadingBlock text="Загружаем заявки..." /> : null}
      {err ? <ErrorBox message={err} /> : null}

      {!loading && !err ? (
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 44 }}>
                  <input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} />
                </th>
                <th>№</th>
                <th>Номер</th>
                <th>Создана</th>
                {tab === "processed" ? <th>Обработана</th> : null}
                <th>Классы</th>
                <th>Типы</th>
                <th>Email</th>
                <th>ФИО</th>
                {tab === "processed" ? <th>Выданные материалы</th> : tab === "all" ? <th>Статус</th> : null}
                <th>Действия</th>
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={tab === "processed" ? 11 : tab === "all" ? 11 : 10}
                    style={{ padding: 16, textAlign: "center" }}
                  >
                    <div className="small-muted" style={{ fontWeight: 800 }}>
                      Заявок не найдено
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => {
                  const checked = selected.has(r.id);
                  const status = Boolean(r.is_processed);

                  return (
                    <tr key={r.id}>
                      <td>
                        <input type="checkbox" checked={checked} onChange={(e) => toggleOne(r.id, e.target.checked)} />
                      </td>
                      <td>
                        <strong>{idx + 1}</strong>
                      </td>
                      <td>
                        <strong>{r.request_number ?? "—"}</strong>
                      </td>
                      <td>{fmtDate(r.created_at)}</td>
                      {tab === "processed" ? <td>{fmtDate(r.processed_at)}</td> : null}
                      <td>{renderClassLevels(r.class_level)}</td>
                      <td>{renderTypes(r.textbook_types)}</td>
                      <td>{r.email ?? "—"}</td>
                      <td>{r.full_name ?? "—"}</td>

                      {tab === "processed" ? (
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {(materialsByUser?.[r.user_id] ?? []).length ? (
                              (materialsByUser[r.user_id] ?? []).map((m, i) => (
                                <div key={i} className="small-muted" style={{ fontWeight: 800 }}>
                                  {m}
                                </div>
                              ))
                            ) : (
                              <span className="small-muted">—</span>
                            )}
                          </div>
                        </td>
                      ) : tab === "all" ? (
                        <td>
                          <span
                            className="small-muted"
                            style={{ fontWeight: 900, color: status ? "#2e7d32" : "#856404" }}
                          >
                            {status ? "✅ Обработана" : "⏳ Ожидает"}
                          </span>
                        </td>
                      ) : null}

                      <td>
                        {!status ? (
                          <button
                            className="btn small"
                            type="button"
                            onClick={() => void oneUpdate(r.id, true)}
                            disabled={loading}
                          >
                            ✅ Обработать
                          </button>
                        ) : (
                          <button
                            className="btn small"
                            type="button"
                            onClick={() => void oneUpdate(r.id, false)}
                            disabled={loading}
                          >
                            ↩️ Вернуть
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* ✅ Модалка процесса (поверх всего, без закрытия) */}
      <ProcessingModal open={processingOpen} mode={processingMode} />
    </div>
  );
}
