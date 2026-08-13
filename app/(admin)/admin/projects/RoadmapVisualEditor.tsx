"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  RoadmapExamConfig,
  RoadmapSegment,
  RoadmapStructure,
} from "@/lib/roadmap/types";
import {
  ROADMAP_PACK_FORMAT,
  ROADMAP_PACK_VERSION,
} from "@/lib/roadmap/types";
import { buildCourse30Template } from "@/lib/roadmap/templates/course30";

type Props = {
  materialId: string;
  materialTitle: string;
};

function emptyStructure(): RoadmapStructure {
  return {
    format: ROADMAP_PACK_FORMAT,
    version: ROADMAP_PACK_VERSION,
    title: "",
    description: "",
    segments: [],
  };
}

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function RoadmapVisualEditor({ materialId, materialTitle }: Props) {
  const [structure, setStructure] = useState<RoadmapStructure>(emptyStructure);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStructure = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/roadmap/${materialId}`, { cache: "no-store" });
      const json = await res.json().catch(() => null);
      const payload = json?.data ?? json;

      if (!res.ok || json?.ok === false) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      const saved = payload?.roadmap?.structure;
      if (saved && typeof saved === "object") {
        setStructure(saved as RoadmapStructure);
      } else {
        setStructure({
          ...emptyStructure(),
          title: materialTitle,
        });
      }
    } catch (err: any) {
      setError(String(err?.message || err || "Не удалось загрузить roadmap"));
      setStructure({ ...emptyStructure(), title: materialTitle });
    } finally {
      setLoading(false);
    }
  }, [materialId, materialTitle]);

  useEffect(() => {
    void loadStructure();
  }, [loadStructure]);

  function updateSegment(index: number, patch: Partial<RoadmapSegment>) {
    setStructure((prev) => {
      const segments = [...prev.segments];
      segments[index] = { ...segments[index], ...patch } as RoadmapSegment;
      return { ...prev, segments };
    });
  }

  function moveSegment(index: number, direction: -1 | 1) {
    setStructure((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.segments.length) return prev;
      const segments = [...prev.segments];
      const [item] = segments.splice(index, 1);
      segments.splice(nextIndex, 0, item);
      return { ...prev, segments };
    });
  }

  function removeSegment(index: number) {
    setStructure((prev) => ({
      ...prev,
      segments: prev.segments.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function addBlock() {
    const id = newId("block");
    setStructure((prev) => ({
      ...prev,
      segments: [
        ...prev.segments,
        {
          kind: "block",
          id,
          title: "Новый блок",
          stars_required: 0,
          nodes: [
            {
              id: newId("lesson"),
              type: "lesson",
              title: "Новый урок",
              assignment_id: null,
            },
          ],
        },
      ],
    }));
  }

  function addExam() {
    const id = newId("exam");
    const nodeId = `${id}-node`;
    setStructure((prev) => ({
      ...prev,
      segments: [
        ...prev.segments,
        {
          kind: "exam",
          id,
          title: "Новый экзамен",
          node: {
            id: nodeId,
            type: "exam",
            title: "Новый экзамен",
            assignment_id: null,
            exam: {
              time_limit_sec: 480,
              pass_percent: 80,
              unlimited_attempts: true,
            },
          },
        },
      ],
    }));
  }

  function addCertificate() {
    setStructure((prev) => ({
      ...prev,
      segments: [
        ...prev.segments,
        {
          kind: "certificate",
          id: newId("certificate"),
          title: "Сертификат",
          enabled: true,
        },
      ],
    }));
  }

  async function handleSave() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/admin/roadmap/${materialId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(structure),
      });
      const json = await res.json().catch(() => null);
      const payload = json?.data ?? json;

      if (!res.ok || json?.ok === false) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      if (payload?.structure) {
        setStructure(payload.structure as RoadmapStructure);
      }

      setMessage("Структура roadmap сохранена.");
    } catch (err: any) {
      setError(String(err?.message || err || "Ошибка сохранения"));
    } finally {
      setBusy(false);
    }
  }

  async function handleLoadTemplate() {
    if (
      !window.confirm(
        "Импортировать шаблон на 30 заданий? Будут созданы задания и обновлена структура roadmap.",
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const template = buildCourse30Template();
      const res = await fetch(`/api/admin/roadmap/${materialId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });
      const json = await res.json().catch(() => null);
      const payload = json?.data ?? json;

      if (!res.ok || json?.ok === false) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      if (payload?.structure) {
        setStructure(payload.structure as RoadmapStructure);
      } else {
        await loadStructure();
      }

      setMessage(
        `Шаблон импортирован. Создано заданий: ${payload?.assignments_created ?? 0}.`,
      );
    } catch (err: any) {
      setError(String(err?.message || err || "Ошибка импорта шаблона"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="roadmap-editor-loading">Загрузка редактора...</div>;
  }

  return (
    <div className="roadmap-visual-editor">
      <div className="roadmap-visual-head">
        <div>
          <h4 className="roadmap-import-title">Визуальный редактор дорожки</h4>
          <p className="roadmap-import-subtitle">
            Редактируйте блоки, экзамены и сертификат. Для создания inline-заданий используйте JSON-импорт ниже.
          </p>
        </div>
        <div className="roadmap-visual-head-actions">
          <button type="button" className="btn secondary" onClick={() => void handleLoadTemplate()}>
            Шаблон 30 заданий
          </button>
          <a
            href="/docs/roadmap-course-30.template.json"
            target="_blank"
            rel="noreferrer"
            className="roadmap-import-template-link"
          >
            JSON шаблон
          </a>
        </div>
      </div>

      <div className="roadmap-visual-meta">
        <label className="roadmap-visual-field">
          <span>Название курса</span>
          <input
            value={structure.title ?? ""}
            onChange={(e) => setStructure((prev) => ({ ...prev, title: e.target.value }))}
          />
        </label>
        <label className="roadmap-visual-field">
          <span>Описание</span>
          <input
            value={structure.description ?? ""}
            onChange={(e) => setStructure((prev) => ({ ...prev, description: e.target.value }))}
          />
        </label>
      </div>

      <div className="roadmap-visual-toolbar">
        <button type="button" className="btn secondary" onClick={addBlock}>+ Блок</button>
        <button type="button" className="btn secondary" onClick={addExam}>+ Экзамен</button>
        <button type="button" className="btn secondary" onClick={addCertificate}>+ Сертификат</button>
      </div>

      <div className="roadmap-visual-segments">
        {structure.segments.map((segment, index) => (
          <div key={`${segment.id}-${index}`} className="roadmap-visual-segment">
            <div className="roadmap-visual-segment-head">
              <div className="roadmap-visual-segment-kind">
                {segment.kind === "block" ? "Блок" : segment.kind === "exam" ? "Экзамен" : "Сертификат"}
              </div>
              <div className="roadmap-visual-segment-actions">
                <button type="button" className="btn tiny" onClick={() => moveSegment(index, -1)} disabled={index === 0}>↑</button>
                <button type="button" className="btn tiny" onClick={() => moveSegment(index, 1)} disabled={index === structure.segments.length - 1}>↓</button>
                <button type="button" className="btn tiny danger" onClick={() => removeSegment(index)}>Удалить</button>
              </div>
            </div>

            <label className="roadmap-visual-field">
              <span>Заголовок сегмента</span>
              <input
                value={segment.title}
                onChange={(e) => updateSegment(index, { title: e.target.value } as Partial<RoadmapSegment>)}
              />
            </label>

            {segment.kind === "block" ? (
              <>
                <label className="roadmap-visual-field">
                  <span>Звезд для перехода</span>
                  <input
                    type="number"
                    min={0}
                    value={segment.stars_required}
                    onChange={(e) =>
                      updateSegment(index, {
                        stars_required: Number(e.target.value),
                      } as Partial<RoadmapSegment>)
                    }
                  />
                </label>

                <div className="roadmap-visual-nodes">
                  {segment.nodes.map((node, nodeIndex) => (
                    <div key={node.id} className="roadmap-visual-node">
                      <label className="roadmap-visual-field">
                        <span>Урок {nodeIndex + 1}</span>
                        <input
                          value={node.title}
                          onChange={(e) => {
                            const nodes = [...segment.nodes];
                            nodes[nodeIndex] = { ...node, title: e.target.value };
                            updateSegment(index, { nodes } as Partial<RoadmapSegment>);
                          }}
                        />
                      </label>
                      <label className="roadmap-visual-field">
                        <span>assignment_id</span>
                        <input
                          value={node.assignment_id ?? ""}
                          onChange={(e) => {
                            const nodes = [...segment.nodes];
                            nodes[nodeIndex] = {
                              ...node,
                              assignment_id: e.target.value.trim() || null,
                            };
                            updateSegment(index, { nodes } as Partial<RoadmapSegment>);
                          }}
                          placeholder="UUID задания"
                        />
                      </label>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => {
                      const nodes = [
                        ...segment.nodes,
                        {
                          id: newId("lesson"),
                          type: "lesson" as const,
                          title: `Урок ${segment.nodes.length + 1}`,
                          assignment_id: null,
                        },
                      ];
                      updateSegment(index, { nodes } as Partial<RoadmapSegment>);
                    }}
                  >
                    + Урок
                  </button>
                </div>
              </>
            ) : null}

            {segment.kind === "exam" ? (
              <>
                <label className="roadmap-visual-field">
                  <span>assignment_id экзамена</span>
                  <input
                    value={segment.node.assignment_id ?? ""}
                    onChange={(e) =>
                      updateSegment(index, {
                        node: {
                          ...segment.node,
                          assignment_id: e.target.value.trim() || null,
                        },
                      } as Partial<RoadmapSegment>)
                    }
                    placeholder="UUID задания"
                  />
                </label>
                <div className="roadmap-visual-exam-grid">
                  <label className="roadmap-visual-field">
                    <span>Лимит (мин)</span>
                    <input
                      type="number"
                      min={1}
                      value={Math.round((segment.node.exam?.time_limit_sec ?? 480) / 60)}
                      onChange={(e) => {
                        const exam: RoadmapExamConfig = {
                          time_limit_sec: Math.max(60, Number(e.target.value) * 60),
                          pass_percent: segment.node.exam?.pass_percent ?? 80,
                          unlimited_attempts: segment.node.exam?.unlimited_attempts !== false,
                        };
                        updateSegment(index, {
                          node: { ...segment.node, exam },
                        } as Partial<RoadmapSegment>);
                      }}
                    />
                  </label>
                  <label className="roadmap-visual-field">
                    <span>Порог (%)</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={segment.node.exam?.pass_percent ?? 80}
                      onChange={(e) => {
                        const exam: RoadmapExamConfig = {
                          time_limit_sec: segment.node.exam?.time_limit_sec ?? 480,
                          pass_percent: Math.max(1, Math.min(100, Number(e.target.value))),
                          unlimited_attempts: segment.node.exam?.unlimited_attempts !== false,
                        };
                        updateSegment(index, {
                          node: { ...segment.node, exam },
                        } as Partial<RoadmapSegment>);
                      }}
                    />
                  </label>
                </div>
              </>
            ) : null}

            {segment.kind === "certificate" ? (
              <label className="roadmap-visual-checkbox">
                <input
                  type="checkbox"
                  checked={segment.enabled !== false}
                  onChange={(e) =>
                    updateSegment(index, { enabled: e.target.checked } as Partial<RoadmapSegment>)
                  }
                />
                <span>Сертификат включен</span>
              </label>
            ) : null}
          </div>
        ))}

        {structure.segments.length === 0 ? (
          <div className="roadmap-visual-empty">Добавьте первый сегмент или загрузите шаблон.</div>
        ) : null}
      </div>

      <div className="roadmap-import-actions">
        <button type="button" className="btn" disabled={busy} onClick={() => void handleSave()}>
          {busy ? "Сохранение..." : "Сохранить структуру"}
        </button>
      </div>

      {message ? <div className="roadmap-import-message is-success">{message}</div> : null}
      {error ? <div className="roadmap-import-message is-error">{error}</div> : null}
    </div>
  );
}
