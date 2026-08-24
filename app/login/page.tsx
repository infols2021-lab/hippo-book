"use client";

import "./login.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type BannerType = "error" | "success" | "warning" | null;

type ApiPayload = {
  ok?: boolean;
  error?: string;
  message?: string;
  code?: string;
  data?: any;
  authenticated?: boolean;
  profile?: any;
  redirectTo?: string;
};

type FeatureModalContent = {
  title: string;
  image?: string;
  description?: string;
};

const FEATURE_DATA: Record<string, FeatureModalContent> = {
  "Тесты": {
    title: "Формат задания: Тесты",
    image: "/features/test.png",
    description: "Вопросы с одиночным или множественным выбором ответа, аудио-вставками и пояснениями.",
  },
  "Вписать слово": {
    title: "Формат задания: Вписать слово",
    image: "/features/fill.png",
    description: "Задания на ввод пропущенных слов и выражений с гибкой системой проверки вариантов.",
  },
  "Кроссворды": {
    title: "Формат задания: Кроссворды",
    image: "/features/crossword.png",
    description: "Интерактивная сетка кроссворда для тренировки словарного запаса и спеллинга.",
  },
  "Аудирование": {
    title: "Формат задания: Аудирование",
    image: "/features/audio.png",
    description: "Упражнения на восприятие речи на слух с нативным британским и американским произношением.",
  },
  "Пары": {
    title: "Формат задания: Пары",
    image: "/features/matching.png",
    description: "Сопоставление слов с картинками, определениями или аудио-дорожками.",
  },
};

function isValidEmail(email: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function looksLikeNetworkError(err: unknown) {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase().trim();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("fetch failed") ||
    msg.includes("networkerror") ||
    msg.includes("network error") ||
    msg.includes("load failed") ||
    msg.includes("request failed") ||
    msg.includes("typeerror: failed to fetch")
  );
}

async function readApiPayload(res: Response): Promise<ApiPayload | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as ApiPayload;
  } catch {
    return { ok: false, error: text };
  }
}

