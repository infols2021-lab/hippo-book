export type RichTextLine = Array<{ text: string; bold: boolean }>;

/** Разбирает **жирный** текст и переносы строк (\n). */
export function parseRichText(input: string | null | undefined): RichTextLine[] {
  const source = String(input ?? "");
  if (!source) return [];

  return source.split("\n").map((line) => {
    const segments: RichTextLine[number][] = [];
    const regex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: line.slice(lastIndex, match.index), bold: false });
      }
      segments.push({ text: match[1], bold: true });
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
      segments.push({ text: line.slice(lastIndex), bold: false });
    }

    if (segments.length === 0) {
      segments.push({ text: "", bold: false });
    }

    return segments;
  });
}

/** Убирает разметку для review / поиска / plain-text fallback. */
export function richTextToPlain(input: string | null | undefined): string {
  return String(input ?? "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
