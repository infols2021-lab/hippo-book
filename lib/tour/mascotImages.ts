const MASCOT_IMAGES = Array.from({ length: 8 }, (_, i) => `/images/tour/uki${i + 1}.webp`);

/** Стабильный «рандом» маскота по ключу шага — не меняется при ре-рендере. */
export function pickMascotImage(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return MASCOT_IMAGES[Math.abs(hash) % MASCOT_IMAGES.length]!;
}
