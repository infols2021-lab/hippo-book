"use client";

import { useEffect, useMemo, useState } from "react";
import LoadingBlock from "@/components/LoadingBlock";
import ErrorBox from "@/components/ErrorBox";
import AssignmentEditor from "./AssignmentEditor";

type MaterialOption =
  | { kind: "textbook"; id: string; title: string }
  | { kind: "crossword"; id: string; title: string };

type AssignmentRow = {
  id: string;
  title: string;
  order_index: number | null;
  textbook_id: string | null;
  crossword_id: string | null;
  content: any;
  created_at?: string | null;
};

type Props = {
  onChanged?: () => Promise<void> | void;
};

function guessTypeLabel(a: AssignmentRow) {
  const qs = a?.content?.questions;
  if (!Array.isArray(qs) || qs.length === 0) return "—";
  const types = new Set(qs.map((q: any) => String(q?.type || "")));
  if (types.has("crossword")) return "🧩 Кроссворд";
  if (types.has("sentence")) return "📝 Предложение";
  if (types.has("fill")) return "✍️ Ввод";
  return "📝 Тест";
}

function questionsCount(a: AssignmentRow) {
  const qs = a?.content?.questions;
  return Array.isArray(qs) ? qs.length : 0;
}

export default function AssignmentsTab({ onChanged }: Props) {
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [selected, setSelected] = useState<MaterialOption | null>(null);

  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AssignmentRow | null>(null);

  const selectedKey = useMemo(() => {
    if (!selected) return "";
    return `${selected.kind}_${selected.id}`;
  }, [selected]);

  async function loadMaterials() {
    // Берём доступные учебники/кроссворды из админских API (должны уже быть у тебя)
    const [tRes, cRes] = await Promise.all([
      fetch("/api/admin/textbooks", { cache: "no-store" }),
      fetch("/api/admin/crosswords", { cache: "no-store" }),
    ]);

    const tJson = await tRes.json();
    const cJson = await cRes.json();

    if (!tRes.ok || !tJson?.ok) throw new Error(tJson?.error || "Не удалось загрузить учебники");
    if (!cRes.ok || !cJson?.ok) throw new Error(cJson?.error || "Не удалось загрузить кроссворды");

    const tb: MaterialOption[] = (tJson.textbooks ?? []).map((x: any) => ({
      kind: "textbook",
      id: String(x.id),
      title: String(x.title ?? "Без названия"),
    }));

    const cw: MaterialOption[] = (cJson.crosswords ?? []).map((x: any) => ({
      kind: "crossword",
      id: String(x.id),
      title: String(x.title ?? "Без названия"),
    }));

    // сверху новые: будем сортировать по title не надо — оставим как приходит (у тебя можно по order_index)
    const all = [...tb, ...cw];
    setMaterials(all);

    // если ранее было выбрано — сохраняем выбор
    if (selected) {
      const found = all.find((m) => m.kind === selected.kind && m.id === selected.id);
      if (found) setSelected(found);
    } else {
      // по умолчанию ничего
      setSelected(null);
    }
  }

  async function loadAssignments(material: MaterialOption | null) {
    if (!material) {
      setRows([]);
      return;
    }
    const url = `/api/admin/assignments?kind=${encodeURIComponent(material.kind)}&id=${encodeURIComponent(
      material.id
    )}`;

    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Не удалось загрузить задания");

    setRows((json.assignments ?? []) as AssignmentRow[]);
  }

  async function loadAll() {
    try {
      setLoading(true);
      setErr(null);
      await loadMaterials();
      await loadAssignments(selected);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setErr(e?.message || String(e));
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // при смене материала — грузим задания
  useEffect(() => {
    if (!selected) {
      setRows([]);
      return;
    }
    (async () => {
      try {
        setErr(null);
        setLoading(true);
        await loadAssignments(selected);
        setLoading(false);
      } catch (e: any) {
        setLoading(false);
        setErr(e?.message || String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  async function removeAssignment(a: AssignmentRow) {
    const ok = window.confirm(`Удалить задание "${a.title}"?`);
    if (!ok) return;

    const res = await fetch(`/api/admin/assignments/${encodeURIComponent(a.id)}`, { method: "DELETE" });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // если вдруг пустое тело
    }

    if (!res.ok || !json?.ok) {
      alert(`❌ Ошибка удаления: ${json?.error || `HTTP ${res.status}`}`);
      return;
    }

    await loadAssignments(selected);
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
    await loadAssignments(selected);
    await onChanged?.();
  }

  return (
    <div className="card">
      <h2>📝 Управление заданиями</h2>

      {loading ? <LoadingBlock text="Загружаем задания..." /> : null}
      {err ? <ErrorBox message={err} /> : null}

      <div className="admin-controls" style={{ marginTop: 10 }}>
        <select
          className="input"
          value={selected ? `${selected.kind}_${selected.id}` : ""}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return setSelected(null);
            const [kind, id] = v.split("_");
            const found = materials.find((m) => m.kind === kind && m.id === id) || null;
            setSelected(found);
          }}
        >
          <option value="">-- Выберите учебник или кроссворд --</option>

          <optgroup label="📚 Учебники">
            {materials
              .filter((m) => m.kind === "textbook")
              .map((m) => (
                <option key={`tb-${m.id}`} value={`textbook_${m.id}`}>
                  {m.title}
                </option>
              ))}
          </optgroup>

          <optgroup label="🧩 Кроссворды">
            {materials
              .filter((m) => m.kind === "crossword")
              .map((m) => (
                <option key={`cw-${m.id}`} value={`crossword_${m.id}`}>
                  {m.title}
                </option>
              ))}
          </optgroup>
        </select>

        <button className="btn" onClick={openCreate} disabled={!selected} type="button">
          ➕ Создать задание
        </button>
      </div>

      {editorOpen ? (
        <div style={{ marginTop: 14 }}>
          <AssignmentEditor
            material={selected}
            editing={editing}
            onCancel={() => {
              setEditorOpen(false);
              setEditing(null);
            }}
            onSaved={onSaved}
          />
        </div>
      ) : null}

      {!loading && !err ? (
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>№</th>
                <th>Название</th>
                <th style={{ width: 160 }}>Порядок</th>
                <th style={{ width: 160 }}>Тип</th>
                <th style={{ width: 120 }}>Вопросов</th>
                <th style={{ width: 240 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14 }}>
                    {selected ? "Заданий пока нет" : "Выберите материал"}
                  </td>
                </tr>
              ) : (
                rows.map((a, idx) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{idx + 1}</strong>
                    </td>
                    <td>{a.title}</td>
                    <td>{a.order_index ?? 0}</td>
                    <td>{guessTypeLabel(a)}</td>
                    <td>{questionsCount(a)}</td>
                    <td>
                      <button className="btn small" onClick={() => openEdit(a)} type="button">
                        ✏️ Редактировать
                      </button>{" "}
                      <button className="btn small secondary" onClick={() => void removeAssignment(a)} type="button">
                        🗑️ Удалить
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
