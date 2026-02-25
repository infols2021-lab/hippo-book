// lib/streaks/roadmap.ts

export type StreakTierCode =
  | "none"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "legendary";

export type StreakRewardType = "icon" | "title" | "both";

export type StreakIconCode =
  | "starter_spark"
  | "bronze_hop"
  | "bronze_charge"
  | "silver_stride"
  | "silver_guard"
  | "gold_rush"
  | "gold_flare"
  | "platinum_wave"
  | "diamond_burst"
  | "legendary_crown"
  | "legendary_hipposha";

export type StreakIconVariant = {
  code: StreakIconCode;
  unlockAt: number;
  tierCode: StreakTierCode;
  emoji: string;
  shortLabel: string;
  fullLabel: string;
  description: string;
  accent: string; // purely UI hint

  // реальные пути к ассетам в Supabase Storage bucket "streak-icons"
  webpPath: string;
  pngPath: string;
};

export type StreakRoadmapNode = {
  streak: number;
  rewardType: StreakRewardType;

  // icon reward
  iconCode?: StreakIconCode;

  // title reward
  titleCode?: string;
  titleLabel?: string;

  // optional flavor
  note?: string;
  isOlympiadFocusMilestone?: boolean;
};

export type RoadmapCursor = {
  currentStreak: number;
  maxStreak: number;
  prevNode: StreakRoadmapNode;
  nextNode: StreakRoadmapNode | null;
  prevIndex: number;
  nextIndex: number | null;
  segmentProgress: number; // 0..1
  fillPercent: number; // 0..100 across full roadmap
  virtualIndex: number; // e.g. 4.35 node positions
};

export type UiIconMilestone = {
  kind: "icon";
  code: StreakIconCode;
  day: number;
  label: string;
  description: string;
  iconEmoji: string;
};

export type UiTitleMilestone = {
  kind: "title";
  code: string;
  day: number;
  label: string;
  description: string;
};

export const STREAK_ICONS_BUCKET_DEFAULT = "streak-icons";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function asInt(n: unknown) {
  return Number.isFinite(Number(n)) ? Math.max(0, Math.floor(Number(n))) : 0;
}

function asBool(v: unknown, fallback = false) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(s)) return true;
    if (["0", "false", "no", "n", "off"].includes(s)) return false;
  }
  return fallback;
}

function asStringOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function pickFirst(obj: Record<string, any>, keys: string[]) {
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined) {
      return obj[k];
    }
  }
  return undefined;
}

function iconAssetPaths(baseName: string) {
  return {
    webpPath: `v1/defaults/${baseName}.webp`,
    pngPath: `v1/defaults/${baseName}.png`,
  };
}

/**
 * Варианты иконок стрика (источник истины для roadmap/UI).
 * Здесь же лежат реальные пути к файлам в bucket.
 */
