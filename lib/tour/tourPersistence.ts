import type { TourStage } from "@/lib/tour/tourConfig";

const STORAGE_KEY = "hippo-book:tour-progress";

export type TourProgressSnapshot = {
  stage: TourStage;
  stepIndex: number;
  pathname: string;
  updatedAt: number;
};

function readRaw(): TourProgressSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TourProgressSnapshot>;
    if (
      typeof parsed.stage !== "string" ||
      typeof parsed.stepIndex !== "number" ||
      typeof parsed.pathname !== "string"
    ) {
      return null;
    }
    return {
      stage: parsed.stage as TourStage,
      stepIndex: Math.max(0, Math.floor(parsed.stepIndex)),
      pathname: parsed.pathname,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveTourProgress(
  stage: TourStage,
  stepIndex: number,
  pathname: string
): void {
  if (typeof window === "undefined" || stage === "finished") return;

  try {
    const snapshot: TourProgressSnapshot = {
      stage,
      stepIndex: Math.max(0, Math.floor(stepIndex)),
      pathname,
      updatedAt: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // sessionStorage недоступен — тур всё равно продолжится по tour_stage из БД
  }
}

export function loadTourProgress(stage: TourStage, pathname: string): TourProgressSnapshot | null {
  const saved = readRaw();
  if (!saved || saved.stage !== stage) return null;
  if (saved.pathname !== pathname) return null;
  return saved;
}

export function clearTourProgress(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
