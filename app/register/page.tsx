"use client";

import { useEffect, useMemo, useState } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";
import "./register.css";

type BannerType = "error" | "success" | "warning" | null;
type ModalKind = "error" | "success" | "warning";

const BLOCKED_DOMAINS = [
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "yopmail.com",
  "throwawaymail.com",
  "fakeinbox.com",
  "temp-mail.org",
  "trashmail.com",
  "getnada.com",
  "tmpmail.org",
  "maildrop.cc",
  "disposablemail.com",
  "fake-mail.com",
  "tempinbox.com",
  "jetable.org",
  "mailnesia.com",
  "sharklasers.com",
  "guerrillamail.biz",
  "grr.la",
  "guerrillamail.info",
  "spam4.me",
  "tmpmail.net",
];

const REGISTRATION_LIMIT = {
  maxAttempts: 3,
  timeWindow: 60 * 60 * 1000,
  key: "edu-keys-registration-limits",
};

function isValidEmail(email: string) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateDomain(email: string) {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return { valid: false, message: "Неверный формат email" };

  if (BLOCKED_DOMAINS.includes(domain)) {
    return { valid: false, message: "Временные email адреса запрещены" };
  }

  return { valid: true, message: "" };
}

function checkRateLimit() {
  try {
    const now = Date.now();
    const limits = JSON.parse(
      localStorage.getItem(REGISTRATION_LIMIT.key) || '{"attempts":[]}',
    ) as { attempts: number[] };

    const recentAttempts = (limits.attempts || []).filter(
      (t) => now - t < REGISTRATION_LIMIT.timeWindow,
    );

    if (recentAttempts.length >= REGISTRATION_LIMIT.maxAttempts) {
      const nextAttempt = Math.min(...recentAttempts) + REGISTRATION_LIMIT.timeWindow;
      const minutesLeft = Math.ceil((nextAttempt - now) / (60 * 1000));
      return {
        allowed: false,
        message: `Превышен лимит регистраций. Попробуйте через ${minutesLeft} минут.`,
      };
    }

    recentAttempts.push(now);
    localStorage.setItem(
      REGISTRATION_LIMIT.key,
      JSON.stringify({ attempts: recentAttempts }),
    );

    return { allowed: true, message: "" };
  } catch {
    return { allowed: true, message: "" };
  }
}

