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
      showBanner("warning", "Создаем ваш аккаунт...");

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
          ref: refId,
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

      // Все прошло отлично! Отключаем загрузку и показываем наш красивый экран.
      // Таймер и дублирующая модалка отсюда удалены.
      setBusy(false);
      clearBanner();
      setRegistered(true);

    } catch (e: any) {
      setBusy(false);
      clearBanner();
      resetCaptchaHard();
      openModal("error", "Ошибка", "Не удалось отправить запрос. Проверьте интернет или отключите VPN.");
    }
  }

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
                {modalTitle}
              </div>
              <button type="button" onClick={closeModal} className="modal-notice-x">✕</button>
            </div>
            <div className="modal-notice-body" style={{ whiteSpace: "pre-wrap" }}>{modalBody}</div>
            <div className="modal-notice-actions">
              {modalKind === "error" || modalKind === "warning" ? (
                <button type="button" className="btn btn-secondary" onClick={() => { resetCaptchaHard(); closeModal(); }}>
                  Перезагрузить капчу
                </button>
              ) : null}
              <button type="button" className="btn btn-primary" onClick={closeModal} style={{ width: "auto", marginTop: 0 }}>
                Понятно
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

          {!registered && (
            <div className="progress-bar">
              <div className={`progress-step ${step >= 1 ? "active" : ""}`} />
              <div className={`progress-step ${step >= 2 ? "active" : ""}`} />
              <div className={`progress-step ${step >= 3 ? "active" : ""}`} />
            </div>
          )}

          {showTopBanner ? <div className={`banner ${bannerType}`}>{bannerText}</div> : null}

          {!siteKey ? <div className="banner error-message">Ключ защиты не настроен</div> : null}

          {registered ? (
            <div className="success-screen animate-step w-full pt-2">
              <div className="p-[2px] rounded-[24px] bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-400 shadow-xl shadow-indigo-200/50 w-full mx-auto">
                <div className="bg-white rounded-[22px] p-6 sm:p-8 text-center relative overflow-hidden flex flex-col items-center">
                  
                  {/* Мягкое свечение */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-12 bg-indigo-500/10 blur-2xl rounded-full pointer-events-none" />

                  {/* Иконка */}
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 border border-emerald-100 shadow-sm z-10">
                    <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>

                  <h3 className="relative text-[22px] font-black text-slate-900 mb-1 tracking-tight z-10">
                    Аккаунт создан
                  </h3>
                  <div className="relative text-[14px] text-slate-500 font-medium mb-6 z-10">
                    Ссылка для активации улетела на <br/>
                    <span className="inline-block mt-1 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-md">
                      {email}
                    </span>
                  </div>

                  {/* БЛОК СО СПАМОМ - СДЕЛАН МАКСИМАЛЬНЫЙ АКЦЕНТ */}
                  <div className="relative w-full border-t border-slate-100 pt-6 mb-6 z-10">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 text-[11px] font-black tracking-widest uppercase text-slate-300">
                      Внимание
                    </div>
                    
                    <h4 className="text-[16px] font-black text-slate-800 mb-2 tracking-tight">
                      Ищите нас в Спаме
                    </h4>
                    <p className="text-[13px] text-slate-500 font-medium mb-4 leading-relaxed px-2">
                      Если письма нет во входящих, оно точно там. Пожалуйста, откройте его и нажмите эту кнопку:
                    </p>

                    <div className="inline-block px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[13px] font-black tracking-widest uppercase shadow-lg shadow-slate-900/20 transform hover:-translate-y-0.5 transition-transform cursor-default select-none">
                      Не спам
                    </div>
                  </div>

                  {/* Действия */}
                  <a 
                    href="/login" 
                    className="relative w-full inline-flex items-center justify-center px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[15px] font-bold rounded-xl transition-all shadow-md hover:shadow-lg z-10 mb-5"
                  >
                    Перейти ко входу
                  </a>

                  <a 
                    href="https://t.me/skebobingg" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="relative text-[13px] font-bold text-slate-400 hover:text-slate-600 transition-colors z-10 underline decoration-slate-200 underline-offset-4"
                  >
                    Всё равно нет письма? Напишите нам
                  </a>

                </div>
              </div>
            </div>
          ) : (
            <div className="wizard-content">
              
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