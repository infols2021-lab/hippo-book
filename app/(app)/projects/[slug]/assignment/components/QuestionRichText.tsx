"use client";

import React from "react";
import { RichTextContent } from "@/lib/assignments/richText";

type Props = {
  text?: string | null;
  className?: string;
  style?: React.CSSProperties;
  as?: React.ElementType;
};

export default function QuestionRichText({
  text,
  className = "",
  style,
  as = "div",
}: Props) {
  const value = String(text ?? "");
  if (!value.trim()) return null;

  return (
    <RichTextContent
      text={value}
      className={`question-rich-text ${className}`.trim()}
      style={style}
      as={as}
    />
  );
}
