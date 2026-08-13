import type { TourStage } from "@/lib/tour/tourConfig";
import { pickMascotImage } from "@/lib/tour/mascotImages";
import {
  visibleDemoMaterialCard,
  visiblePortalDirections,
  visibleTourTarget,
  visibleMobileMenuTarget,
} from "@/lib/tour/tourTargets";
import type { CustomTourStep } from "@/components/tour/TourSteps";
import { isMobileViewport, isMobileMenuGateStage } from "@/lib/tour/tourMobile";
import { getPortalProjectCount } from "@/lib/tour/tourPortal";

const burgerTarget = visibleTourTarget('[data-tour="mobile-burger-btn"]');

const MOBILE_MENU_ITEM_SELECTOR: Partial<Record<TourStage, string>> = {
  profile_requests_gate: '[data-tour="requests-link"]',
  materials_gate: '[data-tour="materials-link"]',
  rewards_gate: '[data-tour="rewards-btn"]',
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

type BurgerIntroKey = TourStage;

function mobileBurgerIntro(stage: BurgerIntroKey): CustomTourStep {
  const copy: Partial<Record<BurgerIntroKey, { title: string; content: string }>> = {
    profile_requests_gate: {
      title: "Меню профиля",
      content: "Пункт «Заявки на покупку» находится в меню ☰. Нажмите на кнопку меню, чтобы открыть его.",
    },
    materials_gate: {
      title: "Меню профиля",
      content: "Раздел «Материалы» на телефоне находится в меню ☰. Нажмите на кнопку меню, чтобы открыть его.",
    },
    rewards_gate: {
      title: "Меню профиля",
      content: "Раздел «Награды» на телефоне находится в меню ☰. Нажмите на кнопку меню, чтобы открыть его.",
    },
  };

  const text = copy[stage] ?? {
    title: "Меню",
    content: "Нажмите ☰ в правом верхнем углу, чтобы открыть меню.",
  };

  return {
    target: burgerTarget,
    title: text.title,
    content: text.content,
    mascotImage: pickMascotImage(stage),
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
      title: "Добро пожаловать",
      content:
        "На платформе несколько направлений обучения. У каждого свой контент, а профиль и награды общие.",
      mascotImage: pickMascotImage("portal_intro"),
      skipBeacon: true,
      primaryLabel: "Далее",
    },
  ],
  direction_gate: [
    {
      target: visiblePortalDirections,
      title: "Выберите направление",
      content: "Нажмите на любую карточку направления, чтобы продолжить.",
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
      title: "Профиль",
      content:
        "Здесь отображаются прогресс и награды по направлению. Далее откроем материалы и пройдем короткое демо-задание.",
      mascotImage: pickMascotImage("profile_stats"),
      skipBeacon: true,
      primaryLabel: "Далее",
    },
  ],
  materials_gate: [
    {
      target: visibleTourTarget('[data-tour="materials-link"]'),
      title: "Раздел «Материалы»",
      content: "Здесь учебники, задания и прогресс по направлению. Нажмите «Материалы», чтобы открыть раздел.",
      mascotImage: pickMascotImage("materials_gate"),
      skipBeacon: true,
      hideNextButton: true,
      blockTargetInteraction: false,
    },
  ],
  materials_demo: [
    {
      target: visibleDemoMaterialCard,
      title: "Демо-задание",
      content:
        "Материал с пометкой «Демо» - учебное задание для знакомства с платформой. Откройте его, чтобы продолжить.",
      mascotImage: pickMascotImage("materials_demo"),
      skipBeacon: true,
      hideNextButton: true,
      hideOverlay: true,
      blockTargetInteraction: false,
      fallbackTarget: "body" as const,
      fallbackPlacement: "center" as const,
      fallbackTitle: "Демо-задание",
      fallbackContent:
        "Найдите материал с пометкой «Демо» в списке и откройте его. Это короткое задание для знакомства с платформой.",
    },
  ],
  demo_material: [
    {
      target: visibleTourTarget('[data-tour="demo-assignment-link"]'),
      title: "Начните задание",
      content:
        "Нажмите на задание и пройдите его до конца. На время выполнения подсказки гайда будут скрыты.",
      mascotImage: pickMascotImage("demo_material"),
      skipBeacon: true,
      hideNextButton: true,
      hideOverlay: true,
      blockTargetInteraction: false,
    },
  ],
  streak_celebration: [
    {
      target: "body",
      placement: "center",
      title: "Серия засчитана",
      content:
        "Задание выполнено. Засчитался первый день серии. Серия начисляется за регулярные занятия - выполняйте задания и получайте награды.",
      mascotImage: pickMascotImage("streak_celebration"),
      skipBeacon: true,
      primaryLabel: "Далее",
    },
  ],
  rewards_gate: [
    {
      target: visibleTourTarget('[data-tour="rewards-btn"]'),
      title: "Центр наград",
      content:
        "Здесь гардероб маскота, серии, реферальная программа и промокоды. Нажмите «Награды», чтобы открыть раздел.",
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
      content: "Здесь меняется внешний вид маскота: фоны, ауры, титулы и предметы из инвентаря.",
      mascotImage: pickMascotImage("rewards_wardrobe"),
      skipBeacon: true,
    },
    {
      target: visibleTourTarget('[data-tour="streaks-tab"]'),
      title: "Серии",
      content:
        "Первый день серии уже засчитан. Продолжайте занятия, чтобы получать награды за серию.",
      mascotImage: pickMascotImage("rewards_streaks"),
      skipBeacon: true,
    },
    {
      target: visibleTourTarget('[data-tour="referral-tab"]'),
      title: "Реферальная программа",
      content: "По персональной ссылке можно приглашать учеников и получать бонусы за каждого нового участника.",
      mascotImage: pickMascotImage("rewards_referral"),
      skipBeacon: true,
    },
    {
      target: visibleTourTarget('[data-tour="promos-tab"]'),
      title: "Промокоды",
      content: "Здесь активируются промокоды на подарки и бонусные предметы.",
      mascotImage: pickMascotImage("rewards_promos"),
      skipBeacon: true,
    },
  ],
  profile_requests_gate: [
    {
      target: visibleTourTarget('[data-tour="requests-link"]'),
      title: "Заявки на покупку",
      content:
        "Если нужен доступ к новым материалам, оформите заявку. Нажмите «Заявки на покупку», чтобы посмотреть, как это работает.",
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
      title: "Как работают заявки",
      content:
        "Вы выбираете материалы, создаете заявку и получаете QR для оплаты. После проверки администратором доступ открывается автоматически.",
      mascotImage: pickMascotImage("requests_info_text"),
      skipBeacon: true,
      primaryLabel: "Далее",
    },
    {
      target: visibleTourTarget('[data-tour="create-request-btn"]'),
      title: "Создание заявки",
      content: "Новые заявки создаются здесь. Сейчас нажимать не обязательно - достаточно запомнить расположение кнопки.",
      mascotImage: pickMascotImage("requests_info_btn"),
      skipBeacon: true,
      hideNextButton: false,
      blockTargetInteraction: true,
      primaryLabel: "Понятно",
      placement: "top",
    },
  ],
  tour_complete: [
    {
      target: "body",
      placement: "center",
      title: "Обучение завершено",
      content:
        "Краткий гайд по платформе пройден. Все разделы доступны в меню навигации. Повторить подсказки можно через пункт «Помощь по платформе».",
      mascotImage: pickMascotImage("tour_complete"),
      skipBeacon: true,
      primaryLabel: "Готово",
    },
  ],
};

