// lib/tour/tourConfig.ts

export type TourStage =
  | "portal_intro"       // 1. Центр портала (вступление)
  | "direction_gate"     // 2. Указание на карточку направления (ждем клика)
  | "profile_overview"   // 3. Обзор профиля + Указание на "Заявки" (ждем клика)
  | "requests_info"      // 4. В заявках: как создать (ждем возврата назад)
  | "materials_gate"     // 5. Вернулись в профиль: кнопка "Материалы" (ждем клика)
  | "rewards_gate"       // 6. Вернулись из материалов: кнопка "Награды" (ждем клика/открытия модалки)
  | "rewards_tour"       // 7. Сама модалка наград (4 шага подряд: гардероб -> стрики -> рефы -> промо)
  | "finished";          // 8. Конец

export type StageConfig = {
  id: TourStage;
  type: "advanceOnNext" | "advanceOnAction";
  nextStage?: TourStage; // Куда идти, если type === "advanceOnNext"
};

export const TOUR_STAGES: Record<TourStage, StageConfig> = {
  portal_intro: { id: "portal_intro", type: "advanceOnNext", nextStage: "direction_gate" },
  direction_gate: { id: "direction_gate", type: "advanceOnAction" },
  profile_overview: { id: "profile_overview", type: "advanceOnAction" },
  requests_info: { id: "requests_info", type: "advanceOnAction" },
  materials_gate: { id: "materials_gate", type: "advanceOnAction" },
  rewards_gate: { id: "rewards_gate", type: "advanceOnAction" },
  rewards_tour: { id: "rewards_tour", type: "advanceOnNext", nextStage: "finished" },
  finished: { id: "finished", type: "advanceOnAction" },
};

/** Тур запускается только на странице, где есть DOM-таргет текущей стадии. */
export function isTourStageActiveOnPath(stage: TourStage, pathname: string): boolean {
  switch (stage) {
    case "portal_intro":
    case "direction_gate":
      return pathname === "/portal";
    case "profile_overview":
    case "materials_gate":
      return /^\/projects\/[^/]+\/profile\/?$/.test(pathname);
    case "requests_info":
      return /^\/projects\/[^/]+\/requests\/?$/.test(pathname);
    case "rewards_gate":
      return /^\/projects\/[^/]+\/(profile|materials|requests)\/?$/.test(pathname);
    case "rewards_tour":
      return true;
    default:
      return false;
  }
}