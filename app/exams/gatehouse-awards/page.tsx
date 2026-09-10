import type { Metadata } from "next";
import Link from "next/link";
import FaqAccordion, { type FaqItem } from "@/components/FaqAccordion";
import "@/app/landing.css";

export const metadata: Metadata = {
  title: "Подготовка к международным экзаменам Gatehouse Awards (IESOL) | skilLS",
  description:
    "Интерактивный тренажёр для подготовки к экзаменам по английскому языку Gatehouse Awards (ESOL Cadets и Classic). Разбор типов заданий, автоматическая проверка и аналитика прогресса.",
  keywords: [
    "gatehouse awards подготовка к экзаменам",
    "gatehouse awards",
    "iesol",
    "esol classic",
    "esol cadets",
    "подготовка к экзамену по английскому",
    "платформа скиллс",
    "интерактивные задания по английскому",
  ],
  alternates: { canonical: "/exams/gatehouse-awards" },
  openGraph: {
    type: "website",
    url: "https://hipposha-book.ru/exams/gatehouse-awards",
    siteName: "skilLS",
    title: "Подготовка к международным экзаменам Gatehouse Awards (IESOL) | skilLS",
    description:
      "ESOL Cadets и Classic, проверяемые навыки и интерактивная подготовка к экзаменам Gatehouse Awards на платформе skilLS.",
    locale: "ru_RU",
  },
};

type Level = { icon: string; name: string; tag: string; text: string };

const LEVELS: Level[] = [
  {
    icon: "🧒",
    name: "ESOL Cadets",
    tag: "Young Learners",
    text: "Программа для детей и младших школьников. Задания адаптированы под возраст и помогают мягко подготовиться к международному формату экзамена.",
  },
  {
    icon: "🎓",
    name: "ESOL Classic",
    tag: "General English",
    text: "Стандартный экзамен по английскому языку для широкой аудитории. Тренирует все ключевые навыки в формате, приближенном к реальному экзамену.",
  },
];

const SKILLS = [
  { icon: "🎧", title: "Listening", text: "Аудирование: понимание речи на слух, задания на общий смысл и детали." },
  { icon: "📖", title: "Reading", text: "Чтение: работа с текстами и понимание прочитанного." },
  { icon: "🧩", title: "Use of English", text: "Лексика и грамматика: употребление языка в контексте." },
  { icon: "✍️", title: "Writing", text: "Письмо: письменные задания по критериям экзамена." },
  { icon: "🗣️", title: "Speaking", text: "Говорение: устная часть и уверенное общение на английском." },
];

const BENEFITS = [
  {
    icon: "🖥️",
    title: "Реалистичный интерфейс тестирования",
    text: "Задания выглядят так же, как на экзамене, — вы привыкаете к формату заранее.",
  },
  {
    icon: "⚡",
    title: "Моментальная аналитика ошибок",
    text: "Сразу видите, где ошиблись, и разбираете сложные места.",
  },
  {
    icon: "📊",
    title: "Статистика прогресса",
    text: "Отслеживайте динамику по темам и навыкам в личном кабинете.",
  },
];

