// components/tour/TourSteps.ts
import { Step } from "react-joyride";
import { TourStage } from "@/lib/tour/tourConfig";
import { visiblePortalCard, visibleTourTarget } from "@/lib/tour/tourTargets";

export interface CustomTourStep extends Step {
  mascotImage?: string;
  skipBeacon?: boolean;
  blockTargetInteraction?: boolean;
  overlayClickAction?: false | "close" | "next" | "replay";
  hideNextButton?: boolean;
}

export const TOUR_STEPS: Partial<Record<TourStage, CustomTourStep[]>> = {
  portal_intro: [
    {
      target: "body",
      placement: "center",
      title: "Добро пожаловать!",
      content:
        "Теперь на платформе есть новые направления обучения, и в будущем их станет больше! Важно: ваши данные профиля, награды и стрики остаются едиными для всех направлений, чтобы вы не путались в материалах.",
      mascotImage: "/images/tour/dog1.webp",
      skipBeacon: true,
    },
  ],
  direction_gate: [
    {
      target: visiblePortalCard,
      title: "Выбор направления",
      content:
        "Для продолжения обучения выберите любое направление. Нажмите на карточку, чтобы войти внутрь.",
      mascotImage: "/images/tour/dog2.webp",
      skipBeacon: true,
      hideNextButton: true,
      blockTargetInteraction: false,
    },
  ],
  profile_overview: [
    {
      target: visibleTourTarget('[data-tour="requests-link"]'),
      title: "Профиль и Заявки",
      content:
        "Это ваш единый профиль. Здесь отображается ваша статистика и прогресс. А через меню «Заявки» можно получать доступ к новым материалам. Нажмите на «Заявки», чтобы посмотреть.",
      mascotImage: "/images/tour/dog3.webp",
      skipBeacon: true,
      hideNextButton: true,
      blockTargetInteraction: false,
    },
  ],
  requests_info: [
    {
      target: visibleTourTarget('[data-tour="create-request-btn"]'),
      title: "Как создаются заявки",
      content:
        "Здесь вы можете запрашивать доступ к нужным материалам. Сейчас создавать заявку необязательно! Просто ознакомьтесь с разделом и вернитесь назад в профиль.",
      mascotImage: "/images/tour/dog4.webp",
      skipBeacon: true,
      hideNextButton: true,
      blockTargetInteraction: false,
    },
  ],
  materials_gate: [
    {
      target: visibleTourTarget('[data-tour="materials-link"]'),
      title: "Ваши материалы",
      content:
        "В этом разделе хранятся все ваши уроки и задания по текущему направлению. Нажмите на кнопку «Материалы», чтобы зайти туда.",
      mascotImage: "/images/tour/dog5.webp",
      skipBeacon: true,
      hideNextButton: true,
      blockTargetInteraction: false,
    },
  ],
  rewards_gate: [
    {
      target: visibleTourTarget('[data-tour="rewards-btn"]'),
      title: "Центр наград",
      content:
        "Самое интересное! Здесь хранится ваш инвентарь и бонусы. Нажмите на кнопку наград, чтобы открыть меню.",
      mascotImage: "/images/tour/dog6.webp",
      skipBeacon: true,
      hideNextButton: true,
      blockTargetInteraction: false,
    },
  ],
  rewards_tour: [
    {
      target: visibleTourTarget('[data-tour="wardrobe-tab"]'),
      title: "Гардероб",
      content:
        "Здесь вы можете менять внешний вид маскота, использовать новые фоны, ауры и примерять заработанные титулы.",
      mascotImage: "/images/tour/dog7.webp",
      skipBeacon: true,
    },
    {
      target: visibleTourTarget('[data-tour="streaks-tab"]'),
      title: "Ваши стрики",
      content:
        "Занимайтесь регулярно! Непрерывное выполнение заданий формирует серию, за которую выдаются уникальные предметы.",
      mascotImage: "/images/tour/dog8.webp",
      skipBeacon: true,
    },
    {
      target: visibleTourTarget('[data-tour="referral-tab"]'),
      title: "Реферальная система",
      content:
        "Приглашайте друзей по вашей уникальной ссылке и получайте бонусы за каждого нового пользователя платформы.",
      mascotImage: "/images/tour/dog9.webp",
      skipBeacon: true,
    },
    {
      target: visibleTourTarget('[data-tour="promos-tab"]'),
      title: "Промокоды",
      content:
        "Активируйте секретные коды для получения подарков. На этом наш тур окончен! Желаем успехов в обучении!",
      mascotImage: "/images/tour/dog10.webp",
      skipBeacon: true,
    },
  ],
};
