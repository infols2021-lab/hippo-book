// lib/branches/config.ts
// ⚠️ ВАЖНО: этот файл содержит только seed-конфиги для двух legacy-веток (olympiad, gatehouse).
// Для динамических веток используйте lib/projects/loader.ts и lib/projects/types.ts.
// Этот файл НЕ ДОЛЖЕН содержать runtime-фолбэков для неизвестных веток.

import type { BranchConfig, BranchType } from "@/lib/branches/types";

// ----------------------------------------------------------------------------
// Константы legacy-веток
// ----------------------------------------------------------------------------

export const OLYMPIAD_BRANCH = "olympiad" as BranchType;
export const GATEHOUSE_BRANCH = "gatehouse" as BranchType;

export const BRANCH_TYPES = [OLYMPIAD_BRANCH, GATEHOUSE_BRANCH] as const;

// ----------------------------------------------------------------------------
// Seed-конфиги для legacy-веток
// ----------------------------------------------------------------------------

export const BRANCH_CONFIGS: Record<string, BranchConfig> = {
  olympiad: {
    type: "olympiad" as BranchType,
    label: "Олимпиада",
    shortLabel: "Олимпиада",
    adminLabel: "Олимпиада",
    description: "Учебники, кроссворды и задания олимпиады.",
    hasOlympiadStreaks: true,
    theme: {
      tone: "warm",
      rootClassName: "branch-olympiad",
      cssFile: undefined,
      fontFamily: "inherit",
      colors: {
        pageBg: "#fff8ed",
        cardBg: "#ffffff",
        cardBgSoft: "#fff3da",
        primary: "#f59e0b",
        primarySoft: "#fef3c7",
        secondary: "#fb7185",
        accent: "#8b5cf6",
        accentSoft: "#ede9fe",
        text: "#241407",
        muted: "#7c5f3e",
        border: "rgba(146, 64, 14, 0.16)",
        glow: "rgba(245, 158, 11, 0.35)",
      },
    },
    routes: {
      portal: "/portal",
      profile: "/profile",
      materials: "/materials",
      requests: "/requests",
      assignment: (id: string) => `/assignment/${id}`,
      material: (id: string) => `/textbook/${id}`,
    },
    portalCard: {
      title: "Олимпиада",
      subtitle: "Текущая платформа",
      description: "Учебники, кроссворды, задания, прогресс и стрики.",
      badge: "Olympiad",
      href: "/profile",
      image: null,
      fallbackIcon: "🏆",
    },
    materialTabs: [
      {
        key: "textbooks",
        label: "Учебники",
        icon: "📚",
        materialKind: "textbook",
      },
      {
        key: "crosswords",
        label: "Кроссворды",
        icon: "🧩",
        materialKind: "crossword",
      },
    ],
    requests: {
      targetMode: "class_level",
      materialKinds: ["textbook", "crossword"],
      defaultMaterialKinds: [],
    },
  },

  gatehouse: {
    type: "gatehouse" as BranchType,
    label: "Экзамены Gatehouse Awards",
    shortLabel: "Экзамены",
    adminLabel: "Gatehouse Awards",
    description: "Пробные тесты, уровни и рекомендации по экзаменам Gatehouse Awards.",
    hasOlympiadStreaks: false,
    theme: {
      tone: "dark-indigo",
      rootClassName: "branch-gatehouse",
      cssFile: "/gatehouse/gatehouse.css",
      fontFamily:
        "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      colors: {
        pageBg: "#070816",
        cardBg: "#101327",
        cardBgSoft: "#171b36",
        primary: "#6366f1",
        primarySoft: "rgba(99, 102, 241, 0.18)",
        secondary: "#22d3ee",
        accent: "#c084fc",
        accentSoft: "rgba(192, 132, 252, 0.18)",
        text: "#f8fafc",
        muted: "#a5b4fc",
        border: "rgba(165, 180, 252, 0.22)",
        glow: "rgba(99, 102, 241, 0.42)",
      },
    },
    routes: {
      portal: "/portal",
      profile: "/gatehouse/profile",
      materials: "/gatehouse/materials",
      requests: "/gatehouse/requests",
      assignment: (id: string) => `/gatehouse/assignment/${id}`,
      material: (id: string) => `/gatehouse/material/${id}`,
    },
    portalCard: {
      title: "Gatehouse Awards",
      subtitle: "Экзамены",
      description: "Пробные тесты, уровни Stage / CEFR и персональная рекомендация.",
      badge: "Exams",
      href: "/gatehouse/profile",
      image: null,
      fallbackIcon: "🎓",
    },
    materialTabs: [
      {
        key: "mock_tests",
        label: "Пробные тесты",
        icon: "📝",
        materialKind: "mock_test",
      },
      {
        key: "coming_soon",
        label: "В разработке",
        icon: "✨",
        materialKind: null,
        isPlaceholder: true,
      },
    ],
    requests: {
      targetMode: "target_levels",
      materialKinds: ["mock_test"],
      defaultMaterialKinds: ["mock_test"],
    },
  },
};

