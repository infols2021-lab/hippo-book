export type GatehouseLevelCode =
  | "stage_1"
  | "stage_2"
  | "stage_3"
  | "A1"
  | "A2"
  | "B1"
  | "B2"
  | "C1"
  | "C2";

export type GatehouseLevelGroup = "stage" | "cefr";

export type GatehouseLevel = {
  code: GatehouseLevelCode;
  label: string;
  shortLabel: string;
  group: GatehouseLevelGroup;
  order: number;
  description: string;
};

export const GATEHOUSE_LEVELS: GatehouseLevel[] = [
  {
    code: "stage_1",
    label: "Stage 1",
    shortLabel: "Stage 1",
    group: "stage",
    order: 10,
    description: "Начальный школьный уровень Gatehouse Awards.",
  },
  {
    code: "stage_2",
    label: "Stage 2",
    shortLabel: "Stage 2",
    group: "stage",
    order: 20,
    description: "Следующий школьный уровень Gatehouse Awards.",
  },
  {
    code: "stage_3",
    label: "Stage 3",
    shortLabel: "Stage 3",
    group: "stage",
    order: 30,
    description: "Продвинутый школьный уровень Gatehouse Awards.",
  },
  {
    code: "A1",
    label: "A1",
    shortLabel: "A1",
    group: "cefr",
    order: 40,
    description: "Базовый уровень владения английским языком.",
  },
  {
    code: "A2",
    label: "A2",
    shortLabel: "A2",
    group: "cefr",
    order: 50,
    description: "Элементарный уровень владения английским языком.",
  },
  {
    code: "B1",
    label: "B1",
    shortLabel: "B1",
    group: "cefr",
    order: 60,
    description: "Средний уровень владения английским языком.",
  },
  {
    code: "B2",
    label: "B2",
    shortLabel: "B2",
    group: "cefr",
    order: 70,
    description: "Уверенный средний уровень владения английским языком.",
  },
  {
    code: "C1",
    label: "C1",
    shortLabel: "C1",
    group: "cefr",
    order: 80,
    description: "Продвинутый уровень владения английским языком.",
  },
  {
    code: "C2",
    label: "C2",
    shortLabel: "C2",
    group: "cefr",
    order: 90,
    description: "Профессиональный уровень владения английским языком.",
  },
];

export const GATEHOUSE_LEVEL_CODES = GATEHOUSE_LEVELS.map((level) => level.code);

export const GATEHOUSE_STAGE_LEVELS = GATEHOUSE_LEVELS.filter(
  (level) => level.group === "stage",
);

export const GATEHOUSE_CEFR_LEVELS = GATEHOUSE_LEVELS.filter(
  (level) => level.group === "cefr",
);

export const GATEHOUSE_LEVEL_LABELS: Record<GatehouseLevelCode, string> = {
  stage_1: "Stage 1",
  stage_2: "Stage 2",
  stage_3: "Stage 3",
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
  C2: "C2",
};

export const GATEHOUSE_LEVEL_ALIASES: Record<string, GatehouseLevelCode> = {
  stage_1: "stage_1",
  stage1: "stage_1",
  "stage 1": "stage_1",
  "stage-1": "stage_1",
  "Stage 1": "stage_1",

  stage_2: "stage_2",
  stage2: "stage_2",
  "stage 2": "stage_2",
  "stage-2": "stage_2",
  "Stage 2": "stage_2",

  stage_3: "stage_3",
  stage3: "stage_3",
  "stage 3": "stage_3",
  "stage-3": "stage_3",
  "Stage 3": "stage_3",

  a1: "A1",
  A1: "A1",

  a2: "A2",
  A2: "A2",

  b1: "B1",
  B1: "B1",

  b2: "B2",
  B2: "B2",

  c1: "C1",
  C1: "C1",

  c2: "C2",
  C2: "C2",
};

export function isGatehouseLevelCode(value: unknown): value is GatehouseLevelCode {
  return typeof value === "string" && GATEHOUSE_LEVEL_CODES.includes(value as GatehouseLevelCode);
}

export function normalizeGatehouseLevel(value: unknown): GatehouseLevelCode | null {
  if (typeof value !== "string") return null;

  const raw = value.trim();
  if (!raw) return null;

  if (isGatehouseLevelCode(raw)) return raw;

  const normalized = raw.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  const spaced = raw.toLowerCase().replace(/[_-]+/g, " ");

  return (
    GATEHOUSE_LEVEL_ALIASES[raw] ??
    GATEHOUSE_LEVEL_ALIASES[normalized] ??
    GATEHOUSE_LEVEL_ALIASES[spaced] ??
    null
  );
}

export function normalizeGatehouseLevels(values: unknown): GatehouseLevelCode[] {
  if (!Array.isArray(values)) {
    const level = normalizeGatehouseLevel(values);
    return level ? [level] : [];
  }

  const result: GatehouseLevelCode[] = [];

  for (const value of values) {
    const level = normalizeGatehouseLevel(value);
    if (level && !result.includes(level)) {
      result.push(level);
    }
  }

  return sortGatehouseLevels(result);
}

export function getGatehouseLevel(code: unknown): GatehouseLevel | null {
  const normalized = normalizeGatehouseLevel(code);
  if (!normalized) return null;

  return GATEHOUSE_LEVELS.find((level) => level.code === normalized) ?? null;
}

export function getGatehouseLevelLabel(code: unknown): string {
  const level = getGatehouseLevel(code);
  return level?.label ?? "—";
}

export function getGatehouseLevelDescription(code: unknown): string {
  const level = getGatehouseLevel(code);
  return level?.description ?? "";
}

export function sortGatehouseLevels(levels: GatehouseLevelCode[]): GatehouseLevelCode[] {
  const order = new Map(GATEHOUSE_LEVELS.map((level) => [level.code, level.order]));

  return [...levels].sort((a, b) => {
    return (order.get(a) ?? 999) - (order.get(b) ?? 999);
  });
}

export function formatGatehouseLevels(values: unknown): string {
  const levels = normalizeGatehouseLevels(values);

  if (!levels.length) return "—";

  return levels.map((level) => GATEHOUSE_LEVEL_LABELS[level]).join(", ");
}

export function getNextGatehouseLevel(code: unknown): GatehouseLevel | null {
  const level = getGatehouseLevel(code);
  if (!level) return null;

  const index = GATEHOUSE_LEVELS.findIndex((item) => item.code === level.code);
  if (index < 0) return null;

  return GATEHOUSE_LEVELS[index + 1] ?? null;
}

export function getPreviousGatehouseLevel(code: unknown): GatehouseLevel | null {
  const level = getGatehouseLevel(code);
  if (!level) return null;

  const index = GATEHOUSE_LEVELS.findIndex((item) => item.code === level.code);
  if (index <= 0) return null;

  return GATEHOUSE_LEVELS[index - 1] ?? null;
}