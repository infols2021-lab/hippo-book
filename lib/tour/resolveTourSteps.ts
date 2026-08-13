import type { TourStage } from "@/lib/tour/tourConfig";
import { pickMascotImage } from "@/lib/tour/mascotImages";
import { visiblePortalDirections, visibleTourTarget, visibleMobileMenuTarget } from "@/lib/tour/tourTargets";
import type { CustomTourStep } from "@/components/tour/TourSteps";
import { isMobileViewport, isMobileMenuGateStage } from "@/lib/tour/tourMobile";
import { getPortalProjectCount } from "@/lib/tour/tourPortal";

const burgerTarget = visibleTourTarget('[data-tour="mobile-burger-btn"]');

const MOBILE_MENU_ITEM_SELECTOR: Partial<Record<TourStage, string>> = {
  profile_requests_gate: '[data-tour="requests-link"]',
  materials_gate: '[data-tour="materials-link"]',
  rewards_gate: '[data-tour="rewards-btn"]',
  requests_return_gate: '[data-tour="profile-link"]',
};

function mobileMenuItemTarget(stage: TourStage) {
  const selector = MOBILE_MENU_ITEM_SELECTOR[stage];
  if (!selector) return visibleTourTarget('[data-tour="profile-link"]');
  return visibleMobileMenuTarget(selector);
}

function withMobileMenuTarget(step: CustomTourStep, stage: TourStage): CustomTourStep {
  return {
    ...step,
    target: mobileMenuItemTarget(stage),
    requiresMobileMenu: true,
    placement: "top",
  };
}

type BurgerIntroKey = TourStage | "materials_overview_return" | "requests_info_menu";

function mobileBurgerIntro(stage: BurgerIntroKey): CustomTourStep {
  const copy: Partial<Record<BurgerIntroKey, { title: string; content: string }>> = {
    requests_info_menu: {
      title: "Меню навигации",
      content:
        "Раздел «Материалы» — в меню ☰ справа вверху. Нажмите на кнопку меню, чтобы открыть его.",
    },
    profile_requests_gate: {
      title: "Меню профиля",
      content:
        "На телефоне «Заявки на покупку» — в меню ☰ справа вверху. Нажмите на кнопку меню, чтобы открыть его.",
    },
    materials_gate: {
      title: "Меню профиля",
      content:
        "Раздел «Материалы» на телефоне — в меню ☰. Нажмите на кнопку меню, чтобы открыть его.",
    },
    rewards_gate: {
      title: "Меню профиля",
      content:
        "Центр наград на телефоне — в меню ☰. Нажмите на кнопку меню, чтобы открыть его.",
    },
    requests_return_gate: {
      title: "Меню навигации",
      content:
        "Кнопка «Профиль» — в меню ☰. Нажмите на кнопку меню, чтобы открыть навигацию.",
    },
    materials_overview_return: {
      title: "Меню",
      content:
        "Чтобы вернуться в профиль, откройте меню ☰ в правом верхнем углу.",
    },
  };

  const text = copy[stage] ?? copy.materials_overview_return ?? {
    title: "Меню",
    content: "Нажмите ☰ в правом верхнем углу, чтобы открыть меню.",
  };

  return {
    target: burgerTarget,
    title: text.title,
    content: text.content,
    mascotImage: pickMascotImage(
      stage === "materials_overview_return"
        ? "materials_overview_return"
        : stage === "requests_info_menu"
        ? "requests_info_menu"
        : stage
    ),
    skipBeacon: true,
    hideNextButton: true,
    waitForBurgerClick: true,
    blockTargetInteraction: false,
    placement: "bottom",
  };
}

