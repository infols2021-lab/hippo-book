// components/tour/TourSteps.ts
import { Step } from "react-joyride";

// Расширяем стандартный тип шага, явно указывая свойства,
// на которые ругается TypeScript
export interface CustomTourStep extends Step {
  mascotImage?: string;
  skipBeacon?: boolean;
  blockTargetInteraction?: boolean;
  overlayClickAction?: false | "close" | "next" | "replay";
  hideNextButton?: boolean;
}

export const TOUR_STEPS: CustomTourStep[] = [
  {
    target: "body",
    placement: "center",
    title: "Обновление образовательной платформы",
    content: "Интерфейс системы был значительно переработан и дополнен новым функционалом. Данный краткий тур поможет ознакомиться с изменениями и быстрее сориентироваться в навигации.",
    mascotImage: "/images/tour/uki1.webp",
    skipBeacon: true,
  },
  {
    target: "#tour-materials",
    title: "Учебные материалы и прогресс",
    content: "В этом разделе собран основной образовательный контент: уроки, задания и экзамены. Здесь же отображается актуальная статистика прохождения и текущие результаты обучения.",
    mascotImage: "/images/tour/uki2.webp",
    skipBeacon: true,
  },
  {
    target: "#tour-requests",
    title: "Каталог заявок",
    content: "Раздел запросов теперь работает по принципу каталога. Через него осуществляется подача заявок на получение доступа к новым учебникам, пробным тестам и дополнительным материалам.",
    mascotImage: "/images/tour/uki3.webp",
    skipBeacon: true,
  },
  {
    target: "#tour-rewards-btn",
    title: "Новая система мотивации",
    content: "Полностью переработана система достижений. Для продолжения обзора и знакомства с новым функционалом необходимо кликнуть на подсвеченную кнопку «Центр наград».",
    mascotImage: "/images/tour/uki4.webp",
    blockTargetInteraction: false, // false = клики проходят сквозь спотлайт (было spotlightClicks: true)
    overlayClickAction: false, // клик по оверлею не закрывает шаг (было disableOverlayClose: true)
    hideNextButton: true, // кнопка "Далее" скрыта, так как ожидается клик по мишени
    skipBeacon: true,
  },
  {
    target: "#tour-wardrobe",
    title: "Кастомизация и Гардероб",
    content: "За успехи в обучении выдаются предметы инвентаря. В данной вкладке можно менять внешний вид маскота, использовать новые фоны, ауры и применять заработанные титулы.",
    mascotImage: "/images/tour/uki5.webp",
    skipBeacon: true,
  },
  {
    target: "#tour-streaks",
    title: "Ежедневная активность",
    content: "Регулярные занятия поощряются дополнительно. Непрерывное выполнение заданий формирует серию. Достижение определенных этапов серии открывает уникальные предметы. Важно: пропуск дня обнуляет текущий прогресс.",
    mascotImage: "/images/tour/uki6.webp",
    skipBeacon: true,
  },
  {
    target: "#tour-promos",
    title: "Промокоды и приглашения",
    content: "В этих вкладках доступна активация специальных кодов для получения бонусов. Также здесь сгенерирована персональная ссылка: приглашение новых пользователей позволяет расширить доступ к скрытым материалам платформы.",
    mascotImage: "/images/tour/uki7.webp",
    skipBeacon: true,
  },
  {
    target: "#tour-help-btn",
    title: "Завершение обзора",
    content: "Базовое обучение окончено. Если в будущем потребуется освежить информацию о работе платформы, достаточно нажать на иконку знака вопроса в верхнем меню для повторного запуска данной инструкции.",
    mascotImage: "/images/tour/uki8.webp",
    skipBeacon: true,
  },
];