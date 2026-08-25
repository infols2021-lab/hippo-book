"use client";

import "./login.css";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

// Импортируем твои боевые компоненты заданий для песочницы
import QuestionTest from "@/app/(app)/projects/[slug]/assignment/components/QuestionTest";
import QuestionFill from "@/app/(app)/projects/[slug]/assignment/components/QuestionFill";
// Если Кроссворд/Пары полностью готовы на клиенте, их можно раскомментировать и добавить в Sandbox
// import QuestionCrossword from "@/app/(app)/projects/[slug]/assignment/components/QuestionCrossword";

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

type FeatureType = "test" | "fill" | "crossword" | "audio" | "matching";

type FeatureModalContent = {
  id: FeatureType;
  title: string;
  image?: string;
  description?: string;
};

const FEATURE_DATA: Record<string, FeatureModalContent> = {
  "Тесты": {
    id: "test",
    title: "Формат задания: Тесты",
    description: "Вопросы с одиночным или множественным выбором ответа, аудио-вставками и пояснениями.",
  },
  "Вписать слово": {
    id: "fill",
    title: "Формат задания: Вписать слово",
    description: "Задания на ввод пропущенных слов и выражений с гибкой системой проверки вариантов.",
  },
  "Кроссворды": {
    id: "crossword",
    title: "Формат задания: Кроссворды",
    image: "/features/crossword.png", // Фолбэк на картинку, если компонент слишком сложный для песочницы
    description: "Интерактивная сетка кроссворда для тренировки словарного запаса и спеллинга.",
  },
  "Аудирование": {
    id: "audio",
    title: "Формат задания: Аудирование",
    image: "/features/audio.png",
    description: "Упражнения на восприятие речи на слух с нативным британским и американским произношением.",
  },
  "Пары": {
    id: "matching",
    title: "Формат задания: Пары",
    image: "/features/matching.png",
    description: "Сопоставление слов с картинками, определениями или аудио-дорожками.",
  },
};

// ==========================================
// 🏗️ MOCK DATA ДЛЯ ПЕСОЧНИЦЫ
// ==========================================
const MOCK_TEST: any = {
  id: "demo-test-1",
  type: "test",
  q: "Choose the correct option to complete the sentence:\n\nShe ___ to the gym every morning.",
  multiple: false,
  layout: "vertical",
  options: [
    { id: "o1", text: "go", media: [] },
    { id: "o2", text: "goes", media: [] },
    { id: "o3", text: "is going", media: [] },
  ],
  correct: [1], // правильный индекс: "goes"
  media: [],
};

const MOCK_FILL: any = {
  id: "demo-fill-1",
  type: "fill",
  q: "Впишите правильную форму глагола 'to be':\n\nThey ___ good friends.",
  answers: [["are", "'re"]], // поддерживаем альтернативные ответы
  media: [],
};

