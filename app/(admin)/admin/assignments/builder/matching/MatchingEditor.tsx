"use client";

import type { MatchingQuestion, MatchingPair, MediaAttachment } from "../types";
import MediaUpload from "../MediaUpload";

type Props = {
  value: MatchingQuestion;
  onChange: (next: MatchingQuestion) => void;
  disabled?: boolean;
};

export default function MatchingEditor({ value, onChange, disabled }: Props) {
  function patch(p: Partial<MatchingQuestion>) {
    onChange({ ...value, ...p });
  }

  const pairs: MatchingPair[] = value.pairs || [];

  function handlePairChange(index: number, side: "left" | "right", field: "text" | "media", val: any) {
    const nextPairs = [...pairs];
    nextPairs[index] = {
      ...nextPairs[index],
      [side]: {
        ...nextPairs[index][side],
        [field]: val,
      },
    };
    patch({ pairs: nextPairs });
  }

  function handleAddPair() {
    patch({
      pairs: [
        ...pairs,
        {
          id: crypto.randomUUID(),
          left: { text: "", media: [] },
          right: { text: "", media: [] },
        },
      ],
    });
  }

  function handleRemovePair(index: number) {
    const nextPairs = pairs.filter((_, i) => i !== index);
    patch({ pairs: nextPairs });
  }

  function handleCenterImageChange(mediaArr: MediaAttachment[]) {
    // Центральным изображением может быть только одно медиа
    patch({ centerImage: mediaArr.length > 0 ? mediaArr[0] : undefined });
  }

  return (
    <div>
      {/* Центральное изображение (Опционально) */}
      <div className="form-group" style={{ marginBottom: "24px", padding: "16px", background: "rgba(0,0,0,0.02)", borderRadius: "12px", border: "1px dashed rgba(0,0,0,0.1)" }}>
        <h4 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>Центральный объект (Опционально)</h4>
        <div style={{ fontSize: "13px", color: "rgba(0,0,0,0.5)", marginBottom: "16px" }}>
          Используется, если все элементы должны соединяться с одной общей картинкой по центру экрана (например, большая иллюстрация комнаты, а вокруг объекты).
        </div>
        <MediaUpload
          value={value.centerImage ? [value.centerImage] : []}
          onChange={handleCenterImageChange}
          disabled={disabled}
          bucket="question-images"
          label="Загрузить центральное медиа:"
        />
      </div>

      <div className="form-group">
        <label style={{ display: "block", marginBottom: "12px", fontWeight: 600 }}>Пары для сопоставления:</label>
        <div style={{ fontSize: "13px", color: "rgba(0,0,0,0.5)", marginBottom: "16px" }}>
          Ученику нужно будет провести линию от элемента из левой колонки к элементу из правой. Ученику они покажутся перемешанными.
        </div>

        {pairs.map((pair, index) => (
          <div
            key={pair.id}
            style={{
              position: "relative",
              display: "flex",
              gap: "24px",
              padding: "20px",
              marginBottom: "16px",
              border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: "12px",
              background: "#fff",
            }}
          >
            {/* Левая часть */}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: "8px", color: "#007bff" }}>Левая сторона (точка A)</div>
              <input
                className="input"
                type="text"
                placeholder="Текст (опционально)..."
                value={pair.left.text || ""}
                disabled={disabled}
                onChange={(e) => handlePairChange(index, "left", "text", e.target.value)}
                style={{ marginBottom: "12px" }}
              />
              <MediaUpload
                value={pair.left.media || []}
                onChange={(media) => handlePairChange(index, "left", "media", media)}
                disabled={disabled}
                bucket="question-images"
                label="Медиа:"
              />
            </div>

            {/* Иконка соединения */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(0,0,0,0.2)", fontSize: "24px", paddingTop: "20px" }}>
              🔗
            </div>

            {/* Правая часть */}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: "8px", color: "#28a745" }}>Правая сторона (точка B)</div>
              <input
                className="input"
                type="text"
                placeholder="Текст (опционально)..."
                value={pair.right.text || ""}
                disabled={disabled}
                onChange={(e) => handlePairChange(index, "right", "text", e.target.value)}
                style={{ marginBottom: "12px" }}
              />
              <MediaUpload
                value={pair.right.media || []}
                onChange={(media) => handlePairChange(index, "right", "media", media)}
                disabled={disabled}
                bucket="question-images"
                label="Медиа:"
              />
            </div>

            <button
              type="button"
              onClick={() => handleRemovePair(index)}
              disabled={disabled || pairs.length <= 2}
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                background: "transparent",
                border: "none",
                color: "#ff4d4f",
                cursor: disabled || pairs.length <= 2 ? "not-allowed" : "pointer",
                fontSize: "16px",
                opacity: disabled || pairs.length <= 2 ? 0.3 : 1
              }}
              title="Удалить пару"
            >
              ✖
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={handleAddPair}
          disabled={disabled}
          className="btn secondary"
        >
          ➕ Добавить пару
        </button>
      </div>
    </div>
  );
}