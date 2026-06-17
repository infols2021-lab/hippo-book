"use client";

import { useState } from "react";
import QuestionItem from "./QuestionItem";
import QuestionTypeSwitch from "./QuestionTypeSwitch";
import { newQuestion, type Question, type QuestionType } from "./types";

type Props = {
  value: Question[];
  onChange: (next: Question[]) => void;
  disabled?: boolean;
};

export default function QuestionList({ value, onChange, disabled }: Props) {
  const questions = Array.isArray(value) ? value : [];
  const [newType, setNewType] = useState<QuestionType>("test");

  const canAdd = !disabled;

  // Оптимизированное, иммутабельное обновление элемента
  function patchAt(index: number, nextQ: Question) {
    const next = [...questions];
    next[index] = nextQ;
    onChange(next);
  }

  function removeAt(index: number) {
    if (disabled) return;
    const next = [...questions];
    next.splice(index, 1);
    
    // Если удалили последний вопрос, создаем пустой тестовый (чтобы список не был пустым)
    if (next.length === 0) {
      next.push(newQuestion("test"));
    }
    
    onChange(next);
  }

  function move(from: number, to: number) {
    if (disabled) return;
    if (to < 0 || to >= questions.length) return;
    
    const next = [...questions];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  function add() {
    if (!canAdd) return;
    onChange([...questions, newQuestion(newType)]);
  }

  return (
    <div>
      {/* Список вопросов */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {questions.map((q, idx) => (
          <QuestionItem
            key={q.id || `${idx}-${q.type}`}
            index={idx}
            total={questions.length}
            value={q}
            disabled={disabled}
            onChange={(next) => patchAt(idx, next)}
            onRemove={() => removeAt(idx)}
            onMoveUp={() => move(idx, idx - 1)}
            onMoveDown={() => move(idx, idx + 1)}
            onTypeChange={(newType) => {
              // Меняем тип "чисто" — пересоздаем вопрос, но сохраняем общие данные (текст, старую картинку, медиа)
              const base = newQuestion(newType);
              
              if (q.q) base.q = q.q;
              if (q.image) base.image = q.image;
              if (q.media && q.media.length > 0) base.media = q.media;
              
              patchAt(idx, base);
            }}
          />
        ))}
      </div>

      {/* Панель добавления СНИЗУ */}
      <div style={{ marginTop: 16 }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="small-muted" style={{ marginBottom: 10 }}>
            ➕ Добавляй вопросы сверху вниз — поэтому панель создания здесь, внизу.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <QuestionTypeSwitch value={newType} onChange={setNewType} disabled={disabled} />

            <button className="btn" type="button" onClick={add} disabled={!canAdd}>
              ➕ Добавить вопрос
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}