export const STREAK_ICON_VARIANTS: StreakIconVariant[] = [
  {
    code: "starter_spark",
    unlockAt: 1,
    tierCode: "none",
    emoji: "✨",
    shortLabel: "Старт",
    fullLabel: "Стартовая искра",
    description: "Первая искра серии — просто начал, и это уже круто.",
    accent: "rgba(148,163,184,0.95)",
    ...iconAssetPaths("start"),
  },
  {
    code: "bronze_hop",
    unlockAt: 7,
    tierCode: "bronze",
    emoji: "🥉",
    shortLabel: "Бронза I",
    fullLabel: "Бронзовый разбег",
    description: "Неделя на серии — уже не случайность.",
    accent: "rgba(205,127,50,0.95)",
    ...iconAssetPaths("bronze-1"),
  },
  {
    code: "bronze_charge",
    unlockAt: 14,
    tierCode: "bronze",
    emoji: "🟤",
    shortLabel: "Бронза II",
    fullLabel: "Бронзовый заряд",
    description: "Две недели подряд — дисциплина проснулась.",
    accent: "rgba(180,110,40,0.95)",
    ...iconAssetPaths("bronze-2"),
  },
  {
    code: "silver_stride",
    unlockAt: 25,
    tierCode: "silver",
    emoji: "🥈",
    shortLabel: "Серебро I",
    fullLabel: "Серебряный шаг",
    description: "Стабильная серия — уверенный темп.",
    accent: "rgba(203,213,225,0.95)",
    ...iconAssetPaths("silver-1"),
  },
  {
    code: "silver_guard",
    unlockAt: 40,
    tierCode: "silver",
    emoji: "⚪",
    shortLabel: "Серебро II",
    fullLabel: "Серебряный щит",
    description: "Серия держится стабильно и уверенно.",
    accent: "rgba(180,190,205,0.95)",
    ...iconAssetPaths("silver-2"),
  },
  {
    code: "gold_rush",
    unlockAt: 70,
    tierCode: "gold",
    emoji: "🥇",
    shortLabel: "Золото I",
    fullLabel: "Золотой рывок",
    description: "Серьёзная дистанция. Ты уже в игре надолго.",
    accent: "rgba(245,158,11,0.96)",
    ...iconAssetPaths("gold-1"),
  },
  {
    code: "gold_flare",
    unlockAt: 100,
    tierCode: "gold",
    emoji: "🌟",
    shortLabel: "Золото II",
    fullLabel: "Золотая вспышка",
    description: "Сотка — это уже красиво. Очень красиво.",
    accent: "rgba(251,191,36,0.96)",
    ...iconAssetPaths("gold-2"),
  },
  {
    code: "platinum_wave",
    unlockAt: 150,
    tierCode: "platinum",
    emoji: "🌌",
    shortLabel: "Платина",
    fullLabel: "Платиновая волна",
    description: "Редкая серия. Мощный стиль.",
    accent: "rgba(129,140,248,0.95)",
    ...iconAssetPaths("platinum-1"),
  },
  {
    code: "diamond_burst",
    unlockAt: 200,
    tierCode: "diamond",
    emoji: "💎",
    shortLabel: "Алмаз",
    fullLabel: "Алмазный импульс",
    description: "Очень редкий темп. Уже уровень легенд.",
    accent: "rgba(59,130,246,0.95)",
    ...iconAssetPaths("diamond-1"),
  },
  {
    code: "legendary_crown",
    unlockAt: 250,
    tierCode: "legendary",
    emoji: "👑",
    shortLabel: "Легенда I",
    fullLabel: "Легендарная корона",
    description: "Серия монструозная. Хиппоша в шоке.",
    accent: "rgba(236,72,153,0.95)",
    ...iconAssetPaths("legendary-1"),
  },
  {
    code: "legendary_hipposha",
    unlockAt: 300,
    tierCode: "legendary",
    emoji: "🦛",
    shortLabel: "Легенда II",
    fullLabel: "Легенда Хиппоши",
    description: "Максимальный рубеж дорожки. Особая иконка.",
    accent: "rgba(168,85,247,0.95)",
    ...iconAssetPaths("legendary-2"),
  },
];

/**
 * Точки дорожки (иконки + титулы).
 * ВАЖНО: идут строго по возрастанию streak.
 */
