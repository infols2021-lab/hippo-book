import {
  GATEHOUSE_LEVELS,
  type GatehouseLevelCode,
  getGatehouseLevel,
  getNextGatehouseLevel,
  getPreviousGatehouseLevel,
  normalizeGatehouseLevel,
} from "@/lib/exams/levels";

export type GatehouseRecommendationBand =
  | "too_easy"
  | "comfortable"
  | "target"
  | "stretch"
  | "too_hard";

export type GatehouseRecommendationInput = {
  score: number;
  maxScore?: number;
  percent?: number;
  currentLevel?: string | null;
  materialLevels?: string[] | null;
};

export type GatehouseRecommendation = {
  recommendedLevel: GatehouseLevelCode;
  recommendedLevelLabel: string;
  percent: number;
  band: GatehouseRecommendationBand;
  title: string;
  message: string;
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function roundPercent(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

function calculatePercent(input: GatehouseRecommendationInput): number {
  if (typeof input.percent === "number" && Number.isFinite(input.percent)) {
    return roundPercent(input.percent);
  }

  const maxScore = typeof input.maxScore === "number" && input.maxScore > 0 ? input.maxScore : 100;
  const score = typeof input.score === "number" && Number.isFinite(input.score) ? input.score : 0;

  return roundPercent((score / maxScore) * 100);
}

function pickBaseLevel(input: GatehouseRecommendationInput): GatehouseLevelCode {
  const currentLevel = normalizeGatehouseLevel(input.currentLevel);
  if (currentLevel) return currentLevel;

  if (Array.isArray(input.materialLevels)) {
    for (const value of input.materialLevels) {
      const level = normalizeGatehouseLevel(value);
      if (level) return level;
    }
  }

  return "A1";
}

function getBand(percent: number): GatehouseRecommendationBand {
  if (percent >= 90) return "too_easy";
  if (percent >= 75) return "comfortable";
  if (percent >= 55) return "target";
  if (percent >= 35) return "stretch";
  return "too_hard";
}

function getRecommendedLevelByBand(
  baseLevel: GatehouseLevelCode,
  band: GatehouseRecommendationBand,
): GatehouseLevelCode {
  const base = getGatehouseLevel(baseLevel) ?? GATEHOUSE_LEVELS[3];

  if (band === "too_easy") {
    return getNextGatehouseLevel(base.code)?.code ?? base.code;
  }

  if (band === "too_hard") {
    return getPreviousGatehouseLevel(base.code)?.code ?? base.code;
  }

  return base.code;
}

function getRecommendationText(
  band: GatehouseRecommendationBand,
  recommendedLevelLabel: string,
): Pick<GatehouseRecommendation, "title" | "message"> {
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

export function recommendGatehouseLevel(
  input: GatehouseRecommendationInput,
): GatehouseRecommendation {
  const percent = calculatePercent(input);
  const baseLevel = pickBaseLevel(input);
  const band = getBand(percent);
  const recommendedLevel = getRecommendedLevelByBand(baseLevel, band);
  const level = getGatehouseLevel(recommendedLevel);
  const recommendedLevelLabel = level?.label ?? recommendedLevel;
  const text = getRecommendationText(band, recommendedLevelLabel);

  return {
    recommendedLevel,
    recommendedLevelLabel,
    percent,
    band,
    title: text.title,
    message: text.message,
  };
}

export function getGatehouseRecommendationBadge(band: GatehouseRecommendationBand): string {
  if (band === "too_easy") return "Слишком легко";
  if (band === "comfortable") return "Уверенно";
  if (band === "target") return "Подходит";
  if (band === "stretch") return "Нужно подтянуть";
  return "Лучше повторить базу";
}

export function getGatehouseRecommendationShortMessage(
  recommendation: GatehouseRecommendation,
): string {
  return `${recommendation.recommendedLevelLabel} · ${recommendation.percent}% · ${getGatehouseRecommendationBadge(
    recommendation.band,
  )}`;
}