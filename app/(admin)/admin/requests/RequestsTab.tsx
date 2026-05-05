"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LoadingBlock from "@/components/LoadingBlock";
import ErrorBox from "@/components/ErrorBox";
import ProcessingModal from "./ProcessingModal";

type BranchFilter = "all" | "olympiad" | "gatehouse";

type RequestRow = {
  id: string;
  user_id: string;
  request_number: string | null;
  created_at: string | null;
  processed_at: string | null;
  is_processed: boolean | null;
  full_name: string | null;
  email: string | null;
  contact_phone?: string | null;
  branch_type?: string | null;
  class_level: any;
  target_level?: any;
  target_levels?: any;
  textbook_types: any;
  material_kinds?: any;
};

type Stats = { total: number; pending: number; processed: number };

type PageCursor = {
  created_at: string;
} | null;

type ApiOkList = {
  ok: true;
  requests: RequestRow[];
  materialsByRequest?: Record<string, string[]>;
  materialsError?: string | null;
  page?: {
    limit: number;
    returned: number;
    hasMore: boolean;
    nextCursor?: PageCursor;
  };
};

type ApiOkGrants = {
  ok: true;
  materialsByRequest: Record<string, string[]>;
  materialsError?: string | null;
};

type ApiOkStats = { ok: true; stats: Stats };
type ApiErr = { ok: false; error: string; code?: string };

const PAGE_SIZE = 10;

