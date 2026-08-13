import React from "react";

export type RichTextSegment =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "break" };

/** Парсит строку: переносы строк + **жирный** (markdown-lite). */
export function parseRichText(input: string): RichTextSegment[] {
  if (!input) return [];

  const segments: RichTextSegment[] = [];
  const regex = /\*\*(.+?)\*\*|\n/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: input.slice(lastIndex, match.index) });
    }

    if (match[0] === "\n") {
      segments.push({ type: "break" });
    } else {
      segments.push({ type: "bold", value: match[1] ?? "" });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < input.length) {
    segments.push({ type: "text", value: input.slice(lastIndex) });
  }

  return segments;
}

/** Убирает маркеры форматирования — для plain-text fallback. */
export function stripRichTextMarkers(input: string): string {
  return String(input ?? "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type RichTextContentProps = {
  text: string;
  className?: string;
  prefix?: React.ReactNode;
  as?: "div" | "span" | "h2" | "h4" | "p";
};

export function RichTextContent({
  text,
  className,
  prefix,
  as: Tag = "div",
}: RichTextContentProps) {
  const segments = React.useMemo(() => parseRichText(text), [text]);

  if (!text.trim()) return null;

  return (
    <Tag className={className}>
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
        return <span key={`t-${index}`}>{seg.value}</span>;
      })}
    </Tag>
  );
}
