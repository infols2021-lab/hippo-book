/* app/(admin)/admin/requests/RequestsTab.tsx */
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
  contact_phone?: string | null;
  branch_type?: string | null;
  class_level: any;
  target_level?: any;
  target_levels?: any;
  textbook_types: any;
  material_kinds?: any;
  project_id?: string | null;
  projects?: { name: string } | null;
};

type Stats = { total: number; pending: number; processed: number };
type PageCursor = { created_at: string } | null;

type ApiOkList = {
  ok: true;
  requests: RequestRow[];
  materialsByRequest?: Record<string, string[]>;
  materialsError?: string | null;
  page?: { limit: number; returned: number; hasMore: boolean; nextCursor?: PageCursor };
};

type ApiOkGrants = { ok: true; materialsByRequest: Record<string, string[]>; materialsError?: string | null };
type ApiOkStats = { ok: true; stats: Stats };
type ApiErr = { ok: false; error: string; code?: string };

const PAGE_SIZE = 10;

async function safeJson(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try { return JSON.parse(t); } 
  catch { return null; }
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
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return v;
  }
}

// Проверка на UUID (та самая длинная ссылка)
function isValidUUID(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

// 🚀 ДИНАМИЧЕСКИЙ РЕНДЕР ИМЕНИ ПРОЕКТА
function renderProjectName(row: RequestRow) {
  if (row.projects?.name) {
    return <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap">{row.projects.name}</span>;
  }
  
  const branch = String(row.branch_type || "olympiad").toLowerCase();
  
  if (branch === "gatehouse" || branch === "ga_exam" || branch === "ga" || branch === "exam" || branch === "gatehouse_awards") {
    return <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap">🎓 Экзамены (Gatehouse)</span>;
  }
  
  if (branch === "olympiad") {
    return <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap">🏆 Олимпиада (Легаси)</span>;
  }

  const capitalizedBranch = branch.charAt(0).toUpperCase() + branch.slice(1);
  return (
    <span className="bg-teal-100 text-teal-800 px-3 py-1 rounded-lg text-sm font-bold shadow-sm whitespace-nowrap">
      📁 {capitalizedBranch}
    </span>
  );
}

function renderClassLevels(row: RequestRow) {
  const tLevels = arrOf(row.target_levels);
  const tLevel = arrOf(row.target_level);
  const cLevel = arrOf(row.class_level);
  
  const arr = tLevels.length ? tLevels : tLevel.length ? tLevel : cLevel;
  if (!arr.length) return <span className="text-gray-400 font-medium">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {arr.map((c, i) => (
        <span key={i} className="bg-gray-100 border text-gray-700 px-2 py-0.5 rounded text-[11px] uppercase font-bold whitespace-nowrap">
          {c}
        </span>
      ))}
    </div>
  );
}

// 🚀 УЛУЧШЕННОЕ ОТОБРАЖЕНИЕ ТИПОВ МАТЕРИАЛОВ (С МАСКИРОВКОЙ UUID)
function renderTypes(row: RequestRow) {
  const mk = arrOf(row.material_kinds);
  const tt = arrOf(row.textbook_types);
  
  const arrSet = new Set([...mk, ...tt]);
  const arr = Array.from(arrSet);

  if (!arr.length) return <span className="text-gray-400 font-medium">—</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {arr.map((t, i) => {
        const str = String(t).toLowerCase();
        let label = String(t);
        let color = "bg-gray-50 text-gray-700 border-gray-200";

        if (isValidUUID(str)) {
          // Если это UUID таба проекта, выводим красивую плашку
          label = "📁 Раздел проекта"; 
          color = "bg-indigo-50 text-indigo-700 border-indigo-200";
        }
        else if (str.includes("mock") || str.includes("пробн") || str.includes("мок")) {
          label = "📝 Пробный тест"; color = "bg-purple-50 text-purple-700 border-purple-200";
        }
        else if (str.includes("учебник") || str.includes("textbook")) {
          label = "📚 Учебник"; color = "bg-blue-50 text-blue-700 border-blue-200";
        }
        else if (str.includes("кроссворд") || str.includes("crossword")) {
          label = "🧩 Кроссворд"; color = "bg-green-50 text-green-700 border-green-200";
        } else {
          label = `📁 ${str.charAt(0).toUpperCase() + str.slice(1)}`;
        }

        return (
          <span key={i} className={`px-2 py-0.5 border rounded text-[11px] font-bold whitespace-nowrap ${color}`}>
            {label}
          </span>
        );
      })}
    </div>
  );
}

