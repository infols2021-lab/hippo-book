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
  const [supportOpen, setSupportOpen] = useState(false);
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
      if (e.key === "Escape") {
        if (helpOpen) {
          setHelpOpen(false);
          document.body.style.overflow = "";
        }
        if (supportOpen) {
          setSupportOpen(false);
          document.body.style.overflow = "";
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [helpOpen, supportOpen]);

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
                      Нажмите кнопку <Link href="/register" onClick={closeHelp}>«Зарегистрироваться»</Link> в самом низу. 
                      Внимательно введите ваш настоящий рабочий Email и придумайте безопасный пароль.
                    </p>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-badge">2</div>
                  <div className="step-body">
                    <h5>Отправка ссылки на почту</h5>
                    <p>
                      Сразу после регистрации наша система отправит вам автоматическое письмо. 
                      Обычно оно долетает быстро — в течение пары минут.
                    </p>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-badge">3</div>
                  <div className="step-body">
                    <h5>Проверьте все папки</h5>
                    <p>
                      Откройте ваш почтовый ящик. Если во «Входящих» пусто, не пугайтесь — обязательно загляните в папки <strong>«Спам»</strong> and <strong>«Промоакции»</strong>. Фильтры почты иногда путают автоматические письма.
                    </p>
                  </div>
                </div>

                <div className="guide-step">
                  <div className="step-badge">4</div>
                  <div className="step-body">
                    <h5>Подтвердите и учитесь</h5>
                    <p>
                      Кликните по ссылке в письме. Ваш аккаунт мгновенно активируется, вас вернет сюда, и вы сможете спокойно зайти под своим логином и паролем.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={"help-tab-content " + (activeTab === "rules" ? "active" : "")}>
            <div className="help-html-inner rules-tab-bg">
              <h4 className="rules-main-title">правила</h4>
              
              <div className="help-rules-grid">
                <div className="rule-card">
                  <p>
                    Количество попыток не ограничено. Мы верим, что вы сможете! 
                    Система будет хранить ваш лучший (последний) результат.
                  </p>
                </div>

                <div className="rule-card">
                  <p>
                    Полный доступ к учебным модулям откроется после покупки.
                  </p>
                </div>

                <div className="rule-card">
                  <p>
                    Ваша цель — не просто пройти, а понять. Подходите к каждому уроку осознанно, 
                    чтобы извлечь максимальную пользу.
                  </p>
                </div>

                <div className="rule-card trophy-card">
                  <p>
                    Помните, главное — это ваше развитие. Этот учебник — ваш инструмент. 
                    Используйте его по максимуму!
                  </p>
                  <div className="trophy-vector">
                    <svg viewBox="0 0 24 24" width="64" height="64" fill="#f59e0b">
                      <path d="M18 2H6v2H2v5c0 2.21 1.79 4 4 4h2c.75 2.15 2.6 3.71 4.88 3.97V19H7v2h10v-2h-4.12v-2.03C15.16 16.71 17 15.15 17.75 13h2.25c2.21 0 4-1.79 4-4V4h-4V2zM4 6h2v5c-1.1 0-2-.9-2-2V6zm16 3c0 1.1-.9 2-2 2V6h2v3z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Мини-модалка технической поддержки */}
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
          <div style={{ padding: "20px 0", color: "rgba(15,23,42,0.9)" }}>
            <p style={{ marginBottom: "20px", fontSize: "14px", lineHeight: "1.5", fontWeight: 600 }}>
              Обычно администратор отвечает в течение 2 часов. Выберите любой удобный способ для быстрой связи:
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
                  fontWeight: 900,
                  fontSize: "14px",
                  textDecoration: "none",
                  textAlign: "center",
                  boxShadow: "0 4px 12px rgba(36, 161, 222, 0.2)"
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
                  fontWeight: 900,
                  fontSize: "14px",
                  textDecoration: "none",
                  textAlign: "center",
                  boxShadow: "0 4px 12px rgba(0, 119, 255, 0.2)"
                }}
              >
                Написать во ВКонтакте
              </a>
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
            Войти как ученик
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
                Информация
              </Link>

              <button className="btn help" onClick={openHelp} type="button">
                Помощь
              </button>
            </div>

            {/* Кнопка техподдержки, расположенная под всеми кнопками */}
            <button
              className="btn support"
              onClick={openSupport}
              type="button"
              style={{
                marginTop: "12px",
                width: "100%",
                padding: "11px",
                borderRadius: "12px",
                background: "rgba(15, 23, 42, 0.05)",
                border: "1px solid rgba(15, 23, 42, 0.08)",
                color: "rgba(15, 23, 42, 0.8)",
                fontWeight: 700,
                fontSize: "14px",
                cursor: "pointer"
              }}
            >
              Техническая поддержка
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}