export default function RegisterPage() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [bannerType, setBannerType] = useState<BannerType>(null);
  const [bannerText, setBannerText] = useState("");

  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<ModalKind>("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalBody, setModalBody] = useState("");

  function showBanner(type: BannerType, text: string) {
    setBannerType(type);
    setBannerText(text);
  }

  function clearBanner() {
    setBannerType(null);
    setBannerText("");
  }

  function openModal(kind: ModalKind, title: string, body: string) {
    setModalKind(kind);
    setModalTitle(title);
    setModalBody(body);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setBusy(false);
    clearBanner();
  }

  const formatValid = useMemo(() => isValidEmail(email.trim()), [email]);

  const matchValid = useMemo(() => {
    const e = email.trim().toLowerCase();
    const c = confirmEmail.trim().toLowerCase();
    return !!e && !!c && e === c;
  }, [email, confirmEmail]);

  const passwordValid = useMemo(() => password.length >= 6, [password]);

  const domainValid = useMemo(() => {
    const e = email.trim().toLowerCase();
    return e ? validateDomain(e).valid : false;
  }, [email]);

  const phoneValid = useMemo(() => phone.trim().length > 0, [phone]);
  const regionValid = useMemo(() => region !== "", [region]);
  const nameValid = useMemo(() => fullName.trim().length >= 3, [fullName]);

  const canSubmit = useMemo(() => {
    return (
      !busy &&
      !registered &&
      formatValid &&
      matchValid &&
      passwordValid &&
      domainValid &&
      phoneValid &&
      regionValid &&
      nameValid &&
      !!captchaToken &&
      !!siteKey
    );
  }, [
    busy,
    registered,
    formatValid,
    matchValid,
    passwordValid,
    domainValid,
    phoneValid,
    regionValid,
    nameValid,
    captchaToken,
    siteKey,
  ]);

  function resetCaptchaHard() {
    setCaptchaToken(null);
    setReloadNonce((n) => n + 1);
  }

  function friendlyErrorFromApi(payload: any, status: number) {
    const code = String(payload?.code || "").toUpperCase();
    const err = String(payload?.error || payload?.message || "").trim();

    if (code === "USER_EXISTS" || err.toLowerCase().includes("уже существует")) {
      return (
        "Аккаунт с таким email уже существует.\n\n" +
        "Что можно сделать:\n" +
        "• Нажмите «Войти в систему»\n" +
        "• Или используйте «Забыли пароль?» для восстановления"
      );
    }

    if (code === "RATE_LIMIT" || status === 429) {
      return "Слишком много попыток. Подождите несколько минут и попробуйте снова.";
    }

    if (
      code.includes("CAPTCHA") ||
      code.includes("TURNSTILE") ||
      err.toLowerCase().includes("капч")
    ) {
      return (
        (err || "Капча не пройдена или не загрузилась.") +
        "\n\nПопробуйте:\n" +
        "• Нажать «Перезагрузить капчу»\n" +
        "• Отключить VPN/прокси (если включены)\n" +
        "• Обновить страницу"
      );
    }

    if (code === "VALIDATION") {
      return err || "Проверьте правильность заполнения полей.";
    }

    if (err) return err;
    return `Ошибка регистрации (${status}). Попробуйте перезагрузить капчу и повторить.`;
  }

  async function onRegister() {
    if (busy || registered) return;

    const fn = fullName.trim();
    const ph = phone.trim();
    const rg = region.trim();
    const em = email.trim().toLowerCase();
    const cem = confirmEmail.trim().toLowerCase();

    if (!fn || !ph || !rg || !em || !cem || !password) {
      openModal("error", "Ошибка", "Заполните все поля.");
      return;
    }
    if (password.length < 6) {
      openModal("error", "Ошибка", "Пароль должен быть не менее 6 символов.");
      return;
    }
    if (em !== cem) {
      openModal("error", "Ошибка", "Email адреса не совпадают.");
      return;
    }
    if (!isValidEmail(em)) {
      openModal("error", "Ошибка", "Неверный формат email.");
      return;
    }

    const dc = validateDomain(em);
    if (!dc.valid) {
      openModal("error", "Ошибка", dc.message);
      return;
    }

    if (!captchaToken) {
      openModal(
        "warning",
        "Нужна капча",
        "Пожалуйста, пройдите капчу.\n\nЕсли капча не отображается — нажмите «Перезагрузить капчу».",
      );
      return;
    }

    const rl = checkRateLimit();
    if (!rl.allowed) {
      openModal("error", "Лимит", rl.message);
      return;
    }

    try {
      setBusy(true);
      showBanner("warning", "🔄 Создаем ваш аккаунт...");

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: fn,
          phone: ph,
          region: rg,
          email: em,
          password,
          captchaToken,
        }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        const msg = friendlyErrorFromApi(json, res.status);

        setBusy(false);
        clearBanner();
        resetCaptchaHard();

        openModal("error", "Ошибка регистрации", msg);
        return;
      }

      if (!json?.ok) {
        const msg = friendlyErrorFromApi(json, 400);

        setBusy(false);
        clearBanner();
        resetCaptchaHard();

        openModal("error", "Ошибка регистрации", msg);
        return;
      }

      setBusy(false);
      clearBanner();

      openModal(
        "success",
        "Успешно!",
        json.message ||
          "✅ Регистрация принята!\n\n📧 Проверьте почту (и папку Спам) и подтвердите email.\nБез подтверждения вход невозможен.",
      );

      setRegistered(true);

      setFullName("");
      setPhone("");
      setRegion("");
      setEmail("");
      setConfirmEmail("");
      setPassword("");
      setCaptchaToken(null);

      setTimeout(() => {
        window.location.href = "/login?message=check_email";
      }, 8000);
    } catch (e: any) {
      setBusy(false);
      clearBanner();
      resetCaptchaHard();

      openModal(
        "error",
        "Ошибка",
        "Не удалось отправить запрос.\n\nПопробуйте:\n• Перезагрузить капчу\n• Обновить страницу\n• Отключить VPN/прокси\n\nДетали: " +
          (e?.message || String(e)),
      );
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && canSubmit) {
        e.preventDefault();
        void onRegister();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [canSubmit]);

  function validationRow(ok: boolean, activeInvalid: boolean, text: string) {
    return (
      <div className={"validation-item " + (ok ? "valid" : activeInvalid ? "invalid" : "")}>
        <span className="validation-icon">{ok ? "✅" : activeInvalid ? "❌" : "⭕"}</span>
        {text}
      </div>
    );
  }

  const bannerClass =
    bannerType === "warning"
      ? "warning"
      : bannerType === "error"
        ? "error-message"
        : bannerType === "success"
          ? "success"
          : "";

  const showTopBanner = bannerType === "warning" && !!bannerText;

  return (
    <div className="page-register">
      {modalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.38)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 18px 60px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ fontWeight: 800, color: "#222" }}>
                {modalKind === "success" ? "✅ " : modalKind === "error" ? "❌ " : "⚠️ "}
                {modalTitle}
              </div>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 20,
                  cursor: "pointer",
                  lineHeight: 1,
                  padding: 6,
                  color: "#333",
                }}
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 16, color: "#333", whiteSpace: "pre-line", lineHeight: 1.5 }}>
              {modalBody}
            </div>

            <div style={{ padding: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              {modalKind === "error" || modalKind === "warning" ? (
                <button
                  type="button"
                  className="btn btn-captcha-reload"
                  onClick={() => {
                    resetCaptchaHard();
                    closeModal();
                  }}
                >
                  Перезагрузить капчу
                </button>
              ) : null}

              <button type="button" className="btn btn-primary" onClick={closeModal}>
                Ок
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="register-container">
        <div className="register-card">
          <h2>Регистрация в Edu Keys</h2>

          {showTopBanner ? <div className={bannerClass}>{bannerText}</div> : null}

          <div className="info-box">
            ✅ <strong>Подтверждение email обязательно!</strong> Без подтверждения вход в систему
            невозможен.
          </div>

          <div className="rate-limit">
            ⚠️ <strong>Защита от спама:</strong> Максимум 3 регистрации в час с одного устройства
          </div>

          {!siteKey ? (
            <div className="error-message">❌ NEXT_PUBLIC_TURNSTILE_SITE_KEY не задан</div>
          ) : null}

          <div className="form-group">
            <label htmlFor="fullname">ФИО:</label>
            <input
              id="fullname"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Иванов Иван Иванович"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Контактный телефон:</label>
            <input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 (999) 123-45-67"
            />
          </div>

          <div className="form-group">
            <label htmlFor="region">Область проживания:</label>
            <select id="region" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">-- Выберите область --</option>
              <option value="Белгородская">Белгородская область</option>
              <option value="Курская">Курская область</option>
              <option value="Тамбовская">Тамбовская область</option>
              <option value="Воронежская">Воронежская область</option>
              <option value="Липецкая">Липецкая область</option>
              <option value="Другое">Другая область</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmEmail">Подтверждение email:</label>
            <input
              id="confirmEmail"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="example@gmail.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль:</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Не менее 6 символов"
            />
          </div>

          <div className="email-validation">
            {validationRow(formatValid, !!email.trim(), "Правильный формат email")}
            {validationRow(matchValid, !!confirmEmail.trim(), "Email адреса совпадают")}
            {validationRow(passwordValid, !!password, "Пароль не менее 6 символов")}
            {validationRow(domainValid, !!email.trim(), "Почтовый домен не является временным")}
            {validationRow(phoneValid, false, "Телефон заполнен")}
            {validationRow(regionValid, false, "Область выбрана")}
          </div>

          {siteKey ? (
            <>
              <TurnstileWidget
                siteKey={siteKey}
                action="register"
                reloadNonce={reloadNonce}
                onToken={(t) => setCaptchaToken(t)}
              />

              {!captchaToken ? (
                <div className="rate-limit" style={{ marginTop: 10 }}>
                  🧩 <strong>Если вы не видите капчу</strong> — нажмите{" "}
                  <strong>«Перезагрузить капчу»</strong>.
                  <br />
                  Если не помогло: отключите VPN/прокси и обновите страницу.
                </div>
              ) : null}

              <button
                type="button"
                className="btn btn-captcha-reload"
                disabled={false}
                onClick={() => resetCaptchaHard()}
              >
                Перезагрузить капчу
              </button>
            </>
          ) : null}

          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSubmit}
            onClick={() => void onRegister()}
          >
            {busy ? "Создаем аккаунт..." : "Создать аккаунт"}
          </button>

          <div className="consent-text">
            Нажимая на кнопку "Создать аккаунт", вы соглашаетесь с{" "}
            <a
              href="https://drive.google.com/file/d/1L9kEnkMatFa7I-jT6OImTAw3Bxpjld9l/view?usp=sharing"
              target="_blank"
              rel="noreferrer"
            >
              положением о персональных данных
            </a>
            .
          </div>

          <div className="link">
            <p>
              Уже есть аккаунт? <a href="/login">Войти в систему</a>
            </p>
          </div>

          {registered ? (
            <div className="existing-account-help">
              <strong>📧 Что делать дальше?</strong>
              <br />• Проверьте папку "Входящие" и "Спам" в вашей почте
              <br />• Нажмите на ссылку подтверждения в письме
              <br />• После подтверждения войдите в систему
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}