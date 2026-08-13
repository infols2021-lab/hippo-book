"use client";

import React from "react";
import type { QuestionSentence } from "@/lib/assignments/types";
import SentenceCloze from "./SentenceCloze";

type Props = {
  question: QuestionSentence;
  value: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
};

export default function QuestionSentence({
  question,
  value = [],
  onChange,
  disabled,
}: Props) {
  const sentence = question.sentence || "";
  const rawAnswers: any[] =
    Array.isArray(question.answers) && question.answers.length > 0
      ? question.answers
      : Array.isArray((question as any).correct)
        ? (question as any).correct
        : [];

  if (!sentence) {
    return (
      <div className="sentence-empty-error">
        Ошибка: текст предложения не задан.
      </div>
    );
  }

  return (
    <div className="sentence-container sentence-container--cloze">
      <SentenceCloze
        sentence={sentence}
        rawAnswers={rawAnswers}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}
