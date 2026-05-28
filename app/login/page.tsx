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
    return {
      ok: false,
      error: text,
    };
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

  const [helpOpen, setHelpOpen] = useState(false);
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
      "🌐 Не удалось подключиться к серверу входа.\n" +
      "Проверьте интернет-соединение и попробуйте обновить страницу.\n" +
      "Если проблема повторяется — попробуйте открыть сайт позже.";
    showBanner("error", extra ? `${base}\n\nДетали: ${extra}` : base);
  }

  useEffect(() => {
    if (!msgParam) return;

    if (msgParam === "confirmed") {
      setNetworkIssue(false);
      showBanner("success", "✅ Email успешно подтвержден! Теперь вы можете войти в систему.");
    } else if (msgParam === "check_email") {
      setNetworkIssue(false);
      showBanner("warning", "📧 Проверьте вашу почту для подтверждения регистрации.");
    } else if (msgParam === "email_exists") {
      setNetworkIssue(false);
      showBanner(
        "error",
        "❌ Пользователь с таким email уже зарегистрирован. Войдите в существующий аккаунт или используйте другой email.",
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
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: emailValue,
        }),
      });

      const json = await readApiPayload(res);
      const payload = unwrapApiData(json);

      if (!res.ok || !json?.ok) {
        showBanner(
          "error",
          payload?.error || payload?.message || json?.error || "Не удалось отправить письмо подтверждения.",
        );
        return;
      }

      showBanner(
        "success",
        payload?.message || json?.message || "📧 Письмо с подтверждением отправлено повторно. Проверьте почту.",
      );
    } catch (e: any) {
      if (looksLikeNetworkError(e)) showNetworkBanner(String(e?.message || e));
      else showBanner("error", "❌ Не удалось отправить письмо: " + (e?.message || String(e)));
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
      showBanner("warning", "🔐 Проверяем данные...");

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
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
          showBanner("error", "❌ Email не подтвержден. Проверьте вашу почту и подтвердите регистрацию.");

          const resend = window.confirm("Отправить письмо с подтверждением повторно?");
          if (resend) {
            await resendConfirmation(e);
          }
        } else if (code === "INVALID_CREDENTIALS") {
          showBanner("error", "❌ Неверный email или пароль. Если вы забыли пароль, воспользуйтесь восстановлением.");
        } else if (code === "RATE_LIMIT") {
          showBanner("error", "⚠️ Слишком много попыток. Попробуйте через несколько минут.");
        } else if (code === "USER_NOT_FOUND") {
          showBanner("error", "❌ Пользователь с таким email не найден. Проверьте email или зарегистрируйтесь.");
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
      else showBanner("error", "❌ Неожиданная ошибка: " + (err?.message || String(err)));
      setBusy(false);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && helpOpen) {
        setHelpOpen(false);
        document.body.style.overflow = "";
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [helpOpen]);

  function openHelp() {
    setHelpOpen(true);
    document.body.style.overflow = "hidden";
  }

  function closeHelp() {
    setHelpOpen(false);
    document.body.style.overflow = "";
  }

  function renderBanner() {
    if (!bannerType) return null;
    const cls = bannerType === "error" ? "error" : bannerType === "success" ? "success" : "warning";

    return (
      <div className={cls} style={{ display: "block", whiteSpace: "pre-line" }}>
        {bannerText}
      </div>
    );
  }

  function renderNetworkActions() {
    if (!networkIssue) return null;

    return (
      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn student" type="button" onClick={() => window.location.reload()}>
          🔄 Обновить страницу
        </button>
        <Link className="btn info" href="/info">
          📄 Информация
        </Link>
      </div>
    );
  }

  function renderExistingAccountHelp() {
    if (msgParam !== "confirmed") return null;

    return (
      <div className="existing-account-help">
        <strong>🎉 Отлично! Ваш аккаунт активирован.</strong>
        <br />
        Теперь вы можете войти в систему используя ваш email и пароль.
      </div>
    );
  }

  return (
    <div className="page-login">
      <div
        className="help-modal"
        style={{ display: helpOpen ? "flex" : "none" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeHelp();
        }}
      >
        <div className="help-modal-content">
          <div className="help-modal-header">
            <h3>Справочный центр</h3>
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
              Руководство по регистрации
            </button>
            <button
              className={"help-tab " + (activeTab === "rules" ? "active" : "")}
              onClick={() => setActiveTab("rules")}
              type="button"
            >
              Правила платформы
            </button>
          </div>

          <div className={"help-tab-content " + (activeTab === "registration" ? "active" : "")}>
            <div className="help-html-inner">
              <h4 className="help-section-title">Инструкция по созданию профиля</h4>
              
              <div className="registration-guide">
                <div className="guide-step">
                  <div className="step-badge">1</div>
                  <div className="step-body">
                    <h5>Заполнение формы</h5>
                    <p>
                      Нажмите на ссылку <Link href="/register" onClick={closeHelp}>«Зарегистрироваться»</Link> в нижней части окна авторизации. 
                      Введите ваш действующий адрес электронной почты и установите надежный пароль. Пароль должен быть запоминающимся, но исключать простые комбинации.
                    </p>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-badge">2</div>
                  <div className="step-body">
                    <h5>Ожидание системного уведомления</h5>
                    <p>
                      После отправки формы на указанный вами Email автоматически отправляется письмо со специальной защищенной ссылкой для верификации. 
                      Процесс доставки письма сервером обычно занимает от 10 секунд до 2 минут.
                    </p>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-badge">3</div>
                  <div className="step-body">
                    <h5>Проверка почтового ящика</h5>
                    <p>
                      Откройте вашу почту. Ищите письмо от отправителя <strong>Учебники Хиппоши</strong>. Если во входящих сообщениях письма нет, обязательно проверьте вкладку <strong>«Промоакции»</strong> или системную папку <strong>«Спам»</strong>, так как почтовые фильтры иногда ошибочно распределяют новые автоматические уведомления.
                    </p>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-badge">4</div>
                  <div className="step-body">
                    <h5>Активация и первый вход</h5>
                    <p>
                      Перейдите по ссылке внутри полученного письма. Произойдет автоматическое подтверждение вашего профиля, и система перенаправит вас обратно на страницу авторизации. Вы увидите зеленый баннер об успешной активации. Теперь вы можете использовать свои Email и пароль для входа.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={"help-tab-content " + (activeTab === "rules" ? "active" : "")}>
            <div className="help-html-inner">
              <h4 className="help-section-title">Условия использования и регламент</h4>
              
              <div className="help-rules-grid">
                <div className="rule-card">
                  <div className="rule-card-num">01</div>
                  <div className="rule-card-content">
                    <h5>Конфиденциальность учетных данных</h5>
                    <p>
                      Передача индивидуального логина и пароля третьим лицам категорически запрещена. Профиль пользователя предназначен исключительно для персонального обучения одного студента. При обнаружении параллельных сессий доступ может быть заблокирован.
                    </p>
                  </div>
                </div>

                <div className="rule-card">
                  <div className="rule-card-num">02</div>
                  <div className="rule-card-content">
                    <h5>Защита интеллектуальной собственности</h5>
                    <p>
                      Все представленные на платформе интерактивные материалы, учебные пособия, тесты и методические алгоритмы являются объектами авторского права. Любое копирование, скачивание, тиражирование или публикация контента в открытых источниках преследуется по закону.
                    </p>
                  </div>
                </div>

                <div className="rule-card">
                  <div className="rule-card-num">03</div>
                  <div className="rule-card-content">
                    <h5>Автоматическая фиксация прогресса</h5>
                    <p>
                      Система осуществляет непрерывный мониторинг и сохранение динамики выполнения заданий. Прохождение тестов должно осуществляться лично учащимся без применения сторонних скриптов, расширений или искусственного вмешательства для обеспечения корректной работы адаптивного обучения.
                    </p>
                  </div>
                </div>

                <div className="rule-card">
                  <div className="rule-card-num">04</div>
                  <div className="rule-card-content">
                    <h5>Технический регламент сессий</h5>
                    <p>
                      Авторизационная сессия сохраняется в локальном кэше вашего браузера. При использовании публичных или чужих устройств всегда используйте ручной выход из аккаунта во избежание несанкционированного доступа к вашей статистике и личным данным со стороны третьих лиц.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="login-container">
        <div className="login-card">
          <div className="brand">
            <div className="brand-mark">HH</div>
            <div>
              <div className="brand-title">Учебники Хиппоши</div>
              <div className="brand-subtitle">🎓 Образовательная платформа</div>
            </div>
          </div>

          <h2>Вход в аккаунт</h2>

          <div className="loading" style={{ display: busy ? "block" : "none" }}>
            <div className="spinner" />
            Проверяем данные...
          </div>

          {renderBanner()}
          {renderNetworkActions()}
          {renderExistingAccountHelp()}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              placeholder="example@gmail.com"
              autoComplete="email"
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
            <label htmlFor="password">Пароль</label>
            <div className="input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                placeholder="Введите ваш пароль"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void doLogin(false);
                }}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                title={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                {showPassword ? "👁️‍🗨️" : "👁️"}
              </button>
            </div>
          </div>

          <button className="btn student" onClick={() => void doLogin(false)} disabled={busy}>
            👨‍🎓 Войти как ученик
          </button>

          <div className="link">
            <p>
              Нет аккаунта? <Link href="/register">Зарегистрироваться</Link>
            </p>
            <p>
              <Link href="/reset">Забыли пароль?</Link>
            </p>

            <div className="bottom-actions">
              <Link className="btn info" href="/info">
                📄 Информация
              </Link>

              <button className="btn help" onClick={openHelp} type="button">
                ❓ Помощь
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}