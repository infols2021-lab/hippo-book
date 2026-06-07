"use client";

import React from "react";
import type { BlockType } from "../types";

type Props = {
  onAdd: (type: BlockType) => void;
  disabled?: boolean;
};

export default function BlockTypeSwitch({ onAdd, disabled }: Props) {
  const blockTypes: { t: BlockType; label: string; icon: string }[] = [
    { t: "hero", label: "Обложка", icon: "🖼" },
    { t: "text_section", label: "Текст", icon: "📝" },
    { t: "alert", label: "Сноска", icon: "⚠️" },
    { t: "video", label: "Видео", icon: "🎥" },
    { t: "cards_grid", label: "Сетка карточек", icon: "🗂" },
    { t: "accordion", label: "Спойлеры (FAQ)", icon: "🔽" },
    { t: "downloads", label: "Файлы", icon: "⬇️" },
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {blockTypes.map((block) => (
        <button
          key={block.t}
          type="button"
          className="btn small secondary"
          onClick={() => onAdd(block.t)}
          disabled={disabled}
          style={{ opacity: disabled ? 0.6 : 1 }}
        >
          {block.icon} {block.label}
        </button>
      ))}
    </div>
  );
}