function withDemoMaterialFallback(steps: CustomTourStep[]): CustomTourStep[] {
  return steps.map((step) => {
    if (!step.fallbackTarget) return step;
    const demoCard = visibleDemoMaterialCard();
    if (demoCard) return step;

    const { fallbackTarget, fallbackPlacement, fallbackTitle, fallbackContent, ...rest } = step;
    return {
      ...rest,
      target: fallbackTarget,
      placement: fallbackPlacement ?? "center",
      title: fallbackTitle ?? step.title,
      content: fallbackContent ?? step.content,
      hideOverlay: true,
    };
  });
}

export function resolveTourSteps(stage: TourStage, isMobile = isMobileViewport()): CustomTourStep[] {
  const base = BASE_TOUR_STEPS[stage];
  if (!base?.length) return [];

  if (!isMobile) {
    if (stage === "materials_demo") return withDemoMaterialFallback(base);
    return base;
  }

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
          "На платформе несколько направлений. Профиль и награды общие. Ниже выберите ветку, с которой начнете.",
        primaryLabel: "Далее",
      },
    ];
  }

  if (stage === "direction_gate") {
    const swipeStep: CustomTourStep = {
      target: "body",
      placement: "center",
      title: "Список направлений",
      content: "Прокрутите список и нажмите на нужное направление, чтобы открыть профиль ветки.",
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
      content: "Нажмите на любое направление в списке.",
    };

    return [swipeStep, cardStep];
  }

  if (stage === "profile_stats") {
    return [
      {
        ...base[0],
        placement: "bottom",
        content:
          "Здесь прогресс и награды по направлению. Далее откроем материалы и пройдем короткое демо-задание.",
        primaryLabel: "Далее",
      },
    ];
  }

  if (stage === "materials_demo") {
    return withDemoMaterialFallback([
      {
        ...base[0],
        placement: "top",
        skipScroll: true,
        hideOverlay: true,
      },
    ]);
  }

  if (stage === "demo_material") {
    return [
      {
        ...base[0],
        placement: "top",
        skipScroll: true,
        hideOverlay: true,
      },
    ];
  }

  if (stage === "streak_celebration" || stage === "tour_complete") {
    return base.map((step) => ({
      ...step,
      placement: "center" as const,
      skipScroll: true,
    }));
  }

  if (stage === "requests_info") {
    return [
      {
        ...base[0],
        placement: "center",
        skipScroll: true,
        primaryLabel: "Далее",
      },
      {
        ...base[1],
        placement: "top",
        skipScroll: true,
        blockTargetInteraction: true,
        primaryLabel: "Понятно",
      },
    ];
  }

  if (isMobileMenuGateStage(stage) && base.length === 1) {
    return [mobileBurgerIntro(stage), withMobileMenuTarget(base[0], stage)];
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
