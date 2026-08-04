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

  function patchAt(index: number, nextQ: Question) {
    const next = [...questions];
    next[index] = nextQ;
    onChange(next);
  }

  function removeAt(index: number) {
    if (disabled) return;
    const next = [...questions];
    next.splice(index, 1);
    
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Список вопросов */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
              const base = newQuestion(newType);
              
              if (q.q) base.q = q.q;
              if (q.image) base.image = q.image;
              if (q.media && q.media.length > 0) base.media = q.media;
              
              patchAt(idx, base);
            }}
          />
        ))}
      </div>

      {/* Панель добавления вопроса СНИЗУ */}
      <div style={{ marginTop: 10 }}>
        <div 
          className="card" 
          style={{ 
            padding: 20, 
            background: "#ffffff", 
            border: "2px dashed #cbd5e1", 
            borderRadius: 18,
            boxShadow: "0 4px 12px rgba(0,0,0,0.02)"
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 6 }}>
            ➕ Добавить следующий вопрос
          </div>
          <div className="small-muted" style={{ marginBottom: 14 }}>
            Выберите тип механики и нажмите кнопку добавления
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <QuestionTypeSwitch value={newType} onChange={setNewType} disabled={disabled} />

            <button 
              className="btn" 
              type="button" 
              onClick={add} 
              disabled={!canAdd}
              style={{
                padding: "10px 20px",
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 14,
                boxShadow: "0 4px 14px rgba(14, 165, 233, 0.25)"
              }}
            >
              ➕ Добавить вопрос
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}