async function safeJson(res: Response) {
  const t = await res.text();

  if (!t) return null;

  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function arrOf(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((x) => x.trim()).filter(Boolean);
  return [String(v).trim()].filter(Boolean);
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

function branchOf(row: RequestRow) {
  const raw = String(row.branch_type || "olympiad").toLowerCase();

  if (raw === "gatehouse" || raw === "ga_exam" || raw === "ga" || raw === "exam" || raw === "gatehouse_awards") {
    return "gatehouse";
  }

  return "olympiad";
}

function renderBranch(row: RequestRow) {
  const branch = branchOf(row);

  return (
    <span className={`admin-request-branch admin-request-branch--${branch}`}>
      {branch === "gatehouse" ? "🎓 Экзамены" : "🏆 Олимпиада"}
    </span>
  );
}

function renderClassLevels(row: RequestRow) {
  const branch = branchOf(row);

  if (branch === "gatehouse") {
    const targetLevels = arrOf(row.target_levels);
    const arr = targetLevels.length ? targetLevels : arrOf(row.target_level);

    if (!arr.length) return <span className="small-muted">—</span>;

    return (
      <div className="admin-request-chips">
        {arr.map((level, i) => (
          <span key={`${level}-${i}`} className="admin-request-chip admin-request-chip--gatehouse">
            {level}
          </span>
        ))}
      </div>
    );
  }

  const map: Record<string, string> = {
    "1-2": "1-2",
    "3-4": "3-4",
    "5-6": "5-6",
    "7": "7",
    "8-9": "8-9",
    "10-11": "10-11",
    "12": "12",
  };

  const arr = arrOf(row.class_level);

  if (!arr.length) return <span className="small-muted">—</span>;

  return (
    <div className="admin-request-chips">
      {arr.map((c, i) => (
        <span key={`${c}-${i}`} className="admin-request-chip admin-request-chip--olympiad">
          {map[String(c)] ?? String(c)}
        </span>
      ))}
    </div>
  );
}

function renderTypes(row: RequestRow) {
  const branch = branchOf(row);
  const materialKinds = arrOf(row.material_kinds);
  const source = branch === "gatehouse" && materialKinds.length ? materialKinds : row.textbook_types;
  const arr = arrOf(source);

  if (!arr.length) return <span className="small-muted">—</span>;

  const olympiadMap: Record<string, string> = {
    учебник: "📚 Учебник",
    кроссворд: "🧩 Кроссворд",
    textbook: "📚 Учебник",
    crossword: "🧩 Кроссворд",
  };

  const gatehouseMap: Record<string, string> = {
    mock_test: "📝 Пробные тесты",
    mock_tests: "📝 Пробные тесты",
    "mock-test": "📝 Пробные тесты",
    "mock test": "📝 Пробные тесты",
    "мок-тест": "📝 Пробные тесты",
    "мок тест": "📝 Пробные тесты",
    "пробный тест": "📝 Пробные тесты",
    "пробные тесты": "📝 Пробные тесты",
  };

  const map = branch === "gatehouse" ? gatehouseMap : olympiadMap;

  return (
    <div className="admin-request-type-list">
      {arr.map((t, i) => (
        <span key={`${t}-${i}`} className="admin-request-type">
          {map[String(t).toLowerCase()] ?? String(t)}
        </span>
      ))}
    </div>
  );
}

function renderGrantedMaterials(items: string[] | undefined) {
  const arr = Array.isArray(items) ? items : [];

  if (!arr.length) return <span className="small-muted">—</span>;

  return (
    <div className="admin-request-grants">
      {arr.map((m, i) => (
        <div key={`${m}-${i}`} className="admin-request-grant">
          {m}
        </div>
      ))}
    </div>
  );
}

function isAbortError(e: any) {
  return e?.name === "AbortError";
}

export default function RequestsTab({ onPendingChanged }: { onPendingChanged?: (pending: number) => void }) {
  const [tab, setTab] = useState<"all" | "pending" | "processed">("all");
  const [branchFilter, setBranchFilter] = useState<BranchFilter>("all");

  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, processed: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsErr, setStatsErr] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [materialsWarning, setMaterialsWarning] = useState<string | null>(null);

  const [rows, setRows] = useState<RequestRow[]>([]);
  const [materialsByRequest, setMaterialsByRequest] = useState<Record<string, string[]>>({});
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<PageCursor>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectionRef = useRef(selected);
  selectionRef.current = selected;

  const statsSeqRef = useRef(0);
  const listSeqRef = useRef(0);
  const statsAbortRef = useRef<AbortController | null>(null);
  const listAbortRef = useRef<AbortController | null>(null);
  const grantsAbortRef = useRef<AbortController | null>(null);
  const searchMountedRef = useRef(false);

  const [processingOpen, setProcessingOpen] = useState(false);
  const [processingMode, setProcessingMode] = useState<"process" | "unprocess">("process");

  const tabs = useMemo(
    () => [
      { key: "all" as const, label: "📋 Все заявки" },
      { key: "pending" as const, label: "⏳ Ожидающие" },
      { key: "processed" as const, label: "✅ Обработанные" },
    ],
    [],
  );

  const branchTabs = useMemo(
    () => [
      { key: "all" as const, label: "Все разделы" },
      { key: "olympiad" as const, label: "🏆 Олимпиада" },
      { key: "gatehouse" as const, label: "🎓 Экзамены" },
    ],
    [],
  );

  async function loadStats() {
    const seq = ++statsSeqRef.current;
    const branchAtStart = branchFilter;

    statsAbortRef.current?.abort();

    const controller = new AbortController();
    statsAbortRef.current = controller;

    setStatsLoading(true);
    setStatsErr(null);

    try {
      const qs = new URLSearchParams();
      if (branchAtStart !== "all") qs.set("branch_type", branchAtStart);

      const res = await fetch(`/api/admin/requests/stats?${qs.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      const json = (await safeJson(res)) as ApiOkStats | ApiErr | null;

      if (seq !== statsSeqRef.current) return;

      if (!res.ok || !json) throw new Error(`HTTP ${res.status}`);
      if (!json.ok) throw new Error((json as ApiErr).error || "Не удалось загрузить статистику заявок");

      setStats(json.stats);
      onPendingChanged?.(json.stats.pending);
    } catch (e: any) {
      if (isAbortError(e)) return;
      if (seq !== statsSeqRef.current) return;

      setStatsErr(e?.message || String(e));
      setStats({ total: 0, pending: 0, processed: 0 });
      onPendingChanged?.(0);
    } finally {
      if (seq === statsSeqRef.current) setStatsLoading(false);
      if (statsAbortRef.current === controller) statsAbortRef.current = null;
    }
  }

  async function loadMaterialsForRows(rowsToLoad: RequestRow[], reset: boolean) {
    if (tab !== "processed") return;

    const ids = rowsToLoad.map((r) => r.id).filter(Boolean);
    if (!ids.length) return;

    grantsAbortRef.current?.abort();

    const controller = new AbortController();
    grantsAbortRef.current = controller;

    try {
      const res = await fetch("/api/admin/requests/grants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
        signal: controller.signal,
      });

      const json = (await safeJson(res)) as ApiOkGrants | ApiErr | null;

      if (!res.ok || !json) throw new Error(`HTTP ${res.status}`);
      if (!json.ok) throw new Error((json as ApiErr).error || "Не удалось загрузить выданные материалы");

      setMaterialsByRequest((prev) => ({
        ...(reset ? {} : prev),
        ...((json as ApiOkGrants).materialsByRequest ?? {}),
      }));

      if ((json as ApiOkGrants).materialsError) {
        setMaterialsWarning(`Заявки загружены, но выданные материалы временно не подтянулись: ${(json as ApiOkGrants).materialsError}`);
      }
    } catch (e: any) {
      if (isAbortError(e)) return;

      setMaterialsWarning(`Заявки загружены, но выданные материалы временно не подтянулись: ${e?.message || String(e)}`);
    } finally {
      if (grantsAbortRef.current === controller) grantsAbortRef.current = null;
    }
  }

  async function loadList(reset = true) {
    const seq = ++listSeqRef.current;

    const tabAtStart = tab;
    const branchAtStart = branchFilter;
    const nameAtStart = name.trim();
    const emailAtStart = email.trim();
    const cursorAtStart = reset ? null : nextCursor;

    listAbortRef.current?.abort();

    const controller = new AbortController();
    listAbortRef.current = controller;

    if (reset) {
      setLoading(true);
      setRows([]);
      setMaterialsByRequest({});
      setSelected(new Set());
      setHasMore(false);
      setNextCursor(null);
    } else {
      setLoadingMore(true);
    }

    setErr(null);
    setMaterialsWarning(null);

    try {
      const qs = new URLSearchParams();
      qs.set("status", tabAtStart);
      qs.set("limit", String(PAGE_SIZE));

      if (cursorAtStart?.created_at) qs.set("cursor_created_at", cursorAtStart.created_at);
      if (branchAtStart !== "all") qs.set("branch_type", branchAtStart);
      if (nameAtStart) qs.set("name", nameAtStart);
      if (emailAtStart) qs.set("email", emailAtStart);

      const res = await fetch(`/api/admin/requests?${qs.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      const json = (await safeJson(res)) as ApiOkList | ApiErr | null;

      if (seq !== listSeqRef.current) return;

      if (!res.ok || !json) throw new Error(`HTTP ${res.status}`);
      if (!json.ok) throw new Error((json as ApiErr).error || "Не удалось загрузить заявки");

      const rawRows = (json as ApiOkList).requests ?? [];

      const safeRows =
        tabAtStart === "processed"
          ? rawRows.filter((r) => Boolean(r.is_processed))
          : tabAtStart === "pending"
            ? rawRows.filter((r) => !Boolean(r.is_processed))
            : rawRows;

      if (reset) {
        setRows(safeRows);
      } else {
        setRows((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          const nextRows = safeRows.filter((r) => !seen.has(r.id));
          return [...prev, ...nextRows];
        });
      }

      setHasMore(Boolean((json as ApiOkList).page?.hasMore));
      setNextCursor((json as ApiOkList).page?.nextCursor ?? null);

      if (tabAtStart === "processed") {
        await loadMaterialsForRows(safeRows, reset);
      }
    } catch (e: any) {
      if (isAbortError(e)) return;
      if (seq !== listSeqRef.current) return;

      if (reset) {
        setErr(e?.message || String(e));
        setRows([]);
        setMaterialsByRequest({});
        setSelected(new Set());
        setHasMore(false);
        setNextCursor(null);
      } else {
        setMaterialsWarning(`Не удалось загрузить следующую пачку заявок: ${e?.message || String(e)}`);
      }
    } finally {
      if (seq === listSeqRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }

      if (listAbortRef.current === controller) listAbortRef.current = null;
    }
  }

  async function patchRequests(ids: string[], is_processed: boolean, confirmBulk: boolean) {
    if (!ids.length) return;

    if (confirmBulk) {
      const okk = window.confirm(
        is_processed
          ? `Обработать выбранные заявки: ${ids.length}? (выдаст доступы)`
          : `Вернуть выбранные заявки в ожидание: ${ids.length}? (заберёт доступы ТОЛЬКО по этим заявкам)`,
      );

      if (!okk) return;
    }

    setProcessingMode(is_processed ? "process" : "unprocess");
    setProcessingOpen(true);

    setLoading(true);
    setErr(null);
    setMaterialsWarning(null);

    try {
      const res = await fetch("/api/admin/requests", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids, is_processed }),
      });

      const json = (await safeJson(res)) as { ok: boolean; error?: string } | null;

      if (!res.ok || !json) throw new Error(`HTTP ${res.status}`);
      if (!json.ok) throw new Error(json.error || "Не удалось обновить заявки");

      await Promise.all([loadStats(), loadList(true)]);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
      setProcessingOpen(false);
    }
  }

  async function oneUpdate(id: string, is_processed: boolean) {
    await patchRequests([id], is_processed, false);
  }

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

    return () => {
      statsAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilter]);

  useEffect(() => {
    void loadList(true);

    return () => {
      listAbortRef.current?.abort();
      grantsAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, branchFilter]);

  useEffect(() => {
    if (!searchMountedRef.current) {
      searchMountedRef.current = true;
      return;
    }

    const t = window.setTimeout(() => void loadList(true), 350);
    return () => window.clearTimeout(t);
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

  const actionBusy = loading || loadingMore;
  const allChecked = rows.length > 0 && selected.size === rows.length;

  const showBulkProcess = tab === "all" || tab === "pending";
  const showBulkUnprocess = tab === "all" || tab === "processed";

  const emptyColSpan = tab === "processed" ? 12 : tab === "all" ? 11 : 10;

  return (
    <div className="card admin-requests-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ marginTop: 0 }}>📋 Управление заявками</h3>
          <div className="small-muted">Заявки на доступ к материалам олимпиады и экзаменов Gatehouse Awards.</div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn small" type="button" onClick={() => void Promise.all([loadStats(), loadList(true)])}>
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
        {branchTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={branchFilter === t.key ? "btn" : "btn ghost"}
            onClick={() => setBranchFilter(t.key)}
            style={{ fontWeight: 900 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ height: 10 }} />

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
              <button className="btn small" type="button" onClick={() => void bulkProcess()} disabled={actionBusy}>
                ✅ Обработать выделенные
              </button>
            ) : null}

            {showBulkUnprocess ? (
              <button className="btn small" type="button" onClick={() => void bulkUnprocess()} disabled={actionBusy}>
                ↩️ Вернуть в необработанные
              </button>
            ) : null}

            <button className="btn small secondary" type="button" onClick={() => setSelected(new Set())} disabled={actionBusy}>
              ❌ Отменить выделение
            </button>
          </div>
        </div>
      ) : null}

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
      {materialsWarning ? <ErrorBox message={materialsWarning} /> : null}

      {!loading && !err ? (
        <>
          <div className="admin-requests-table-wrap">
            <table className="table admin-requests-table">
              <thead>
                <tr>
                  <th className="admin-requests-check">
                    <input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} />
                  </th>
                  <th className="admin-requests-num">№</th>
                  <th className="admin-requests-number">Номер</th>
                  <th className="admin-requests-branch">Раздел</th>
                  <th className="admin-requests-date">Создана</th>
                  {tab === "processed" ? <th className="admin-requests-date">Обработана</th> : null}
                  <th className="admin-requests-levels">{branchFilter === "gatehouse" ? "Уровни" : "Классы / уровни"}</th>
                  <th className="admin-requests-types">Типы</th>
                  <th className="admin-requests-email">Email</th>
                  <th className="admin-requests-name">ФИО</th>
                  {tab === "processed" ? (
                    <th className="admin-requests-grants">Выданные материалы</th>
                  ) : tab === "all" ? (
                    <th className="admin-requests-status">Статус</th>
                  ) : null}
                  <th className="admin-requests-actions">Действия</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={emptyColSpan} style={{ padding: 16, textAlign: "center" }}>
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
                        <td className="admin-requests-check">
                          <input type="checkbox" checked={checked} onChange={(e) => toggleOne(r.id, e.target.checked)} />
                        </td>

                        <td className="admin-requests-num">
                          <strong>{idx + 1}</strong>
                        </td>

                        <td className="admin-requests-number">
                          <strong>{r.request_number ?? "—"}</strong>
                        </td>

                        <td className="admin-requests-branch">{renderBranch(r)}</td>

                        <td className="admin-requests-date">{fmtDate(r.created_at)}</td>

                        {tab === "processed" ? <td className="admin-requests-date">{fmtDate(r.processed_at)}</td> : null}

                        <td className="admin-requests-levels">{renderClassLevels(r)}</td>

                        <td className="admin-requests-types">{renderTypes(r)}</td>

                        <td className="admin-requests-email">{r.email ?? "—"}</td>

                        <td className="admin-requests-name">{r.full_name ?? "—"}</td>

                        {tab === "processed" ? (
                          <td className="admin-requests-grants">{renderGrantedMaterials(materialsByRequest?.[r.id])}</td>
                        ) : tab === "all" ? (
                          <td className="admin-requests-status">
                            <span
                              className={
                                status
                                  ? "admin-request-status admin-request-status--processed"
                                  : "admin-request-status admin-request-status--pending"
                              }
                            >
                              {status ? "✅ Обработана" : "⏳ Ожидает"}
                            </span>
                          </td>
                        ) : null}

                        <td className="admin-requests-actions">
                          {!status ? (
                            <button className="btn small" type="button" onClick={() => void oneUpdate(r.id, true)} disabled={actionBusy}>
                              ✅ Обработать
                            </button>
                          ) : (
                            <button className="btn small" type="button" onClick={() => void oneUpdate(r.id, false)} disabled={actionBusy}>
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

          {rows.length > 0 ? (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
              {hasMore ? (
                <button className="btn small secondary" type="button" onClick={() => void loadList(false)} disabled={loadingMore}>
                  {loadingMore ? "Загружаем..." : `Показать ещё ${PAGE_SIZE}`}
                </button>
              ) : (
                <div className="small-muted" style={{ fontWeight: 800 }}>
                  Загружено: {rows.length}
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : null}

      <ProcessingModal open={processingOpen} mode={processingMode} />
    </div>
  );
}