"use client";

import { useEffect, useRef, useState } from "react";
import LoadingBlock from "@/components/LoadingBlock";
import ErrorBox from "@/components/ErrorBox";
import AssignmentEditor from "./AssignmentEditor";
import {
  buildMaterialAssignmentsExportPack,
  downloadMaterialAssignmentsPack,
  materialMetaFromSelection,
  parseMaterialAssignmentsImportPack,
} from "@/lib/assignments/materialAssignmentsPack";

type AssignmentRow = {
  id: string;
  title: string;
  order_index: number | null;
  branch_type?: string | null;
  material_id?: string | null;
  textbook_id: string | null;
  crossword_id: string | null;
  content: any;
  created_at?: string | null;
};

type MaterialOption = {
  id: string;
  title: string;
  kind: "textbook" | "crossword" | "material";
  branch_type?: string;
  material_kind?: string;
  project_id?: string;
  project_tab_id?: string;
  is_demo?: boolean;
};

type Props = {
  onChanged?: () => Promise<void> | void;
};

function guessTypeLabel(a: AssignmentRow) {
  const qs = a?.content?.questions;
  if (!Array.isArray(qs) || qs.length === 0) return "—";

  const types = new Set(qs.map((q: any) => String(q?.type || "")));

  if (types.has("crossword")) return "Кроссворд";
  if (types.has("sentence")) return "Предложение";
  if (types.has("fill")) return "Ввод";

  return "Тест";
}

function questionsCount(a: AssignmentRow) {
  const qs = a?.content?.questions;
  return Array.isArray(qs) ? qs.length : 0;
}

