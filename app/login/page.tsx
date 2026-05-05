"use client";

import "./login.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

type BannerType = "error" | "success" | "warning" | null;

function isValidEmail(email: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function buildHelpImageUrl(imageName: string, cacheBust?: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!cacheBust) return `${base}/storage/v1/object/public/help-images/${imageName}`;
  return `${base}/storage/v1/object/public/help-images/${imageName}?v=${cacheBust}`;
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

export default function LoginPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [cacheBust, setCacheBust] = useState<string | null>(null);

  useEffect(() => {
    setCacheBust(String(Date.now()));
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [bannerType, setBannerType] = useState<BannerType>(null);
  const [bannerText, setBannerText] = useState("");
  const [busy, setBusy] = useState(false);

  const [networkIssue, setNetworkIssue] = useState(false);

  const [helpOpen, setHelpOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"registration" | "rules">("registration");

  const [preloadVisible, setPreloadVisible] = useState(false);
  const [preloadCount, setPreloadCount] = useState(0);
  const totalToPreload = 2;

  const preloaded = useRef<{ registration?: HTMLImageElement; rules?: HTMLImageElement }>({});

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
      "Если у вас включён VPN/прокси — выключите и обновите страницу.\n" +
      "Если VPN выключен — проверьте интернет/файрвол и попробуйте снова.";
    showBanner("error", extra ? `${base}\n\nДетали: ${extra}` : base);
  }

  useEffect(() => {
    let cancelled = false;

    async function preloadOne(key: "registration" | "rules", file: string) {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          if (!cancelled) preloaded.current[key] = img;
          resolve();
        };
        img.onerror = () => resolve();
        img.src = buildHelpImageUrl(file);
      });
    }

    async function run() {
      setPreloadVisible(true);
      setPreloadCount(0);

      await preloadOne("registration", "registration-help.png").then(() => {
        if (!cancelled) setPreloadCount((c) => c + 1);
      });

      await preloadOne("rules", "rules-help.png").then(() => {
        if (!cancelled) setPreloadCount((c) => c + 1);
      });

      setTimeout(() => {
        if (!cancelled) setPreloadVisible(false);
      }, 2000);
    }

    run();

    return () => {
      cancelled = true;
    };
  }, []);

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
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        if (data?.user) {
          await checkUserRoleAndRedirect(data.user.id);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkUserRoleAndRedirect(userId: string) {
    try {
      const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", userId).single();
      if (profile?.is_admin) window.location.href = "/admin";
      else window.location.href = "/portal";
    } catch (e: any) {
      if (looksLikeNetworkError(e)) showNetworkBanner(String(e?.message || e));
      else showBanner("error", "❌ Ошибка загрузки профиля. Обновите страницу и попробуйте снова.");
    }
  }

  async function doLogin(isAdmin: boolean) {
    const e = email.trim();

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

      let data: any = null;
      let error: any = null;

      try {
        const res = await supabase.auth.signInWithPassword({ email: e, password });
        data = res.data;
        error = res.error;
      } catch (inner: any) {
        if (looksLikeNetworkError(inner)) {
          showNetworkBanner(String(inner?.message || inner));
          setBusy(false);
          return;
        }
        throw inner;
      }

      if (error) {
        const msg = error.message || "Неизвестная ошибка";
        const code = (error as any).code as string | undefined;

        if (looksLikeNetworkError(error) || looksLikeNetworkError(msg)) {
          showNetworkBanner(String(msg));
          setBusy(false);
          return;
        }

        if (msg.includes("Invalid login credentials") || code === "invalid_credentials") {
          showBanner("error", "❌ Неверный email или пароль. Если вы забыли пароль, воспользуйтесь восстановлением.");
        } else if (msg.includes("Email not confirmed") || code === "email_not_confirmed") {
          showBanner("error", "❌ Email не подтвержден. Проверьте вашу почту и подтвердите регистрацию.");

          const resend = window.confirm("Отправить письмо с подтверждением повторно?");
          if (resend) {
            try {
              const { error: resendError } = await supabase.auth.resend({ type: "signup", email: e });
              if (!resendError) showBanner("success", "📧 Письмо с подтверждением отправлено повторно. Проверьте почту.");
              else if (looksLikeNetworkError(resendError)) showNetworkBanner(String((resendError as any)?.message || resendError));
            } catch (re: any) {
              if (looksLikeNetworkError(re)) showNetworkBanner(String(re?.message || re));
            }
          }
        } else if (msg.includes("rate limit") || code === "rate_limit_exceeded") {
          showBanner("error", "⚠️ Слишком много попыток. Попробуйте через несколько минут.");
        } else if (msg.includes("User not found")) {
          showBanner("error", "❌ Пользователь с таким email не найден. Проверьте email или зарегистрируйтесь.");
        } else {
          showBanner("error", "❌ Ошибка входа: " + msg);
        }

        setBusy(false);
        return;
      }

      if (data.user && !(data.user as any).email_confirmed_at) {
        showBanner("error", "❌ Email не подтвержден. Проверьте вашу почту для завершения регистрации.");
        await supabase.auth.signOut();
        setBusy(false);
        return;
      }

      if (isAdmin) {
        const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", data.user.id).single();
        if (profile?.is_admin) window.location.href = "/admin";
        else {
          showBanner("error", "❌ У вас нет прав администратора");
          await supabase.auth.signOut();
          setBusy(false);
        }
      } else {
        window.location.href = "/portal";
      }
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
    return <div className={cls} style={{ display: "block" }}>{bannerText}</div>;
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

  function renderHelpImage(tab: "registration" | "rules") {
    const cached = preloaded.current[tab];
    const file = tab === "registration" ? "registration-help.png" : "rules-help.png";
    const alt = tab === "registration" ? "Инструкция по регистрации" : "Правила платформы";
    if (cached) return <img className="help-image" src={buildHelpImageUrl(file, cacheBust || undefined)} alt={alt} />;
    return <img className="help-image" src={buildHelpImageUrl(file)} alt={alt} />;
  }

  return (
    <div className="page-login">
      <div className="preload-status" style={{ display: preloadVisible ? "block" : "none" }}>
        <span
          className="spinner"
          style={{
            width: 16,
            height: 16,
            borderWidth: 2,
            display: "inline-block",
            verticalAlign: "middle",
            marginRight: 5,
          }}
        />
        Помощь: {Math.min(preloadCount, totalToPreload)}/{totalToPreload}
      </div>

      <div
        className="help-modal"
        style={{ display: helpOpen ? "flex" : "none" }}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeHelp();
        }}
      >
        <div className="help-modal-content">
          <div className="help-modal-header">
            <h3 style={{ margin: 0, color: "#2c3e50", fontWeight: 1000 }}>📚 Помощь</h3>
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
              📝 Регистрация
            </button>
            <button
              className={"help-tab " + (activeTab === "rules" ? "active" : "")}
              onClick={() => setActiveTab("rules")}
              type="button"
            >
              📋 Правила
            </button>
          </div>

          <div className={"help-tab-content " + (activeTab === "registration" ? "active" : "")}>
            {renderHelpImage("registration")}
          </div>

          <div className={"help-tab-content " + (activeTab === "rules" ? "active" : "")}>
            {renderHelpImage("rules")}
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
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              placeholder="example@gmail.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (document.getElementById("password") as HTMLInputElement | null)?.focus();
              }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль:</label>
            <input
              type="password"
              id="password"
              placeholder="Введите ваш пароль"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void doLogin(false);
              }}
            />
          </div>

          <button className="btn student" onClick={() => void doLogin(false)} disabled={busy}>
            👨‍🎓 Войти как ученик
          </button>

          <button className="btn admin" onClick={() => void doLogin(true)} disabled={busy}>
            🛠️ Войти как администратор
          </button>

          <div className="link">
            <p>
              Нет аккаунта? <Link href="/register">Зарегистрироваться</Link>
            </p>
            <p>
              <Link href="/reset">Забыли пароль?</Link>
            </p>

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
  );
}