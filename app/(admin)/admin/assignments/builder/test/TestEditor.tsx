"use client";

import type { TestOption, TestQuestion } from "../types";
import MediaUpload from "../MediaUpload";

type Props = {
  value: TestQuestion;
  onChange: (next: TestQuestion) => void;
  disabled?: boolean;
};

export default function TestEditor({ value, onChange, disabled }: Props) {
  function patch(p: Partial<TestQuestion>) {
    onChange({ ...value, ...p });
  }

  // ==== Нормализация старых данных для обратной совместимости ====
  const isMultiple = !!value.multiple;
  
  const options: TestOption[] = Array.isArray(value.options)
    ? value.options.map((opt: any) => {
        // Если старый формат (просто строка)
        if (typeof opt === "string") {
          return { id: crypto.randomUUID(), text: opt, media: [] };
        }
        return opt as TestOption;
      })
    : [];

  const correctIndices: number[] = Array.isArray(value.correct)
    ? value.correct
    : typeof value.correct === "number"
    ? [value.correct]
    : [];
  // ================================================================

  function handleOptionChange(index: number, updatedOption: Partial<TestOption>) {
    const nextOptions = [...options];
    nextOptions[index] = { ...nextOptions[index], ...updatedOption };
    patch({ options: nextOptions });
  }

  function handleAddOption() {
    patch({
      options: [...options, { id: crypto.randomUUID(), text: "", media: [] }],
    });
  }

  function handleRemoveOption(index: number) {
    const nextOptions = options.filter((_, i) => i !== index);
    
    // Корректируем индексы правильных ответов при удалении
    const nextCorrect = correctIndices
      .filter((c) => c !== index)
      .map((c) => (c > index ? c - 1 : c));

    patch({ options: nextOptions, correct: nextCorrect });
  }

  function handleToggleCorrect(index: number) {
    if (isMultiple) {
      if (correctIndices.includes(index)) {
        patch({ correct: correctIndices.filter((c) => c !== index) });
      } else {
        patch({ correct: [...correctIndices, index] });
      }
    } else {
      patch({ correct: [index] });
    }
  }

  return (
    <div>
      {/* Настройка типа выбора */}
      <div className="form-group" style={{ marginBottom: "20px", padding: "12px", background: "rgba(0,123,255,0.05)", borderRadius: "8px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={isMultiple}
            disabled={disabled}
            onChange={(e) => {
              const multiple = e.target.checked;
              // Если переключаем на одиночный, оставляем только первый правильный ответ (если есть)
              const nextCorrect = !multiple && correctIndices.length > 1 ? [correctIndices[0]] : correctIndices;
              patch({ multiple, correct: nextCorrect });
            }}
            style={{ width: "18px", height: "18px" }}
          />
          Множественный выбор (несколько правильных вариантов)
        </label>
        <div style={{ fontSize: "12px", color: "rgba(0,0,0,0.5)", marginTop: "4px", paddingLeft: "26px" }}>
          При множественном выборе баллы будут начисляться пропорционально правильным ответам (например, 2/3 = 0.66 балла).
        </div>
      </div>

      <div className="form-group">
        <label style={{ display: "block", marginBottom: "12px", fontWeight: 600 }}>Варианты ответов:</label>
        
        {options.map((opt, index) => {
          const isCorrect = correctIndices.includes(index);

          return (
            <div
              key={opt.id}
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "flex-start",
                padding: "16px",
                marginBottom: "12px",
                border: `2px solid ${isCorrect ? "#28a745" : "rgba(0,0,0,0.1)"}`,
                borderRadius: "12px",
                background: isCorrect ? "rgba(40,167,69,0.02)" : "#fff",
                transition: "all 0.2s ease"
              }}
            >
              {/* Радио или Чекбокс для выбора правильного ответа */}
              <div style={{ paddingTop: "12px" }}>
                <input
                  type={isMultiple ? "checkbox" : "radio"}
                  checked={isCorrect}
                  disabled={disabled}
                  onChange={() => handleToggleCorrect(index)}
                  style={{ width: "20px", height: "20px", cursor: "pointer" }}
                  title={isCorrect ? "Отмечен как правильный" : "Отметить как правильный"}
                />
              </div>

              {/* Поля варианта ответа */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
                <textarea
                  className="input"
                  rows={2}
                  value={opt.text}
                  disabled={disabled}
                  placeholder={`Текст варианта ${index + 1}...`}
                  onChange={(e) => handleOptionChange(index, { text: e.target.value })}
                  style={{ resize: "vertical" }}
                />

                <MediaUpload
                  value={opt.media || []}
                  onChange={(media) => handleOptionChange(index, { media })}
                  disabled={disabled}
                  bucket="question-images"
                  label="Медиа для этого варианта (картинка, аудио):"
                />
              </div>

              {/* Кнопка удаления */}
              <button
                type="button"
                onClick={() => handleRemoveOption(index)}
                disabled={disabled || options.length <= 2}
                className="btn btn-small btn-danger ghost"
                style={{ alignSelf: "flex-start" }}
                title="Удалить вариант"
              >
                ✕
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleAddOption}
          disabled={disabled}
          className="btn secondary"
          style={{ marginTop: "8px" }}
        >
          ➕ Добавить вариант
        </button>
      </div>
    </div>
  );
}