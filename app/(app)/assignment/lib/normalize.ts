export function normalizeText(text: any) {
  if (!text) return "";
  let normalized = String(text).toLowerCase().trim();
  normalized = normalized.replace(/[''`´]/g, "'");
  normalized = normalized.replace(/\s*'\s*/g, "'");
  normalized = normalized.replace(/\s+/g, " ");
  return normalized;
}