function renderGrantedMaterials(items: string[] | undefined) {
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) return <span className="text-gray-400 font-medium">—</span>;

  return (
    <div className="flex flex-col gap-1">
      {arr.map((m, i) => (
        <div key={i} className="text-xs font-medium text-gray-700 truncate max-w-[200px]" title={m}>
          ✓ {m}
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
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [projects, setProjects] = useState<{id: string, name: string}[]>([]);

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

  useEffect(() => {
    fetch("/api/admin/projects")
      .then(r => r.json())
      .then(d => setProjects(d.projects || d.data || d || []))
      .catch(() => {});
  }, []);

  async function loadStats() {
    const seq = ++statsSeqRef.current;
    statsAbortRef.current?.abort();

    const controller = new AbortController();
    statsAbortRef.current = controller;

    setStatsLoading(true);
    setStatsErr(null);

    try {
      const qs = new URLSearchParams();
      if (projectFilter === "legacy_olympiad") qs.set("branch_type", "olympiad");
      else if (projectFilter === "legacy_gatehouse") qs.set("branch_type", "gatehouse");
      else if (projectFilter !== "all") qs.set("project_id", projectFilter);

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
        setMaterialsWarning(`Выданные материалы временно недоступны: ${(json as ApiOkGrants).materialsError}`);
      }
    } catch (e: any) {
      if (isAbortError(e)) return;
      setMaterialsWarning(`Ошибка загрузки выданных материалов: ${e?.message || String(e)}`);
    } finally {
      if (grantsAbortRef.current === controller) grantsAbortRef.current = null;
    }
  }

  async function loadList(reset = true) {
    const seq = ++listSeqRef.current;
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
      qs.set("status", tab);
      qs.set("limit", String(PAGE_SIZE));

      if (!reset && nextCursor?.created_at) qs.set("cursor_created_at", nextCursor.created_at);
      
      if (projectFilter === "legacy_olympiad") qs.set("branch_type", "olympiad");
      else if (projectFilter === "legacy_gatehouse") qs.set("branch_type", "gatehouse");
      else if (projectFilter !== "all") qs.set("project_id", projectFilter);
      
      if (name.trim()) qs.set("name", name.trim());
      if (email.trim()) qs.set("email", email.trim());

      const res = await fetch(`/api/admin/requests?${qs.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      const json = (await safeJson(res)) as ApiOkList | ApiErr | null;

      if (seq !== listSeqRef.current) return;

      if (!res.ok || !json) throw new Error(`HTTP ${res.status}`);
      if (!json.ok) throw new Error((json as ApiErr).error || "Не удалось загрузить заявок");

      const rawRows = (json as ApiOkList).requests ?? [];
      const safeRows = tab === "processed" ? rawRows.filter(r => Boolean(r.is_processed)) : tab === "pending" ? rawRows.filter(r => !Boolean(r.is_processed)) : rawRows;

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

      if (tab === "processed") {
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
        setMaterialsWarning(`Ошибка загрузки: ${e?.message || String(e)}`);
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
          : `Вернуть выбранные заявки в ожидание: ${ids.length}? (заберёт доступы ТОЛЬКО по этим заявкам)`
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

  async function oneUpdate(id: string, is_processed: boolean) { await patchRequests([id], is_processed, false); }
  async function bulkProcess() { await patchRequests(Array.from(selectionRef.current), true, true); }
  async function bulkUnprocess() { await patchRequests(Array.from(selectionRef.current), false, true); }

  useEffect(() => {
    void loadStats();
    return () => statsAbortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter]);

  useEffect(() => {
    void loadList(true);
    return () => {
      listAbortRef.current?.abort();
      grantsAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, projectFilter]);

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
    if (!checked) return setSelected(new Set());
    setSelected(new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (checked) n.add(id); else n.delete(id);
      return n;
    });
  }

  const actionBusy = loading || loadingMore;
  const allChecked = rows.length > 0 && selected.size === rows.length;

  return (
    <div className="card space-y-6">
      <div className="admin-section-head mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">📋 Управление заявками</h2>
          <p className="text-gray-500 text-sm">Центр выдачи доступов ученикам по всем веткам и проектам.</p>
        </div>
        <button className="bg-gray-100 text-gray-800 px-4 py-2 rounded-xl font-bold hover:bg-gray-200 transition-colors" type="button" onClick={() => void Promise.all([loadStats(), loadList(true)])}>
          🔄 Обновить
        </button>
      </div>

      {!statsLoading && !statsErr && (
        <div className="flex gap-4 flex-wrap">
          <div className="bg-white border rounded-xl p-4 flex-1 shadow-sm">
            <div className="text-2xl font-black">{stats.total}</div>
            <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">Всего заявок</div>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex-1 shadow-sm">
            <div className="text-2xl font-black text-orange-600">{stats.pending}</div>
            <div className="text-xs text-orange-500 font-bold uppercase tracking-wider">Ожидают</div>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex-1 shadow-sm">
            <div className="text-2xl font-black text-green-600">{stats.processed}</div>
            <div className="text-xs text-green-500 font-bold uppercase tracking-wider">Обработано</div>
          </div>
        </div>
      )}

      <div className="flex gap-4 p-5 bg-gray-50 rounded-2xl border flex-wrap items-end mb-6">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Проект (Ветка)</label>
          <select 
            value={projectFilter} 
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-full border-2 rounded-xl px-4 py-2 font-bold bg-white outline-none"
          >
            <option value="all">Все проекты</option>
            {projects.length > 0 && (
              <optgroup label="Новые динамические проекты">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            )}
            <optgroup label="Легаси (старая структура)">
              <option value="legacy_olympiad">🏆 Олимпиада (Легаси)</option>
              <option value="legacy_gatehouse">🎓 Экзамены Gatehouse</option>
            </optgroup>
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Статус</label>
          <select 
            value={tab} 
            onChange={e => setTab(e.target.value as any)} 
            className="w-full border-2 rounded-xl px-4 py-2 font-bold bg-white outline-none"
          >
            <option value="all">📋 Все заявки</option>
            <option value="pending">⏳ Ожидающие</option>
            <option value="processed">✅ Обработанные</option>
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Поиск по ФИО</label>
          <input className="w-full border-2 rounded-xl px-4 py-2 bg-white outline-none" value={name} onChange={(e) => setName(e.target.value)} placeholder="ФИО..." />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Поиск по Email</label>
          <input className="w-full border-2 rounded-xl px-4 py-2 bg-white outline-none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email..." />
        </div>
        <button
          className="bg-gray-200 text-gray-800 px-6 py-2 rounded-xl font-bold hover:bg-gray-300 transition-colors whitespace-nowrap"
          type="button"
          onClick={() => { setName(""); setEmail(""); setProjectFilter("all"); setTab("all"); }}
        >
          🗑️ Сбросить
        </button>
      </div>

      {selected.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-6 items-center flex-wrap shadow-sm">
          <div className="font-bold text-blue-900">
            Выбрано: <span className="text-blue-600">{selected.size}</span>
          </div>
          {tab !== "processed" && (
            <button className="bg-blue-600 text-white px-4 py-1.5 rounded-lg font-bold text-sm shadow-sm hover:bg-blue-700 transition-colors" type="button" onClick={() => void bulkProcess()} disabled={actionBusy}>
              ✅ Обработать выбранные
            </button>
          )}
          {tab !== "pending" && (
            <button className="bg-white border border-gray-300 text-gray-700 px-4 py-1.5 rounded-lg font-bold text-sm shadow-sm hover:bg-gray-50 transition-colors" type="button" onClick={() => void bulkUnprocess()} disabled={actionBusy}>
              ↩️ Вернуть в необработанные
            </button>
          )}
          <button className="text-gray-500 hover:text-gray-800 font-bold text-sm ml-auto" type="button" onClick={() => setSelected(new Set())} disabled={actionBusy}>
            Отменить выделение
          </button>
        </div>
      )}

      {loading ? <LoadingBlock text="Загружаем заявки..." /> : null}
      {err ? <ErrorBox message={err} /> : null}
      {materialsWarning ? <ErrorBox message={materialsWarning} /> : null}

      {!loading && !err && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[1000px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 w-12 text-center">
                  <input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer" />
                </th>
                <th className="p-4 font-bold text-gray-500 w-12">№</th>
                <th className="p-4 font-bold min-w-[120px]">Номер</th>
                <th className="p-4 font-bold min-w-[150px]">Проект (Раздел)</th>
                <th className="p-4 font-bold">Создана</th>
                {tab === "processed" && <th className="p-4 font-bold">Обработана</th>}
                <th className="p-4 font-bold">Уровни</th>
                <th className="p-4 font-bold">Типы</th>
                <th className="p-4 font-bold">Пользователь</th>
                {tab === "processed" ? <th className="p-4 font-bold">Выдано</th> : tab === "all" ? <th className="p-4 font-bold text-center">Статус</th> : null}
                <th className="p-4 font-bold text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-gray-500 font-bold">Заявок не найдено</td>
                </tr>
              ) : (
                rows.map((r, idx) => {
                  const checked = selected.has(r.id);
                  const status = Boolean(r.is_processed);
                  return (
                    <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${checked ? "bg-blue-50/50" : ""}`}>
                      <td className="p-4 text-center">
                        <input type="checkbox" checked={checked} onChange={(e) => toggleOne(r.id, e.target.checked)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      </td>
                      <td className="p-4 font-bold text-gray-400">{idx + 1}</td>
                      <td className="p-4 font-bold font-mono text-xs">{r.request_number || "—"}</td>
                      <td className="p-4">{renderProjectName(r)}</td>
                      <td className="p-4 text-xs font-mono text-gray-500 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                      {tab === "processed" && <td className="p-4 text-xs font-mono text-gray-500 whitespace-nowrap">{fmtDate(r.processed_at)}</td>}
                      <td className="p-4">{renderClassLevels(r)}</td>
                      <td className="p-4">{renderTypes(r)}</td>
                      <td className="p-4">
                        <div className="font-bold whitespace-nowrap">{r.full_name || "—"}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[150px]" title={r.email || ""}>{r.email || "—"}</div>
                      </td>
                      {tab === "processed" ? (
                        <td className="p-4">{renderGrantedMaterials(materialsByRequest?.[r.id])}</td>
                      ) : tab === "all" ? (
                        <td className="p-4 text-center">
                          {status 
                            ? <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded-md whitespace-nowrap">✅ Готово</span>
                            : <span className="text-orange-500 font-bold text-xs bg-orange-50 px-2 py-1 rounded-md whitespace-nowrap">⏳ Ожидает</span>
                          }
                        </td>
                      ) : null}
                      <td className="p-4 text-right">
                        {!status ? (
                          <button className="bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm hover:bg-blue-700 transition-colors whitespace-nowrap" type="button" onClick={() => void oneUpdate(r.id, true)} disabled={actionBusy}>
                            ✅ Обработать
                          </button>
                        ) : (
                          <button className="bg-white border text-gray-700 px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm hover:bg-gray-50 transition-colors whitespace-nowrap" type="button" onClick={() => void oneUpdate(r.id, false)} disabled={actionBusy}>
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
      )}

      {rows.length > 0 && (
        <div className="flex justify-center mt-6">
          {hasMore ? (
            <button className="bg-gray-100 text-gray-700 font-bold px-6 py-2.5 rounded-xl hover:bg-gray-200 transition-colors" type="button" onClick={() => void loadList(false)} disabled={loadingMore}>
              {loadingMore ? "Загружаем..." : `Показать ещё ${PAGE_SIZE}`}
            </button>
          ) : (
            <div className="text-gray-400 font-bold text-sm">Загружено: {rows.length}</div>
          )}
        </div>
      )}

      <ProcessingModal open={processingOpen} mode={processingMode} />
    </div>
  );
}