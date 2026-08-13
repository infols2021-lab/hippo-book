"use client";

import { RichTextContent } from "@/lib/assignments/richText";

export default function QuestionTextPreview({ text }: { text: string }) {
  if (!text.trim()) return null;

  return (
    <div className="question-text-preview">
      <div className="question-text-preview-label">Предпросмотр для ученика</div>
      <RichTextContent text={text} className="question-text-preview-body" as="div" />
    </div>
  );
}
