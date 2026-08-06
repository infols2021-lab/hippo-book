"use client";

import { useEffect, useMemo, useState } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";
import { isValidEmailFormat, validateEmailDomain } from "@/lib/security/domains";
import "./register.css";

type BannerType = "error" | "success" | "warning" | null;
type ModalKind = "error" | "success" | "warning";

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

  const formatValid = useMemo(() => isValidEmailFormat(email.trim()), [email]);

  const matchValid = useMemo(() => {
    const e = email.trim().toLowerCase();
    const c = confirmEmail.trim().toLowerCase();
    return !!e && !!c && e === c;
  }, [email, confirmEmail]);

  const passwordValid = useMemo(() => password.length >= 6, [password]);

  const domainValid = useMemo(() => {
    const e = email.trim().toLowerCase();
    return e ? validateEmailDomain(e).ok : false;
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

    if (code.includes("CAPTCHA") || code.includes("TURNSTILE") || err.toLowerCase().includes("капч")) {
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
    if (!isValidEmailFormat(em)) {
      openModal("error", "Ошибка", "Неверный формат email.");
      return;
    }

    const dc = validateEmailDomain(em);
    if (!dc.ok) {
      openModal("error", "Ошибка", dc.message);
      return;
    }

    if (!captchaToken) {
      openModal(
        "warning",
        "Нужна капча",
        "Пожалуйста, пройдите капчу.\n\nЕсли капча не отображается — нажмите «Перезагрузить капчу»."
      );
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

      if (!res.ok || !json?.ok) {
        const msg = friendlyErrorFromApi(json, res.status);
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
          "✅ Регистрация принята!\n\n📧 Проверьте почту (и папку Спам) и подтвердите email.\nБез подтверждения вход невозможен."
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
          (e?.message || String(e))
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
    const statusClass = ok ? "valid" : activeInvalid ? "invalid" : "neutral";
    const icon = ok ? "✓" : activeInvalid ? "✕" : "!";
    return (
      <div className={`validation-item ${statusClass}`}>
        <span className="validation-icon">{icon}</span>
        {text}
      </div>
    );
  }

  const showTopBanner = bannerType !== null && !!bannerText;

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
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            zIndex: 9999,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#ffffff",
              borderRadius: 24,
              boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 18, color: "#1e293b" }}>
                {modalKind === "success" ? "✅ " : modalKind === "error" ? "❌ " : "⚠️ "}
                {modalTitle}
              </div>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  border: "none",
                  background: "#f1f5f9",
                  borderRadius: 10,
                  width: 32,
                  height: 32,
                  fontSize: 14,
                  fontWeight: "bold",
                  cursor: "pointer",
                  color: "#64748b",
                  transition: "background 0.2s",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "24px", color: "#334155", whiteSpace: "pre-line", lineHeight: 1.6, fontWeight: 500 }}>
              {modalBody}
            </div>

            <div style={{ padding: "16px 24px", background: "#f8fafc", display: "flex", gap: 12, justifyContent: "flex-end" }}>
              {modalKind === "error" || modalKind === "warning" ? (
                <button
                  type="button"
                  className="btn btn-captcha-reload"
                  style={{ width: "auto", margin: 0, padding: "12px 16px" }}
                  onClick={() => {
                    resetCaptchaHard();
                    closeModal();
                  }}
                >
                  Перезагрузить капчу
                </button>
              ) : null}

              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ width: "auto", margin: 0, padding: "12px 24px" }}
                onClick={closeModal}
              >
                Ок
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="register-container">
        <div className="register-card">
          
          <div className="brand">
            <div className="brand-mark">EK</div>
            <div>
              <div className="brand-title">Edu Keys</div>
              <div className="brand-subtitle">Регистрация аккаунта</div>
            </div>
          </div>

          {showTopBanner ? <div className={`banner ${bannerType}`}>{bannerText}</div> : null}

          <div className="info-box">
            ✅ <strong>Подтверждение email обязательно!</strong> Без подтверждения вход в систему невозможен.
          </div>

          {!siteKey ? (
            <div className="banner error-message">❌ NEXT_PUBLIC_TURNSTILE_SITE_KEY не задан</div>
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
              <option value="" disabled>-- Выберите область --</option>
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
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@gmail.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmEmail">Подтверждение email:</label>
            <input
              id="confirmEmail"
              type="email"
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

          <div className="validation-box">
            {validationRow(formatValid, !!email.trim(), "Правильный формат email")}
            {validationRow(matchValid, !!confirmEmail.trim(), "Email адреса совпадают")}
            {validationRow(passwordValid, !!password, "Пароль не менее 6 символов")}
            {validationRow(domainValid, !!email.trim(), "Почтовый домен не является временным")}
            {validationRow(phoneValid, false, "Телефон заполнен")}
            {validationRow(regionValid, false, "Область выбрана")}
            {validationRow(nameValid, false, "ФИО заполнено корректно")}
          </div>

          {siteKey ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                <TurnstileWidget
                  siteKey={siteKey}
                  action="register"
                  reloadNonce={reloadNonce}
                  onToken={(t) => setCaptchaToken(t)}
                />
              </div>

              {!captchaToken ? (
                <div className="rate-limit">
                   <strong>Если вы не видите капчу</strong> — нажмите <strong>«Перезагрузить капчу»</strong>.<br />
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
            </a>.
          </div>

          <div className="link">
            Уже есть аккаунт? <a href="/login">Войти в систему</a>
          </div>

          {registered ? (
            <div className="info-box" style={{ marginTop: '24px' }}>
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