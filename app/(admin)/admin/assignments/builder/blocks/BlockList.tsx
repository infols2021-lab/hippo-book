"use client";

import React from "react";
import type { InfoBlock, BlockType } from "../types";
import { newBlock, deepClone } from "../types";
import BlockItem from "./BlockItem"; // Напишем его следующим шагом!

type Props = {
  value: InfoBlock[];
  onChange: (val: InfoBlock[]) => void;
  disabled?: boolean;
};

export default function BlockList({ value, onChange, disabled }: Props) {
  
  // Добавление нового блока в конец списка
  function addBlock(type: BlockType) {
    const next = deepClone(value);
    next.push(newBlock(type));
    onChange(next);
  }

  // Обновление данных внутри конкретного блока
  function updateBlock(index: number, updated: InfoBlock) {
    const next = deepClone(value);
    next[index] = updated;
    onChange(next);
  }

  // Удаление блока
  function removeBlock(index: number) {
    if (!window.confirm("Точно удалить этот блок? Восстановить будет нельзя.")) return;
    const next = deepClone(value);
    next.splice(index, 1);
    onChange(next);
  }

  // Перемещение блока выше
  function moveUp(index: number) {
    if (index === 0) return;
    const next = deepClone(value);
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    onChange(next);
  }

  // Перемещение блока ниже
  function moveDown(index: number) {
    if (index === value.length - 1) return;
    const next = deepClone(value);
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    onChange(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      
      {/* Список текущих блоков */}
      {value.length === 0 ? (
        <div style={{ 
          padding: "40px 20px", 
          textAlign: "center", 
          background: "#f8fafc", 
          borderRadius: 12, 
          border: "2px dashed #cbd5e1" 
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📖</div>
          <div style={{ color: "#334155", fontWeight: 600, fontSize: 16 }}>Нет ни одного блока</div>
          <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
            Соберите свой первый гайд, добавляя блоки из меню ниже
          </div>
        </div>
      ) : (
        value.map((block, index) => (
          <BlockItem
            key={block.id}
            block={block}
            index={index}
            isFirst={index === 0}
            isLast={index === value.length - 1}
            onChange={(updated) => updateBlock(index, updated)}
            onRemove={() => removeBlock(index)}
            onMoveUp={() => moveUp(index)}
            onMoveDown={() => moveDown(index)}
            disabled={disabled}
          />
        ))
      )}

      {/* Панель добавления новых блоков */}
      <div style={{ 
        marginTop: 10, 
        padding: 20, 
        background: "#f1f5f9", 
        borderRadius: 12, 
        border: "1px solid #e2e8f0" 
      }}>
        <div style={{ 
          fontSize: 12, 
          fontWeight: 800, 
          color: "#475569", 
          textTransform: "uppercase", 
          letterSpacing: "0.08em", 
          marginBottom: 14 
        }}>
          ➕ Добавить блок
        </div>
        
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button type="button" className="btn small secondary" disabled={disabled} onClick={() => addBlock("hero")}>
            🖼 Обложка
          </button>
          <button type="button" className="btn small secondary" disabled={disabled} onClick={() => addBlock("text_section")}>
            📝 Текст
          </button>
          <button type="button" className="btn small secondary" disabled={disabled} onClick={() => addBlock("alert")}>
            ⚠️ Сноска
          </button>
          <button type="button" className="btn small secondary" disabled={disabled} onClick={() => addBlock("video")}>
            🎥 Видео
          </button>
          <button type="button" className="btn small secondary" disabled={disabled} onClick={() => addBlock("cards_grid")}>
            🗂 Сетка карточек
          </button>
          <button type="button" className="btn small secondary" disabled={disabled} onClick={() => addBlock("accordion")}>
            🔽 Спойлеры (FAQ)
          </button>
          <button type="button" className="btn small secondary" disabled={disabled} onClick={() => addBlock("downloads")}>
            ⬇️ Файлы
          </button>
        </div>
      </div>
      
    </div>
  );
}