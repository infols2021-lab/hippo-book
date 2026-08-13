// lib/tour/tourConfig.ts

export type TourStage =
  | "portal_intro"           // 1. Портал: вступление
  | "direction_gate"         // 2. Портал: выбор направления
  | "profile_stats"          // 3. Профиль: краткое введение
  | "materials_gate"         // 4. Профиль: переход в материалы
  | "materials_demo"         // 5. Материалы: демо-материал
  | "demo_material"          // 6. Карточка материала: демо-задание
  | "demo_assignment"        // 7. Выполнение задания (гайд на паузе)
  | "streak_celebration"     // 8. Засчитана серия
  | "assignment_return_gate" // 9. Задание: назад к материалу
  | "material_return_gate"   // 10. Материал: назад к списку
  | "materials_profile_gate" // 11. Материалы: переход в профиль
  | "rewards_gate"           // 12. Профиль: кнопка «Награды»
  | "rewards_tour"           // 13. Модалка наград
  | "profile_requests_gate"  // 14. Профиль: заявки
  | "requests_info"          // 15. Заявки: как работает
  | "tour_complete"          // 16. Финал
  | "finished";

export type StageConfig = {
  id: TourStage;
  type: "advanceOnNext" | "advanceOnAction";
  nextStage?: TourStage;
};

export const TOUR_STAGES: Record<TourStage, StageConfig> = {
  portal_intro: { id: "portal_intro", type: "advanceOnNext", nextStage: "direction_gate" },
  direction_gate: { id: "direction_gate", type: "advanceOnAction" },
  profile_stats: { id: "profile_stats", type: "advanceOnNext", nextStage: "materials_gate" },
  materials_gate: { id: "materials_gate", type: "advanceOnAction" },
  materials_demo: { id: "materials_demo", type: "advanceOnAction" },
  demo_material: { id: "demo_material", type: "advanceOnAction" },
  demo_assignment: { id: "demo_assignment", type: "advanceOnAction" },
  streak_celebration: { id: "streak_celebration", type: "advanceOnNext", nextStage: "assignment_return_gate" },
  assignment_return_gate: { id: "assignment_return_gate", type: "advanceOnAction" },
  material_return_gate: { id: "material_return_gate", type: "advanceOnAction" },
  materials_profile_gate: { id: "materials_profile_gate", type: "advanceOnAction" },
  rewards_gate: { id: "rewards_gate", type: "advanceOnAction" },
  rewards_tour: { id: "rewards_tour", type: "advanceOnNext", nextStage: "profile_requests_gate" },
  profile_requests_gate: { id: "profile_requests_gate", type: "advanceOnAction" },
  requests_info: { id: "requests_info", type: "advanceOnNext", nextStage: "tour_complete" },
  tour_complete: { id: "tour_complete", type: "advanceOnNext", nextStage: "finished" },
  finished: { id: "finished", type: "advanceOnAction" },
};

const LEGACY_STAGE_MAP: Record<string, TourStage> = {
  profile_overview: "profile_requests_gate",
  materials_overview: "materials_demo",
  requests_return_gate: "profile_requests_gate",
};

export function normalizeTourStage(raw: string | null | undefined): TourStage | null {
  if (!raw) return null;
  if (raw in TOUR_STAGES) return raw as TourStage;
  return LEGACY_STAGE_MAP[raw] ?? null;
}

export function isPortalTourStage(stage: TourStage): boolean {
  return stage === "portal_intro" || stage === "direction_gate";
}

const PROFILE_PATH = /^\/projects\/[^/]+\/profile\/?$/;
const MATERIALS_PATH = /^\/projects\/[^/]+\/materials\/?$/;
const MATERIAL_DETAIL_PATH = /^\/projects\/[^/]+\/materials\/[^/]+\/?$/;
const ASSIGNMENT_PATH = /^\/projects\/[^/]+\/assignment\/?$/;
const REQUESTS_PATH = /^\/projects\/[^/]+\/requests\/?$/;

/** Тур запускается только на странице, где есть DOM-таргет текущей стадии. */
export function isTourStageActiveOnPath(stage: TourStage, pathname: string): boolean {
  switch (stage) {
    case "portal_intro":
    case "direction_gate":
      return pathname === "/portal";
    case "profile_stats":
    case "materials_gate":
    case "rewards_gate":
    case "profile_requests_gate":
      return PROFILE_PATH.test(pathname);
    case "materials_demo":
      return MATERIALS_PATH.test(pathname);
    case "demo_material":
      return MATERIAL_DETAIL_PATH.test(pathname);
    case "demo_assignment":
    case "streak_celebration":
    case "assignment_return_gate":
      return ASSIGNMENT_PATH.test(pathname);
    case "material_return_gate":
      return MATERIAL_DETAIL_PATH.test(pathname);
    case "materials_profile_gate":
      return MATERIALS_PATH.test(pathname);
    case "requests_info":
      return REQUESTS_PATH.test(pathname);
    case "tour_complete":
      return PROFILE_PATH.test(pathname) || REQUESTS_PATH.test(pathname);
    case "rewards_tour":
      return PROFILE_PATH.test(pathname);
    default:
      return false;
  }
}

export function isTourPausedStage(stage: TourStage): boolean {
  return stage === "demo_assignment";
}