export const STREAK_ROADMAP_NODES: StreakRoadmapNode[] = [
  { streak: 1, rewardType: "icon", iconCode: "starter_spark", note: "Старт серии" },

  { streak: 3, rewardType: "title", titleCode: "streak_3_just_joined", titleLabel: "Я только зашёл" },

  {
    streak: 7,
    rewardType: "both",
    iconCode: "bronze_hop",
    titleCode: "streak_7_focused",
    titleLabel: "Целеустремлённый",
  },

  {
    streak: 14,
    rewardType: "both",
    iconCode: "bronze_charge",
    titleCode: "streak_14_knowledge",
    titleLabel: "Идущий к знаниям",
  },

  { streak: 21, rewardType: "title", titleCode: "streak_21_discipline", titleLabel: "Железная дисциплина" },

  {
    streak: 25,
    rewardType: "icon",
    iconCode: "silver_stride",
    isOlympiadFocusMilestone: true,
    note: "Важный рубеж к олимпиаде",
  },

  { streak: 30, rewardType: "title", titleCode: "streak_30_habit_master", titleLabel: "Мастер привычки" },

  { streak: 40, rewardType: "icon", iconCode: "silver_guard" },

  { streak: 60, rewardType: "title", titleCode: "streak_60_unstoppable", titleLabel: "Неостановимый" },

  { streak: 70, rewardType: "icon", iconCode: "gold_rush" },

  {
    streak: 100,
    rewardType: "both",
    iconCode: "gold_flare",
    titleCode: "streak_100_progress_legend",
    titleLabel: "Легенда прогресса",
  },

  { streak: 150, rewardType: "icon", iconCode: "platinum_wave" },

  { streak: 200, rewardType: "icon", iconCode: "diamond_burst" },

  { streak: 250, rewardType: "icon", iconCode: "legendary_crown" },

  {
    streak: 300,
    rewardType: "both",
    iconCode: "legendary_hipposha",
    titleCode: "streak_300_hipposha_legend",
    titleLabel: "Легенда Хиппоши",
    note: "Особый рубеж",
  },
];

export const STREAK_ICON_VARIANTS_BY_CODE: Record<StreakIconCode, StreakIconVariant> =
  STREAK_ICON_VARIANTS.reduce((acc, it) => {
    acc[it.code] = it;
    return acc;
  }, {} as Record<StreakIconCode, StreakIconVariant>);

/**
 * Legacy коды (из старых локальных/временных UI) -> новые реальные коды.
 * + поддержка имён файлов/путей из bucket.
 */
export const LEGACY_ICON_CODE_ALIASES: Record<string, StreakIconCode> = {
  // старые UI алиасы
  start: "starter_spark",
  bronze_1: "bronze_hop",
  bronze_2: "bronze_charge",
  silver_1: "silver_stride",
  silver_2: "silver_guard",
  gold_1: "gold_rush",
  gold_2: "gold_flare",
  holiday: "platinum_wave",
  diamond: "diamond_burst",
  legend_1: "legendary_crown",
  legend_2: "legendary_hipposha",

  // алиасы под реальные названия файлов в bucket / DB
  "bronze-1": "bronze_hop",
  "bronze-2": "bronze_charge",
  "silver-1": "silver_stride",
  "silver-2": "silver_guard",
  "gold-1": "gold_rush",
  "gold-2": "gold_flare",
  "platinum-1": "platinum_wave",
  "diamond-1": "diamond_burst",
  "legendary-1": "legendary_crown",
  "legendary-2": "legendary_hipposha",
};

export const ROADMAP_MAX_STREAK =
  STREAK_ROADMAP_NODES[STREAK_ROADMAP_NODES.length - 1]?.streak ?? 300;

function devValidateConfig() {
  if (process.env.NODE_ENV === "production") return;

  for (let i = 0; i < STREAK_ROADMAP_NODES.length; i++) {
    const n = STREAK_ROADMAP_NODES[i];
    if (i > 0 && n.streak <= STREAK_ROADMAP_NODES[i - 1].streak) {
      throw new Error("STREAK_ROADMAP_NODES must be strictly ascending by streak");
    }
    if ((n.rewardType === "icon" || n.rewardType === "both") && !n.iconCode) {
      throw new Error(`Roadmap node ${n.streak} requires iconCode`);
    }
    if ((n.rewardType === "title" || n.rewardType === "both") && !n.titleLabel) {
      throw new Error(`Roadmap node ${n.streak} requires titleLabel`);
    }
  }

  for (let i = 0; i < STREAK_ICON_VARIANTS.length; i++) {
    const n = STREAK_ICON_VARIANTS[i];
    if (i > 0 && n.unlockAt <= STREAK_ICON_VARIANTS[i - 1].unlockAt) {
      throw new Error("STREAK_ICON_VARIANTS must be strictly ascending by unlockAt");
    }
  }
}
devValidateConfig();

