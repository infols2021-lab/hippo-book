"use client";

import React from "react";
import { parseRichText } from "@/lib/assignments/richText";

type Props = {
  text?: string | null;
  className?: string;
  style?: React.CSSProperties;
  as?: keyof React.JSX.IntrinsicElements;
};

export default function QuestionRichText({
  text,
  className = "",
  style,
  as: Tag = "div",
}: Props) {
  const lines = parseRichText(text);
  if (!lines.length) return null;

  return (
    <Tag className={`question-rich-text ${className}`.trim()} style={style}>
      {lines.map((segments, lineIndex) => (
        <React.Fragment key={lineIndex}>
          {lineIndex > 0 && <br />}
          {segments.map((segment, segmentIndex) =>
            segment.bold ? (
              <strong key={`${lineIndex}-${segmentIndex}`}>{segment.text}</strong>
            ) : (
              <React.Fragment key={`${lineIndex}-${segmentIndex}`}>{segment.text}</React.Fragment>
            )
          )}
        </React.Fragment>
      ))}
    </Tag>
  );
}
