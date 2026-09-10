import type { Metadata } from "next";
import Link from "next/link";
import FaqAccordion, { type FaqItem } from "@/components/FaqAccordion";
import "@/app/landing.css";

export const metadata: Metadata = {
  title: "Подготовка к олимпиаде HIPPO по английскому языку | skilLS",
  description:
    "Подготовка к международной олимпиаде HIPPO на платформе skilLS: категории Little Hippo и Hippo 1–4, разбор формата экзамена, интерактивные задания, тренировка тайминга и геймификация.",
  keywords: [
    "олимпиада hippo подготовка",
    "материалы хиппо",
    "тесты hippo английский",
    "little hippo",
    "hippo 1 hippo 2 hippo 3 hippo 4",
    "олимпиада по английскому для школьников",
    "платформа скиллс",
    "интерактивные задания по английскому",
  ],
  alternates: { canonical: "/olympiads/hippo" },
  openGraph: {
    type: "website",
    url: "https://hipposha-book.ru/olympiads/hippo",
    siteName: "skilLS",
    title: "Подготовка к олимпиаде HIPPO по английскому языку | skilLS",
    description:
      "Категории Little Hippo и Hippo 1–4, формат экзамена и интерактивная подготовка к олимпиаде HIPPO на платформе skilLS.",
    locale: "ru_RU",
  },
};

type Category = { name: string; grade: string; age: string };

const CATEGORIES: Category[] = [
  { name: "Little Hippo", grade: "3 класс и младше", age: "до 9 лет" },
  { name: "Hippo 1", grade: "4–5 классы", age: "10–11 лет" },
  { name: "Hippo 2", grade: "6 класс", age: "12 лет" },
  { name: "Hippo 3", grade: "7–8 классы", age: "13–14 лет" },
  { name: "Hippo 4", grade: "9–10 классы", age: "15–16 лет" },
];

const SKILLS = [
  { icon: "📖", title: "Reading", text: "Чтение с пониманием: работа с текстами и вопросами к ним." },
  { icon: "🎧", title: "Listening", text: "Аудирование: восприятие речи на слух и задания на смысл и детали." },
  { icon: "✍️", title: "Writing", text: "Письмо: письменные задания с опорой на критерии оценивания." },
  { icon: "🗣️", title: "Speaking", text: "Говорение: устная часть на заключительных этапах олимпиады." },
];

const FEATURES = [
  { icon: "🎯", title: "Интерактивный формат", text: "Задания в реальном интерфейсе платформы: тесты, «вписать слово», кроссворды, аудирование и пары." },
  { icon: "⚡", title: "Автоматическая проверка", text: "Результат сразу после ответа — без ожидания и ручных проверок." },
  { icon: "⏱️", title: "Отработка тайминга", text: "Тренируйтесь решать задания в темпе реального экзамена." },
  { icon: "🔥", title: "Стрики и геймификация", text: "Серии занятий и награды поддерживают регулярность и мотивацию." },
];

const BENEFITS = [
  "Независимая оценка уровня английского в международном формате.",
  "Тренировка навыков, которые проверяются на олимпиаде: чтение, аудирование, письмо и говорение.",
  "Портфолио и подтверждение участия — плюс к учебным достижениям в России.",
  "Мотивация: соревновательный формат и шанс выйти на международные этапы, включая суперфинал в Италии.",
  "Удобный темп: доступ к материалам из личного кабинета в любое время.",
];