// ----------------------------------------------------------------------------
// Вспомогательные функции (только для legacy-веток)
// ----------------------------------------------------------------------------

/**
 * Проверяет, является ли строка валидным BranchType.
 * Для динамических веток возвращает false.
 */
export function isBranchType(value: unknown): value is BranchType {
  if (typeof value !== "string") return false;
  const v = value.trim();
  return v === OLYMPIAD_BRANCH || v === GATEHOUSE_BRANCH;
}

/**
 * Нормализует branch_type.
 * Возвращает "olympiad" или "gatehouse" для известных алиасов.
 * Для всех остальных — возвращает переданную строку как есть (динамическая ветка).
 * ВАЖНО: если передан неизвестный slug, возвращается он же, а не "olympiad".
 * Это позволяет отличать динамические ветки от legacy.
 */
export function normalizeBranchType(value: unknown): string {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return OLYMPIAD_BRANCH;

  // Алиасы для gatehouse
  if (
    v === "gatehouse" ||
    v === "gatehouse_awards" ||
    v === "ga" ||
    v === "ga_exam" ||
    v === "exam" ||
    v === "exams"
  ) {
    return GATEHOUSE_BRANCH;
  }

  // Для olympiad — только точное совпадение
  if (v === "olympiad") return OLYMPIAD_BRANCH;

  // Неизвестный slug — возвращаем как есть (динамическая ветка)
  return v;
}

/**
 * Возвращает конфиг для legacy-ветки.
 * Для динамических веток возвращает null — используйте getProjectBySlug() из loader.
 */
export function getBranchConfig(value: unknown): BranchConfig | null {
  const branch = normalizeBranchType(value);
  const config = BRANCH_CONFIGS[branch];
  if (config) return config;
  // Для динамических веток возвращаем null (runtime fallback убран)
  return null;
}

/**
 * Возвращает label для ветки.
 * Для динамических веток возвращает сам slug (или пустую строку).
 */
export function getBranchLabel(value: unknown): string {
  const branch = normalizeBranchType(value);
  const config = getBranchConfig(branch);
  if (config) return config.label;
  // Динамическая ветка — возвращаем slug
  return branch.charAt(0).toUpperCase() + branch.slice(1);
}

/**
 * Возвращает adminLabel для ветки.
 * Для динамических веток возвращает slug.
 */
export function getBranchAdminLabel(value: unknown): string {
  const branch = normalizeBranchType(value);
  const config = getBranchConfig(branch);
  if (config) return config.adminLabel;
  return branch;
}

/**
 * Возвращает PortalCard-конфиги для legacy-веток.
 * (Только для olympiad и gatehouse, динамические ветки здесь не учитываются.)
 */
export function getBranchPortalCards() {
  return BRANCH_TYPES.map((branchType) => BRANCH_CONFIGS[branchType].portalCard);
}