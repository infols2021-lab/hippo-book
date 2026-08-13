"use client";

import React from "react";

export type RichTextSegment =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "break" };

/** Парсит строку: переносы строк + **жирный** (markdown-lite). */
export function parseRichText(input: string | null | undefined): RichTextSegment[] {
  const source = String(input ?? "");
  if (!source) return [];

  const segments: RichTextSegment[] = [];
  const regex = /\*\*(.+?)\*\*|\n/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: source.slice(lastIndex, match.index) });
    }

    if (match[0] === "\n") {
      segments.push({ type: "break" });
    } else {
      segments.push({ type: "bold", value: match[1] ?? "" });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < source.length) {
    segments.push({ type: "text", value: source.slice(lastIndex) });
  }

  return segments;
}

/** Убирает маркеры форматирования — для plain-text fallback. */
export function stripRichTextMarkers(input: string | null | undefined): string {
  return String(input ?? "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** @deprecated alias */
export const richTextToPlain = stripRichTextMarkers;

type RichTextContentProps = {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  prefix?: React.ReactNode;
  as?: React.ElementType;
};

export function RichTextContent({
  text,
  className,
  style,
  prefix,
  as: Tag = "div",
}: RichTextContentProps) {
  const segments = React.useMemo(() => parseRichText(text), [text]);

  if (!text.trim()) return null;

  return (
    <Tag className={className} style={style}>
      {prefix}
      {segments.map((seg, index) => {
        if (seg.type === "break") {
          return <br key={`br-${index}`} />;
        }
        if (seg.type === "bold") {
          return (
            <strong key={`b-${index}`} className="rich-text-bold">
              {seg.value}
            </strong>
          );
        }
        return <span key={`t-${index}`} className="rich-text-normal">{seg.value}</span>;
      })}
    </Tag>
  );
}
