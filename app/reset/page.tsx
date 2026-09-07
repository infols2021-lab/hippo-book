"use client";

import "./reset.css";
import Link from "next/link";
import { useMemo, useState } from "react";
import TurnstileWidget from "@/components/TurnstileWidget";
import { isValidEmailFormat, validateEmailDomain } from "@/lib/security/domains";

type BannerType = "error" | "success" | "warning" | null;
type ModalKind = "error" | "success" | "warning";

export default function ResetPage() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const [bannerType, setBannerType] = useState<BannerType>(null);
  const [bannerText, setBannerText] = useState("");

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

  function resetCaptchaHard() {
    setCaptchaToken(null);
    setReloadNonce((n) => n + 1);
  }

  const canSubmit = useMemo(() => {
    const e = email.trim().toLowerCase();
    return !!siteKey && !busy && !sent && isValidEmailFormat(e) && !!captchaToken;
  }, [siteKey, busy, sent, email, captchaToken]);

  function friendlyErrorFromApi(payload: any, status: number) {
    const code = String(payload?.code || "").toUpperCase();
    const err = String(payload?.error || payload?.message || "").trim();

    if (
      code.includes("CAPTCHA") ||
      code.includes("TURNSTILE") ||
      err.toLowerCase().includes("captcha") ||
      err.toLowerCase().includes("капч")
    ) {
      return (
        (err || "Проверка безопасности не пройдена.") +
        "\n\nВозможные решения:\n" +
        "• Нажмите «Перезагрузить капчу»\n" +
        "• Отключите VPN или прокси-сервер\n" +
        "• Обновите страницу"
      );
    }

    if (code === "VALIDATION") return err || "Проверьте правильность введенного email.";
    if (status === 429 || code === "RATE_LIMIT") return "Превышен лимит попыток. Пожалуйста, подождите несколько минут.";

    if (err) return err;
    return `Не удалось отправить письмо (Код: ${status}). Попробуйте обновить страницу.`;
  }

  async function onSend() {
    const e = email.trim().toLowerCase();

    if (!e) {
      openModal("error", "Ошибка", "Пожалуйста, введите ваш email.");
      return;
    }
    if (!isValidEmailFormat(e)) {
      openModal("error", "Ошибка", "Введен некорректный формат email.");
      return;
    }

    const d = validateEmailDomain(e);
    if (!d.ok) {
      openModal("error", "Ошибка", d.message);
      return;
    }

    if (!captchaToken) {
      openModal(
        "warning",
        "Необходима проверка",
        "Пожалуйста, пройдите проверку безопасности.\n\nЕсли блок проверки не отображается, нажмите «Перезагрузить капчу»."
      );
      return;
    }

    try {
      setBusy(true);
      showBanner("warning", "Отправляем письмо для восстановления...");

      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: e, captchaToken }),
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
        openModal("error", "Ошибка", msg);
        return;
      }

      setBusy(false);
      clearBanner();
      setSent(true);

      setCaptchaToken(null);
    } catch (e: any) {
      setBusy(false);
      clearBanner();
      resetCaptchaHard();

      openModal(
        "error",
        "Ошибка соединения",
        "Не удалось отправить запрос.\n\nПопробуйте:\n• Перезагрузить страницу\n• Отключить VPN\n\nТехническая информация: " +
          (e?.message || String(e))
      );
    }
  }

  const showTopBanner = bannerType === "warning" && !!bannerText;

  return (
    <div className="page-reset">
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

      <div className="reset-container">
        <div className="reset-card">
          
          <div className="brand">
            <div className="brand-mark">EK</div>
            <div>
              <div className="brand-title">skilLS</div>
              <div className="brand-subtitle">Восстановление пароля</div>
            </div>
          </div>

          {!sent && (
            <div className="progress-bar">
              <div className="progress-step active" />
            </div>
          )}

          {sent ? (
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
                    Письмо отправлено
                  </h3>
                  <div className="relative text-[14px] text-slate-500 font-medium mb-6 z-10">
                    Ссылка для сброса пароля отправлена на адрес:<br/>
                    <span className="inline-block mt-1 px-2.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-md">
                      {email}
                    </span>
                  </div>

                  {/* БЛОК СО СПАМОМ */}
                  <div className="relative w-full border-t border-slate-100 pt-6 mb-6 z-10">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 text-[11px] font-black tracking-widest uppercase text-slate-300">
                      Внимание
                    </div>
                    
                    <h4 className="text-[16px] font-black text-slate-800 mb-2 tracking-tight">
                      Проверьте папку «Спам»
                    </h4>
                    <p className="text-[13px] text-slate-500 font-medium mb-4 leading-relaxed px-2">
                      Если письмо не поступило во «Входящие», вероятно, оно попало в спам. Пожалуйста, откройте его и нажмите:
                    </p>

                    <div className="inline-block px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[13px] font-black tracking-widest uppercase shadow-lg shadow-slate-900/20 transform hover:-translate-y-0.5 transition-transform cursor-default select-none">
                      Не спам
                    </div>
                  </div>

                  {/* Действия */}
                  <Link 
                    href="/login" 
                    className="relative w-full inline-flex items-center justify-center px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[15px] font-bold rounded-xl transition-all shadow-md hover:shadow-lg z-10 mb-5"
                  >
                    Вернуться ко входу
                  </Link>

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
            <div className="wizard-content animate-step">
              <h2 className="step-title">Шаг 1. Введите email</h2>

              {showTopBanner ? (
                <div className="banner warning" style={{ whiteSpace: "pre-line" }}>
                  {bannerText}
                </div>
              ) : null}

              {!siteKey ? <div className="banner error-message">Отсутствует ключ конфигурации (NEXT_PUBLIC_TURNSTILE_SITE_KEY)</div> : null}

              <div className="info-box">
                Мы отправим письмо со ссылкой для сброса. <strong>Пароль изменится только после перехода по ссылке.</strong>
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  value={email}
                  onChange={(ev) => setEmail(ev.target.value)}
                  placeholder="Введите ваш email"
                  autoComplete="email"
                />
              </div>

              {siteKey ? (
                <>
                  <div className="captcha-wrapper">
                    <TurnstileWidget
                      siteKey={siteKey}
                      action="reset_request"
                      reloadNonce={reloadNonce}
                      onToken={(t) => setCaptchaToken(t)}
                    />
                  </div>

                  {!captchaToken ? (
                    <div className="rate-limit">
                      <strong>Не отображается проверка?</strong> Нажмите «Перезагрузить капчу» ниже или отключите VPN.
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

              <button className="btn btn-primary" disabled={!canSubmit} onClick={() => void onSend()}>
                {busy ? "Отправка..." : "Восстановить пароль"}
              </button>

              <div className="link mt-6">
                Вспомнили пароль? <Link href="/login">Вернуться ко входу</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}