function normalizeRawIconInput(input: string) {
  // убираем query/hash
  let raw = input.trim();
  raw = raw.split("#")[0] ?? raw;
  raw = raw.split("?")[0] ?? raw;

  // унификация слешей и регистра
  raw = raw.replace(/\\/g, "/").trim().toLowerCase();

  return raw;
}

function stripFileExtension(name: string) {
  return name.replace(/\.(webp|png|jpg|jpeg|svg)$/i, "");
}

export function normalizeIconCode(input: string | null | undefined): StreakIconCode | null {
  if (!input) return null;

  const rawOriginal = String(input).trim();
  if (!rawOriginal) return null;

  // 1) точное совпадение нового кода
  if (STREAK_ICON_VARIANTS_BY_CODE[rawOriginal as StreakIconCode]) {
    return rawOriginal as StreakIconCode;
  }

  const raw = normalizeRawIconInput(rawOriginal);

  // 2) точное совпадение после lower-case (на случай другого регистра)
  if (STREAK_ICON_VARIANTS_BY_CODE[raw as StreakIconCode]) {
    return raw as StreakIconCode;
  }

  // 3) алиас по полной строке
  if (LEGACY_ICON_CODE_ALIASES[raw]) {
    return LEGACY_ICON_CODE_ALIASES[raw];
  }

  // 4) если прилетел путь, берём basename (например v1/defaults/start.webp)
  const basename = raw.split("/").filter(Boolean).at(-1) ?? raw;
  const basenameNoExt = stripFileExtension(basename);

  if (STREAK_ICON_VARIANTS_BY_CODE[basenameNoExt as StreakIconCode]) {
    return basenameNoExt as StreakIconCode;
  }

  if (LEGACY_ICON_CODE_ALIASES[basenameNoExt]) {
    return LEGACY_ICON_CODE_ALIASES[basenameNoExt];
  }

  // 5) на всякий случай заменим дефисы на подчёркивания / наоборот
  const withUnderscores = basenameNoExt.replace(/-/g, "_");
  const withDashes = basenameNoExt.replace(/_/g, "-");

  if (LEGACY_ICON_CODE_ALIASES[withUnderscores]) {
    return LEGACY_ICON_CODE_ALIASES[withUnderscores];
  }
  if (LEGACY_ICON_CODE_ALIASES[withDashes]) {
    return LEGACY_ICON_CODE_ALIASES[withDashes];
  }

  if (STREAK_ICON_VARIANTS_BY_CODE[withUnderscores as StreakIconCode]) {
    return withUnderscores as StreakIconCode;
  }

  return null;
}

export function getIconVariant(code?: StreakIconCode | string | null): StreakIconVariant | null {
  const normalized = normalizeIconCode(code ?? null);
  if (!normalized) return null;
  return STREAK_ICON_VARIANTS_BY_CODE[normalized] ?? null;
}

export function getStreakIconStoragePaths(
  code?: StreakIconCode | string | null
): { webpPath: string; pngPath: string } | null {
  const v = getIconVariant(code ?? null);
  if (!v) return null;
  return { webpPath: v.webpPath, pngPath: v.pngPath };
}

export function getStreakIconStorageCandidatePaths(code?: StreakIconCode | string | null): string[] {
  const paths = getStreakIconStoragePaths(code ?? null);
  if (!paths) return [];
  return [paths.webpPath, paths.pngPath];
}

export function getRoadmapNodes() {
  return STREAK_ROADMAP_NODES;
}

export function getRoadmapNodeByStreak(streak: number): StreakRoadmapNode | null {
  return STREAK_ROADMAP_NODES.find((n) => n.streak === asInt(streak)) ?? null;
}

