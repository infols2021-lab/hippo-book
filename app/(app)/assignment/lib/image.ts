function isHttpUrl(v: unknown): v is string {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

export function getImageUrl(imagePath: unknown) {
  if (imagePath == null) return "";
  const raw: string = String(imagePath);

  if (raw.startsWith("data:") || isHttpUrl(raw)) return raw;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const bucket = process.env.NEXT_PUBLIC_ASSIGNMENTS_BUCKET || "assignments";
  if (!base) return raw;

  const cleaned: string = String(raw)
    .replace(/^\/+/, "")
    .replace(/^storage\/v1\/object\/public\/[^/]+\//, "");

  return `${base}/storage/v1/object/public/${bucket}/${encodeURIComponent(cleaned)}?v=${Date.now()}`;
}
