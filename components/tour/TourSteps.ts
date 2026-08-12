// components/tour/TourSteps.ts
import { Step } from "react-joyride";
import { TourStage } from "@/lib/tour/tourConfig";
import { pickMascotImage } from "@/lib/tour/mascotImages";
import { visiblePortalCard, visibleTourTarget } from "@/lib/tour/tourTargets";

export interface CustomTourStep extends Step {
  mascotImage?: string;
  skipBeacon?: boolean;
  blockTargetInteraction?: boolean;
  overlayClickAction?: false | "close" | "next" | "replay";
  hideNextButton?: boolean;
  primaryLabel?: string;
}

export const TOUR_STEPS: Partial<Record<TourStage, CustomTourStep[]>> = {
  portal_intro: [
    {
      target: "body",
      placement: "center",
      title: "Добро пожаловать!",
      content:
        "На платформе несколько направлений обучения — у каждого свой контент, но профиль, награды и стрики общие для всех.",
      mascotImage: pickMascotImage("portal_intro"),
      skipBeacon: true,
    },
  ],
  direction_gate: [
    {
      target: visiblePortalCard,
      title: "Выберите направление",
      content: "Чтобы продолжить, выберите любую карточку направления и нажмите на неё.",
      mascotImage: pickMascotImage("direction_gate"),
      skipBeacon: true,
      hideNextButton: true,
      blockTargetInteraction: false,
    },
  ],
  profile_stats: [
    {
      target: visibleTourTarget('[data-tour="profile-stats"]'),
      title: "Статистика материалов",
      content:
        "Здесь видно, сколько материалов доступно, что уже пройдено, общий прогресс и количество решённых заданий по текущему направлению.",
      mascotImage: pickMascotImage("profile_stats"),
      skipBeacon: true,
    },
  ],
  profile_requests_gate: [
    {
      target: visibleTourTarget('[data-tour="requests-link"]'),
      title: "Заявки на покупку",
      content:
        "Нужен доступ к новым материалам? Через заявки можно запросить открытие нужных разделов. Нажмите «Заявки на покупку», чтобы посмотреть, как это работает.",
      mascotImage: pickMascotImage("profile_requests_gate"),
      skipBeacon: true,
      hideNextButton: true,
      blockTargetInteraction: false,
    },
  ],
  requests_info: [
    {
      target: "body",
      placement: "center",
      title: "Как проходит заявка",
      content:
        "Вы выбираете материалы, создаёте заявку и получаете QR для оплаты. После подтверждения администратором доступ открывается автоматически. Сейчас создавать заявку не нужно — просто запомните, где находится кнопка «+ Создать заявку».",
      mascotImage: pickMascotImage("requests_info_text"),
      skipBeacon: true,
    },
    {
      target: visibleTourTarget('[data-tour="create-request-btn"]'),
      title: "Кнопка создания",
      content: "Именно здесь в будущем вы будете создавать новые заявки. Сейчас на неё нажимать не нужно.",
      mascotImage: pickMascotImage("requests_info_btn"),
      skipBeacon: true,
      hideNextButton: false,
      blockTargetInteraction: true,
      primaryLabel: "Понятно",
    },
  ],
  requests_return_gate: [
    {
      target: visibleTourTarget('[data-tour="profile-link"]'),
      title: "Вернитесь в профиль",
      content: "Отлично! Теперь нажмите «Профиль», чтобы вернуться и узнать про раздел материалов.",
      mascotImage: pickMascotImage("requests_return_gate"),
      skipBeacon: true,
      hideNextButton: true,
      blockTargetInteraction: false,
    },
  ],
  materials_gate: [
    {
      target: visibleTourTarget('[data-tour="materials-link"]'),
      title: "Раздел «Материалы»",
      content:
        "Все учебники, задания и прогресс по текущему направлению хранятся в разделе «Материалы». Нажмите на кнопку, чтобы заглянуть туда.",
      mascotImage: pickMascotImage("materials_gate"),
      skipBeacon: true,
      hideNextButton: true,
      blockTargetInteraction: false,
    },
  ],
  materials_overview: [
    {
      target: "body",
      placement: "center",
      title: "Ваши материалы",
      content:
        "Здесь отображаются все материалы выбранного направления: учебники, задания и ваш прогресс по каждому разделу. Осмотритесь и, когда будете готовы, вернитесь в профиль.",
      mascotImage: pickMascotImage("materials_overview"),
      skipBeacon: true,
    },
    {
      target: visibleTourTarget('[data-tour="profile-link"]'),
      title: "Обратно в профиль",
      content: "Нажмите «Профиль», чтобы вернуться и узнать про награды.",
      mascotImage: pickMascotImage("materials_overview_return"),
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
        "Здесь ваш гардероб маскота, стрики, рефералка и промокоды. Нажмите «Награды», чтобы открыть центр наград.",
      mascotImage: pickMascotImage("rewards_gate"),
      skipBeacon: true,
      hideNextButton: true,
      blockTargetInteraction: false,
    },
  ],
  rewards_tour: [
    {
      target: visibleTourTarget('[data-tour="wardrobe-tab"]'),
      title: "Гардероб",
      content: "Меняйте внешний вид маскота: фоны, ауры, титулы и другие предметы из инвентаря.",
      mascotImage: pickMascotImage("rewards_wardrobe"),
      skipBeacon: true,
    },
    {
      target: visibleTourTarget('[data-tour="streaks-tab"]'),
      title: "Ваши стрики",
      content: "Занимайтесь регулярно — серия дней приносит уникальные награды.",
      mascotImage: pickMascotImage("rewards_streaks"),
      skipBeacon: true,
    },
    {
      target: visibleTourTarget('[data-tour="referral-tab"]'),
      title: "Реферальная система",
      content: "Приглашайте друзей по своей ссылке и получайте бонусы за каждого нового ученика.",
      mascotImage: pickMascotImage("rewards_referral"),
      skipBeacon: true,
    },
    {
      target: visibleTourTarget('[data-tour="promos-tab"]'),
      title: "Промокоды",
      content: "Активируйте секретные коды для подарков. На этом обучение по платформе завершено!",
      mascotImage: pickMascotImage("rewards_promos"),
      skipBeacon: true,
    },
  ],
};
