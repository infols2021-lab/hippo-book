"use client";

import { useEffect, useMemo, useState } from "react";
import LoadingBlock from "@/components/LoadingBlock";
import ErrorBox from "@/components/ErrorBox";

import type { EditorMode, AssignmentMode, Question, InfoBlock, FeedbackRange } from "./builder/types";
import { deepClone, newQuestion, newBlock } from "./builder/types";
import { validateQuestions, validateBlocks, validateFeedbackRanges } from "./builder/validate";

import QuestionList from "./builder/QuestionList";
import BlockList from "./builder/blocks/BlockList";
import JsonEditor from "./builder/json/JsonEditor";

export type MaterialOption = {
  id: string;
  title: string;
  project_tabs?: { name: string; icon: string | null };
  projects?: { name: string; slug: string };
  branch_type?: string;
  kind?: string;
  material_kind?: string;
};

type AssignmentRow = {
  id: string;
  title: string;
  order_index: number | null;
  material_id?: string | null;
  assignment_type?: string | null;
  content: any;
  branch_type?: string | null;
  textbook_id?: string | null;
  crossword_id?: string | null;
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
  if (material.project_tabs?.icon) return material.project_tabs.icon;
  if (material.kind === "textbook") return "📚";
  if (material.kind === "crossword") return "🧩";
  return "📄";
}

function materialLabel(material: MaterialOption | null) {
  if (!material) return "—";
  const icon = materialIcon(material);
  const tabName = material.project_tabs?.name ? `[${material.project_tabs.name}] ` : "";
  return `${icon} ${tabName}${material.title}`;
}

function getProjectName(material: MaterialOption | null) {
  if (!material) return "—";
  if (material.projects?.name) return material.projects.name;
  if (material.branch_type === "gatehouse") return "Gatehouse Awards";
  return "Олимпиада";
}