function unwrapApiData(json: ApiPayload | null) {
  if (!json) return null;
  if (json.data && typeof json.data === "object") return json.data;
  return json;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [bannerType, setBannerType] = useState<BannerType>(null);
  const [bannerText, setBannerText] = useState("");
  const [busy, setBusy] = useState(false);

  const [networkIssue, setNetworkIssue] = useState(false);

  // Модальные окна
  const [helpOpen, setHelpOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [featureModal, setFeatureModal] = useState<FeatureModalContent | null>(null);
  const [activeTab, setActiveTab] = useState<"registration" | "rules">("registration");

  const msgParam = useMemo(() => {
    if (typeof window === "undefined") return null;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("message");
  }, []);

  function showBanner(type: BannerType, text: string) {
    setBannerType(type);
    setBannerText(text);
  }

  function showNetworkBanner(extra?: string) {
    setNetworkIssue(true);
    const base =
      "Не удалось подключиться к серверу входа.\n" +
      "Проверьте интернет-соединение и попробуйте обновить страницу.\n" +
      "Если проблема повторяется — попробуйте открыть сайт позже.";
    showBanner("error", extra ? `${base}\n\nДетали: ${extra}` : base);
  }

  useEffect(() => {
    if (!msgParam) return;

    if (msgParam === "confirmed") {
      setNetworkIssue(false);
      showBanner("success", "Email успешно подтвержден! Теперь вы можете войти в систему.");
    } else if (msgParam === "check_email") {
      setNetworkIssue(false);
      showBanner("warning", "Проверьте вашу почту для подтверждения регистрации.");
    } else if (msgParam === "email_exists") {
      setNetworkIssue(false);
      showBanner(
        "error",
        "Пользователь с таким email уже зарегистрирован. Войдите в существующий аккаунт или используйте другой email."
      );
    }
  }, [msgParam]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch("/api/auth/session", {
          method: "GET",
          cache: "no-store",
        });

        const json = await readApiPayload(res);
        const payload = unwrapApiData(json);

        if (cancelled) return;

        if (res.ok && json?.ok && payload?.authenticated) {
          const isAdmin = Boolean(payload?.profile?.is_admin);
          window.location.href = isAdmin ? "/admin" : "/portal";
        }
      } catch (e: any) {
        if (cancelled) return;
        if (looksLikeNetworkError(e)) showNetworkBanner(String(e?.message || e));
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  async function resendConfirmation(emailValue: string) {
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: emailValue }),
      });

      const json = await readApiPayload(res);
      const payload = unwrapApiData(json);

      if (!res.ok || !json?.ok) {
        showBanner(
          "error",
          payload?.error || payload?.message || json?.error || "Не удалось отправить письмо подтверждения."
        );
        return;
      }

      showBanner(
        "success",
        payload?.message || json?.message || "Письмо с подтверждением отправлено повторно. Проверьте почту."
      );
    } catch (e: any) {
      if (looksLikeNetworkError(e)) showNetworkBanner(String(e?.message || e));
      else showBanner("error", "Не удалось отправить письмо: " + (e?.message || String(e)));
    }
  }

  async function doLogin(isAdmin: boolean) {
    const e = email.trim().toLowerCase();

    if (!e || !password) {
      setNetworkIssue(false);
      showBanner("error", "Введите email и пароль");
      return;
    }

    if (!isValidEmail(e)) {
      setNetworkIssue(false);
      showBanner("error", "Неверный формат email");
      return;
    }

    setNetworkIssue(false);

    try {
      setBusy(true);
      showBanner("warning", "Проверяем данные...");

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: e,
          password,
          isAdmin,
          mode: isAdmin ? "admin" : "student",
        }),
      });

      const json = await readApiPayload(res);
      const payload = unwrapApiData(json);

      if (!res.ok || !json?.ok) {
        const msg = String(payload?.error || payload?.message || json?.error || "Ошибка входа");
        const code = String(payload?.code || json?.code || "").toUpperCase();

        if (looksLikeNetworkError(msg)) {
          showNetworkBanner(msg);
          setBusy(false);
          return;
        }

        if (code === "EMAIL_NOT_CONFIRMED" || msg.toLowerCase().includes("email не подтверж")) {
          showBanner("error", "Email не подтвержден. Проверьте вашу почту и подтвердите регистрацию.");
          const resend = window.confirm("Отправить письмо с подтверждением повторно?");
          if (resend) {
            await resendConfirmation(e);
          }
        } else if (code === "INVALID_CREDENTIALS") {
          showBanner("error", "Неверный email или пароль. Если вы забыли пароль, воспользуйтесь восстановлением.");
        } else if (code === "RATE_LIMIT") {
          showBanner("error", "Слишком много попыток. Попробуйте через несколько минут.");
        } else if (code === "USER_NOT_FOUND") {
          showBanner("error", "Пользователь с таким email не найден. Проверьте email или зарегистрируйтесь.");
        } else {
          showBanner("error", msg);
        }

        setBusy(false);
        return;
      }

      const redirectTo = String(payload?.redirectTo || (isAdmin ? "/admin" : "/portal"));
      window.location.href = redirectTo;
    } catch (err: any) {
      if (looksLikeNetworkError(err)) showNetworkBanner(String(err?.message || err));
      else showBanner("error", "Неожиданная ошибка: " + (err?.message || String(err)));
      setBusy(false);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (helpOpen) closeHelp();
        if (supportOpen) closeSupport();
        if (featureModal) closeFeatureModal();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [helpOpen, supportOpen, featureModal]);

  function openHelp() {
    setHelpOpen(true);
    document.body.style.overflow = "hidden";
  }

  function closeHelp() {
    setHelpOpen(false);
    document.body.style.overflow = "";
  }

  function openSupport() {
    setSupportOpen(true);
    document.body.style.overflow = "hidden";
  }

  function closeSupport() {
    setSupportOpen(false);
    document.body.style.overflow = "";
  }

  function openFeatureModal(tagName: string) {
    const data = FEATURE_DATA[tagName] || {
      title: `Формат задания: ${tagName}`,
      description: "Интерактивное упражнение на платформе skilLS.",
    };
    setFeatureModal(data);
    document.body.style.overflow = "hidden";
  }

  function closeFeatureModal() {
    setFeatureModal(null);
    document.body.style.overflow = "";
  }

  function renderBanner() {
    if (!bannerType) return null;
    const cls = bannerType === "error" ? "error" : bannerType === "success" ? "success" : "warning";

    return (
      <div className={cls} style={{ display: "block", whiteSpace: "pre-line", marginBottom: "1rem" }}>
        {bannerText}
      </div>
    );
  }

  function renderNetworkActions() {
    if (!networkIssue) return null;

    return (
      <div style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn-secondary-action" type="button" onClick={() => window.location.reload()}>
          Обновить страницу
        </button>
        <Link className="btn-secondary-action" href="/info">
          Информация
        </Link>
      </div>
    );
  }

  return (
    <div className="page-login">
      {/* МОДАЛЬНОЕ ОКНО: ПРИМЕРЫ ЗАДАНИЙ */}
      <div
        className={`modal-overlay ${featureModal ? "active" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeFeatureModal();
        }}
      >
        <div className="modal-content">
          <button className="modal-close" aria-label="Закрыть" onClick={closeFeatureModal} type="button">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="modal-title">{featureModal?.title}</div>
          <div className="modal-image-placeholder">
            {featureModal?.image ? (
              <img
                src={featureModal.image}
                alt={featureModal.title}
                style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "10px" }}
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            ) : null}
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>Здесь будет скриншот упражнения</span>
          </div>
          {featureModal?.description && (
            <p style={{ marginTop: "1rem", fontSize: "0.9rem", color: "var(--text-mut-navy)", lineHeight: 1.5 }}>
              {featureModal.description}
            </p>
          )}
        </div>
      </div>

      {/* МОДАЛЬНОЕ ОКНО: ПОМОЩЬ */}
      <div
        className="help-modal"
        style={{ display: helpOpen ? "flex" : "none" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeHelp();
        }}
      >
        <div className="help-modal-content">
          <div className="help-modal-header">
            <h3>Помощь</h3>
            <button className="help-close" onClick={closeHelp} type="button">
              ✕
            </button>
          </div>

          <div className="help-modal-tabs">
            <button
              className={"help-tab " + (activeTab === "registration" ? "active" : "")}
              onClick={() => setActiveTab("registration")}
              type="button"
            >
              Регистрация
            </button>
            <button
              className={"help-tab " + (activeTab === "rules" ? "active" : "")}
              onClick={() => setActiveTab("rules")}
              type="button"
            >
              Правила
            </button>
          </div>

          <div className={"help-tab-content " + (activeTab === "registration" ? "active" : "")}>
            <div className="help-html-inner">
              <h4 className="help-section-title">Как создать профиль и войти</h4>
              <div className="registration-guide">
                <div className="guide-step">
                  <div className="step-badge">1</div>
                  <div className="step-body">
                    <h5>Заполните анкету</h5>
                    <p>
                      Нажмите кнопку <Link href="/register" onClick={closeHelp}>«Зарегистрироваться»</Link>. 
                      Внимательно введите ваш рабочий Email и придумайте пароль.
                    </p>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-badge">2</div>
                  <div className="step-body">
                    <h5>Отправка ссылки на почту</h5>
                    <p>
                      Сразу после регистрации система отправит вам автоматическое письмо с подтверждением.
                    </p>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-badge">3</div>
                  <div className="step-body">
                    <h5>Проверьте все папки</h5>
                    <p>
                      Если во «Входящих» пусто — загляните в папки <strong>«Спам»</strong> и <strong>«Промоакции»</strong>.
                    </p>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-badge">4</div>
                  <div className="step-body">
                    <h5>Подтвердите и учитесь</h5>
                    <p>
                      Кликните по ссылке в письме. Аккаунт активируется, и вы сможете войти.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={"help-tab-content " + (activeTab === "rules" ? "active" : "")}>
            <div className="help-html-inner rules-tab-bg">
              <h4 className="rules-main-title">Правила платформы</h4>
              <div className="help-rules-grid">
                <div className="rule-card">
                  <p>
                    Количество попыток не ограничено. Система сохраняет ваш лучший (последний) результат.
                  </p>
                </div>
                <div className="rule-card">
                  <p>
                    Полный доступ к учебным модулям открывается после подключения тарифа или выдачи преподавателем.
                  </p>
                </div>
                <div className="rule-card">
                  <p>
                    Подходите к каждому уроку осознанно, чтобы извлечь максимальную пользу из разбора ошибок.
                  </p>
                </div>
                <div className="rule-card trophy-card">
                  <p>
                    Главное — это ваше развитие. Учебные материалы skilLS — ваш инструмент для подготовки к вершинам.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* МОДАЛЬНОЕ ОКНО: ТЕХПОДДЕРЖКА */}
      <div
        className="help-modal"
        style={{ display: supportOpen ? "flex" : "none" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeSupport();
        }}
      >
        <div className="help-modal-content" style={{ maxWidth: "400px" }}>
          <div className="help-modal-header">
            <h3>Техническая поддержка</h3>
            <button className="help-close" onClick={closeSupport} type="button">
              ✕
            </button>
          </div>
          <div style={{ padding: "20px 0", color: "var(--text-navy)" }}>
            <p style={{ marginBottom: "20px", fontSize: "14px", lineHeight: "1.5", fontWeight: 600 }}>
              Обычно администратор отвечает в течение 2 часов. Выберите удобный способ связи:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <a
                href="https://t.me/skebobingg"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block",
                  padding: "12px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #24a1de, #208ec4)",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: "14px",
                  textDecoration: "none",
                  textAlign: "center",
                  boxShadow: "0 4px 12px rgba(36, 161, 222, 0.2)",
                }}
              >
                Написать в Telegram
              </a>
              <a
                href="https://vk.com/bluntokyr"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block",
                  padding: "12px",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #0077ff, #0066da)",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: "14px",
                  textDecoration: "none",
                  textAlign: "center",
                  boxShadow: "0 4px 12px rgba(0, 119, 255, 0.2)",
                }}
              >
                Написать во ВКонтакте
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ОСНОВНАЯ РАЗМЕТКА SPLIT SCREEN */}
      <div className="split-layout">
        {/* PROMO SIDE */}
        <div className="promo-side">
          <div className="promo-content">
            <div className="logo">
              <img src="/image_0bd68b.png" alt="skilLS Logo" onError={(e) => {
                // Fallback, если логотип еще не положен в public
                (e.currentTarget as HTMLElement).style.display = "none";
              }} />
            </div>

            <h1 className="promo-title">skilLS - образовательная онлайн-платформа</h1>

            <p className="promo-text">
              Прокачивайте английский в современных форматах. В личном кабинете доступны десятки типов интерактивных заданий. Каждое упражнение помогает закрепить знания и уверенно решать реальные тесты, а подробная аналитика показывает ваш прогресс по всем темам.
            </p>

            <div className="interactive-hint">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              Нажми на формат, чтобы увидеть пример задания
            </div>

            <div className="feature-tags">
              {["Тесты", "Вписать слово", "Кроссворды", "Аудирование", "Пары"].map((tag, idx) => (
                <div
                  key={tag}
                  className="feature-tag"
                  style={{ animationDelay: `${idx * 0.2}s` }}
                  onClick={() => openFeatureModal(tag)}
                >
                  {tag}
                </div>
              ))}
            </div>

            <p className="promo-text">
              Сейчас мы фокусируемся на подготовке к международной олимпиаде <strong>HIPPO</strong> и международным экзаменам <strong>Gatehouse Awards</strong>, и список направлений будет расширяться. Подтвержденный уровень CEFR официально признается за рубежом, а лучшие участники получают шанс поехать на суперфинал в Италию.
            </p>

            <p className="promo-text">
              Для старта тренировок <strong>используйте панель авторизации справа.</strong>
            </p>

            <div className="promo-cta-wrap">
              <a href="https://hipposha-book.ru" target="_blank" rel="noreferrer" className="promo-cta">
                Подробнее об экзаменах и участии &nbsp;→
              </a>
            </div>
          </div>

          {/* SIGNATURE VISUAL: Векторный сертификат */}
          <div className="cert-container">
            <div className="cert-wrapper">
              <svg viewBox="0 0 720 452" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Пример международного сертификата skilLS">
                <defs>
                  <linearGradient id="paperGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#f8fafc" />
                  </linearGradient>
                  <linearGradient id="sealGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#1e40af" />
                  </linearGradient>
                  <linearGradient id="barFill" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#93c5fd" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>

                <rect x="6" y="6" width="708" height="440" rx="16" fill="url(#paperGrad)" stroke="#e2e8f0" strokeWidth="2" />
                <rect x="16" y="16" width="688" height="420" rx="10" fill="none" stroke="#bfdbfe" strokeWidth="1" strokeOpacity="0.6" />

                <g opacity="0.4" stroke="#93c5fd" strokeWidth="1.5" fill="none">
                  <circle cx="50" cy="50" r="10" />
                  <circle cx="50" cy="50" r="18" />
                  <circle cx="670" cy="50" r="10" />
                  <circle cx="670" cy="50" r="18" />
                </g>

                <text x="46" y="62" className="cert-svg-mono" fontSize="10.5" letterSpacing="2.5" fill="#64748b" fontWeight="600">
                  SKILLS · DIGITAL ACHIEVEMENT
                </text>
                <text x="46" y="102" className="cert-svg-serif" fontSize="27" fill="#0f172a" fontWeight="600">
                  Сертификат достижений
                </text>
                <text x="46" y="126" className="cert-svg-text" fontSize="12.5" fill="#64748b">
                  Интерактивная подготовка &amp; Экзамены
                </text>

                <g transform="translate(636,64)">
                  <circle r="34" fill="url(#sealGrad)" />
                  <circle r="34" fill="none" stroke="#dbeafe" strokeWidth="1.5" strokeOpacity=".3" />
                  <path d="M0,-16 L4.5,-5 L16,-5 L6.5,2 L10,13 L0,6 L-10,13 L-6.5,2 L-16,-5 L-4.5,-5 Z" fill="#ffffff" />
                </g>

                <text x="46" y="188" className="cert-svg-mono" fontSize="9.5" letterSpacing="1.8" fill="#64748b" fontWeight="600">
                  СТУДЕНТ
                </text>
                <text x="46" y="214" className="cert-svg-serif" fontSize="21" fill="#0f172a" fontWeight="500">
                  Анна Иванова
                </text>
                <line x1="46" y1="224" x2="330" y2="224" stroke="#bfdbfe" strokeWidth="1" strokeOpacity="0.7" />

                <text x="46" y="256" className="cert-svg-mono" fontSize="9.5" letterSpacing="1.8" fill="#64748b" fontWeight="600">
                  ПРОГРЕСС НАВЫКОВ · CEFR
                </text>
                <g fontFamily="'IBM Plex Mono', monospace" fontSize="11.5" fontWeight="600">
                  <rect x="46" y="266" width="52" height="26" rx="6" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1.3" />
                  <text x="72" y="283" textAnchor="middle" fill="#94a3b8">A1</text>
                  <rect x="104" y="266" width="52" height="26" rx="6" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1.3" />
                  <text x="130" y="283" textAnchor="middle" fill="#94a3b8">A2</text>
                  <rect x="162" y="266" width="52" height="26" rx="6" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1.3" />
                  <text x="188" y="283" textAnchor="middle" fill="#94a3b8">B1</text>
                  <rect x="220" y="263" width="58" height="32" rx="8" fill="url(#barFill)" />
                  <text x="249" y="284" textAnchor="middle" fill="#ffffff">B2</text>
                  <rect x="284" y="266" width="52" height="26" rx="6" fill="none" stroke="#e2e8f0" strokeWidth="1.3" />
                  <text x="310" y="283" textAnchor="middle" fill="#94a3b8">C1</text>
                  <rect x="342" y="266" width="52" height="26" rx="6" fill="none" stroke="#e2e8f0" strokeWidth="1.3" />
                  <text x="368" y="283" textAnchor="middle" fill="#94a3b8">C2</text>
                </g>

                <text x="46" y="332" className="cert-svg-mono" fontSize="9.5" letterSpacing="1.8" fill="#64748b" fontWeight="600">
                  МАРШРУТ НА СУПЕРФИНАЛ
                </text>
                <g>
                  <circle cx="52" cy="358" r="4.5" fill="#3b82f6" />
                  <text x="52" y="378" textAnchor="middle" className="cert-svg-text" fontSize="9.5" fill="#64748b">
                    Старт
                  </text>
                  <line x1="60" y1="358" x2="590" y2="358" stroke="#93c5fd" strokeWidth="2" strokeDasharray="4 6" />
                  <g transform="translate(600,358)">
                    <path d="M0,-13 L3.8,-4 L13,-4 L5.5,1.6 L8.4,10.6 L0,5 L-8.4,10.6 L-5.5,1.6 L-13,-4 L-3.8,-4 Z" fill="#2563eb" />
                  </g>
                  <text x="600" y="378" textAnchor="middle" className="cert-svg-mono" fontSize="9.5" fill="#2563eb" fontWeight="600">
                    ИТАЛИЯ
                  </text>
                </g>

                <line x1="46" y1="404" x2="674" y2="404" stroke="#e2e8f0" strokeWidth="1" />
                <text x="46" y="424" className="cert-svg-text" fontSize="10" fill="#94a3b8">
                  Современная платформа для изучения английского языка
                </text>
              </svg>
            </div>
          </div>
        </div>

        {/* AUTH SIDE */}
        <div className="auth-side">
          <div className="auth-container">
            <div className="auth-tabs">
              <div className="auth-tab active">Вход</div>
              <Link href="/register" className="auth-tab" style={{ textDecoration: "none" }}>
                Регистрация
              </Link>
            </div>

            {renderBanner()}
            {renderNetworkActions()}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void doLogin(false);
              }}
            >
              <div className="form-group">
                <label className="form-label" htmlFor="email">Электронная почта</label>
                <input
                  type="email"
                  id="email"
                  className="form-input"
                  placeholder="student@mail.ru"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      (document.getElementById("password") as HTMLInputElement | null)?.focus();
                    }
                  }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Пароль</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    className="form-input"
                    placeholder="Введите пароль"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ paddingRight: "75px" }}
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      color: "var(--blue-600)",
                      cursor: "pointer",
                      padding: "4px",
                    }}
                  >
                    {showPassword ? "Скрыть" : "Показать"}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-submit" disabled={busy}>
                {busy ? "Проверяем данные..." : "Войти на платформу"}
              </button>

              <Link href="/demo" className="btn-demo">
                ⚡ Пройти демо-задание
              </Link>
            </form>

            <div className="auth-footer">
              <Link href="/reset" className="auth-link">
                Забыли пароль?
              </Link>

              <div className="aux-actions">
                <Link className="aux-btn" href="/info">
                  Информация
                </Link>
                <button className="aux-btn" onClick={openHelp} type="button">
                  Помощь
                </button>
                <button className="aux-btn" onClick={openSupport} type="button">
                  Поддержка
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}