"use client";

import { useState } from "react";

type Props = {
  materialId: string;
  materialTitle: string;
};

export default function RoadmapImportPanel({ materialId, materialTitle }: Props) {
  const [jsonText, setJsonText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const parsed = JSON.parse(jsonText);
      const res = await fetch(`/api/admin/roadmap/${materialId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });

      const data = await res.json().catch(() => null);
      const payload = data?.data ?? data;

      if (!res.ok || data?.ok === false) {
        throw new Error(payload?.error || data?.error || `HTTP ${res.status}`);
      }

      setMessage(
        `Roadmap импортирован для «${materialTitle}». Создано/привязано заданий: ${payload?.assignments_created ?? 0}.`,
      );
    } catch (err: any) {
      setError(String(err?.message || err || "Ошибка импорта"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="roadmap-import-panel">
      <div className="roadmap-import-head">
        <div>
          <h4 className="roadmap-import-title">Roadmap JSON</h4>
          <p className="roadmap-import-subtitle">
            Вставьте JSON формата hippo-book-roadmap. Блоки, экзамены и inline-задания создаются одним импортом.
          </p>
        </div>
        <a
          href="/docs/roadmap-course-30.template.json"
          target="_blank"
          rel="noreferrer"
          className="roadmap-import-template-link"
        >
          Шаблон 30 заданий
        </a>
        <a
          href="/docs/roadmap-import.example.json"
          target="_blank"
          rel="noreferrer"
          className="roadmap-import-template-link"
        >
          Минимальный пример
        </a>
      </div>

      <textarea
        className="roadmap-import-textarea"
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        placeholder='{"format":"hippo-book-roadmap","version":1,"segments":[...]}'
        rows={16}
        spellCheck={false}
      />

      <div className="roadmap-import-actions">
        <button
          type="button"
          className="btn"
          disabled={busy || !jsonText.trim()}
          onClick={() => void handleImport()}
        >
          {busy ? "Импорт..." : "Импортировать roadmap"}
        </button>
      </div>

      {message ? <div className="roadmap-import-message is-success">{message}</div> : null}
      {error ? <div className="roadmap-import-message is-error">{error}</div> : null}
    </div>
  );
}