// ==========================================
// 🛠️ КОМПОНЕНТ ИНТЕРАКТИВНОЙ ПЕСОЧНИЦЫ
// ==========================================
function InteractiveSandbox({ type }: { type: FeatureType }) {
  const [value, setValue] = useState<any>(type === "fill" ? [""] : []);
  const [isChecked, setIsChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  // Сбрасываем стейт при смене типа
  useEffect(() => {
    setValue(type === "fill" ? [""] : []);
    setIsChecked(false);
    setIsCorrect(false);
  }, [type]);

  const handleCheck = () => {
    let correct = false;

    if (type === "test") {
      const userAns = Array.isArray(value) ? [...value].sort() : [];
      const rightAns = [...MOCK_TEST.correct].sort();
      correct = JSON.stringify(userAns) === JSON.stringify(rightAns);
    } else if (type === "fill") {
      const userAns = Array.isArray(value) ? value : [""];
      const rightAns = MOCK_FILL.answers as string[][];
      
      correct = rightAns.every((acceptedVariants, idx) => {
        const userWord = (userAns[idx] || "").trim().toLowerCase();
        return acceptedVariants.some((v) => v.trim().toLowerCase() === userWord);
      });
    }

    setIsCorrect(correct);
    setIsChecked(true);
  };

  const handleReset = () => {
    setValue(type === "fill" ? [""] : []);
    setIsChecked(false);
  };

  const isTest = type === "test";
  const isFill = type === "fill";

  // Если для типа еще нет песочницы (например, кроссворд), показываем фолбэк-картинку
  if (!isTest && !isFill) {
    return (
      <div className="modal-image-placeholder">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>Здесь будет скриншот упражнения</span>
      </div>
    );
  }

  return (
    <div 
      className="sandbox-container" 
      style={{
        // Инжектируем CSS переменные, чтобы компоненты выглядели как в оригинале
        "--project-primary": "#0ea5e9",
        "--project-card-bg": "#ffffff",
        "--project-input-bg": "#f8fafc",
        "--project-input-border": "#cbd5e1",
        background: "#f8fafc",
        padding: "24px",
        borderRadius: "16px",
        border: "1px solid #e2e8f0",
        textAlign: "left"
      } as any}
    >
      <div style={{ marginBottom: "20px", fontSize: "15px", fontWeight: 600, color: "#334155", whiteSpace: "pre-wrap" }}>
        {isTest ? MOCK_TEST.q : MOCK_FILL.q}
      </div>

      <div style={{ marginBottom: "24px" }}>
        {isTest && (
          <QuestionTest 
            question={MOCK_TEST} 
            value={value} 
            onChange={(val) => { setValue(val); setIsChecked(false); }} 
            disabled={isChecked} 
          />
        )}
        {isFill && (
          <QuestionFill 
            question={MOCK_FILL} 
            value={value} 
            onChange={(val) => { setValue(val); setIsChecked(false); }} 
            disabled={isChecked} 
          />
        )}
      </div>

      {/* Панель микро-проверки */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
        <div>
          {isChecked && (
            <span style={{ fontWeight: 800, fontSize: "14px", color: isCorrect ? "#10b981" : "#ef4444" }}>
              {isCorrect ? "✅ Правильно!" : "❌ Ошибка, попробуйте еще раз."}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {isChecked ? (
            <button 
              type="button" 
              onClick={handleReset}
              style={{ background: "#f1f5f9", color: "#475569", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}
            >
              Сбросить
            </button>
          ) : (
            <button 
              type="button" 
              onClick={handleCheck}
              style={{ background: "#0ea5e9", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 12px rgba(14,165,233,0.3)" }}
            >
              Проверить ответ
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================
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
    msg.includes("request failed")
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

function extractErrorMessage(payload: ApiPayload | null, json: ApiPayload | null, fallback: string) {
  return String(payload?.error || payload?.message || json?.error || fallback);
}

// ==========================================
// ГЛАВНЫЙ КОМПОНЕНТ СТРАНИЦЫ ВХОДА
// ==========================================
function LoginPageContent() {
  const searchParams = useSearchParams();
  const msgParam = searchParams.get("message");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [bannerType, setBannerType] = useState<BannerType>(null);
  const [bannerText, setBannerText] = useState("");
  const [showResendBtn, setShowResendBtn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [networkIssue, setNetworkIssue] = useState(false);

  // Модальные окна
  const [helpOpen, setHelpOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [featureModal, setFeatureModal] = useState<FeatureModalContent | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"registration" | "rules">("registration");

  // Безопасная обработка скролла DOM при открытии модалок
  const isAnyModalOpen = helpOpen || supportOpen || Boolean(featureModal) || previewOpen;

  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isAnyModalOpen]);

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

    async function checkSession() {
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

    checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  async function resendConfirmation(emailValue: string) {
    try {
      setBusy(true);
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: emailValue }),
      });

      const json = await readApiPayload(res);
      const payload = unwrapApiData(json);

      if (!res.ok || !json?.ok) {
        showBanner("error", extractErrorMessage(payload, json, "Не удалось отправить письмо подтверждения."));
        return;
      }

      setShowResendBtn(false);
      showBanner(
        "success",
        payload?.message || json?.message || "Письмо с подтверждением отправлено повторно. Проверьте почту."
      );
    } catch (e: any) {
      if (looksLikeNetworkError(e)) showNetworkBanner(String(e?.message || e));
      else showBanner("error", "Не удалось отправить письмо: " + (e?.message || String(e)));
    } finally {
      setBusy(false);
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
    setShowResendBtn(false);

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
        const msg = extractErrorMessage(payload, json, "Ошибка входа");
        const code = String(payload?.code || json?.code || "").toUpperCase();

        if (looksLikeNetworkError(msg)) {
          showNetworkBanner(msg);
          setBusy(false);
          return;
        }

        if (code === "EMAIL_NOT_CONFIRMED" || msg.toLowerCase().includes("email не подтверж")) {
          showBanner("error", "Email не подтвержден. Проверьте вашу почту и подтвердите регистрацию.");
          setShowResendBtn(true);
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
        setHelpOpen(false);
        setSupportOpen(false);
        setFeatureModal(null);
        setPreviewOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function openFeatureModal(tagName: string) {
    const data = FEATURE_DATA[tagName] || {
      id: "unknown",
      title: `Формат задания: ${tagName}`,
      description: "Интерактивное упражнение на платформе skilLS.",
    };
    setFeatureModal(data);
  }

  function renderBanner() {
    if (!bannerType) return null;
    const cls = bannerType === "error" ? "error" : bannerType === "success" ? "success" : "warning";

    return (
      <div className={cls} style={{ display: "block", whiteSpace: "pre-line", marginBottom: "1rem" }}>
        {bannerText}
        {showResendBtn && (
          <div style={{ marginTop: "8px" }}>
            <button
              type="button"
              className="btn-secondary-action"
              onClick={() => void resendConfirmation(email.trim().toLowerCase())}
              disabled={busy}
            >
              Отправить письмо повторно
            </button>
          </div>
        )}
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
      {/* МОДАЛЬНОЕ ОКНО: ПОЛНОЭКРАННЫЙ ПРОСМОТР СКРИНШОТА ПРОФИЛЯ */}
      {previewOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewOpen(false);
          }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            backgroundColor: "rgba(10, 15, 30, 0.92)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            overflowY: "auto",
            padding: "24px 12px",
            boxSizing: "border-box",
          }}
        >
          <button
            type="button"
            aria-label="Закрыть"
            onClick={() => setPreviewOpen(false)}
            style={{
              position: "fixed",
              top: "16px",
              right: "16px",
              zIndex: 100000,
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              backgroundColor: "rgba(255, 255, 255, 0.22)",
              color: "#ffffff",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              fontSize: "22px",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              transition: "transform 0.15s ease, background-color 0.15s ease",
            }}
          >
            ✕
          </button>

          <div
            style={{
              margin: "auto",
              width: "100%",
              maxWidth: "1200px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src="/certificate.png"
              alt="Скриншот интерфейса"
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                borderRadius: "14px",
                boxShadow: "0 20px 60px rgba(0, 0, 0, 0.6)",
              }}
            />
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО: ПРИМЕРЫ ЗАДАНИЙ (ИНТЕРАКТИВНАЯ ПЕСОЧНИЦА) */}
      <div
        className={`modal-overlay ${featureModal ? "active" : ""}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) setFeatureModal(null);
        }}
      >
        <div className="modal-content" style={{ maxWidth: "600px", width: "100%" }}>
          <button className="modal-close" aria-label="Закрыть" onClick={() => setFeatureModal(null)} type="button">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="modal-title">{featureModal?.title}</div>
          
          {featureModal && (
            // Если у модалки есть картинка И она не поддерживается в песочнице, покажем картинку.
            // Иначе рендерим интерактивную песочницу.
            featureModal.image && (featureModal.id !== "test" && featureModal.id !== "fill") ? (
              <div className="modal-image-placeholder">
                <img
                  src={featureModal.image}
                  alt={featureModal.title}
                  style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "10px" }}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            ) : (
              <InteractiveSandbox type={featureModal.id} />
            )
          )}

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
          if (e.target === e.currentTarget) setHelpOpen(false);
        }}
      >
        <div className="help-modal-content">
          <div className="help-modal-header">
            <h3>Помощь</h3>
            <button className="help-close" onClick={() => setHelpOpen(false)} type="button">
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
                      Нажмите кнопку <Link href="/register" onClick={() => setHelpOpen(false)}>«Зарегистрироваться»</Link>. 
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
          if (e.target === e.currentTarget) setSupportOpen(false);
        }}
      >
        <div className="help-modal-content" style={{ maxWidth: "400px" }}>
          <div className="help-modal-header">
            <h3>Техническая поддержка</h3>
            <button className="help-close" onClick={() => setSupportOpen(false)} type="button">
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
              <img
                src="/image_0bd68b.png"
                alt="skilLS Logo"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
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
              <a href="https://taplink.cc/hippo_ga" target="_blank" rel="noreferrer" className="promo-cta">
                Подробнее об экзаменах и участии &nbsp;→
              </a>
            </div>
          </div>

          {/* ИЗОБРАЖЕНИЕ ПРЕВЬЮ ПРОФИЛЯ */}
          <div
            className="preview-container"
            onClick={() => setPreviewOpen(true)}
            style={{ cursor: "pointer" }}
          >
            <div className="preview-wrapper">
              <img
                src="/certificate.png"
                alt="Предпросмотр профиля"
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  borderRadius: "16px",
                  boxShadow: "0 8px 30px rgba(0, 0, 0, 0.08)",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                }}
              />
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
                Пройти демо-задание
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
                <button className="aux-btn" onClick={() => setHelpOpen(true)} type="button">
                  Помощь
                </button>
                <button className="aux-btn" onClick={() => setSupportOpen(true)} type="button">
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="page-login" />}>
      <LoginPageContent />
    </Suspense>
  );
}