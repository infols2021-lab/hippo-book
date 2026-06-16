// lib/projects/recommendLevel.ts
// Универсальная рекомендация уровня по результату (обобщение lib/exams/recommendLevel.ts).
// Уровни берутся из конфига проекта (БД), а не из хардкода.
 
import type { ProjectLevelConfig, ProjectSlug } from "./types";
import { requireProject } from "./loader";
import { normalizeProjectLevel } from "./levels";
 
// ---------------------------------------------------------------------------
// ТИПЫ
// ---------------------------------------------------------------------------
 
export type RecommendationBand =
  | "too_easy"
  | "comfortable"
  | "target"
  | "stretch"
  | "too_hard";
 
export type RecommendationInput = {
  /** Набранный балл. */
  score: number;
  /** Максимальный балл (если не указан — 100). */
  maxScore?: number;
  /** Готовый процент (приоритет над score/maxScore). */
  percent?: number;
  /** Текущий уровень пользователя (код). */
  currentLevel?: string | null;
  /** Уровни материала, по которому прошёл тест. */
  materialLevels?: string[] | null;
};
 
export type LevelRecommendation = {
  recommendedLevel: string;
  recommendedLevelLabel: string;
  percent: number;
  band: RecommendationBand;
  title: string;
  message: string;
};
 
// ---------------------------------------------------------------------------
// УТИЛИТЫ
// ---------------------------------------------------------------------------
 
function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
 
function roundPercent(value: number): number {
  return Math.round(clamp(value, 0, 100));
}
 
function calculatePercent(input: RecommendationInput): number {
  if (typeof input.percent === "number" && Number.isFinite(input.percent)) {
    return roundPercent(input.percent);
  }
 
  const maxScore = typeof input.maxScore === "number" && input.maxScore > 0 ? input.maxScore : 100;
  const score = typeof input.score === "number" && Number.isFinite(input.score) ? input.score : 0;
 
  return roundPercent((score / maxScore) * 100);
}
 
/** Выбор базового уровня (относительно которого двигаемся вверх/вниз). */
function pickBaseLevel(
  input: RecommendationInput,
  fallbackCode: string,
): string {
  const currentLevel = normalizeProjectLevel(input.currentLevel);
  if (currentLevel) return currentLevel;
 
  if (Array.isArray(input.materialLevels)) {
    for (const value of input.materialLevels) {
      const level = normalizeProjectLevel(value);
      if (level) return level;
    }
  }
 
  return fallbackCode;
}
 
function getBand(percent: number): RecommendationBand {
  if (percent >= 90) return "too_easy";
  if (percent >= 75) return "comfortable";
  if (percent >= 55) return "target";
  if (percent >= 35) return "stretch";
  return "too_hard";
}
 
/**
 * Сдвиг уровня по диапазону (too_easy → выше, too_hard → ниже).
 * Работает с произвольным списком уровней проекта.
 */
function shiftLevel(
  levels: ProjectLevelConfig[],
  baseCode: string,
  band: RecommendationBand,
): string {
  if (levels.length === 0) return baseCode;
 
  const baseIndex = levels.findIndex((l) => l.code === baseCode);
  const safeIndex = baseIndex >= 0 ? baseIndex : 0;
  const base = levels[safeIndex];
 
  if (band === "too_easy") {
    const next = levels[safeIndex + 1];
    return next?.code ?? base.code;
  }
 
  if (band === "too_hard") {
    const prev = levels[safeIndex - 1];
    return prev?.code ?? base.code;
  }
 
  return base.code;
}
 
function getRecommendationText(
  band: RecommendationBand,
  recommendedLevelLabel: string,
): Pick<LevelRecommendation, "title" | "message"> {
  if (band === "too_easy") {
    return {
      title: `Можно попробовать уровень ${recommendedLevelLabel}`,
      message:
        "Результат очень высокий. Текущий уровень выглядит слишком лёгким, поэтому можно переходить выше.",
    };
  }
 
  if (band === "comfortable") {
    return {
      title: `Уверенный результат для ${recommendedLevelLabel}`,
      message:
        "Уровень подходит хорошо. Можно продолжать подготовку на нём и постепенно пробовать задания сложнее.",
    };
  }
 
  if (band === "target") {
    return {
      title: `Рекомендуемый уровень — ${recommendedLevelLabel}`,
      message:
        "Результат показывает, что этот уровень сейчас подходит лучше всего для дальнейшей подготовки.",
    };
  }
 
  if (band === "stretch") {
    return {
      title: `Уровень ${recommendedLevelLabel} пока сложный, но достижимый`,
      message:
        "Есть темы, которые стоит подтянуть. Можно продолжить подготовку на этом уровне с дополнительной практикой.",
    };
  }
 
  return {
    title: `Лучше закрепить уровень ${recommendedLevelLabel}`,
    message:
      "Результат показывает, что текущий уровень пока сложный. Рекомендуется повторить базу и пройти больше практики.",
  };
}
 
// ---------------------------------------------------------------------------
// ПУБЛИЧНЫЕ ФУНКЦИИ
// ---------------------------------------------------------------------------
 
/**
 * Рекомендация уровня по результату теста для конкретного проекта.
 * Уровни берутся из БД (project_levels).
 *
 * @param slug  slug проекта (например "gatehouse", "olympiad")
 * @param input результат теста
 */
export async function recommendLevel(
  slug: ProjectSlug,
  input: RecommendationInput,
): Promise<LevelRecommendation> {
  const project = await requireProject(slug);
  const levels = project.levels;
 
  // Базовый (средний) уровень проекта — фолбэк, если не нашли current/material.
  const fallbackCode = levels[Math.floor(levels.length / 2)]?.code ?? "A1";
 
  const percent = calculatePercent(input);
  const baseLevel = pickBaseLevel(input, fallbackCode);
  const band = getBand(percent);
  const recommendedCode = shiftLevel(levels, baseLevel, band);
 
  const level = levels.find((l) => l.code === recommendedCode);
  const recommendedLevelLabel = level?.label ?? recommendedCode;
  const text = getRecommendationText(band, recommendedLevelLabel);
 
  return {
    recommendedLevel: recommendedCode,
    recommendedLevelLabel,
    percent,
    band,
    title: text.title,
    message: text.message,
  };
}
 
/** Бейдж-подпись для диапазона результата. */
export function getRecommendationBadge(band: RecommendationBand): string {
  if (band === "too_easy") return "Слишком легко";
  if (band === "comfortable") return "Уверенно";
  if (band === "target") return "Подходит";
  if (band === "stretch") return "Нужно подтянуть";
  return "Лучше повторить базу";
}
 
/** Короткая сводка рекомендации одной строкой. */
export function getRecommendationShortMessage(recommendation: LevelRecommendation): string {
  return `${recommendation.recommendedLevelLabel} · ${recommendation.percent}% · ${getRecommendationBadge(
    recommendation.band,
  )}`;
}
 
// ---------------------------------------------------------------------------
// ОБРАТНАЯ СОВМЕСТИМОСТЬ С lib/exams/recommendLevel.ts
// ---------------------------------------------------------------------------
 
/**
 * Тонкая обёртка для старого кода, который работал только с Gatehouse.
 * Внутри делегирует в универсальную функцию recommendLevel("gatehouse", ...).
 */
export async function recommendGatehouseLevel(
  input: RecommendationInput,
): Promise<LevelRecommendation> {
  return recommendLevel("gatehouse", input);
}
 
export async function getGatehouseRecommendationShortMessage(
  input: RecommendationInput,
): Promise<string> {
  const rec = await recommendGatehouseLevel(input);
  return getRecommendationShortMessage(rec);
}
 