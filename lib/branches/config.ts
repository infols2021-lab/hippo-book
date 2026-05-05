import type { BranchConfig, BranchType } from "@/lib/branches/types";

export const OLYMPIAD_BRANCH = "olympiad" satisfies BranchType;
export const GATEHOUSE_BRANCH = "gatehouse" satisfies BranchType;

export const BRANCH_TYPES = [OLYMPIAD_BRANCH, GATEHOUSE_BRANCH] as const;

export const BRANCH_CONFIGS: Record<BranchType, BranchConfig> = {
  olympiad: {
    type: "olympiad",
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
    type: "gatehouse",
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

export function isBranchType(value: unknown): value is BranchType {
  return typeof value === "string" && BRANCH_TYPES.includes(value as BranchType);
}

export function normalizeBranchType(value: unknown): BranchType {
  return isBranchType(value) ? value : OLYMPIAD_BRANCH;
}

export function getBranchConfig(value: unknown): BranchConfig {
  return BRANCH_CONFIGS[normalizeBranchType(value)];
}

export function getBranchLabel(value: unknown): string {
  return getBranchConfig(value).label;
}

export function getBranchAdminLabel(value: unknown): string {
  return getBranchConfig(value).adminLabel;
}

export function getBranchPortalCards() {
  return BRANCH_TYPES.map((branchType) => BRANCH_CONFIGS[branchType].portalCard);
}