const FAQ: FaqItem[] = [
  {
    q: "Что такое Gatehouse Awards?",
    a: "Gatehouse Awards — организация, которая присуждает квалификации по английскому языку (ESOL, IESOL). Экзамены ориентированы на международные стандарты владения английским языком.",
  },
  {
    q: "К каким программам Gatehouse Awards можно готовиться на skilLS?",
    a: "На платформе мы готовим к двум программам: ESOL Cadets (для детей и младших школьников) и ESOL Classic (стандартный экзамен по английскому языку).",
  },
  {
    q: "Какие навыки проверяются на экзамене?",
    a: "В зависимости от программы экзамен проверяет аудирование (Listening), чтение (Reading), лексику и грамматику (Use of English), письмо (Writing) и говорение (Speaking).",
  },
  {
    q: "Чем помогает подготовка на skilLS?",
    a: "Платформа даёт реалистичный интерфейс тестирования, моментальную проверку ответов с аналитикой ошибок и статистику прогресса по темам.",
  },
  {
    q: "Подходит ли платформа детям?",
    a: "Да. Программа ESOL Cadets рассчитана на детей и младших школьников, а задания и интерфейс адаптированы под этот возраст.",
  },
  {
    q: "Как начать подготовку?",
    a: "Зарегистрируйтесь на платформе skilLS, выберите нужные материалы и приступайте к заданиям. Демо-задание можно пройти бесплатно.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function GatehouseAwardsPage() {
  return (
    <div className="lp">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="lp-shell">
        {/* Верхняя панель */}
        <div className="lp-topbar">
          <Link href="/" className="lp-logo" aria-label="skilLS — на главную">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/image_0bd68b.png" alt="skilLS" />
          </Link>
          <Link href="/login" className="lp-toplink">
            Войти на платформу
          </Link>
        </div>

        {/* Hero */}
        <header className="lp-hero">
          <span className="lp-badge">Gatehouse Awards · ESOL (IESOL)</span>
          <h1 className="lp-title">
            Подготовка к экзаменам <span className="lp-accent">Gatehouse Awards</span> на платформе skilLS
          </h1>
          <p className="lp-lead">
            Gatehouse Awards (IESOL) — международные экзамены по английскому языку. На платформе
            skilLS вы готовитесь в интерактивном формате: задания как на экзамене, автоматическая
            проверка, разбор ошибок и аналитика прогресса.
          </p>
          <div className="lp-cta-row">
            <Link href="/register" className="lp-cta">
              Попробовать бесплатно
            </Link>
            <Link href="/demo" className="lp-cta lp-cta-ghost">
              Пройти демо-задание
            </Link>
          </div>
        </header>

        {/* Программы */}
        <section className="lp-section">
          <h2 className="lp-section-title">Программы подготовки</h2>
          <p className="lp-section-lead">
            Сейчас на платформе доступны две программы Gatehouse Awards — для детей и для широкой
            аудитории.
          </p>
          <div className="lp-grid lp-grid-3">
            {LEVELS.map((level) => (
              <article key={level.name} className="lp-card">
                <div className="lp-cat-head">
                  <h3 className="lp-card-title">{level.name}</h3>
                  <span className="lp-chip">{level.tag}</span>
                </div>
                <div className="lp-card-icon" aria-hidden="true">
                  {level.icon}
                </div>
                <p className="lp-card-text">{level.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Проверяемые навыки */}
        <section className="lp-section">
          <h2 className="lp-section-title">Что проверяет экзамен</h2>
          <p className="lp-section-lead">
            Экзамены Gatehouse Awards оценивают все ключевые навыки владения английским языком.
          </p>
          <div className="lp-grid lp-grid-4">
            {SKILLS.map((skill) => (
              <article key={skill.title} className="lp-card">
                <div className="lp-card-icon" aria-hidden="true">
                  {skill.icon}
                </div>
                <h3 className="lp-card-title">{skill.title}</h3>
                <p className="lp-card-text">{skill.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Преимущества */}
        <section className="lp-section">
          <h2 className="lp-section-title">Почему готовиться на skilLS</h2>
          <p className="lp-section-lead">
            Платформа приближает подготовку к реальным условиям экзамена и делает прогресс наглядным.
          </p>
          <div className="lp-grid lp-grid-3">
            {BENEFITS.map((benefit) => (
              <article key={benefit.title} className="lp-card">
                <div className="lp-card-icon" aria-hidden="true">
                  {benefit.icon}
                </div>
                <h3 className="lp-card-title">{benefit.title}</h3>
                <p className="lp-card-text">{benefit.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="lp-section">
          <h2 className="lp-section-title">Частые вопросы о Gatehouse Awards</h2>
          <p className="lp-section-lead">
            Коротко о том, что чаще всего спрашивают про экзамены и подготовку на платформе.
          </p>
          <FaqAccordion items={FAQ} />
        </section>

        {/* Финальный CTA */}
        <section className="lp-final">
          <h2>Начните подготовку к Gatehouse Awards бесплатно</h2>
          <p>Зарегистрируйтесь на skilLS, выберите программу и тренируйтесь в формате экзамена.</p>
          <div className="lp-cta-row">
            <Link href="/register" className="lp-cta">
              Попробовать бесплатно
            </Link>
            <Link href="/login" className="lp-cta lp-cta-ghost">
              Войти на платформу
            </Link>
          </div>
        </section>

        <footer className="lp-footer">
          <Link href="/">Главная</Link>
          <Link href="/olympiads/hippo">Олимпиада HIPPO</Link>
          <Link href="/info">Информация</Link>
          <Link href="/info/contacts">Контакты</Link>
        </footer>
      </div>
    </div>
  );
}