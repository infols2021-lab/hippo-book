// components/tour/TourSteps.ts
import { Step } from "react-joyride";
import { TourStage } from "@/lib/tour/tourConfig";

export interface CustomTourStep extends Step {
  // Настоящие поле — путь к картинке маскота в тултипе (наше расширение, не часть react-joyride)
  mascotImage?: string;
  // Ниже поля уже являются штатными Options react-joyride v3 (можно задавать прямо на шаге —
  // см. https://react-joyride.com/docs/step#per-step-options). Продублированы тут только чтобы
  // TypeScript явно видел их в автодополнении для CustomTourStep.
  skipBeacon?: boolean;
  blockTargetInteraction?: boolean; // true = блокирует клики по подсвеченному элементу. Default: false (клики проходят)
  overlayClickAction?: false | "close" | "next" | "replay";
  // hideNextButton — НАШЕ кастомное поле, используется только в CustomTooltip.tsx,
  // react-joyride о нём не знает.
  hideNextButton?: boolean;
}

// Группируем шаги строго по стадиям из конфига
export const TOUR_STEPS: Partial<Record<TourStage, CustomTourStep[]>> = {
  portal_intro: [
    {
      target: "body",
      placement: "center",
      title: "Добро пожаловать!",
      content: "Теперь на платформе есть новые направления обучения, и в будущем их станет больше! Важно: ваши данные профиля, награды и стрики остаются едиными для всех направлений, чтобы вы не путались в материалах.",
      mascotImage: "/images/tour/dog1.webp",
      skipBeacon: true,
    }
  ],
  direction_gate: [
    {
      // ВАЖНО: класс .portal-card должен реально висеть на карточке в PortalCard.tsx,
      // иначе Joyride не находит таргет (TARGET_NOT_FOUND) и рисует оверлей без "дырки" —
      // экран блюрится, кликнуть невозможно. См. фикс в PortalCard.tsx.
      target: ".portal-card",
      title: "Выбор направления",
      content: "Для продолжения обучения выберите любое направление. Нажмите на карточку, чтобы войти внутрь.",
      mascotImage: "/images/tour/dog2.webp",
      skipBeacon: true,
      hideNextButton: true, // Прячем "Далее", заставляем кликнуть по самой карточке
      blockTargetInteraction: false, // клик по карточке должен доходить до нее — не блокируем
    }
  ],
  profile_overview: [
    {
      target: "#tour-requests-link", // Повесь этот ID на ссылку "Заявки" в ProfileClient
      title: "Профиль и Заявки",
      content: "Это ваш единый профиль. Здесь отображается ваша статистика и прогресс. А через меню «Заявки» можно получать доступ к новым материалам. Нажмите на «Заявки», чтобы посмотреть.",
      mascotImage: "/images/tour/dog3.webp",
      skipBeacon: true,
      hideNextButton: true,
      blockTargetInteraction: false,
    }
  ],
  requests_info: [
    {
      target: "#tour-create-request-btn", // ID на кнопку "+ Создать заявку" в RequestsClient
      title: "Как создаются заявки",
      content: "Здесь вы можете запрашивать доступ к нужным материалам. Сейчас создавать заявку необязательно! Просто ознакомьтесь с разделом и вернитесь назад в профиль.",
      mascotImage: "/images/tour/dog4.webp",
      skipBeacon: true,
      hideNextButton: true,
      blockTargetInteraction: false,
    }
  ],
  materials_gate: [
    {
      target: "#tour-materials-link", // ID на кнопку/ссылку "Материалы" в ProfileClient
      title: "Ваши материалы",
      content: "В этом разделе хранятся все ваши уроки и задания по текущему направлению. Нажмите на кнопку «Материалы», чтобы зайти туда.",
      mascotImage: "/images/tour/dog5.webp",
      skipBeacon: true,
      hideNextButton: true,
      blockTargetInteraction: false,
    }
  ],
  rewards_gate: [
    {
      target: "#tour-rewards-btn", // ID кнопки наград в AppHeader
      title: "Центр наград",
      content: "Самое интересное! Здесь хранится ваш инвентарь и бонусы. Нажмите на кнопку наград, чтобы открыть меню.",
      mascotImage: "/images/tour/dog6.webp",
      skipBeacon: true,
      hideNextButton: true,
      blockTargetInteraction: false,
    }
  ],
  rewards_tour: [
    {
      target: "#tour-wardrobe",
      title: "Гардероб",
      content: "Здесь вы можете менять внешний вид маскота, использовать новые фоны, ауры и примерять заработанные титулы.",
      mascotImage: "/images/tour/dog7.webp",
      skipBeacon: true,
    },
    {
      target: "#tour-streaks",
      title: "Ваши стрики",
      content: "Занимайтесь регулярно! Непрерывное выполнение заданий формирует серию, за которую выдаются уникальные предметы.",
      mascotImage: "/images/tour/dog8.webp",
      skipBeacon: true,
    },
    {
      target: "#tour-referral", // Не забудь добавить этот ID на вкладку рефералки в модалке!
      title: "Реферальная система",
      content: "Приглашайте друзей по вашей уникальной ссылке и получайте бонусы за каждого нового пользователя платформы.",
      mascotImage: "/images/tour/dog9.webp",
      skipBeacon: true,
    },
    {
      target: "#tour-promos",
      title: "Промокоды",
      content: "Активируйте секретные коды для получения подарков. На этом наш тур окончен! Желаем успехов в обучении!",
      mascotImage: "/images/tour/dog10.webp",
      skipBeacon: true,
    }
  ]
};