export default function AssignmentsTab({ onChanged }: Props) {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  
  const [tabs, setTabs] = useState<any[]>([]);
  const [selectedTabId, setSelectedTabId] = useState<string>("");

  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialOption | null>(null);

  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AssignmentRow | null>(null);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<any | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const isLegacy = selectedProjectId.startsWith("legacy_") || selectedProjectId === "global_demo";

  useEffect(() => {
    fetch("/api/admin/projects")
      .then(r => r.json())
      .then(d => setProjects(d.projects || d.data || []));
  }, []);

  useEffect(() => {
    setSelectedTabId("");
    setSelectedMaterial(null);
    setMaterials([]);
    setRows([]);

    if (selectedProjectId && !isLegacy) {
      fetch(`/api/admin/projects/${selectedProjectId}/tabs`)
        .then(r => r.json())
        .then(d => setTabs(d.tabs || []));
    } else {
      setTabs([]);
    }
  }, [selectedProjectId, isLegacy]);

  useEffect(() => {
    async function loadMats() {
      if (!selectedProjectId) {
        setMaterials([]);
        return;
      }

      setLoading(true);
      setErr(null);

      try {
        if (selectedProjectId === "global_demo") {
          const res = await fetch("/api/admin/materials?is_demo=true", { cache: "no-store" });
          const json = await res.json();
          const demoMats = (json.materials || []).map((x: any) => ({
            ...x,
            branch_type: "demo",
            kind: "material",
            id: String(x.id),
            title: `[DEMO] ${x.title}`
          }));
          setMaterials(demoMats);
          if (demoMats.length > 0) {
            setSelectedMaterial(demoMats[0]);
          }
        }
        else if (selectedProjectId === "legacy_olympiad") {
          const [tRes, cRes] = await Promise.all([
            fetch("/api/admin/textbooks", { cache: "no-store" }),
            fetch("/api/admin/crosswords", { cache: "no-store" })
          ]);
          const tJson = await tRes.json();
          const cJson = await cRes.json();

          const tb = (tJson.textbooks || []).map((x: any) => ({ ...x, branch_type: "olympiad", kind: "textbook", id: String(x.id) }));
          const cw = (cJson.crosswords || []).map((x: any) => ({ ...x, branch_type: "olympiad", kind: "crossword", id: String(x.id) }));
          setMaterials([...tb, ...cw]);
        } 
        else if (selectedProjectId === "legacy_gatehouse") {
          const mRes = await fetch("/api/admin/materials?branch_type=gatehouse", { cache: "no-store" });
          const mJson = await mRes.json();
          const ga = (mJson.materials || []).map((x: any) => ({ ...x, branch_type: "gatehouse", kind: "material", id: String(x.id) }));
          setMaterials(ga);
        } 
        else if (selectedTabId) {
          const res = await fetch(`/api/admin/projects/${selectedProjectId}/materials?tab_id=${selectedTabId}`, { cache: "no-store" });
          const json = await res.json();
          const projMats = (json.materials || []).map((x: any) => ({
            ...x,
            branch_type: "project",
            kind: "material",
            project_id: selectedProjectId,
            project_tab_id: selectedTabId,
            id: String(x.id),
            title: x.is_demo ? `[DEMO] ${x.title}` : x.title
          }));
          setMaterials(projMats);
        } 
        else {
          setMaterials([]);
        }
      } catch (e: any) {
        setErr("Ошибка загрузки материалов: " + e.message);
      } finally {
        setLoading(false);
      }
    }

    loadMats();
    if (selectedProjectId !== "global_demo") {
      setSelectedMaterial(null);
    }
  }, [selectedProjectId, selectedTabId]);

  const loadAssignments = async (material: MaterialOption | null) => {
    if (!material) {
      setRows([]);
      return;
    }
    setLoading(true);
    setErr(null);

    try {
      const qs = new URLSearchParams();
      
      if (material.branch_type === "demo" || selectedProjectId === "global_demo") {
        qs.set("material_id", material.id);
      } else if (material.branch_type === "gatehouse") {
        qs.set("branch_type", "gatehouse");
        qs.set("kind", "material");
        qs.set("id", material.id);
        qs.set("material_id", material.id);
      } else if (material.branch_type === "olympiad") {
        qs.set("branch_type", "olympiad");
        qs.set("kind", material.kind);
        qs.set("id", material.id);
      } else {
        qs.set("project_id", material.project_id || "");
        qs.set("project_tab_id", material.project_tab_id || "");
        qs.set("material_id", material.id);
      }

      const res = await fetch(`/api/admin/assignments?${qs.toString()}`, { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !json?.ok) throw new Error(json?.error || "Не удалось загрузить задания");
      setRows((json.assignments ?? []) as AssignmentRow[]);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignments(selectedMaterial);
  }, [selectedMaterial]);

  async function removeAssignment(a: AssignmentRow) {
    const ok = window.confirm(`Удалить задание "${a.title}"?`);
    if (!ok) return;

    const res = await fetch(`/api/admin/assignments/${encodeURIComponent(a.id)}`, { method: "DELETE" });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      alert(`Ошибка удаления: ${json?.error || `HTTP ${res.status}`}`);
      return;
    }

    await loadAssignments(selectedMaterial);
    await onChanged?.();
  }

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(a: AssignmentRow) {
    setEditing(a);
    setEditorOpen(true);
  }

  async function onSaved() {
    setEditorOpen(false);
    setEditing(null);
    await loadAssignments(selectedMaterial);
    await onChanged?.();
  }

  function handleExportAssignments() {
    if (!selectedMaterial) return;

    if (!rows.length) {
      window.alert("У этого материала пока нет заданий для экспорта.");
      return;
    }

    const pack = buildMaterialAssignmentsExportPack({
      material: materialMetaFromSelection(selectedMaterial),
      assignments: rows,
    });

    downloadMaterialAssignmentsPack(pack);
  }

  function handleImportClick() {
    if (!selectedMaterial) return;
    importInputRef.current?.click();
  }

  async function handleImportFile(file: File | null) {
    if (!file || !selectedMaterial) return;

    setImportReport(null);
    setErr(null);

    let parsedPack;
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const parsed = parseMaterialAssignmentsImportPack(raw);
      if (!parsed.ok) {
        setErr(parsed.error);
        return;
      }
      parsedPack = parsed.pack;
    } catch (e: any) {
      setErr(e?.message || "Не удалось прочитать JSON-файл");
      return;
    }

    if (parsedPack.material.id !== selectedMaterial.id) {
      setErr(
        `Материал в файле ("${parsedPack.material.title}") не совпадает с выбранным ("${selectedMaterial.title}"). ` +
          `Выбери тот же материал или экспортируй/импортируй заново.`
      );
      return;
    }

    const proceed = window.confirm(
      `Импортировать ${parsedPack.assignments.length} заданий в материал "${selectedMaterial.title}"?\n\n` +
        `Существующие задания будут обновлены по id. Новые не создаются.`
    );
    if (!proceed) return;

    setImporting(true);

    try {
      const res = await fetch("/api/admin/assignments/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsedPack,
          target_material_id: selectedMaterial.id,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      setImportReport(json);
      await loadAssignments(selectedMaterial);
      await onChanged?.();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="card space-y-6">
      <div className="admin-section-head mb-4">
        <div>
          <h2 className="text-2xl font-bold">Управление заданиями</h2>
          <p className="text-gray-500 text-sm">Один движок заданий используется для всех веток, проектов и демо-материала.</p>
        </div>
      </div>

      <div className="flex gap-4 p-5 bg-gray-50 rounded-2xl border flex-wrap items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">1. Проект (Ветка)</label>
          <select 
            value={selectedProjectId} 
            onChange={e => setSelectedProjectId(e.target.value)} 
            className="w-full border-2 rounded-xl px-4 py-2.5 outline-none bg-white font-bold"
          >
            <option value="">-- Выберите ветку --</option>
            <optgroup label="Публичные промо-материалы">
              <option value="global_demo">Единственный Демо-материал</option>
            </optgroup>
            <optgroup label="Новые динамические проекты">
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </optgroup>
            <optgroup label="Легаси (старая структура)">
              <option value="legacy_olympiad">Олимпиада (Учебники и Кроссворды)</option>
              <option value="legacy_gatehouse">Экзамены Gatehouse Awards</option>
            </optgroup>
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">2. Раздел (Таб)</label>
          <select 
            value={selectedTabId} 
            onChange={e => setSelectedTabId(e.target.value)} 
            disabled={isLegacy || !selectedProjectId} 
            className="w-full border-2 rounded-xl px-4 py-2.5 outline-none bg-white font-bold disabled:opacity-50 disabled:bg-gray-100"
          >
            <option value="">{selectedProjectId === "global_demo" ? "Не требуется для Демо" : isLegacy ? "Не требуется для легаси" : "-- Выберите раздел --"}</option>
            {tabs.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>

        <div className="flex-1 min-w-[250px]">
          <label className="block text-xs font-bold text-gray-500 uppercase mb-2">3. Материал</label>
          <select 
            value={selectedMaterial?.id || ""} 
            onChange={e => {
              const v = e.target.value;
              setSelectedMaterial(v ? materials.find(m => m.id === v) || null : null);
            }} 
            disabled={materials.length === 0} 
            className="w-full border-2 rounded-xl px-4 py-2.5 outline-none bg-white font-bold disabled:opacity-50 disabled:bg-gray-100"
          >
            <option value="">-- Выберите материал --</option>
            {selectedProjectId === "legacy_olympiad" ? (
              <>
                <optgroup label="Учебники">
                  {materials.filter(m => m.kind === "textbook").map(m => <option key={`tb-${m.id}`} value={m.id}>{m.title}</option>)}
                </optgroup>
                <optgroup label="Кроссворды">
                  {materials.filter(m => m.kind === "crossword").map(m => <option key={`cw-${m.id}`} value={m.id}>{m.title}</option>)}
                </optgroup>
              </>
            ) : (
              materials.map(m => <option key={`mat-${m.id}`} value={m.id}>{m.title}</option>)
            )}
          </select>
        </div>

        <div className="assignments-toolbar-actions">
          <button
            className="assignments-toolbar-btn assignments-toolbar-btn--ghost"
            onClick={handleExportAssignments}
            disabled={!selectedMaterial || !rows.length || importing}
            type="button"
            title="Скачать JSON всех заданий материала"
          >
            ⬇️ Экспорт заданий
          </button>

          <button
            className="assignments-toolbar-btn assignments-toolbar-btn--ghost"
            onClick={handleImportClick}
            disabled={!selectedMaterial || importing}
            type="button"
            title="Загрузить JSON и обновить задания материала"
          >
            {importing ? "Импорт..." : "⬆️ Импорт заданий"}
          </button>

          <button
            className="assignments-toolbar-btn assignments-toolbar-btn--primary"
            onClick={openCreate}
            disabled={!selectedMaterial || importing}
            type="button"
          >
            Создать задание
          </button>

          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="assignments-import-input"
            onChange={(e) => void handleImportFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      {importReport && (
        <div className="assignments-import-report">
          <div className="assignments-import-report-head">
            <strong>Импорт завершён</strong>
            <button
              type="button"
              className="btn btn-small ghost"
              onClick={() => setImportReport(null)}
            >
              ✕
            </button>
          </div>
          <div className="assignments-import-report-stats">
            <span>Обновлено: <b>{importReport.updated ?? 0}</b></span>
            <span>Пропущено: <b>{importReport.skipped ?? 0}</b></span>
            <span>Ошибок: <b>{importReport.failed ?? 0}</b></span>
          </div>
          {Array.isArray(importReport.results) && importReport.results.length > 0 && (
            <div className="assignments-import-report-list">
              {importReport.results.map((item: any) => (
                <div
                  key={`${item.id}-${item.title}`}
                  className={`assignments-import-report-item assignments-import-report-item--${item.status}`}
                >
                  <span>{item.title}</span>
                  <span>{item.status}{item.message ? `: ${item.message}` : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && <LoadingBlock text="Загрузка данных..." />}
      {err && <ErrorBox message={err} />}

      {editorOpen && selectedMaterial && (
        <div className="mt-6 border-t pt-6">
          <AssignmentEditor
            material={selectedMaterial}
            editing={editing}
            onCancel={() => {
              setEditorOpen(false);
              setEditing(null);
            }}
            onSaved={onSaved}
          />
        </div>
      )}

      {!loading && !err && !editorOpen && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-6">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 font-bold w-16">№</th>
                <th className="p-4 font-bold">Название задания</th>
                <th className="p-4 font-bold w-32">Порядок</th>
                <th className="p-4 font-bold w-40">Тип</th>
                <th className="p-4 font-bold w-32">Вопросов</th>
                <th className="p-4 font-bold w-64 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500 font-bold">
                    {selectedMaterial ? "Для этого материала еще не создано заданий" : "Сначала выберите материал"}
                  </td>
                </tr>
              ) : (
                rows.map((a, idx) => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-gray-500">{idx + 1}</td>
                    <td className="p-4 font-bold">{a.title}</td>
                    <td className="p-4">{a.order_index ?? 0}</td>
                    <td className="p-4 text-gray-600">{guessTypeLabel(a)}</td>
                    <td className="p-4">{questionsCount(a)} шт.</td>
                    <td className="p-4 text-right space-x-2">
                      <button className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-lg font-bold transition-colors" onClick={() => openEdit(a)} type="button">
                        Изменить
                      </button>
                      <button className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold transition-colors" onClick={() => void removeAssignment(a)} type="button">
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}