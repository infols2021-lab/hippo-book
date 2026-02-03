// app/(admin)/admin/assignments/builder/sentence/sentenceHelpers.ts

export function countGaps(sentence: string) {
  return (String(sentence || "").match(/___/g) || []).length;
}

export function parseAnswersLines(text: string): string[][] {
  const lines = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const res: string[][] = lines.map((line) => {
    const variants = line
      .split(";")
      .map((x) => x.trim())
      .filter(Boolean);

    return variants.length ? variants : [""];
  });

  return res.length ? res : [[""]];
}

export function formatAnswersLines(answers: any): string {
  if (!Array.isArray(answers)) return "";
  return answers
    .map((group) => {
      const arr = Array.isArray(group) ? group : [group];
      const cleaned = arr.map((x) => String(x ?? "").trim()).filter(Boolean);
      return cleaned.length ? cleaned.join("; ") : "";
    })
    .join("\n")
    .trimEnd();
}
