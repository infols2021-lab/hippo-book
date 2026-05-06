import { getStoragePublicUrl } from "@/lib/storage/publicUrl";

function isHttpUrl(v: unknown): boolean {
  return typeof v === "string" && /^https?:\/\//i.test(v);
}

export function getImageUrl(imagePath: unknown) {
  if (imagePath == null) return "";

  const raw = String(imagePath).trim();
  if (!raw) return "";

  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("/api/storage/public/")) return raw;

  const storageMarker = "/storage/v1/object/public/";

  if (isHttpUrl(raw)) {
    const markerIndex = raw.indexOf(storageMarker);

    if (markerIndex === -1) return raw;

    const rest = raw.slice(markerIndex + storageMarker.length).split("?")[0]?.split("#")[0] ?? "";
    const parts = rest.split("/").filter(Boolean);

    const bucket = parts.shift();
    const path = parts.join("/");

    if (!bucket || !path) return raw;

    return getStoragePublicUrl(bucket, path);
  }

  const bucket = process.env.NEXT_PUBLIC_ASSIGNMENTS_BUCKET || "assignments";

  const cleaned = raw
    .replace(/^\/+/, "")
    .replace(/^storage\/v1\/object\/public\/[^/]+\//, "");

  return getStoragePublicUrl(bucket, cleaned);
}