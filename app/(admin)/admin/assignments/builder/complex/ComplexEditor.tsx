"use client";

import type { ComplexQuestion, Question, QuestionType } from "../types";
import { newQuestion } from "../types";
import QuestionItem from "../QuestionItem";

type Props = {
  value: ComplexQuestion;
  onChange: (next: ComplexQuestion) => void;
  disabled?: boolean;
};

export default function ComplexEditor({ value, onChange, disabled }: Props) {
  const subQuestions = value.subQuestions || [];

  function patch(p: Partial<ComplexQuestion>) {
    onChange({ ...value, ...p });
  }

  function addSubQuestion(type: QuestionType) {
    if (type === "complex") {
      alert("Нельзя добавлять комплексный вопрос внутрь комплексного.");
      return;
    }
    patch({ subQuestions: [...subQuestions, newQuestion(type)] });
  }

  function updateSubQuestion(index: number, nextQ: Question) {
    const nextList = [...subQuestions];
    nextList[index] = nextQ;
    patch({ subQuestions: nextList });
  }

  function removeSubQuestion(index: number) {
    const nextList = subQuestions.filter((_, i) => i !== index);
    patch({ subQuestions: nextList });
  }

  function moveSubQuestion(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= subQuestions.length) return;
    const nextList = [...subQuestions];
    const temp = nextList[index];
    nextList[index] = nextList[target];
    nextList[target] = temp;
    patch({ subQuestions: nextList });
  }

  function changeSubQuestionType(index: number, type: QuestionType) {
    if (type === "complex") {
      alert("Нельзя изменять тип на комплексный внутри комплексного вопроса.");
      return;
    }
    const nextList = [...subQuestions];
    // При смене типа сохраняем базовый текст вопроса и медиа, остальное сбрасываем
    const currentQ = nextList[index];
    const baseNew = newQuestion(type);
    
    nextList[index] = { 
      ...baseNew, 
      q: currentQ.q, 
      media: currentQ.media 
    } as Question;
    
    patch({ subQuestions: nextList });
  }

  return (
    <div style={{ marginTop: "20px", padding: "24px", background: "rgba(0, 123, 255, 0.03)", borderRadius: "12px", border: "1px dashed rgba(0, 123, 255, 0.3)" }}>
      <div style={{ marginBottom: "20px" }}>
        <h4 style={{ margin: "0 0 8px 0", color: "#007bff", fontSize: "16px" }}>Подвопросы ({subQuestions.length}):</h4>
        <div style={{ fontSize: "13px", color: "rgba(0,0,0,0.5)" }}>
          Здесь вы можете добавить несколько подвопросов, которые относятся к медиа-материалу или тексту выше. Баллы за этот вопрос будут вычисляться как среднее значение правильности всех подвопросов.
        </div>
      </div>
      
      {subQuestions.length === 0 ? (
        <div style={{ color: "rgba(0,0,0,0.4)", marginBottom: "24px", fontStyle: "italic", textAlign: "center", padding: "20px", background: "rgba(0,0,0,0.02)", borderRadius: "8px" }}>
          Нет подвопросов. Выберите тип ниже, чтобы добавить первый подвопрос.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginBottom: "24px" }}>
          {subQuestions.map((sq, i) => (
            <div key={sq.id} style={{ position: "relative" }}>
              {/* Декоративная линия слева чтобы визуально показать вложенность */}
              <div style={{ position: "absolute", left: "-12px", top: "20px", bottom: "20px", width: "4px", background: "#007bff", borderRadius: "4px", opacity: 0.3 }}></div>
              
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