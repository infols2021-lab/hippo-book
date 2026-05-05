"use client";

import { useEffect, useMemo, useState } from "react";
import LoadingBlock from "@/components/LoadingBlock";
import ErrorBox from "@/components/ErrorBox";
import AssignmentEditor from "./AssignmentEditor";

type BranchType = "olympiad" | "gatehouse";

type MaterialOption =
  | {
      branch_type: "olympiad";
      kind: "textbook";
      id: string;
      title: string;
      material_kind?: "textbook";
    }
  | {
      branch_type: "olympiad";
      kind: "crossword";
      id: string;
      title: string;
      material_kind?: "crossword";
    }
  | {
      branch_type: "gatehouse";
      kind: "material";
      id: string;
      title: string;
      material_kind: string;
    };

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

function materialEmoji(material: MaterialOption | null) {
  if (!material) return "";
  if (material.kind === "textbook") return "📚";
  if (material.kind === "crossword") return "🧩";
  return "🎓";
}

function materialKindLabel(material: MaterialOption) {
  if (material.kind === "textbook") return "Учебник";
  if (material.kind === "crossword") return "Кроссворд";

  const map: Record<string, string> = {
    mock_test: "Пробный тест",
    mock_tests: "Пробные тесты",
  };

  return map[String(material.material_kind || "").toLowerCase()] || material.material_kind || "Материал";
}

export default function AssignmentsTab({ onChanged }: Props) {
  const [branch, setBranch] = useState<BranchType>("olympiad");

  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [selected, setSelected] = useState<MaterialOption | null>(null);

  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AssignmentRow | null>(null);

  const selectedKey = useMemo(() => {
    if (!selected) return "";
    return `${selected.branch_type}_${selected.kind}_${selected.id}`;
  }, [selected]);

  const visibleMaterials = useMemo(() => {
    return materials.filter((m) => m.branch_type === branch);
  }, [materials, branch]);

  async function loadMaterials() {
    const [tRes, cRes, mRes] = await Promise.all([
      fetch("/api/admin/textbooks", { cache: "no-store" }),
      fetch("/api/admin/crosswords", { cache: "no-store" }),
      fetch("/api/admin/materials?branch_type=gatehouse", { cache: "no-store" }),
    ]);

    const tJson = await tRes.json();
    const cJson = await cRes.json();
    const mJson = await mRes.json();

    if (!tRes.ok || !tJson?.ok) throw new Error(tJson?.error || "Не удалось загрузить учебники");
    if (!cRes.ok || !cJson?.ok) throw new Error(cJson?.error || "Не удалось загрузить кроссворды");
    if (!mRes.ok || !mJson?.ok) throw new Error(mJson?.error || "Не удалось загрузить материалы Gatehouse");

    const tb: MaterialOption[] = (tJson.textbooks ?? [])
      .filter((x: any) => !x.branch_type || x.branch_type === "olympiad")
      .map((x: any) => ({
        branch_type: "olympiad",
        kind: "textbook",
        material_kind: "textbook",
        id: String(x.id),
        title: String(x.title ?? "Без названия"),
      }));

    const cw: MaterialOption[] = (cJson.crosswords ?? [])
      .filter((x: any) => !x.branch_type || x.branch_type === "olympiad")
      .map((x: any) => ({
        branch_type: "olympiad",
        kind: "crossword",
        material_kind: "crossword",
        id: String(x.id),
        title: String(x.title ?? "Без названия"),
      }));

    const ga: MaterialOption[] = (mJson.materials ?? [])
      .filter((x: any) => x.branch_type === "gatehouse")
      .map((x: any) => ({
        branch_type: "gatehouse",
        kind: "material",
        material_kind: String(x.material_kind ?? "mock_test"),
        id: String(x.id),
        title: String(x.title ?? "Без названия"),
      }));

    const all = [...tb, ...cw, ...ga];
    setMaterials(all);

    if (selected) {
      const found =
        all.find((m) => m.branch_type === selected.branch_type && m.kind === selected.kind && m.id === selected.id) ||
        null;

      setSelected(found);
    } else {
      setSelected(null);
    }
  }

  async function loadAssignments(material: MaterialOption | null) {
    if (!material) {
      setRows([]);
      return;
    }

    const qs = new URLSearchParams();

    if (material.branch_type === "gatehouse") {
      qs.set("branch_type", "gatehouse");
      qs.set("kind", "material");
      qs.set("id", material.id);
      qs.set("material_id", material.id);
    } else {
      qs.set("branch_type", "olympiad");
      qs.set("kind", material.kind);
      qs.set("id", material.id);
    }

    const res = await fetch(`/api/admin/assignments?${qs.toString()}`, { cache: "no-store" });
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

  useEffect(() => {
    setSelected(null);
    setRows([]);
    setEditorOpen(false);
    setEditing(null);
  }, [branch]);

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
      json = null;
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
      <div className="admin-section-head">
        <div>
          <h2>📝 Управление заданиями</h2>
          <p>Один движок заданий используется и для олимпиады, и для Gatehouse Awards.</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <button
          className={branch === "olympiad" ? "btn" : "btn ghost"}
          type="button"
          onClick={() => setBranch("olympiad")}
        >
          🏆 Олимпиада
        </button>

        <button
          className={branch === "gatehouse" ? "btn" : "btn ghost"}
          type="button"
          onClick={() => setBranch("gatehouse")}
        >
          🎓 Экзамены Gatehouse
        </button>
      </div>

      {loading ? <LoadingBlock text="Загружаем задания..." /> : null}
      {err ? <ErrorBox message={err} /> : null}

      <div className="admin-controls" style={{ marginTop: 10 }}>
        <select
          className="input"
          value={selected ? `${selected.branch_type}_${selected.kind}_${selected.id}` : ""}
          onChange={(e) => {
            const v = e.target.value;

            if (!v) {
              setSelected(null);
              return;
            }

            const found = materials.find((m) => `${m.branch_type}_${m.kind}_${m.id}` === v) || null;
            setSelected(found);
          }}
        >
          <option value="">
            {branch === "gatehouse" ? "-- Выберите материал Gatehouse --" : "-- Выберите учебник или кроссворд --"}
          </option>

          {branch === "olympiad" ? (
            <>
              <optgroup label="📚 Учебники">
                {visibleMaterials
                  .filter((m) => m.kind === "textbook")
                  .map((m) => (
                    <option key={`tb-${m.id}`} value={`${m.branch_type}_${m.kind}_${m.id}`}>
                      {m.title}
                    </option>
                  ))}
              </optgroup>

              <optgroup label="🧩 Кроссворды">
                {visibleMaterials
                  .filter((m) => m.kind === "crossword")
                  .map((m) => (
                    <option key={`cw-${m.id}`} value={`${m.branch_type}_${m.kind}_${m.id}`}>
                      {m.title}
                    </option>
                  ))}
              </optgroup>
            </>
          ) : (
            <optgroup label="🎓 Пробные тесты">
              {visibleMaterials
                .filter((m) => m.kind === "material")
                .map((m) => (
                  <option key={`ga-${m.id}`} value={`${m.branch_type}_${m.kind}_${m.id}`}>
                    {m.title}
                  </option>
                ))}
            </optgroup>
          )}
        </select>

        <button className="btn" onClick={openCreate} disabled={!selected} type="button">
          ➕ Создать задание
        </button>
      </div>

      {selected ? (
        <div className="small-muted" style={{ marginTop: 10, fontWeight: 800 }}>
          Выбрано: {materialEmoji(selected)} {materialKindLabel(selected)} · {selected.title}
        </div>
      ) : null}

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