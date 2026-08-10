"use client";

import { useEffect, useMemo, useState } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";
import { isValidEmailFormat, validateEmailDomain } from "@/lib/security/domains";
import "./register.css";

type BannerType = "error" | "success" | "warning" | null;
type ModalKind = "error" | "success" | "warning";

export default function RegisterPage() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  // Шаги визарда
  const [step, setStep] = useState(1);

  // Данные формы
  const [fullName, setFullName] = useState("");
  const [region, setRegion] = useState("");
  
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const [reloadNonce, setReloadNonce] = useState(0);
  const [bannerType, setBannerType] = useState<BannerType>(null);
  const [bannerText, setBannerText] = useState("");
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState(false);

  // Модалка
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

  // --- ВАЛИДАЦИЯ ШАГОВ ---
  const step1Valid = useMemo(() => {
    return fullName.trim().length >= 3 && region !== "";
  }, [fullName, region]);

  const step2Valid = useMemo(() => {
    const e = email.trim().toLowerCase();
    const formatOk = isValidEmailFormat(e);
    const domainOk = e ? validateEmailDomain(e).ok : false;
    return phone.trim().length > 0 && formatOk && domainOk;
  }, [phone, email]);

  const step3Valid = useMemo(() => {
    return password.length >= 6 && password === confirmPassword && !!captchaToken && !!siteKey;
  }, [password, confirmPassword, captchaToken, siteKey]);

  function nextStep() {
    if (step === 1 && step1Valid) setStep(2);
    if (step === 2 && step2Valid) setStep(3);
  }

  function prevStep() {
    if (step > 1) setStep(step - 1);
  }

  function resetCaptchaHard() {
    setCaptchaToken(null);
    setReloadNonce((n) => n + 1);
  }

  function friendlyErrorFromApi(payload: any, status: number) {
    const code = String(payload?.code || "").toUpperCase();
    const err = String(payload?.error || payload?.message || "").trim();

    if (code === "USER_EXISTS" || err.toLowerCase().includes("уже существует")) {
      return "Аккаунт с таким email уже существует.\n\n• Нажмите «Войти в систему»\n• Или используйте «Забыли пароль?»";
    }
    if (code === "RATE_LIMIT" || status === 429) {
      return "Слишком много попыток. Подождите несколько минут и попробуйте снова.";
    }
    if (code.includes("CAPTCHA") || code.includes("TURNSTILE") || err.toLowerCase().includes("капч")) {
      return (err || "Капча не пройдена.") + "\n\nПопробуйте нажать «Перезагрузить капчу» или отключить VPN.";
    }
    if (code === "VALIDATION") {
      return err || "Проверьте правильность заполнения полей.";
    }
    return err ? err : `Ошибка регистрации (${status}). Попробуйте повторить.`;
  }

  async function onRegister() {
    if (busy || registered || !step3Valid) return;

    try {
      setBusy(true);
      showBanner("warning", "🔄 Создаем ваш аккаунт...");

      // Извлекаем ID пригласившего из URL (реферальная система)
      let refId: string | undefined = undefined;
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        refId = urlParams.get("ref") || undefined;
      }

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          region: region.trim(),
          email: email.trim().toLowerCase(),
          password,
          captchaToken,
          ref: refId, // Передаем реферальный код на бэкенд
        }),
      });

      const text = await res.text();
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }

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
        json.message || "✅ Регистрация принята!\n\n📧 Проверьте почту (и папку Спам) и подтвердите email.\nБез подтверждения вход невозможен."
      );
      setRegistered(true);

      setTimeout(() => {
        window.location.href = "/login?message=check_email";
      }, 6000);
    } catch (e: any) {
      setBusy(false);
      clearBanner();
      resetCaptchaHard();
      openModal("error", "Ошибка", "Не удалось отправить запрос. Проверьте интернет или VPN.");
    }
  }

  // Обработка Enter
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (step === 1 && step1Valid) nextStep();
        else if (step === 2 && step2Valid) nextStep();
        else if (step === 3 && step3Valid) void onRegister();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [step, step1Valid, step2Valid, step3Valid]);

  const showTopBanner = bannerType !== null && !!bannerText;

  return (
    <div className="page-register">
      {modalOpen ? (
        <div className="modal-notice-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-notice">
            <div className="modal-notice-head">
              <div style={{ fontWeight: 800, fontSize: 18, color: "#1e293b" }}>
                {modalKind === "success" ? "🎉 " : modalKind === "error" ? "❌ " : "⚠️ "}
                {modalTitle}
              </div>
              <button type="button" onClick={closeModal} className="modal-notice-x">✕</button>
            </div>
            <div className="modal-notice-body">{modalBody}</div>
            <div className="modal-notice-actions">
              {modalKind === "error" || modalKind === "warning" ? (
                <button type="button" className="btn btn-secondary" onClick={() => { resetCaptchaHard(); closeModal(); }}>
                  Перезагрузить капчу
                </button>
              ) : null}
              <button type="button" className="btn btn-primary" onClick={closeModal} style={{ width: "auto", marginTop: 0 }}>
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
              <div className="brand-title">skilLS</div>
              <div className="brand-subtitle">Создание аккаунта</div>
            </div>
          </div>

          {/* ИНДИКАТОР ПРОГРЕССА */}
          <div className="progress-bar">
            <div className={`progress-step ${step >= 1 ? "active" : ""}`} />
            <div className={`progress-step ${step >= 2 ? "active" : ""}`} />
            <div className={`progress-step ${step >= 3 ? "active" : ""}`} />
          </div>

          {showTopBanner ? <div className={`banner ${bannerType}`}>{bannerText}</div> : null}

          {!siteKey ? <div className="banner error-message">❌ Ключ капчи не настроен</div> : null}

          {registered ? (
            <div className="success-screen animate-step">
              <div className="success-icon">✨</div>
              <h3>Аккаунт создан!</h3>
              <p>Остался один шаг: проверьте вашу почту <strong>{email}</strong> и перейдите по ссылке для активации.</p>
              <div className="link"><a href="/login">Перейти ко входу</a></div>
            </div>
          ) : (
            <div className="wizard-content">
              
              {/* === ШАГ 1: Базовые данные === */}
              {step === 1 && (
                <div className="animate-step">
                  <h2 className="step-title">Шаг 1. Расскажите о себе</h2>
                  
                  <div className="form-group">
                    <label htmlFor="fullname">ФИО</label>
                    <input
                      id="fullname"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Иванов Иван Иванович"
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="region">Регион проживания</label>
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

                  <button type="button" className="btn btn-primary" disabled={!step1Valid} onClick={nextStep}>
                    Далее →
                  </button>
                </div>
              )}

              {/* === ШАГ 2: Контакты === */}
              {step === 2 && (
                <div className="animate-step">
                  <h2 className="step-title">Шаг 2. Как с вами связаться?</h2>
                  
                  <div className="form-group">
                    <label htmlFor="email">Email (Будет логином)</label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="example@gmail.com"
                      autoFocus
                    />
                    {email && !isValidEmailFormat(email.trim()) && <div className="field-error">Некорректный формат email</div>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="phone">Контактный телефон</label>
                    <input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+7 (999) 123-45-67"
                    />
                  </div>

                  <div className="step-actions">
                    <button type="button" className="btn btn-ghost" onClick={prevStep}>← Назад</button>
                    <button type="button" className="btn btn-primary" disabled={!step2Valid} onClick={nextStep}>Далее →</button>
                  </div>
                </div>
              )}

              {/* === ШАГ 3: Безопасность === */}
              {step === 3 && (
                <div className="animate-step">
                  <h2 className="step-title">Шаг 3. Защита аккаунта</h2>

                  <div className="form-group">
                    <label htmlFor="password">Придумайте пароль</label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Минимум 6 символов"
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirmPassword">Повторите пароль</label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Повторите пароль"
                    />
                    {confirmPassword && password !== confirmPassword && (
                      <div className="field-error">Пароли не совпадают</div>
                    )}
                  </div>

                  {siteKey && (
                    <div className="captcha-wrapper">
                      <TurnstileWidget siteKey={siteKey} action="register" reloadNonce={reloadNonce} onToken={(t) => setCaptchaToken(t)} />
                    </div>
                  )}

                  <div className="step-actions">
                    <button type="button" className="btn btn-ghost" onClick={prevStep}>← Назад</button>
                    <button type="button" className="btn btn-primary" disabled={!step3Valid} onClick={() => void onRegister()}>
                      {busy ? "Загрузка..." : "Создать аккаунт"}
                    </button>
                  </div>
                  
                  <div className="consent-text">
                    Создавая аккаунт, вы принимаете <a href="#" target="_blank">политику конфиденциальности</a>.
                  </div>
                </div>
              )}

            </div>
          )}

          {!registered && (
            <div className="link" style={{ marginTop: 24 }}>
              Уже есть аккаунт? <a href="/login">Войти</a>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}