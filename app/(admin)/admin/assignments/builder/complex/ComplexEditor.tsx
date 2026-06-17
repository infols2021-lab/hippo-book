"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComplexQuestion, Question, QuestionType } from "../types";
import { newQuestion } from "../types";
import QuestionItem from "../QuestionItem";

type Props = {
  value: ComplexQuestion;
  onChange: (next: ComplexQuestion) => void;
  disabled?: boolean;
};

export default function ComplexEditor({ value, onChange, disabled }: Props) {
  const [error, setError] = useState<string | null>(null);

  // Используем ref для актуального значения, чтобы не пересоздавать функции и не вызывать 
  // лишние ре-рендеры всех дочерних QuestionItem при каждом чихе
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const subQuestions = value.subQuestions || [];

  const patch = useCallback((partial: Partial<ComplexQuestion>) => {
    onChange({ ...valueRef.current, ...partial });
  }, [onChange]);

  const addSubQuestion = useCallback((type: QuestionType) => {
    setError(null);
    if (type === "complex" || type === "reading") {
      setError("Нельзя добавлять комплексные задания или чтение внутрь комплексного вопроса.");
      return;
    }
    const currentSubs = valueRef.current.subQuestions || [];
    patch({ subQuestions: [...currentSubs, newQuestion(type)] });
  }, [patch]);

  const updateSubQuestion = useCallback((index: number, nextQ: Question) => {
    const currentSubs = valueRef.current.subQuestions || [];
    const nextList = [...currentSubs];
    nextList[index] = nextQ;
    patch({ subQuestions: nextList });
  }, [patch]);

  const removeSubQuestion = useCallback((index: number) => {
    const currentSubs = valueRef.current.subQuestions || [];
    const nextList = currentSubs.filter((_, i) => i !== index);
    patch({ subQuestions: nextList });
  }, [patch]);

  const moveSubQuestion = useCallback((index: number, dir: -1 | 1) => {
    const currentSubs = valueRef.current.subQuestions || [];
    const target = index + dir;
    if (target < 0 || target >= currentSubs.length) return;
    
    const nextList = [...currentSubs];
    const temp = nextList[index];
    nextList[index] = nextList[target];
    nextList[target] = temp;
    
    patch({ subQuestions: nextList });
  }, [patch]);

  const changeSubQuestionType = useCallback((index: number, type: QuestionType) => {
    setError(null);
    if (type === "complex" || type === "reading") {
      setError("Нельзя изменять тип на комплексный или чтение внутри комплексного вопроса.");
      return;
    }
    
    const currentSubs = valueRef.current.subQuestions || [];
    const nextList = [...currentSubs];
    const currentQ = nextList[index];
    
    // При смене типа сохраняем базовый текст вопроса и медиа, остальное сбрасываем
    const baseNew = newQuestion(type);
    if (currentQ.q) baseNew.q = currentQ.q;
    if (currentQ.image) baseNew.image = currentQ.image;
    if (currentQ.media && currentQ.media.length > 0) baseNew.media = currentQ.media;
    
    nextList[index] = baseNew;
    patch({ subQuestions: nextList });
  }, [patch]);

  return (
    <div style={{ marginTop: "20px", padding: "24px", background: "rgba(0, 123, 255, 0.03)", borderRadius: "12px", border: "1px dashed rgba(0, 123, 255, 0.3)" }}>
      <div style={{ marginBottom: "20px" }}>
        <h4 style={{ margin: "0 0 8px 0", color: "#007bff", fontSize: "16px" }}>Подвопросы ({subQuestions.length}):</h4>
        <div style={{ fontSize: "13px", color: "rgba(0,0,0,0.5)", lineHeight: 1.5 }}>
          Здесь вы можете добавить несколько подвопросов, которые относятся к медиа-материалу или тексту выше. 
          Баллы за этот вопрос будут вычисляться как среднее значение правильности всех подвопросов.
        </div>
      </div>

      {/* Локальная ошибка (вместо alert) */}
      {error && (
        <div style={{ padding: "10px 14px", background: "#fff5f5", color: "#c62828", border: "1px solid #ffcdd2", borderRadius: "8px", fontSize: "13px", fontWeight: 500, marginBottom: "16px" }}>
          ⚠️ {error}
        </div>
      )}
      
      {subQuestions.length === 0 ? (
        <div style={{ color: "rgba(0,0,0,0.4)", marginBottom: "24px", fontStyle: "italic", textAlign: "center", padding: "20px", background: "rgba(0,0,0,0.02)", borderRadius: "8px" }}>
          Нет подвопросов. Выберите тип ниже, чтобы добавить первый подвопрос.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginBottom: "24px" }}>
          {subQuestions.map((sq, i) => (
            <div key={sq.id} style={{ position: "relative" }}>
              {/* Декоративная линия слева чтобы визуально показать вложенность */}
              <div style={{ position: "absolute", left: "-16px", top: "20px", bottom: "20px", width: "4px", background: "#007bff", borderRadius: "4px", opacity: 0.2 }} />
              
              <QuestionItem
                index={i}
                total={subQuestions.length}
                value={sq}
                disabled={disabled}
                onChange={(next) => updateSubQuestion(i, next)}
                onRemove={() => removeSubQuestion(i)}
                onMoveUp={() => moveSubQuestion(i, -1)}
                onMoveDown={() => moveSubQuestion(i, 1)}
                onTypeChange={(t) => changeSubQuestionType(i, t)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Панель добавления подвопросов */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", padding: "12px", background: "#fff", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)" }}>
        <span style={{ fontWeight: 600, marginRight: "8px", color: "rgba(0,0,0,0.7)", fontSize: "14px" }}>
          ➕ Добавить:
        </span>
        <button type="button" className="btn small secondary" disabled={disabled} onClick={() => addSubQuestion("test")}>📝 Тест</button>
        <button type="button" className="btn small secondary" disabled={disabled} onClick={() => addSubQuestion("fill")}>✍️ Вписать</button>
        <button type="button" className="btn small secondary" disabled={disabled} onClick={() => addSubQuestion("sentence")}>📝 Предложение</button>
        <button type="button" className="btn small secondary" disabled={disabled} onClick={() => addSubQuestion("matching")}>🔗 Сопоставление</button>
        <button type="button" className="btn small secondary" disabled={disabled} onClick={() => addSubQuestion("imagemap")}>🗺 Карта</button>
      </div>
    </div>
  );
}