"use client";

import React from "react";
import type { QuestionComplex, QuestionAny } from "../lib/types";
import MediaRenderer from "./MediaRenderer";

// Импортируем компоненты подвопросов
import QuestionTest from "./QuestionTest";
import QuestionMatching from "./QuestionMatching";

// Заглушки для типов, которые еще не созданы/не обновлены в "снежном коме"
const QuestionFillPlaceholder = ({ onChange, value, disabled }: any) => (
  <input 
    type="text" 
    className="input" 
    disabled={disabled} 
    value={value?.[0] || ""} 
    onChange={(e) => onChange([e.target.value])} 
    placeholder="Впишите ответ..."
  />
);

const QuestionSentencePlaceholder = ({ onChange, value, disabled }: any) => (
  <div style={{ fontStyle: "italic", color: "rgba(0,0,0,0.5)" }}>
    Компонент предложения будет подключен позже
  </div>
);

type Props = {
  question: QuestionComplex;
  value: any[]; // Массив ответов на каждый подвопрос
  onChange: (val: any[]) => void;
  disabled?: boolean;
};

export default function QuestionComplex({ question, value = [], onChange, disabled }: Props) {
  const subQuestions = question.subQuestions || [];

  // Функция для точечного обновления ответа на конкретный подвопрос
  function handleSubChange(index: number, subVal: any) {
    if (disabled) return;
    
    const nextValue = [...(Array.isArray(value) ? value : [])];
    
    while (nextValue.length <= index) {
      nextValue.push(null);
    }
    
    nextValue[index] = subVal;
    onChange(nextValue);
  }

  // Роутер для рендеринга правильного компонента подвопроса
  function renderSubQuestion(subQ: QuestionAny, index: number) {
    const subValue = Array.isArray(value) ? value[index] : undefined;
    
    switch (subQ.type) {
      case "test":
        return (
          <QuestionTest
            question={subQ as any}
            value={subValue}
            onChange={(val: any) => handleSubChange(index, val)}
            disabled={disabled}
          />
        );
      case "fill":
        return (
          <QuestionFillPlaceholder
            value={subValue}
            onChange={(val: any) => handleSubChange(index, val)}
            disabled={disabled}
          />
        );
      case "sentence":
        return (
          <QuestionSentencePlaceholder
            value={subValue}
            onChange={(val: any) => handleSubChange(index, val)}
            disabled={disabled}
          />
        );
      case "matching":
        return (
          <QuestionMatching
            question={subQ as any}
            value={subValue || {}}
            onChange={(val: Record<string, string>) => handleSubChange(index, val)}
            disabled={disabled}
          />
        );
      default:
        return (
          <div style={{ color: "#ff4d4f", padding: "12px", background: "rgba(255, 77, 79, 0.1)", borderRadius: "8px", fontSize: "14px" }}>
            ⚠️ Неподдерживаемый тип подвопроса: {subQ.type}
          </div>
        );
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* ГЛАВНЫЙ БЛОК КОМПЛЕКСНОГО ВОПРОСА (Текст + Медиа) */}
      <div style={{
        padding: "24px",
        background: "#f8f9fa",
        borderRadius: "16px",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)"
      }}>
        {question.q && (
          <div style={{ 
            fontSize: "16px", 
            lineHeight: 1.6, 
            color: "#333", 
            marginBottom: question.media?.length ? "16px" : "0", 
            fontWeight: 500, 
            whiteSpace: "pre-wrap" 
          }}>
            {question.q}
          </div>
        )}
        
        <MediaRenderer media={question.media} />
      </div>

      {/* ПОДВОПРОСЫ */}
      <div style={{ 
        display: "flex", 
        flexDirection: "column", 
        gap: "40px", 
        paddingLeft: "20px", 
        borderLeft: "4px solid rgba(0, 123, 255, 0.2)" 
      }}>
        {subQuestions.length === 0 ? (
          <div style={{ color: "rgba(0,0,0,0.5)", fontStyle: "italic" }}>Нет подвопросов</div>
        ) : (
          subQuestions.map((subQ, index) => (
            <div key={subQ.id || `subq-${index}`} style={{ display: "flex", flexDirection: "column", gap: "12px", position: "relative" }}>
              
              <div style={{
                position: "absolute",
                left: "-20px",
                top: "14px",
                width: "12px",
                height: "4px",
                background: "rgba(0, 123, 255, 0.2)",
                borderRadius: "0 2px 2px 0"
              }} />

              <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                <div style={{
                  background: "#007bff",
                  color: "#fff",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  fontWeight: 600,
                  flexShrink: 0,
                  boxShadow: "0 4px 8px rgba(0, 123, 255, 0.3)"
                }}>
                  {index + 1}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  {subQ.q && (
                    <div style={{ fontSize: "16px", fontWeight: 600, color: "#222", marginBottom: "12px", whiteSpace: "pre-wrap" }}>
                      {subQ.q}
                    </div>
                  )}
                  
                  {subQ.media && subQ.media.length > 0 && (
                    <div style={{ marginBottom: "16px" }}>
                      <MediaRenderer media={subQ.media} />
                    </div>
                  )}

                  <div style={{ background: "#fff", borderRadius: "16px", padding: "16px", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                    {renderSubQuestion(subQ, index)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}