const FAQ: FaqItem[] = [
  {
    q: "Что такое олимпиада HIPPO?",
    a: "HIPPO (Hippo English Language Olympiad) — международная олимпиада по английскому языку для школьников. Она проходит в несколько этапов и оценивает ключевые языковые навыки.",
  },
  {
    q: "Кто может участвовать в HIPPO?",
    a: "Участвовать могут школьники разных возрастов: от младших классов (категория Little Hippo) до старших (категории Hippo 1–4). Каждая категория рассчитана на свой класс и возраст.",
  },
  {
    q: "Какие навыки проверяет олимпиада?",
    a: "В заданиях встречаются чтение (Reading), аудирование (Listening), письмо (Writing) и говорение (Speaking) — набор зависит от этапа олимпиады.",
  },
  {
    q: "Как готовиться к HIPPO на платформе skilLS?",
    a: "В личном кабинете доступны интерактивные задания в формате экзамена: тесты, «вписать слово», кроссворды, аудирование и пары. Платформа автоматически проверяет ответы и показывает прогресс.",
  },
  {
    q: "Даёт ли участие в HIPPO преимущества в России?",
    a: "Участие даёт независимую оценку уровня английского и подтверждение достижений, которые можно добавить в портфолио. Навыки, которые тренирует олимпиада, помогают в учёбе и на других экзаменах.",
  },
  {
    q: "Подойдёт ли платформа новичкам?",
    a: "Да. Задания разбиты по категориям и уровням сложности, поэтому начать можно с любого уровня и постепенно увеличивать нагрузку.",
  },
  {
    q: "Как начать подготовку?",
    a: "Зарегистрируйтесь на платформе skilLS, выберите подходящие материалы и приступайте к заданиям. Демо-задание можно пройти бесплатно без регистрации.",
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

export default function HippoPage() {
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
          <span className="lp-badge">Олимпиада HIPPO · английский язык</span>
          <h1 className="lp-title">
            Подготовка к олимпиаде <span className="lp-accent">HIPPO</span> на платформе skilLS
          </h1>
          <p className="lp-lead">
            HIPPO — международная олимпиада по английскому языку для школьников. На платформе skilLS
            вы тренируетесь в формате реальных заданий: интерактивные упражнения, автоматическая
            проверка, отработка тайминга и аналитика прогресса.
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

        {/* Категории */}
        <section className="lp-section">
          <h2 className="lp-section-title">Категории и классы олимпиады</h2>
          <p className="lp-section-lead">
            Задания отличаются в зависимости от возрастной категории. Ниже — категории, к которым
            можно готовиться на платформе.
          </p>
          <div className="lp-grid lp-grid-3">
            {CATEGORIES.map((cat) => (
              <article key={cat.name} className="lp-card">
                <div className="lp-cat-head">
                  <h3 className="lp-card-title">{cat.name}</h3>
                  <span className="lp-chip">{cat.age}</span>
                </div>
                <p className="lp-card-text">{cat.grade}</p>
              </article>
            ))}
          </div>
          <p className="lp-note">
            Помимо этого, официально существуют специальные категории S10 и S19 для учащихся
            специализированных школ.
          </p>
        </section>

        {/* Формат экзамена */}
        <section className="lp-section">
          <h2 className="lp-section-title">Формат экзамена: какие навыки проверяют</h2>
          <p className="lp-section-lead">
            Олимпиада оценивает ключевые языковые навыки. В зависимости от этапа участники выполняют
            задания на:
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

        {/* Фишки платформы */}
        <section className="lp-section">
          <h2 className="lp-section-title">Как проходит подготовка на skilLS</h2>
          <p className="lp-section-lead">
            Платформа превращает подготовку к олимпиаде в понятный и увлекательный процесс.
          </p>
          <div className="lp-grid lp-grid-4">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="lp-card">
                <div className="lp-card-icon" aria-hidden="true">
                  {feature.icon}
                </div>
                <h3 className="lp-card-title">{feature.title}</h3>
                <p className="lp-card-text">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Что даёт участие */}
        <section className="lp-section">
          <h2 className="lp-section-title">Что даёт участие в HIPPO</h2>
          <p className="lp-section-lead">
            Олимпиада — это не только проверка знаний, но и мотивация развивать английский дальше.
          </p>
          <ul className="lp-list">
            {BENEFITS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section className="lp-section">
          <h2 className="lp-section-title">Частые вопросы о HIPPO</h2>
          <p className="lp-section-lead">
            Коротко о том, что чаще всего спрашивают про олимпиаду и подготовку на платформе.
          </p>
          <FaqAccordion items={FAQ} />
        </section>

        {/* Финальный CTA */}
        <section className="lp-final">
          <h2>Начните подготовку к HIPPO бесплатно</h2>
          <p>Зарегистрируйтесь на skilLS, выберите подходящую категорию и тренируйтесь в формате олимпиады.</p>
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
          <Link href="/exams/gatehouse-awards">Gatehouse Awards</Link>
          <Link href="/info">Информация</Link>
          <Link href="/info/contacts">Контакты</Link>
        </footer>
      </div>
    </div>
  );
}