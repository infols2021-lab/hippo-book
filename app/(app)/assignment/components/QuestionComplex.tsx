"use client";

import React from "react";
import type { QuestionComplex, QuestionAny } from "../lib/types";
import MediaRenderer from "./MediaRenderer";
import QuestionTest from "./QuestionTest";
import QuestionFill from "./QuestionFill";
import QuestionSentence from "./QuestionSentence";
import QuestionMatching from "./QuestionMatching";
import QuestionImageMap from "./QuestionImageMap";

type Props = {
  question: QuestionComplex;
  value: any[];
  onChange: (val: any[]) => void;
  disabled?: boolean;
};

export default function QuestionComplex({
  question,
  value = [],
  onChange,
  disabled,
}: Props) {
  const subQuestions = question.subQuestions || [];

  function handleSubChange(index: number, subVal: any) {
    if (disabled) return;
    const next = [...(Array.isArray(value) ? value : [])];
    while (next.length <= index) next.push(null);
    next[index] = subVal;
    onChange(next);
  }

  function renderSubQuestion(subQ: QuestionAny, index: number) {
    const subValue = Array.isArray(value) ? value[index] : undefined;

    switch (subQ.type) {
      case "test":
        return (
          <QuestionTest
            question={subQ as any}
            value={subValue}
            onChange={(v: any) => handleSubChange(index, v)}
            disabled={disabled}
          />
        );
      case "fill":
        return (
          <QuestionFill
            question={subQ as any}
            value={subValue}
            onChange={(v: any) => handleSubChange(index, v)}
            disabled={disabled}
          />
        );
      case "sentence":
        return (
          <QuestionSentence
            question={subQ as any}
            value={subValue}
            onChange={(v: any) => handleSubChange(index, v)}
            disabled={disabled}
          />
        );
      case "matching":
        return (
          <QuestionMatching
            question={subQ as any}
            value={subValue || {}}
            onChange={(v: Record<string, string>) =>
              handleSubChange(index, v)
            }
            disabled={disabled}
          />
        );
      case "imagemap":
        return (
          <QuestionImageMap
            question={subQ as any}
            value={subValue || {}}
            onChange={(v: Record<string, string>) =>
              handleSubChange(index, v)
            }
            disabled={disabled}
          />
        );
      default:
        return (
          <div
            style={{
              color: "#ff4d4f",
              padding: 12,
              background: "rgba(255,77,79,0.1)",
              borderRadius: 8,
              fontSize: 14,
            }}
          >
            ⚠️ Неподдерживаемый тип подвопроса: {subQ.type}
          </div>
        );
    }
  }

  if (subQuestions.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 40,
        paddingLeft: 20,
        borderLeft: "4px solid rgba(0,123,255,0.2)",
      }}
    >
      {/* Блок текста и медиа самого комплексного вопроса */}
      {(question.q || (question.media && question.media.length > 0)) && (
        <div
          style={{
            marginBottom: 8,
            padding: "0 0 16px 0",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          {question.q && (
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#1e293b",
                marginBottom: 12,
                whiteSpace: "pre-wrap",
              }}
            >
              {question.q}
            </div>
          )}
          {question.media && question.media.length > 0 && (
            <MediaRenderer media={question.media} />
          )}
        </div>
      )}

      {subQuestions.map((subQ, index) => (
        <div
          key={subQ.id || `subq-${index}`}
          style={{
            display: "flex",
            gap: 16,
            alignItems: "flex-start",
            position: "relative",
          }}
        >
          {/* Горизонтальный коннектор к левой линии */}
          <div
            style={{
              position: "absolute",
              left: -20,
              top: 14,
              width: 12,
              height: 4,
              background: "rgba(0,123,255,0.2)",
              borderRadius: "0 2px 2px 0",
            }}
          />

          {/* Номер подвопроса */}
          <div
            style={{
              background: "#007bff",
              color: "#fff",
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 600,
              flexShrink: 0,
              boxShadow: "0 4px 8px rgba(0,123,255,0.3)",
            }}
          >
            {index + 1}
          </div>

          {/* Тело подвопроса */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {subQ.q && (
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#222",
                  marginBottom: 12,
                  whiteSpace: "pre-wrap",
                }}
              >
                {subQ.q}
              </div>
            )}

            {subQ.media && subQ.media.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <MediaRenderer media={subQ.media} />
              </div>
            )}

            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                padding: 16,
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
              }}
            >
              {renderSubQuestion(subQ, index)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}