export function getNextRoadmapNode(currentStreak: number): StreakRoadmapNode | null {
  const s = asInt(currentStreak);
  return STREAK_ROADMAP_NODES.find((n) => n.streak > s) ?? null;
}

export function getLastReachedRoadmapNode(currentStreak: number): StreakRoadmapNode | null {
  const s = asInt(currentStreak);
  let last: StreakRoadmapNode | null = null;
  for (const n of STREAK_ROADMAP_NODES) {
    if (n.streak <= s) last = n;
    else break;
  }
  return last;
}

export function getUnlockedRoadmapNodesByLongest(longestStreak: number): StreakRoadmapNode[] {
  const s = asInt(longestStreak);
  return STREAK_ROADMAP_NODES.filter((n) => n.streak <= s);
}

export function getUnlockedTitlesByLongest(longestStreak: number) {
  const s = asInt(longestStreak);
  return STREAK_ROADMAP_NODES.filter(
    (n) => n.streak <= s && (n.rewardType === "title" || n.rewardType === "both") && n.titleCode
  ).map((n) => ({
    titleCode: n.titleCode!,
    titleLabel: n.titleLabel ?? n.titleCode!,
    unlockedAt: n.streak,
  }));
}

export function getUnlockedIconCodesByLongest(longestStreak: number): StreakIconCode[] {
  const s = asInt(longestStreak);
  return STREAK_ICON_VARIANTS.filter((v) => v.unlockAt <= s).map((v) => v.code);
}

export function getLatestUnlockedIconCodeByLongest(longestStreak: number): StreakIconCode | null {
  const unlocked = getUnlockedIconCodesByLongest(longestStreak);
  return unlocked.length ? unlocked[unlocked.length - 1] : null;
}

export function getResolvedSelectedIconCode(
  preferredCode: string | null | undefined,
  longestStreak: number
): StreakIconCode | null {
  const normalizedPreferred = normalizeIconCode(preferredCode);
  if (normalizedPreferred) {
    const unlocked = getUnlockedIconCodesByLongest(longestStreak);
    if (unlocked.includes(normalizedPreferred)) return normalizedPreferred;
  }
  return getLatestUnlockedIconCodeByLongest(longestStreak);
}

/**
 * Fallback-определение визуального tier по стрику/иконке.
 * Использует реальные иконки, а не внешний RPC tier_code.
 */
export function getTierCodeByStreak(streak: number): StreakTierCode {
  const latestIcon = getLatestUnlockedIconCodeByLongest(streak);
  const v = getIconVariant(latestIcon);
  return v?.tierCode ?? "none";
}

/**
 * UI-списки для модалки (чтобы код модалки не гадал названия export'ов).
 */
export const STREAK_ICON_MILESTONES: UiIconMilestone[] = STREAK_ICON_VARIANTS.map((v) => ({
  kind: "icon",
  code: v.code,
  day: v.unlockAt,
  label: v.shortLabel,
  description: v.description,
  iconEmoji: v.emoji,
}));

export const STREAK_TITLE_MILESTONES: UiTitleMilestone[] = STREAK_ROADMAP_NODES.flatMap((n) => {
  if ((n.rewardType === "title" || n.rewardType === "both") && n.titleCode && n.titleLabel) {
    return [
      {
        kind: "title" as const,
        code: n.titleCode,
        day: n.streak,
        label: n.titleLabel,
        description: n.note ?? "Титул за серию",
      },
    ];
  }
  return [];
});

export const STREAK_TITLE_LABELS_BY_CODE: Record<string, string> = STREAK_TITLE_MILESTONES.reduce(
  (acc, t) => {
    acc[t.code] = t.label;
    return acc;
  },
  {} as Record<string, string>
);

export function getTitleLabelByCode(titleCode: string | null | undefined): string | null {
  if (!titleCode) return null;
  return STREAK_TITLE_LABELS_BY_CODE[titleCode] ?? titleCode;
}

