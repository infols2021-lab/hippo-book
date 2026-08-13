export type StarCount = 0 | 1 | 2 | 3;

export function scoreToStars(score: number): StarCount {
  const normalized = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  if (normalized >= 95) return 3;
  if (normalized >= 75) return 2;
  if (normalized >= 50) return 1;
  return 0;
}

export function maxStarsForLessonNodes(nodeCount: number): number {
  return Math.max(0, nodeCount) * 3;
}

export function sumStars(values: Array<number | null | undefined>): number {
  return values.reduce<number>((acc, value) => acc + (Number.isFinite(Number(value)) ? Number(value) : 0), 0);
}
