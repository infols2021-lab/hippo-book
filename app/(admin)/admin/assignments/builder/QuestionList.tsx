"use client";

import { useState, useEffect } from "react";
import QuestionItem from "./QuestionItem";
import QuestionTypeSwitch from "./QuestionTypeSwitch";
import { newQuestion, type Question, type QuestionType } from "./types";

type Props = {
  value: Question[];
  onChange: (next: Question[]) => void;
  disabled?: boolean;
};

// Хелпер для защиты от старых вопросов в базе, у которых может не быть поля id
function getQId(q: Question, idx: number) {
  return q.id || `legacy-fallback-${idx}`;
}

export default function QuestionList({ value, onChange, disabled }: Props) {
  const questions = Array.isArray(value) ? value : [];
  const [newType, setNewType] = useState<QuestionType>("test");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Флаг для отслеживания первоначальной загрузки данных
  const [hasInitialized, setHasInitialized] = useState(false);

  const canAdd = !disabled;

  // Инициализируем открытие последнего вопроса только один раз при загрузке данных.
  // Это заменяет старый багованный useEffect, который перебивал клики пользователя.
  useEffect(() => {
    if (!hasInitialized && questions.length > 0) {
      setExpandedId(getQId(questions[questions.length - 1], questions.length - 1));
      setHasInitialized(true);
    }
  }, [questions, hasInitialized]);

  function patchAt(index: number, nextQ: Question) {
    const next = [...questions];
    next[index] = nextQ;
    onChange(next);
  }

  function removeAt(index: number) {
    if (disabled) return;
    const next = [...questions];
    const removedId = getQId(next[index], index);
    
    next.splice(index, 1);

    if (next.length === 0) {
      const created = newQuestion("test");
      next.push(created);
      onChange(next);
      setExpandedId(created.id);
    } else {
      onChange(next);
      // Если мы удалили тот вопрос, который сейчас открыт, открываем последний из оставшихся
      if (expandedId === removedId) {
        setExpandedId(getQId(next[next.length - 1], next.length - 1));
      }
    }
  }

  function move(from: number, to: number) {
    if (disabled) return;
    if (to < 0 || to >= questions.length) return;

    const next = [...questions];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);

    // Если мы двигаем легаси-вопрос без ID, его fallback-ID меняется. 
    // Корректируем стейт, чтобы он оставался открытым после перемещения.
    if (expandedId === `legacy-fallback-${from}`) {
      setExpandedId(`legacy-fallback-${to}`);
    } else if (expandedId === `legacy-fallback-${to}`) {
      setExpandedId(`legacy-fallback-${from}`);
    }

    onChange(next);
  }

  function add() {
    if (!canAdd) return;
    const created = newQuestion(newType);
    onChange([...questions, created]);
    setExpandedId(created.id);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {questions.map((q, idx) => {
          const currentId = getQId(q, idx);

          return (
            <QuestionItem
              key={currentId}
              index={idx}
              total={questions.length}
              value={q}
              disabled={disabled}
              expanded={expandedId === currentId}
              onToggleExpand={() => setExpandedId((current) => (current === currentId ? null : currentId))}
              onChange={(next) => patchAt(idx, next)}
              onRemove={() => removeAt(idx)}
              onMoveUp={() => move(idx, idx - 1)}
              onMoveDown={() => move(idx, idx + 1)}
              onTypeChange={(nextType) => {
                const base = newQuestion(nextType);

                if (q.q) base.q = q.q;
                if (q.explanation) base.explanation = q.explanation;
                if (q.image) base.image = q.image;
                if (q.media && q.media.length > 0) base.media = q.media;

                // ВАЖНО: сохраняем старый ID, чтобы при смене типа вопрос мгновенно не схлопывался
                if (q.id) {
                  base.id = q.id;
                } else {
                  // Если это был легаси-вопрос, у нового типа ID точно есть. Обновляем стейт.
                  setExpandedId(base.id);
                }

                patchAt(idx, base);
              }}
            />
          );
        })}
      </div>

      <div style={{ marginTop: 10 }}>
        <div
          className="card"
          style={{
            padding: 20,
            background: "#ffffff",
            border: "2px dashed #cbd5e1",
            borderRadius: 18,
            boxShadow: "0 4px 12px rgba(0,0,0,0.02)",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 6 }}>
            Добавить вопрос
          </div>
          <div className="small-muted" style={{ marginBottom: 14 }}>
            Выберите тип механики и добавьте следующий вопрос. Предыдущий свернётся автоматически.
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
              }}
            >
              Добавить вопрос
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}