/**
 * Главный хелпер для вертикальной дорожки.
 * Даёт процент заполнения и позицию курсора между узлами.
 *
 * ВАЖНО: базируется на текущем стрике.
 * => Если стрик упал, fillPercent и cursor тоже откатятся.
 */
export function getRoadmapCursor(currentStreak: number): RoadmapCursor {
  const s = asInt(currentStreak);
  const nodes = STREAK_ROADMAP_NODES;
  const maxStreak = ROADMAP_MAX_STREAK;

  if (!nodes.length) {
    throw new Error("STREAK_ROADMAP_NODES is empty");
  }

  // до первого узла
  if (s < nodes[0].streak) {
    const first = nodes[0];
    const denom = Math.max(1, first.streak);
    const segmentProgress = clamp(s / denom, 0, 1);

    const prevNode: StreakRoadmapNode = {
      streak: 0,
      rewardType: "title",
      titleCode: "virtual_start",
      titleLabel: "Старт",
      note: "До первого рубежа",
    };

    return {
      currentStreak: s,
      maxStreak,
      prevNode,
      nextNode: first,
      prevIndex: -1,
      nextIndex: 0,
      segmentProgress,
      fillPercent: 0,
      virtualIndex: 0,
    };
  }

  let prevIndex = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].streak <= s) prevIndex = i;
    else break;
  }

  const prevNode = nodes[prevIndex];
  const nextNode = nodes[prevIndex + 1] ?? null;

  if (!nextNode) {
    return {
      currentStreak: s,
      maxStreak,
      prevNode,
      nextNode: null,
      prevIndex,
      nextIndex: null,
      segmentProgress: 1,
      fillPercent: 100,
      virtualIndex: nodes.length - 1,
    };
  }

  const denom = Math.max(1, nextNode.streak - prevNode.streak);
  const segmentProgress = clamp((s - prevNode.streak) / denom, 0, 1);

  const virtualIndex = prevIndex + segmentProgress;
  const totalSegments = Math.max(1, nodes.length - 1);
  const fillPercent = clamp((virtualIndex / totalSegments) * 100, 0, 100);

  return {
    currentStreak: s,
    maxStreak,
    prevNode,
    nextNode,
    prevIndex,
    nextIndex: prevIndex + 1,
    segmentProgress,
    fillPercent,
    virtualIndex,
  };
}

export function describeRoadmapReward(node: StreakRoadmapNode): string {
  if (node.rewardType === "icon") {
    const icon = getIconVariant(node.iconCode ?? null);
    return icon ? `Иконка: ${icon.fullLabel}` : "Ап иконки";
  }
  if (node.rewardType === "title") {
    return `Титул: ${node.titleLabel ?? "Новый титул"}`;
  }
  const icon = getIconVariant(node.iconCode ?? null);
  return `Особый рубеж: ${icon?.fullLabel ?? "иконка"} + ${node.titleLabel ?? "титул"}`;
}

/* -------------------------------------------------------------------------- */
/* Нормализация RPC snapshot (общий хелпер для API, чтобы не было рассинхрона) */
/* -------------------------------------------------------------------------- */

export type NormalizedRpcStreakSnapshot = {
  raw: Record<string, any> | null;

  currentStreak: number; // raw/current
  longestStreak: number; // raw/longest

  displayCurrentStreak: number; // what UI shows
  displayLongestStreak: number;

  lastCompletedDate: string | null;
  doneToday: boolean;
  canSaveToday: boolean;

  tierCode: string;

  nextMilestoneStreak: number | null;
  nextMilestoneDaysLeft: number | null;
};

