"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  value: any[];                 // массив вопросов или блоков
  arrayKey: "questions" | "blocks"; // ключ, под которым массив хранится в JSON
  onChange: (next: any[]) => void;
  disabled?: boolean;
};

export default function JsonEditor({ value, arrayKey, onChange, disabled }: Props) {
  const pretty = useMemo(
    () => JSON.stringify({ [arrayKey]: value }, null, 2),
    [value, arrayKey]
  );
  const [text, setText] = useState(pretty);
  const [error, setError] = useState<string | null>(null);

  // синхронизация при изменении value из визуального редактора
  useEffect(() => {
    setText(pretty);
  }, [pretty]);

  function applyJson() {
    try {
      const parsed = JSON.parse(text);

      if (!parsed || !Array.isArray(parsed[arrayKey])) {
        throw new Error(
          `JSON должен иметь формат { "${arrayKey}": [...] }`
        );
      }

      onChange(parsed[arrayKey]);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Ошибка JSON");
    }
  }

  return (
    <div className="card" style={{ padding: 14 }}>
      <h3 style={{ marginTop: 0 }}>🧩 JSON редактор</h3>

      <textarea
        className="input"
        style={{ fontFamily: "monospace", minHeight: 320 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
      />

      {error ? (
        <div className="error" style={{ display: "block", marginTop: 10 }}>
          ❌ {error}
        </div>
      ) : (
        <div className="small-muted" style={{ marginTop: 8 }}>
          Можно править вручную или вернуться в визуальный режим
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          className="btn"
          type="button"
          onClick={applyJson}
          disabled={disabled}
        >
          ✅ Применить JSON
        </button>
      </div>
    </div>
  );
}