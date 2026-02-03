"use client";

import { useMemo, useState } from "react";
import QuestionItem from "./QuestionItem";
import QuestionTypeSwitch from "./QuestionTypeSwitch";
import { deepClone, newQuestion, type Question, type QuestionType } from "./types";

type Props = {
  value: Question[];
  onChange: (next: Question[]) => void;
  disabled?: boolean;
};

export default function QuestionList({ value, onChange, disabled }: Props) {
  const questions = Array.isArray(value) ? value : [];

  const [newType, setNewType] = useState<QuestionType>("test");

  const canAdd = !disabled;

  const list = useMemo(() => questions.map((q) => q), [questions]);

  function patchAt(index: number, nextQ: Question) {
    const next = deepClone(list);
    next[index] = nextQ;
    onChange(next);
  }

  function removeAt(index: number) {
    if (disabled) return;
    const next = deepClone(list);
    next.splice(index, 1);
    if (next.length === 0) next.push(newQuestion("test"));
    onChange(next);
  }

  function move(from: number, to: number) {
    if (disabled) return;
    if (to < 0 || to >= list.length) return;
    const next = deepClone(list);
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  function add() {
    if (!canAdd) return;
    onChange([...deepClone(list), newQuestion(newType)]);
  }

  return (
    <div>
      {/* список вопросов */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {list.map((q, idx) => (
          <QuestionItem
            key={(q as any).id || `${idx}-${q.type}`}
            index={idx}
            total={list.length}
            value={q}
            disabled={disabled}
            onChange={(next) => patchAt(idx, next)}
            onRemove={() => removeAt(idx)}
            onMoveUp={() => move(idx, idx - 1)}
            onMoveDown={() => move(idx, idx + 1)}
            onTypeChange={(t) => {
              // меняем тип "чисто" — пересоздаем вопрос, но сохраняем q/image если есть
              const keepQ = (q as any).q ?? "";
              const keepImg = (q as any).image ?? "";
              const base = newQuestion(t);
              (base as any).q = keepQ;
              if (keepImg) (base as any).image = keepImg;
              patchAt(idx, base);
            }}
          />
        ))}
      </div>

      {/* панель добавления СНИЗУ — как в твоём admin.html */}
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
