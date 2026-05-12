"use client";

import { useCallback } from "react";
import type { ReadingQuestion, TestQuestion } from "../types";
import { newQuestion } from "../types";
import MediaUpload from "../MediaUpload";
import TestEditor from "../test/TestEditor";

type Props = {
  value: ReadingQuestion;
  onChange: (next: ReadingQuestion) => void;
  disabled?: boolean;
};

export default function ReadingEditor({ value, onChange, disabled }: Props) {
  const subQuestions: TestQuestion[] = Array.isArray(value.subQuestions)
    ? value.subQuestions
    : [];

  const patch = useCallback(
    (partial: Partial<ReadingQuestion>) => {
      onChange({ ...value, ...partial });
    },
    [value, onChange],
  );

  const handleTextChange = (text: string) => patch({ text });

  const handleMediaChange = (media: any[]) => patch({ media });

  const updateSubQuestion = (index: number, nextQ: TestQuestion) => {
    const nextList = [...subQuestions];
    nextList[index] = nextQ;
    patch({ subQuestions: nextList });
  };

  const addSubQuestion = () => {
    const newQ = newQuestion("test") as TestQuestion;
    // зададим пустой вопрос, чтобы не было дефолтного текста
    newQ.q = "";
    patch({ subQuestions: [...subQuestions, newQ] });
  };

  const removeSubQuestion = (index: number) => {
    const nextList = subQuestions.filter((_, i) => i !== index);
    patch({ subQuestions: nextList });
  };

  return (
    <div className="form-group" style={{ marginTop: 16 }}>
      <label style={{ fontWeight: 800, display: "block", marginBottom: 8 }}>
        📖 Редактор типа «Чтение + тестовые вопросы»
      </label>

      {/* Общий текст / инструкция */}
      <div className="card" style={{ padding: 12, marginBottom: 14 }}>
        <label className="small-muted" style={{ fontWeight: 800, marginBottom: 6 }}>
          Текст или инструкция (общий для всех подвопросов):
        </label>
        <textarea
          className="question-textarea"
          rows={6}
          value={value.text ?? ""}
          placeholder="Введите текст для чтения или инструкцию..."
          disabled={disabled}
          onChange={(e) => handleTextChange(e.target.value)}
        />
      </div>

      {/* Общие медиа */}
      <div className="card" style={{ padding: 12, marginBottom: 14 }}>
        <MediaUpload
          value={value.media || []}
          onChange={handleMediaChange}
          disabled={disabled}
          bucket="question-images"
          label="Общие медиа для блока чтения (картинка, аудио, PDF):"
        />
      </div>

      {/* Подвопросы */}
      <div className="card" style={{ padding: 12, marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <label className="small-muted" style={{ fontWeight: 800 }}>
            Тестовые подвопросы ({subQuestions.length})
          </label>
          <button
            type="button"
            className="btn small"
            onClick={addSubQuestion}
            disabled={disabled}
          >
            ➕ Добавить подвопрос
          </button>
        </div>

        {subQuestions.length === 0 ? (
          <div className="small-muted">Нет подвопросов. Добавьте хотя бы один.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {subQuestions.map((sq, idx) => (
              <div
                key={sq.id || idx}
                style={{
                  position: "relative",
                  padding: 16,
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.1)",
                  borderRadius: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <span style={{ fontWeight: 800 }}>Подвопрос {idx + 1}</span>
                  <button
                    type="button"
                    className="btn small ghost btn-danger"
                    onClick={() => removeSubQuestion(idx)}
                    disabled={disabled || subQuestions.length <= 1}
                    title="Удалить подвопрос"
                  >
                    🗑️ Удалить
                  </button>
                </div>

                {/* Вопрос подвопроса */}
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="small-muted">Текст подвопроса:</label>
                  <textarea
                    className="question-textarea"
                    rows={2}
                    value={sq.q ?? ""}
                    placeholder="Введите текст вопроса..."
                    disabled={disabled}
                    onChange={(e) =>
                      updateSubQuestion(idx, { ...sq, q: e.target.value })
                    }
                  />
                </div>

                {/* Сам редактор тестовых вариантов */}
                <TestEditor
                  value={sq}
                  onChange={(next) => updateSubQuestion(idx, next)}
                  disabled={disabled}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}