"use client";

import { useEffect, useMemo, useState } from "react";
import LoadingBlock from "@/components/LoadingBlock";
import ErrorBox from "@/components/ErrorBox";

import type { EditorMode, Question } from "./builder/types";
import { deepClone, newQuestion } from "./builder/types";
import { validateQuestions } from "./builder/validate";

import QuestionList from "./builder/QuestionList";
import JsonEditor from "./builder/json/JsonEditor";

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
};

type Props = {
  material: MaterialOption | null;
  editing: AssignmentRow | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
};

async function safeJson(res: Response) {
  const text = await res.text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text };
  }
}

function materialIcon(material: MaterialOption | null) {
  if (!material) return "—";
  if (material.kind === "textbook") return "📚";
  if (material.kind === "crossword") return "🧩";
  return "🎓";
}

function materialLabel(material: MaterialOption | null) {
  if (!material) return "—";

  if (material.kind === "textbook") return `📚 ${material.title}`;
  if (material.kind === "crossword") return `🧩 ${material.title}`;

  return `🎓 ${material.title}`;
}

export default function AssignmentEditor({ material, editing, onCancel, onSaved }: Props) {
  const [mode, setMode] = useState<EditorMode>("visual");

  const [title, setTitle] = useState<string>(editing?.title ?? "");
  const [orderIndex, setOrderIndex] = useState<number>(Number(editing?.order_index ?? 0));

  const initialQuestions: Question[] = useMemo(() => {
    const qs = editing?.content?.questions;
    if (Array.isArray(qs) && qs.length) return deepClone(qs);
    return [newQuestion("test")];
  }, [editing]);

  const [questions, setQuestions] = useState<Question[]>(initialQuestions);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTitle(editing?.title ?? "");
    setOrderIndex(Number(editing?.order_index ?? 0));

    const qs = editing?.content?.questions;
    setQuestions(Array.isArray(qs) && qs.length ? deepClone(qs) : [newQuestion("test")]);

    setMode("visual");
    setErr(null);
  }, [editing]);

  async function save() {
    if (!material) {
      setErr("Сначала выберите материал");
      return;
    }

    if (!title.trim()) {
      setErr("Введите название задания");
      return;
    }

    const vr = validateQuestions(questions);

    if (!vr.ok) {
      const text = vr.issues.map((i) => (i.index >= 0 ? `#${i.index + 1}: ${i.message}` : i.message)).join("\n");
      setErr(text || "Ошибки в вопросах");
      return;
    }

    setErr(null);
    setSaving(true);

    try {
      const payload: any = {
        title: title.trim(),
        order_index: Number.isFinite(orderIndex) ? orderIndex : 0,
        content: { questions },

        branch_type: material.branch_type,

        kind: material.kind,
        material_kind: material.material_kind ?? material.kind,

        material_id: material.kind === "material" ? material.id : null,

        textbook_id: material.kind === "textbook" ? material.id : null,
        crossword_id: material.kind === "crossword" ? material.id : null,
      };

      const url = editing?.id ? `/api/admin/assignments/${encodeURIComponent(editing.id)}` : `/api/admin/assignments`;
      const method = editing?.id ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await safeJson(res);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }

      await onSaved();
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: 0 }}>{editing ? "✏️ Редактирование задания" : "➕ Новое задание"}</h3>
          <div className="small-muted" style={{ marginTop: 4 }}>
            Материал: <strong>{material ? materialLabel(material) : "—"}</strong>
          </div>
          <div className="small-muted" style={{ marginTop: 4 }}>
            Раздел: <strong>{material?.branch_type === "gatehouse" ? "🎓 Gatehouse Awards" : "🏆 Олимпиада"}</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="material-badge">{materialIcon(material)}</span>

          <button
            className={`btn small ${mode === "visual" ? "" : "ghost"}`}
            type="button"
            onClick={() => setMode("visual")}
            disabled={saving}
          >
            🎨 Редактор
          </button>

          <button
            className={`btn small ${mode === "json" ? "" : "ghost"}`}
            type="button"
            onClick={() => setMode("json")}
            disabled={saving}
          >
            📄 JSON
          </button>
        </div>
      </div>

      <div style={{ height: 12 }} />

      {err ? <ErrorBox message={err} retryMode="none" /> : null}
      {saving ? <LoadingBlock text="Сохраняем..." /> : null}

      <div className="row" style={{ marginTop: 10 }}>
        <div className="col" style={{ flex: 1 }}>
          <label className="small-muted">Название</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} />
        </div>

        <div className="col" style={{ width: 140 }}>
          <label className="small-muted">Порядок</label>
          <input
            className="input"
            type="number"
            value={orderIndex}
            onChange={(e) => setOrderIndex(Number(e.target.value))}
            disabled={saving}
          />
        </div>
      </div>

      <div style={{ height: 12 }} />

      {mode === "visual" ? (
        <QuestionList value={questions} onChange={setQuestions} disabled={saving} />
      ) : (
        <JsonEditor value={questions as any[]} onChange={(next) => setQuestions(next as any)} disabled={saving} />
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14, flexWrap: "wrap" }}>
        <button className="btn" type="button" onClick={() => void save()} disabled={saving}>
          💾 Сохранить
        </button>

        <button className="btn secondary" type="button" onClick={onCancel} disabled={saving}>
          ❌ Отмена
        </button>
      </div>
    </div>
  );
}