export default function AssignmentEditor({ material, editing, onCancel, onSaved }: Props) {
  const [mode, setMode] = useState<EditorMode>("visual");
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("interactive");

  const [title, setTitle] = useState<string>(editing?.title ?? "");
  const [orderIndex, setOrderIndex] = useState<number>(Number(editing?.order_index ?? 0));

  const initialQuestions: Question[] = useMemo(() => {
    const qs = editing?.content?.questions;
    if (Array.isArray(qs) && qs.length) return deepClone(qs);
    return [newQuestion("test")];
  }, [editing]);

  const initialBlocks: InfoBlock[] = useMemo(() => {
    const blks = editing?.content?.blocks;
    if (Array.isArray(blks) && blks.length) return deepClone(blks);
    return [newBlock("hero")];
  }, [editing]);

  const initialFeedbackRanges: FeedbackRange[] = useMemo(() => {
    const ranges = editing?.content?.feedbackRanges;
    if (Array.isArray(ranges) && ranges.length) return deepClone(ranges);
    return [];
  }, [editing]);

  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [blocks, setBlocks] = useState<InfoBlock[]>(initialBlocks);
  const [feedbackRanges, setFeedbackRanges] = useState<FeedbackRange[]>(initialFeedbackRanges);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTitle(editing?.title ?? "");
    setOrderIndex(Number(editing?.order_index ?? 0));

    const content = editing?.content;
    
    if (editing?.assignment_type === "intro" || content?.mode === "informational") {
      setAssignmentMode("informational");
    } else {
      setAssignmentMode("interactive");
    }

    const qs = content?.questions;
    setQuestions(Array.isArray(qs) && qs.length ? deepClone(qs) : [newQuestion("test")]);

    const blks = content?.blocks;
    setBlocks(Array.isArray(blks) && blks.length ? deepClone(blks) : [newBlock("hero")]);

    const ranges = content?.feedbackRanges;
    setFeedbackRanges(Array.isArray(ranges) && ranges.length ? deepClone(ranges) : []);

    setMode("visual");
    setErr(null);
  }, [editing]);

  function addDefaultRanges() {
    setFeedbackRanges([
      { id: crypto.randomUUID(), minPercent: 0, maxPercent: 40, text: "Нужно ещё повторить материал и попробовать снова!" },
      { id: crypto.randomUUID(), minPercent: 41, maxPercent: 75, text: "Хороший результат! Вы усвоили базовую часть." },
      { id: crypto.randomUUID(), minPercent: 76, maxPercent: 100, text: "Превосходная работа! Вы блестяще справились с заданием!" },
    ]);
  }

  function addRange() {
    setFeedbackRanges((prev) => [
      ...prev,
      { id: crypto.randomUUID(), minPercent: 0, maxPercent: 100, text: "" },
    ]);
  }

  function updateRange(index: number, field: keyof FeedbackRange, value: any) {
    setFeedbackRanges((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function removeRange(index: number) {
    setFeedbackRanges((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    if (!material) return setErr("Сначала выберите материал");
    if (!title.trim()) return setErr("Введите название задания");

    let finalContent: any = {};

    if (assignmentMode === "informational") {
      const vr = validateBlocks(blocks);
      if (!vr.ok) {
        const text = vr.issues.map((i) => (i.index >= 0 ? `Блок #${i.index + 1}: ${i.message}` : i.message)).join("\n");
        return setErr(text || "Ошибки в блоках");
      }
      finalContent = { mode: "informational", blocks };
    } else {
      const vr = validateQuestions(questions);
      if (!vr.ok) {
        const text = vr.issues.map((i) => (i.index >= 0 ? `Вопрос #${i.index + 1}: ${i.message}` : i.message)).join("\n");
        return setErr(text || "Ошибки в вопросах");
      }

      const rangeIssues = validateFeedbackRanges(feedbackRanges);
      if (rangeIssues.length > 0) {
        return setErr(rangeIssues.map((i) => i.message).join("\n"));
      }

      finalContent = {
        mode: "interactive",
        questions,
        feedbackRanges: feedbackRanges.filter((r) => r.text.trim()),
      };
    }

    setErr(null);
    setSaving(true);

    try {
      const payload: any = {
        title: title.trim(),
        order_index: Number.isFinite(orderIndex) ? orderIndex : 0,
        content: finalContent,
        assignment_type: assignmentMode === "informational" ? "intro" : "test",
        material_id: material.id,
        branch_type: material.projects?.slug || material.branch_type || "olympiad",
        kind: material.kind,
        material_kind: material.material_kind ?? material.kind,
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
            Ветка (Проект): <strong>{getProjectName(material)}</strong>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span className="material-badge text-xl">{materialIcon(material)}</span>

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
          <label className="small-muted">Порядок сортировки</label>
          <input
            className="input"
            type="number"
            value={orderIndex}
            onChange={(e) => setOrderIndex(Number(e.target.value))}
            disabled={saving}
          />
        </div>
      </div>

      <div style={{ marginTop: 16, background: "#f8fafc", padding: "12px 16px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <label className="small-muted" style={{ display: "block", marginBottom: 8 }}>Тип задания</label>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 500, color: "#1e293b" }}>
            <input 
              type="radio" 
              name="assignmentMode" 
              checked={assignmentMode === "interactive"} 
              onChange={() => setAssignmentMode("interactive")} 
              disabled={saving} 
            />
            📝 Интерактивное (Вопросы, Тесты)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontWeight: 500, color: "#1e293b" }}>
            <input 
              type="radio" 
              name="assignmentMode" 
              checked={assignmentMode === "informational"} 
              onChange={() => setAssignmentMode("informational")} 
              disabled={saving} 
            />
            📖 Ознакомительное (Гайды, Блоки)
          </label>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {mode === "visual" ? (
        assignmentMode === "interactive" ? (
          <>
            <QuestionList value={questions} onChange={setQuestions} disabled={saving} />

            {/* БЛОК НАСТРОЙКИ КАСТОМНЫХ ТЕКСТОВ ПО ПРОЦЕНТАМ */}
            <div style={{ marginTop: 24, padding: 16, background: "#ffffff", borderRadius: 12, border: "1px solid #cbd5e1", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>💬 Сообщения на финальном экране (Кастомный фидбек)</h4>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748b" }}>Укажите, какой текст получит ученик при определенном % прохождения (если не настроено — сработают стандарты).</p>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  {feedbackRanges.length === 0 && (
                    <button type="button" className="btn small secondary" onClick={addDefaultRanges} disabled={saving}>
                      🪄 Заполнить шаблоном
                    </button>
                  )}
                  <button type="button" className="btn small" onClick={addRange} disabled={saving}>
                    ➕ Добавить диапазон
                  </button>
                </div>
              </div>

              {feedbackRanges.length === 0 ? (
                <div style={{ padding: 12, background: "#f8fafc", borderRadius: 8, border: "1px dashed #cbd5e1", textAlign: "center", fontSize: 13, color: "#64748b" }}>
                  Кастомные сообщения не настроены. Будет показываться стандартная похвала по умолчанию.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {feedbackRanges.map((range, idx) => (
                    <div key={range.id || idx} style={{ display: "flex", gap: 10, alignItems: "center", background: "#f8fafc", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>От</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className="input"
                          style={{ width: 60, padding: "6px 8px", fontSize: 13, textAlign: "center" }}
                          value={range.minPercent}
                          onChange={(e) => updateRange(idx, "minPercent", Number(e.target.value))}
                          disabled={saving}
                        />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>% до</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className="input"
                          style={{ width: 60, padding: "6px 8px", fontSize: 13, textAlign: "center" }}
                          value={range.maxPercent}
                          onChange={(e) => updateRange(idx, "maxPercent", Number(e.target.value))}
                          disabled={saving}
                        />
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>%:</span>
                      </div>

                      <input
                        type="text"
                        className="input"
                        style={{ flex: 1, padding: "6px 12px", fontSize: 13 }}
                        placeholder="Введите сообщение для ученика..."
                        value={range.text}
                        onChange={(e) => updateRange(idx, "text", e.target.value)}
                        disabled={saving}
                      />

                      <button
                        type="button"
                        className="btn small ghost"
                        style={{ color: "#ef4444", padding: "6px 10px" }}
                        onClick={() => removeRange(idx)}
                        disabled={saving}
                        title="Удалить диапазон"
                      >
                        ✖
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <BlockList value={blocks} onChange={setBlocks} disabled={saving} />
        )
      ) : (
        <JsonEditor 
          value={(assignmentMode === "interactive" ? questions : blocks) as any[]} 
          arrayKey={assignmentMode === "interactive" ? "questions" : "blocks"}
          onChange={(next) => assignmentMode === "interactive" ? setQuestions(next as any) : setBlocks(next as any)} 
          disabled={saving} 
        />
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24, flexWrap: "wrap" }}>
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