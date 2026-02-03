"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  value: any[];                 // questions[]
  onChange: (next: any[]) => void;
  disabled?: boolean;
};

export default function JsonEditor({ value, onChange, disabled }: Props) {
  const pretty = useMemo(() => JSON.stringify({ questions: value }, null, 2), [value]);
  const [text, setText] = useState(pretty);
  const [error, setError] = useState<string | null>(null);

  // 🔁 если value изменился из visual-редактора → обновляем JSON
  useEffect(() => {
    setText(pretty);
  }, [pretty]);

  function applyJson() {
    try {
      const parsed = JSON.parse(text);

      if (!parsed || !Array.isArray(parsed.questions)) {
        throw new Error('JSON должен иметь формат { "questions": [...] }');
      }

      onChange(parsed.questions);
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