/** Базовые шаги (desktop + fallback). */
export const BASE_TOUR_STEPS: Partial<Record<TourStage, CustomTourStep[]>> = {
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
      target: visiblePortalDirections,
      title: "Выберите направление",
      content: "Чтобы продолжить, выберите любую карточку направления и нажмите на неё.",
      mascotImage: pickMascotImage("direction_gate"),
      skipBeacon: true,
      hideNextButton: true,
      hideOverlay: true,
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
    {
      target: visibleTourTarget('[data-tour="profile-avatar"]'),
      title: "Аватар маскота",
      content:
        "Это ваш персональный маскот. Нажмите на аватар, чтобы открыть гардероб и настроить внешний вид.",
      mascotImage: pickMascotImage("profile_avatar"),
      skipBeacon: true,
      placement: "right",
    },
    {
      target: visibleTourTarget('[data-tour="profile-title"]'),
      title: "Титул",
      content:
        "Титул — особый знак отличия. Его можно получить за стрики, рефералов или промокоды и сменить в гардеробе.",
      mascotImage: pickMascotImage("profile_title"),
      skipBeacon: true,
      placement: "right",
    },
    {
      target: visibleTourTarget('[data-tour="profile-details"]'),
      title: "Данные профиля",
      content:
        "Под аватаром — ваши контактные данные: телефон и регион. Их можно изменить через «Редактировать профиль».",
      mascotImage: pickMascotImage("profile_details"),
      skipBeacon: true,
      placement: "right",
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
      placement: "top",
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

export function resolveTourSteps(stage: TourStage, isMobile = isMobileViewport()): CustomTourStep[] {
  const base = BASE_TOUR_STEPS[stage];
  if (!base?.length) return [];

  if (!isMobile) return base;

  if (stage === "portal_intro") {
    return [
      {
        ...base[0],
        target: "body",
        placement: "center",
        skipScroll: true,
        portalTheme: true,
        portalMobileDock: true,
        content:
          "У вас один аккаунт на все направления: профиль, награды и стрики общие. Ниже выберите ветку, с которой начнёте.",
      },
    ];
  }

  if (stage === "direction_gate") {
    const swipeStep: CustomTourStep = {
      target: "body",
      placement: "center",
      title: "Список направлений",
      content:
        "Прокрутите список вниз, чтобы увидеть все направления. Нажмите на нужное — и перейдёте в профиль ветки.",
      mascotImage: pickMascotImage("direction_gate_swipe"),
      skipBeacon: true,
      skipScroll: true,
      portalTheme: true,
      portalMobileDock: true,
      primaryLabel: "Понятно",
      isPortalSwipeStep: true,
    };

    const cardStep: CustomTourStep = {
      ...base[0],
      target: visiblePortalDirections,
      placement: "top",
      skipScroll: true,
      portalTheme: true,
      portalMobileDock: true,
      hideOverlay: true,
      blockTargetInteraction: false,
      content: "Нажмите на любое направление в списке — откроется профиль этой ветки.",
    };

    return [swipeStep, cardStep];
  }

  if (stage === "profile_stats") {
    return [
      {
        ...base[0],
        title: "Ваш прогресс",
        content:
          "Вверху профиля — компактная статистика: общий прогресс, материалы, решённые и доступные задания по направлению.",
        placement: "bottom",
      },
      {
        ...base[1],
        target: visibleTourTarget('[data-tour="profile-avatar"]'),
        title: "Аватар",
        content:
          "Нажмите на аватар в шапке — откроется гардероб, где можно менять внешность маскота.",
        placement: "bottom",
      },
      {
        ...base[2],
        target: visibleTourTarget('[data-tour="profile-title"]'),
        title: "Титул",
        content:
          "Титул показывает ваши достижения. Получайте новые за стрики и приглашения друзей.",
        placement: "bottom",
      },
      {
        ...base[3],
        target: visibleTourTarget('[data-tour="profile-details"]'),
        title: "О профиле",
        content:
          "Здесь отображаются имя и контакты. Редактировать их можно через меню ☰.",
        placement: "bottom",
      },
    ];
  }

  if (stage === "requests_info") {
    return [
      {
        ...base[0],
        title: "Страница заявок",
        placement: "center",
        skipScroll: true,
        hideNextButton: false,
        content:
          "Здесь вы оформляете доступ к материалам: выбираете нужные разделы, получаете QR для оплаты, а после проверки администратором доступ открывается автоматически.",
      },
      {
        ...base[1],
        placement: "top",
        skipScroll: true,
        hideNextButton: false,
        blockTargetInteraction: true,
        primaryLabel: "Далее",
      },
      mobileBurgerIntro("requests_info_menu"),
      {
        target: visibleMobileMenuTarget('[data-tour="materials-link"]'),
        title: "Раздел «Материалы»",
        content:
          "Нажмите «Материалы», чтобы перейти к учебным разделам и посмотреть, как устроен каталог.",
        mascotImage: pickMascotImage("materials_gate"),
        skipBeacon: true,
        requiresMobileMenu: true,
        hideNextButton: true,
        blockTargetInteraction: false,
        placement: "top",
      },
    ];
  }

  if (isMobileMenuGateStage(stage) && base.length === 1) {
    return [mobileBurgerIntro(stage), withMobileMenuTarget(base[0], stage)];
  }

  if (stage === "materials_overview" && base.length > 1) {
    return [
      {
        ...base[0],
        placement: "center",
        skipScroll: true,
      },
      mobileBurgerIntro("materials_overview_return"),
      {
        ...base[1],
        target: visibleMobileMenuTarget('[data-tour="profile-link"]'),
        requiresMobileMenu: true,
        hideNextButton: true,
        blockTargetInteraction: false,
        content: "Нажмите «Профиль», чтобы вернуться и узнать про награды.",
        placement: "top",
      },
    ];
  }

  if (stage === "rewards_tour" && isMobile) {
    const rewardTabs = ["wardrobe", "streaks", "referral", "promos"] as const;
    return base.map((step, index) => ({
      ...step,
      target: "body",
      placement: "center" as const,
      skipScroll: true,
      skipBeacon: true,
      disableScrolling: true,
      targetWaitTimeout: 8000,
      rewardTab: rewardTabs[index] ?? "wardrobe",
    }));
  }

  return base;
}

/** Финальные шаги с учётом DOM (кол-во направлений на портале). */
export function getResolvedTourSteps(stage: TourStage, isMobile = isMobileViewport()): CustomTourStep[] {
  let steps = resolveTourSteps(stage, isMobile);
  if (stage === "direction_gate" && isMobile && getPortalProjectCount() <= 1) {
    steps = steps.filter((s) => !s.isPortalSwipeStep);
  }
  return steps;
}
