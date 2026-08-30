import type { TourStage } from "@/lib/tour/tourConfig";
import { pickMascotImage } from "@/lib/tour/mascotImages";
import {
  visibleDemoMaterialCard,
  visiblePortalDirections,
  visibleTourTarget,
} from "@/lib/tour/tourTargets";
import type { CustomTourStep } from "@/components/tour/TourSteps";
import { isMobileViewport, isMobileMenuGateStage } from "@/lib/tour/tourMobile";
import { getPortalProjectCount } from "@/lib/tour/tourPortal";

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
      title: "Прогресс и статистика",
      content:
        "Здесь видно, сколько материалов доступно, сколько пройдено и процент выполнения. Ниже — список материалов для изучения.",
      mascotImage: pickMascotImage("profile_stats"),
      skipBeacon: true,
      primaryLabel: "Далее",
      placement: "bottom",
    },
    {
      target: visibleTourTarget('[data-tour="project-header"]'),
      title: "Навигация",
      content:
        "Верхняя панель: Профиль, Материалы, Награды, Заявки. Огонёк показывает серию, а кнопка «!» запускает этот гайд заново.",
      mascotImage: pickMascotImage("profile_stats_nav"),
      skipBeacon: true,
      primaryLabel: "Далее",
      placement: "bottom",
    },
    {
      target: visibleTourTarget('[data-tour="project-switcher"]'),
      title: "Смена направления",
      content:
        "Нажмите на название текущего направления — откроется список всех направлений. Профиль и награды общие, а материалы и заявки у каждого свои.",
      mascotImage: pickMascotImage("profile_stats"),
      skipBeacon: true,
      primaryLabel: "Далее",
      placement: "bottom",
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
        "Откройте карточку с бейджем «Демо» — она подсвечена рамкой. Остальные материалы пока недоступны, начните обучение с демо.",
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
      target: visibleTourTarget('[data-tour="demo-assignments-list"]'),
      title: "Страница материала",
      content: "Здесь список заданий. На время демо доступно одно задание — с пометкой «Демо».",
      mascotImage: pickMascotImage("demo_material"),
      skipBeacon: true,
      primaryLabel: "Далее",
      placement: "bottom",
    },
    {
      target: visibleTourTarget('[data-tour="demo-assignment-link"]'),
      title: "Начните задание",
      content:
        "Нажмите на задание «Демо». Во время выполнения подсказки спрячутся — просто отвечайте и листайте до кнопки «Далее».",
      mascotImage: pickMascotImage("demo_material"),
      skipBeacon: true,
      hideNextButton: true,
      hideOverlay: true,
      blockTargetInteraction: false,
      placement: "top",
    },
  ],
  streak_celebration: [
    {
      target: "body",
      placement: "center",
      title: "Серия засчитана",
      content:
        "Задание выполнено — засчитан первый день серии! Выполняйте задания регулярно, и серия будет расти вместе с наградами.",
      mascotImage: pickMascotImage("streak_celebration"),
      skipBeacon: true,
      primaryLabel: "Далее",
    },
  ],
  assignment_return_gate: [
    {
      target: visibleTourTarget('[data-tour="assignment-back-btn"]'),
      title: "Вернитесь к материалу",
      content: "Нажмите «Назад к материалу», чтобы вернуться на страницу учебника.",
      mascotImage: pickMascotImage("assignment_return_gate"),
      skipBeacon: true,
      hideNextButton: true,
      blockTargetInteraction: false,
      placement: "bottom",
    },
  ],
  material_return_gate: [
    {
      target: visibleTourTarget('[data-tour="material-back-btn"]'),
      title: "К списку материалов",
      content: "Нажмите «Назад к материалам», чтобы вернуться в общий каталог.",
      mascotImage: pickMascotImage("material_return_gate"),
      skipBeacon: true,
      hideNextButton: true,
      blockTargetInteraction: false,
      placement: "bottom",
    },
  ],
  materials_profile_gate: [
    {
      target: visibleTourTarget('[data-tour="profile-link"]'),
      title: "В профиль",
      content: "Откройте профиль — там награды, серии и заявки на материалы.",
      mascotImage: pickMascotImage("materials_profile_gate"),
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
      content:
        "Меняйте внешний вид маскота: скины, ауры и титулы. Нажмите на любой предмет — он сразу наденется, а титул появится в профиле.",
      mascotImage: pickMascotImage("rewards_wardrobe"),
      skipBeacon: true,
    },
    {
      target: visibleTourTarget('[data-tour="streaks-tab"]'),
      title: "Серии",
      content:
        "Серия растёт за ежедневные занятия — сейчас у вас уже 1 день. Чем дольше серия, тем ценнее награды в этой вкладке.",
      mascotImage: pickMascotImage("rewards_streaks"),
      skipBeacon: true,
    },
    {
      target: visibleTourTarget('[data-tour="referral-tab"]'),
      title: "Реферальная программа",
      content:
        "Скопируйте личную ссылку и отправьте друзьям. За каждого приглашённого ученика вы получите бонусы: титулы, вещи для маскота и материалы.",
      mascotImage: pickMascotImage("rewards_referral"),
      skipBeacon: true,
    },
    {
      target: visibleTourTarget('[data-tour="promos-tab"]'),
      title: "Промокоды",
      content:
        "Если есть промокод — вставьте его в поле и нажмите «Активировать». Награды появятся в гардеробе. Пока просто посмотрите, как это работает.",
      mascotImage: pickMascotImage("rewards_promos"),
      skipBeacon: true,
    },
  ],
  profile_requests_gate: [
    {
      target: visibleTourTarget('[data-tour="requests-link"]'),
      title: "Заявки на покупку",
      content:
        "Здесь запрашивают доступ к новым материалам. Нажмите «Заявки» в панели сверху (или внизу на телефоне).",
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
        "Вы выбираете материалы, создаёте заявку и получаете QR для оплаты. После проверки администратором доступ открывается автоматически.",
      mascotImage: pickMascotImage("requests_info_text"),
      skipBeacon: true,
      primaryLabel: "Далее",
    },
    {
      target: visibleTourTarget('[data-tour="requests-project-switcher"]'),
      title: "Покупка для другого направления",
      content:
        "Здесь выбирают направление для покупки. Попробуйте нажать — это просто выбор, ничего покупать не нужно.",
      mascotImage: pickMascotImage("requests_info_projects"),
      skipBeacon: true,
      primaryLabel: "Далее",
      placement: "bottom",
      blockTargetInteraction: false,
    },
    {
      target: visibleTourTarget('[data-tour="create-request-btn"]'),
      title: "Создание заявки",
      content:
        "Новые заявки создаются здесь. Нажмите кнопку, чтобы посмотреть процесс — форму всегда можно закрыть.",
      mascotImage: pickMascotImage("requests_info_btn"),
      skipBeacon: true,
      hideNextButton: false,
      blockTargetInteraction: false,
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
        "Гайд пройден! Все разделы доступны в панели навигации. Кнопка «!» вверху (или «Гайд» внизу на телефоне) запускает подсказки заново.",
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
        target: visibleTourTarget('[data-tour="profile-avatar"]', '[data-tour="profile-title"]'),
        placement: "bottom",
        content:
          "Это ваш профиль: здесь титул, огонёк серии и контакты. Нажмите на титул или огонёк, чтобы открыть награды.",
      },
      {
        target: "body",
        placement: "center",
        title: "Навигация",
        content:
          "Внизу панель: Материалы, Награды, Заявки, Профиль. Вкладка «Гайд» запускает подсказки заново.",
        mascotImage: pickMascotImage("profile_stats_nav"),
        skipBeacon: true,
        primaryLabel: "Далее",
      },
      {
        target: visibleTourTarget('[data-tour="project-switcher"]'),
        placement: "top",
        title: "Смена направления",
        content:
          "Нажмите на название текущего направления — откроется список всех направлений. Профиль и награды общие, а материалы и заявки у каждого свои.",
        mascotImage: pickMascotImage("profile_stats"),
        skipBeacon: true,
        primaryLabel: "Понятно",
        skipScroll: true,
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
        target: visibleTourTarget('[data-tour="demo-assignments-list"]'),
        title: "Страница материала",
        content: "Здесь список заданий. На время демо доступно одно задание — с пометкой «Демо».",
        mascotImage: pickMascotImage("demo_material"),
        skipBeacon: true,
        primaryLabel: "Далее",
        placement: "bottom",
      },
      {
        target: visibleTourTarget('[data-tour="demo-assignment-link"]'),
        title: "Начните задание",
        content:
          "Нажмите на задание «Демо». Во время выполнения подсказки спрячутся — просто отвечайте и листайте до кнопки «Далее».",
        mascotImage: pickMascotImage("demo_material"),
        skipBeacon: true,
        hideNextButton: true,
        hideOverlay: true,
        blockTargetInteraction: false,
        placement: "top",
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

  if (stage === "assignment_return_gate" || stage === "material_return_gate") {
    return base.map((step) => ({
      ...step,
      placement: "bottom" as const,
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
        placement: "bottom",
        skipScroll: true,
        blockTargetInteraction: false,
        primaryLabel: "Далее",
      },
      {
        ...base[2],
        placement: "top",
        skipScroll: true,
        blockTargetInteraction: false,
        primaryLabel: "Понятно",
      },
    ];
  }

  // Мобильные «гейт»-шаги: таргеты уже есть в нижней панели (BottomNav)
  if (isMobileMenuGateStage(stage)) {
    return [{ ...base[0], placement: "top" as const, skipScroll: true }];
  }

  if (stage === "rewards_tour") {
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