export function normalizeRpcStreakSnapshot(input: Record<string, any> | null | undefined): NormalizedRpcStreakSnapshot {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, any>;

  const currentStreak = asInt(
    pickFirst(raw, [
      "current_streak",
      "raw_current_streak",
      "currentStreak",
      "rawCurrentStreak",
      "current",
      "streak",
    ])
  );

  const longestStreak = asInt(
    pickFirst(raw, [
      "longest_streak",
      "raw_longest_streak",
      "longestStreak",
      "rawLongestStreak",
      "max_streak",
      "maxStreak",
    ]) ?? currentStreak
  );

  const displayCurrentStreak = asInt(
    pickFirst(raw, [
      "display_current_streak",
      "displayCurrentStreak",
      "ui_current_streak",
      "uiCurrentStreak",
    ]) ?? currentStreak
  );

  const displayLongestStreak = asInt(
    pickFirst(raw, [
      "display_longest_streak",
      "displayLongestStreak",
      "ui_longest_streak",
      "uiLongestStreak",
    ]) ?? longestStreak
  );

  const lastCompletedDate = asStringOrNull(
    pickFirst(raw, [
      "last_completed_date",
      "lastCompletedDate",
      "activity_date",
      "lastActivityDate",
    ])
  );

  const doneToday = asBool(
    pickFirst(raw, [
      "done_today",
      "today_completed",
      "todayCompleted",
      "is_today_completed",
      "isTodayCompleted",
    ]),
    false
  );

  const canSaveTodayRaw = pickFirst(raw, [
    "can_save_today",
    "canSaveToday",
    "is_today_available",
    "isTodayAvailable",
    "can_record_today",
    "canRecordToday",
  ]);

  const canSaveToday =
    canSaveTodayRaw === undefined || canSaveTodayRaw === null
      ? !doneToday
      : asBool(canSaveTodayRaw, !doneToday);

  const nextMilestoneStreakRaw = pickFirst(raw, [
    "next_milestone_streak",
    "nextMilestoneStreak",
    "next_reward_at",
    "nextRewardAt",
  ]);

  const nextMilestoneDaysLeftRaw = pickFirst(raw, [
    "next_milestone_days_left",
    "nextMilestoneDaysLeft",
    "days_to_next",
    "daysToNext",
  ]);

  const tierCode =
    asStringOrNull(pickFirst(raw, ["tier_code", "tierCode"])) ??
    getTierCodeByStreak(displayCurrentStreak);

  return {
    raw: raw as Record<string, any>,
    currentStreak,
    longestStreak,
    displayCurrentStreak,
    displayLongestStreak,
    lastCompletedDate,
    doneToday,
    canSaveToday,
    tierCode,
    nextMilestoneStreak:
      nextMilestoneStreakRaw == null ? null : asInt(nextMilestoneStreakRaw),
    nextMilestoneDaysLeft:
      nextMilestoneDaysLeftRaw == null ? null : asInt(nextMilestoneDaysLeftRaw),
  };
}

/**
 * Удобный "совместимый" payload для UI:
 * - camelCase
 * - snake_case aliases (чтобы старые куски UI не мигали/не ломались)
 */
export function toCompatStreakSnapshotPayload(snapshot: NormalizedRpcStreakSnapshot) {
  return {
    // camelCase
    currentStreak: snapshot.currentStreak,
    longestStreak: snapshot.longestStreak,
    displayCurrentStreak: snapshot.displayCurrentStreak,
    displayLongestStreak: snapshot.displayLongestStreak,
    lastCompletedDate: snapshot.lastCompletedDate,
    doneToday: snapshot.doneToday,
    canSaveToday: snapshot.canSaveToday,
    tierCode: snapshot.tierCode,
    nextMilestoneStreak: snapshot.nextMilestoneStreak,
    nextMilestoneDaysLeft: snapshot.nextMilestoneDaysLeft,
    raw: snapshot.raw,

    // snake_case / legacy-friendly aliases
    current_streak: snapshot.currentStreak,
    raw_current_streak: snapshot.currentStreak,
    longest_streak: snapshot.longestStreak,
    raw_longest_streak: snapshot.longestStreak,
    display_current_streak: snapshot.displayCurrentStreak,
    display_longest_streak: snapshot.displayLongestStreak,
    last_completed_date: snapshot.lastCompletedDate,
    done_today: snapshot.doneToday,
    today_completed: snapshot.doneToday,
    can_save_today: snapshot.canSaveToday,
    tier_code: snapshot.tierCode,
    next_milestone_streak: snapshot.nextMilestoneStreak,
    next_milestone_days_left: snapshot.nextMilestoneDaysLeft,
  };
}

