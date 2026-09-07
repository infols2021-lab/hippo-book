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

          <div className="progress-bar">
            <div className="progress-step active" />
          </div>

          {sent ? (
            <div className="success-screen animate-step flex flex-col items-center pt-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <h3 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">Письмо отправлено</h3>
              <p className="text-[15px] text-slate-500 mb-6 text-center leading-relaxed">
                Мы отправили ссылку для сброса пароля на <strong className="text-slate-800 font-semibold">{email}</strong>.
              </p>
              
              <div className="link mb-4">
                <Link href="/login" className="font-semibold text-sky-600 hover:text-sky-700">Вернуться ко входу</Link>
              </div>

              <div className="mt-8 p-[2px] rounded-[24px] bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-400 shadow-lg shadow-indigo-200/50 w-full max-w-md mx-auto">
                <div className="bg-white rounded-[22px] p-6 text-center relative overflow-hidden">
                  {/* Мягкое внутреннее свечение */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-indigo-500/10 blur-xl rounded-full pointer-events-none" />

                  <h4 className="relative text-[17px] font-black text-slate-900 mb-2 tracking-tight">
                    Письмо потерялось?
                  </h4>

                  <p className="relative text-[14px] text-slate-600 font-medium leading-relaxed mb-5">
                    Оно могло случайно улететь в папку «Спам». Если найдете его там, обязательно нажмите кнопку:
                  </p>

                  {/* Фокусный элемент: Имитация кнопки почтовика */}
                  <div className="relative mb-6">
                    <span className="inline-block px-4 py-1.5 bg-slate-900 text-white rounded-lg text-[12px] font-black tracking-widest uppercase shadow-md">
                      Не спам
                    </span>
                    <p className="mt-2 text-[12.5px] font-semibold text-indigo-600">
                      Это жизненно важно для нашего проекта.
                    </p>
                  </div>

                  {/* Блок поддержки */}
                  <div className="relative flex flex-col items-center justify-center pt-5 border-t border-slate-100">
                    <span className="text-[13px] font-medium text-slate-400 mb-3">
                      Всё равно нигде нет?
                    </span>
                    <a
                      href="https://t.me/skebobingg"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-6 py-2.5 bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700 rounded-xl text-[14px] font-bold transition-colors w-full sm:w-auto"
                    >
                      Написать в поддержку
                    </a>
                  </div>
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