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

      openModal(
        "success",
        "Письмо отправлено",
        json.message ||
          "Если указанный email зарегистрирован в системе, мы отправили на него ссылку для смены пароля.\n\nПожалуйста, проверьте папку «Входящие» и «Спам»."
      );

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
        <div
          role="dialog"
          aria-modal="true"
          className="reset-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="reset-modal">
            <div className="reset-modal-header">
              <div className="reset-modal-title">
                {modalTitle}
              </div>
              <button type="button" className="reset-modal-close" onClick={closeModal} aria-label="Закрыть">
                ✕
              </button>
            </div>

            <div className="reset-modal-body">{modalBody}</div>

            <div className="reset-modal-actions">
              {modalKind === "error" || modalKind === "warning" ? (
                <button
                  type="button"
                  className="btn btn-captcha-reload"
                  style={{ width: "auto", margin: 0 }}
                  onClick={() => {
                    resetCaptchaHard();
                    closeModal();
                  }}
                >
                  Перезагрузить капчу
                </button>
              ) : null}

              <button type="button" className="btn btn-primary" style={{ width: "auto", margin: 0 }} onClick={closeModal}>
                Ок
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
            {busy ? "Отправка..." : sent ? "Письмо отправлено" : "Получить ссылку"}
          </button>

          <div className="link">
            Вспомнили пароль? <Link href="/login">Вернуться ко входу</Link>
          </div>
        </div>
      </div>
    </div>
  );
}