/* -------------------------------------------------------------------------- */
/* Доп. хелперы под API/UI с DB таблицей streak_icon_assets                   */
/* -------------------------------------------------------------------------- */

export type StreakIconAssetDbRowLike = {
  code: string;
  label?: string | null;
  tier_code?: string | null;
  webp_path?: string | null;
  png_path?: string | null;
  emoji_fallback?: string | null;
  is_active?: boolean | null;
  is_default_for_tier?: boolean | null;
  sort_order?: number | null;
  meta?: Record<string, any> | null;
};

export function getRoadmapCodeFromDbIconAsset(
  asset: StreakIconAssetDbRowLike | null | undefined
): StreakIconCode | null {
  if (!asset) return null;
  return (
    normalizeIconCode(asset.code) ||
    normalizeIconCode(asset.webp_path ?? null) ||
    normalizeIconCode(asset.png_path ?? null)
  );
}

export function getPreferredDbAssetPaths(asset: StreakIconAssetDbRowLike | null | undefined) {
  if (!asset) return { webpPath: null as string | null, pngPath: null as string | null };
  const webpPath =
    typeof asset.webp_path === "string" && asset.webp_path.trim()
      ? asset.webp_path.trim()
      : null;
  const pngPath =
    typeof asset.png_path === "string" && asset.png_path.trim()
      ? asset.png_path.trim()
      : null;
  return { webpPath, pngPath };
}

export function buildStreakIconCandidatePaths(
  code: StreakIconCode | string | null | undefined,
  asset?: StreakIconAssetDbRowLike | null
): string[] {
  const normalized = normalizeIconCode(code ?? null);
  if (!normalized) return [];

  const fromDb = getPreferredDbAssetPaths(asset);
  const fromRoadmap = getStreakIconStorageCandidatePaths(normalized);

  const all = [fromDb.webpPath, fromDb.pngPath, ...fromRoadmap];
  const out: string[] = [];
  const seen = new Set<string>();

  for (const item of all) {
    if (!item) continue;
    const v = item.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }

  return out;
}

export function getStreakIconEmojiFallback(
  code: StreakIconCode | string | null | undefined,
  asset?: StreakIconAssetDbRowLike | null
): string {
  const normalized = normalizeIconCode(code ?? null);
  const fromDb =
    typeof asset?.emoji_fallback === "string" && asset.emoji_fallback.trim()
      ? asset.emoji_fallback.trim()
      : null;
  if (fromDb) return fromDb;

  const v = getIconVariant(normalized);
  return v?.emoji ?? "✨";
}

export function pickBestDbAssetForRoadmapCode<T extends StreakIconAssetDbRowLike>(
  rows: T[],
  roadmapCode: StreakIconCode
): T | null {
  const candidates = rows.filter((r) => getRoadmapCodeFromDbIconAsset(r) === roadmapCode);
  if (!candidates.length) return null;

  const scored = [...candidates].sort((a, b) => {
    const score = (row: T) => {
      let s = 0;
      if (row.code === roadmapCode) s += 120;
      if (row.is_default_for_tier) s += 80;
      if (row.webp_path) s += 40;
      if (row.png_path) s += 20;
      const sort = Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 9999;
      s += Math.max(0, 50 - Math.min(50, Math.max(0, sort)));
      return s;
    };
    return score(b) - score(a);
  });

  return scored[0] ?? null;
}