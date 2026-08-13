"use client";

import React, { useMemo } from "react";
import QuestionRichText from "./QuestionRichText";
import { isVariantMatch } from "@/lib/assignments/scoring";

type Props = {
  sentence: string;
  rawAnswers: any[];
  value: string[];
  disabled?: boolean;
  onChange: (next: string[]) => void;
};

type ClozeChunk =
  | { kind: "text"; text: string }
  | { kind: "gap"; text: string; gapIndex: number };

type ClozeParagraph = {
  chunks: ClozeChunk[];
  isEmpty: boolean;
};

function buildClozeParagraphs(sentence: string): ClozeParagraph[] {
  let gapIndex = 0;
  return sentence.split("\n").map((line) => {
    if (!line.trim()) {
      return { chunks: [], isEmpty: true };
    }

    const parts = line.split("___");
    const chunks: ClozeChunk[] = [];

    parts.forEach((part, partIndex) => {
      if (part) chunks.push({ kind: "text", text: part });
      if (partIndex < parts.length - 1) {
        chunks.push({ kind: "gap", text: part, gapIndex });
        gapIndex += 1;
      }
    });

    return { chunks, isEmpty: chunks.length === 0 };
  });
}

function inputSize(value: string, index: number): number {
  const base = Math.max(value.trim().length, `[${index + 1}]`.length, 6);
  return Math.min(20, base + 1);
}

function isGapCorrect(userRaw: string, variants: any, fallback: string): boolean {
  if (!userRaw.trim()) return false;
  if (variants !== undefined) return isVariantMatch(userRaw, variants);
  if (fallback.trim()) return isVariantMatch(userRaw, fallback);
  return false;
}

export default function SentenceCloze({
  sentence,
  rawAnswers,
  value,
  disabled = false,
  onChange,
}: Props) {
  const paragraphs = useMemo(() => buildClozeParagraphs(sentence), [sentence]);
  const gapsTotal = useMemo(() => (sentence.match(/___/g) || []).length, [sentence]);

  const handleInputChange = (gapIndex: number, text: string) => {
    if (disabled) return;
    const next = [...(Array.isArray(value) ? value : [])];
    while (next.length < gapsTotal) next.push("");
    next[gapIndex] = text;
    onChange(next);
  };

  return (
    <div className="sentence-cloze">
      {paragraphs.map((paragraph, paragraphIndex) => {
        if (paragraph.isEmpty) {
          return <div key={paragraphIndex} className="sentence-cloze-spacer" aria-hidden="true" />;
        }

        return (
          <p key={paragraphIndex} className="sentence-cloze-paragraph">
            {paragraph.chunks.map((chunk, chunkIndex) => {
              if (chunk.kind === "text") {
                return (
                  <QuestionRichText
                    key={`${paragraphIndex}-t-${chunkIndex}`}
                    as="span"
                    text={chunk.text}
                    className="sentence-cloze-text"
                  />
                );
              }

              const userRaw = String(value?.[chunk.gapIndex] ?? "");
              const gapCorrect =
                disabled && userRaw.trim()
                  ? isGapCorrect(
                      userRaw,
                      rawAnswers[chunk.gapIndex],
                      String(rawAnswers[chunk.gapIndex] ?? "")
                    )
                  : null;

              return (
                <span key={`${paragraphIndex}-g-${chunkIndex}`} className="sentence-gap">
                  <span className="sentence-gap-num">{chunk.gapIndex + 1}</span>
                  <input
                    type="text"
                    disabled={disabled}
                    value={userRaw}
                    size={inputSize(userRaw, chunk.gapIndex)}
                    onChange={(e) => handleInputChange(chunk.gapIndex, e.target.value)}
                    placeholder={`[${chunk.gapIndex + 1}]`}
                    autoComplete="off"
                    aria-label={`Пропуск ${chunk.gapIndex + 1}`}
                    className={[
                      "sentence-gap-input",
                      gapCorrect === true ? "is-correct" : "",
                      gapCorrect === false ? "is-incorrect" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}
