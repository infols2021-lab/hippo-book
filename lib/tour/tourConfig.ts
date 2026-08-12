// lib/tour/tourConfig.ts

export type TourStage =
  | "portal_intro"           // 1. Портал: вступление (единоразово)
  | "direction_gate"         // 2. Портал: выбор направления (единоразово)
  | "profile_stats"          // 3. Профиль: статистика материалов
  | "profile_requests_gate"  // 4. Профиль: кнопка «Заявки»
  | "requests_info"          // 5. Заявки: как работает (кнопку создать нельзя жать)
  | "requests_return_gate"   // 6. Заявки: вернуться в профиль
  | "materials_gate"         // 7. Профиль: кнопка «Материалы»
  | "materials_overview"     // 8. Материалы: краткий обзор
  | "rewards_gate"           // 9. Профиль: кнопка «Награды»
  | "rewards_tour"           // 10. Модалка наград
  | "finished";

export type StageConfig = {
  id: TourStage;
  type: "advanceOnNext" | "advanceOnAction";
  nextStage?: TourStage;
};

export const TOUR_STAGES: Record<TourStage, StageConfig> = {
  portal_intro: { id: "portal_intro", type: "advanceOnNext", nextStage: "direction_gate" },
  direction_gate: { id: "direction_gate", type: "advanceOnAction" },
  profile_stats: { id: "profile_stats", type: "advanceOnNext", nextStage: "profile_requests_gate" },
  profile_requests_gate: { id: "profile_requests_gate", type: "advanceOnAction" },
  requests_info: { id: "requests_info", type: "advanceOnAction", nextStage: "requests_return_gate" },
  requests_return_gate: { id: "requests_return_gate", type: "advanceOnAction" },
  materials_gate: { id: "materials_gate", type: "advanceOnAction" },
  materials_overview: { id: "materials_overview", type: "advanceOnAction" },
  rewards_gate: { id: "rewards_gate", type: "advanceOnAction" },
  rewards_tour: { id: "rewards_tour", type: "advanceOnNext", nextStage: "finished" },
  finished: { id: "finished", type: "advanceOnAction" },
};

const LEGACY_STAGE_MAP: Record<string, TourStage> = {
  profile_overview: "profile_requests_gate",
};

export function normalizeTourStage(raw: string | null | undefined): TourStage | null {
  if (!raw) return null;
  if (raw in TOUR_STAGES) return raw as TourStage;
  return LEGACY_STAGE_MAP[raw] ?? null;
}

export function isPortalTourStage(stage: TourStage): boolean {
  return stage === "portal_intro" || stage === "direction_gate";
}

/** Тур запускается только на странице, где есть DOM-таргет текущей стадии. */
export function isTourStageActiveOnPath(stage: TourStage, pathname: string): boolean {
  switch (stage) {
    case "portal_intro":
    case "direction_gate":
      return pathname === "/portal";
    case "profile_stats":
    case "profile_requests_gate":
    case "materials_gate":
    case "rewards_gate":
      return /^\/projects\/[^/]+\/profile\/?$/.test(pathname);
    case "requests_info":
    case "requests_return_gate":
      return /^\/projects\/[^/]+\/requests\/?$/.test(pathname);
    case "materials_overview":
      return /^\/projects\/[^/]+\/materials\/?$/.test(pathname);
    case "rewards_tour":
      return /^\/projects\/[^/]+\/profile\/?$/.test(pathname);
    default:
      return false;
  }
}
